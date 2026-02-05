/**
 * Enhanced Meeting AI Assistant v5.0 (Faster-Whisper Edition)
 * Faster-Whisper STT + 발화자 구분 + Gemini 통합 보정
 * 
 * 주요 기능:
 * 1. 고성능 Faster-Whisper STT 전용 연동
 * 2. 발화자 자동 구분 (주발표자/참석자)
 * 3. 녹음 일시정지/재개
 * 4. 음성 파일 내보내기
 * 5. HTML 회의록 내보내기
 */

class EnhancedMeetingApp {
    constructor() {
        // 핵심 모듈 초기화
        this.speechManager = new FasterWhisperSTTSystem();
        this.fallbackSpeechManager = new SpeechRecognitionManager(); // 서버 미연결 시 폴백
        this.aiEngine = new AIAnalysisEngine();
        this.geminiAPI = new GeminiAPI();
        this.textCorrector = new TextCorrector(this.geminiAPI);
        
        // 유틸리티 모듈
        this.audioRecorder = new AudioRecorder();
        this.speakerDetector = new SpeakerDetector();
        this.meetingExporter = new MeetingExporter();
        
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
            secondaryLanguage: 'none',
            autoAnswer: true,
            enableCorrection: true,
            enableGrounding: true,
            enableAutoSummary: true,
            enableSpeakerDetection: true,
            fasterWhisperMode: false // 서버 연동 모드
        };

        // 데이터
        this.data = {
            fullTranscript: [],
            questions: [],
            aiAnswers: [],
            meetingSummaries: [],
            speakerHistory: [],
            userMemos: []
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
            
            // Faster-Whisper STT 설정
            enableEnsemble: document.getElementById('enableEnsemble'),
            ensembleServerUrl: document.getElementById('ensembleServerUrl'),
            testEnsembleConnection: document.getElementById('testEnsembleConnection'),
            ensembleStatus: document.getElementById('ensembleStatus'),
            ensembleStatusText: document.getElementById('ensembleStatusText'),
            toggleServerHelp: document.getElementById('toggleServerHelp'),
            serverHelpContent: document.getElementById('serverHelpContent'),
            downloadServerTemplate: document.getElementById('downloadServerTemplate'),

            // 시각화
            ensembleVisualizer: document.getElementById('ensembleVisualizer'),
            textWhisper: document.getElementById('textWhisper'),
            confWhisper: document.getElementById('confWhisper'),
            ensembleFinalText: document.getElementById('ensembleFinalText'),

            // 다중 언어 설정
            secondaryLanguageSelect: document.getElementById('secondaryLanguageSelect'),
            languageStatus: document.getElementById('languageStatus'),
            languageStatusText: document.getElementById('languageStatusText'),

            // 사용자 메모 패널
            memoToggle: document.getElementById('memoToggle'),
            memoContainer: document.getElementById('memoContainer'),
            memoClose: document.getElementById('memoClose'),
            memoHistory: document.getElementById('memoHistory'),
            userMemoInput: document.getElementById('userMemoInput'),
            saveMemoBtn: document.getElementById('saveMemoBtn'),
            askAIBtn: document.getElementById('askAIBtn'),

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
        this.setupFasterWhisperListeners();
        this.setupLanguageListeners();
        this.setupMemoListeners();
        this.loadSettings();
        this.updateApiStatusUI();
        this.updateContextStatusUI();
        this.updateFasterWhisperStatusUI();
        this.updateLanguageStatusUI();
        
        this.initCorrectionIntervalUI();
        
        console.log('[EnhancedMeetingApp] Faster-Whisper Edition 초기화 완료');
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        if (this.elements.startBtn) this.elements.startBtn.addEventListener('click', () => this.startRecording());
        if (this.elements.stopBtn) this.elements.stopBtn.addEventListener('click', () => this.stopRecording());
        if (this.elements.pauseBtn) this.elements.pauseBtn.addEventListener('click', () => this.togglePause());
        if (this.elements.clearBtn) this.elements.clearBtn.addEventListener('click', () => this.clearAll());

        if (this.elements.exportBtn) this.elements.exportBtn.addEventListener('click', () => this.showExportMenu());
        if (this.elements.exportAudioBtn) this.elements.exportAudioBtn.addEventListener('click', () => this.exportAudio());
        if (this.elements.exportHtmlBtn) this.elements.exportHtmlBtn.addEventListener('click', () => this.exportHTML());

        if (this.elements.setPrimarySpeakerBtn) this.elements.setPrimarySpeakerBtn.addEventListener('click', () => this.setPrimarySpeaker());

        if (this.elements.settingsBtn) this.elements.settingsBtn.addEventListener('click', () => this.openSettings());
        if (this.elements.closeModal) this.elements.closeModal.addEventListener('click', () => this.closeSettings());
        if (this.elements.settingsModal) {
            this.elements.settingsModal.addEventListener('click', (e) => {
                if (e.target === this.elements.settingsModal) this.closeSettings();
            });
        }

        if (this.elements.toggleApiKeyVisibility) this.elements.toggleApiKeyVisibility.addEventListener('click', () => this.toggleApiKeyVisibility());

        this.setupSettingsChangeListeners();
    }

