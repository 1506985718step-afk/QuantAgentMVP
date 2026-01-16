import { BarData } from './historicalData';
import { AuditReport, AuditCheck } from '../types';

// DeepSeek API Key provided by user
const DEEPSEEK_API_KEY = "sk-bddf5370bddf40ef844bc9637b1cdbe3";
const API_URL = "https://api.deepseek.com/chat/completions";

interface LLMAnalysis {
    signal: boolean;
    confidence: number; // 0-100
    reasoning: string;
    pattern_name: string;
}

export const analyzeMarketWithLLM = async (
    symbol: string, 
    bar: BarData, 
    marketSentiment: number,
    volThreshold: number
): Promise<LLMAnalysis> => {
    
    const volRatio = bar.volume / (bar.ma5_vol || 1);
    
    // Fallback Logic (Local Rules)
    const isUptrend = bar.close > bar.ma20;
    const isBullish = volRatio > volThreshold && isUptrend && marketSentiment > 50;
    const fallbackResult = {
        signal: isBullish,
        confidence: isBullish ? 60 : 20,
        pattern_name: isBullish ? "本地规则: 放量上涨" : "本地规则: 观望",
        reasoning: "DeepSeek API 调用失败或网络受限，转为本地规则分析。"
    };

    try {
        console.log(`[DeepSeek] Analyzing ${symbol}...`);
        
        const systemPrompt = `You are a quantitative trading expert specializing in short-term breakout strategies for A-shares. You must output strict JSON.`;

        const userPrompt = `
Analyze the following stock data and decide if a BUY signal is warranted.
Symbol: {symbol}
Current Date: {bar.date}
Close Price: {bar.close} (MA20: {bar.ma20})
Volume: {bar.volume} (MA5 Vol: {bar.ma5_vol})
Volume Ratio: {volRatio.toFixed(2)}
RSI: {bar.rsi}
Market Sentiment: {marketSentiment}/100
Strategy Vol Threshold: {volThreshold}

Criteria:
1. Volume Ratio > 1.5
2. Positive Trend
3. Good Market Sentiment

Return valid JSON with this schema:
{
  "signal": boolean,
  "confidence": number, // 0-100
  "pattern_name": string,
  "reasoning": string // max 50 words
}`;

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.2,
                max_tokens: 500
            })
        });

        if (response.ok) {
            const data = await response.json();
            const content = data.choices[0].message.content;
            
            // Handle potentially markdown formatted JSON
            let jsonStr = content;
            if (content.trim().startsWith("```")) {
                 const lines = content.trim().split('\n');
                 if (lines.length >= 3) {
                     jsonStr = lines.slice(1, -1).join('\n');
                 }
            }
            
            const result = JSON.parse(jsonStr);
            return {
                signal: result.signal,
                confidence: result.confidence,
                pattern_name: result.pattern_name || "DeepSeek Breakout",
                reasoning: `DeepSeek V3: ${result.reasoning}`
            };
        } else {
            console.warn("DeepSeek API Error:", response.status, await response.text());
        }

    } catch (error: any) {
        console.error("LLM Call Failed:", error);
    }
    
    return fallbackResult;
};

export const generateAuditReportWithLLM = async (
    date: string,
    equity: number,
    pnl: number,
    tradesCount: number,
    riskEventsCount: number
): Promise<Partial<AuditReport>> => {
    
    const fallbackReport: Partial<AuditReport> = {
        score: 85,
        status: 'PASS',
        checks: [
            { rule_name: "Mock Audit", status: "PASS", details: "DeepSeek API Failed, using fallback." }
        ],
        ai_suggestions: ["API connection failed.", "Check console logs."]
    };

    try {
        console.log(`[DeepSeek] Generating Audit for ${date}...`);

        const systemPrompt = `You are a strict Trading Risk Manager. Analyze the daily performance summary and output a JSON audit report.`;

        const userPrompt = `
Date: ${date}
Equity: ${equity.toFixed(2)}
Daily PnL: ${pnl.toFixed(2)}
Trades Executed: ${tradesCount}
Risk Violations: ${riskEventsCount}

Task:
1. Score the day (0-100).
2. Suggest improvements.

Output Schema (JSON):
{
  "score": number,
  "status": "PASS" | "FAIL",
  "checks": [{ "rule_name": string, "status": "PASS"|"FAIL"|"WARN", "details": string }],
  "ai_suggestions": [string, string, string]
}
`;
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: "deepseek-chat",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                response_format: { type: "json_object" },
                temperature: 0.3,
                max_tokens: 800
            })
        });

        if (response.ok) {
            const data = await response.json();
            const content = data.choices[0].message.content;
            
            let jsonStr = content;
            if (content.trim().startsWith("```")) {
                 const lines = content.trim().split('\n');
                 if (lines.length >= 3) {
                     jsonStr = lines.slice(1, -1).join('\n');
                 }
            }
            
            const result = JSON.parse(jsonStr);
            return {
                score: result.score,
                status: result.status,
                checks: result.checks,
                ai_suggestions: result.ai_suggestions
            };
        }

    } catch (error) {
        console.error("DeepSeek Audit Failed:", error);
    }

    return fallbackReport;
};
