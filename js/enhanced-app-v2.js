/**
 * Enhanced Meeting AI Assistant v5.0
 * 앙상블 STT + 발화자 구분 + Gemini 통합 보정
 * 
 * 주요 기능:
 * 1. 3대 STT 모델 앙상블 보정 (서버 연동 준비)
 * 2. 발화자 자동 구분 (주발표자/참석자)
 * 3. 녹음 일시정지/재개
 * 4. 음성 파일 내보내기
 * 5. HTML 회의록 내보내기
 */

class EnhancedMeetingApp {
    constructor() {
        // 핵심 모듈 초기화
        this.speechManager = new SpeechRecognitionManager();
        this.aiEngine = new AIAnalysisEngine();
        this.geminiAPI = new GeminiAPI();
        this.textCorrector = new TextCorrector(this.geminiAPI);
        
        // 새로운 모듈
        this.audioRecorder = new AudioRecorder();
        this.speakerDetector = new SpeakerDetector();
        this.meetingExporter = new MeetingExporter();
        
        // 앙상블 시스템 (서버 연결 필요)
        this.ensembleSTT = null; // 필요 시 초기화
        this.ensembleCorrector = null;

        // DOM 요소
        this.elements = this.initializeElements();

        // 상태
        this.state = {
            isRecording: false,
            isPaused: false,
            timerInterval: null,
            startTime: null,
            pausedDuration: 0,
            pauseStartTime: null,
            wordCount: 0,
            sentenceCount: 0,
            language: 'ko-KR',
            autoAnswer: true,
            enableCorrection: true,
            enableGrounding: true,
            enableAutoSummary: true,
            enableSpeakerDetection: true,
            ensembleMode: false // 앙상블 모드 (서버 필요)
        };

        // 데이터
        this.data = {
            fullTranscript: [],
            questions: [],
            aiAnswers: [],
            meetingSummaries: [],
            speakerHistory: []
        };

        // 초기화
        this.init();
    }

    /**
     * DOM 요소 초기화
     */
    initializeElements() {
        return {
            // 버튼
            startBtn: document.getElementById('startBtn'),
            stopBtn: document.getElementById('stopBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            clearBtn: document.getElementById('clearBtn'),
            exportBtn: document.getElementById('exportBtn'),
            exportAudioBtn: document.getElementById('exportAudioBtn'),
            exportHtmlBtn: document.getElementById('exportHtmlBtn'),
            settingsBtn: document.getElementById('settingsBtn'),
            closeModal: document.getElementById('closeModal'),
            setPrimarySpeakerBtn: document.getElementById('setPrimarySpeakerBtn'),

            // 상태 표시
            statusIndicator: document.getElementById('statusIndicator'),
            voiceVisualizer: document.getElementById('voiceVisualizer'),
            timer: document.getElementById('timer'),
            speakerIndicator: document.getElementById('speakerIndicator'),

            // 텍스트 영역
            currentSpeech: document.getElementById('currentSpeech'),
            transcriptHistory: document.getElementById('transcriptHistory'),

            // 분석 영역
            questionsList: document.getElementById('questionsList'),
            aiAnswersList: document.getElementById('aiAnswersList'),
            meetingSummary: document.getElementById('meetingSummary'),

            // 통계
            questionCount: document.getElementById('questionCount'),
            answerCount: document.getElementById('answerCount'),
            totalWords: document.getElementById('totalWords'),
            totalSentences: document.getElementById('totalSentences'),
            totalQuestions: document.getElementById('totalQuestions'),
            summaryStatus: document.getElementById('summaryStatus'),

            // 모달 및 설정
            settingsModal: document.getElementById('settingsModal'),
            languageSelect: document.getElementById('languageSelect'),
            sensitivityRange: document.getElementById('sensitivityRange'),
            sensitivityValue: document.getElementById('sensitivityValue'),
            soundAlert: document.getElementById('soundAlert'),

            // Gemini API 설정
            geminiApiKey: document.getElementById('geminiApiKey'),
            toggleApiKeyVisibility: document.getElementById('toggleApiKeyVisibility'),
            autoAnswer: document.getElementById('autoAnswer'),
            aiResponseStyle: document.getElementById('aiResponseStyle'),
            apiStatus: document.getElementById('apiStatus'),

            // 전문용어 보정 설정
            enableCorrection: document.getElementById('enableCorrection'),
            correctionPersona: document.getElementById('correctionPersona'),
            enableNBest: document.getElementById('enableNBest'),

            // 회의 컨텍스트 설정
            meetingContext: document.getElementById('meetingContext'),
            priorityTerms: document.getElementById('priorityTerms'),
            contextStatus: document.getElementById('contextStatus'),
            sessionDictionary: document.getElementById('sessionDictionary'),

            // 보정 버퍼 설정
            correctionInterval: document.getElementById('correctionInterval'),
            correctionIntervalValue: document.getElementById('correctionIntervalValue'),

            // 새로운 기능
            enableGrounding: document.getElementById('enableGrounding'),
            enableAutoSummary: document.getElementById('enableAutoSummary'),
            enableSpeakerDetection: document.getElementById('enableSpeakerDetection'),
            
            // 앙상블 STT 설정
            enableEnsemble: document.getElementById('enableEnsemble'),
            ensembleServerUrl: document.getElementById('ensembleServerUrl'),
            testEnsembleConnection: document.getElementById('testEnsembleConnection'),
            ensembleStatus: document.getElementById('ensembleStatus'),
            ensembleStatusText: document.getElementById('ensembleStatusText'),
            toggleServerHelp: document.getElementById('toggleServerHelp'),
            serverHelpContent: document.getElementById('serverHelpContent'),
            downloadServerTemplate: document.getElementById('downloadServerTemplate'),

            // 토스트
            toastContainer: document.getElementById('toastContainer')
        };
    }

    /**
     * 초기화
     */
    init() {
        this.setupEventListeners();
        this.setupSpeechCallbacks();
        this.setupAICallbacks();
        this.setupGeminiCallbacks();
        this.setupTextCorrectorCallbacks();
        this.setupAudioRecorderCallbacks();
        this.setupSpeakerDetectorCallbacks();
        this.setupEnsembleListeners();
        this.loadSettings();
        this.updateApiStatusUI();
        this.updateContextStatusUI();
        this.updateEnsembleStatusUI();
        
        // 보정 버퍼 간격 초기화
        this.initCorrectionIntervalUI();
        
        console.log('[EnhancedMeetingApp] 앱 초기화 완료 v5.0');
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 녹음 버튼
        if (this.elements.startBtn) {
            this.elements.startBtn.addEventListener('click', () => this.startRecording());
        }
        if (this.elements.stopBtn) {
            this.elements.stopBtn.addEventListener('click', () => this.stopRecording());
        }
        if (this.elements.pauseBtn) {
            this.elements.pauseBtn.addEventListener('click', () => this.togglePause());
        }
        if (this.elements.clearBtn) {
            this.elements.clearBtn.addEventListener('click', () => this.clearAll());
        }

        // 내보내기 버튼
        if (this.elements.exportBtn) {
            this.elements.exportBtn.addEventListener('click', () => this.showExportMenu());
        }
        if (this.elements.exportAudioBtn) {
            this.elements.exportAudioBtn.addEventListener('click', () => this.exportAudio());
        }
        if (this.elements.exportHtmlBtn) {
            this.elements.exportHtmlBtn.addEventListener('click', () => this.exportHTML());
        }

        // 주발표자 설정 버튼
        if (this.elements.setPrimarySpeakerBtn) {
            this.elements.setPrimarySpeakerBtn.addEventListener('click', () => this.setPrimarySpeaker());
        }

        // 설정 모달
        if (this.elements.settingsBtn) {
            this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        }
        if (this.elements.closeModal) {
            this.elements.closeModal.addEventListener('click', () => this.closeSettings());
        }
        if (this.elements.settingsModal) {
            this.elements.settingsModal.addEventListener('click', (e) => {
                if (e.target === this.elements.settingsModal) {
                    this.closeSettings();
                }
            });
        }

        // API 키 토글
        if (this.elements.toggleApiKeyVisibility) {
            this.elements.toggleApiKeyVisibility.addEventListener('click', () => this.toggleApiKeyVisibility());
        }

        // 설정 변경 이벤트
        this.setupSettingsChangeListeners();
    }

    /**
     * 설정 변경 리스너
     */
    setupSettingsChangeListeners() {
        // 언어 설정
        if (this.elements.languageSelect) {
            this.elements.languageSelect.addEventListener('change', (e) => {
                this.state.language = e.target.value;
                this.speechManager.setLanguage(this.state.language);
                this.saveSettings();
            });
        }

        // API 키 - 입력 시 실시간 검증
        if (this.elements.geminiApiKey) {
            this.elements.geminiApiKey.addEventListener('change', async (e) => {
                const apiKey = e.target.value.trim();
                this.geminiAPI.setApiKey(apiKey);
                this.saveSettings();
                
                // API 키 유효성 검증 (비동기)
                if (apiKey) {
                    await this.validateApiKey(apiKey);
                } else {
                    this.updateApiStatusWithState('error', 'API 키 미설정');
                }
            });
            
            // 붙여넣기 시에도 검증
            this.elements.geminiApiKey.addEventListener('paste', async (e) => {
                setTimeout(async () => {
                    const apiKey = this.elements.geminiApiKey.value.trim();
                    if (apiKey) {
                        this.geminiAPI.setApiKey(apiKey);
                        this.saveSettings();
                        await this.validateApiKey(apiKey);
                    }
                }, 100);
            });
        }

        // 자동 답변
        if (this.elements.autoAnswer) {
            this.elements.autoAnswer.addEventListener('change', (e) => {
                this.state.autoAnswer = e.target.checked;
                this.saveSettings();
            });
        }

        // 전문용어 보정
        if (this.elements.enableCorrection) {
            this.elements.enableCorrection.addEventListener('change', (e) => {
                this.state.enableCorrection = e.target.checked;
                this.textCorrector.enabled = e.target.checked;
                this.saveSettings();
            });
        }

        // 민감도
        if (this.elements.sensitivityRange) {
            this.elements.sensitivityRange.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.aiEngine.sensitivity = value;
                const labels = ['매우 낮음', '낮음', '보통', '높음', '매우 높음'];
                if (this.elements.sensitivityValue) {
                    this.elements.sensitivityValue.textContent = labels[value - 1];
                }
                this.saveSettings();
            });
        }

