
import json
import httpx
import random
from typing import Dict, Any, List
from ..app.settings import settings

class LLMService:
    def __init__(self):
        self.api_key = settings.DEEPSEEK_API_KEY
        self.api_url = settings.DEEPSEEK_API_URL
        self.mode = settings.MODE
        
        if not self.api_key and self.mode == "live":
            print("WARN: DEEPSEEK_API_KEY not set in environment. LLM features will be disabled.")

    async def chat_completion(self, messages: List[Dict[str, str]]) -> str:
        """
        Free-form chat with the Investment Expert persona.
        """
        if self.mode != "live":
             return "当前处于回放/训练模式。AI 对话仅在实盘连接模式下可用。"

        if not self.api_key:
            return "AI 服务未连接 (API Key missing)。请检查 .env 配置。"

        system_prompt = """你是一位拥有20年华尔街与A股实战经验的资深量化投资专家，名字叫 'DeepSeek Quant'。
你的投资哲学结合了巴菲特的价值投资和西蒙斯的量化数学模型。
请用简练、专业的中文回答。"""

        # Prepend system prompt
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "deepseek-chat",
            "messages": full_messages,
            "temperature": 0.7, 
            "max_tokens": 2000,
            "stream": False
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(self.api_url, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()
                return data['choices'][0]['message']['content']
        except Exception as e:
            print(f"DeepSeek Chat Error: {e}")
            return "AI 思考超时或网络中断，请稍后再试。"

    async def analyze(self, symbol: str, name: str, price: float, change_pct: float, vol_ratio: float, market_sentiment: int, news_context: List[Dict] = [], past_lessons: List[Dict] = []) -> Dict[str, Any]:
        """
        Analyze a single stock using DeepSeek V3 (Async).
        """
        
        # P0 Requirement: Deterministic behavior in replay/mock
        if self.mode in ["replay", "mock"]:
            is_bullish = vol_ratio > 1.8 and change_pct > 0 and change_pct < 5.0
            confidence = min(90, int(vol_ratio * 10 + market_sentiment * 0.5))
            
            return {
                "signal": is_bullish,
                "confidence": confidence,
                "pattern_name": "Backtest_Volume_Breakout" if is_bullish else "Consolidation",
                "reasoning": f"[Replay Mode] Volume ratio {vol_ratio:.2f} meets threshold. Sentiment {market_sentiment}. (Deterministic)"
            }

        if not self.api_key:
            return self._fallback_result("API Key missing in env")

        sys_prompt = "You are a quantitative trading expert specializing in short-term breakout strategies for A-shares. You must output strict JSON."
        
        news_str = "No major news."
        if news_context:
            news_str = "\n".join([f"- {n['time']} {n['source']}: {n['title']}" for n in news_context])
            
        memory_str = "No past history."
        if past_lessons:
            memory_str = "WARNING - PAST TRADES ON THIS SYMBOL:\n"
            for m in past_lessons:
                memory_str += f"- {m['exit_date']}: {m['outcome']} ({m['pnl_pct']}%) Reason: {m['entry_reason']}\n"
            memory_str += "Consider these past mistakes or successes in your decision."

        user_prompt = f"""
Analyze the following stock data and decide if a BUY signal is warranted.
Symbol: {symbol} ({name})
Price: {price}
Change: {change_pct}%
Volume Ratio: {vol_ratio:.2f}
Market Sentiment Score: {market_sentiment}/100

Recent Market News:
{news_str}

**Institutional Memory (Important):**
{memory_str}

Criteria:
1. Volume Ratio > 1.5
2. Positive Trend
3. Good Market Sentiment (News impact considered)
4. Learn from past Memory (Don't repeat same mistake)

Return valid JSON with this schema:
{{
  "signal": boolean,
  "confidence": number, // 0-100
  "pattern_name": string,
  "reasoning": string // max 50 words
}}
"""
        return await self._call_deepseek(sys_prompt, user_prompt, fallback_key="signal")

    async def audit_daily_performance(self, date: str, account: Dict, trades: List[Dict], events: List[Dict]) -> Dict[str, Any]:
        """
        Generate a daily audit report.
        """
        if self.mode in ["replay", "mock"]:
             return {
                "score": 85,
                "status": "PASS",
                "checks": [{"rule_name": "Replay Audit", "status": "PASS", "details": "Day completed in simulation."}],
                "ai_suggestions": ["Replay mode active. No live AI insights."]
            }

        if not self.api_key:
            return self._fallback_audit("API Key missing")

        sys_prompt = "You are a strict Risk Manager and Trading Auditor. You analyze trading logs and output a strict JSON audit report."
        
        # Simplified summary for LLM context window limits
        trades_summary = json.dumps(trades, indent=2, ensure_ascii=False)
        
        user_prompt = f"""
Perform a Post-Market Audit for {date}.
Account Status: {account.get('total_equity')}
Trades: {trades_summary}

Task: Score (0-100), Status (PASS/FAIL), Suggestions.
Output strictly JSON.
"""
        return await self._call_deepseek(sys_prompt, user_prompt, fallback_key="audit")

    async def _call_deepseek(self, sys_prompt: str, user_prompt: str, fallback_key: str) -> Dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        payload = {
            "model": "deepseek-chat",
            "messages": [
                {"role": "system", "content": sys_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "response_format": { "type": "json_object" },
            "temperature": 0.2,
            "max_tokens": 1000
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(self.api_url, headers=headers, json=payload)
                response.raise_for_status()
                
                data = response.json()
                content = data['choices'][0]['message']['content']
                
                # Cleanup Markdown code blocks if present
                if content.strip().startswith("```"):
                    lines = content.strip().split('\n')
                    if len(lines) >= 3:
                        content = '\n'.join(lines[1:-1])
                
                return json.loads(content)

        except Exception as e:
            print(f"DeepSeek API Error: {e}")
            if fallback_key == "audit":
                return self._fallback_audit(str(e))
            return self._fallback_result(str(e))

    def _fallback_result(self, reason: str) -> Dict[str, Any]:
        return {
            "signal": False,
            "confidence": 0,
            "pattern_name": "Error",
            "reasoning": f"DeepSeek Analysis Failed: {reason}"
        }

    def _fallback_audit(self, reason: str) -> Dict[str, Any]:
        return {
            "score": 50,
            "status": "WARN",
            "checks": [{"rule_name": "System Check", "status": "WARN", "details": f"AI Audit Failed: {reason}"}],
            "ai_suggestions": ["Check API connection", "Review logs manually"]
        }
