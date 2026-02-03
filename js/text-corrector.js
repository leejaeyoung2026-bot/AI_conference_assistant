/**
 * Text Corrector Module v2.0
 * 제약/화학 전문 용어 보정 모듈 (고급 기능 포함)
 * 
 * 주요 기능:
 * 1. 회의 컨텍스트 기반 동적 프롬프트
 * 2. 사용자 우선순위 용어 처리
 * 3. 슬라이딩 윈도우 컨텍스트 (최근 대화 이력)
 * 4. 세션 기반 동적 사전 빌드
 * 5. N-Best 다중 후보 재채점
 * 6. Gemini AI 정밀 보정
 */

class TextCorrector {
    constructor(geminiAPI) {
        this.geminiAPI = geminiAPI;
        this.enabled = true;
        this.enableNBest = true;
        this.persona = 'pharma';

        // ========== 회의 컨텍스트 ==========
        this.meetingContext = '';           // 회의 주제/프로젝트명
        this.priorityTerms = [];            // 사용자 지정 우선 인식 용어

        // ========== 슬라이딩 윈도우 컨텍스트 ==========
        this.contextHistory = [];           // 최근 보정된 텍스트 이력
        this.maxContextHistory = 5;         // 최대 이력 수

        // ========== 세션 동적 사전 ==========
        this.sessionDictionary = new Map(); // 세션 중 학습된 용어
        this.sessionTermConfidence = new Map(); // 용어별 신뢰도
        this.minConfidenceForDict = 0.8;    // 사전 등록 최소 신뢰도

        // ========== 보정 요청 관리 ==========
        this.lastCorrectionTime = 0;
        this.minCorrectionInterval = 3000;  // 3초 간격 (네트워크 부하 감소)
        this.pendingCorrections = [];       // 대기 중인 보정 요청

        // ========== 캐시 ==========
        this.correctionCache = new Map();
        this.cacheMaxSize = 100;

        // ========== 콜백 ==========
        this.onCorrected = null;
        this.onError = null;
        this.onSessionTermLearned = null;   // 새 용어 학습 시 콜백

        // ========== 지연 초기화 ==========
        this._dictionaryLoaded = false;     // 사전 로딩 상태
        this._baseDictionary = null;        // 캐시된 기본 사전
        this._variationsCache = new Map();  // 발음 변형 캐시

        // 설정 로드 (비동기)
        setTimeout(() => this.loadSettings(), 0);
    }

    // ========== 기본 전문 용어 사전 ==========

    getTermDictionary() {
        // 지연 로딩: 기본 사전을 캐시하여 재생성 방지
        if (!this._baseDictionary) {
            this._baseDictionary = {
                // 예시: '바리스틴': '바리시티닙'
            };
            this._dictionaryLoaded = true;
        }

        // 세션 동적 사전 병합 (우선순위 높음)
        if (this.sessionDictionary.size === 0) {
            return this._baseDictionary;
        }

        const mergedDict = { ...this._baseDictionary };
        for (const [wrong, correct] of this.sessionDictionary) {
            mergedDict[wrong] = correct;
        }

        return mergedDict;
    }

    // ========== 회의 컨텍스트 설정 ==========

    setMeetingContext(context) {
        this.meetingContext = context.trim();
        this.extractKeywordsFromContext();
        this.saveSettings();
    }

    setPriorityTerms(termsString) {
        // 쉼표로 구분된 문자열을 배열로 변환
        this.priorityTerms = termsString
            .split(',')
            .map(t => t.trim())
            .filter(t => t.length > 0);

        // 우선순위 용어를 세션 사전에 추가 (정확한 형태로)
        this.priorityTerms.forEach(term => {
            // 비슷하게 들릴 수 있는 변형 생성
            const variations = this.generatePhoneticVariations(term);
            variations.forEach(variation => {
                if (variation !== term) {
                    this.sessionDictionary.set(variation, term);
                }
            });
        });

        this.saveSettings();
    }