        // 보정 버퍼 간격 설정 (수정됨: 동기화 문제 해결)
        if (this.elements.correctionInterval) {
            this.elements.correctionInterval.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (this.elements.correctionIntervalValue) {
                    this.elements.correctionIntervalValue.textContent = `${value}초`;
                }
                // TextCorrector에 간격 적용
                if (this.textCorrector) {
                    this.textCorrector.minCorrectionInterval = value * 1000;
                }
                this.saveSettings();
            });
        }

        // 회의 컨텍스트
        if (this.elements.meetingContext) {
            this.elements.meetingContext.addEventListener('change', () => {
                this.updateContext();
                this.saveSettings();
            });
        }

        // 우선 인식 용어
        if (this.elements.priorityTerms) {
            this.elements.priorityTerms.addEventListener('change', () => {
                this.updateContext();
                this.saveSettings();
            });
        }
    }

    /**
     * 음성인식 콜백 설정
     */
    setupSpeechCallbacks() {
        // 결과 콜백
        this.speechManager.onResult((result) => {
            this.handleSpeechResult(result);
        });

        // 상태 변경 콜백
        this.speechManager.onStatusChange((status) => {
            this.updateRecordingStatus(status);
        });

        // 에러 콜백
        this.speechManager.onError((errorCode, errorMessage) => {
            this.showToast(errorMessage, 'error');
            console.error('[Speech Error]', errorCode, errorMessage);
        });
    }

    /**
     * AI 분석 콜백 설정
     */
    setupAICallbacks() {
        // 질문 감지 콜백
        this.aiEngine.onQuestionDetected = async (question) => {
            await this.handleQuestionDetected(question);
        };
    }

    /**
     * Gemini API 콜백 설정
     */
    setupGeminiCallbacks() {
        // 요약 생성 콜백
        this.geminiAPI.onSummaryGenerated = (summary) => {
            this.updateMeetingSummary(summary);
        };
    }

    /**
     * 텍스트 보정 콜백 설정
     */
    setupTextCorrectorCallbacks() {
        this.textCorrector.onCorrectionComplete = (original, corrected) => {
            if (original !== corrected) {
                console.log(`[TextCorrector] 보정: "${original}" → "${corrected}"`);
            }
        };
    }

    /**
     * 오디오 레코더 콜백 설정
     */
    setupAudioRecorderCallbacks() {
        this.audioRecorder.onStart = () => {
            console.log('[AudioRecorder] 녹음 시작');
        };

        this.audioRecorder.onStop = () => {
            console.log('[AudioRecorder] 녹음 중지');
        };

        this.audioRecorder.onPause = () => {
            console.log('[AudioRecorder] 녹음 일시정지');
        };

        this.audioRecorder.onResume = () => {
            console.log('[AudioRecorder] 녹음 재개');
        };

        this.audioRecorder.onError = (code, message) => {
            this.showToast(message, 'error');
        };
    }

    /**
     * 발화자 감지 콜백 설정
     */
    setupSpeakerDetectorCallbacks() {
        this.speakerDetector.onSpeakerChange = (info) => {
            this.updateSpeakerIndicator(info.current);
            console.log('[SpeakerDetector] 발화자 변경:', info);
        };

        this.speakerDetector.onPrimarySpeakerSet = (speaker) => {
            this.showToast('주발표자가 설정되었습니다', 'success');
        };
    }

    /**
     * 녹음 시작
     */
    async startRecording() {
        if (this.state.isRecording) return;

        console.log('[App] 녹음 시작 요청');

        // UI 즉시 업데이트 (버벅임 방지)
        this.updateButtonStates('starting');

        try {
            // 음성인식 시작
            const speechStarted = this.speechManager.start();
            if (!speechStarted) {
                throw new Error('음성인식을 시작할 수 없습니다');
            }

            // 오디오 녹음 시작 (실패해도 음성인식은 계속 진행)
            try {
                const audioStarted = await this.audioRecorder.start();
                if (audioStarted === false) {
                    console.warn('[StartRecording] 오디오 레코더 시작 실패 (반환값 false)');
                    this.showToast('오디오 녹음을 시작할 수 없으나, 음성 인식은 진행됩니다.', 'warning');
                }
            } catch (audioError) {
                console.error('[StartRecording] 오디오 레코더 오류:', audioError);
                this.showToast('오디오 녹음 초기화 실패 (음성 인식만 진행됨)', 'warning');
            }

            // 발화자 감지 초기화 (실패해도 녹음은 계속되어야 함)
            try {
                if (this.state.enableSpeakerDetection && this.audioRecorder.stream) {
                    this.speakerDetector.initializeAnalyser(this.audioRecorder.stream);
                }
            } catch (sdError) {
                console.warn('[StartRecording] 발화자 감지 초기화 실패:', sdError);
            }

            // 상태 업데이트
            this.state.isRecording = true;
            this.state.isPaused = false;
            this.state.startTime = Date.now();
            this.state.pausedDuration = 0;

            // 타이머 시작
            this.startTimer();

            // UI 업데이트 (확실하게 처리)
            console.log('[App] 녹음 상태로 UI 변경');
            this.updateButtonStates('recording');
            this.updateRecordingStatus('recording');

            // 컨텍스트 업데이트
            try {
                this.updateContext();
            } catch (ctxError) {
                console.warn('[StartRecording] 컨텍스트 업데이트 실패:', ctxError);
            }

            // 1분 주기 자동 요약 타이머 시작
            if (this.state.enableAutoSummary && this.geminiAPI.isConfigured) {
                this.startAutoSummaryTimer();
            }

            this.showToast('녹음이 시작되었습니다', 'success');

        } catch (error) {
            console.error('[StartRecording Error]', error);
            this.showToast(error.message || '녹음 시작에 실패했습니다', 'error');
            
            // 실패 시 상태 복구
            this.state.isRecording = false;
            this.stopTimer();
            if (this.speechManager) this.speechManager.stop();
            if (this.audioRecorder) this.audioRecorder.stop();
            
            this.updateButtonStates('idle');
        }
    }

    /**
     * 녹음 중지
     */
    stopRecording() {
        if (!this.state.isRecording) return;

        // 음성인식 중지
        this.speechManager.stop();

        // 오디오 녹음 중지
        this.audioRecorder.stop();

        // 타이머 중지
        this.stopTimer();
        
        // 자동 요약 타이머 중지
        this.stopAutoSummaryTimer();

        // 상태 업데이트
        this.state.isRecording = false;
        this.state.isPaused = false;

        // UI 업데이트
        this.updateButtonStates('idle');
        this.updateRecordingStatus('stopped');

        // 최종 요약 생성
        if (this.state.enableAutoSummary && this.data.fullTranscript.length > 0) {
            this.generateFinalSummary();
        }

        this.showToast('녹음이 중지되었습니다', 'info');
    }

    /**
     * 일시정지 토글
     */
    togglePause() {
        if (!this.state.isRecording) return;

        if (this.state.isPaused) {
            // 재개
            this.speechManager.start();
            this.audioRecorder.resume();
            
            // 일시정지 시간 계산
            if (this.state.pauseStartTime) {
                this.state.pausedDuration += Date.now() - this.state.pauseStartTime;
                this.state.pauseStartTime = null;
            }

            this.state.isPaused = false;
            this.updateButtonStates('recording');
            this.updateRecordingStatus('recording');
            this.showToast('녹음이 재개되었습니다', 'success');
        } else {
            // 일시정지
            this.speechManager.stop();
            this.audioRecorder.pause();
            
            this.state.pauseStartTime = Date.now();
            this.state.isPaused = true;
            this.updateButtonStates('paused');
            this.updateRecordingStatus('paused');
            this.showToast('녹음이 일시정지되었습니다', 'info');
        }
    }

    /**
     * 버튼 상태 업데이트
     */
    updateButtonStates(status) {
        const { startBtn, stopBtn, pauseBtn, clearBtn, exportBtn, exportAudioBtn } = this.elements;

        switch (status) {
            case 'starting':
                if (startBtn) startBtn.disabled = true;
                if (stopBtn) stopBtn.disabled = true;
                if (pauseBtn) pauseBtn.disabled = true;
                break;

            case 'recording':
                if (startBtn) startBtn.disabled = true;
                if (stopBtn) stopBtn.disabled = false;
                if (pauseBtn) {
                    pauseBtn.disabled = false;
                    pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>일시정지</span>';
                    pauseBtn.classList.remove('btn-success');
                    pauseBtn.classList.add('btn-warning');
                }
                if (clearBtn) clearBtn.disabled = true;
                break;

            case 'paused':
                if (startBtn) startBtn.disabled = true;
                if (stopBtn) stopBtn.disabled = false;
                if (pauseBtn) {
                    pauseBtn.disabled = false;
                    pauseBtn.innerHTML = '<i class="fas fa-play"></i><span>재개</span>';
                    pauseBtn.classList.remove('btn-warning');
                    pauseBtn.classList.add('btn-success');
                }
                break;

            case 'idle':
            default:
                if (startBtn) startBtn.disabled = false;
                if (stopBtn) stopBtn.disabled = true;
                if (pauseBtn) {
                    pauseBtn.disabled = true;
                    pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>일시정지</span>';
                    pauseBtn.classList.remove('btn-success');
                    pauseBtn.classList.add('btn-warning');
                }
                if (clearBtn) clearBtn.disabled = false;
                if (exportAudioBtn) exportAudioBtn.disabled = !this.audioRecorder.getStatus().hasData;
                break;
        }
    }

    /**
     * 녹음 상태 UI 업데이트
     */
    updateRecordingStatus(status) {
        const indicator = this.elements.statusIndicator;
        const visualizer = this.elements.voiceVisualizer;
        
        if (!indicator) return;

        const statusDot = indicator.querySelector('.status-dot');
        const statusText = indicator.querySelector('.status-text');

        indicator.classList.remove('recording', 'paused', 'idle');
        
        switch (status) {
            case 'recording':
            case 'listening':
            case 'sound-detected':
                indicator.classList.add('recording');
                if (statusText) statusText.textContent = '녹음 중';
                // 시각화 활성화
                if (visualizer) visualizer.classList.add('active');
                break;
            case 'paused':
                indicator.classList.add('paused');
                if (statusText) statusText.textContent = '일시정지';
                if (visualizer) visualizer.classList.remove('active');
                break;
            case 'stopped':
            default:
                indicator.classList.add('idle');
                if (statusText) statusText.textContent = '대기 중';
                if (visualizer) visualizer.classList.remove('active');
                break;
        }
    }

    /**
     * 음성인식 결과 처리
     */
    async handleSpeechResult(result) {
        if (!result.isFinal) {
            // 중간 결과 표시
            this.updateCurrentSpeech(result.text);
            return;
        }

        // 발화자 처리
        const processedUtterance = this.speakerDetector.processUtterance(result.text);
        
        // 텍스트 보정
        let correctedText = result.text;
        if (this.state.enableCorrection && this.textCorrector.enabled) {
            try {
                const correctionResult = await this.textCorrector.correct(result.text, result.candidates);
                // correct() 함수가 객체를 반환하는 경우 처리
                if (correctionResult && typeof correctionResult === 'object') {
                    correctedText = correctionResult.text || result.text;
                } else if (typeof correctionResult === 'string') {
                    correctedText = correctionResult;
                }
            } catch (error) {
                console.warn('[TextCorrector] 보정 실패:', error);
            }
        }

        // 최종 결과 생성
        const finalResult = {
            text: correctedText,
            originalText: result.text,
            speaker: processedUtterance.speaker,
            classification: processedUtterance.classification,
            timestamp: new Date(),
            corrected: correctedText !== result.text
        };

        // 데이터 저장
        this.data.fullTranscript.push(finalResult);

        // UI 업데이트
        this.addTranscriptToHistory(finalResult);
        this.updateCurrentSpeech('');
        this.updateStats();

        // 회의록 내보내기용 데이터 추가
        this.meetingExporter.addTranscript({
            text: finalResult.text,
            speaker: finalResult.speaker,
            timestamp: finalResult.timestamp,
            isQuestion: finalResult.classification?.type === 'question',
            isComment: finalResult.classification?.type === 'comment',
            corrected: finalResult.corrected
        });

        // AI 분석 (질문 감지) - 언어 설정 전달
        requestIdleCallback(() => {
            // 언어 코드에서 기본 언어 추출 (예: 'ko-KR' -> 'ko')
            const langCode = this.state.language?.split('-')[0] || 'ko';
            this.aiEngine.analyzeText(correctedText, langCode);
        });
    }

    /**
     * 현재 음성 표시 업데이트
     */
    updateCurrentSpeech(text) {
        if (!this.elements.currentSpeech) return;

        if (text) {
            this.elements.currentSpeech.innerHTML = `
                <div class="speech-content">
                    <span class="speech-text">${this.escapeHtml(text)}</span>
                    <span class="speech-indicator">...</span>
                </div>
            `;
        } else {
            this.elements.currentSpeech.innerHTML = '';
        }
    }

    /**
     * 트랜스크립트 히스토리에 추가
     */
    addTranscriptToHistory(result) {
        if (!this.elements.transcriptHistory) return;

        // 빈 상태 메시지 제거
        const emptyState = this.elements.transcriptHistory.querySelector('.empty-state, .placeholder');
        if (emptyState) emptyState.remove();

        const item = document.createElement('div');
        const speakerClass = result.speaker?.isPrimary ? 'primary' : 'secondary';
        const isQuestion = result.classification?.type === 'question';
        const isComment = result.classification?.type === 'comment';
        const classificationClass = result.classification?.type || '';
        
        // 데이터 인덱스 저장 (질문 여부 토글용)
        const transcriptIndex = this.data.fullTranscript.length - 1;
        item.dataset.index = transcriptIndex;
        item.className = `transcript-item ${speakerClass} ${classificationClass}`;
        
        const speakerLabel = result.speaker?.isPrimary ? '발표자' : '참석자';
        const timeStr = result.timestamp.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', minute: '2-digit', second: '2-digit' 
        });

        // 질문/코멘트 배지를 클릭 가능하게 생성
        let badgesHtml = `
            <span class="badge badge-question-toggle ${isQuestion ? 'active' : ''}" 
                  data-index="${transcriptIndex}" 
                  title="클릭하여 질문 여부를 변경합니다">
                ❓ 질문${isQuestion ? ' ✓' : ''}
            </span>
        `;
        
        if (result.corrected) {
            badgesHtml += '<span class="badge badge-corrected">✨ 보정됨</span>';
        }

        item.innerHTML = `
            <div class="transcript-speaker ${speakerClass}">
                <span class="speaker-icon">${result.speaker?.isPrimary ? '👤' : '👥'}</span>
                <span class="speaker-label">${speakerLabel}</span>
            </div>
            <div class="transcript-content">
                <p class="transcript-text">${this.escapeHtml(result.text)}</p>
                <div class="transcript-meta">
                    <span class="timestamp">${timeStr}</span>
                    ${badgesHtml}
                </div>
            </div>
        `;

        // 질문 토글 배지에 이벤트 리스너 추가
        const questionToggle = item.querySelector('.badge-question-toggle');
        if (questionToggle) {
            questionToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleQuestionStatus(parseInt(questionToggle.dataset.index), questionToggle);
            });
        }

        this.elements.transcriptHistory.appendChild(item);
        
        // 스크롤 하단으로 (부드러운 스크롤)
        this.scrollToBottom(this.elements.transcriptHistory);
    }

    /**
     * 질문 상태 토글
     */
    toggleQuestionStatus(index, badgeElement) {
        if (index < 0 || index >= this.data.fullTranscript.length) return;

        const transcript = this.data.fullTranscript[index];
        const isCurrentlyQuestion = transcript.classification?.type === 'question';
        
        // 상태 토글
        if (isCurrentlyQuestion) {
            // 질문 해제
            transcript.classification = { type: null };
            badgeElement.classList.remove('active');
            badgeElement.innerHTML = '❓ 질문';
            this.showToast('질문 표시가 해제되었습니다', 'info');
        } else {
            // 질문으로 설정
            transcript.classification = { type: 'question' };
            badgeElement.classList.add('active');
            badgeElement.innerHTML = '❓ 질문 ✓';
            this.showToast('질문으로 표시되었습니다', 'success');
            
            // 질문 목록에 추가하고 AI 답변 생성
            this.handleQuestionDetected(transcript.text);
        }
        
        // 트랜스크립트 아이템의 클래스도 업데이트
        const transcriptItem = badgeElement.closest('.transcript-item');
        if (transcriptItem) {
            transcriptItem.classList.toggle('question', !isCurrentlyQuestion);
        }
        
        // 통계 업데이트
        this.updateStats();
    }

    /**
     * 질문 감지 처리
     */
    async handleQuestionDetected(question) {
        // 질문 추가
        this.data.questions.push({
            text: question,
            timestamp: new Date(),
            answered: false
        });

        // 질문 목록 UI 업데이트
        this.updateQuestionsList(question);
        this.updateStats();

        // 회의록 내보내기용
        this.meetingExporter.addQuestion({
            text: question,
            timestamp: new Date()
        });

        // 알림음
        if (this.elements.soundAlert?.checked) {
            this.playAlertSound();
        }

        // 자동 AI 답변
        if (this.state.autoAnswer && this.geminiAPI.isConfigured) {
            await this.generateAIAnswer(question);
        }
    }

    /**
     * AI 답변 생성
     */
    async generateAIAnswer(question) {
        try {
            // 회의 컨텍스트 구성
            let context = '';
            
            // 최근 회의 요약 추가
            const recentSummary = this.data.meetingSummaries.slice(-1)[0] || '';
            if (recentSummary) {
                context += `[최근 회의 요약]\n${recentSummary}\n\n`;
            }
            
            // 최근 대화 내용 추가
            const recentTranscripts = this.data.fullTranscript.slice(-10);
            if (recentTranscripts.length > 0) {
                const transcriptText = recentTranscripts.map(t => t.text).join('\n');
                context += `[최근 대화 내용]\n${transcriptText}`;
            }
            
            // Gemini API 호출 (문자열 context 전달)
            const result = await this.geminiAPI.generateAnswer(question, context);

            if (result) {
                const aiAnswer = {
                    question: result.question || question,
                    answer: result.answer || '',
                    sources: result.sources || [],
                    hasGrounding: result.hasGrounding || false,
                    timestamp: result.timestamp || new Date()
                };

                this.data.aiAnswers.push(aiAnswer);
                this.updateAIAnswersList(aiAnswer);
                this.updateStats();

                // 회의록 내보내기용
                this.meetingExporter.addAIAnswer(aiAnswer);
                
                console.log('[AI Answer] 답변 생성 완료:', aiAnswer.question.substring(0, 30) + '...');
            }
        } catch (error) {
            console.error('[AI Answer Error]', error);
            this.showToast('AI 답변 생성에 실패했습니다', 'error');
        }
    }

    /**
     * 질문 목록 업데이트
     */
    updateQuestionsList(question) {
        if (!this.elements.questionsList) return;

        // 빈 상태 제거
        const emptyState = this.elements.questionsList.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const item = document.createElement('div');
        item.className = 'question-item';
        item.innerHTML = `
            <span class="question-icon">❓</span>
            <p class="question-text">${this.escapeHtml(question)}</p>
            <span class="question-time">${new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}</span>
        `;

        this.elements.questionsList.appendChild(item);
        this.scrollToBottom(this.elements.questionsList);
    }

    /**
     * AI 답변 목록 업데이트
     */
    updateAIAnswersList(aiAnswer) {
        if (!this.elements.aiAnswersList) return;

        // 빈 상태 제거
        const emptyState = this.elements.aiAnswersList.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const item = document.createElement('div');
        item.className = 'ai-answer-item';
        
        let sourcesHtml = '';
        if (aiAnswer.sources && aiAnswer.sources.length > 0) {
            sourcesHtml = `
                <div class="answer-sources">
                    <span class="sources-label">📎 참고:</span>
                    ${aiAnswer.sources.map(s => `<a href="${s.uri || s.url || s}" target="_blank" class="source-link">${s.title || '출처'}</a>`).join(' ')}
                </div>
            `;
        }

        item.innerHTML = `
            <div class="answer-question">
                <span class="label">Q.</span>
                <p>${this.escapeHtml(aiAnswer.question)}</p>
            </div>
            <div class="answer-content">
                <span class="label">A.</span>
                <p>${this.escapeHtml(aiAnswer.answer)}</p>
                ${sourcesHtml}
            </div>
        `;

        this.elements.aiAnswersList.appendChild(item);
        this.scrollToBottom(this.elements.aiAnswersList);
    }

    /**
     * 회의 요약 업데이트
     */
    updateMeetingSummary(summary) {
        if (!summary) return;

        this.data.meetingSummaries.push(summary);
        this.meetingExporter.setSummary(summary);

        if (this.elements.meetingSummary) {
            this.elements.meetingSummary.innerHTML = `
                <div class="summary-content">
                    <p>${this.escapeHtml(summary).replace(/\n/g, '<br>')}</p>
                    <span class="summary-time">최종 업데이트: ${new Date().toLocaleTimeString('ko-KR')}</span>
                </div>
            `;
        }

        if (this.elements.summaryStatus) {
            this.elements.summaryStatus.textContent = '생성됨';
            this.elements.summaryStatus.classList.add('active');
        }
    }

    /**
     * 최종 요약 생성
     */
    async generateFinalSummary() {
        if (!this.geminiAPI.isConfigured) return;

        try {
            const fullText = this.data.fullTranscript.map(t => t.text).join(' ');
            if (fullText.length < 50) return;

            const summary = await this.geminiAPI.generateMeetingSummary(fullText);
            this.updateMeetingSummary(summary);
        } catch (error) {
            console.error('[Final Summary Error]', error);
        }
    }

    /**
     * 발화자 표시 업데이트
     */
    updateSpeakerIndicator(speakerType) {
        if (!this.elements.speakerIndicator) return;

        const isPrimary = speakerType === 'primary';
        this.elements.speakerIndicator.className = `speaker-indicator ${speakerType}`;
        this.elements.speakerIndicator.innerHTML = `
            <span class="speaker-icon">${isPrimary ? '👤' : '👥'}</span>
            <span class="speaker-label">${isPrimary ? '발표자' : '참석자'}</span>
        `;
    }

    /**
     * 주발표자 설정
     */
    setPrimarySpeaker() {
        this.speakerDetector.setPrimarySpeaker();
        this.updateSpeakerIndicator('primary');
    }

    /**
     * 통계 업데이트
     */
    updateStats() {
        // 단어 수 계산
        const totalWords = this.data.fullTranscript.reduce((sum, t) => {
            return sum + (t.text?.split(/\s+/).length || 0);
        }, 0);

        if (this.elements.totalWords) {
            this.elements.totalWords.textContent = totalWords;
        }
        if (this.elements.totalSentences) {
            this.elements.totalSentences.textContent = this.data.fullTranscript.length;
        }
        if (this.elements.totalQuestions) {
            this.elements.totalQuestions.textContent = this.data.questions.length;
        }
        if (this.elements.questionCount) {
            this.elements.questionCount.textContent = this.data.questions.length;
        }
        if (this.elements.answerCount) {
            this.elements.answerCount.textContent = this.data.aiAnswers.length;
        }
    }

    /**
     * 타이머 시작
     */
    startTimer() {
        this.stopTimer();
        
        this.state.timerInterval = setInterval(() => {
            this.updateTimerDisplay();
        }, 1000);
    }

    /**
     * 타이머 중지
     */
    stopTimer() {
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
        }
    }

    /**
     * 1분 주기 자동 요약 타이머 시작
     */
    startAutoSummaryTimer() {
        this.stopAutoSummaryTimer(); // 기존 타이머 정리
        
        console.log('[AutoSummary] 1분 주기 자동 요약 타이머 시작');
        
        // 60초 간격으로 요약 생성
        this.state.autoSummaryTimer = setInterval(async () => {
            if (!this.state.isRecording || this.state.isPaused) return;
            
            const transcriptCount = this.data.fullTranscript.length;
            if (transcriptCount < 3) {
                console.log('[AutoSummary] 트랜스크립트 부족, 요약 건너뜀');
                return;
            }
            
            try {
                console.log('[AutoSummary] 주기적 요약 생성 시작...');
                
                // 최근 트랜스크립트 수집
                const recentTranscripts = this.data.fullTranscript
                    .slice(-20) // 최근 20개
                    .map(t => t.text)
                    .join('\n');
                
                // GeminiAPI에 회의 내용 추가 및 요약 요청
                this.geminiAPI.addToMeetingTranscript(recentTranscripts, new Date());
                await this.geminiAPI.generateMeetingSummary(recentTranscripts);
                
                // 요약 상태 배지 업데이트
                if (this.elements.summaryStatus) {
                    this.elements.summaryStatus.textContent = '업데이트됨';
                    this.elements.summaryStatus.classList.add('active');
                }
                
            } catch (error) {
                console.error('[AutoSummary] 주기적 요약 생성 실패:', error);
            }
        }, 60000); // 60초 = 1분
    }

    /**
     * 자동 요약 타이머 중지
     */
    stopAutoSummaryTimer() {
        if (this.state.autoSummaryTimer) {
            clearInterval(this.state.autoSummaryTimer);
            this.state.autoSummaryTimer = null;
            console.log('[AutoSummary] 자동 요약 타이머 중지');
        }
    }

    /**
     * 타이머 표시 업데이트
     */
    updateTimerDisplay() {
        if (!this.elements.timer || !this.state.startTime) return;

        let elapsed = Date.now() - this.state.startTime - this.state.pausedDuration;
        
        // 현재 일시정지 중이면
        if (this.state.isPaused && this.state.pauseStartTime) {
            elapsed = this.state.pauseStartTime - this.state.startTime - this.state.pausedDuration;
        }

        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);

        const pad = (n) => n.toString().padStart(2, '0');
        this.elements.timer.textContent = `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
    }

    /**
     * 음성 파일 내보내기
     */
    exportAudio() {
        const status = this.audioRecorder.getStatus();
        if (!status.hasData) {
            this.showToast('내보낼 녹음 데이터가 없습니다', 'warning');
            return;
        }

        const success = this.audioRecorder.downloadRecording('meeting_audio');
        if (success) {
            this.showToast('음성 파일이 다운로드됩니다', 'success');
        }
    }

    /**
     * HTML 회의록 내보내기 (Gemini 스마트 요약 - 총괄 요약/결정 사항/액션 아이템만 포함)
     */
    async exportHTML() {
        // 회의 정보 설정
        const meetingTitle = this.elements.meetingContext?.value?.split('\n')[0] || 'AI 회의 도우미 회의록';
        
        this.meetingExporter.setMeetingInfo({
            title: meetingTitle,
            date: new Date(this.state.startTime || Date.now()),
            duration: this.elements.timer?.textContent || '00:00:00'
        });

        let smartSummary = null;

        // Gemini API를 통한 스마트 요약 생성
        if (this.geminiAPI.isConfigured && this.data.fullTranscript.length > 0) {
            this.showToast('AI가 회의록을 분석하고 있습니다...', 'info');
            
            try {
                smartSummary = await this.generateSmartMeetingSummary();
                if (smartSummary) {
                    this.meetingExporter.setSummary(smartSummary);
                }
            } catch (error) {
                console.error('[ExportHTML] 스마트 요약 생성 실패:', error);
            }
        }

        // 스마트 회의록 (원본 대화 로그 제외, 요약만 포함)
        const success = this.meetingExporter.downloadSmartHTML('meeting_report', smartSummary);
        if (success) {
            this.showToast('회의 리포트가 다운로드됩니다', 'success');
        }
    }

    /**
     * Gemini를 통한 스마트 회의 요약 생성
     */
    async generateSmartMeetingSummary() {
        if (!this.geminiAPI.isConfigured) return null;
        
        const transcriptText = this.data.fullTranscript
            .map(t => `[${t.timestamp.toLocaleTimeString('ko-KR', {hour: '2-digit', minute: '2-digit'})}] ${t.speaker?.isPrimary ? '발표자' : '참석자'}: ${t.text}`)
            .join('\n');
        
        const questionsText = this.data.questions
            .map(q => `- ${q.text}`)
            .join('\n');
        
        const aiAnswersText = this.data.aiAnswers
            .map(a => `Q: ${a.question}\nA: ${a.answer}`)
            .join('\n\n');
        
        const context = this.elements.meetingContext?.value || '';
        
        const prompt = `당신은 전문 회의 서기입니다. 다음 회의 내용을 분석하여 체계적인 회의록 요약을 작성해주세요.

