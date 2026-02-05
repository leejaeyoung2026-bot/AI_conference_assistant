/**
 * Faster-Whisper STT System v1.1
 * 매 청크마다 유효한 헤더를 포함하여 서버 전송 (Invalid Data 오류 해결)
 */

class FasterWhisperSTTSystem {
    constructor(options = {}) {
        this.config = {
            serverUrl: options.serverUrl || 'http://localhost:8000',
            chunkDuration: options.chunkDuration || 5000, // 5초 단위
            debug: options.debug || false
        };

        this.isRecording = false;
        this.mediaRecorder = null;
        this.stream = null;
        this.webSocketConnection = null;
        this.serverConnected = false;
        
        // 발화자 정보
        this.currentSpeaker = 'primary';
        this.primarySpeakerId = `speaker_${Date.now()}`;

        // 콜백
        this.onTranscriptCallback = null;
        this.onErrorCallback = null;
        this.onStatusChangeCallback = null;

        this.log('FasterWhisperSTTSystem v1.1 초기화');
    }

    log(message, data = null) {
        if (this.config.debug) console.log(`[FasterWhisperSTT] ${message}`, data || '');
    }

    async initializeAudio() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true }
            });
            return true;
        } catch (error) {
            this.log('마이크 접근 실패', error);
            if (this.onErrorCallback) this.onErrorCallback('audio-init-failed', '마이크 권한이 필요합니다.');
            return false;
        }
    }

    async start() {
        if (this.isRecording) return false;
        
        if (!this.stream) {
            const ok = await this.initializeAudio();
            if (!ok) return false;
        }

        try {
            await this.connectToServer();
            
            // WebSocket이 열릴 때까지 대기
            let attempts = 0;
            while (this.webSocketConnection?.readyState !== WebSocket.OPEN && attempts < 20) {
                await new Promise(r => setTimeout(r, 100));
                attempts++;
            }

            if (!this.serverConnected) throw new Error('서버 연결 실패');

            this.isRecording = true;
            this.startChunkRecording();
            return true;
        } catch (error) {
            this.isRecording = false;
            return false;
        }
    }

    /**
     * 핵심 로직: 일정 시간마다 녹음기를 껐다 켜서 독립적인 오디오 파일(청크) 생성
     */
    startChunkRecording() {
        if (!this.isRecording) return;

        const mimeType = this.getSupportedMimeType();
        this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });
        const chunks = [];

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        this.mediaRecorder.onstop = async () => {
            if (chunks.length > 0 && this.serverConnected) {
                const blob = new Blob(chunks, { type: mimeType });
                await this.sendAudioToServer(blob);
            }
            // 즉시 다음 청크 녹음 시작 (연속성 유지)
            if (this.isRecording) this.startChunkRecording();
        };

        // 지정된 시간(ms) 후 녹음 중단 -> onstop 트리거 -> 전송 및 재시작
        this.mediaRecorder.start();
        setTimeout(() => {
            if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
                this.mediaRecorder.stop();
            }
        }, this.config.chunkDuration);
    }

    async sendAudioToServer(blob) {
        if (!this.webSocketConnection || this.webSocketConnection.readyState !== WebSocket.OPEN) return;

        const arrayBuffer = await blob.arrayBuffer();
        
        // 1. 메타데이터 전송
        this.webSocketConnection.send(JSON.stringify({
            type: 'audio_metadata',
            speaker: { type: this.currentSpeaker, isPrimary: this.currentSpeaker === 'primary', id: this.primarySpeakerId },
            timestamp: Date.now()
        }));

        // 2. 바이너리 데이터 전송
        this.webSocketConnection.send(arrayBuffer);
        this.log(`청크 전송 완료 (${(blob.size / 1024).toFixed(1)} KB)`);
    }

    async connectToServer() {
        const wsUrl = this.config.serverUrl.replace('http', 'ws') + '/ws/stt';
        this.webSocketConnection = new WebSocket(wsUrl);

        this.webSocketConnection.onopen = () => {
            this.serverConnected = true;
            if (this.onStatusChangeCallback) this.onStatusChangeCallback('recording');
        };

        this.webSocketConnection.onmessage = (e) => {
            const message = JSON.parse(e.data);
            if (message.type === 'stt_result' && this.onTranscriptCallback) {
                this.onTranscriptCallback({
                    text: message.data.finalText,
                    isFinal: true,
                    timestamp: new Date()
                });
            }
        };

        this.webSocketConnection.onclose = () => {
            this.serverConnected = false;
            if (this.isRecording) this.connectToServer(); // 비정상 종료 시 재연결 시도
        };
    }

    stop() {
        this.isRecording = false;
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        if (this.webSocketConnection) {
            this.webSocketConnection.close();
        }
    }

    getSupportedMimeType() {
        const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'];
        for (const type of types) if (MediaRecorder.isTypeSupported(type)) return type;
        return 'audio/webm';
    }

    onTranscript(cb) { this.onTranscriptCallback = cb; }
    onError(cb) { this.onErrorCallback = cb; }
    onStatusChange(cb) { this.onStatusChangeCallback = cb; }
}

window.FasterWhisperSTTSystem = FasterWhisperSTTSystem;