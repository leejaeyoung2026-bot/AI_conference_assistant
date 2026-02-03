/**
 * Speaker Detection Module v1.0
 * 발화자 감지 및 구분 시스템
 * 
 * 주요 기능:
 * 1. 주발표자 자동 설정
 * 2. 발화자 변경 감지
 * 3. 음성 특성 프로파일링
 * 4. 질문/코멘트 자동 분류
 */

class SpeakerDetector {
    constructor(options = {}) {
        // 설정
        this.config = {
            silenceThreshold: options.silenceThreshold || 2000, // 2초 무음 시 발화자 변경 가능
            volumeChangeThreshold: options.volumeChangeThreshold || 0.15, // 볼륨 변화 임계값
            pitchChangeThreshold: options.pitchChangeThreshold || 50, // 피치 변화 임계값 (Hz)
            autoDetect: options.autoDetect !== false,
            primarySpeakerLockTime: options.primarySpeakerLockTime || 30000 // 30초 동안 주발표자 고정
        };

        // 발화자 정보
        this.speakers = {
            primary: {
                id: null,
                profile: null,
                totalSpeakingTime: 0,
                utteranceCount: 0,
                lastActiveTime: 0
            },
            secondary: []
        };

        // 현재 상태
        this.currentSpeaker = null;
        this.lastSpeakerChangeTime = 0;
        this.isAnalyzing = false;
        this.primaryLocked = false;
        this.primaryLockTimeout = null;

        // 오디오 분석
        this.audioContext = null;
        this.analyser = null;
        this.frequencyData = null;
        this.volumeHistory = [];
        this.pitchHistory = [];

        // 콜백
        this.onSpeakerChange = null;
        this.onPrimarySpeakerSet = null;

        // 발화 패턴 (질문/코멘트 감지용)
        this.questionPatterns = {
            ko: [
                /\?$/,
                /(입니까|습니까|나요|까요|ㄹ까요|을까요|는지|은지|인지|건지|죠|지요|가요|세요)\s*$/,
                /^(누가|뭐|뭘|무엇|무슨|어디|어느|언제|왜|어떻게|어떤|얼마|몇)/
            ],
            en: [
                /\?$/,
                /^(who|what|where|when|why|how|which|whose|whom|do|does|did|is|are|was|were|can|could|would|will|should)/i
            ]
        };

        this.commentPatterns = {
            ko: [
                /^(네|예|아|음|글쎄|그렇군요|알겠습니다)/,
                /(생각합니다|것 같습니다|제안합니다|좋을 것 같습니다)/,
                /^(추가로|참고로|그리고|또한|그런데)/
            ],
            en: [
                /^(yes|yeah|okay|ok|right|i see|i think|well)/i,
                /^(additionally|also|furthermore|by the way)/i
            ]
        };
    }

    /**
     * 오디오 분석기 초기화
     */
    initializeAnalyser(stream) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;

            const source = this.audioContext.createMediaStreamSource(stream);
            source.connect(this.analyser);

            this.frequencyData = new Float32Array(this.analyser.frequencyBinCount);
            
