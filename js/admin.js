/**
 * System Admin Dashboard Logic v1.0
 * 실시간 프로세스 모니터링 및 상태 업데이트
 */

class AdminDashboard {
    constructor() {
        this.elements = {
            sttStatus: document.getElementById('sttStatus'),
            sttEndpoint: document.getElementById('sttEndpoint'),
            apiQueue: document.getElementById('apiQueue'),
            apiStatus: document.getElementById('apiStatus'),
            sessionMemory: document.getElementById('sessionMemory'),
            transcriptCount: document.getElementById('transcriptCount'),
            logPanel: document.getElementById('logPanel'),
            recordingStatus: document.getElementById('recordingStatus'),
            remoteStartBtn: document.getElementById('remoteStartBtn'),
            remoteStopBtn: document.getElementById('remoteStopBtn')
        };

        // BroadcastChannel을 통한 앱 상태 수신 (동일 도메인 탭 간 통신)
        this.channel = new BroadcastChannel('app_status_channel');
        
        this.init();
    }

    init() {
        this.setupChannelListeners();
        this.setupControlListeners();
        this.loadInitialState();
        this.addLog('관리자 모니터링 시스템 활성화됨.', 'success');
        
        // 주기적인 자체 상태 체크 (서버 등)
        setInterval(() => this.checkSystemHealth(), 5000);
    }

    setupControlListeners() {
        if (this.elements.remoteStartBtn) {
            this.elements.remoteStartBtn.addEventListener('click', () => {
                this.channel.postMessage({ type: 'REMOTE_START' });
                this.addLog('원격 녹음 시작 명령 전송', 'warning');
            });
        }

        if (this.elements.remoteStopBtn) {
            this.elements.remoteStopBtn.addEventListener('click', () => {
                this.channel.postMessage({ type: 'REMOTE_STOP' });
                this.addLog('원격 녹음 중지 명령 전송', 'error');
            });
        }
    }

    setupChannelListeners() {
        this.channel.onmessage = (event) => {
            const { type, data } = event.data;
            
            switch(type) {
                case 'HEARTBEAT':
                    this.updateStats(data);
                    this.updateRecordingUI(data.isRecording);
                    break;
                case 'LOG':
                    this.addLog(data.message, data.level);
                    break;
                case 'STT_UPDATE':
                    this.updateSTT(data);
                    break;
            }
        };
    }

    updateRecordingUI(isRecording) {
        if (this.elements.recordingStatus) {
            this.elements.recordingStatus.textContent = `상태: ${isRecording ? '녹음 중...' : '대기 중'}`;
            this.elements.recordingStatus.style.color = isRecording ? '#10b981' : '#8892b0';
        }
        
        if (this.elements.remoteStartBtn) this.elements.remoteStartBtn.disabled = isRecording;
        if (this.elements.remoteStopBtn) this.elements.remoteStopBtn.disabled = !isRecording;
    }

    loadInitialState() {
        const settings = JSON.parse(localStorage.getItem('meetingAssistantSettings') || '{}');
        if (settings.serverUrl) {
            this.elements.sttEndpoint.textContent = `URL: ${settings.serverUrl}`;
        }
    }

    updateStats(data) {
        if (this.elements.apiQueue) this.elements.apiQueue.textContent = data.queueLength || 0;
        if (this.elements.transcriptCount) this.elements.transcriptCount.textContent = data.transcriptCount || 0;
        
        // 가상 메모리 계산 (텍스트 데이터 크기 기반)
        const memory = (JSON.stringify(data).length / 1024).toFixed(2);
        if (this.elements.sessionMemory) this.elements.sessionMemory.textContent = `${memory} KB`;

        const apiBadge = this.elements.apiStatus;
        if (apiBadge) {
            apiBadge.textContent = data.isProcessing ? 'PROCESSING' : 'IDLE';
            apiBadge.className = `status-badge ${data.isProcessing ? 'status-online' : 'status-offline'}`;
        }
    }

    updateSTT(data) {
        const el = this.elements.sttStatus;
        if (el) {
            el.textContent = data.connected ? 'CONNECTED' : 'DISCONNECTED';
            el.style.color = data.connected ? '#00f2fe' : '#ff4b2b';
        }
    }

    async checkSystemHealth() {
        const settings = JSON.parse(localStorage.getItem('meetingAssistantSettings') || '{}');
        const url = settings.serverUrl || 'http://localhost:8000';
        
        try {
            const start = Date.now();
            const res = await fetch(`${url}/health`, { mode: 'cors' });
            const end = Date.now();
            
            if (res.ok) {
                this.updateSTT({ connected: true });
                // this.addLog(`STT 서버 응답 정상 (${end - start}ms)`, 'info');
            } else {
                this.updateSTT({ connected: false });
            }
        } catch (e) {
            this.updateSTT({ connected: false });
        }
    }

    addLog(message, level = 'info') {
        const entry = document.createElement('div');
        const time = new Date().toLocaleTimeString('ko-KR', { hour12: false });
        
        entry.className = `log-entry log-${level}`;
        entry.innerHTML = `<span class="log-time">[${time}]</span> ${message}`;
        
        this.elements.logPanel.appendChild(entry);
        this.elements.logPanel.scrollTop = this.elements.logPanel.scrollHeight;

        // 로그 개수 제한
        if (this.elements.logPanel.childNodes.length > 100) {
            this.elements.logPanel.removeChild(this.elements.logPanel.firstChild);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.admin = new AdminDashboard();
});
