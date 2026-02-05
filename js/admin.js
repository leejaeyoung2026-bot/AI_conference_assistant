/**
 * System Admin Dashboard Logic v1.1 (Web Standard)
 */

class AdminDashboard {
    constructor() {
        this.elements = {
            apiQueue: document.getElementById('apiQueue'),
            apiStatus: document.getElementById('apiStatus'),
            logPanel: document.getElementById('logPanel'),
            recordingStatus: document.getElementById('recordingStatus'),
            remoteStartBtn: document.getElementById('remoteStartBtn'),
            remoteStopBtn: document.getElementById('remoteStopBtn')
        };

        this.channel = new BroadcastChannel('app_status_channel');
        this.init();
    }

    init() {
        this.setupChannelListeners();
        this.setupControlListeners();
        this.addLog('관리자 감시 시스템 활성화 (Web Standard Mode)', 'success');
    }

    setupControlListeners() {
        this.elements.remoteStartBtn?.addEventListener('click', () => {
            this.channel.postMessage({ type: 'REMOTE_START' });
            this.addLog('원격 녹음 시작 명령 전송', 'warning');
        });

        this.elements.remoteStopBtn?.addEventListener('click', () => {
            this.channel.postMessage({ type: 'REMOTE_STOP' });
            this.addLog('원격 녹음 중지 명령 전송', 'error');
        });
    }

    setupChannelListeners() {
        this.channel.onmessage = (event) => {
            const { type, data } = event.data;
            if (type === 'HEARTBEAT') {
                if (this.elements.apiQueue) this.elements.apiQueue.textContent = data.queueLength;
                if (this.elements.apiStatus) {
                    this.elements.apiStatus.textContent = data.isProcessing ? 'PROCESSING' : 'IDLE';
                    this.elements.apiStatus.className = `status-badge ${data.isProcessing ? 'status-online' : 'status-offline'}`;
                }
                this.updateRecordingUI(data.isRecording);
            } else if (type === 'LOG') {
                this.addLog(data.message, data.level);
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

    addLog(message, level = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${level}`;
        entry.innerHTML = `<span class="log-time">[${new Date().toLocaleTimeString()}]</span> ${message}`;
        this.elements.logPanel.appendChild(entry);
        this.elements.logPanel.scrollTop = this.elements.logPanel.scrollHeight;
    }
}

document.addEventListener('DOMContentLoaded', () => { new AdminDashboard(); });