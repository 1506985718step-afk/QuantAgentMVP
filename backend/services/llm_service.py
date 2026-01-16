import json
import httpx
from typing import Dict, Any, List
from ..app.settings import settings

class LLMService:
    def __init__(self):
        self.api_key = settings.DEEPSEEK_API_KEY
        self.api_url = settings.DEEPSEEK_API_URL
        
        if not self.api_key:
            print("WARN: DEEPSEEK_API_KEY not set. LLM disabled.")

    async def chat_completion(self, messages: List[Dict[str, str]]) -> str:
        """
        Free-form chat with the Investment Expert persona.
        """
        if not self.api_key:
            return "AI 服务未连接 (API Key missing)。请检查后端配置。"

        system_prompt = """你是一位拥有20年华尔街与A股实战经验的资深量化投资专家，名字叫 'DeepSeek Quant'。
你的投资哲学结合了巴菲特的价值投资和西蒙斯的量化数学模型。

你的职责与风格：
1. **身份设定**：你是用户的投资导师，语气专业、冷静、客观，但也富有同理心。
2. **市场解读**：基于用户的问题，解读市场情绪、技术形态（K线、均线、RSI）和宏观数据。
3. **量化科普**：用通俗易懂的语言解释量化策略逻辑（如波动率、夏普比率、凯利公式、盈亏比）。
4. **心理按摩**：敏锐捕捉用户的非理性交易行为（如追涨杀跌、过度交易），进行善意的警示和心理建设。
5. **合规红线**：严禁推荐具体的股票代码作为“必涨”标的。如果用户问“买什么”，请从选股逻辑、板块趋势或风险控制角度回答。
6. **回答格式**：言简意赅，逻辑清晰，必须使用 Markdown 格式（如列表、加粗）优化阅读体验。"""

        # Prepend system prompt
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }

        # Note: Chat does not enforce JSON object, allowing free text/markdown
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

    async def analyze(self, symbol: str, name: str, price: float, change_pct: float, vol_ratio: float, market_sentiment: int) -> Dict[str, Any]:
        """
        Analyze a single stock using DeepSeek V3 (Async).
        """
        if not self.api_key:
            return self._fallback_result("API Key missing")

        sys_prompt = "You are a quantitative trading expert specializing in short-term breakout strategies for A-shares. You must output strict JSON."
        
        user_prompt = f"""
Analyze the following stock data and decide if a BUY signal is warranted.
Symbol: {symbol} ({name})
Price: {price}
Change: {change_pct}%
Volume Ratio: {vol_ratio:.2f}
Market Sentiment Score: {market_sentiment}/100

Criteria:
1. Volume Ratio > 1.5
2. Positive Trend
3. Good Market Sentiment

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
        Generate a daily audit report using DeepSeek V3 (Async).
        """
        if not self.api_key:
            return self._fallback_audit("API Key missing")

        sys_prompt = "You are a strict Risk Manager and Trading Auditor. You analyze trading logs and output a strict JSON audit report."
        
        trades_summary = json.dumps(trades, indent=2, ensure_ascii=False)
        events_summary = json.dumps([e for e in events if e.get('decision') == 'BLOCK' or e.get('severity') == 'WARN'], indent=2, ensure_ascii=False)
        
        user_prompt = f"""
Perform a Post-Market Audit for {date}.

**Account Status:**
- Equity: {account.get('total_equity')}
- Day PnL: {account.get('day_pnl')} ({account.get('day_pnl_pct')}%)
- Compliance: {len(events)} risk events logged.

**Executed Trades:**
{trades_summary}

**Risk Events (Blocks/Warns):**
{events_summary}

**Task:**
1. Calculate a Risk Score (0-100, where 100 is perfect discipline). Deduct points for blocked trades or large losses.
2. Determine Pass/Fail status.
3. Analyze behavioral patterns (Overtrading, Revenge Trading, etc.).
4. Provide 3 actionable suggestions.

**Output Schema (JSON Only):**
{{
  "score": number,
  "status": "PASS" | "FAIL",
  "checks": [
    {{ "rule_name": "Daily Loss Limit", "status": "PASS"|"FAIL"|"WARN", "details": "string" }},
    {{ "rule_name": "Trading Discipline", "status": "PASS"|"FAIL"|"WARN", "details": "string" }},
    {{ "rule_name": "Strategy Execution", "status": "PASS"|"FAIL"|"WARN", "details": "string" }}
  ],
  "ai_suggestions": ["string", "string", "string"]
}}
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
