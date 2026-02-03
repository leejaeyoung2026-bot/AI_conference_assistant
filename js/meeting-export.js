/**
 * Meeting Export Module v1.0
 * 회의록 내보내기 기능 (HTML 세련된 디자인)
 * 
 * 주요 기능:
 * 1. 세련된 HTML 회의록 생성
 * 2. 발화자별 색상 구분
 * 3. 질문/코멘트 표시
 * 4. 회의 요약 및 통계 포함
 */

class MeetingExporter {
    constructor() {
        // 회의록 데이터
        this.transcripts = [];
        this.questions = [];
        this.aiAnswers = [];
        this.summary = '';
        this.meetingInfo = {
            title: 'AI 회의 도우미 회의록',
            date: new Date(),
            duration: '00:00:00',
            participants: []
        };

        // 스타일 설정
        this.colors = {
            primary: '#2563eb',
            secondary: '#10b981',
            accent: '#f59e0b',
            danger: '#ef4444',
            background: '#f8fafc',
            text: '#1e293b'
        };
    }

    /**
     * 회의 정보 설정
     */
    setMeetingInfo(info) {
        this.meetingInfo = { ...this.meetingInfo, ...info };
    }

    /**
     * 트랜스크립트 추가
     */
    addTranscript(item) {
        this.transcripts.push({
            text: item.text,
            speaker: item.speaker || 'primary',
            timestamp: item.timestamp || new Date(),
            isQuestion: item.isQuestion || false,
            isComment: item.isComment || false,
            corrected: item.corrected || false
        });
    }

    /**
     * 여러 트랜스크립트 설정
     */
    setTranscripts(transcripts) {
        this.transcripts = transcripts.map(t => ({
            text: t.text,
            speaker: t.speaker || 'primary',
            timestamp: t.timestamp || new Date(),
            isQuestion: t.isQuestion || false,
            isComment: t.isComment || false,
            corrected: t.corrected || false
        }));
    }

    /**
     * 질문 추가
     */
    addQuestion(question) {
        this.questions.push({
            text: question.text,
            timestamp: question.timestamp || new Date(),
            answered: question.answered || false
        });
    }

    /**
     * AI 답변 추가
     */
    addAIAnswer(answer) {
        this.aiAnswers.push({
            question: answer.question,
            answer: answer.answer,
            sources: answer.sources || [],
            timestamp: answer.timestamp || new Date()
        });
    }

    /**
     * 요약 설정
     */
    setSummary(summary) {
        this.summary = summary;
    }

    /**
     * 스마트 회의록 생성 (총괄 요약/결정 사항/액션 아이템만 포함)
     */
    generateSmartHTML(smartSummary = null) {
        const now = this.meetingInfo.date || new Date();
        const dateStr = now.toLocaleDateString('ko-KR', { 
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
        });
        const timeStr = now.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', minute: '2-digit' 
        });

        const summaryContent = smartSummary || this.summary || '요약 정보가 없습니다.';

        return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(this.meetingInfo.title)} - 회의록</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        ${this.getSmartStyles()}
    </style>