    // 음성학적 변형 생성 (발음이 비슷하게 들릴 수 있는 형태)
    generatePhoneticVariations(term) {
        const variations = [term];
        const lower = term.toLowerCase();

        // 영어 약어의 한글 발음 변형
        if (/^[A-Z0-9-]+$/.test(term)) {
            // XYZ-123 → 엑스 와이 집 123, 엑스와이집 등
            const letterMap = {
                'A': ['에이', '애'], 'B': ['비', '브이'], 'C': ['씨', '시'],
                'D': ['디', '드이'], 'E': ['이'], 'F': ['에프', '엪'],
                'G': ['지', '쥐'], 'H': ['에이치', '에치'], 'I': ['아이'],
                'J': ['제이', '재이'], 'K': ['케이', '게이'], 'L': ['엘', '엘'],
                'M': ['엠', '엔'], 'N': ['엔', '엠'], 'O': ['오'],
                'P': ['피', '브이'], 'Q': ['큐'], 'R': ['알', '아르'],
                'S': ['에스', '엣'], 'T': ['티', '트이'], 'U': ['유'],
                'V': ['브이', '비'], 'W': ['더블유', '떠블유'], 'X': ['엑스', '엣스'],
                'Y': ['와이'], 'Z': ['제트', '젯', '집']
            };

            let koreanPronunciation = '';
            for (const char of term) {
                if (letterMap[char]) {
                    koreanPronunciation += letterMap[char][0];
                } else if (/[0-9]/.test(char)) {
                    koreanPronunciation += char;
                } else if (char === '-') {
                    koreanPronunciation += ' ';
                }
            }
            if (koreanPronunciation) {
                variations.push(koreanPronunciation);
                variations.push(koreanPronunciation.replace(/ /g, ''));
            }
        }

        return variations;
    }

    // 회의 컨텍스트에서 키워드 자동 추출
    extractKeywordsFromContext() {
        if (!this.meetingContext) return;

        // 전문 용어 패턴 (영어 약어, 숫자 포함 코드 등)
        const patterns = [
            /[A-Z]{2,}[-]?\d*/g,           // XYZ, XYZ-123
            /\d+\s*(mg|μg|mL|μM|nM)/gi,    // 용량 단위
            /Phase\s*[1-3]/gi,              // 임상 단계
            /[가-힣]+닙/g,                  // ~닙으로 끝나는 약물명
            /[가-힣]+맙/g,                  // ~맙으로 끝나는 약물명
        ];

        const extractedTerms = new Set();
        patterns.forEach(pattern => {
            const matches = this.meetingContext.match(pattern);
            if (matches) {
                matches.forEach(m => extractedTerms.add(m));
            }
        });

        // 추출된 용어를 우선순위 목록에 추가
        extractedTerms.forEach(term => {
            if (!this.priorityTerms.includes(term)) {
                this.priorityTerms.push(term);
            }
        });
    }

    // ========== 동적 시스템 프롬프트 생성 ==========