[회의 주제/컨텍스트]
${context || '일반 회의'}

[회의 내용 전문]
${transcriptText}

${questionsText ? `[감지된 질문들]\n${questionsText}\n` : ''}
${aiAnswersText ? `[AI 답변 내용]\n${aiAnswersText}\n` : ''}

---
**다음 형식으로 작성해주세요 (원본 대화 로그는 포함하지 마세요):**

## 📋 회의 개요
회의의 전반적인 목적과 논의 흐름을 2-3문장으로 요약

## 🎯 주요 논의 사항
- 핵심 안건 1
- 핵심 안건 2
(필요에 따라 추가)

## ✅ 결정 사항
회의에서 확정되거나 합의된 내용 (없으면 "결정 사항 없음")

## 📌 액션 아이템 (To-Do)
- [ ] 할 일 1 (담당자 추정 시 명시)
- [ ] 할 일 2
(없으면 "후속 조치 필요 사항 없음")

## 💡 키워드
#키워드1 #키워드2 #키워드3

**중요 지침:**
- 한국어로 작성
- 명확하고 간결하게
- 원본 대화 로그는 포함하지 마세요
- 실제 회의 내용에 없는 내용은 추측하지 말 것`;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiAPI.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 2048
                    }
                })
            });

            if (response.ok) {
                const data = await response.json();
                const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;
                return summary || null;
            }
        } catch (error) {
            console.error('[SmartSummary] 생성 실패:', error);
        }
        
        return null;
    }

    /**
     * 내보내기 메뉴 표시
     */
    showExportMenu() {
        // 간단한 내보내기 선택
        const options = [];
        
        if (this.audioRecorder.getStatus().hasData) {
            options.push('음성 파일 (WebM)');
        }
        
        if (this.data.fullTranscript.length > 0) {
            options.push('HTML 회의록');
        }

        if (options.length === 0) {
            this.showToast('내보낼 데이터가 없습니다', 'warning');
            return;
        }

        // 둘 다 있으면 선택, 하나만 있으면 바로 실행
        if (options.length === 1) {
            if (options[0].includes('음성')) {
                this.exportAudio();
            } else {
                this.exportHTML();
            }
        } else {
            // 둘 다 내보내기
            this.exportAudio();
            setTimeout(() => this.exportHTML(), 500);
        }
    }

    /**
     * 모두 지우기
     */
    clearAll() {
        if (this.state.isRecording) {
            this.showToast('녹음 중에는 삭제할 수 없습니다', 'warning');
            return;
        }

        if (!confirm('모든 기록을 삭제하시겠습니까?')) return;

        // 데이터 초기화
        this.data = {
            fullTranscript: [],
            questions: [],
            aiAnswers: [],
            meetingSummaries: [],
            speakerHistory: []
        };

        // 모듈 초기화
        this.speechManager.clearTranscript();
        this.audioRecorder.clearRecording();
        this.speakerDetector.reset();
        this.meetingExporter.clear();

        // UI 초기화
        if (this.elements.transcriptHistory) {
            this.elements.transcriptHistory.innerHTML = '';
        }
        if (this.elements.currentSpeech) {
            this.elements.currentSpeech.innerHTML = '<p class="placeholder">녹음 버튼을 눌러 회의를 시작하세요...</p>';
        }
        if (this.elements.questionsList) {
            this.elements.questionsList.innerHTML = '<div class="empty-state"><i class="fas fa-comment-slash"></i><p>감지된 질문이 없습니다</p></div>';
        }
        if (this.elements.aiAnswersList) {
            this.elements.aiAnswersList.innerHTML = '<div class="empty-state"><i class="fas fa-magic"></i><p>질문이 감지되면 AI가 답변합니다</p></div>';
        }
        if (this.elements.meetingSummary) {
            this.elements.meetingSummary.innerHTML = '<div class="empty-state"><i class="fas fa-clipboard-list"></i><p>회의가 진행되면 자동 요약됩니다</p></div>';
        }
        if (this.elements.timer) {
            this.elements.timer.textContent = '00:00:00';
        }

        this.updateStats();
        this.showToast('모든 기록이 삭제되었습니다', 'success');
    }

    /**
     * 컨텍스트 업데이트
     */
    updateContext() {
        const context = this.elements.meetingContext?.value || '';
        const terms = this.elements.priorityTerms?.value || '';

        // TextCorrector 업데이트
        if (this.textCorrector) {
            this.textCorrector.setMeetingContext(context);
            this.textCorrector.setPriorityTerms(terms.split(',').map(t => t.trim()).filter(t => t));
        }

        // GeminiAPI 업데이트
        if (this.geminiAPI) {
            this.geminiAPI.setContext(context);
        }

        this.updateContextStatusUI();
    }

    /**
     * 컨텍스트 상태 UI 업데이트
     */
    updateContextStatusUI() {
        if (!this.elements.contextStatus) return;

        const hasContext = !!(this.elements.meetingContext?.value || this.elements.priorityTerms?.value);
        
        if (hasContext) {
            this.elements.contextStatus.innerHTML = '<i class="fas fa-check-circle"></i><span>컨텍스트 설정됨 - 전문용어 인식 활성화</span>';
            this.elements.contextStatus.classList.add('active');
        } else {
            this.elements.contextStatus.innerHTML = '<i class="fas fa-info-circle"></i><span>컨텍스트 미설정 - 기본 보정 모드</span>';
            this.elements.contextStatus.classList.remove('active');
        }
    }

    /**
     * API 상태 UI 업데이트
     */
    updateApiStatusUI() {
        if (!this.elements.apiStatus) return;

        const isConfigured = this.geminiAPI?.isConfigured;
        const statusDot = this.elements.apiStatus.querySelector('.status-dot');
        const statusText = this.elements.apiStatus.querySelector('.status-text');

        // 이전 상태 클래스 제거
        this.elements.apiStatus.classList.remove('connected', 'configured', 'error', 'pending');

        if (isConfigured) {
            this.elements.apiStatus.classList.add('configured');
            if (statusText) statusText.textContent = 'API 연결됨';
        } else {
            this.elements.apiStatus.classList.remove('configured');
            if (statusText) statusText.textContent = 'API 키 미설정';
        }
    }

    /**
     * API 키 유효성 검증 및 상태 업데이트
     */
    async validateApiKey(apiKey) {
        if (!apiKey || apiKey.trim().length === 0) {
            this.updateApiStatusWithState('error', 'API 키를 입력하세요');
            return false;
        }

        this.updateApiStatusWithState('pending', '연결 확인 중...');

        try {
            // 간단한 API 테스트 호출
            const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(testUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: 'Hello' }] }]
                })
            });

            if (response.ok) {
                this.updateApiStatusWithState('configured', 'API 연결 성공');
                return true;
            } else {
                const errorData = await response.json().catch(() => ({}));
                const errorMsg = errorData.error?.message || `연결 실패 (${response.status})`;
                this.updateApiStatusWithState('error', errorMsg.substring(0, 30));
                return false;
            }
        } catch (error) {
            this.updateApiStatusWithState('error', '연결 실패: 네트워크 오류');
            return false;
        }
    }

    /**
     * API 상태를 특정 상태로 업데이트
     */
    updateApiStatusWithState(state, message) {
        if (!this.elements.apiStatus) return;

        const statusText = this.elements.apiStatus.querySelector('.status-text');
        
        // 이전 상태 클래스 제거
        this.elements.apiStatus.classList.remove('connected', 'configured', 'error', 'pending');
        
        // 새 상태 클래스 추가
        this.elements.apiStatus.classList.add(state);
        
        if (statusText) statusText.textContent = message;
    }

    /**
     * 설정 모달 열기
     */
    openSettings() {
        if (this.elements.settingsModal) {
            this.elements.settingsModal.classList.add('active');
        }
    }

    /**
     * 설정 모달 닫기
     */
    closeSettings() {
        if (this.elements.settingsModal) {
            this.elements.settingsModal.classList.remove('active');
        }
        this.saveSettings();
    }

    /**
     * API 키 표시 토글
     */
    toggleApiKeyVisibility() {
        if (!this.elements.geminiApiKey || !this.elements.toggleApiKeyVisibility) return;

        const input = this.elements.geminiApiKey;
        const icon = this.elements.toggleApiKeyVisibility.querySelector('i');

        if (input.type === 'password') {
            input.type = 'text';
            if (icon) icon.className = 'fas fa-eye-slash';
        } else {
            input.type = 'password';
            if (icon) icon.className = 'fas fa-eye';
        }
    }

    /**
     * 설정 저장
     */
    saveSettings() {
        const settings = {
            language: this.state.language,
            apiKey: this.elements.geminiApiKey?.value || '',
            autoAnswer: this.state.autoAnswer,
            enableCorrection: this.state.enableCorrection,
            enableGrounding: this.state.enableGrounding,
            enableAutoSummary: this.state.enableAutoSummary,
            enableSpeakerDetection: this.state.enableSpeakerDetection,
            meetingContext: this.elements.meetingContext?.value || '',
            priorityTerms: this.elements.priorityTerms?.value || '',
            sensitivity: this.elements.sensitivityRange?.value || 3,
            responseStyle: this.elements.aiResponseStyle?.value || 'concise'
        };

        localStorage.setItem('meetingAssistantSettings', JSON.stringify(settings));
    }

    /**
     * 설정 불러오기
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem('meetingAssistantSettings');
            if (!saved) return;

            const settings = JSON.parse(saved);

            // 상태 복원
            this.state.language = settings.language || 'ko-KR';
            this.state.autoAnswer = settings.autoAnswer !== false;
            this.state.enableCorrection = settings.enableCorrection !== false;
            this.state.enableGrounding = settings.enableGrounding !== false;
            this.state.enableAutoSummary = settings.enableAutoSummary !== false;
            this.state.enableSpeakerDetection = settings.enableSpeakerDetection !== false;

            // UI 복원
            if (this.elements.languageSelect) this.elements.languageSelect.value = settings.language;
            if (this.elements.geminiApiKey && settings.apiKey) {
                this.elements.geminiApiKey.value = settings.apiKey;
                this.geminiAPI.setApiKey(settings.apiKey);
            }
            if (this.elements.autoAnswer) this.elements.autoAnswer.checked = settings.autoAnswer;
            if (this.elements.enableCorrection) this.elements.enableCorrection.checked = settings.enableCorrection;
            if (this.elements.enableGrounding) this.elements.enableGrounding.checked = settings.enableGrounding;
            if (this.elements.enableAutoSummary) this.elements.enableAutoSummary.checked = settings.enableAutoSummary;
            if (this.elements.meetingContext) this.elements.meetingContext.value = settings.meetingContext || '';
            if (this.elements.priorityTerms) this.elements.priorityTerms.value = settings.priorityTerms || '';
            if (this.elements.sensitivityRange) this.elements.sensitivityRange.value = settings.sensitivity || 3;
            if (this.elements.aiResponseStyle) this.elements.aiResponseStyle.value = settings.responseStyle || 'concise';

            // 모듈 설정 적용
            this.speechManager.setLanguage(this.state.language);
            this.textCorrector.enabled = this.state.enableCorrection;

            console.log('[Settings] 설정 불러오기 완료');
        } catch (error) {
            console.error('[Settings] 설정 불러오기 실패:', error);
        }
    }

    /**
     * 토스트 메시지 표시
     */
    showToast(message, type = 'info') {
        if (!this.elements.toastContainer) return;

        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        const icons = {
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
            warning: 'fa-exclamation-triangle',
            info: 'fa-info-circle'
        };

        toast.innerHTML = `
            <i class="fas ${icons[type] || icons.info}"></i>
            <span>${this.escapeHtml(message)}</span>
        `;

        this.elements.toastContainer.appendChild(toast);

        // 애니메이션 후 제거
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    /**
     * 알림음 재생
     */
    playAlertSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 880;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;

            oscillator.start();
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            console.warn('[Alert Sound] 재생 실패:', error);
        }
    }

    /**
     * HTML 이스케이프
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 부드러운 자동 스크롤 (auto-scroll to bottom)
     */
    scrollToBottom(element) {
        if (!element) return;
        
        // requestAnimationFrame을 사용하여 DOM 업데이트 후 스크롤
        requestAnimationFrame(() => {
            element.scrollTo({
                top: element.scrollHeight,
                behavior: 'smooth'
            });
        });
    }

    // ========== 앙상블 STT 서버 설정 ==========

    /**
     * 보정 버퍼 간격 UI 초기화
     */
    initCorrectionIntervalUI() {
        if (this.elements.correctionInterval && this.elements.correctionIntervalValue) {
            const currentValue = this.elements.correctionInterval.value;
            this.elements.correctionIntervalValue.textContent = `${currentValue}초`;
        }
    }

    /**
     * 앙상블 서버 관련 이벤트 리스너 설정
     */
    setupEnsembleListeners() {
        // 앙상블 활성화 체크박스
        const enableEnsemble = document.getElementById('enableEnsemble');
        if (enableEnsemble) {
            enableEnsemble.addEventListener('change', (e) => {
                this.state.ensembleMode = e.target.checked;
                this.updateEnsembleStatusUI();
                this.saveEnsembleSettings();
            });
        }

        // 연결 테스트 버튼
        const testBtn = document.getElementById('testEnsembleConnection');
        if (testBtn) {
            testBtn.addEventListener('click', () => this.testEnsembleConnection());
        }

        // 프리셋 버튼들
        document.querySelectorAll('.btn-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.currentTarget.dataset.url;
                const urlInput = document.getElementById('ensembleServerUrl');
                
                if (url === '') {
                    // 직접 입력 모드
                    if (urlInput) {
                        urlInput.value = '';
                        urlInput.focus();
                        urlInput.select();
                    }
                } else {
                    if (urlInput) {
                        urlInput.value = url;
                    }
                }
                
                // 프리셋 버튼 활성화 표시
                document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                
                this.saveEnsembleSettings();
            });
        });

        // 도움말 토글
        const toggleHelp = document.getElementById('toggleServerHelp');
        if (toggleHelp) {
            toggleHelp.addEventListener('click', () => this.toggleServerHelp());
        }

        // 서버 템플릿 다운로드
        const downloadTemplate = document.getElementById('downloadServerTemplate');
        if (downloadTemplate) {
            downloadTemplate.addEventListener('click', (e) => {
                e.preventDefault();
                this.showServerTemplate();
            });
        }

        // URL 입력 변경
        const urlInput = document.getElementById('ensembleServerUrl');
        if (urlInput) {
            urlInput.addEventListener('change', () => this.saveEnsembleSettings());
        }

        // 저장된 설정 불러오기
        this.loadEnsembleSettings();
    }

    /**
     * 앙상블 서버 연결 테스트
     */
    async testEnsembleConnection() {
        const urlInput = document.getElementById('ensembleServerUrl');
        const testBtn = document.getElementById('testEnsembleConnection');
        
        if (!urlInput || !urlInput.value) {
            this.showToast('서버 URL을 입력하세요', 'warning');
            return;
        }

        const serverUrl = urlInput.value.trim();
        
        // 버튼 상태 변경
        if (testBtn) {
            testBtn.disabled = true;
            testBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 연결 중...';
        }

        try {
            // 헬스 체크 엔드포인트 호출
            const response = await fetch(`${serverUrl}/health`, {
                method: 'GET',
                mode: 'cors',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.showToast(`✅ 서버 연결 성공! ${data.message || ''}`, 'success');
                this.updateEnsembleStatusUI(true, data);
                
                // 앙상블 모드 자동 활성화
                const enableCheckbox = document.getElementById('enableEnsemble');
                if (enableCheckbox && !enableCheckbox.checked) {
                    enableCheckbox.checked = true;
                    this.state.ensembleMode = true;
                }
            } else {
                throw new Error(`서버 응답 오류: ${response.status}`);
            }
        } catch (error) {
            console.error('[Ensemble] 연결 테스트 실패:', error);
            this.showToast(`❌ 연결 실패: ${error.message}`, 'error');
            this.updateEnsembleStatusUI(false);
        } finally {
            if (testBtn) {
                testBtn.disabled = false;
                testBtn.innerHTML = '<i class="fas fa-plug"></i> 연결 테스트';
            }
        }
    }

    /**
     * 앙상블 상태 UI 업데이트
     */
    updateEnsembleStatusUI(connected = false, serverInfo = null) {
        const statusEl = document.getElementById('ensembleStatus');
        const statusText = document.getElementById('ensembleStatusText');
        
        if (!statusEl || !statusText) return;

        if (connected && serverInfo) {
            statusEl.classList.add('connected');
            statusText.innerHTML = `<i class="fas fa-check-circle" style="color: #10b981;"></i> 서버 연결됨 - ${serverInfo.models?.join(', ') || '앙상블 모드 활성화'}`;
        } else if (this.state.ensembleMode) {
            statusEl.classList.remove('connected');
            statusText.innerHTML = '<i class="fas fa-exclamation-circle" style="color: #f59e0b;"></i> 앙상블 모드 활성화 - 서버 연결 대기 중';
        } else {
            statusEl.classList.remove('connected');
            statusText.innerHTML = '<i class="fas fa-info-circle"></i> 앙상블 서버 미연결 - Web Speech API 사용 중';
        }
    }

    /**
     * 서버 도움말 토글
     */
    toggleServerHelp() {
        const content = document.getElementById('serverHelpContent');
        const icon = document.querySelector('#toggleServerHelp i');
        
        if (content) {
            const isVisible = content.style.display !== 'none';
            content.style.display = isVisible ? 'none' : 'block';
            
            if (icon) {
                icon.className = isVisible ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
            }
        }
    }

    /**
     * 서버 템플릿 코드 표시
     */
    showServerTemplate() {
        const template = `# FastAPI 앙상블 STT 서버 템플릿
