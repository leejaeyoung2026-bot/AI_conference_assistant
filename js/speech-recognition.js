/**
 * Speech Recognition Module v2.0
 * Web Speech API를 사용한 실시간 음성인식 모듈
 * N-Best 다중 후보 지원
 */

class SpeechRecognitionManager {
    constructor() {
        this.recognition = null;
        this.isListening = false;
        this.transcript = [];
        this.currentSentence = '';
        this.onResultCallback = null;
        this.onStatusChangeCallback = null;
        this.onErrorCallback = null;
        this.language = 'ko-KR';

        // N-Best 설정
        this.maxAlternatives = 5;           // 최대 후보 수
        this.enableNBest = true;            // N-Best 활성화 여부

        // 재시작 관리
        this.restartAttempts = 0;
        this.maxRestartAttempts = 5;
        this.restartDelay = 100;            // ms (최소 지연)
        this._restartTimeout = null;        // 재시작 타이머 추적
        this._isRestarting = false;         // 재시작 중 플래그

        this.buffer = '';                   // 텍스트 버퍼 (삭제 예정)
        // this.bufferTimer = null;         // 버퍼 타이머 (삭제)
        // this.bufferInterval = 5000;      // 버퍼 간격 (삭제)
        // this.onBufferFullCallback = null;// 버퍼 가득 참 콜백 (삭제)

        this.init();
    }

    init() {
        // Web Speech API 지원 확인
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            console.error('이 브라우저는 음성인식을 지원하지 않습니다.');
            if (this.onErrorCallback) {
                this.onErrorCallback('browser-not-supported', '이 브라우저는 음성인식을 지원하지 않습니다. Chrome 또는 Edge 브라우저를 사용해 주세요.');
            }
            return false;
        }