</head>
<body>
    <div class="container">
        <!-- 헤더 -->
        <header class="header">
            <div class="logo">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" fill="${this.colors.primary}"/>
                    <path d="M12 20L18 26L28 14" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h1>회의록 리포트</h1>
            </div>
            <div class="meeting-meta">
                <div class="meta-item">
                    <span class="label">회의명</span>
                    <span class="value">${this.escapeHtml(this.meetingInfo.title)}</span>
                </div>
                <div class="meta-item">
                    <span class="label">일시</span>
                    <span class="value">${dateStr} ${timeStr}</span>
                </div>
                <div class="meta-item">
                    <span class="label">소요시간</span>
                    <span class="value">${this.meetingInfo.duration}</span>
                </div>
            </div>
        </header>

        <!-- 통계 요약 -->
        <section class="stats-section">
            <div class="stat-card">
                <div class="stat-icon" style="background: ${this.colors.primary}20; color: ${this.colors.primary};">
                    🗣️
                </div>
                <div class="stat-content">
                    <span class="stat-value">${this.transcripts.length}</span>
                    <span class="stat-label">발언 수</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: ${this.colors.accent}20; color: ${this.colors.accent};">
                    ❓
                </div>
                <div class="stat-content">
                    <span class="stat-value">${this.questions.length}</span>
                    <span class="stat-label">질문 수</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: ${this.colors.secondary}20; color: ${this.colors.secondary};">
                    🤖
                </div>
                <div class="stat-content">
                    <span class="stat-value">${this.aiAnswers.length}</span>
                    <span class="stat-label">AI 답변</span>
                </div>
            </div>
        </section>

        <!-- 회의 요약 (스마트 요약) -->
        <section class="summary-section">
            <h2 class="section-title">
                📝 회의 요약
            </h2>
            <div class="summary-content">
                ${this.formatSmartSummary(summaryContent)}
            </div>
        </section>

        ${this.aiAnswers.length > 0 ? `
        <!-- AI 답변 요약 -->
        <section class="qa-section">
            <h2 class="section-title">
                💡 AI 답변 요약
            </h2>
            <div class="qa-list">
                ${this.generateQAHTML()}
            </div>
        </section>
        ` : ''}

        <!-- 푸터 -->
        <footer class="footer">
            <p>이 회의록은 <strong>AI 회의 어시스턴트</strong>에 의해 자동 생성되었습니다.</p>
            <p class="timestamp">생성 시간: ${new Date().toLocaleString('ko-KR')}</p>
        </footer>
    </div>
</body>
</html>`;
    }

    /**
     * 스마트 요약 포매팅
     */
    formatSmartSummary(summary) {
        if (!summary) return '<p>요약 정보가 없습니다.</p>';
        
        let formatted = this.escapeHtml(summary);
        
        // 마크다운 헤딩 변환
        formatted = formatted.replace(/^## (.+)$/gm, '<h3 class="summary-heading">$1</h3>');
        formatted = formatted.replace(/^### (.+)$/gm, '<h4 class="summary-subheading">$1</h4>');
        
        // 체크박스 변환
        formatted = formatted.replace(/^- \[ \] (.+)$/gm, '<li class="action-item pending"><span class="checkbox">☐</span> $1</li>');
        formatted = formatted.replace(/^- \[x\] (.+)$/gm, '<li class="action-item done"><span class="checkbox">☑</span> $1</li>');
        
        // 일반 리스트 변환
        formatted = formatted.replace(/^- (.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // 번호 리스트 변환
        formatted = formatted.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
        
        // 해시태그 변환
        formatted = formatted.replace(/#([\w가-힣]+)/g, '<span class="tag">#$1</span>');
        
        // 줄바꿈 변환
        formatted = formatted.replace(/\n\n/g, '</p><p>');
        formatted = formatted.replace(/\n/g, '<br>');
        
        return `<div class="smart-summary">${formatted}</div>`;
    }

    /**
     * 스마트 회의록용 스타일
     */
    getSmartStyles() {
        return `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: ${this.colors.text};
    line-height: 1.8;
    min-height: 100vh;
    padding: 40px 20px;
}

.container {
    max-width: 800px;
    margin: 0 auto;
    background: white;
    border-radius: 24px;
    box-shadow: 0 25px 80px rgba(0, 0, 0, 0.15);
    overflow: hidden;
}

.header {
    background: linear-gradient(135deg, ${this.colors.primary} 0%, #1e40af 100%);
    color: white;
    padding: 50px 40px;
}

.logo {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 30px;
}

.logo h1 {
    font-size: 32px;
    font-weight: 700;
}

.meeting-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 24px;
}