    getPersonaPrompt() {
        const basePrompts = {
            pharma: `제약회사 연구원의 음성을 텍스트로 변환한 결과를 보정하는 전문가입니다.
전문 용어: 약물명, 화학적 특성(LogP, pKa, IC50), 
약동학(Cmax, Tmax, AUC), 분자생물학(PCR, ELISA, CRISPR), 임상(Phase 1/2/3)`,

            chemistry: `화학 연구원의 음성을 텍스트로 변환한 결과를 보정하는 전문가입니다.
전문 용어: 물성(LogP, pKa, 용해도), 분석(NMR, MS, HPLC, LC-MS), 
반응(합성, 정제, 결정화), 구조(벤젠고리, 카르복실기, 아미노기)`,

            biotech: `바이오테크 연구원의 음성을 텍스트로 변환한 결과를 보정하는 전문가입니다.
전문 용어: 유전자(DNA, RNA, mRNA), 단백질(항체, 효소, 수용체),
기술(CRISPR, CAR-T, 유전자치료), 세포(세포배양, 형질감염)`,

            food: `식품 분야 전문가의 음성을 텍스트로 변환한 결과를 보정하는 전문가입니다.
전문 용어: 영양성분(단백질, 탄수화물, 지방, 비타민), 식품체학(pH, Brix, 수분함량),
제조공정(HACCP, GMP, 살균, 냉동), 분석(HPLC, GC, 맛 센서)`,

            it: `IT/소프트웨어 분야 전문가의 음성을 텍스트로 변환한 결과를 보정하는 전문가입니다.
전문 용어: 개발(API, SDK, REST, GraphQL, CI/CD), 클라우드(AWS, GCP, Azure, Kubernetes),
데이터(SQL, NoSQL, ETL, ML), UI/UX(프론트엔드, 백엔드, 반응형)`,

            general: `전문 회의의 음성인식 결과를 보정하는 전문가입니다.`
        };

        let prompt = basePrompts[this.persona] || basePrompts.general;

        // 회의 컨텍스트 주입
        if (this.meetingContext) {
            prompt += `\n\n[현재 회의 주제]\n${this.meetingContext}
이 주제와 관련된 전문 용어를 우선적으로 고려하여 보정하세요.`;
        }

        // 우선순위 용어 주입
        if (this.priorityTerms.length > 0) {
            prompt += `\n\n[우선 인식 용어]\n다음 용어들은 이 회의에서 자주 사용됩니다. 
발음이 비슷하면 이 용어들로 우선 보정하세요:\n${this.priorityTerms.join(', ')}`;
        }

        // 세션 학습 용어 주입
        if (this.sessionDictionary.size > 0) {
            const learnedTerms = Array.from(this.sessionDictionary.values());
            const uniqueTerms = [...new Set(learnedTerms)].slice(0, 20);
            prompt += `\n\n[회의 중 학습된 용어]\n${uniqueTerms.join(', ')}`;
        }

        // 최근 대화 컨텍스트 주입
        if (this.contextHistory.length > 0) {
            const recentContext = this.contextHistory.slice(-3).join('\n');
            prompt += `\n\n[최근 대화 내용]\n${recentContext}
위 맥락을 참고하여 "그 값", "그것" 등의 지시어가 무엇을 가리키는지 파악하세요.`;
        }

        prompt += `\n\n[보정 규칙]
1. 원본의 의미와 문맥을 유지하면서 전문 용어만 정확하게 수정
2. 확실하지 않은 부분은 원본 유지
3. 보정된 문장만 출력 (설명 없이)
4. 질문 형식이면 질문 형식 유지`;

        return prompt;
    }

    // ========== 1단계: 로컬 사전 기반 빠른 보정 ==========

    quickCorrect(text) {
        // 짧은 텍스트는 무시 (성능 최적화)
        if (!text || text.length < 2) return text;

        let corrected = text;

        // 1. 우선순위 용어 먼저 처리 (정확한 매칭)
        if (this.priorityTerms.length > 0) {
            for (const term of this.priorityTerms) {
                // 발음 변형 확인 (캐시 사용)
                const variations = this._getCachedVariations(term);
                for (const variation of variations) {
                    if (variation !== term && corrected.includes(variation)) {
                        corrected = corrected.split(variation).join(term);
                    }
                }
            }
        }

        // 2. 로컬 사전 처리 (일치하는 것만)
        const dictionary = this.getTermDictionary();
        for (const [wrong, correct] of Object.entries(dictionary)) {
            // 포함 여부 먼저 확인 (정규식보다 빠름)
            if (corrected.includes(wrong)) {
                corrected = corrected.split(wrong).join(correct);
            }
        }

        return corrected;
    }

    // 발음 변형 캐시 헬퍼
    _getCachedVariations(term) {
        if (this._variationsCache.has(term)) {
            return this._variationsCache.get(term);
        }
        const variations = this.generatePhoneticVariations(term);
        this._variationsCache.set(term, variations);
        return variations;
    }

    // ========== 2단계: N-Best 다중 후보 재채점 (로컬 우선) ==========

