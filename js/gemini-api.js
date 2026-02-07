/**
 * Gemini API Module v3.0
 * Google Gemini 2.5 Flash AI API 연동 모듈
 * - Google Search Grounding (출처 링크 제공)
 * - 논리적 근거 제시
 * - 주기적 회의 요약
 * - Rate Limit 관리 및 요청 큐 시스템
 */

class GeminiAPI {
    constructor() {
        this.apiKey = '';
        // ========== [사용자 제안] Front-line First 모델 배분 전략 ==========
        // 1. 음성인식 보정: gemini-3-flash-preview (최전선에서 가장 정밀한 교정 수행)
        // 2. QA 답변: gemini-2.5-flash (보정된 텍스트를 바탕으로 고품질 답변 생성)
        // 3. 실시간 요약: gemini-2.0-flash (정제된 데이터를 활용해 효율적인 압축 및 요약)
        
        this.correctionModel = 'gemini-3-flash-preview';
        this.qaModel = 'gemini-2.5-flash';
        this.summaryModel = 'gemini-2.0-flash';
        
        this.model = this.correctionModel; // 기본 모델


        // 시스템 프롬프트 (회의 컨텍스트 관리)
        this.baseUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`;
        this.isConfigured = false;
        this.responseStyle = 'concise'; // concise, detailed, bullet
        this.conversationHistory = [];
        this.maxHistoryLength = 10;

        // ========== 회의 컨텍스트 관리 ==========
        this.meetingSummary = '';            // 주기적으로 생성되는 회의 요약
        this.meetingContext = '';            // 회의 주제/컨텍스트
        this.lastSummaryTime = 0;            // 마지막 요약 시간
        this.summaryInterval = 60000;        // 요약 간격 (1분)
        this.fullMeetingTranscript = [];     // 전체 회의 내용
        this.summaryTimer = null;            // 요약 타이머

        // ========== Google Search Grounding ==========
        this.enableGrounding = true;         // 검색 기반 답변 활성화

        // ========== Rate Limit 관리 ==========
        this.requestQueue = [];              // 요청 큐
        this.isProcessingQueue = false;      // 큐 처리 중 여부
        this.lastRequestTime = 0;            // 마지막 요청 시간
        this.minRequestInterval = 4500;      // 최소 요청 간격 (4.5초)
        this.maxRetries = 3;                 // 최대 재시도 횟수
        this.retryDelay = 10000;             // 재시도 대기 시간 (10초)

        // 중복 질문 방지
        this.recentQuestions = [];           // 최근 질문 목록
        this.questionCooldown = 30000;       // 동일 질문 쿨다운 (30초)
        this.similarityThreshold = 0.7;      // 유사도 임계값

        // 콜백
        this.onAnswerGenerated = null;
        this.onError = null;
        this.onStatusChange = null;
        this.onQueueUpdate = null;
        this.onSummaryGenerated = null;      // 회의 요약 생성 콜백

        // API 키 로드
        this.loadApiKey();
    }

    // ========== API 키 관리 ==========

    setApiKey(key) {
        this.apiKey = key.trim();
        this.isConfigured = this.apiKey.length > 0;
        this.saveApiKey();

        if (this.onStatusChange) {
            this.onStatusChange(this.isConfigured ? 'configured' : 'not-configured');
        }

        return this.isConfigured;
    }

    saveApiKey() {
        if (this.apiKey) {
            const encoded = btoa(this.apiKey);
            localStorage.setItem('geminiApiKey', encoded);
        } else {
            localStorage.removeItem('geminiApiKey');
        }
    }

    loadApiKey() {
        const encoded = localStorage.getItem('geminiApiKey');
        if (encoded) {
            try {
                this.apiKey = atob(encoded);
                this.isConfigured = this.apiKey.length > 0;
            } catch (e) {
                console.error('Failed to load API key');
                this.apiKey = '';
                this.isConfigured = false;
            }
        }
    }

    getApiKey() {
        return this.apiKey;
    }

    // ========== 설정 관리 ==========

    setResponseStyle(style) {
        this.responseStyle = style;
        localStorage.setItem('geminiResponseStyle', style);
    }

    loadResponseStyle() {
        const style = localStorage.getItem('geminiResponseStyle');
        if (style) {
            this.responseStyle = style;
        }
        return this.responseStyle;
    }

    setEnableGrounding(enabled) {
        this.enableGrounding = enabled;
        localStorage.setItem('geminiEnableGrounding', enabled ? 'true' : 'false');
    }

    loadEnableGrounding() {
        const stored = localStorage.getItem('geminiEnableGrounding');
        if (stored !== null) {
            this.enableGrounding = stored === 'true';
        }
        return this.enableGrounding;
    }

    /**
     * 회의 컨텍스트 설정
     */
    setContext(context) {
        this.meetingContext = context || '';
        console.log('[GeminiAPI] 회의 컨텍스트 설정됨:', context?.substring(0, 50) + '...');
    }

    /**
     * 회의 컨텍스트 가져오기
     */
    getContext() {
        return this.meetingContext || '';
    }

    /**
     * 회의 성격(페르소나) 설정
     */
    setPersona(persona) {
        this.persona = persona || 'general';
        console.log('[GeminiAPI] 페르소나 설정됨:', this.persona);
    }

    getSystemPrompt() {
        const styleInstructions = {
            concise: '간결하고 핵심적인 답변을 2-3문장으로 제공해주세요.',
            detailed: '상세하고 풍부한 설명을 포함한 답변을 제공해주세요.',
            bullet: '핵심 포인트를 불릿 포인트로 정리해서 답변해주세요.'
        };

        const personaPrompts = {
            pharma: '당신은 제약/바이오/의료 분야의 전문 지식을 갖춘 AI 어시스턴트입니다.',
            chemistry: '당신은 화학/소재/에너지 분야의 전문 지식을 갖춘 AI 어시스턴트입니다.',
            biotech: '당신은 생명공학/유전공학 분야의 전문 지식을 갖춘 AI 어시스턴트입니다.',
            it: '당신은 IT/소프트웨어 개발/클라우드 분야의 전문 지식을 갖춘 AI 어시스턴트입니다.',
            food: '당신은 식품공학/영양학/식품안전 분야의 전문 지식을 갖춘 AI 어시스턴트입니다.',
            general: '당신은 비즈니스 회의를 지원하는 전문 AI 어시스턴트입니다.'
        };

        let summaryContext = '';
        if (this.meetingSummary) {
            summaryContext = `

[현재까지의 회의 요약]
${this.meetingSummary}`;
        }

        let meetingContextSection = '';
        if (this.meetingContext) {
            meetingContextSection = `

[회의 주제/컨텍스트]
${this.meetingContext}`;
        }

        const basePersona = personaPrompts[this.persona] || personaPrompts.general;

        return `${basePersona}
${meetingContextSection}

역할:
- 회의 중 나온 질문에 대해 정확하고 도움이 되는 답변을 제공합니다
- 모든 답변에는 반드시 논리적 근거와 이유를 함께 제시합니다
- 해당 업종의 전문 비즈니스 맥락과 과학적/기술적 맥락을 이해하고 실용적인 조언을 합니다
- 필요한 경우 추가로 고려할 점이나 관련 질문을 제안합니다

응답 스타일: ${styleInstructions[this.responseStyle]}
${summaryContext}

중요 지침:
- 한국어로 답변해주세요
- 회의 상황에 맞는 전문적이고 도움이 되는 톤을 유지하세요
- **답변의 근거**: 모든 주장에 대해 "왜 그런지"를 반드시 설명하세요
- 확실하지 않은 내용은 "~로 추정됩니다" 등으로 신뢰도를 표시하세요
- 전문 용어를 해당 분야의 관례에 맞게 정확히 사용하세요

답변 형식:
1. [답변]: 질문에 대한 직접적인 답변
2. [근거]: 그렇게 판단한 이유와 논리적 근거
3. [추가 고려사항] (선택적): 관련된 추가 정보나 주의점`;
    }

    // ========== 주기적 회의 요약 ==========

    // 회의 요약 타이머 시작
    startSummaryTimer() {
        if (this.summaryTimer) {
            clearInterval(this.summaryTimer);
        }

        // 즉시 첫 요약 실행 (백그라운드에서)
        this.generateMeetingSummary();

        this.summaryTimer = setInterval(() => {
            // 백그라운드에서 요약 생성 (비동기로 처리)
            this.generateMeetingSummary();
        }, this.summaryInterval);

        console.log('회의 요약 타이머 시작 (1분 간격)');
    }

    // 회의 요약 타이머 중지
    stopSummaryTimer() {
        if (this.summaryTimer) {
            clearInterval(this.summaryTimer);
            this.summaryTimer = null;
        }
        console.log('회의 요약 타이머 중지');
    }

    // 회의 내용 추가
    addToMeetingTranscript(text, timestamp) {
        this.fullMeetingTranscript.push({
            text,
            timestamp,
            addedAt: Date.now()
        });

        // 최대 500개까지만 유지
        if (this.fullMeetingTranscript.length > 500) {
            this.fullMeetingTranscript = this.fullMeetingTranscript.slice(-500);
        }
    }

    // 회의 요약 생성 - 백그라운드에서 실행되도록 개선
    generateMeetingSummary(customText = null) {
        if (!this.isConfigured) {
            return Promise.resolve(null);
        }

        const now = Date.now();
        
        // 커스텀 텍스트가 전달된 경우 (강제 요약)
        if (customText) {
            const summaryPrompt = `다음은 회의 내용입니다. 핵심 내용을 3-5개의 요점으로 간결하게 요약해주세요.
이전 요약이 있다면 그것도 고려하여 통합 요약을 생성하세요.

${this.meetingSummary ? `[이전 요약]\n${this.meetingSummary}\n\n` : ''}[회의 내용]
${customText}

요약 (불릿 포인트로):`;

            this.generateSummaryAsync(summaryPrompt, now);
            return Promise.resolve(this.meetingSummary);
        }

        // 일반 자동 요약 로직
        if (this.fullMeetingTranscript.length < 1) {
            return Promise.resolve(null);
        }

        if (now - this.lastSummaryTime < this.summaryInterval / 2) {
            return Promise.resolve(this.meetingSummary); // 최근에 요약을 생성했으면 스킵
        }

        // 마지막 요약 이후의 내용만 가져오기
        const recentTranscripts = this.fullMeetingTranscript
            .filter(t => t.addedAt > this.lastSummaryTime)
            .map(t => t.text)
            .join('\n');

        if (!recentTranscripts || recentTranscripts.length < 50) {
            return Promise.resolve(this.meetingSummary);
        }

        const summaryPrompt = `다음은 최근 회의 내용입니다. 핵심 내용을 3-5개의 요점으로 간결하게 요약해주세요.
이전 요약이 있다면 그것도 고려하여 통합 요약을 생성하세요.

${this.meetingSummary ? `[이전 요약]\n${this.meetingSummary}\n\n` : ''}[새로운 회의 내용]
${recentTranscripts}

요약 (불릿 포인트로):`;

        // 백그라운드에서 비동기 처리 - await 없이 즉시 반환
        this.generateSummaryAsync(summaryPrompt, now);
        return Promise.resolve(this.meetingSummary);
    }

    // 실제 요약 생성을 백그라운드에서 처리
    async generateSummaryAsync(summaryPrompt, requestTime) {
        try {
            // 타임아웃 15초 (요약은 빠르게)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: summaryPrompt }] }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 512
                    }
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json();
                const summary = data.candidates?.[0]?.content?.parts?.[0]?.text;

                if (summary) {
                    this.meetingSummary = summary;
                    this.lastSummaryTime = requestTime;

                    console.log('회의 요약 생성됨:', summary);

                    if (this.onSummaryGenerated) {
                        this.onSummaryGenerated(summary);
                    }
                }
            }
        } catch (error) {
            console.error('회의 요약 생성 실패:', error);
        }
    }

    // 현재 회의 요약 가져오기
    getMeetingSummary() {
        return this.meetingSummary;
    }

    // ========== 중복 질문 체크 ==========

    calculateSimilarity(str1, str2) {
        const set1 = new Set(str1.toLowerCase().split(/\s+/));
        const set2 = new Set(str2.toLowerCase().split(/\s+/));

        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        return intersection.size / union.size;
    }

    isDuplicateQuestion(question) {
        const now = Date.now();

        this.recentQuestions = this.recentQuestions.filter(
            q => (now - q.timestamp) < this.questionCooldown
        );

        for (const recent of this.recentQuestions) {
            const similarity = this.calculateSimilarity(question, recent.text);
            if (similarity >= this.similarityThreshold) {
                console.log(`중복 질문 감지 (유사도: ${(similarity * 100).toFixed(1)}%): "${question}"`);
                return true;
            }
        }

        this.recentQuestions.push({
            text: question,
            timestamp: now
        });

        return false;
    }

    // ========== 요청 큐 시스템 ==========

    enqueueRequest(question, context, resolve, reject, isQARequest = false) {
        const request = {
            id: Date.now() + Math.random(),
            question,
            context,
            resolve,
            reject,
            retries: 0,
            addedAt: Date.now(),
            isQARequest
        };

        this.requestQueue.push(request);
        console.log(`요청 큐에 추가됨. 현재 큐 크기: ${this.requestQueue.length}`);

        if (this.onQueueUpdate) {
            this.onQueueUpdate(this.requestQueue.length);
        }

        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.isProcessingQueue || this.requestQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        while (this.requestQueue.length > 0) {
            const request = this.requestQueue[0];

            const now = Date.now();
            const timeSinceLastRequest = now - this.lastRequestTime;

            if (timeSinceLastRequest < this.minRequestInterval) {
                const waitTime = this.minRequestInterval - timeSinceLastRequest;
                console.log(`Rate Limit 대기 중... ${(waitTime / 1000).toFixed(1)}초`);

                if (this.onStatusChange) {
                    this.onStatusChange('waiting');
                }

                await this.sleep(waitTime);
            }

            try {
                const result = await this.executeRequest(request.question, request.context, request.isQARequest);
                this.requestQueue.shift();
                request.resolve(result);

                if (this.onQueueUpdate) {
                    this.onQueueUpdate(this.requestQueue.length);
                }

            } catch (error) {
                if (this.isRateLimitError(error) && request.retries < this.maxRetries) {
                    request.retries++;
                    console.log(`Rate Limit 에러. 재시도 ${request.retries}/${this.maxRetries}...`);

                    if (this.onStatusChange) {
                        this.onStatusChange('retrying');
                    }

                    await this.sleep(this.retryDelay * request.retries);

                } else {
                    this.requestQueue.shift();
                    request.reject(error);

                    if (this.onQueueUpdate) {
                        this.onQueueUpdate(this.requestQueue.length);
                    }
                }
            }
        }

        this.isProcessingQueue = false;
    }

    isRateLimitError(error) {
        const message = error.message?.toLowerCase() || '';
        return message.includes('rate') ||
            message.includes('quota') ||
            message.includes('limit') ||
            message.includes('exhausted') ||
            message.includes('429') ||
            message.includes('too many');
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========== API 요청 실행 (Google Search Grounding 포함) ==========

    async executeRequest(question, context, isQARequest = false) {
        if (!this.isConfigured) {
            throw new Error('API 키가 설정되지 않았습니다.');
        }

        if (this.onStatusChange) {
            this.onStatusChange('generating');
        }

        // 프롬프트 구성 (신속한 답변을 위해 결론/근거로 단순화)
        let userPrompt = `질문: ${question}

형식:
1. **[결론]**: 핵심 답변
2. **[근거]**: 간결한 이유`;

        if (context) {
            userPrompt = `회의 맥락:\n${context}\n\n${userPrompt}`;
        }

        // 회의 요약이 있으면 추가
        if (this.meetingSummary) {
            userPrompt = `[현재까지 회의 요약]\n${this.meetingSummary}\n\n${userPrompt}`;
        }

        this.conversationHistory.push({
            role: 'user',
            parts: [{ text: userPrompt }]
        });

        if (this.conversationHistory.length > this.maxHistoryLength * 2) {
            this.conversationHistory = this.conversationHistory.slice(-this.maxHistoryLength * 2);
        }

        // API 요청 본문 구성 (Google Search Grounding 포함)
        const requestBody = {
            contents: [
                {
                    role: 'user',
                    parts: [{ text: this.getSystemPrompt() }]
                },
                ...this.conversationHistory
            ],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 2048,
            }
        };

        // Google Search Grounding 활성화
        if (this.enableGrounding) {
            requestBody.tools = [{
                googleSearch: {}
            }];
        }

        this.lastRequestTime = Date.now();

        // 타임아웃 설정 (30초)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        let response;
        try {
            // QA 요청인 경우 (generateAnswer에서 호출) 별도 모델 URL 사용
            // executeRequest 내부에서는 구분이 어려우므로, baseUrl을 동적으로 결정하는 로직 추가
            // 하지만 executeRequest가 일반적인 요청을 처리하므로, 여기서 baseUrl을 직접 수정하기보다
            // 별도의 QA용 메서드를 만들거나, 호출 시점에 URL을 조정하는 것이 좋음.
            // 여기서는 executeRequest에 optional parameter를 추가하거나, 
            // generateAnswer 메서드에서 executeRequest를 호출하기 전 baseUrl을 잠시 바꾸는 방식보다는 
            // executeRequest에 model override 파라미터를 추가하겠습니다.

            // 기존 코드 유지하되, QA 모델 사용
            const endpoint = isQARequest ?
                `https://generativelanguage.googleapis.com/v1beta/models/${this.qaModel}:generateContent` :
                this.baseUrl;

            response = await fetch(`${endpoint}?key=${this.apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
        } catch (fetchError) {
            clearTimeout(timeoutId);
            if (fetchError.name === 'AbortError') {
                throw new Error('API 요청 시간 초과 (30초)');
            }
            throw new Error(`네트워크 오류: ${fetchError.message}`);
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.error?.message || `API 오류: ${response.status}`;
            throw new Error(errorMessage);
        }

        const data = await response.json();

        // 응답 추출
        const candidate = data.candidates?.[0];
        const answer = candidate?.content?.parts?.[0]?.text;

        if (!answer) {
            throw new Error('AI로부터 응답을 받지 못했습니다.');
        }

        // Grounding 정보 추출 (출처 링크)
        const groundingMetadata = candidate?.groundingMetadata;
        const sources = this.extractSources(groundingMetadata);

        // 대화 히스토리에 응답 추가
        this.conversationHistory.push({
            role: 'model',
            parts: [{ text: answer }]
        });

        if (this.onStatusChange) {
            this.onStatusChange('configured');
        }

        // 결과 객체 생성 (출처 포함)
        const result = {
            question: question,
            answer: answer,
            timestamp: new Date(),
            id: Date.now(),
            sources: sources,                    // 출처 링크 배열
            hasGrounding: sources.length > 0     // Grounding 사용 여부
        };

        if (this.onAnswerGenerated) {
            this.onAnswerGenerated(result);
        }

        return result;
    }

    // Grounding 메타데이터에서 출처 추출
    extractSources(groundingMetadata) {
        const sources = [];

        if (!groundingMetadata) return sources;

        // groundingChunks에서 출처 추출
        const chunks = groundingMetadata.groundingChunks || [];
        for (const chunk of chunks) {
            if (chunk.web) {
                sources.push({
                    title: chunk.web.title || '출처',
                    uri: chunk.web.uri,
                    type: 'web'
                });
            }
        }

        // webSearchQueries 추출 (검색어)
        const searchQueries = groundingMetadata.webSearchQueries || [];

        // searchEntryPoint에서 렌더링된 콘텐츠 추출
        const searchEntryPoint = groundingMetadata.searchEntryPoint;

        // groundingSupports에서 세그먼트별 출처 추출
        const supports = groundingMetadata.groundingSupports || [];
        for (const support of supports) {
            if (support.groundingChunkIndices) {
                // 이미 chunks에서 추출했으므로 중복 제거
            }
        }

        // 중복 제거
        const uniqueSources = [];
        const seenUris = new Set();

        for (const source of sources) {
            if (source.uri && !seenUris.has(source.uri)) {
                seenUris.add(source.uri);
                uniqueSources.push(source);
            }
        }

        return uniqueSources;
    }

    // ========== 회의록 생성 (신규 기능) ==========

    async generateMeetingMinutes(context, fullTranscripts, summaries) {
        if (!this.isConfigured) {
            throw new Error('API 키가 설정되지 않았습니다.');
        }

        const transcriptText = fullTranscripts.map(t => `[${t.timestamp.toLocaleTimeString('ko-KR')}] ${t.text}`).join('\n');
        const summariesText = summaries.join('\n\n');

        const prompt = `당신은 전문 회의 서기입니다. 다음 회의 데이터를 바탕으로 체계적이고 전문적인 회의록을 작성해주세요.

[회의 컨텍스트]
${context}

[주기적 회의 요약 모음]
${summariesText}

[전체 회의 스크립트]
${transcriptText}

---
**작성 지침:**
1.  **제목**: 회의 주제에 맞는 제목을 정해주세요.
2.  **개요**: 회의의 목적과 전반적인 내용을 요약해주세요.
3.  **주요 논의 사항**: 논의된 안건별로 내용을 구조화하여 정리해주세요.
4.  **결정 사항**: (중요) 회의에서 결정된 사항을 명확히 명시해주세요.
5.  **액션 아이템**: (중요) 향후 해야 할 일(To-Do)과 담당자(추정 가능 시)를 목록화해주세요.
6.  **키워드**: 회의의 핵심 키워드를 해시태그로 나열해주세요.

**출력 형식:** 깔끔한 Markdown 형식으로 작성해주세요.`;

        try {
            const response = await fetch(`${this.baseUrl}?key=${this.apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: {
                        temperature: 0.3, // 명확하고 사실적인 정리를 위해 낮춤
                        maxOutputTokens: 2048
                    }
                })
            });

            if (!response.ok) throw new Error('API 요청 실패');

            const data = await response.json();
            const result = data.candidates?.[0]?.content?.parts?.[0]?.text;

            if (!result) throw new Error('AI 응답이 비어있습니다.');

            return result;

        } catch (error) {
            console.error('회의록 생성 실패:', error);
            throw error;
        }
    }

    // ========== 공개 메서드 ==========

    async generateAnswer(question, context = '') {
        if (!this.isConfigured) {
            if (this.onError) {
                this.onError('no-api-key', 'API 키가 설정되지 않았습니다. 설정에서 Gemini API 키를 입력해주세요.');
            }
            return null;
        }

        if (this.isDuplicateQuestion(question)) {
            console.log('중복 질문 스킵:', question);
            if (this.onError) {
                this.onError('duplicate', '유사한 질문이 최근에 처리되었습니다. 잠시 후 다시 시도해주세요.');
            }
            return null;
        }

        return new Promise((resolve, reject) => {
            this.enqueueRequest(question, context, resolve, (error) => {
                console.error('Gemini API Error:', error);

                if (this.onStatusChange) {
                    this.onStatusChange('error');
                }

                if (this.onError) {
                    // ... error handling
                    this.onError('api-error', error.message);
                }
                resolve(null);
            }, true); // isQARequest = true
        });
    }

    async generateAnswerWithContext(question, transcriptHistory, detectedQuestions) {
        const recentTranscript = transcriptHistory
            .slice(-15)
            .map(t => t.text)
            .join('\n');

        const context = recentTranscript ? `최근 회의 내용:\n${recentTranscript}` : '';

        return this.generateAnswer(question, context);
    }

    async testApiKey(key) {
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${key}`;

        try {
            const response = await fetch(testUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: 'Hi' }]
                    }]
                })
            });

            if (response.ok) {
                this.lastRequestTime = Date.now();
                return { valid: true, message: 'API 키가 유효합니다. (Gemini 2.5 Flash)' };
            } else {
                const errorData = await response.json().catch(() => ({}));
                return {
                    valid: false,
                    message: errorData.error?.message || 'API 키가 유효하지 않습니다.'
                };
            }
        } catch (error) {
            return {
                valid: false,
                message: '연결 테스트 중 오류가 발생했습니다.'
            };
        }
    }

    clearHistory() {
        this.conversationHistory = [];
        this.recentQuestions = [];
        this.requestQueue = [];
        this.isProcessingQueue = false;
        this.meetingSummary = '';
        this.fullMeetingTranscript = [];
        this.lastSummaryTime = 0;
    }

    getQueueStatus() {
        return {
            queueLength: this.requestQueue.length,
            isProcessing: this.isProcessingQueue,
            lastRequestTime: this.lastRequestTime,
            timeSinceLastRequest: Date.now() - this.lastRequestTime
        };
    }

    getStatus() {
        return {
            isConfigured: this.isConfigured,
            model: this.model,
            responseStyle: this.responseStyle,
            enableGrounding: this.enableGrounding,
            historyLength: this.conversationHistory.length,
            queueLength: this.requestQueue.length,
            isProcessing: this.isProcessingQueue,
            meetingSummaryLength: this.meetingSummary.length,
            transcriptCount: this.fullMeetingTranscript.length
        };
    }
}

// 전역으로 내보내기
window.GeminiAPI = GeminiAPI;
