/**
 * Whisper.wasm (Transformers.js) Test Module
 */

import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3';

// 핵심: 라이브러리가 로컬 서버가 아닌 CDN에서 직접 모델과 WASM을 가져오도록 강제 설정
env.allowLocalModels = false;
env.remoteModels = true;
// v3에서는 WASM 경로 설정 방식이 약간 다를 수 있으나 기본적으로 CDN을 사용하도록 설정
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/';

export class WhisperTester {
    constructor() {
        this.transcriber = null;
        this.isModelLoading = false;
        this.currentModelName = null;
    }

    async initModel(onProgress = null, modelName = 'Xenova/whisper-tiny') {
        // 이미 같은 모델이 로드되어 있다면 재사용
        if (this.transcriber && this.currentModelName === modelName) return true;
        
        try {
            this.isModelLoading = true;
            this.currentModelName = modelName;
            console.log(`[WhisperTest] 모델 로딩 시작: ${modelName}`);
            
            const options = {
                progress_callback: (progress) => {
                    if (onProgress) onProgress(progress);
                }
            };

            // Large 모델의 경우 메모리 절약을 위해 fp16 또는 q8 권장
            if (modelName.includes('large')) {
                options.dtype = 'fp16'; 
            }

            // WebGPU 사용 가능 여부 확인 및 설정 시도
            try {
                if (navigator.gpu) {
                    console.log('[WhisperTest] WebGPU 감지됨. 사용을 시도합니다.');
                    options.device = 'webgpu';
                }
            } catch (e) {
                console.warn('[WhisperTest] WebGPU 체크 중 오류:', e);
            }
            
            this.transcriber = await pipeline('automatic-speech-recognition', modelName, options);
            
            this.isModelLoading = false;
            console.log(`[WhisperTest] 모델 로딩 완료: ${modelName} (${options.device || 'cpu'})`);
            return true;
        } catch (error) {
            this.isModelLoading = false;
            this.currentModelName = null;
            this.transcriber = null;
            console.error('[WhisperTest] 모델 로딩 상세 에러:', error);
            throw error;
        }
    }

    async transcribe(audioData) {
        if (!this.transcriber) throw new Error('모델이 초기화되지 않았습니다.');

        try {
            console.log('[WhisperTest] 전사 시작...', { 
                sampleCount: audioData.length,
                model: this.currentModelName 
            });
            
            const start = performance.now();
            const output = await this.transcriber(audioData, {
                language: 'korean',
                task: 'transcribe',
                return_timestamps: false,
                chunk_length_s: 30, // 30초 단위로 나누어 처리 (메모리 절약)
                stride_length_s: 5,  // 청크 간 5초 중첩 (경계 정확도)
            });
            const end = performance.now();
            
            console.log('[WhisperTest] 전사 완료. raw output:', output);
            
            // v3에서는 결과 구조가 다를 수 있으므로 안전하게 추출
            let resultText = '';
            if (typeof output === 'string') {
                resultText = output;
            } else if (output && typeof output.text === 'string') {
                resultText = output.text;
            } else if (Array.isArray(output) && output.length > 0 && output[0].text) {
                resultText = output[0].text;
            } else {
                resultText = JSON.stringify(output);
            }
            
            return {
                text: resultText,
                duration: (end - start) / 1000
            };
        } catch (error) {
            console.error('[WhisperTest] 전사 상세 에러:', error);
            // 에러 객체가 문자열인 경우 등을 대비
            const errorMessage = error.message || (typeof error === 'string' ? error : JSON.stringify(error));
            throw new Error(errorMessage);
        }
    }

    async prepareAudio(audioUrl) {
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        return audioBuffer.getChannelData(0);
    }
}
