import json
import requests
from typing import Dict, Any, List
from ..app.settings import settings

class LLMService:
    def __init__(self):
        self.api_key = settings.DEEPSEEK_API_KEY
        self.api_url = settings.DEEPSEEK_API_URL
        
        if not self.api_key:
            print("WARN: DEEPSEEK_API_KEY not set. LLM disabled.")

    def analyze(self, symbol: str, name: str, price: float, change_pct: float, vol_ratio: float, market_sentiment: int) -> Dict[str, Any]:
        """
        Analyze a single stock using DeepSeek V3.
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
        
        return self._call_deepseek(sys_prompt, user_prompt, fallback_key="signal")

    def audit_daily_performance(self, date: str, account: Dict, trades: List[Dict], events: List[Dict]) -> Dict[str, Any]:
        """
        Generate a daily audit report using DeepSeek V3.
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
        return self._call_deepseek(sys_prompt, user_prompt, fallback_key="audit")

    def _call_deepseek(self, sys_prompt: str, user_prompt: str, fallback_key: str) -> Dict[str, Any]:
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
            response = requests.post(self.api_url, headers=headers, json=payload, timeout=20)
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