        this.recognition = new SpeechRecognition();
        this.setupRecognition();
        return true;
    }

    setupRecognition() {
        if (!this.recognition) return;

        // 음성인식 설정
        this.recognition.continuous = true;                         // 연속 인식
        this.recognition.interimResults = true;                     // 중간 결과 표시
        this.recognition.lang = this.language;                      // 언어 설정
        this.recognition.maxAlternatives = this.maxAlternatives;    // N-Best 후보 수

        // 결과 이벤트
        this.recognition.onresult = (event) => {
            let interimTranscript = '';
            let finalTranscript = '';
            let candidates = [];

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    candidates = [];
                    for (let j = 0; j < result.length; j++) {
                        candidates.push({
                            transcript: result[j].transcript.trim(),
                            confidence: result[j].confidence || 0
                        });
                    }
                    finalTranscript += result[0].transcript;
                    // 버퍼링 로직 삭제
                    // this.buffer += result[0].transcript + ' ';
                    // this.resetBufferTimer();
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            this.currentSentence = interimTranscript;

            if (finalTranscript) {
                const transcriptResult = {
                    text: finalTranscript.trim(),
                    timestamp: new Date(),
                    isFinal: true,
                    candidates: this.enableNBest ? candidates : null
                };
                this.transcript.push(transcriptResult);

                if (candidates.length > 1) {
                    console.log('음성인식 N-Best 후보:', candidates);
                }

                if (this.onResultCallback) {
                    this.onResultCallback(transcriptResult);
                }

                // 성공적으로 인식이 되면 재시작 카운터 초기화
                this.restartAttempts = 0;
            }

            if (this.onResultCallback && interimTranscript) {
                this.onResultCallback({
                    text: interimTranscript,
                    timestamp: new Date(),
                    isFinal: false,
                    candidates: null
                });
            }
        };

        // 시작 이벤트
        this.recognition.onstart = () => {
            this.isListening = true;
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback('listening');
            }
        };

        // 종료 이벤트
        this.recognition.onend = () => {
            // 연속 인식을 위해 자동 재시작
            if (this.isListening) {
                this.restartRecognition();
            } else {
                this.restartAttempts = 0;
                if (this.onStatusChangeCallback) {
                    this.onStatusChangeCallback('stopped');
                }
            }
        };

        // 에러 이벤트
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);

            let errorMessage = '';
            let shouldRestart = false;

            switch (event.error) {
                case 'no-speech':
                    // 무음 에러는 무시하고 계속 진행
                    return;
                case 'audio-capture':
                    errorMessage = '마이크를 찾을 수 없습니다. 마이크가 연결되어 있는지 확인해 주세요.';
                    break;
                case 'not-allowed':
                    errorMessage = '마이크 권한이 거부되었습니다. 브라우저 설정에서 마이크 권한을 허용해 주세요.';
                    this.isListening = false;
                    break;
                case 'network':
                    // 네트워크 오류는 자동 재시도
                    console.warn('음성인식 네트워크 오류, 자동 재시도...');
                    shouldRestart = true;
                    break;
                case 'aborted':
                    return; // 사용자가 중단한 경우 무시
                default:
                    errorMessage = `음성인식 오류: ${event.error}`;
                    shouldRestart = true;
            }

            // 네트워크 오류 시 자동 재시작 시도
            if (shouldRestart && this.isListening) {
                this.restartRecognition();
                return; // 에러 콜백 호출 안함
            }

            if (this.onErrorCallback && errorMessage) {
                this.onErrorCallback(event.error, errorMessage);
            }
        };

        // 소리 시작 이벤트
        this.recognition.onsoundstart = () => {
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback('sound-detected');
            }
        };

        // 소리 종료 이벤트
        this.recognition.onsoundend = () => {
            if (this.onStatusChangeCallback) {
                this.onStatusChangeCallback('sound-ended');
            }
        };
    }

    // 음성인식 재시작 (네트워크 오류 복구용) - 최적화
    restartRecognition() {
        if (!this.isListening || this._isRestarting) return;

        this._isRestarting = true;
        this.restartAttempts++;

        if (this.restartAttempts > this.maxRestartAttempts) {
            console.error(`음성인식 재시작 ${this.maxRestartAttempts}회 실패, 중지합니다.`);
            this.isListening = false;
            this.restartAttempts = 0;
            this._isRestarting = false;
            if (this.onErrorCallback) {
                this.onErrorCallback('network', '음성인식 연결이 불안정합니다. 네트워크를 확인하고 다시 시작해주세요.');
            }
            return;
        }

        // 이전 타이머 취소
        if (this._restartTimeout) {
            clearTimeout(this._restartTimeout);
        }

        // 지연 후 재시작 (최소 지연으로 빠르게 복구)
        const delay = this.restartDelay * Math.min(this.restartAttempts, 3); // 최대 300ms

        this._restartTimeout = setTimeout(() => {
            this._isRestarting = false;
            if (!this.isListening) return;

            try {
                this.recognition.start();
                // 성공하면 카운터 리셋
                this.restartAttempts = 0;
            } catch (e) {
                // 재시작 실패 시 조용히 로그만 (비틀거림 방지)
                console.debug(`음성인식 재시작 시도 ${this.restartAttempts}/${this.maxRestartAttempts}`);
                // 다음 재시도는 onend에서 처리됨
            }
        }, delay);
    }

    // 버퍼 타이머 리셋 (삭제됨)
    resetBufferTimer() {
        // 기능 제거됨
    }

    // 음성인식 시작 (최적화)
    start() {
        if (!this.recognition) {
            const initialized = this.init();
            if (!initialized) return false;
        }

        // 이전 재시작 타이머 취소
        if (this._restartTimeout) {
            clearTimeout(this._restartTimeout);
            this._restartTimeout = null;
        }

        try {
            this.isListening = true;
            this.restartAttempts = 0;
            this._isRestarting = false;
            this.recognition.start();
            return true;
        } catch (error) {
            console.error('Failed to start recognition:', error);
            this.isListening = false;
            return false;
        }
    }

    // 음성인식 중지 (최적화)
    stop() {
        // 재시작 타이머 취소
        if (this._restartTimeout) {
            clearTimeout(this._restartTimeout);
            this._restartTimeout = null;
        }

        this._isRestarting = false;

        if (this.recognition && this.isListening) {
            this.isListening = false;
            try {
                this.recognition.stop();
            } catch (e) {
                // 이미 중지된 경우 무시
            }
        }
    }

    // 언어 설정
    setLanguage(lang) {
        this.language = lang;
        if (this.recognition) {
            this.recognition.lang = lang;
        }
    }

    // N-Best 설정
    setEnableNBest(enabled) {
        this.enableNBest = enabled;
    }

    setMaxAlternatives(max) {
        this.maxAlternatives = Math.max(1, Math.min(10, max));
        if (this.recognition) {
            this.recognition.maxAlternatives = this.maxAlternatives;
        }
    }

    // 트랜스크립트 초기화
    clearTranscript() {
        this.transcript = [];
        this.currentSentence = '';
        this.buffer = '';
        if (this.bufferTimer) clearTimeout(this.bufferTimer);
    }

    // 전체 트랜스크립트 텍스트 가져오기
    getFullTranscript() {
        return this.transcript.map(item => item.text).join(' ');
    }

    // 콜백 설정
    onResult(callback) {
        this.onResultCallback = callback;
    }

    onStatusChange(callback) {
        this.onStatusChangeCallback = callback;
    }

    onError(callback) {
        this.onErrorCallback = callback;
    }

    onBufferFull(callback) {
        this.onBufferFullCallback = callback;
    }

    setBufferInterval(ms) {
        this.bufferInterval = ms;
    }

    // 상태 확인
    getStatus() {
        return {
            isListening: this.isListening,
            language: this.language,
            transcriptCount: this.transcript.length,
            enableNBest: this.enableNBest,
            maxAlternatives: this.maxAlternatives
        };
    }
}

// 전역으로 내보내기
window.SpeechRecognitionManager = SpeechRecognitionManager;