# 파일명: main.py

from fastapi import FastAPI, WebSocket, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import asyncio

app = FastAPI(title="Ensemble STT Server")

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "message": "Ensemble STT Server is running",
        "models": ["SenseVoice-Small", "Faster-Whisper", "Qwen3-ASR"]
    }

@app.websocket("/ws/stt")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_bytes()
            # 여기서 3개 모델 병렬 실행
            # result = await process_ensemble(data)
            await websocket.send_json({
                "type": "ensemble_result",
                "data": {"finalText": "인식된 텍스트"}
            })
    except Exception as e:
        print(f"WebSocket error: {e}")

# 실행: uvicorn main:app --host 0.0.0.0 --port 8000
`;

        // 새 창에서 코드 표시
        const win = window.open('', '_blank', 'width=800,height=600');
        win.document.write(`
            <html>
            <head>
                <title>앙상블 STT 서버 템플릿</title>
                <style>
                    body { font-family: monospace; background: #1e1e1e; color: #d4d4d4; padding: 20px; }
                    pre { white-space: pre-wrap; word-wrap: break-word; }
                    button { 
                        position: fixed; top: 20px; right: 20px; 
                        padding: 10px 20px; background: #4CAF50; color: white;
                        border: none; cursor: pointer; border-radius: 5px;
                    }
                    button:hover { background: #45a049; }
                </style>
            </head>
            <body>
                <button onclick="navigator.clipboard.writeText(document.querySelector('pre').textContent).then(() => alert('복사됨!'))">📋 코드 복사</button>
                <pre>${template}</pre>
            </body>
            </html>
        `);
    }

    /**
     * 앙상블 설정 저장
     */
    saveEnsembleSettings() {
        const settings = {
            enabled: document.getElementById('enableEnsemble')?.checked || false,
            serverUrl: document.getElementById('ensembleServerUrl')?.value || 'http://localhost:8000'
        };
        localStorage.setItem('ensembleSTTSettings', JSON.stringify(settings));
    }

    /**
     * 앙상블 설정 불러오기
     */
    loadEnsembleSettings() {
        try {
            const saved = localStorage.getItem('ensembleSTTSettings');
            if (!saved) return;

            const settings = JSON.parse(saved);
            
            const enableCheckbox = document.getElementById('enableEnsemble');
            const urlInput = document.getElementById('ensembleServerUrl');
            
            if (enableCheckbox) enableCheckbox.checked = settings.enabled || false;
            if (urlInput) urlInput.value = settings.serverUrl || 'http://localhost:8000';
            
            this.state.ensembleMode = settings.enabled || false;
            this.updateEnsembleStatusUI();
        } catch (error) {
            console.error('[Ensemble] 설정 불러오기 실패:', error);
        }
    }
}

// 전역 인스턴스 생성
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new EnhancedMeetingApp();
    window.meetingApp = app; // 디버깅용
});
