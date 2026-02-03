/**
 * Ensemble STT System v1.0
 * 3대 오픈소스 STT 모델 병렬 앙상블 시스템
 * 
 * 지원 모델:
 * 1. SenseVoice-Small: 초고속 인식 및 이벤트 감지
 * 2. Faster-Whisper (int8): 표준적인 문장 정확도
 * 3. Qwen3-ASR: 멀티모달 추론 기반 문맥 파악
 * 
 * 프론트엔드 모듈 - 백엔드 서버 연동 준비
 */

class EnsembleSTTSystem {
    constructor(options = {}) {
        // 기본 설정
        this.config = {
            serverUrl: options.serverUrl || 'https://ai-conference-assistant.onrender.com',
            chunkDuration: options.chunkDuration || 5000, // 5초 단위
            enableEnsemble: options.enableEnsemble !== false,
            fallbackToWebSpeech: options.fallbackToWebSpeech !== false,
            debug: options.debug || false
        };

        // 상태 관리
        this.isRecording = false;
        this.isPaused = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.allRecordedChunks = []; // 전체 녹음 저장용
        this.stream = null;
        
        // 콜백
        this.onTranscriptCallback = null;
        this.onEnsembleResultCallback = null;
        this.onErrorCallback = null;
        this.onStatusChangeCallback = null;
        this.onSpeakerChangeCallback = null;

        // 발화자 추적
        this.currentSpeaker = 'primary'; // 'primary' 또는 'secondary'
        this.speakerHistory = [];
        this.primarySpeakerId = null;
        this.speakerProfiles = new Map();

        // 청크 처리
        this.chunkBuffer = [];
        this.processingQueue = [];
        this.isProcessing = false;

        // 웹 오디오 분석 (발화자 감지용)
        this.audioContext = null;
        this.analyser = null;
        this.voiceActivityThreshold = 0.02;

        // 서버 연결 상태
        this.serverConnected = false;
        this.webSocketConnection = null;

        this.log('EnsembleSTTSystem 초기화 완료');
    }

    log(message, data = null) {
        if (this.config.debug) {
            console.log(`[EnsembleSTT] ${message}`, data || '');
        }
    }

