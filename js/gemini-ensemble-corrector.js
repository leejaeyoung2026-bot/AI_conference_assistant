/**
 * Gemini Ensemble Corrector v1.0
 * 3대 STT 모델 결과를 Gemini가 통합 보정하는 시스템
 * 
 * 주요 기능:
 * 1. 다중 모델 결과 비교 및 투표
 * 2. 회의 컨텍스트 기반 보정
 * 3. LAI 전문 용어 정확도 향상
 * 4. 발화자별 텍스트 스타일 일관성
 */

class GeminiEnsembleCorrector {
    constructor(geminiAPI) {
        this.geminiAPI = geminiAPI;
        this.enabled = true;
        
        // 회의 컨텍스트 (일반화)
        this.meetingContext = {
            topic: '전문 회의',
            keywords: [
                // 일반 전문 용어
                'API', 'ROI', 'KPI', 'R&D', 'QA', 'QC',
                'in vitro', 'in vivo', 'ex vivo',
                // 분석 관련
                'HPLC', 'LC-MS', 'GC', 'NMR',
                // 과학 기초
                'pH', 'pKa', 'LogP', 'Cmax', 'Tmax', 'AUC', 't1/2'
            ],
            summary: ''
        };

        // 사용자 우선 인식 용어
        this.priorityTerms = [];

        // 5번 과업: 다중 언어 설정
        this.languageContext = {
            primary: 'ko-KR',
            secondary: 'none'
        };

        // 최근 보정 이력 (컨텍스트 유지용)
        this.correctionHistory = [];
        this.maxHistoryLength = 10;

        // 처리 큐
        this.processingQueue = [];
        this.isProcessing = false;

        // 발화자별 스타일 프로필
        this.speakerProfiles = {
            primary: {
                style: 'formal',
                vocabulary: new Set(),
                sentencePatterns: []
            },
            secondary: {
                style: 'question',
                vocabulary: new Set(),
                sentencePatterns: []
            }
        };

        // 통계
        this.stats = {
            totalCorrected: 0,
            agreementRate: 0,
            avgConfidence: 0
        };
    }

    /**
     * 컨텍스트 설정
     */
    setContext(context) {
        if (context.topic) this.meetingContext.topic = context.topic;
        if (context.keywords) this.meetingContext.keywords = context.keywords;
        if (context.summary) this.meetingContext.summary = context.summary;
    }

    /**
     * 우선 인식 용어 설정
     */
    setPriorityTerms(terms) {
        this.priorityTerms = Array.isArray(terms) ? terms : terms.split(',').map(t => t.trim());
    }

    /**
     * 5번 과업: 언어 컨텍스트 설정
     */
    setLanguageContext(langContext) {
        if (langContext.primary) this.languageContext.primary = langContext.primary;
        if (langContext.secondary !== undefined) this.languageContext.secondary = langContext.secondary;
        console.log('[GeminiEnsembleCorrector] 언어 컨텍스트 설정:', this.languageContext);
    }

    /**
     * 앙상블 결과 보정
     */
    async correctEnsembleResult(ensembleData) {
        if (!this.enabled || !this.geminiAPI?.isConfigured) {
            return this.selectBestCandidate(ensembleData);
        }

        // 큐에 추가
        return new Promise((resolve) => {
            this.processingQueue.push({
                data: ensembleData,
                resolve: resolve
            });
            this.processQueue();
        });
    }

    /**
     * 큐 처리
     */
    async processQueue() {
        if (this.isProcessing || this.processingQueue.length === 0) return;

        this.isProcessing = true;

        while (this.processingQueue.length > 0) {
            const item = this.processingQueue.shift();
            try {
                const result = await this.performCorrection(item.data);
                item.resolve(result);
            } catch (error) {
                console.error('[GeminiEnsembleCorrector] 보정 오류:', error);
                item.resolve(this.selectBestCandidate(item.data));
            }
        }

        this.isProcessing = false;
    }

    /**
     * 실제 보정 수행
     */
    async performCorrection(ensembleData) {
        const { models, speaker, events } = ensembleData;

        // 모델 결과 수집
        const modelResults = [];
        if (models.senseVoice?.text) modelResults.push({ model: 'SenseVoice', text: models.senseVoice.text, confidence: models.senseVoice.confidence || 0 });
        if (models.fasterWhisper?.text) modelResults.push({ model: 'Faster-Whisper', text: models.fasterWhisper.text, confidence: models.fasterWhisper.confidence || 0 });
        if (models.qwenASR?.text) modelResults.push({ model: 'Qwen3-ASR', text: models.qwenASR.text, confidence: models.qwenASR.confidence || 0 });

        // 결과가 없으면 반환
        if (modelResults.length === 0) {
            return { text: '', confidence: 0, speaker: speaker };
        }

        // 결과가 하나면 바로 반환
        if (modelResults.length === 1) {
            return {
                text: modelResults[0].text,
                confidence: modelResults[0].confidence,
                speaker: speaker,
                model: modelResults[0].model
            };
        }

        // 결과가 모두 동일하면 바로 반환
        const texts = modelResults.map(r => r.text);
        if (texts.every(t => t === texts[0])) {
            return {
                text: texts[0],
                confidence: 1.0,
                speaker: speaker,
                agreement: 'unanimous'
            };
        }

        // Gemini로 통합 보정
        const correctedText = await this.geminiEnsembleCorrect(modelResults, speaker, events);

        // 이력 업데이트
        this.updateHistory(correctedText, speaker);

        // 통계 업데이트
        this.updateStats(modelResults, correctedText);

        return {
            text: correctedText,
            confidence: this.calculateConfidence(modelResults, correctedText),
            speaker: speaker,
            originalResults: modelResults
        };
    }