            console.log('[SpeakerDetector] 오디오 분석기 초기화 완료');
            return true;
        } catch (error) {
            console.error('[SpeakerDetector] 오디오 분석기 초기화 실패:', error);
            return false;
        }
    }

    /**
     * 주 발화자 설정
     */
    setPrimarySpeaker(speakerId = null) {
        const id = speakerId || `primary_${Date.now()}`;
        
        this.speakers.primary = {
            id: id,
            profile: this.createSpeakerProfile(),
            totalSpeakingTime: 0,
            utteranceCount: 0,
            lastActiveTime: Date.now()
        };

        this.currentSpeaker = 'primary';
        this.primaryLocked = true;

        // 일정 시간 후 잠금 해제
        if (this.primaryLockTimeout) {
            clearTimeout(this.primaryLockTimeout);
        }
        this.primaryLockTimeout = setTimeout(() => {
            this.primaryLocked = false;
            console.log('[SpeakerDetector] 주발표자 잠금 해제');
        }, this.config.primarySpeakerLockTime);

        if (this.onPrimarySpeakerSet) {
            this.onPrimarySpeakerSet(this.speakers.primary);
        }

        console.log('[SpeakerDetector] 주발표자 설정:', id);
        return id;
    }

    /**
     * 발화자 프로파일 생성
     */
    createSpeakerProfile() {
        return {
            avgVolume: 0,
            avgPitch: 0,
            volumeSamples: [],
            pitchSamples: [],
            speakingRate: 0 // 초당 음절 수 (추정)
        };
    }

    /**
     * 오디오 분석 및 발화자 감지
     */
    analyzeAudio() {
        if (!this.analyser || !this.frequencyData) return null;

        this.analyser.getFloatFrequencyData(this.frequencyData);

        // 볼륨 계산 (RMS)
        let sum = 0;
        for (let i = 0; i < this.frequencyData.length; i++) {
            const value = Math.pow(10, this.frequencyData[i] / 20); // dB to linear
            sum += value * value;
        }
        const volume = Math.sqrt(sum / this.frequencyData.length);

        // 기본 피치 추정 (간단한 자기상관 방식)
        const pitch = this.estimatePitch();

        // 히스토리 업데이트
        this.volumeHistory.push({ time: Date.now(), value: volume });
        if (pitch > 0) {
            this.pitchHistory.push({ time: Date.now(), value: pitch });
        }

        // 최근 1초 데이터만 유지
        const now = Date.now();
        this.volumeHistory = this.volumeHistory.filter(v => now - v.time < 1000);
        this.pitchHistory = this.pitchHistory.filter(p => now - p.time < 1000);

        return { volume, pitch };
    }

    /**
     * 피치 추정 (간단한 방식)
     */
    estimatePitch() {
        if (!this.frequencyData) return 0;

        // 주파수 빈에서 가장 강한 주파수 찾기 (85-400Hz 범위 - 음성 기본 주파수)
        const sampleRate = this.audioContext?.sampleRate || 44100;
        const binSize = sampleRate / this.analyser.fftSize;
        
        const minBin = Math.floor(85 / binSize);
        const maxBin = Math.floor(400 / binSize);

        let maxValue = -Infinity;
        let maxBinIndex = minBin;

        for (let i = minBin; i < maxBin && i < this.frequencyData.length; i++) {
            if (this.frequencyData[i] > maxValue) {
                maxValue = this.frequencyData[i];
                maxBinIndex = i;
            }
        }

        // 임계값 이하면 무음으로 판단
        if (maxValue < -50) return 0;

        return maxBinIndex * binSize;
    }

    /**
     * 발화자 변경 감지
     */
    detectSpeakerChange(audioFeatures) {
        if (!this.config.autoDetect || !audioFeatures) return false;
        if (this.primaryLocked) return false;

        const now = Date.now();
        const timeSinceLastChange = now - this.lastSpeakerChangeTime;

        // 최소 변경 간격 확인
        if (timeSinceLastChange < 1000) return false;

        // 현재 발화자 프로파일
        const currentProfile = this.currentSpeaker === 'primary' 
            ? this.speakers.primary.profile 
            : this.speakers.secondary[0]?.profile;

        if (!currentProfile || currentProfile.volumeSamples.length < 10) {
            // 프로파일 데이터 부족 - 현재 데이터로 업데이트
            if (currentProfile) {
                currentProfile.volumeSamples.push(audioFeatures.volume);
                if (audioFeatures.pitch > 0) {
                    currentProfile.pitchSamples.push(audioFeatures.pitch);
                }
            }
            return false;
        }

        // 평균 계산
        const avgVolume = currentProfile.volumeSamples.reduce((a, b) => a + b, 0) / currentProfile.volumeSamples.length;
        const avgPitch = currentProfile.pitchSamples.length > 0 
            ? currentProfile.pitchSamples.reduce((a, b) => a + b, 0) / currentProfile.pitchSamples.length 
            : 0;

        // 변화량 계산
        const volumeChange = Math.abs(audioFeatures.volume - avgVolume) / Math.max(avgVolume, 0.001);
        const pitchChange = avgPitch > 0 ? Math.abs(audioFeatures.pitch - avgPitch) : 0;

        // 발화자 변경 조건 확인
        const volumeChanged = volumeChange > this.config.volumeChangeThreshold;
        const pitchChanged = pitchChange > this.config.pitchChangeThreshold;

        // 무음 확인
        const recentVolumes = this.volumeHistory.slice(-10);
        const avgRecentVolume = recentVolumes.length > 0 
            ? recentVolumes.reduce((a, b) => a + b.value, 0) / recentVolumes.length 
            : 0;
        const wasSilent = avgRecentVolume < 0.01;

        // 발화자 변경 판단
        if ((volumeChanged || pitchChanged) && wasSilent) {
            return true;
        }

        // 프로파일 업데이트 (이동 평균)
        currentProfile.volumeSamples.push(audioFeatures.volume);
        if (audioFeatures.pitch > 0) {
            currentProfile.pitchSamples.push(audioFeatures.pitch);
        }

        // 최근 50개 샘플만 유지
        if (currentProfile.volumeSamples.length > 50) {
            currentProfile.volumeSamples.shift();
        }
        if (currentProfile.pitchSamples.length > 50) {
            currentProfile.pitchSamples.shift();
        }

        return false;
    }

    /**
     * 발화자 전환
     */
    switchSpeaker(newSpeakerType = null) {
        const previousSpeaker = this.currentSpeaker;
        
        if (newSpeakerType) {
            this.currentSpeaker = newSpeakerType;
        } else {
            // 자동 전환
            this.currentSpeaker = this.currentSpeaker === 'primary' ? 'secondary' : 'primary';
        }

        this.lastSpeakerChangeTime = Date.now();

        // secondary 발화자가 없으면 생성
        if (this.currentSpeaker === 'secondary' && this.speakers.secondary.length === 0) {
            this.speakers.secondary.push({
                id: `secondary_${Date.now()}`,
                profile: this.createSpeakerProfile(),
                totalSpeakingTime: 0,
                utteranceCount: 0,
                lastActiveTime: Date.now()
            });
        }

        console.log(`[SpeakerDetector] 발화자 변경: ${previousSpeaker} → ${this.currentSpeaker}`);

        if (this.onSpeakerChange) {
            this.onSpeakerChange({
                previous: previousSpeaker,
                current: this.currentSpeaker,
                timestamp: Date.now()
            });
        }

        return this.currentSpeaker;
    }

    /**
     * 텍스트 분석하여 질문/코멘트 판별
     */
    classifyUtterance(text, language = 'ko') {
        if (!text || typeof text !== 'string') return { type: 'statement', confidence: 0 };

        const trimmedText = text.trim();
        const patterns = {
            question: this.questionPatterns[language] || this.questionPatterns['ko'],
            comment: this.commentPatterns[language] || this.commentPatterns['ko']
        };

        // 질문 패턴 확인
        for (const pattern of patterns.question) {
            if (pattern.test(trimmedText)) {
                return { type: 'question', confidence: 0.9, pattern: pattern.toString() };
            }
        }

        // 코멘트 패턴 확인
        for (const pattern of patterns.comment) {
            if (pattern.test(trimmedText)) {
                return { type: 'comment', confidence: 0.8, pattern: pattern.toString() };
            }
        }

        // 주 발화자가 아닌 경우 기본적으로 코멘트로 분류
        if (this.currentSpeaker !== 'primary') {
            return { type: 'comment', confidence: 0.5 };
        }

        return { type: 'statement', confidence: 0.7 };
    }

    /**
     * 발언 처리
     */
    processUtterance(text, audioFeatures = null) {
        const now = Date.now();
        
        // 오디오 기반 발화자 변경 감지
        if (audioFeatures) {
            const shouldSwitch = this.detectSpeakerChange(audioFeatures);
            if (shouldSwitch) {
                this.switchSpeaker();
            }
        }

        // 발언 분류
        const classification = this.classifyUtterance(text);

        // 현재 발화자 정보 업데이트
        const speakerInfo = this.currentSpeaker === 'primary' 
            ? this.speakers.primary 
            : this.speakers.secondary[0];

        if (speakerInfo) {
            speakerInfo.utteranceCount++;
            speakerInfo.lastActiveTime = now;
        }

        // 결과 반환
        return {
            text: text,
            speaker: {
                type: this.currentSpeaker,
                isPrimary: this.currentSpeaker === 'primary',
                id: speakerInfo?.id
            },
            classification: classification,
            timestamp: now
        };
    }

    /**
     * 현재 발화자 가져오기
     */
    getCurrentSpeaker() {
        return {
            type: this.currentSpeaker,
            isPrimary: this.currentSpeaker === 'primary',
            info: this.currentSpeaker === 'primary' 
                ? this.speakers.primary 
                : this.speakers.secondary[0]
        };
    }

    /**
     * 통계 가져오기
     */
    getStats() {
        const totalPrimaryTime = this.speakers.primary.totalSpeakingTime;
        const totalSecondaryTime = this.speakers.secondary.reduce((sum, s) => sum + s.totalSpeakingTime, 0);
        const totalTime = totalPrimaryTime + totalSecondaryTime;

        return {
            primarySpeaker: {
                ...this.speakers.primary,
                percentage: totalTime > 0 ? (totalPrimaryTime / totalTime * 100).toFixed(1) : 100
            },
            secondarySpeakers: this.speakers.secondary.map(s => ({
                ...s,
                percentage: totalTime > 0 ? (s.totalSpeakingTime / totalTime * 100).toFixed(1) : 0
            })),
            speakerChangeCount: this.speakers.secondary.length > 0 
                ? this.speakers.primary.utteranceCount + this.speakers.secondary.reduce((sum, s) => sum + s.utteranceCount, 0) 
                : 0
        };
    }

    /**
     * 초기화
     */
    reset() {
        this.speakers = {
            primary: {
                id: null,
                profile: null,
                totalSpeakingTime: 0,
                utteranceCount: 0,
                lastActiveTime: 0
            },
            secondary: []
        };
        this.currentSpeaker = null;
        this.lastSpeakerChangeTime = 0;
        this.primaryLocked = false;
        this.volumeHistory = [];
        this.pitchHistory = [];

        if (this.primaryLockTimeout) {
            clearTimeout(this.primaryLockTimeout);
            this.primaryLockTimeout = null;
        }
    }

    /**
     * 리소스 정리
     */
    destroy() {
        this.reset();
        
        if (this.audioContext) {
            this.audioContext.close();
            this.audioContext = null;
        }
        
        this.analyser = null;
        this.frequencyData = null;
    }
}

// 전역으로 내보내기
window.SpeakerDetector = SpeakerDetector;
