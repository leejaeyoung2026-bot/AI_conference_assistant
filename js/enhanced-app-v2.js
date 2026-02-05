/**
 * Enhanced Meeting AI Assistant v5.0 (Faster-Whisper Edition)
 * Faster-Whisper STT + 발화자 구분 + Gemini 통합 보정
 */

class EnhancedMeetingApp {
    constructor() {
        // 핵심 모듈 초기화
        this.speechManager = new FasterWhisperSTTSystem();
        this.fallbackSpeechManager = new SpeechRecognitionManager();
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
            fasterWhisperMode: false
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

        // 관리자 채널 초기화
        this.adminChannel = new BroadcastChannel('app_status_channel');
        this.startHeartbeat();

        this.init();
    }

    startHeartbeat() {
        setInterval(() => {
            if (!this.adminChannel) return;
            
            this.adminChannel.postMessage({
                type: 'HEARTBEAT',
                data: {
                    queueLength: this.geminiAPI?.requestQueue?.length || 0,
                    isProcessing: this.geminiAPI?.isProcessingQueue || false,
                    transcriptCount: this.data.fullTranscript.length,
                    isRecording: this.state.isRecording
                }
            });
        }, 2000);
    }

    sendLog(message, level = 'info') {
        this.adminChannel.postMessage({
            type: 'LOG',
            data: { message, level }
        });
    }

