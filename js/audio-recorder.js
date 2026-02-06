/**
 * Audio Recorder Module v1.0
 * 회의 음성 녹음 및 내보내기 기능
 * 
 * 주요 기능:
 * 1. 실시간 음성 녹음
 * 2. 일시정지/재개
 * 3. 다양한 포맷으로 내보내기 (WebM, WAV)
 * 4. 녹음 시간 추적
 */

class AudioRecorder {
    constructor(options = {}) {
        this.config = {
            sampleRate: options.sampleRate || 44100,
            channels: options.channels || 1,
            bitRate: options.bitRate || 128000,
            mimeType: options.mimeType || null // auto-detect
        };

        // 상태
        this.isRecording = false;
        this.isPaused = false;
        this.mediaRecorder = null;
        this.stream = null;
        this.audioChunks = [];
        
        // 시간 추적
        this.startTime = null;
        this.pausedTime = 0;
        this.totalPausedDuration = 0;
        
        // 콜백
        this.onDataAvailable = null;
        this.onStart = null;
        this.onStop = null;
        this.onPause = null;
        this.onResume = null;
        this.onError = null;

        // 지원 MIME 타입
        this.supportedMimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/wav'
        ];
    }

    /**
     * 지원되는 MIME 타입 자동 감지
     */
    detectMimeType() {
        if (this.config.mimeType && MediaRecorder.isTypeSupported(this.config.mimeType)) {
            return this.config.mimeType;
        }

        for (const type of this.supportedMimeTypes) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return 'audio/webm';
    }

    /**
     * 마이크 스트림 초기화
     */
    async initializeStream() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: this.config.channels,
                    sampleRate: this.config.sampleRate,
                    echoCancellation: this.config.echoCancellation !== undefined ? this.config.echoCancellation : true,
                    noiseSuppression: this.config.noiseSuppression !== undefined ? this.config.noiseSuppression : true,
                    autoGainControl: true
                }
            });
            return true;
        } catch (error) {
            console.error('[AudioRecorder] 마이크 접근 실패:', error);
            if (this.onError) {
                this.onError('microphone-access-denied', '마이크 접근 권한이 필요합니다.');
            }
            return false;
        }
    }

    /**
     * MediaRecorder 설정
     */
    setupMediaRecorder() {
        const mimeType = this.detectMimeType();
        
        this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: mimeType,
            audioBitsPerSecond: this.config.bitRate
        });

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
                if (this.onDataAvailable) {
                    this.onDataAvailable(event.data);
                }
            }
        };

        this.mediaRecorder.onstart = () => {
            this.isRecording = true;
            this.isPaused = false;
            if (this.onStart) this.onStart();
        };

        this.mediaRecorder.onstop = () => {
            this.isRecording = false;
            this.isPaused = false;
            if (this.onStop) this.onStop();
        };

        this.mediaRecorder.onpause = () => {
            this.isPaused = true;
            this.pausedTime = Date.now();
            if (this.onPause) this.onPause();
        };

        this.mediaRecorder.onresume = () => {
            this.isPaused = false;
            if (this.pausedTime > 0) {
                this.totalPausedDuration += Date.now() - this.pausedTime;
                this.pausedTime = 0;
            }
            if (this.onResume) this.onResume();
        };

        this.mediaRecorder.onerror = (event) => {
            console.error('[AudioRecorder] 녹음 오류:', event.error);
            if (this.onError) {
                this.onError('recording-error', event.error?.message || '녹음 중 오류가 발생했습니다.');
            }
        };

        return mimeType;
    }

    /**
     * 녹음 시작
     */
    async start() {
        if (this.isRecording) return false;

        // 스트림이 없으면 초기화
        if (!this.stream) {
            const initialized = await this.initializeStream();
            if (!initialized) return false;
        }

        // MediaRecorder 설정
        const mimeType = this.setupMediaRecorder();
        console.log('[AudioRecorder] 녹음 시작 - MIME 타입:', mimeType);

        // 초기화
        this.audioChunks = [];
        this.startTime = Date.now();
        this.pausedTime = 0;
        this.totalPausedDuration = 0;

        // 녹음 시작 (100ms마다 데이터 수집)
        this.mediaRecorder.start(100);
        return true;
    }

    /**
     * 녹음 중지
     */
    stop() {
        if (!this.isRecording || !this.mediaRecorder) return false;

        if (this.mediaRecorder.state !== 'inactive') {
            this.mediaRecorder.stop();
        }
        return true;
    }

    /**
     * 녹음 일시정지
     */
    pause() {
        if (!this.isRecording || this.isPaused || !this.mediaRecorder) return false;

        if (this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.pause();
            return true;
        }
        return false;
    }

    /**
     * 녹음 재개
     */
    resume() {
        if (!this.isRecording || !this.isPaused || !this.mediaRecorder) return false;

        if (this.mediaRecorder.state === 'paused') {
            this.mediaRecorder.resume();
            return true;
        }
        return false;
    }

    /**
     * 녹음된 오디오 Blob 가져오기
     */
    getAudioBlob() {
        if (this.audioChunks.length === 0) return null;

        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        return new Blob(this.audioChunks, { type: mimeType });
    }

    /**
     * 녹음된 오디오 URL 가져오기
     */
    getAudioUrl() {
        const blob = this.getAudioBlob();
        if (!blob) return null;
        return URL.createObjectURL(blob);
    }

    /**
     * 녹음 시간 계산 (밀리초)
     */
    getRecordingDuration() {
        if (!this.startTime) return 0;

        let duration = Date.now() - this.startTime - this.totalPausedDuration;
        
        // 현재 일시정지 중이면 일시정지 시점까지만 계산
        if (this.isPaused && this.pausedTime > 0) {
            duration = this.pausedTime - this.startTime - this.totalPausedDuration;
        }

        return Math.max(0, duration);
    }

    /**
     * 포맷된 녹음 시간 가져오기
     */
    getFormattedDuration() {
        const ms = this.getRecordingDuration();
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        const pad = (n) => n.toString().padStart(2, '0');
        
        return `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
    }

    /**
     * 녹음 파일 다운로드
     */
    downloadRecording(filename = 'recording') {
        const blob = this.getAudioBlob();
        if (!blob) {
            console.warn('[AudioRecorder] 녹음 데이터가 없습니다.');
            return false;
        }

        // 파일 확장자 결정
        let extension = 'webm';
        const mimeType = blob.type;
        if (mimeType.includes('ogg')) extension = 'ogg';
        else if (mimeType.includes('mp4')) extension = 'm4a';
        else if (mimeType.includes('wav')) extension = 'wav';

        // 다운로드 링크 생성
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}_${this.getTimestamp()}.${extension}`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // URL 해제
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        return true;
    }

    /**
     * 타임스탬프 생성
     */
    getTimestamp() {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    }

    /**
     * WAV 형식으로 변환
     */
    async convertToWav() {
        const blob = this.getAudioBlob();
        if (!blob) return null;

        try {
            // AudioContext를 사용하여 WAV로 변환
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const arrayBuffer = await blob.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            // WAV 인코딩
            const wavBlob = this.audioBufferToWav(audioBuffer);
            audioContext.close();
            
            return wavBlob;
        } catch (error) {
            console.error('[AudioRecorder] WAV 변환 실패:', error);
            return null;
        }
    }

    /**
     * AudioBuffer를 WAV Blob으로 변환
     */
    audioBufferToWav(audioBuffer) {
        const numChannels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        const format = 1; // PCM
        const bitDepth = 16;

        let result;
        if (numChannels === 2) {
            result = this.interleave(audioBuffer.getChannelData(0), audioBuffer.getChannelData(1));
        } else {
            result = audioBuffer.getChannelData(0);
        }

        const dataLength = result.length * (bitDepth / 8);
        const buffer = new ArrayBuffer(44 + dataLength);
        const view = new DataView(buffer);

        // RIFF identifier
        this.writeString(view, 0, 'RIFF');
        // file length
        view.setUint32(4, 36 + dataLength, true);
        // RIFF type
        this.writeString(view, 8, 'WAVE');
        // format chunk identifier
        this.writeString(view, 12, 'fmt ');
        // format chunk length
        view.setUint32(16, 16, true);
        // sample format (raw)
        view.setUint16(20, format, true);
        // channel count
        view.setUint16(22, numChannels, true);
        // sample rate
        view.setUint32(24, sampleRate, true);
        // byte rate (sample rate * block align)
        view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
        // block align (channel count * bytes per sample)
        view.setUint16(32, numChannels * (bitDepth / 8), true);
        // bits per sample
        view.setUint16(34, bitDepth, true);
        // data chunk identifier
        this.writeString(view, 36, 'data');
        // data chunk length
        view.setUint32(40, dataLength, true);

        // write the PCM samples
        this.floatTo16BitPCM(view, 44, result);

        return new Blob([buffer], { type: 'audio/wav' });
    }

    writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    interleave(leftChannel, rightChannel) {
        const length = leftChannel.length + rightChannel.length;
        const result = new Float32Array(length);
        let inputIndex = 0;

        for (let i = 0; i < length;) {
            result[i++] = leftChannel[inputIndex];
            result[i++] = rightChannel[inputIndex];
            inputIndex++;
        }
        return result;
    }

    floatTo16BitPCM(view, offset, input) {
        for (let i = 0; i < input.length; i++, offset += 2) {
            const s = Math.max(-1, Math.min(1, input[i]));
            view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
    }

    /**
     * 녹음 데이터 초기화
     */
    clearRecording() {
        this.audioChunks = [];
        this.startTime = null;
        this.pausedTime = 0;
        this.totalPausedDuration = 0;
    }

    /**
     * 상태 확인
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            duration: this.getRecordingDuration(),
            formattedDuration: this.getFormattedDuration(),
            chunksCount: this.audioChunks.length,
            hasData: this.audioChunks.length > 0
        };
    }

    /**
     * 리소스 정리
     */
    destroy() {
        this.stop();
        
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }

        this.mediaRecorder = null;
        this.audioChunks = [];
    }
}

// 전역으로 내보내기
window.AudioRecorder = AudioRecorder;