.meta-item {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.meta-item .label {
    font-size: 12px;
    opacity: 0.8;
    text-transform: uppercase;
    letter-spacing: 1.5px;
}

.meta-item .value {
    font-size: 18px;
    font-weight: 600;
}

.stats-section {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    padding: 30px 40px;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 20px;
    background: white;
    border-radius: 16px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.stat-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
}

.stat-value {
    font-size: 28px;
    font-weight: 700;
    color: ${this.colors.text};
}

.stat-label {
    font-size: 14px;
    color: #64748b;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 22px;
    font-weight: 600;
    color: ${this.colors.text};
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 3px solid ${this.colors.primary};
}

.summary-section {
    padding: 50px 40px;
}

.summary-content {
    background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
    border-radius: 20px;
    padding: 32px;
    border-left: 5px solid ${this.colors.primary};
}

.smart-summary {
    font-size: 16px;
    line-height: 2;
}

.summary-heading {
    font-size: 20px;
    font-weight: 600;
    color: ${this.colors.primary};
    margin: 24px 0 16px 0;
    padding-bottom: 8px;
    border-bottom: 2px solid ${this.colors.primary}20;
}

.summary-subheading {
    font-size: 17px;
    font-weight: 600;
    color: #334155;
    margin: 20px 0 12px 0;
}

.smart-summary ul {
    margin: 16px 0;
    padding-left: 24px;
}

.smart-summary li {
    margin-bottom: 10px;
}

.action-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 16px;
    background: white;
    border-radius: 10px;
    margin-bottom: 10px;
    border: 1px solid #e2e8f0;
}

.action-item.pending {
    border-left: 4px solid ${this.colors.accent};
}

.action-item.done {
    border-left: 4px solid ${this.colors.secondary};
    opacity: 0.7;
    text-decoration: line-through;
}

.checkbox {
    font-size: 18px;
}

.tag {
    display: inline-block;
    background: ${this.colors.primary}15;
    color: ${this.colors.primary};
    padding: 4px 12px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    margin: 4px 4px 4px 0;
}

.qa-section {
    padding: 50px 40px;
    background: #f8fafc;
}

.qa-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.qa-item {
    background: white;
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.06);
}

.qa-question {
    padding: 24px 28px;
    background: linear-gradient(135deg, ${this.colors.accent}10, ${this.colors.accent}05);
    border-left: 5px solid ${this.colors.accent};
}

.qa-question-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: ${this.colors.accent};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 10px;
}

.qa-answer {
    padding: 24px 28px;
    background: linear-gradient(135deg, ${this.colors.primary}05, ${this.colors.primary}02);
    border-left: 5px solid ${this.colors.primary};
}

.qa-answer-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
    color: ${this.colors.primary};
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 10px;
}

.qa-sources {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e2e8f0;
}

.qa-sources-label {
    font-size: 13px;
    color: #64748b;
    margin-bottom: 10px;
}

.qa-source-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    background: #f1f5f9;
    border-radius: 8px;
    font-size: 13px;
    color: ${this.colors.primary};
    text-decoration: none;
    margin-right: 10px;
    margin-bottom: 10px;
    transition: all 0.2s;
}

.qa-source-link:hover {
    background: ${this.colors.primary}15;
}

.footer {
    padding: 40px;
    background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
    color: white;
    text-align: center;
}

.footer p {
    font-size: 15px;
    opacity: 0.9;
}

.footer .timestamp {
    font-size: 13px;
    opacity: 0.6;
    margin-top: 10px;
}

@media (max-width: 768px) {
    body {
        padding: 20px 10px;
    }
    
    .header, .summary-section, .qa-section {
        padding: 30px 20px;
    }
    
    .stats-section {
        grid-template-columns: 1fr;
        padding: 20px;
    }
}