    initializeElements() {
        return {
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
            statusIndicator: document.getElementById('statusIndicator'),
            voiceVisualizer: document.getElementById('voiceVisualizer'),
            timer: document.getElementById('timer'),
            speakerIndicator: document.getElementById('speakerIndicator'),
            currentSpeech: document.getElementById('currentSpeech'),
            transcriptHistory: document.getElementById('transcriptHistory'),
            questionsList: document.getElementById('questionsList'),
            aiAnswersList: document.getElementById('aiAnswersList'),
            meetingSummary: document.getElementById('meetingSummary'),
            questionCount: document.getElementById('questionCount'),
            answerCount: document.getElementById('answerCount'),
            totalWords: document.getElementById('totalWords'),
            totalSentences: document.getElementById('totalSentences'),
            totalQuestions: document.getElementById('totalQuestions'),
            summaryStatus: document.getElementById('summaryStatus'),
            settingsModal: document.getElementById('settingsModal'),
            languageSelect: document.getElementById('languageSelect'),
            secondaryLanguageSelect: document.getElementById('secondaryLanguageSelect'),
            sensitivityRange: document.getElementById('sensitivityRange'),
            sensitivityValue: document.getElementById('sensitivityValue'),
            soundAlert: document.getElementById('soundAlert'),
            geminiApiKey: document.getElementById('geminiApiKey'),
            toggleApiKeyVisibility: document.getElementById('toggleApiKeyVisibility'),
            autoAnswer: document.getElementById('autoAnswer'),
            aiResponseStyle: document.getElementById('aiResponseStyle'),
            apiStatus: document.getElementById('apiStatus'),
            enableCorrection: document.getElementById('enableCorrection'),
            correctionPersona: document.getElementById('correctionPersona'),
            enableNBest: document.getElementById('enableNBest'),
            meetingContext: document.getElementById('meetingContext'),
            priorityTerms: document.getElementById('priorityTerms'),
            contextStatus: document.getElementById('contextStatus'),
            correctionInterval: document.getElementById('correctionInterval'),
            correctionIntervalValue: document.getElementById('correctionIntervalValue'),
            enableGrounding: document.getElementById('enableGrounding'),
            enableAutoSummary: document.getElementById('enableAutoSummary'),
            enableSpeakerDetection: document.getElementById('enableSpeakerDetection'),
            enableEnsemble: document.getElementById('enableEnsemble'),
            ensembleServerUrl: document.getElementById('ensembleServerUrl'),
            testEnsembleConnection: document.getElementById('testEnsembleConnection'),
            ensembleStatus: document.getElementById('ensembleStatus'),
            ensembleStatusText: document.getElementById('ensembleStatusText'),
            toggleServerHelp: document.getElementById('toggleServerHelp'),
            serverHelpContent: document.getElementById('serverHelpContent'),
            downloadServerTemplate: document.getElementById('downloadServerTemplate'),
            ensembleVisualizer: document.getElementById('ensembleVisualizer'),
            textWhisper: document.getElementById('textWhisper'),
            confWhisper: document.getElementById('confWhisper'),
            ensembleFinalText: document.getElementById('ensembleFinalText'),
            languageStatus: document.getElementById('languageStatus'),
            languageStatusText: document.getElementById('languageStatusText'),
            memoToggle: document.getElementById('memoToggle'),
            memoContainer: document.getElementById('memoContainer'),
            memoClose: document.getElementById('memoClose'),
            memoHistory: document.getElementById('memoHistory'),
            userMemoInput: document.getElementById('userMemoInput'),
            saveMemoBtn: document.getElementById('saveMemoBtn'),
            askAIBtn: document.getElementById('askAIBtn'),
            toastContainer: document.getElementById('toastContainer')
        };
    }

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
        console.log('[EnhancedMeetingApp] Faster-Whisper Edition v5.1 초기화 완료');
    }

    setupEventListeners() {
        const el = this.elements;
        if (el.startBtn) el.startBtn.addEventListener('click', () => this.startRecording());
        if (el.stopBtn) el.stopBtn.addEventListener('click', () => this.stopRecording());
        if (el.pauseBtn) el.pauseBtn.addEventListener('click', () => this.togglePause());
        if (el.clearBtn) el.clearBtn.addEventListener('click', () => this.clearAll());
        if (el.exportBtn) el.exportBtn.addEventListener('click', () => this.showExportMenu());
        if (el.exportAudioBtn) el.exportAudioBtn.addEventListener('click', () => this.exportAudio());
        if (el.exportHtmlBtn) el.exportHtmlBtn.addEventListener('click', () => this.exportHTML());
        if (el.setPrimarySpeakerBtn) el.setPrimarySpeakerBtn.addEventListener('click', () => this.setPrimarySpeaker());
        if (el.settingsBtn) el.settingsBtn.addEventListener('click', () => this.openSettings());
        if (el.closeModal) el.closeModal.addEventListener('click', () => this.closeSettings());
        if (el.settingsModal) el.settingsModal.addEventListener('click', (e) => { if (e.target === el.settingsModal) this.closeSettings(); });
        if (el.toggleApiKeyVisibility) el.toggleApiKeyVisibility.addEventListener('click', () => this.toggleApiKeyVisibility());

        this.setupSettingsChangeListeners();
    }

    setupSettingsChangeListeners() {
        const el = this.elements;
        if (el.languageSelect) {
            el.languageSelect.addEventListener('change', (e) => {
                this.state.language = e.target.value;
                this.fallbackSpeechManager.setLanguage(this.state.language);
                this.updateLanguageStatusUI();
                this.saveSettings();
            });
        }
        if (el.secondaryLanguageSelect) {
            el.secondaryLanguageSelect.addEventListener('change', (e) => {
                this.state.secondaryLanguage = e.target.value;
                this.updateLanguageStatusUI();
                this.saveSettings();
            });
        }
        if (el.geminiApiKey) {
            el.geminiApiKey.addEventListener('change', async (e) => {
                const apiKey = e.target.value.trim();
                this.geminiAPI.setApiKey(apiKey);
                this.saveSettings();
                if (apiKey) await this.validateApiKey(apiKey);
                else this.updateApiStatusWithState('error', 'API 키 미설정');
            });
        }
        if (el.autoAnswer) el.autoAnswer.addEventListener('change', (e) => { this.state.autoAnswer = e.target.checked; this.saveSettings(); });
        if (el.enableCorrection) el.enableCorrection.addEventListener('change', (e) => { this.state.enableCorrection = e.target.checked; this.textCorrector.enabled = e.target.checked; this.saveSettings(); });
        if (el.sensitivityRange) {
            el.sensitivityRange.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                this.aiEngine.sensitivity = value;
                const labels = ['매우 낮음', '낮음', '보통', '높음', '매우 높음'];
                if (el.sensitivityValue) el.sensitivityValue.textContent = labels[value - 1];
                this.saveSettings();
            });
        }
        if (el.correctionInterval) {
            el.correctionInterval.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                if (el.correctionIntervalValue) el.correctionIntervalValue.textContent = `${value}초`;
                if (this.textCorrector) this.textCorrector.minCorrectionInterval = value * 1000;
                this.saveSettings();
            });
        }
        if (el.meetingContext) {
            el.meetingContext.addEventListener('input', () => { this.updateContext(); });
            el.meetingContext.addEventListener('change', () => { this.updateContext(); this.saveSettings(); });
        }
        if (el.priorityTerms) {
            el.priorityTerms.addEventListener('input', () => { this.updateContext(); });
            el.priorityTerms.addEventListener('change', () => { this.updateContext(); this.saveSettings(); });
        }
    }

    setupSpeechCallbacks() {
        const handleResult = (result) => this.handleSpeechResult(result);
        const handleStatus = (status) => this.updateRecordingStatus(status);
        const handleError = (code, msg) => this.showToast(msg, 'error');
        this.speechManager.onTranscript(handleResult);
        this.speechManager.onStatusChange(handleStatus);
        this.speechManager.onError(handleError);
        this.fallbackSpeechManager.onResult(handleResult);
        this.fallbackSpeechManager.onStatusChange(handleStatus);
        this.fallbackSpeechManager.onError(handleError);
    }

    setupAICallbacks() { this.aiEngine.onQuestionDetected = async (q) => await this.handleQuestionDetected(q); }
    setupGeminiCallbacks() { this.geminiAPI.onSummaryGenerated = (s) => this.updateMeetingSummary(s); }
    setupTextCorrectorCallbacks() { this.textCorrector.onCorrectionComplete = (o, c) => { if (o !== c) console.log(`[TextCorrector] ${o} -> ${c}`); }; }
    setupAudioRecorderCallbacks() { this.audioRecorder.onError = (c, m) => this.showToast(m, 'error'); }
    setupSpeakerDetectorCallbacks() { this.speakerDetector.onSpeakerChange = (i) => this.updateSpeakerIndicator(i.current); }

    async startRecording() {
        if (this.state.isRecording) return;
        this.updateButtonStates('recording');
        try {
            let started = false;
            if (this.state.fasterWhisperMode) {
                started = await this.speechManager.start();
                if (!started) { this.showToast('서버 연결 실패. 기본 엔진 사용.', 'warning'); started = this.fallbackSpeechManager.start(); }
            } else started = this.fallbackSpeechManager.start();
            if (!started) throw new Error('인식 시작 불가');
            await this.audioRecorder.start();
            if (this.state.enableSpeakerDetection && this.audioRecorder.stream) this.speakerDetector.initializeAnalyser(this.audioRecorder.stream);
            this.state.isRecording = true;
            this.state.startTime = Date.now();
            this.startTimer();
            this.updateRecordingStatus('recording');
            if (this.state.enableAutoSummary && this.geminiAPI.isConfigured) this.startAutoSummaryTimer();
            this.showToast('녹음 시작', 'success');
        } catch (e) {
            this.showToast(e.message, 'error');
            this.state.isRecording = false;
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
        this.updateButtonStates('idle');
        this.updateRecordingStatus('stopped');
        if (this.data.fullTranscript.length > 0) this.generateFinalSummary();
        this.showToast('녹음 중지', 'info');
    }

    togglePause() {
        if (!this.state.isRecording) return;
        if (this.state.isPaused) {
            if (this.state.fasterWhisperMode) this.speechManager.start(); else this.fallbackSpeechManager.start();
            this.audioRecorder.resume();
            this.state.isPaused = false;
            this.updateButtonStates('recording');
            this.showToast('재개됨', 'success');
        } else {
            this.speechManager.stop();
            this.fallbackSpeechManager.stop();
            this.audioRecorder.pause();
            this.state.isPaused = true;
            this.updateButtonStates('paused');
            this.showToast('일시정지됨', 'info');
        }
    }

    async handleSpeechResult(result) {
        if (!result.isFinal) {
            this.updateCurrentSpeech(result.text);
            if (this.state.fasterWhisperMode && this.elements.textWhisper) {
                this.elements.textWhisper.textContent = result.text;
                if (result.confidence) this.elements.confWhisper.textContent = `${(result.confidence * 100).toFixed(0)}%`;
            }
            return;
        }
        const processed = this.speakerDetector.processUtterance(result.text);
        let corrected = result.text;
        if (this.state.enableCorrection && this.textCorrector.enabled) {
            try {
                const res = await this.textCorrector.correct(result.text);
                corrected = typeof res === 'string' ? res : (res?.text || result.text);
            } catch (e) {}
        }
        const finalRes = { text: corrected, original: result.text, speaker: processed.speaker, classification: processed.classification, timestamp: new Date(), corrected: corrected !== result.text };
        this.data.fullTranscript.push(finalRes);
        this.addTranscriptToHistory(finalRes);
        this.updateCurrentSpeech('');
        this.updateStats();
        if (this.elements.ensembleFinalText) this.elements.ensembleFinalText.textContent = corrected;
        this.meetingExporter.addTranscript(finalRes);
        const langCode = this.state.language?.split('-')[0] || 'ko';
        requestIdleCallback(() => this.aiEngine.analyzeText(corrected, langCode));
    }

    updateCurrentSpeech(t) { if (this.elements.currentSpeech) this.elements.currentSpeech.innerHTML = t ? `<div class="speech-content"><span class="speech-text">${this.escapeHtml(t)}</span><span class="speech-indicator">...</span></div>` : ''; }

    addTranscriptToHistory(res) {
        const hist = this.elements.transcriptHistory;
        if (!hist) return;
        const empty = hist.querySelector('.empty-state, .placeholder');
        if (empty) empty.remove();
        const item = document.createElement('div');
        const sClass = res.speaker?.isPrimary ? 'primary' : 'secondary';
        item.className = `transcript-item ${sClass} ${res.classification?.type || ''}`;
        const time = res.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        item.innerHTML = `
            <div class="transcript-speaker ${sClass}"><span class="speaker-icon">${res.speaker?.isPrimary ? '👤' : '👥'}</span><span class="speaker-label">${res.speaker?.isPrimary ? '발표자' : '참석자'}</span></div>
            <div class="transcript-content"><p class="transcript-text">${this.escapeHtml(res.text)}</p><div class="transcript-meta"><span class="timestamp">${time}</span>${res.corrected ? '<span class="badge badge-corrected">✨ 보정됨</span>' : ''}</div></div>
        `;
        hist.appendChild(item);
        this.scrollToBottom(hist);
    }

    async handleQuestionDetected(q) {
        this.data.questions.push({ text: q, timestamp: new Date() });
        this.updateQuestionsList(q);
        this.updateStats();
        if (this.state.autoAnswer && this.geminiAPI.isConfigured) await this.generateAIAnswer(q);
    }

    async generateAIAnswer(q) {
        try {
            const res = await this.geminiAPI.generateAnswer(q, this.data.fullTranscript.slice(-10).map(t => t.text).join('\n'));
            if (res) {
                const ans = { question: q, answer: res.answer || '', sources: res.sources || [], timestamp: new Date() };
                this.data.aiAnswers.push(ans);
                this.updateAIAnswersList(ans);
                this.updateStats();
            }
        } catch (e) {}
    }

    updateQuestionsList(q) {
        const list = this.elements.questionsList;
        if (!list) return;
        const empty = list.querySelector('.empty-state'); if (empty) empty.remove();
        const item = document.createElement('div'); item.className = 'question-item';
        item.innerHTML = `<span class="question-icon">❓</span><p class="question-text">${this.escapeHtml(q)}</p>`;
        list.appendChild(item);
        this.scrollToBottom(list);
    }

    updateAIAnswersList(a) {
        const list = this.elements.aiAnswersList;
        if (!list) return;
        const empty = list.querySelector('.empty-state'); if (empty) empty.remove();
        const item = document.createElement('div'); item.className = 'ai-answer-item';
        item.innerHTML = `<div class="answer-question"><span>Q.</span><p>${this.escapeHtml(a.question)}</p></div><div class="answer-content"><span>A.</span><p>${this.escapeHtml(a.answer)}</p></div>`;
        list.appendChild(item);
        this.scrollToBottom(list);
    }

    updateMeetingSummary(s) {
        if (!s) return;
        this.data.meetingSummaries.push(s);
        if (this.elements.meetingSummary) this.elements.meetingSummary.innerHTML = `<div class="summary-content"><p>${this.escapeHtml(s).replace(/\n/g, '<br>')}</p></div>`;
        if (this.elements.summaryStatus) { this.elements.summaryStatus.textContent = '업데이트됨'; this.elements.summaryStatus.classList.add('active'); }
    }

    async generateFinalSummary() {
        if (!this.geminiAPI.isConfigured) return;
        const text = this.data.fullTranscript.map(t => t.text).join(' ');
        if (text.length < 50) return;
        try { const s = await this.geminiAPI.generateMeetingSummary(text); this.updateMeetingSummary(s); } catch (e) {}
    }

    updateSpeakerIndicator(type) {
        const el = this.elements.speakerIndicator;
        if (!el) return;
        const isP = type === 'primary';
        el.className = `speaker-indicator ${type}`;
        el.innerHTML = `<span class="speaker-icon">${isP ? '👤' : '👥'}</span><span class="speaker-label">${isP ? '발표자' : '참석자'}</span>`;
    }

    setPrimarySpeaker() { this.speakerDetector.setPrimarySpeaker(); this.updateSpeakerIndicator('primary'); this.showToast('주발표자 설정됨', 'success'); }

    updateStats() {
        const words = this.data.fullTranscript.reduce((sum, t) => sum + (t.text?.split(/\s+/).length || 0), 0);
        if (this.elements.totalWords) this.elements.totalWords.textContent = words;
        if (this.elements.totalSentences) this.elements.totalSentences.textContent = this.data.fullTranscript.length;
        if (this.elements.totalQuestions) this.elements.totalQuestions.textContent = this.data.questions.length;
        if (this.elements.questionCount) this.elements.questionCount.textContent = this.data.questions.length;
        if (this.elements.answerCount) this.elements.answerCount.textContent = this.data.aiAnswers.length;
    }

    startTimer() { this.stopTimer(); this.state.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000); }
    stopTimer() { if (this.state.timerInterval) { clearInterval(this.state.timerInterval); this.state.timerInterval = null; } }
    updateTimerDisplay() {
        if (!this.elements.timer || !this.state.startTime) return;
        let elapsed = Date.now() - this.state.startTime - this.state.pausedDuration;
        const s = Math.floor(elapsed / 1000);
        const m = Math.floor(s / 60);
        const h = Math.floor(m / 60);
        const pad = (n) => n.toString().padStart(2, '0');
        this.elements.timer.textContent = `${pad(h)}:${pad(m % 60)}:${pad(s % 60)}`;
    }

    startAutoSummaryTimer() {
        this.stopAutoSummaryTimer();
        this.state.autoSummaryTimer = setInterval(async () => {
            if (!this.state.isRecording || this.state.isPaused || this.data.fullTranscript.length < 3) return;
            try {
                const text = this.data.fullTranscript.slice(-20).map(t => t.text).join('\n');
                await this.geminiAPI.generateMeetingSummary(text);
            } catch (e) {}
        }, 60000);
    }
    stopAutoSummaryTimer() { if (this.state.autoSummaryTimer) { clearInterval(this.state.autoSummaryTimer); this.state.autoSummaryTimer = null; } }

    exportAudio() { if (this.audioRecorder.chunks.length) this.audioRecorder.downloadRecording('meeting_audio'); else this.showToast('데이터 없음', 'warning'); }
    async exportHTML() { this.meetingExporter.downloadSmartHTML('meeting_report', this.data.meetingSummaries.slice(-1)[0]); this.showToast('다운로드됨', 'success'); }
    showExportMenu() { if (this.data.fullTranscript.length) this.exportHTML(); else this.showToast('데이터 없음', 'warning'); }

    clearAll() {
        if (!confirm('삭제하시겠습니까?')) return;
        this.data = { fullTranscript: [], questions: [], aiAnswers: [], meetingSummaries: [], speakerHistory: [], userMemos: [] };
        this.audioRecorder.clearRecording();
        this.speakerDetector.reset();
        if (this.elements.transcriptHistory) this.elements.transcriptHistory.innerHTML = '';
        this.updateStats();
        this.showToast('삭제됨', 'success');
    }

    updateApiStatusUI() {
        const config = this.geminiAPI?.isConfigured;
        const el = this.elements.apiStatus;
        if (el) { el.className = `api-status ${config ? 'configured' : 'error'}`; el.querySelector('.status-text').textContent = config ? 'API 연결됨' : 'API 키 미설정'; }
    }

    async validateApiKey(key) {
        try {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: 'Hi' }] }] }) });
            if (res.ok) { this.updateApiStatusWithState('configured', 'API 연결 성공'); return true; }
        } catch (e) {}
        this.updateApiStatusWithState('error', '연결 실패'); return false;
    }

    updateApiStatusWithState(s, m) { if (this.elements.apiStatus) { this.elements.apiStatus.className = `api-status ${s}`; this.elements.apiStatus.querySelector('.status-text').textContent = m; } }

    updateRecordingStatus(status) {
        const indicator = this.elements.statusIndicator;
        const visualizer = this.elements.voiceVisualizer;
        if (!indicator) return;

        const statusText = indicator.querySelector('.status-text');
        indicator.classList.remove('recording', 'paused', 'idle');

        if (status === 'recording' || status === 'listening') {
            indicator.classList.add('recording');
            if (statusText) statusText.textContent = '녹음 중';
            if (visualizer) visualizer.classList.add('active');
        } else if (status === 'paused') {
            indicator.classList.add('paused');
            if (statusText) statusText.textContent = '일시정지';
            if (visualizer) visualizer.classList.remove('active');
        } else {
            indicator.classList.add('idle');
            if (statusText) statusText.textContent = '대기 중';
            if (visualizer) visualizer.classList.remove('active');
        }
    }

    updateButtonStates(status) {
        const { startBtn, stopBtn, pauseBtn } = this.elements;
        if (!startBtn || !stopBtn || !pauseBtn) return;

        if (status === 'recording') {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            pauseBtn.disabled = false;
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>일시정지</span>';
            pauseBtn.className = 'btn btn-warning btn-large';
        } else if (status === 'paused') {
            startBtn.disabled = true;
            stopBtn.disabled = false;
            pauseBtn.disabled = false;
            pauseBtn.innerHTML = '<i class="fas fa-play"></i><span>재개</span>';
            pauseBtn.className = 'btn btn-success btn-large';
        } else {
            startBtn.disabled = false;
            stopBtn.disabled = true;
            pauseBtn.disabled = true;
            pauseBtn.innerHTML = '<i class="fas fa-pause"></i><span>일시정지</span>';
            pauseBtn.className = 'btn btn-warning btn-large';
        }
    }

    openSettings() { this.elements.settingsModal?.classList.add('active'); }
    closeSettings() { this.elements.settingsModal?.classList.remove('active'); this.saveSettings(); }
    toggleApiKeyVisibility() {
        const input = this.elements.geminiApiKey;
        const icon = this.elements.toggleApiKeyVisibility?.querySelector('i');
        if (input && icon) { input.type = input.type === 'password' ? 'text' : 'password'; icon.className = input.type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash'; }
    }

    saveSettings() {
        const s = { language: this.state.language, secondaryLanguage: this.state.secondaryLanguage, apiKey: this.elements.geminiApiKey?.value || '', fasterWhisperEnabled: this.state.fasterWhisperMode, serverUrl: this.elements.ensembleServerUrl?.value || '' };
        localStorage.setItem('meetingAssistantSettings', JSON.stringify(s));
    }

    loadSettings() {
        try {
            const saved = localStorage.getItem('meetingAssistantSettings');
            if (!saved) return;
            const s = JSON.parse(saved);
            this.state.language = s.language || 'ko-KR';
            this.state.secondaryLanguage = s.secondaryLanguage || 'none';
            if (this.elements.languageSelect) this.elements.languageSelect.value = this.state.language;
            if (this.elements.secondaryLanguageSelect) this.elements.secondaryLanguageSelect.value = this.state.secondaryLanguage;
            if (this.elements.geminiApiKey) { this.elements.geminiApiKey.value = s.apiKey || ''; this.geminiAPI.setApiKey(s.apiKey || ''); }
            this.state.fasterWhisperMode = s.fasterWhisperEnabled || false;
            if (this.elements.enableEnsemble) this.elements.enableEnsemble.checked = this.state.fasterWhisperMode;
            if (this.elements.ensembleServerUrl) this.elements.ensembleServerUrl.value = s.serverUrl || 'http://localhost:8000';
            this.speechManager.config.serverUrl = s.serverUrl || 'http://localhost:8000';
        } catch (e) {}
    }

    showToast(m, t = 'info') {
        const toast = document.createElement('div'); toast.className = `toast toast-${t}`; toast.innerHTML = `<span>${m}</span>`;
        this.elements.toastContainer?.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
    }

    escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    scrollToBottom(el) { if (el) requestAnimationFrame(() => el.scrollTop = el.scrollHeight); }

    setupFasterWhisperListeners() {
        const el = this.elements;
        if (el.enableEnsemble) {
            el.enableEnsemble.addEventListener('change', (e) => {
                this.state.fasterWhisperMode = e.target.checked;
                this.updateFasterWhisperStatusUI();
                if (el.ensembleVisualizer) el.ensembleVisualizer.style.display = e.target.checked ? 'block' : 'none';
                this.saveSettings();
            });
        }
        if (el.testEnsembleConnection) el.testEnsembleConnection.addEventListener('click', () => this.testFasterWhisperConnection());
        
        // 프리셋 버튼 리스너 추가
        document.querySelectorAll('.btn-preset').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const url = e.currentTarget.dataset.url;
                if (el.ensembleServerUrl) {
                    if (url === "") { el.ensembleServerUrl.focus(); }
                    else el.ensembleServerUrl.value = url;
                    this.speechManager.config.serverUrl = el.ensembleServerUrl.value;
                    this.saveSettings();
                }
                document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
            });
        });

        if (el.toggleServerHelp) {
            el.toggleServerHelp.addEventListener('click', () => {
                const content = el.serverHelpContent;
                if (content) {
                    const isVisible = content.style.display !== 'none';
                    content.style.display = isVisible ? 'none' : 'block';
                    const icon = el.toggleServerHelp.querySelector('i');
                    if (icon) icon.className = isVisible ? 'fas fa-chevron-down' : 'fas fa-chevron-up';
                }
            });
        }
    }

    async testFasterWhisperConnection() {
        const url = this.elements.ensembleServerUrl?.value.trim();
        if (!url) return;
        this.elements.testEnsembleConnection.disabled = true;
        try {
            const res = await fetch(`${url}/health`);
            if (res.ok) { this.showToast('서버 연결 성공!', 'success'); this.updateFasterWhisperStatusUI(true); } else throw new Error();
        } catch (e) { this.showToast('연결 실패', 'error'); this.updateFasterWhisperStatusUI(false); }
        this.elements.testEnsembleConnection.disabled = false;
    }

    updateFasterWhisperStatusUI(connected = false) {
        const el = this.elements.ensembleStatusText;
        if (!el) return;
        if (connected) el.textContent = 'Faster-Whisper 서버 연결됨';
        else if (this.state.fasterWhisperMode) el.textContent = 'Faster-Whisper 모드 활성화 (대기)';
        else el.textContent = 'Web Speech API 사용 중';
    }

    setupLanguageListeners() {
        this.updateLanguageStatusUI();
    }

    updateLanguageStatusUI() {
        const el = this.elements.languageStatusText;
        if (!el) return;
        const langNames = { 'ko-KR': '한국어', 'en-US': 'English', 'ja-JP': '日本語', 'zh-CN': '中文', 'de-DE': 'Deutsch', 'fr-FR': 'Français', 'es-ES': 'Español' };
        const p = langNames[this.state.language] || this.state.language;
        const s = this.state.secondaryLanguage !== 'none' ? langNames[this.state.secondaryLanguage] || this.state.secondaryLanguage : null;
        el.textContent = s ? `다중 언어: ${p} + ${s}` : `단일 언어: ${p}`;
    }

    setupMemoListeners() {
        const el = this.elements;
        if (el.memoToggle) el.memoToggle.addEventListener('click', () => {
            const isV = el.memoContainer?.style.display === 'flex';
            if (el.memoContainer) el.memoContainer.style.display = isV ? 'none' : 'flex';
        });
        if (el.memoClose) el.memoClose.addEventListener('click', () => { if (el.memoContainer) el.memoContainer.style.display = 'none'; });
        if (el.saveMemoBtn) el.saveMemoBtn.addEventListener('click', () => {
            const t = el.userMemoInput?.value.trim();
            if (t) {
                const m = document.createElement('div'); m.className = 'memo-item'; m.innerHTML = `<p class="memo-text">${this.escapeHtml(t)}</p>`;
                el.memoHistory?.appendChild(m); el.userMemoInput.value = '';
            }
        });
        if (el.askAIBtn) el.askAIBtn.addEventListener('click', () => {
            const t = el.userMemoInput?.value.trim();
            if (t) { this.handleQuestionDetected(t); el.userMemoInput.value = ''; }
        });
    }

    updateContext() {
        const c = this.elements.meetingContext?.value || '';
        this.textCorrector.setMeetingContext(c);
        this.geminiAPI.setContext(c);
        this.updateContextStatusUI();
    }

    updateContextStatusUI() {
        const el = this.elements.contextStatus;
        if (!el) return;
        const has = this.elements.meetingContext?.value?.trim();
        el.innerHTML = has ? '<i class="fas fa-check-circle"></i> 컨텍스트 설정됨' : '<i class="fas fa-info-circle"></i> 컨텍스트 미설정';
    }

    initCorrectionIntervalUI() { if (this.elements.correctionIntervalValue && this.elements.correctionInterval) this.elements.correctionIntervalValue.textContent = `${this.elements.correctionInterval.value}초`; }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new EnhancedMeetingApp(); });