    /**
     * 마이크 권한 요청 및 스트림 설정
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

            // Web Audio API 설정 (음성 활동 감지용)
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            
            const source = this.audioContext.createMediaStreamSource(this.stream);
            source.connect(this.analyser);

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

    /**
     * 지원되는 MIME 타입 확인
     */
    getSupportedMimeType() {
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/wav'
        ];
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return 'audio/webm';
    }

    /**
     * MediaRecorder 이벤트 설정
     */
    setupMediaRecorderEvents() {
        this.mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
                this.allRecordedChunks.push(event.data);
                
                // 설정된 청크 크기에 도달하면 처리
                const totalSize = this.audioChunks.reduce((sum, chunk) => sum + chunk.size, 0);
                if (totalSize >= 50000) { // 약 50KB
                    await this.processAudioChunk();
                }
            }
        };

        this.mediaRecorder.onstart = () => {
            this.log('녹음 시작');
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback('recording');
            }
        };

        this.mediaRecorder.onstop = () => {
            this.log('녹음 중지');
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback('stopped');
            }
        };

        this.mediaRecorder.onpause = () => {
            this.log('녹음 일시정지');
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback('paused');
            }
        };

        this.mediaRecorder.onresume = () => {
            this.log('녹음 재개');
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback('recording');
            }
        };

        this.mediaRecorder.onerror = (event) => {
            this.log('녹음 오류', event.error);
            if (this.onErrorCallback) {
                this.onErrorCallback('recording-error', event.error.message);
            }
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
            this.isRecording = true;
            this.isPaused = false;
            
            // 청크 단위로 녹음 (1초마다 데이터 수집)
            this.mediaRecorder.start(1000);
            
            // 음성 활동 모니터링 시작
            this.startVoiceActivityDetection();
            
            // 서버 연결 시도
            await this.connectToServer();
            
            return true;
        } catch (error) {
            this.log('녹음 시작 실패', error);
            this.isRecording = false;
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

        // 마지막 청크 처리
        if (this.audioChunks.length > 0) {
            this.processAudioChunk();
        }

        this.stopVoiceActivityDetection();
        this.disconnectFromServer();
    }

    /**
     * 녹음 일시정지
     */
    pause() {
        if (!this.isRecording || this.isPaused) return false;
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.pause();
            this.isPaused = true;
            return true;
        }
        return false;
    }

    /**
     * 녹음 재개
     */
    resume() {
        if (!this.isRecording || !this.isPaused) return false;
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
            this.mediaRecorder.resume();
            this.isPaused = false;
            return true;
        }
        return false;
    }

    /**
     * 서버 연결
     */
    async connectToServer() {
        try {
            // WebSocket 연결 시도
            const wsUrl = this.config.serverUrl.replace('http', 'ws') + '/ws/stt';
            this.webSocketConnection = new WebSocket(wsUrl);

            this.webSocketConnection.onopen = () => {
                this.serverConnected = true;
                this.log('서버 연결 성공');
                if (this.onStatusChangeCallback) {
                    this.onStatusChangeCallback('server-connected');
                }
            };

            this.webSocketConnection.onmessage = (event) => {
                this.handleServerMessage(JSON.parse(event.data));
            };

            this.webSocketConnection.onerror = (error) => {
                this.log('WebSocket 오류', error);
                this.serverConnected = false;
                // 폴백: Web Speech API 사용
                if (this.config.fallbackToWebSpeech) {
                    this.log('Web Speech API로 폴백');
                }
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

    /**
     * 서버 연결 해제
     */
    disconnectFromServer() {
        if (this.webSocketConnection) {
            this.webSocketConnection.close();
            this.webSocketConnection = null;
        }
        this.serverConnected = false;
    }

    /**
     * 오디오 청크 처리
     */
    async processAudioChunk() {
        if (this.audioChunks.length === 0) return;

        const audioBlob = new Blob(this.audioChunks, { 
            type: this.mediaRecorder?.mimeType || 'audio/webm' 
        });
        this.audioChunks = [];

        // 발화자 정보 추가
        const speakerInfo = this.getCurrentSpeakerInfo();

        if (this.serverConnected) {
            // 서버로 전송
            await this.sendToServer(audioBlob, speakerInfo);
        } else {
            // 로컬 폴백 처리 (시뮬레이션)
            this.simulateEnsembleResult(audioBlob, speakerInfo);
        }
    }

    /**
     * 서버로 오디오 전송
     */
    async sendToServer(audioBlob, speakerInfo) {
        if (!this.webSocketConnection || this.webSocketConnection.readyState !== WebSocket.OPEN) {
            return;
        }

        // ArrayBuffer로 변환하여 전송
        const arrayBuffer = await audioBlob.arrayBuffer();
        
        // 메타데이터 전송
        this.webSocketConnection.send(JSON.stringify({
            type: 'audio_metadata',
            speaker: speakerInfo,
            timestamp: Date.now(),
            mimeType: audioBlob.type
        }));

        // 오디오 데이터 전송
        this.webSocketConnection.send(arrayBuffer);
    }

    /**
     * 서버 메시지 처리
     */
    handleServerMessage(message) {
        switch (message.type) {
            case 'ensemble_result':
                this.handleEnsembleResult(message.data);
                break;
            case 'speaker_detected':
                this.handleSpeakerDetection(message.data);
                break;
            case 'error':
                if (this.onErrorCallback) {
                    this.onErrorCallback(message.code, message.message);
                }
                break;
        }
    }

    /**
     * 앙상블 결과 처리
     */
    handleEnsembleResult(data) {
        const result = {
            finalText: data.finalText,
            models: {
                senseVoice: data.senseVoice,
                fasterWhisper: data.fasterWhisper,
                qwenASR: data.qwenASR
            },
            speaker: data.speaker,
            confidence: data.confidence,
            timestamp: new Date(),
            events: data.events || [] // 웃음, 박수 등
        };

        if (this.onEnsembleResultCallback) {
            this.onEnsembleResultCallback(result);
        }

        if (this.onTranscriptCallback) {
            this.onTranscriptCallback({
                text: result.finalText,
                speaker: result.speaker,
                timestamp: result.timestamp,
                isFinal: true,
                confidence: result.confidence
            });
        }
    }

    /**
     * 앙상블 결과 시뮬레이션 (서버 미연결 시)
     */
    simulateEnsembleResult(audioBlob, speakerInfo) {
        // 시뮬레이션 모드에서는 콜백만 호출
        this.log('앙상블 시뮬레이션 모드 (서버 미연결)');
        
        // 음성 데이터 크기 기반으로 텍스트 생성 유무 결정
        if (audioBlob.size < 1000) return;

        // 시뮬레이션 결과
        const simulatedResult = {
            finalText: '[서버 연결 필요] 앙상블 STT 처리 대기 중...',
            models: {
                senseVoice: null,
                fasterWhisper: null,
                qwenASR: null
            },
            speaker: speakerInfo,
            confidence: 0,
            timestamp: new Date(),
            events: []
        };

        if (this.onEnsembleResultCallback) {
            this.onEnsembleResultCallback(simulatedResult);
        }
    }

    /**
     * Mock 테스트: 3개 모델에서 각각 다른 유사 결과가 들어온 상황 시뮬레이션
     * @returns {Object} Mock 앙상블 결과
     */
    static generateMockEnsembleData() {
        // 3개 모델이 각각 다르게 인식한 예시 데이터
        return {
            models: {
                senseVoice: {
                    text: '오늘 회의 주제는 에이피아이 연동 기능입니다',
                    confidence: 0.85,
                    events: ['speech']
                },
                fasterWhisper: {
                    text: '오늘 회의 주제는 API 연동 기능입니다',
                    confidence: 0.92,
                    events: []
                },
                qwenASR: {
                    text: '오늘 회의 주제는 에이 피 아이 연동 기능입니다',
                    confidence: 0.88,
                    events: []
                }
            },
            speaker: {
                type: 'primary',
                isPrimary: true,
                id: 'speaker_mock_001'
            },
            events: ['speech'],
            timestamp: new Date()
        };
    }

    /**
     * Mock 테스트 실행: 앙상블 보정 프로세스 검증
     * @param {GeminiEnsembleCorrector} corrector - Gemini 앙상블 보정기
     * @returns {Promise<Object>} 보정된 결과
     */
    static async runMockTest(corrector) {
        const mockData = EnsembleSTTSystem.generateMockEnsembleData();
        
        console.log('[MockTest] === 앙상블 보정 테스트 시작 ===');
        console.log('[MockTest] 입력 데이터:');
        console.log('  - SenseVoice:', mockData.models.senseVoice.text);
        console.log('  - Faster-Whisper:', mockData.models.fasterWhisper.text);
        console.log('  - Qwen3-ASR:', mockData.models.qwenASR.text);
        
        if (!corrector || !corrector.geminiAPI?.isConfigured) {
            console.warn('[MockTest] Gemini API가 설정되지 않았습니다. 기본 선택 로직을 사용합니다.');
            
            // Gemini 없이 기본 선택 로직 테스트
            const bestCandidate = corrector ? corrector.selectBestCandidate(mockData) : {
                text: mockData.models.fasterWhisper.text,
                confidence: mockData.models.fasterWhisper.confidence,
                model: 'Faster-Whisper'
            };
            
            console.log('[MockTest] 결과 (기본 선택):');
            console.log('  - 선택된 텍스트:', bestCandidate.text);
            console.log('  - 모델:', bestCandidate.model);
            console.log('  - 신뢰도:', bestCandidate.confidence);
            
            return {
                success: true,
                method: 'basic_selection',
                input: mockData,
                output: bestCandidate
            };
        }
        
        try {
            // Gemini 앙상블 보정 실행
            console.log('[MockTest] Gemini 보정 시작...');
            const correctedResult = await corrector.correctEnsembleResult(mockData);
            
            console.log('[MockTest] 결과 (Gemini 보정):');
            console.log('  - 보정된 텍스트:', correctedResult.text);
            console.log('  - 신뢰도:', correctedResult.confidence);
            console.log('[MockTest] === 테스트 완료 ===');
            
            return {
                success: true,
                method: 'gemini_correction',
                input: mockData,
                output: correctedResult
            };
        } catch (error) {
            console.error('[MockTest] 보정 실패:', error);
            return {
                success: false,
                method: 'gemini_correction',
                input: mockData,
                error: error.message
            };
        }
    }

    /**
     * 음성 활동 감지 시작
     */
    startVoiceActivityDetection() {
        if (!this.analyser) return;

        const bufferLength = this.analyser.frequencyBinCount;
        const dataArray = new Float32Array(bufferLength);

        const detectActivity = () => {
            if (!this.isRecording) return;

            this.analyser.getFloatTimeDomainData(dataArray);
            
            // RMS 계산
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i] * dataArray[i];
            }
            const rms = Math.sqrt(sum / bufferLength);

            // 음성 활동 감지
            if (rms > this.voiceActivityThreshold) {
                this.detectSpeakerChange(rms);
            }

            if (this.isRecording) {
                requestAnimationFrame(detectActivity);
            }
        };

        detectActivity();
    }

    /**
     * 음성 활동 감지 중지
     */
    stopVoiceActivityDetection() {
        // 추가 정리 작업 필요 시 여기에 구현
    }

    /**
     * 발화자 변경 감지
     */
    detectSpeakerChange(volume) {
        // 간단한 발화자 변경 감지 로직
        // 실제로는 더 복잡한 화자 식별 알고리즘 필요
        
        const now = Date.now();
        const lastActivity = this.speakerHistory[this.speakerHistory.length - 1];
        
        if (lastActivity && now - lastActivity.timestamp > 2000) {
            // 2초 이상 조용했다면 발화자 변경 가능성 체크
            const volumeDiff = Math.abs(volume - (lastActivity.volume || 0));
            
            if (volumeDiff > 0.05) {
                // 볼륨 차이가 큰 경우 발화자 변경으로 판단
                const newSpeaker = this.currentSpeaker === 'primary' ? 'secondary' : 'primary';
                this.setSpeaker(newSpeaker);
            }
        }

        this.speakerHistory.push({
            timestamp: now,
            volume: volume,
            speaker: this.currentSpeaker
        });

        // 히스토리 제한 (최근 100개)
        if (this.speakerHistory.length > 100) {
            this.speakerHistory.shift();
        }
    }

    /**
     * 주 발화자 설정
     */
    setPrimarySpeaker() {
        this.primarySpeakerId = `speaker_${Date.now()}`;
        this.currentSpeaker = 'primary';
        this.log('주 발화자 설정됨', this.primarySpeakerId);
    }

    /**
     * 발화자 수동 전환
     */
    setSpeaker(speakerType) {
        if (this.currentSpeaker !== speakerType) {
            this.currentSpeaker = speakerType;
            if (this.onSpeakerChangeCallback) {
                this.onSpeakerChangeCallback(speakerType);
            }
            this.log('발화자 변경', speakerType);
        }
    }

    /**
     * 현재 발화자 정보 가져오기
     */
    getCurrentSpeakerInfo() {
        return {
            type: this.currentSpeaker,
            isPrimary: this.currentSpeaker === 'primary',
            id: this.currentSpeaker === 'primary' ? this.primarySpeakerId : `secondary_${Date.now()}`
        };
    }

    /**
     * 발화자 변경 감지 결과 처리
     */
    handleSpeakerDetection(data) {
        if (data.newSpeaker && data.newSpeaker !== this.currentSpeaker) {
            this.setSpeaker(data.newSpeaker);
        }
    }

    /**
     * 녹음된 전체 오디오 가져오기
     */
    async getRecordedAudio() {
        if (this.allRecordedChunks.length === 0) {
            return null;
        }

        const audioBlob = new Blob(this.allRecordedChunks, {
            type: this.mediaRecorder?.mimeType || 'audio/webm'
        });

        return {
            blob: audioBlob,
            url: URL.createObjectURL(audioBlob),
            duration: this.getRecordingDuration(),
            mimeType: audioBlob.type,
            size: audioBlob.size
        };
    }

    /**
     * 녹음 길이 계산
     */
    getRecordingDuration() {
        // 청크 개수 기반 대략적 계산 (1초당 1청크)
        return this.allRecordedChunks.length;
    }

    /**
     * 녹음 데이터 초기화
     */
    clearRecording() {
        this.audioChunks = [];
        this.allRecordedChunks = [];
        this.speakerHistory = [];
        this.currentSpeaker = 'primary';
    }

    /**
     * 콜백 설정
     */
    onTranscript(callback) {
        this.onTranscriptCallback = callback;
    }

    onEnsembleResult(callback) {
        this.onEnsembleResultCallback = callback;
    }

    onError(callback) {
        this.onErrorCallback = callback;
    }

    onStatusChange(callback) {
        this.onStatusChangeCallback = callback;
    }

    onSpeakerChange(callback) {
        this.onSpeakerChangeCallback = callback;
    }

    /**
     * 상태 확인
     */
    getStatus() {
        return {
            isRecording: this.isRecording,
            isPaused: this.isPaused,
            serverConnected: this.serverConnected,
            currentSpeaker: this.currentSpeaker,
            recordedDuration: this.getRecordingDuration(),
            chunkCount: this.allRecordedChunks.length
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

        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.disconnectFromServer();
        this.log('리소스 정리 완료');
    }
}

// 전역으로 내보내기
window.EnsembleSTTSystem = EnsembleSTTSystem;
