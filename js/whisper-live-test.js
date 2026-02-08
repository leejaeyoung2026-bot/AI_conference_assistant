/**
 * Whisper.wasm Live Streaming Test Module
 */
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3';

env.allowLocalModels = false;
env.remoteModels = true;
env.backends.onnx.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.3.3/dist/';

export class WhisperLiveTester {
    constructor() {
        this.transcriber = null;
        this.audioContext = null;
        this.stream = null;
        this.processor = null;
        this.isRecording = false;
        this.audioBuffer = []; 
        this.sampleRate = 16000;
        this.modelName = null;

        // VAD 설정
        this.vadThreshold = 0.01;       // 음성 감지 임계값 (볼륨)
        this.silenceDuration = 1000;   // 1초간 침묵하면 문장이 끝난 것으로 간주
        this.maxBufferLength = 10;      // 최대 10초까지만 버퍼링 (너무 길어짐 방지)
        this.lastSpeakingTime = 0;     // 마지막으로 음성이 감지된 시간
        this.isSpeaking = false;       // 현재 말을 하고 있는 중인지 여부
    }

    async initModel(onProgress = null, modelName = 'Xenova/whisper-tiny') {
        if (this.transcriber && this.modelName === modelName) return;
        
        this.modelName = modelName;
        const options = {
            progress_callback: onProgress
        };
        
        // GPU 지원 확인
        if (navigator.gpu) {
            options.device = 'webgpu';
            if (modelName.includes('large')) options.dtype = 'fp16';
        }

        this.transcriber = await pipeline('automatic-speech-recognition', modelName, options);
    }

    async startStreaming(callback) {
        if (this.isRecording) return;
        
        this.isRecording = true;
        this.audioBuffer = [];
        this.isSpeaking = false;
        this.lastSpeakingTime = Date.now();
        
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });
        
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        this.processor.onaudioprocess = async (e) => {
            if (!this.isRecording) return;
            
            const inputData = e.inputBuffer.getChannelData(0);
            
            // 1. 에너지(볼륨) 계산
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) {
                sum += inputData[i] * inputData[i];
            }
            const rms = Math.sqrt(sum / inputData.length);

            // 볼륨 모니터링을 위해 가끔씩 로그 출력
            if (Math.random() < 0.05) {
                console.log(`[VAD Debug] RMS: ${rms.toFixed(4)}, Threshold: ${this.vadThreshold}`);
            }

            const now = Date.now();

            // 2. 음성 활동 감지 로직
            if (rms > this.vadThreshold) {
                if (!this.isSpeaking) {
                    console.log('[VAD] 음성 감지 시작');
                    this.isSpeaking = true;
                }
                this.lastSpeakingTime = now;
            }

            // 3. 버퍼링
            if (this.isSpeaking) {
                this.audioBuffer.push(...inputData);

                const silenceElapsed = now - this.lastSpeakingTime;
                const bufferSeconds = this.audioBuffer.length / this.sampleRate;

                if (silenceElapsed > this.silenceDuration || bufferSeconds > this.maxBufferLength) {
                    console.log(`[VAD] 문장 종료 감지 (침묵: ${silenceElapsed}ms, 버퍼: ${bufferSeconds.toFixed(1)}s)`);
                    this.isSpeaking = false;
                    const bufferToProcess = [...this.audioBuffer];
                    this.audioBuffer = []; 
                    
                    this.processBuffer(bufferToProcess, callback);
                }
            }
        };
    }

    async processBuffer(buffer, callback) {
        if (buffer.length < this.sampleRate * 0.5) return; 

        try {
            const currentData = new Float32Array(buffer);
            
            // 모델별 파라미터 조정
            const options = {
                task: 'transcribe',
                return_timestamps: false
            };

            // Whisper 모델일 때만 언어 설정 (Moonshine 등은 지원 안 할 수 있음)
            if (this.modelName.includes('whisper')) {
                options.language = 'korean';
                options.chunk_length_s = 30;
                options.stride_length_s = 5;
            }

            console.log(`[LiveWhisper] 전사 요청 (${this.modelName})...`);
            const output = await this.transcriber(currentData, options);
            console.log('[LiveWhisper] raw output:', output);

            const text = typeof output === 'string' ? output : (output.text || '');
            if (text.trim()) {
                callback(text, true);
            } else {
                console.warn('[LiveWhisper] 전사 결과가 비어있습니다.');
            }
        } catch (err) {
            console.error('[LiveWhisper] Process Error:', err);
            // 에러를 UI로 전달할 수 있는 콜백이 있으면 좋겠지만 일단 콘솔 로그 강화
        }
    }

    stopStreaming() {
        this.isRecording = false;
        if (this.processor) {
            this.processor.disconnect();
            this.processor = null;
        }
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
    }
}