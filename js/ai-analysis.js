/**
 * AI Analysis Module
 * 텍스트 분석, 질문 감지, 스마트 코멘트 생성
 */

class AIAnalysisEngine {
    constructor() {
        this.sensitivity = 3; // 1-5
        this.autoComment = true;
        this.soundAlert = true;

        // 지연 초기화 플래그
        this._initialized = false;

        // 질문 패턴 (한국어)
        this.questionPatterns = {
            ko: [
                // 의문사로 시작하는 패턴
                /^(누가|누구|뭐|뭘|무엇|무슨|어디|어느|언제|왜|어떻게|어떤|얼마|몇)/,
                // 의문형 어미
                /(입니까|습니까|ㅂ니까|나요|까요|ㄹ까요|을까요|는지|은지|인지|건지|던가요|던가|냐|니|가요|나|ㄴ가요|ㄴ가|는가요|는가|세요|시겠|아요|어요|예요|죠|지요|거예요|건가요|을까|ㄹ까)\??\s*$/,
                // 물음표로 끝나는 문장
                /\?$/,
                // 질문 키워드
                /(어떻게 생각|의견이|의견은|어떨까|어떨까요|맞나요|맞죠|그런가요|그런가|아닌가요|아닌가|할까요|할까|될까요|될까|있나요|있을까요|없나요|없을까요|해볼까|해봐요|알려주|설명해|말해|답변)/
            ],
            en: [
                /^(who|what|where|when|why|how|which|whose|whom)/i,
                /\?$/,
                /(do you|can you|could you|would you|will you|should|is it|are there|have you|has|does)/i
            ],
            ja: [
                /(ですか|ますか|でしょうか|かな|のか|か？|？)$/,
                /^(誰|何|どこ|いつ|なぜ|どう|どの|いくら)/
            ]
        };



        // 분석된 데이터 저장
        // 분석된 데이터 저장
        this.detectedQuestions = [];

        // 콜백
        this.onQuestionDetected = null;
    }

    // 텍스트 분석 (최적화: 짧은 텍스트 무시, 비동기 콜백)
    analyzeText(text, language = 'ko') {
        // 너무 짧은 텍스트는 분석 스킵 (성능 최적화)
        if (!text || text.trim().length < 3) {
            return { isQuestion: false, keywords: [], comments: [] };
        }

        const result = {
            isQuestion: false,
            keywords: [],
            comments: []
        };

        // 질문 감지 (가장 중요)
        const isQuestion = this.detectQuestion(text, language);
        if (isQuestion) {
            result.isQuestion = true;
            const question = {
                text: text,
                timestamp: new Date(),
                id: Date.now()
            };
            this.detectedQuestions.push(question);

            if (this.onQuestionDetected) {
                this.onQuestionDetected(question);
            }
        }

        return result;
    }

    // 질문 감지
    detectQuestion(text, language = 'ko') {
        const patterns = this.questionPatterns[language] || this.questionPatterns.ko;
        const normalizedText = text.trim();

        // 민감도에 따른 패턴 매칭
        let matchCount = 0;
        const requiredMatches = Math.max(1, 4 - this.sensitivity); // 민감도가 높을수록 적은 매칭으로 질문 인식

        for (const pattern of patterns) {
            if (pattern.test(normalizedText)) {
                matchCount++;
                if (matchCount >= requiredMatches || normalizedText.endsWith('?')) {
                    return true;
                }
            }
        }

        // 민감도가 높으면 추가 휴리스틱 적용
        if (this.sensitivity >= 4) {
            // 짧은 문장에 의문사가 있으면 질문으로 간주
            if (normalizedText.length < 50 && /누가|뭐|어디|언제|왜|어떻게/.test(normalizedText)) {
                return true;
            }
        }

        return false;
    }



    // 회의록 생성
    generateMeetingNotes(transcript) {
        const notes = {
            date: new Date().toLocaleString('ko-KR'),
            duration: '',
            transcript: transcript,
            questions: this.detectedQuestions.map(q => ({
                time: q.timestamp.toLocaleTimeString('ko-KR'),
                text: q.text
            }))
        };
        return notes;
    }
}

// 전역으로 내보내기
window.AIAnalysisEngine = AIAnalysisEngine;