@media print {
    body {
        background: white;
        padding: 0;
    }
    
    .container {
        box-shadow: none;
        border-radius: 0;
    }
}
`;
    }

    /**
     * 스마트 HTML 회의록 다운로드
     */
    downloadSmartHTML(filename = 'meeting-report', smartSummary = null) {
        const html = this.generateSmartHTML(smartSummary);
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}_${this.getTimestamp()}.html`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        return true;
    }

    /**
     * HTML 회의록 생성 (원본 대화 포함 - 선택적 사용)
     */
    generateHTML() {
        const now = this.meetingInfo.date || new Date();
        const dateStr = now.toLocaleDateString('ko-KR', { 
            year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' 
        });
        const timeStr = now.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', minute: '2-digit' 
        });

        return `<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${this.escapeHtml(this.meetingInfo.title)} - 회의록</title>
    <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        ${this.getStyles()}
    </style>
</head>
<body>
    <div class="container">
        <!-- 헤더 -->
        <header class="header">
            <div class="logo">
                <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                    <circle cx="20" cy="20" r="18" fill="${this.colors.primary}"/>
                    <path d="M12 20L18 26L28 14" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
                <h1>회의록</h1>
            </div>
            <div class="meeting-meta">
                <div class="meta-item">
                    <span class="label">회의명</span>
                    <span class="value">${this.escapeHtml(this.meetingInfo.title)}</span>
                </div>
                <div class="meta-item">
                    <span class="label">일시</span>
                    <span class="value">${dateStr} ${timeStr}</span>
                </div>
                <div class="meta-item">
                    <span class="label">소요시간</span>
                    <span class="value">${this.meetingInfo.duration}</span>
                </div>
            </div>
        </header>

        <!-- 통계 요약 -->
        <section class="stats-section">
            <div class="stat-card">
                <div class="stat-icon" style="background: ${this.colors.primary}20; color: ${this.colors.primary};">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <span class="stat-value">${this.transcripts.length}</span>
                    <span class="stat-label">발언 수</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: ${this.colors.accent}20; color: ${this.colors.accent};">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <span class="stat-value">${this.questions.length}</span>
                    <span class="stat-label">질문 수</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: ${this.colors.secondary}20; color: ${this.colors.secondary};">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <span class="stat-value">${this.aiAnswers.length}</span>
                    <span class="stat-label">AI 답변</span>
                </div>
            </div>
            <div class="stat-card">
                <div class="stat-icon" style="background: ${this.colors.danger}20; color: ${this.colors.danger};">
                    <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                </div>
                <div class="stat-content">
                    <span class="stat-value">${this.countSpeakers()}</span>
                    <span class="stat-label">참여자</span>
                </div>
            </div>
        </section>

        ${this.summary ? `
        <!-- 회의 요약 -->
        <section class="summary-section">
            <h2 class="section-title">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                회의 요약
            </h2>
            <div class="summary-content">
                ${this.formatSummary(this.summary)}
            </div>
        </section>
        ` : ''}

        <!-- 회의 내용 -->
        <section class="transcript-section">
            <h2 class="section-title">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"/>
                </svg>
                회의 내용
            </h2>
            <div class="transcript-list">
                ${this.generateTranscriptHTML()}
            </div>
        </section>

        ${this.questions.length > 0 ? `
        <!-- 질문 및 AI 답변 -->
        <section class="qa-section">
            <h2 class="section-title">
                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                </svg>
                질문 및 AI 답변
            </h2>
            <div class="qa-list">
                ${this.generateQAHTML()}
            </div>
        </section>
        ` : ''}

        <!-- 푸터 -->
        <footer class="footer">
            <p>이 회의록은 <strong>AI 회의 어시스턴트</strong>에 의해 자동 생성되었습니다.</p>
            <p class="timestamp">생성 시간: ${new Date().toLocaleString('ko-KR')}</p>
        </footer>
    </div>
</body>
</html>`;
    }

    /**
     * CSS 스타일
     */
    getStyles() {
        return `
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Noto Sans KR', -apple-system, BlinkMacSystemFont, sans-serif;
    background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
    color: ${this.colors.text};
    line-height: 1.8;
    min-height: 100vh;
    padding: 40px 20px;
}

.container {
    max-width: 900px;
    margin: 0 auto;
    background: white;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
    overflow: hidden;
}

.header {
    background: linear-gradient(135deg, ${this.colors.primary} 0%, #1e40af 100%);
    color: white;
    padding: 40px;
}

.logo {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 30px;
}

.logo h1 {
    font-size: 28px;
    font-weight: 700;
}

.meeting-meta {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 20px;
}

.meta-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.meta-item .label {
    font-size: 12px;
    opacity: 0.8;
    text-transform: uppercase;
    letter-spacing: 1px;
}

.meta-item .value {
    font-size: 16px;
    font-weight: 600;
}

.stats-section {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
    padding: 30px 40px;
    background: ${this.colors.background};
    border-bottom: 1px solid #e2e8f0;
}

@media (max-width: 768px) {
    .stats-section {
        grid-template-columns: repeat(2, 1fr);
    }
}

.stat-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    background: white;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.stat-icon {
    width: 48px;
    height: 48px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.stat-content {
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: 24px;
    font-weight: 700;
    color: ${this.colors.text};
}

.stat-label {
    font-size: 13px;
    color: #64748b;
}

.section-title {
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 20px;
    font-weight: 600;
    color: ${this.colors.text};
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid ${this.colors.primary}20;
}

.section-title svg {
    color: ${this.colors.primary};
}

.summary-section {
    padding: 40px;
    border-bottom: 1px solid #e2e8f0;
}

.summary-content {
    background: linear-gradient(135deg, ${this.colors.primary}08 0%, ${this.colors.secondary}08 100%);
    border-radius: 16px;
    padding: 24px;
    border-left: 4px solid ${this.colors.primary};
}

.summary-content p {
    margin-bottom: 12px;
}

.summary-content ul {
    margin: 12px 0;
    padding-left: 20px;
}

.summary-content li {
    margin-bottom: 8px;
}

.transcript-section {
    padding: 40px;
}

.transcript-list {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.transcript-item {
    display: flex;
    gap: 16px;
    padding: 16px;
    border-radius: 16px;
    transition: all 0.3s ease;
}

.transcript-item:hover {
    background: ${this.colors.background};
}

.transcript-item.primary {
    flex-direction: row;
}

.transcript-item.secondary {
    flex-direction: row-reverse;
}

.speaker-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 14px;
    color: white;
    flex-shrink: 0;
}

.speaker-avatar.primary {
    background: linear-gradient(135deg, ${this.colors.primary} 0%, #1e40af 100%);
}

.speaker-avatar.secondary {
    background: linear-gradient(135deg, ${this.colors.secondary} 0%, #059669 100%);
}

.transcript-content {
    flex: 1;
    max-width: calc(100% - 60px);
}

.transcript-bubble {
    padding: 16px 20px;
    border-radius: 16px;
    font-size: 15px;
    line-height: 1.7;
}

.transcript-item.primary .transcript-bubble {
    background: ${this.colors.primary}10;
    border-bottom-left-radius: 4px;
}

.transcript-item.secondary .transcript-bubble {
    background: ${this.colors.secondary}10;
    border-bottom-right-radius: 4px;
}

.transcript-item.question .transcript-bubble {
    background: ${this.colors.accent}15;
    border: 1px solid ${this.colors.accent}30;
}

.transcript-item.comment .transcript-bubble {
    background: #f1f5f9;
    border: 1px dashed #cbd5e1;
}

.transcript-meta {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 8px;
    font-size: 12px;
    color: #94a3b8;
}

.transcript-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
}

.badge-question {
    background: ${this.colors.accent}20;
    color: ${this.colors.accent};
}

.badge-comment {
    background: #e2e8f0;
    color: #64748b;
}

.qa-section {
    padding: 40px;
    background: ${this.colors.background};
}

.qa-list {
    display: flex;
    flex-direction: column;
    gap: 24px;
}

.qa-item {
    background: white;
    border-radius: 16px;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
}

.qa-question {
    padding: 20px 24px;
    background: ${this.colors.accent}10;
    border-left: 4px solid ${this.colors.accent};
}

.qa-question-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: ${this.colors.accent};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
}

.qa-answer {
    padding: 20px 24px;
    background: ${this.colors.primary}05;
    border-left: 4px solid ${this.colors.primary};
}

.qa-answer-label {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    color: ${this.colors.primary};
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 8px;
}

.qa-sources {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #e2e8f0;
}

.qa-sources-label {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 8px;
}

.qa-source-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: #f1f5f9;
    border-radius: 4px;
    font-size: 12px;
    color: ${this.colors.primary};
    text-decoration: none;
    margin-right: 8px;
    margin-bottom: 8px;
}

.qa-source-link:hover {
    background: ${this.colors.primary}10;
}

.footer {
    padding: 30px 40px;
    background: #1e293b;
    color: white;
    text-align: center;
}

.footer p {
    font-size: 14px;
    opacity: 0.9;
}

.footer .timestamp {
    font-size: 12px;
    opacity: 0.6;
    margin-top: 8px;
}

@media print {
    body {
        background: white;
        padding: 0;
    }
    
    .container {
        box-shadow: none;
        border-radius: 0;
    }
    
    .transcript-item:hover {
        background: transparent;
    }
}
`;
    }

    /**
     * 트랜스크립트 HTML 생성
     */
    generateTranscriptHTML() {
        if (this.transcripts.length === 0) {
            return '<p class="empty-state">녹음된 내용이 없습니다.</p>';
        }

        return this.transcripts.map((item, index) => {
            const speakerType = item.speaker?.type || item.speaker || 'primary';
            const isPrimary = speakerType === 'primary';
            const speakerLabel = isPrimary ? '발표자' : '참석자';
            const speakerInitial = isPrimary ? 'P' : 'Q';
            
            let itemClass = speakerType;
            if (item.isQuestion) itemClass += ' question';
            if (item.isComment) itemClass += ' comment';

            const timestamp = item.timestamp instanceof Date 
                ? item.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
                : '';

            return `
            <div class="transcript-item ${itemClass}">
                <div class="speaker-avatar ${speakerType}">${speakerInitial}</div>
                <div class="transcript-content">
                    <div class="transcript-bubble">
                        ${this.escapeHtml(item.text)}
                    </div>
                    <div class="transcript-meta">
                        <span>${speakerLabel}</span>
                        ${timestamp ? `<span>${timestamp}</span>` : ''}
                        ${item.isQuestion ? '<span class="transcript-badge badge-question">❓ 질문</span>' : ''}
                        ${item.isComment ? '<span class="transcript-badge badge-comment">💬 코멘트</span>' : ''}
                    </div>
                </div>
            </div>`;
        }).join('');
    }

    /**
     * Q&A HTML 생성
     */
    generateQAHTML() {
        if (this.aiAnswers.length === 0 && this.questions.length === 0) {
            return '<p class="empty-state">질문이 없습니다.</p>';
        }

        return this.aiAnswers.map((qa, index) => {
            const sourcesHTML = qa.sources && qa.sources.length > 0 
                ? `
                <div class="qa-sources">
                    <div class="qa-sources-label">📎 참고 자료</div>
                    ${qa.sources.map(s => `<a href="${this.escapeHtml(s.url || s)}" class="qa-source-link" target="_blank">${this.escapeHtml(s.title || s.url || s)}</a>`).join('')}
                </div>`
                : '';

            return `
            <div class="qa-item">
                <div class="qa-question">
                    <div class="qa-question-label">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        질문 ${index + 1}
                    </div>
                    <p>${this.escapeHtml(qa.question)}</p>
                </div>
                <div class="qa-answer">
                    <div class="qa-answer-label">
                        <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                        </svg>
                        AI 답변
                    </div>
                    <div>${this.formatAnswer(qa.answer)}</div>
                    ${sourcesHTML}
                </div>
            </div>`;
        }).join('');
    }

    /**
     * 요약 포맷팅
     */
    formatSummary(summary) {
        if (!summary) return '';
        
        // 마크다운 스타일 변환
        let formatted = this.escapeHtml(summary);
        
        // 리스트 변환
        formatted = formatted.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
        formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
        
        // 줄바꿈 변환
        formatted = formatted.replace(/\n\n/g, '</p><p>');
        formatted = formatted.replace(/\n/g, '<br>');
        
        return `<p>${formatted}</p>`;
    }

    /**
     * 답변 포맷팅
     */
    formatAnswer(answer) {
        if (!answer) return '';
        
        let formatted = this.escapeHtml(answer);
        formatted = formatted.replace(/\n\n/g, '</p><p>');
        formatted = formatted.replace(/\n/g, '<br>');
        
        return `<p>${formatted}</p>`;
    }

    /**
     * HTML 이스케이프
     */
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * 발화자 수 계산
     */
    countSpeakers() {
        const speakers = new Set();
        this.transcripts.forEach(t => {
            const speaker = t.speaker?.type || t.speaker || 'primary';
            speakers.add(speaker);
        });
        return Math.max(1, speakers.size);
    }

    /**
     * HTML 파일 다운로드
     */
    downloadHTML(filename = 'meeting-notes') {
        const html = this.generateHTML();
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}_${this.getTimestamp()}.html`;
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(url), 100);
        
        return true;
    }

    /**
     * 타임스탬프 생성
     */
    getTimestamp() {
        const now = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
    }

    /**
     * 데이터 초기화
     */
    clear() {
        this.transcripts = [];
        this.questions = [];
        this.aiAnswers = [];
        this.summary = '';
    }
}

// 전역으로 내보내기
window.MeetingExporter = MeetingExporter;
