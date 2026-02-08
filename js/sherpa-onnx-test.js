/**
 * Sherpa-onnx (SenseVoice-Small) Manager
 */

export class SherpaOnnxManager {
    constructor() {
        this.recognizer = null;
        this.audioContext = null;
        this.stream = null;
        this.processor = null;
        this.isRecording = false;
        this.audioBuffer = [];
        this.sampleRate = 16000;
        
        // VAD (간단한 에너지 기반)
        this.vadThreshold = 0.01;
        this.silenceDuration = 800;
        this.lastSpeakingTime = 0;
        this.isSpeaking = false;
        
        // 모델 경로 (Hugging Face 허브 활용 - CORS 지원이 더 안정적임)
        this.modelBaseUrl = 'https://huggingface.co/csukuangfj/sherpa-onnx-sense-voice-zh-en-ja-ko-yue-2024-07-17-int8/resolve/main/';
        this.modelName = 'sense-voice-small';
    }

    async init(onProgress) {
        if (this.recognizer) return;

        console.log('[SherpaOnnx] 초기화 시작...');

        // 1. WASM 런타임 대기
        const Module = await new Promise((resolve, reject) => {
            if (window.sherpaOnnxInitialized && window.Module && window.Module.OfflineRecognizer) {
                resolve(window.Module);
                return;
            }

            const timeout = setTimeout(() => {
                window.removeEventListener('sherpa-onnx-ready', onReady);
                reject(new Error('WASM 초기화 타임아웃. 네트워크 상태나 브라우저 콘솔을 확인하세요.'));
            }, 60000);

            const onReady = () => {
                clearTimeout(timeout);
                window.removeEventListener('sherpa-onnx-ready', onReady);
                resolve(window.Module);
            };
            window.addEventListener('sherpa-onnx-ready', onReady);
        });

        // 2. 모델 파일 다운로드
        await this.loadModelFiles(Module, onProgress);

        console.log('[SherpaOnnx] Recognizer 생성 중...');
        const config = {
            offlineRecognizerConfig: {
                offlineModelConfig: {
                    senseVoice: {
                        model: `/${this.modelName}/model.int8.onnx`,
                        tokens: `/${this.modelName}/tokens.txt`,
                        numThreads: 1,
                        useItn: 1
                    }
                }
            },
            sampleRate: this.sampleRate
        };

        try {
            this.recognizer = new Module.OfflineRecognizer(config);
            console.log('[SherpaOnnx] Recognizer 생성 완료');
        } catch (e) {
            console.error('[SherpaOnnx] Recognizer 생성 실패:', e);
            throw e;
        }
    }

    async loadModelFiles(Module, onProgress) {
        const files = [
            { name: 'model.int8.onnx', path: 'model.int8.onnx' },
            { name: 'tokens.txt', path: 'tokens.txt' }
        ];

        if (!Module.FS.analyzePath(`/${this.modelName}`).exists) {
            Module.FS.mkdir(`/${this.modelName}`);
        }
        
        let loaded = 0;
        for (const file of files) {
            const url = `${this.modelBaseUrl}${file.path}`;
            console.log(`[SherpaOnnx] Downloading ${file.name}...`);
            
            const response = await fetch(url, { mode: 'cors' });
            if (!response.ok) throw new Error(`다운로드 실패: ${response.statusText}`);
            
            const buffer = await response.arrayBuffer();
            Module.FS.writeFile(`/${this.modelName}/${file.name}`, new Uint8Array(buffer));
            
            loaded++;
            if (onProgress) onProgress((loaded / files.length) * 100);
        }
    }

    async startStreaming(callback) {
        if (this.isRecording) return;
        this.isRecording = true;
        this.audioBuffer = [];
        
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
            sampleRate: this.sampleRate
        });
        
        const source = this.audioContext.createMediaStreamSource(this.stream);
        this.processor = this.audioContext.createScriptProcessor(4096, 1, 1);
        
        source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        this.processor.onaudioprocess = (e) => {
            if (!this.isRecording) return;
            const inputData = e.inputBuffer.getChannelData(0);
            
            // 에너지 기반 VAD
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
            const rms = Math.sqrt(sum / inputData.length);
            const now = Date.now();

            if (rms > this.vadThreshold) {
                if (!this.isSpeaking) this.isSpeaking = true;
                this.lastSpeakingTime = now;
            }

            if (this.isSpeaking) {
                this.audioBuffer.push(...inputData);
                if (now - this.lastSpeakingTime > this.silenceDuration) {
                    this.isSpeaking = false;
                    const bufferToProcess = [...this.audioBuffer];
                    this.audioBuffer = [];
                    this.processBuffer(bufferToProcess, callback);
                }
            }
        };
    }

    async processBuffer(buffer, callback) {
        if (buffer.length < 8000) return; // 너무 짧으면 무시

        const stream = this.recognizer.createStream();
        stream.acceptWaveform(this.sampleRate, new Float32Array(buffer));
        this.recognizer.decodeStream(stream);
        const result = this.recognizer.getResult(stream);
        
        // SenseVoice 특수 태그 분석 (<|HAPPY|>, <|LAUGH|>, <|ko|> 등)
        const text = result.text;
        const emotion = this.extractTag(text, /<\|(HAPPY|SAD|ANGRY|NEUTRAL)\|>/);
        const event = this.extractTag(text, /<\|(LAUGH|CLICK|HUM|COUGH|SNEEZE)\|>/);
        const lang = this.extractTag(text, /<\|(zh|en|ko|ja|yue)\|>/);
        
        // 태그 제거된 순수 텍스트
        const cleanText = text.replace(/<\|.*?\|>/g, '').trim();

        if (cleanText) {
            callback({
                text: cleanText,
                isFinal: true,
                emotion: emotion,
                event: event,
                lang: lang
            });
        }
        
        stream.delete();
    }

    extractTag(text, regex) {
        const match = text.match(regex);
        return match ? match[1] : null;
    }

    stopStreaming() {
        this.isRecording = false;
        if (this.processor) this.processor.disconnect();
        if (this.stream) this.stream.getTracks().forEach(t => t.stop());
        if (this.audioContext) this.audioContext.close();
    }
}