    selectBestCandidateLocal(candidates) {
        if (!candidates || candidates.length === 0) return null;
        if (candidates.length === 1) return candidates[0];
        if (!this.enableNBest) {
            return candidates[0];
        }

        // 로컬 사전으로 각 후보 점수 계산
        let bestScore = -1;
        let bestCandidate = candidates[0];

        for (const candidate of candidates) {
            let score = candidate.confidence || 0;
            const corrected = this.quickCorrect(candidate.transcript);

            // 보정 후 전문용어가 있으면 가산점
            const technicalTerms = corrected.match(/[A-Z][A-Za-z0-9]+|LogP|pKa|IC50|Cmax|Tmax|AUC|PCR|ELISA|[가-힣]+닙/g);
            if (technicalTerms) {
                score += technicalTerms.length * 0.1;
            }

            // 우선순위 용어가 포함되면 가산점
            for (const term of this.priorityTerms) {
                if (corrected.includes(term)) {
                    score += 0.3;
                }
            }

            // 보정이 발생했으면 약간 가산 (사전에 매칭된 것)
            if (corrected !== candidate.transcript) {
                score += 0.05;
            }

            if (score > bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }

        if (bestCandidate !== candidates[0]) {
            console.log(`N-Best 로컬 선택: "${bestCandidate.transcript}" (점수: ${bestScore.toFixed(2)})`);
        }

        return bestCandidate;
    }

    // ========== 3단계: Gemini AI 정밀 보정 ==========

    async aiCorrect(text) {
        if (!this.geminiAPI || !this.geminiAPI.isConfigured) {
            return text;
        }

        // 캐시 확인
        const cacheKey = this.getCacheKey(text);
        if (this.correctionCache.has(cacheKey)) {
            return this.correctionCache.get(cacheKey);
        }

        const prompt = `${this.getPersonaPrompt()}

[원본 텍스트]
${text}

[보정된 텍스트]`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃

            const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiAPI.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
                    }),
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('API 오류');

            const data = await response.json();
            const corrected = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (corrected && corrected.length > 0) {
                // 세션 사전 학습
                this.learnFromCorrection(text, corrected);

                // 캐시에 저장
                this.addToCache(cacheKey, corrected);

                return corrected;
            }

