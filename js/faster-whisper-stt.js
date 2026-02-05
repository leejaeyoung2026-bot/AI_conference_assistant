/**
 * Faster-Whisper STT System v1.0
 * OpenAI Whisper 최적화 버전인 Faster-Whisper 전용 STT 시스템
 * 
 * 주요 특징:
 * 1. 단일 고성능 모델 (Faster-Whisper) 기반 실시간 전사
 * 2. WebSocket을 통한 실시간 오디오 스트리밍 및 결과 수신
 * 3. 발화자 정보 및 타임스탬프 관리
 */

class FasterWhisperSTTSystem {
    constructor(options = {}) {
        // 기본 설정
        this.config = {
            serverUrl: options.serverUrl || 'http://localhost:8000',
            chunkDuration: options.chunkDuration || 5000, // 5초 단위로 전송하여 문맥 확보
            debug: options.debug || false
        };

        // 상태 관리
        this.isRecording = false;
        this.isPaused = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.allRecordedChunks = [];
        this.stream = null;
        
        // 콜백
        this.onTranscriptCallback = null;
        this.onResultCallback = null;
        this.onErrorCallback = null;
        this.onStatusChangeCallback = null;
        this.onSpeakerChangeCallback = null;

        // 발화자 추적
        this.currentSpeaker = 'primary';
        this.primarySpeakerId = null;

        // 서버 연결 상태
        this.serverConnected = false;
        this.webSocketConnection = null;

        this.log('FasterWhisperSTTSystem 초기화 완료');
    }

    log(message, data = null) {
        if (this.config.debug) {
            console.log(`[FasterWhisperSTT] ${message}`, data || '');
        }
    }

    /**
     * 오디오 초기화
     */
    async initializeAudio() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // MediaRecorder 설정
            const mimeType = this.getSupportedMimeType();
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: mimeType,
                audioBitsPerSecond: 128000
            });

            this.setupMediaRecorderEvents();
            
            this.log('오디오 초기화 완료', { mimeType });
            return true;
        } catch (error) {
            this.log('오디오 초기화 실패', error);
            if (this.onErrorCallback) {
                this.onErrorCallback('audio-init-failed', '마이크 접근 권한이 필요합니다.');
            }
            return false;
        }
    }

    getSupportedMimeType() {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/wav'];
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) return type;
        }
        return 'audio/webm';
    }

    setupMediaRecorderEvents() {
        this.mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
                this.allRecordedChunks.push(event.data);
                
                // 약 100KB 이상 쌓였을 때 전송 (약 6-7초 분량)
                const totalSize = this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
                if (totalSize >= 100000) {
                    await this.processAudioChunk();
                }
            }
        };

        this.mediaRecorder.onstart = () => {
            if (this.onStatusChangeCallback) this.onStatusChangeCallback('recording');
        };

        this.mediaRecorder.onstop = () => {
            if (this.onStatusChangeCallback) this.onStatusChangeCallback('stopped');
        };
    }

    /**
     * 녹음 시작
     */
    async start() {
        if (this.isRecording) return false;

        if (!this.mediaRecorder) {
            const initialized = await this.initializeAudio();
            if (!initialized) return false;
        }

        try {
            this.audioChunks = [];
            
            // 서버 연결 및 대기
            await this.connectToServer();
            
            // 연결이 열릴 때까지 최대 3초 대기
            let attempts = 0;
            while (this.webSocketConnection?.readyState !== WebSocket.OPEN && attempts < 30) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }

            if (this.webSocketConnection?.readyState !== WebSocket.OPEN) {
                throw new Error('서버 연결 시간 초과');
            }

            this.isRecording = true;
            this.isPaused = false;
            this.mediaRecorder.start(this.config.chunkDuration); 
            
            return true;
        } catch (error) {
            this.log('녹음 시작 실패', error);
            this.isRecording = false;
            this.disconnectFromServer();
            return false;
        }
    }

    /**
     * 녹음 중지
     */
    stop() {
        if (!this.isRecording) return;

        this.isRecording = false;
        this.isPaused = false;
        
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }

        if (this.audioChunks.length > 0) {
            this.processAudioChunk();
        }

        this.disconnectFromServer();
    }

    /**
     * 서버 연결
     */
    async connectToServer() {
        try {
            const wsUrl = this.config.serverUrl.replace('http', 'ws') + '/ws/stt';
            this.webSocketConnection = new WebSocket(wsUrl);

            this.webSocketConnection.onopen = () => {
                this.serverConnected = true;
                this.log('서버 연결 성공');
                if (this.onStatusChangeCallback) this.onStatusChangeCallback('server-connected');
            };

            this.webSocketConnection.onmessage = (event) => {
                this.handleServerMessage(JSON.parse(event.data));
            };

            this.webSocketConnection.onerror = (error) => {
                this.log('WebSocket 오류', error);
                this.serverConnected = false;
            };

            this.webSocketConnection.onclose = () => {
                this.serverConnected = false;
                this.log('서버 연결 종료');
            };

        } catch (error) {
            this.log('서버 연결 실패', error);
            this.serverConnected = false;
        }
    }

    disconnectFromServer() {
        if (this.webSocketConnection) {
            this.webSocketConnection.close();
            this.webSocketConnection = null;
        }
        this.serverConnected = false;
    }

    async processAudioChunk() {
        if (this.audioChunks.length === 0 || !this.serverConnected) return;

        const audioBlob = new Blob(this.audioChunks, { 
            type: this.mediaRecorder?.mimeType || 'audio/webm' 
        });
        this.audioChunks = [];

        if (this.webSocketConnection?.readyState === WebSocket.OPEN) {
            const arrayBuffer = await audioBlob.arrayBuffer();
            
            // 메타데이터 전송
            this.webSocketConnection.send(JSON.stringify({
                type: 'audio_metadata',
                speaker: this.getCurrentSpeakerInfo(),
                timestamp: Date.now()
            }));

            // 오디오 데이터 전송
            this.webSocketConnection.send(arrayBuffer);
        }
    }

    handleServerMessage(message) {
        if (message.type === 'ensemble_result' || message.type === 'stt_result') {
            const data = message.data;
            const result = {
                text: data.fasterWhisper?.text || data.finalText,
                confidence: data.fasterWhisper?.confidence || data.confidence,
                speaker: data.speaker,
                timestamp: new Date()
            };

            if (this.onResultCallback) this.onResultCallback(result);
            if (this.onTranscriptCallback) {
                this.onTranscriptCallback({
                    text: result.text,
                    speaker: result.speaker,
                    timestamp: result.timestamp,
                    isFinal: true
                });
            }
        } else if (message.type === 'error') {
            if (this.onErrorCallback) this.onErrorCallback(message.code, message.message);
        }
    }

    getCurrentSpeakerInfo() {
        return {
            type: this.currentSpeaker,
            isPrimary: this.currentSpeaker === 'primary',
            id: this.primarySpeakerId || 'unknown'
        };
    }

    setSpeaker(speakerType) {
        this.currentSpeaker = speakerType;
        if (this.onSpeakerChangeCallback) this.onSpeakerChangeCallback(speakerType);
    }

    onTranscript(callback) { this.onTranscriptCallback = callback; }
    onResult(callback) { this.onResultCallback = callback; }
    onError(callback) { this.onErrorCallback = callback; }
    onStatusChange(callback) { this.onStatusChangeCallback = callback; }
    
    getStatus() {
        return {
            isRecording: this.isRecording,
            serverConnected: this.serverConnected,
            currentSpeaker: this.currentSpeaker
        };
    }
}

window.FasterWhisperSTTSystem = FasterWhisperSTTSystem;