    setupSettingsChangeListeners() {
        if (this.elements.languageSelect) {
            this.elements.languageSelect.addEventListener('change', (e) => {
                this.state.language = e.target.value;
                this.fallbackSpeechManager.setLanguage(this.state.language);
                this.saveSettings();
            });
        }

        if (this.elements.geminiApiKey) {
            this.elements.geminiApiKey.addEventListener('change', async (e) => {
                const apiKey = e.target.value.trim();
                this.geminiAPI.setApiKey(apiKey);
                this.saveSettings();
                if (apiKey) await this.validateApiKey(apiKey);
                else this.updateApiStatusWithState('error', 'API 키 미설정');
            });
        }

        if (this.elements.autoAnswer) {
            this.elements.autoAnswer.addEventListener('change', (e) => {
                this.state.autoAnswer = e.target.checked;
                this.saveSettings();
            });
        }

        if (this.elements.enableCorrection) {
            this.elements.enableCorrection.addEventListener('change', (e) => {
                this.state.enableCorrection = e.target.checked;
                this.textCorrector.enabled = e.target.checked;
                this.saveSettings();
            });
        }

        if (this.elements.sensitivityRange) {
            this.elements.sensitivityRange.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.aiEngine.sensitivity = value;
                const labels = ['매우 낮음', '낮음', '보통', '높음', '매우 높음'];
                if (this.elements.sensitivityValue) this.elements.sensitivityValue.textContent = labels[value - 1];
                this.saveSettings();
            });
        }

        if (this.elements.correctionInterval) {
            this.elements.correctionInterval.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (this.elements.correctionIntervalValue) this.elements.correctionIntervalValue.textContent = `${value}초`;
                if (this.textCorrector) this.textCorrector.minCorrectionInterval = value * 1000;
                this.saveSettings();
            });
        }

        if (this.elements.meetingContext) {
            this.elements.meetingContext.addEventListener('input', () => {
                this.updateContext();
                this.updateContextStatusUI();
            });
            this.elements.meetingContext.addEventListener('change', () => {
                this.updateContext();
                this.saveSettings();
            });
        }

        if (this.elements.priorityTerms) {
            this.elements.priorityTerms.addEventListener('input', () => {
                this.updateContext();
                this.updateContextStatusUI();
            });
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
        const handleResult = (result) => this.handleSpeechResult(result);
        const handleStatus = (status) => this.updateRecordingStatus(status);
        const handleError = (code, msg) => this.showToast(msg, 'error');

        // Faster-Whisper 콜백
        this.speechManager.onTranscript(handleResult);
        this.speechManager.onStatusChange(handleStatus);
        this.speechManager.onError(handleError);

        // Fallback (Web Speech API) 콜백
        this.fallbackSpeechManager.onResult(handleResult);
        this.fallbackSpeechManager.onStatusChange(handleStatus);
        this.fallbackSpeechManager.onError(handleError);
    }

    setupAICallbacks() {
        this.aiEngine.onQuestionDetected = async (question) => {
            await this.handleQuestionDetected(question);
        };
    }

    setupGeminiCallbacks() {
        this.geminiAPI.onSummaryGenerated = (summary) => {
            this.updateMeetingSummary(summary);
        };
    }

    setupTextCorrectorCallbacks() {
        this.textCorrector.onCorrectionComplete = (original, corrected) => {
            if (original !== corrected) {
                console.log(`[TextCorrector] 보정: "${original}" → "${corrected}"`);
            }
        };
    }

    setupAudioRecorderCallbacks() {
        this.audioRecorder.onError = (code, message) => this.showToast(message, 'error');
    }

    setupSpeakerDetectorCallbacks() {
        this.speakerDetector.onSpeakerChange = (info) => {
            this.updateSpeakerIndicator(info.current);
        };
    }

    /**
     * 녹음 시작
     */
    async startRecording() {
        if (this.state.isRecording) return;

        this.updateButtonStates('starting');

        try {
            let sttStarted = false;

            // Faster-Whisper 시도
            if (this.state.fasterWhisperMode) {
                sttStarted = await this.speechManager.start();
                if (!sttStarted) {
                    this.showToast('Faster-Whisper 서버 연결 실패. 브라우저 내장 엔진을 사용합니다.', 'warning');
                    sttStarted = this.fallbackSpeechManager.start();
                }
            } else {
                sttStarted = this.fallbackSpeechManager.start();
            }

            if (!sttStarted) throw new Error('음성인식을 시작할 수 없습니다');

            // 오디오 녹음 시작
            await this.audioRecorder.start();

            // 발화자 감지 초기화
            if (this.state.enableSpeakerDetection && this.audioRecorder.stream) {
                this.speakerDetector.initializeAnalyser(this.audioRecorder.stream);
            }

            this.state.isRecording = true;
            this.state.isPaused = false;
            this.state.startTime = Date.now();
            this.state.pausedDuration = 0;

            this.startTimer();
            this.updateButtonStates('recording');
            this.updateRecordingStatus('recording');
            this.updateContext();

            if (this.state.enableAutoSummary && this.geminiAPI.isConfigured) {
                this.startAutoSummaryTimer();
            }

            this.showToast('녹음이 시작되었습니다', 'success');

        } catch (error) {
            console.error('[StartRecording Error]', error);
            this.showToast(error.message || '녹음 시작에 실패했습니다', 'error');
            this.state.isRecording = false;
            this.stopTimer();
            this.speechManager.stop();
            this.fallbackSpeechManager.stop();
            this.audioRecorder.stop();
            this.updateButtonStates('idle');
        }
    }

    stopRecording() {
        if (!this.state.isRecording) return;

        this.speechManager.stop();
        this.fallbackSpeechManager.stop();
        this.audioRecorder.stop();
        this.stopTimer();
        this.stopAutoSummaryTimer();

        this.state.isRecording = false;
        this.state.isPaused = false;

        this.updateButtonStates('idle');
        this.updateRecordingStatus('stopped');

        if (this.state.enableAutoSummary && this.data.fullTranscript.length > 0) {
            this.generateFinalSummary();
        }

        this.showToast('녹음이 중지되었습니다', 'info');
    }

    togglePause() {
        if (!this.state.isRecording) return;

        if (this.state.isPaused) {
            if (this.state.fasterWhisperMode) this.speechManager.start();
            else this.fallbackSpeechManager.start();
            
            this.audioRecorder.resume();
            if (this.state.pauseStartTime) {
                this.state.pausedDuration += Date.now() - this.state.pauseStartTime;
                this.state.pauseStartTime = null;
            }
            this.state.isPaused = false;
            this.updateButtonStates('recording');
            this.updateRecordingStatus('recording');
            this.showToast('녹음이 재개되었습니다', 'success');
        } else {
            this.speechManager.stop();
            this.fallbackSpeechManager.stop();
            this.audioRecorder.pause();
            this.state.pauseStartTime = Date.now();
            this.state.isPaused = true;
            this.updateButtonStates('paused');
            this.updateRecordingStatus('paused');
            this.showToast('녹음이 일시정지되었습니다', 'info');
        }
    }

    /**
     * 음성인식 결과 처리
     */
    async handleSpeechResult(result) {
        if (!result.isFinal) {
            this.updateCurrentSpeech(result.text);
            
            // 실시간 모델 결과 시각화 업데이트
            if (this.state.fasterWhisperMode && this.elements.textWhisper) {
                this.elements.textWhisper.textContent = result.text;
                if (result.confidence) {
                    this.elements.confWhisper.textContent = `${(result.confidence * 100).toFixed(0)}%`;
                }
            }
            return;
        }

        // 발화자 처리
        const processedUtterance = this.speakerDetector.processUtterance(result.text);
        
        // 텍스트 보정
        let correctedText = result.text;
        if (this.state.enableCorrection && this.textCorrector.enabled) {
            try {
                const correctionResult = await this.textCorrector.correct(result.text, result.candidates);
                if (correctionResult && typeof correctionResult === 'object') correctedText = correctionResult.text || result.text;
                else if (typeof correctionResult === 'string') correctedText = correctionResult;
            } catch (error) {
                console.warn('[TextCorrector] 보정 실패:', error);
            }
        }

        const finalResult = {
            text: correctedText,
            originalText: result.text,
            speaker: processedUtterance.speaker,
            classification: processedUtterance.classification,
            timestamp: new Date(),
            corrected: correctedText !== result.text
        };

        this.data.fullTranscript.push(finalResult);
        this.addTranscriptToHistory(finalResult);
        this.updateCurrentSpeech('');
        this.updateStats();

        // 모델 결과 시각화 최종 업데이트
        if (this.elements.ensembleFinalText) {
            this.elements.ensembleFinalText.textContent = correctedText;
        }

        this.meetingExporter.addTranscript({
            text: finalResult.text,
            speaker: finalResult.speaker,
            timestamp: finalResult.timestamp,
            isQuestion: finalResult.classification?.type === 'question',
            isComment: finalResult.classification?.type === 'comment',
            corrected: finalResult.corrected
        });

        requestIdleCallback(() => {
            const langCode = this.state.language?.split('-')[0] || 'ko';
            this.aiEngine.analyzeText(correctedText, langCode);
        });
    }

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

    addTranscriptToHistory(result) {
        if (!this.elements.transcriptHistory) return;
        const emptyState = this.elements.transcriptHistory.querySelector('.empty-state, .placeholder');
        if (emptyState) emptyState.remove();

        const item = document.createElement('div');
        const speakerClass = result.speaker?.isPrimary ? 'primary' : 'secondary';
        const isQuestion = result.classification?.type === 'question';
        const classificationClass = result.classification?.type || '';
        const transcriptIndex = this.data.fullTranscript.length - 1;
        
        item.dataset.index = transcriptIndex;
        item.className = `transcript-item ${speakerClass} ${classificationClass}`;
        
        const speakerLabel = result.speaker?.isPrimary ? '발표자' : '참석자';
        const timeStr = result.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let badgesHtml = `<span class="badge badge-question-toggle ${isQuestion ? 'active' : ''}" data-index="${transcriptIndex}">❓ 질문${isQuestion ? ' ✓' : ''}</span>`;
        if (result.corrected) badgesHtml += '<span class="badge badge-corrected">✨ 보정됨</span>';

        item.innerHTML = `
            <div class="transcript-speaker ${speakerClass}">
                <span class="speaker-icon">${result.speaker?.isPrimary ? '👤' : '👥'}</span>
                <span class="speaker-label">${speakerLabel}</span>
            </div>
            <div class="transcript-content">
                <p class="transcript-text">${this.escapeHtml(result.text)}</p>
                <div class="transcript-meta"><span class="timestamp">${timeStr}</span>${badgesHtml}</div>
            </div>
        `;

        const questionToggle = item.querySelector('.badge-question-toggle');
        if (questionToggle) {
            questionToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleQuestionStatus(parseInt(questionToggle.dataset.index), questionToggle);
            });
        }

        this.elements.transcriptHistory.appendChild(item);
        this.scrollToBottom(this.elements.transcriptHistory);
    }

    toggleQuestionStatus(index, badgeElement) {
        if (index < 0 || index >= this.data.fullTranscript.length) return;
        const transcript = this.data.fullTranscript[index];
        const isCurrentlyQuestion = transcript.classification?.type === 'question';
        
        if (isCurrentlyQuestion) {
            transcript.classification = { type: null };
            badgeElement.classList.remove('active');
            badgeElement.innerHTML = '❓ 질문';
        } else {
            transcript.classification = { type: 'question' };
            badgeElement.classList.add('active');
            badgeElement.innerHTML = '❓ 질문 ✓';
            this.handleQuestionDetected(transcript.text);
        }
        
        const transcriptItem = badgeElement.closest('.transcript-item');
        if (transcriptItem) transcriptItem.classList.toggle('question', !isCurrentlyQuestion);
        this.updateStats();
    }

    async handleQuestionDetected(question) {
        this.data.questions.push({ text: question, timestamp: new Date(), answered: false });
        this.updateQuestionsList(question);
        this.updateStats();
        this.meetingExporter.addQuestion({ text: question, timestamp: new Date() });
        if (this.elements.soundAlert?.checked) this.playAlertSound();
        if (this.state.autoAnswer && this.geminiAPI.isConfigured) await this.generateAIAnswer(question);
    }

    async generateAIAnswer(question) {
        try {
            let context = '';
            const recentSummary = this.data.meetingSummaries.slice(-1)[0] || '';
            if (recentSummary) context += `[최근 회의 요약]\n${recentSummary}\n\n`;
            
            const recentTranscripts = this.data.fullTranscript.slice(-10);
            if (recentTranscripts.length > 0) context += `[최근 대화 내용]\n${recentTranscripts.map(t => t.text).join('\n')}`;
            
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
                this.meetingExporter.addAIAnswer(aiAnswer);
            }
        } catch (error) {
            console.error('[AI Answer Error]', error);
        }
    }

    updateQuestionsList(question) {
        if (!this.elements.questionsList) return;
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

    updateAIAnswersList(aiAnswer) {
        if (!this.elements.aiAnswersList) return;
        const emptyState = this.elements.aiAnswersList.querySelector('.empty-state');
        if (emptyState) emptyState.remove();

        const item = document.createElement('div');
        item.className = 'ai-answer-item';
        let sourcesHtml = '';
        if (aiAnswer.sources?.length > 0) {
            sourcesHtml = `<div class="answer-sources"><span class="sources-label">📎 참고:</span>${aiAnswer.sources.map(s => `<a href="${s.uri || s.url || s}" target="_blank" class="source-link">${s.title || '출처'}</a>`).join(' ')}</div>`;
        }

        item.innerHTML = `<div class="answer-question"><span class="label">Q.</span><p>${this.escapeHtml(aiAnswer.question)}</p></div><div class="answer-content"><span class="label">A.</span><p>${this.escapeHtml(aiAnswer.answer)}</p>${sourcesHtml}</div>`;
        this.elements.aiAnswersList.appendChild(item);
        this.scrollToBottom(this.elements.aiAnswersList);
    }

    updateMeetingSummary(summary) {
        if (!summary) return;
        this.data.meetingSummaries.push(summary);
        this.meetingExporter.setSummary(summary);
        if (this.elements.meetingSummary) {
            this.elements.meetingSummary.innerHTML = `<div class="summary-content"><p>${this.escapeHtml(summary).replace(/\n/g, '<br>')}</p><span class="summary-time">최종 업데이트: ${new Date().toLocaleTimeString('ko-KR')}</span></div>`;
        }
        if (this.elements.summaryStatus) {
            this.elements.summaryStatus.textContent = '생성됨';
            this.elements.summaryStatus.classList.add('active');
        }
    }

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

    updateSpeakerIndicator(speakerType) {
        if (!this.elements.speakerIndicator) return;
        const isPrimary = speakerType === 'primary';
        this.elements.speakerIndicator.className = `speaker-indicator ${speakerType}`;
        this.elements.speakerIndicator.innerHTML = `<span class="speaker-icon">${isPrimary ? '👤' : '👥'}</span><span class="speaker-label">${isPrimary ? '발표자' : '참석자'}</span>`;
    }

    setPrimarySpeaker() {
        this.speakerDetector.setPrimarySpeaker();
        this.updateSpeakerIndicator('primary');
        this.showToast('주발표자가 설정되었습니다', 'success');
    }

    updateStats() {
        const totalWords = this.data.fullTranscript.reduce((sum, t) => sum + (t.text?.split(/\s+/).length || 0), 0);
        if (this.elements.totalWords) this.elements.totalWords.textContent = totalWords;
        if (this.elements.totalSentences) this.elements.totalSentences.textContent = this.data.fullTranscript.length;
        if (this.elements.totalQuestions) this.elements.totalQuestions.textContent = this.data.questions.length;
        if (this.elements.questionCount) this.elements.questionCount.textContent = this.data.questions.length;
        if (this.elements.answerCount) this.elements.answerCount.textContent = this.data.aiAnswers.length;
    }

    startTimer() {
        this.stopTimer();
        this.state.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000);
    }

    stopTimer() {
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
        }
    }

    startAutoSummaryTimer() {
        this.stopAutoSummaryTimer();
        this.state.autoSummaryTimer = setInterval(async () => {
            if (!this.state.isRecording || this.state.isPaused) return;
            if (this.data.fullTranscript.length < 3) return;
            try {
                const recentTranscripts = this.data.fullTranscript.slice(-20).map(t => t.text).join('\n');
                this.geminiAPI.addToMeetingTranscript(recentTranscripts, new Date());
                await this.geminiAPI.generateMeetingSummary(recentTranscripts);
                if (this.elements.summaryStatus) {
                    this.elements.summaryStatus.textContent = '업데이트됨';
                    this.elements.summaryStatus.classList.add('active');
                }
            } catch (error) { console.error('[AutoSummary] 실패:', error); }
        }, 60000);
    }

    stopAutoSummaryTimer() {
        if (this.state.autoSummaryTimer) {
            clearInterval(this.state.autoSummaryTimer);
            this.state.autoSummaryTimer = null;
        }
    }

    updateTimerDisplay() {
        if (!this.elements.timer || !this.state.startTime) return;
        let elapsed = Date.now() - this.state.startTime - this.state.pausedDuration;
        if (this.state.isPaused && this.state.pauseStartTime) elapsed = this.state.pauseStartTime - this.state.startTime - this.state.pausedDuration;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const pad = (n) => n.toString().padStart(2, '0');
        this.elements.timer.textContent = `${pad(hours)}:${pad(minutes % 60)}:${pad(seconds % 60)}`;
    }

    exportAudio() {
        if (!this.audioRecorder.chunks.length) {
            this.showToast('내보낼 녹음 데이터가 없습니다', 'warning');
            return;
        }
        this.audioRecorder.downloadRecording('meeting_audio');
        this.showToast('음성 파일이 다운로드됩니다', 'success');
    }

    async exportHTML() {
        const meetingTitle = this.elements.meetingContext?.value?.split('\n')[0] || '회의록';
        this.meetingExporter.setMeetingInfo({ title: meetingTitle, date: new Date(this.state.startTime || Date.now()), duration: this.elements.timer?.textContent || '00:00:00' });
        
        let smartSummary = null;
        if (this.geminiAPI.isConfigured && this.data.fullTranscript.length > 0) {
            this.showToast('AI가 회의록을 분석 중입니다...', 'info');
            try { smartSummary = await this.generateSmartMeetingSummary(); } catch (e) {}
        }
        this.meetingExporter.downloadSmartHTML('meeting_report', smartSummary);
        this.showToast('회의 리포트가 다운로드됩니다', 'success');
    }

    async generateSmartMeetingSummary() {
        if (!this.geminiAPI.isConfigured) return null;
        const transcriptText = this.data.fullTranscript.map(t => `[${t.timestamp.toLocaleTimeString()}] ${t.speaker?.isPrimary ? '발표자' : '참석자'}: ${t.text}`).join('\n');
        const prompt = `당신은 전문 회의 서기입니다. 다음 회의 내용을 분석하여 요약해주세요.\n\n[회의내용]\n${transcriptText}`;
        try {
            const result = await this.geminiAPI.generateMeetingSummary(prompt);
            return result;
        } catch (e) { return null; }
    }

    showExportMenu() {
        if (this.data.fullTranscript.length === 0) {
            this.showToast('내보낼 데이터가 없습니다', 'warning');
            return;
        }
        this.exportHTML();
    }

    clearAll() {
        if (!confirm('모든 기록을 삭제하시겠습니까?')) return;
        this.data = { fullTranscript: [], questions: [], aiAnswers: [], meetingSummaries: [], speakerHistory: [], userMemos: [] };
        this.audioRecorder.clearRecording();
        this.speakerDetector.reset();
        this.meetingExporter.clear();
        if (this.elements.transcriptHistory) this.elements.transcriptHistory.innerHTML = '';
        if (this.elements.currentSpeech) this.elements.currentSpeech.innerHTML = '<p class="placeholder">녹음 버튼을 눌러 회의를 시작하세요...</p>';
        this.updateStats();
        this.showToast('기록이 삭제되었습니다', 'success');
    }

    updateApiStatusUI() {
        if (!this.elements.apiStatus) return;
        const isConfigured = this.geminiAPI?.isConfigured;
        this.elements.apiStatus.className = `api-status ${isConfigured ? 'configured' : 'error'}`;
        this.elements.apiStatus.querySelector('.status-text').textContent = isConfigured ? 'API 연결됨' : 'API 키 미설정';
    }

    async validateApiKey(apiKey) {
        this.updateApiStatusWithState('pending', '연결 확인 중...');
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] })
            });
            if (response.ok) {
                this.updateApiStatusWithState('configured', 'API 연결 성공');
                return true;
            }
        } catch (e) {}
        this.updateApiStatusWithState('error', 'API 연결 실패');
        return false;
    }

    updateApiStatusWithState(state, message) {
        if (!this.elements.apiStatus) return;
        this.elements.apiStatus.className = `api-status ${state}`;
        this.elements.apiStatus.querySelector('.status-text').textContent = message;
    }

    openSettings() { if (this.elements.settingsModal) this.elements.settingsModal.classList.add('active'); }
    closeSettings() { if (this.elements.settingsModal) this.elements.settingsModal.classList.remove('active'); this.saveSettings(); }
    toggleApiKeyVisibility() {
        const input = this.elements.geminiApiKey;
        const icon = this.elements.toggleApiKeyVisibility.querySelector('i');
        input.type = input.type === 'password' ? 'text' : 'password';
        icon.className = input.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
    }

    saveSettings() {
        const settings = {
            language: this.state.language,
            apiKey: this.elements.geminiApiKey?.value || '',
            fasterWhisperEnabled: this.state.fasterWhisperMode,
            serverUrl: this.elements.ensembleServerUrl?.value || ''
        };
        localStorage.setItem('meetingAssistantSettings', JSON.stringify(settings));
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('meetingAssistantSettings');
            if (!saved) return;
            const settings = JSON.parse(saved);
            this.state.language = settings.language || 'ko-KR';
            if (this.elements.geminiApiKey) {
                this.elements.geminiApiKey.value = settings.apiKey || '';
                this.geminiAPI.setApiKey(settings.apiKey || '');
            }
            this.state.fasterWhisperMode = settings.fasterWhisperEnabled || false;
            if (this.elements.enableEnsemble) this.elements.enableEnsemble.checked = this.state.fasterWhisperMode;
            if (this.elements.ensembleServerUrl) this.elements.ensembleServerUrl.value = settings.serverUrl || 'http://localhost:8000';
            this.speechManager.config.serverUrl = settings.serverUrl || 'http://localhost:8000';
        } catch (e) {}
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span>${message}</span>`;
        this.elements.toastContainer.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
    }

    playAlertSound() { /* Logic to play sound */ }
    escapeHtml(text) { const div = document.createElement('div'); div.textContent = text; return div.innerHTML; }
    scrollToBottom(el) { if (el) requestAnimationFrame(() => el.scrollTop = el.scrollHeight); }

    // Faster-Whisper Logic
    setupFasterWhisperListeners() {
        if (this.elements.enableEnsemble) {
            this.elements.enableEnsemble.addEventListener('change', (e) => {
                this.state.fasterWhisperMode = e.target.checked;
                this.updateFasterWhisperStatusUI();
                this.updateEnsembleVisualizerVisibility();
                this.saveSettings();
            });
        }
        if (this.elements.testEnsembleConnection) {
            this.elements.testEnsembleConnection.addEventListener('click', () => this.testFasterWhisperConnection());
        }
    }

    async testFasterWhisperConnection() {
        const url = this.elements.ensembleServerUrl.value.trim();
        this.elements.testEnsembleConnection.disabled = true;
        try {
            const response = await fetch(`${url}/health`);
            if (response.ok) {
                this.showToast('Faster-Whisper 서버 연결 성공!', 'success');
                this.updateFasterWhisperStatusUI(true);
            } else throw new Error();
        } catch (e) {
            this.showToast('Faster-Whisper 서버 연결 실패', 'error');
            this.updateFasterWhisperStatusUI(false);
        }
        this.elements.testEnsembleConnection.disabled = false;
    }

    updateFasterWhisperStatusUI(connected = false) {
        if (!this.elements.ensembleStatusText) return;
        if (connected) this.elements.ensembleStatusText.textContent = 'Faster-Whisper 서버 연결됨';
        else if (this.state.fasterWhisperMode) this.elements.ensembleStatusText.textContent = 'Faster-Whisper 모드 활성화 (연결 대기)';
        else this.elements.ensembleStatusText.textContent = 'Faster-Whisper 미사용 (Web Speech API 사용 중)';
    }

    updateEnsembleVisualizerVisibility() {
        if (this.elements.ensembleVisualizer) this.elements.ensembleVisualizer.style.display = this.state.fasterWhisperMode ? 'block' : 'none';
    }

    updateRecordingStatus(status) {
        const indicator = this.elements.statusIndicator;
        if (!indicator) return;
        const text = indicator.querySelector('.status-text');
        indicator.className = `status-indicator ${status}`;
        if (text) {
            if (status === 'recording') text.textContent = '녹음 중';
            else if (status === 'paused') text.textContent = '일시정지';
            else text.textContent = '대기 중';
        }
    }

    updateButtonStates(status) {
        const { startBtn, stopBtn, pauseBtn } = this.elements;
        if (status === 'recording') {
            startBtn.disabled = true; stopBtn.disabled = false; pauseBtn.disabled = false;
        } else if (status === 'idle') {
            startBtn.disabled = false; stopBtn.disabled = true; pauseBtn.disabled = true;
        }
    }

    initCorrectionIntervalUI() {
        if (this.elements.correctionIntervalValue) this.elements.correctionIntervalValue.textContent = `${this.elements.correctionInterval.value}초`;
    }

    setupLanguageListeners() { /* ... */ }
    updateLanguageStatusUI() { /* ... */ }
    setupMemoListeners() {
        if (this.elements.memoToggle) this.elements.memoToggle.addEventListener('click', () => {
            const isVisible = this.elements.memoContainer.style.display === 'flex';
            this.elements.memoContainer.style.display = isVisible ? 'none' : 'flex';
        });
        if (this.elements.saveMemoBtn) this.elements.saveMemoBtn.addEventListener('click', () => {
            const text = this.elements.userMemoInput.value.trim();
            if (text) {
                const item = document.createElement('div');
                item.className = 'memo-item';
                item.textContent = text;
                this.elements.memoHistory.appendChild(item);
                this.elements.userMemoInput.value = '';
            }
        });
    }

    updateContext() {
        const context = this.elements.meetingContext?.value || '';
        this.textCorrector.setMeetingContext(context);
        this.geminiAPI.setContext(context);
        this.updateContextStatusUI();
    }

    updateContextStatusUI() {
        if (!this.elements.contextStatus) return;
        const hasContext = this.elements.meetingContext?.value?.trim();
        this.elements.contextStatus.innerHTML = hasContext ? '<i class="fas fa-check-circle"></i> 컨텍스트 설정됨' : '<i class="fas fa-info-circle"></i> 컨텍스트 미설정';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new EnhancedMeetingApp();
});