            return text;

        } catch (error) {
            console.error('AI 보정 실패:', error);
            return text;
        }
    }

    // ========== 컨텍스트 기반 보정 (신규 기능) ==========

    async correctWithContext(text, contextData = null) {
        if (!this.geminiAPI || !this.geminiAPI.isConfigured) {
            return text;
        }

        const topic = contextData?.topic || this.meetingContext;
        const keywords = contextData?.keywords || this.priorityTerms;
        const lastSummary = contextData?.lastSummary || '';
        const previousSentences = contextData?.previousSentences || [];

        const prompt = `
[현재 회의 주제]: ${topic}
[핵심 키워드]: ${Array.isArray(keywords) ? keywords.join(", ") : keywords}
${lastSummary ? `[회의 요약]: ${lastSummary}` : ''}
${previousSentences.length > 0 ? `[이전 대화 내용]:\n${previousSentences.map(s => `- ${s}`).join('\n')}` : ''}

[입력 음성 텍스트]: "${text}"

위의 회의 맥락을 참고하여, 음성 인식 오류(오타, 전문 용어 오인식)를 보정하세요.
[중요]: 절대 내용을 요약하거나 문장을 축소하지 마세요. 원문의 길이와 디테일을 100% 보존하세요.
보정 시, 사람이 대화하고 있는 중간에 나온 말이라고 가정하고 회의 맥락에 맞게 유추하여 가장 적합한 구어체 형태로 보정하세요.
특히 전문 용어는 반드시 정확하게 교정하세요.
이전 대화 내용과 자연스럽게 이어지도록 문맥을 고려하세요.
보정된 문장만 출력하세요.`;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000); // 15초 타임아웃

            const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${this.geminiAPI.apiKey}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: { temperature: 0.1, maxOutputTokens: 256 }
                    }),
                    signal: controller.signal
                }
            );

            clearTimeout(timeoutId);

            if (!response.ok) throw new Error('API 오류');

            const data = await response.json();
            const corrected = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

            if (corrected && corrected.length > 0) {
                this.learnFromCorrection(text, corrected);
                return corrected;
            }

            return text;

        } catch (error) {
            console.error('AI 컨텍스트 보정 실패:', error);
            return text;
        }
    }

    // ========== 세션 동적 사전 학습 ==========

    learnFromCorrection(original, corrected) {
        if (original === corrected) return;

        // 단어 단위로 비교하여 변경된 부분 학습
        const origWords = original.split(/\s+/);
        const corrWords = corrected.split(/\s+/);

        // 간단한 매칭: 길이가 같은 경우 1:1 비교
        if (origWords.length === corrWords.length) {
            for (let i = 0; i < origWords.length; i++) {
                if (origWords[i] !== corrWords[i]) {
                    const wrongWord = origWords[i].toLowerCase();
                    const correctWord = corrWords[i];

                    // 이미 기본 사전에 있으면 스킵
                    const baseDict = this.getTermDictionary();
                    if (!baseDict[wrongWord]) {
                        // 신뢰도 업데이트
                        const currentConfidence = this.sessionTermConfidence.get(wrongWord) || 0;
                        const newConfidence = Math.min(1, currentConfidence + 0.3);
                        this.sessionTermConfidence.set(wrongWord, newConfidence);

                        // 신뢰도가 임계값 이상이면 사전에 등록
                        if (newConfidence >= this.minConfidenceForDict) {
                            this.sessionDictionary.set(wrongWord, correctWord);
                            console.log(`세션 사전 학습: "${wrongWord}" → "${correctWord}" (신뢰도: ${(newConfidence * 100).toFixed(0)}%)`);

                            // 콜백 호출
                            if (this.onSessionTermLearned) {
                                this.onSessionTermLearned(wrongWord, correctWord);
                            }
                        }
                    }
                }
            }
        }

        // 전문 용어 패턴 추출하여 학습
        const technicalTerms = corrected.match(/[A-Z][A-Za-z0-9-]+|[가-힣]+닙|[가-힣]+맙/g);
        if (technicalTerms) {
            technicalTerms.forEach(term => {
                if (!this.priorityTerms.includes(term)) {
                    // 원본에서 유사한 발음 찾기
                    const variations = this.generatePhoneticVariations(term);
                    variations.forEach(variation => {
                        if (original.includes(variation) && variation !== term) {
                            this.sessionDictionary.set(variation.toLowerCase(), term);
                        }
                    });
                }
            });
        }
    }

    // ========== 컨텍스트 이력 관리 ==========

    addToContextHistory(text) {
        this.contextHistory.push(text);
        if (this.contextHistory.length > this.maxContextHistory) {
            this.contextHistory.shift();
        }
    }

    buildContextInfo() {
        let info = '';

        if (this.meetingContext) {
            info += `[회의 주제] ${this.meetingContext}\n`;
        }

        if (this.priorityTerms.length > 0) {
            info += `[우선 인식 용어] ${this.priorityTerms.join(', ')}\n`;
        }

        if (this.contextHistory.length > 0) {
            info += `[최근 대화]\n${this.contextHistory.join('\n')}\n`;
        }

        return info;
    }

    // ========== 전체 보정 파이프라인 ==========

    async correct(text, candidates = null) {
        if (!this.enabled || !text || text.trim().length === 0) {
            return { text, wasCorrected: false };
        }

        let finalText = text;
        let wasCorrected = false;

        // 0단계: N-Best 다중 후보 처리 (로컬에서 빠르게)
        if (candidates && candidates.length > 1 && this.enableNBest) {
            const bestCandidate = this.selectBestCandidateLocal(candidates);
            if (bestCandidate) {
                finalText = bestCandidate.transcript;
                if (finalText !== text) {
                    wasCorrected = true;
                }
            }
        }

        // 1단계: 로컬 사전 빠른 보정
        const quickCorrected = this.quickCorrect(finalText);
        if (quickCorrected !== finalText) {
            finalText = quickCorrected;
            wasCorrected = true;
        }

        // 컨텍스트 이력에 추가 (AI 보정 전에)
        if (finalText && finalText.trim().length > 0) {
            this.addToContextHistory(finalText);
        }

        // 2단계: AI 정밀 보정은 백그라운드에서 비동기 처리 (블로킹 안함)
        const now = Date.now();
        const shouldUseAI = this.mightNeedAICorrection(finalText) &&
            this.geminiAPI?.isConfigured &&
            (now - this.lastCorrectionTime >= this.minCorrectionInterval);

        if (shouldUseAI) {
            this.lastCorrectionTime = now;
            // 백그라운드에서 AI 보정 (결과는 세션 사전에 학습됨)
            this.aiCorrectInBackground(text, finalText);
        }

        return { text: finalText, wasCorrected, originalText: wasCorrected ? text : null };
    }

    // 백그라운드 AI 보정 (블로킹 안함)
    async aiCorrectInBackground(originalText, currentText) {
        try {
            const aiCorrected = await this.aiCorrect(currentText);
            if (aiCorrected && aiCorrected !== currentText) {
                // AI 보정 결과를 세션 사전에 학습
                this.learnFromCorrection(currentText, aiCorrected);
                console.log(`✓ 백그라운드 AI 보정 완료: "${currentText}" → "${aiCorrected}"`);
            }
        } catch (error) {
            console.warn('백그라운드 AI 보정 실패:', error.message);
        }
    }

    // AI 보정 필요 여부 판단
    mightNeedAICorrection(text) {
        const indicators = [
            /[가-힣]{2,}(닙|맙|빕)/,     // 약물명 패턴
            /(값|농도|수치|결과)/,        // 측정 관련
            /[가-힣]\s?[가-힣]\s?[가-힣]/, // 3글자 연속 (약어 오인식)
            /(로그|피|씨|케이|에이)/,     // 영어 발음
            /(그\s?값|그것|이것|저것)/,   // 지시어 (컨텍스트 필요)
        ];

        return indicators.some(pattern => pattern.test(text));
    }

    // ========== 캐시 관리 ==========

    getCacheKey(text) {
        // 컨텍스트 포함한 캐시 키
        const contextKey = this.meetingContext.slice(0, 50);
        return `${contextKey}:${text.trim().toLowerCase()}`;
    }

    addToCache(key, value) {
        if (this.correctionCache.size >= this.cacheMaxSize) {
            const firstKey = this.correctionCache.keys().next().value;
            this.correctionCache.delete(firstKey);
        }
        this.correctionCache.set(key, value);
    }

    // ========== 설정 관리 ==========

    setEnabled(enabled) {
        this.enabled = enabled;
        this.saveSettings();
    }

    setEnableNBest(enabled) {
        this.enableNBest = enabled;
        this.saveSettings();
    }

    setPersona(persona) {
        this.persona = persona;
        this.saveSettings();
    }

    saveSettings() {
        localStorage.setItem('textCorrectorSettings', JSON.stringify({
            enabled: this.enabled,
            enableNBest: this.enableNBest,
            persona: this.persona,
            meetingContext: this.meetingContext,
            priorityTerms: this.priorityTerms.join(', ')
        }));
    }

    loadSettings() {
        const saved = localStorage.getItem('textCorrectorSettings');
        if (saved) {
            try {
                const settings = JSON.parse(saved);
                this.enabled = settings.enabled !== false;
                this.enableNBest = settings.enableNBest !== false;
                this.persona = settings.persona || 'pharma';
                this.meetingContext = settings.meetingContext || '';
                if (settings.priorityTerms) {
                    this.setPriorityTerms(settings.priorityTerms);
                }
            } catch (e) {
                console.error('보정 설정 로드 실패:', e);
            }
        }
    }

    // 세션 초기화
    clearSession() {
        this.sessionDictionary.clear();
        this.sessionTermConfidence.clear();
        this.contextHistory = [];
        this.correctionCache.clear();
    }

    // 상태 확인
    getStatus() {
        return {
            enabled: this.enabled,
            enableNBest: this.enableNBest,
            persona: this.persona,
            meetingContext: this.meetingContext,
            priorityTermsCount: this.priorityTerms.length,
            sessionDictionarySize: this.sessionDictionary.size,
            contextHistoryLength: this.contextHistory.length,
            cacheSize: this.correctionCache.size
        };
    }

    // 세션 학습 용어 목록 반환
    getSessionTerms() {
        return Array.from(this.sessionDictionary.entries()).map(([wrong, correct]) => ({
            wrong,
            correct,
            confidence: this.sessionTermConfidence.get(wrong) || 0
        }));
    }
}

// 전역으로 내보내기
window.TextCorrector = TextCorrector;