    /**
     * Gemini를 통한 앙상블 보정
     */
    async geminiEnsembleCorrect(modelResults, speaker, events = []) {
        const prompt = this.buildCorrectionPrompt(modelResults, speaker, events);

        try {
            const response = await this.geminiAPI.generateContent(prompt);
            const corrected = this.parseGeminiResponse(response);
            return corrected || this.selectBestCandidate({ models: this.resultsToModels(modelResults) });
        } catch (error) {
            console.error('[GeminiEnsembleCorrector] Gemini API 오류:', error);
            return this.selectBestCandidate({ models: this.resultsToModels(modelResults) });
        }
    }

    /**
     * 보정 프롬프트 생성
     */
    buildCorrectionPrompt(modelResults, speaker, events) {
        const speakerInfo = speaker?.isPrimary ? '주발표자' : '질문자/참석자';
        const historyContext = this.correctionHistory.slice(-3).map(h => h.text).join(' | ');

        // 5번 과업: 언어 컨텍스트 포함
        const langNames = {
            'ko-KR': '한국어', 'en-US': '영어', 'ja-JP': '일본어',
            'zh-CN': '중국어', 'de-DE': '독일어', 'fr-FR': '프랑스어', 'es-ES': '스페인어'
        };
        const primaryLang = langNames[this.languageContext.primary] || '한국어';
        const secondaryLang = this.languageContext.secondary !== 'none' 
            ? langNames[this.languageContext.secondary] 
            : null;
        
        const languageInstruction = secondaryLang 
            ? `- 언어: ${primaryLang} (주), ${secondaryLang} (보조) - 두 언어가 혼용될 수 있으며, 각 언어의 전문 용어를 정확히 인식하세요`
            : `- 언어: ${primaryLang}`;

        return `당신은 전문 회의의 음성인식 보정 전문가입니다.

## 회의 컨텍스트
- 주제: ${this.meetingContext.topic}
- 발화자: ${speakerInfo}
${languageInstruction}
- 최근 대화: ${historyContext || '(없음)'}

## 필수 인식 키워드
${this.meetingContext.keywords.join(', ')}

## 사용자 지정 우선 인식 용어
${this.priorityTerms.length > 0 ? this.priorityTerms.join(', ') : '(없음)'}

## 3개 음성인식 모델 결과

${modelResults.map((r, i) => `### 모델 ${i + 1}: ${r.model} (신뢰도: ${(r.confidence * 100).toFixed(1)}%)
"${r.text}"`).join('\n\n')}

${events.length > 0 ? `## 감지된 이벤트\n${events.join(', ')}` : ''}

## 지시사항
1. 세 모델의 차이점을 분석하세요.
2. 회의 주제와 전문 용어 키워드에 가장 부합하는 논리적인 문장을 하나로 합성하세요.
3. 전문 용어의 정확한 표기에 주의하세요 (사용자 지정 우선 인식 용어 참고)
4. 수치 데이터는 반드시 보존하세요 (예: 3.5%, 18개, 30일).
5. ${speakerInfo}의 발화 스타일을 고려하세요.

## 출력 형식
최종 보정된 문장만 출력하세요. 설명은 필요 없습니다.

보정 결과:`;
    }

    /**
     * Gemini 응답 파싱
     */
    parseGeminiResponse(response) {
        if (!response) return null;

        // 응답에서 텍스트 추출
        let text = response;
        if (typeof response === 'object') {
            text = response.text || response.content || response;
        }

        // "보정 결과:" 이후의 텍스트 추출
        const match = text.match(/보정 결과:?\s*(.+)/s);
        if (match) {
            return match[1].trim();
        }

        // 첫 줄만 반환
        return text.split('\n')[0].trim();
    }

    /**
     * 최선의 후보 선택 (폴백)
     */
    selectBestCandidate(ensembleData) {
        const { models } = ensembleData;
        
        let bestCandidate = { text: '', confidence: 0, model: '' };

        // 신뢰도가 가장 높은 모델 선택
        if (models.fasterWhisper?.text) {
            const conf = models.fasterWhisper.confidence || 0.7;
            if (conf > bestCandidate.confidence) {
                bestCandidate = { text: models.fasterWhisper.text, confidence: conf, model: 'Faster-Whisper' };
            }
        }

        if (models.qwenASR?.text) {
            const conf = models.qwenASR.confidence || 0.65;
            if (conf > bestCandidate.confidence) {
                bestCandidate = { text: models.qwenASR.text, confidence: conf, model: 'Qwen3-ASR' };
            }
        }

        if (models.senseVoice?.text) {
            const conf = models.senseVoice.confidence || 0.6;
            if (conf > bestCandidate.confidence) {
                bestCandidate = { text: models.senseVoice.text, confidence: conf, model: 'SenseVoice' };
            }
        }

        return bestCandidate;
    }

    /**
     * 모델 결과 객체로 변환
     */
    resultsToModels(modelResults) {
        const models = {};
        for (const result of modelResults) {
            const key = result.model.toLowerCase().replace('-', '').replace(' ', '');
            if (key.includes('sensevoice')) models.senseVoice = result;
            else if (key.includes('whisper')) models.fasterWhisper = result;
            else if (key.includes('qwen')) models.qwenASR = result;
        }
        return models;
    }

    /**
     * 신뢰도 계산
     */
    calculateConfidence(modelResults, correctedText) {
        if (!correctedText || modelResults.length === 0) return 0;

        // 각 모델 결과와 보정 결과의 유사도 계산
        let totalSimilarity = 0;
        let totalWeight = 0;

        for (const result of modelResults) {
            const similarity = this.calculateTextSimilarity(result.text, correctedText);
            const weight = result.confidence || 0.5;
            totalSimilarity += similarity * weight;
            totalWeight += weight;
        }

        return totalWeight > 0 ? totalSimilarity / totalWeight : 0;
    }

    /**
     * 텍스트 유사도 계산 (간단한 Jaccard 유사도)
     */
    calculateTextSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;

        const words1 = new Set(text1.toLowerCase().split(/\s+/));
        const words2 = new Set(text2.toLowerCase().split(/\s+/));

        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);

        return union.size > 0 ? intersection.size / union.size : 0;
    }

    /**
     * 이력 업데이트
     */
    updateHistory(text, speaker) {
        this.correctionHistory.push({
            text: text,
            speaker: speaker,
            timestamp: Date.now()
        });

        if (this.correctionHistory.length > this.maxHistoryLength) {
            this.correctionHistory.shift();
        }

        // 발화자 프로필 업데이트
        if (speaker?.type) {
            const profile = this.speakerProfiles[speaker.type];
            if (profile) {
                const words = text.split(/\s+/);
                words.forEach(word => profile.vocabulary.add(word));
            }
        }
    }

    /**
     * 통계 업데이트
     */
    updateStats(modelResults, correctedText) {
        this.stats.totalCorrected++;

        // 일치율 계산
        const agreements = modelResults.filter(r => 
            this.calculateTextSimilarity(r.text, correctedText) > 0.8
        ).length;
        
        const currentAgreement = agreements / modelResults.length;
        this.stats.agreementRate = (this.stats.agreementRate * (this.stats.totalCorrected - 1) + currentAgreement) / this.stats.totalCorrected;

        // 평균 신뢰도
        const avgConf = modelResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / modelResults.length;
        this.stats.avgConfidence = (this.stats.avgConfidence * (this.stats.totalCorrected - 1) + avgConf) / this.stats.totalCorrected;
    }

    /**
     * 발화자가 질문/코멘트인지 판별
     */
    isQuestionOrComment(text, speaker) {
        if (speaker?.isPrimary) return false;

        // 질문 패턴
        const questionPatterns = [
            /\?$/,
            /(입니까|습니까|나요|까요|인지|건지)\s*$/,
            /^(그러면|그럼|혹시|만약|어떻게)/,
            /(맞나요|아닌가요|될까요|할까요)/
        ];

        // 코멘트 패턴
        const commentPatterns = [
            /^(네|예|아|음|글쎄)/,
            /(것 같습니다|생각합니다|제안합니다)/,
            /^(좋은|좋습니다|감사)/
        ];

        for (const pattern of questionPatterns) {
            if (pattern.test(text)) return 'question';
        }

        for (const pattern of commentPatterns) {
            if (pattern.test(text)) return 'comment';
        }

        return speaker?.isPrimary ? null : 'comment';
    }

    /**
     * 통계 가져오기
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * 초기화
     */
    reset() {
        this.correctionHistory = [];
        this.processingQueue = [];
        this.isProcessing = false;
        this.stats = {
            totalCorrected: 0,
            agreementRate: 0,
            avgConfidence: 0
        };
    }
}

// 전역으로 내보내기
window.GeminiEnsembleCorrector = GeminiEnsembleCorrector;
