/**
 * Enhanced Meeting AI Assistant v5.2 (Web Standard Edition)
 * Web Speech API + Gemini AI 통합 모드
 */

class EnhancedMeetingApp {
    constructor() {
        // 핵심 모듈 초기화 (브라우저 내장 API만 사용)
        this.speechManager = new SpeechRecognitionManager();
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
            language: 'ko-KR',
            autoAnswer: true,
            enableCorrection: true,
            enableAutoSummary: true,
            enableSpeakerDetection: true
        };

        // 데이터
        this.data = {
            fullTranscript: [],
            questions: [],
            aiAnswers: [],
            meetingSummaries: [],
            speakerHistory: []
        };

        // 관리자 채널 초기화
        this.adminChannel = new BroadcastChannel('app_status_channel');
        this.startHeartbeat();
        this.setupAdminRemoteControl();

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
                    isRecording: this.state.isRecording,
                    engine: 'Web Speech API'
                }
            });
        }, 2000);
    }

    setupAdminRemoteControl() {
        this.adminChannel.onmessage = (event) => {
            const { type } = event.data;
            if (type === 'REMOTE_START') this.startRecording();
            else if (type === 'REMOTE_STOP') this.stopRecording();
        };
    }

    sendLog(message, level = 'info') {
        this.adminChannel.postMessage({ type: 'LOG', data: { message, level } });
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
            chatHistory: document.getElementById('chatHistory'),
            chatInput: document.getElementById('chatInput'),
            chatSendBtn: document.getElementById('chatSendBtn'),
            meetingSummary: document.getElementById('meetingSummary'),
            questionCount: document.getElementById('questionCount'),
            answerCount: document.getElementById('answerCount'),
            totalWords: document.getElementById('totalWords'),
            totalSentences: document.getElementById('totalSentences'),
            totalQuestions: document.getElementById('totalQuestions'),
            summaryStatus: document.getElementById('summaryStatus'),
            settingsModal: document.getElementById('settingsModal'),
            languageSelect: document.getElementById('languageSelect'),
            sensitivityRange: document.getElementById('sensitivityRange'),
            sensitivityValue: document.getElementById('sensitivityValue'),
            soundAlert: document.getElementById('soundAlert'),
            geminiApiKey: document.getElementById('geminiApiKey'),
            toggleApiKeyVisibility: document.getElementById('toggleApiKeyVisibility'),
            autoAnswer: document.getElementById('autoAnswer'),
            apiStatus: document.getElementById('apiStatus'),
            meetingContext: document.getElementById('meetingContext'),
            priorityTerms: document.getElementById('priorityTerms'),
            contextStatus: document.getElementById('contextStatus'),
            enableAutoSummary: document.getElementById('enableAutoSummary'),
            enableSpeakerDetection: document.getElementById('enableSpeakerDetection'),
            toastContainer: document.getElementById('toastContainer')
        };
    }

    init() {
        this.setupEventListeners();
        this.setupSpeechCallbacks();
        this.setupAICallbacks();
        this.setupGeminiCallbacks();
        this.setupAudioRecorderCallbacks();
        this.setupSpeakerDetectorCallbacks();
        this.loadSettings();
        this.updateApiStatusUI();
        this.updateContextStatusUI();
        console.log('[VORA] v5.2 Web Standard Edition Ready');
    }

    setupEventListeners() {
        const el = this.elements;
        if (el.startBtn) el.startBtn.addEventListener('click', () => this.startRecording());
        if (el.stopBtn) el.stopBtn.addEventListener('click', () => this.stopRecording());
        if (el.pauseBtn) el.pauseBtn.addEventListener('click', () => this.togglePause());
        if (el.clearBtn) el.clearBtn.addEventListener('click', () => this.clearAll());
        if (el.exportBtn) el.exportBtn.addEventListener('click', () => this.showExportMenu());
        if (el.exportAudioBtn) el.exportAudioBtn.addEventListener('click', () => this.exportAudio());
        if (el.setPrimarySpeakerBtn) el.setPrimarySpeakerBtn.addEventListener('click', () => this.setPrimarySpeaker());
        if (el.settingsBtn) el.settingsBtn.addEventListener('click', () => this.openSettings());
        if (el.closeModal) el.closeModal.addEventListener('click', () => this.closeSettings());
        if (el.toggleApiKeyVisibility) el.toggleApiKeyVisibility.addEventListener('click', () => this.toggleApiKeyVisibility());

        // AI 채팅 리스너
        if (el.chatSendBtn) el.chatSendBtn.addEventListener('click', () => this.handleChatSubmit());
        if (el.chatInput) el.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleChatSubmit();
        });

        // 설정 변경 리스너
        if (el.languageSelect) el.languageSelect.addEventListener('change', (e) => {
            this.state.language = e.target.value;
            this.speechManager.setLanguage(this.state.language);
            this.saveSettings();
        });
        if (el.geminiApiKey) el.geminiApiKey.addEventListener('change', () => {
            this.geminiAPI.setApiKey(el.geminiApiKey.value.trim());
            this.saveSettings();
            this.updateApiStatusUI();
        });
    }

    setupSpeechCallbacks() {
        this.speechManager.onResult((res) => this.handleSpeechResult(res));
        this.speechManager.onStatusChange((status) => this.updateRecordingStatus(status));
        this.speechManager.onError((code, msg) => this.showToast(msg, 'error'));
    }

    setupAICallbacks() { this.aiEngine.onQuestionDetected = (q) => this.handleQuestionDetected(q); }
    setupGeminiCallbacks() { this.geminiAPI.onSummaryGenerated = (s) => this.updateMeetingSummary(s); }
    setupAudioRecorderCallbacks() { this.audioRecorder.onError = (c, m) => this.showToast(m, 'error'); }
    setupSpeakerDetectorCallbacks() { this.speakerDetector.onSpeakerChange = (i) => this.updateSpeakerIndicator(i.current); }

    async startRecording() {
        if (this.state.isRecording) return;
        try {
            const ok = this.speechManager.start();
            if (!ok) throw new Error('음성 인식을 시작할 수 없습니다.');
            
            await this.audioRecorder.start();
            if (this.audioRecorder.stream) {
                // SpeakerDetector 초기화 (비활성화 상태여도 시각화를 위해 analyser는 필요)
                this.speakerDetector.initializeAnalyser(this.audioRecorder.stream);
                this.startVisualizer();
            }

            this.state.isRecording = true;
            this.state.startTime = Date.now();
            this.startTimer();
            this.updateButtonStates('recording');
            this.sendLog('녹음 시작', 'success');
            if (this.state.enableAutoSummary && this.geminiAPI.isConfigured) this.startAutoSummaryTimer();
        } catch (e) {
            this.showToast(e.message, 'error');
        }
    }

    stopRecording() {
        if (!this.state.isRecording) return;
        this.speechManager.stop();
        this.audioRecorder.stop();
        this.stopTimer();
        this.stopAutoSummaryTimer();
        this.stopVisualizer();
        this.state.isRecording = false;
        this.updateButtonStates('idle');
        this.updateRecordingStatus('stopped');
        this.sendLog('녹음 중지', 'info');

        // 음성 내보내기 버튼 활성화
        if (this.elements.exportAudioBtn) {
            this.elements.exportAudioBtn.disabled = false;
        }

        if (this.data.fullTranscript.length > 0) this.generateFinalSummary();
    }

    exportAudio() {
        const success = this.audioRecorder.downloadRecording(`VORA_Meeting`);
        if (success) {
            this.showToast('음성 파일 다운로드를 시작합니다.', 'success');
        } else {
            this.showToast('다운로드할 녹음 데이터가 없습니다.', 'error');
        }
    }

    startVisualizer() {
        this.stopVisualizer();
        const bars = this.elements.voiceVisualizer?.querySelectorAll('.visualizer-bars span');
        if (!bars || bars.length === 0) return;

        // 주파수 데이터를 담을 배열 (바 개수만큼)
        const bufferLength = this.speakerDetector.analyser?.frequencyBinCount || 1024;
        const dataArray = new Uint8Array(bufferLength);

        const animate = () => {
            if (!this.state.isRecording || this.state.isPaused) return;

            if (this.speakerDetector.analyser) {
                this.speakerDetector.analyser.getByteFrequencyData(dataArray);
                
                // 바 개수에 맞춰 주파수 영역을 나눔
                const step = Math.floor(dataArray.length / 2 / bars.length);
                
                bars.forEach((bar, i) => {
                    // 저주파 영역 위주로 시각화 (인간의 목소리가 주로 분포하는 영역)
                    const index = i * step;
                    const value = dataArray[index];
                    
                    // 감도 조절 (0~255 값을 4~32px로 변환)
                    const scale = Math.min(Math.max((value / 255) * 40, 4), 32); 
                    
                    // 약간의 랜덤성을 더해 생동감 부여
                    const individualScale = scale * (0.9 + Math.random() * 0.2);
                    bar.style.height = `${individualScale}px`;
                });
            }
            this.state.visualizerFrame = requestAnimationFrame(animate);
        };
        this.state.visualizerFrame = requestAnimationFrame(animate);
    }

    stopVisualizer() {
        if (this.state.visualizerFrame) {
            cancelAnimationFrame(this.state.visualizerFrame);
            this.state.visualizerFrame = null;
        }
        // 바 높이 초기화
        const bars = this.elements.voiceVisualizer?.querySelectorAll('.visualizer-bars span');
        if (bars) bars.forEach(bar => bar.style.height = '4px');
    }

    togglePause() {
        if (!this.state.isRecording) return;
        if (this.state.isPaused) {
            this.speechManager.start();
            this.audioRecorder.resume();
            this.state.isPaused = false;
            this.updateButtonStates('recording');
        } else {
            this.speechManager.stop();
            this.audioRecorder.pause();
            this.state.isPaused = true;
            this.updateButtonStates('paused');
        }
    }

    async handleSpeechResult(result) {
        if (!result.isFinal) {
            this.updateCurrentSpeech(result.text);
            return;
        }

        const processed = this.speakerDetector.processUtterance(result.text);
        const finalRes = { 
            text: result.text, 
            speaker: processed.speaker, 
            timestamp: new Date() 
        };

        this.data.fullTranscript.push(finalRes);
        this.addTranscriptToHistory(finalRes);
        this.updateCurrentSpeech('');
        this.updateStats();
        this.meetingExporter.addTranscript(finalRes);
        
        const langCode = this.state.language?.split('-')[0] || 'ko';
        this.aiEngine.analyzeText(result.text, langCode);
    }

    updateCurrentSpeech(t) { 
        if (this.elements.currentSpeech) 
            this.elements.currentSpeech.innerHTML = t ? `<div class="speech-content"><span>${this.escapeHtml(t)}</span><span class="speech-indicator">...</span></div>` : ''; 
    }

    addTranscriptToHistory(res) {
        const hist = this.elements.transcriptHistory;
        if (!hist) return;
        const item = document.createElement('div');
        const sClass = res.speaker?.isPrimary ? 'primary' : 'secondary';
        item.className = `transcript-item ${sClass}`;
        item.innerHTML = `
            <div class="transcript-speaker ${sClass}"><span>${res.speaker?.isPrimary ? '👤' : '👥'}</span></div>
            <div class="transcript-content"><p>${this.escapeHtml(res.text)}</p></div>
        `;
        hist.appendChild(item);
        this.scrollToBottom(hist);
    }

    async handleQuestionDetected(q) {
        this.data.questions.push({ text: q, timestamp: new Date() });
        this.updateQuestionsList(q);
        this.updateStats();
        if (this.state.autoAnswer && this.geminiAPI.isConfigured) {
            const res = await this.geminiAPI.generateAnswer(q, this.data.fullTranscript.slice(-5).map(t => t.text).join('\n'));
            if (res) {
                const ans = { question: q, answer: res.answer, timestamp: new Date() };
                this.data.aiAnswers.push(ans);
                this.updateAIAnswersList(ans);
            }
        }
    }

    updateQuestionsList(q) {
        const item = document.createElement('div'); item.className = 'question-item';
        item.innerHTML = `<span>❓</span><p>${this.escapeHtml(q)}</p>`;
        this.elements.questionsList?.appendChild(item);
    }

    updateAIAnswersList(a) {
        const item = document.createElement('div'); item.className = 'ai-answer-item';
        item.innerHTML = `<div>Q. ${this.escapeHtml(a.question)}</div><div>A. ${this.escapeHtml(a.answer)}</div>`;
        this.elements.aiAnswersList?.appendChild(item);
    }

    updateMeetingSummary(s) {
        if (this.elements.meetingSummary) this.elements.meetingSummary.innerHTML = `<p>${this.escapeHtml(s)}</p>`;
    }

    async generateFinalSummary() {
        const text = this.data.fullTranscript.map(t => t.text).join(' ');
        if (text.length > 50) await this.geminiAPI.generateMeetingSummary(text);
    }

    updateSpeakerIndicator(type) {
        const el = this.elements.speakerIndicator;
        if (el) el.className = `speaker-indicator ${type}`;
    }

    setPrimarySpeaker() { this.speakerDetector.setPrimarySpeaker(); this.showToast('발표자 설정됨', 'success'); }

    updateStats() {
        if (this.elements.totalSentences) this.elements.totalSentences.textContent = this.data.fullTranscript.length;
        if (this.elements.totalQuestions) this.elements.totalQuestions.textContent = this.data.questions.length;
    }

    startTimer() { this.stopTimer(); this.state.timerInterval = setInterval(() => this.updateTimerDisplay(), 1000); }
    stopTimer() { clearInterval(this.state.timerInterval); }
    updateTimerDisplay() {
        const elapsed = Date.now() - this.state.startTime;
        const s = Math.floor(elapsed / 1000);
        this.elements.timer.textContent = new Date(s * 1000).toISOString().substr(11, 8);
    }

    startAutoSummaryTimer() {
        this.state.autoSummaryTimer = setInterval(async () => {
            if (this.data.fullTranscript.length > 5) {
                const text = this.data.fullTranscript.slice(-10).map(t => t.text).join('\n');
                await this.geminiAPI.generateMeetingSummary(text);
            }
        }, 60000);
    }
    stopAutoSummaryTimer() { clearInterval(this.state.autoSummaryTimer); }

    updateRecordingStatus(s) {
        const el = this.elements.statusIndicator;
        if (!el) return;

        // active 상태 정의 (녹음 중임을 나타내는 모든 상태)
        const isActive = ['listening', 'sound-detected', 'sound-ended', 'recording'].includes(s);
        
        el.className = `status-indicator ${isActive ? 'recording' : s}`;
        
        const statusText = el.querySelector('.status-text');
        if (statusText) {
            statusText.textContent = isActive ? '녹음 중' : (s === 'paused' ? '일시정지' : '대기 중');
        }

        // 시각화 애니메이션 동기화
        if (this.elements.voiceVisualizer) {
            if (isActive) {
                this.elements.voiceVisualizer.classList.add('active');
            } else {
                this.elements.voiceVisualizer.classList.remove('active');
            }
        }
    }

    updateButtonStates(s) {
        const { startBtn, stopBtn, pauseBtn } = this.elements;
        startBtn.disabled = s === 'recording';
        stopBtn.disabled = s === 'idle';
        pauseBtn.disabled = s === 'idle';
    }

    openSettings() { this.elements.settingsModal?.classList.add('active'); }
    closeSettings() { this.elements.settingsModal?.classList.remove('active'); }
    toggleApiKeyVisibility() {
        const input = this.elements.geminiApiKey;
        input.type = input.type === 'password' ? 'text' : 'password';
    }

    saveSettings() {
        const s = { language: this.state.language, apiKey: this.elements.geminiApiKey?.value || '' };
        localStorage.setItem('meetingAssistantSettings', JSON.stringify(s));
    }

    loadSettings() {
        const saved = JSON.parse(localStorage.getItem('meetingAssistantSettings') || '{}');
        this.state.language = saved.language || 'ko-KR';
        if (this.elements.geminiApiKey) this.elements.geminiApiKey.value = saved.apiKey || '';
        this.geminiAPI.setApiKey(saved.apiKey || '');
    }

    showToast(m, t = 'info') {
        const toast = document.createElement('div'); toast.className = `toast toast-${t}`; toast.textContent = m;
        this.elements.toastContainer?.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3000);
    }

    escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
    scrollToBottom(el) { if (el) el.scrollTop = el.scrollHeight; }

    async handleChatSubmit() {
        const input = this.elements.chatInput;
        const text = input.value.trim();
        if (!text) return;

        if (!this.geminiAPI.isConfigured) {
            this.showToast('API 키를 먼저 설정해 주세요.', 'warning');
            this.openSettings();
            return;
        }

        // 사용자 메시지 추가
        this.addChatMessage('user', text);
        input.value = '';

        try {
            // 회의 컨텍스트 포함하여 질문
            const context = this.data.fullTranscript.slice(-20).map(t => t.text).join('\n');
            const response = await this.geminiAPI.generateAnswer(text, context);
            
            if (response && response.answer) {
                this.addChatMessage('ai', response.answer);
            } else {
                this.addChatMessage('ai', '죄송합니다. 답변을 생성하지 못했습니다.');
            }
        } catch (e) {
            this.addChatMessage('ai', `오류 발생: ${e.message}`);
        }
    }

    addChatMessage(role, text) {
        const chatHist = this.elements.chatHistory;
        if (!chatHist) return;

        // 첫 메시지 시 비어있는 상태 제거
        if (chatHist.querySelector('.empty-state')) {
            chatHist.innerHTML = '';
        }

        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message ${role}`;
        msgDiv.innerHTML = `<p>${this.escapeHtml(text)}</p>`;
        chatHist.appendChild(msgDiv);
        this.scrollToBottom(chatHist);
    }
}

document.addEventListener('DOMContentLoaded', () => { window.app = new EnhancedMeetingApp(); });