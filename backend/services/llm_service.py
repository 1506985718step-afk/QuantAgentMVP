
import json
import httpx
import hashlib
from typing import Dict, Any, List
from ..app.settings import settings

class LLMService:
    def __init__(self):
        self.api_key = settings.DEEPSEEK_API_KEY
        self.api_url = settings.DEEPSEEK_API_URL
        self.mode = settings.MODE
        
        if not self.api_key and self.mode == "live":
            print("WARN: DEEPSEEK_API_KEY not set in environment. LLM features will be disabled.")

    def _get_deterministic_response(self, seed_str: str) -> Dict[str, Any]:
        """
        Constraint #3.2: Replay mode must be deterministic.
        Generate a consistent 'AI' decision based on input hash.
        """
        hash_val = int(hashlib.sha256(seed_str.encode('utf-8')).hexdigest(), 16)
        
        # Deterministic Logic:
        # Vol Ratio is usually the main driver in the prompt, implied by the hash here for simulation
        signal_strength = hash_val % 100
        is_buy = signal_strength > 70 
        
        return {
            "signal": is_buy,
            "confidence": signal_strength,
            "pattern_name": "Deterministic_Replay_Pattern" if is_buy else "Wait_Signal",
            "reasoning": f"[Replay/Mock] Deterministic AI output based on input hash. (Signal: {signal_strength}%)"
        }

    async def chat_completion(self, messages: List[Dict[str, str]]) -> str:
        """
        Constraint: AI Chat forbidden in Replay/Mock to prevent illusion of live intel.
        """
        if self.mode != "live":
             return "当前处于回放/训练模式。为保证训练严谨性，实时 AI 对话已禁用。"

        if not self.api_key:
            return "AI 服务未连接 (API Key missing)。"

        system_prompt = """你是一位拥有20年华尔街与A股实战经验的资深量化投资专家，名字叫 'DeepSeek Quant'。
请用简练、专业的中文回答。"""

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
        Analyze a single stock.
        Constraint #2.3: AI Outputs suggestions, does not write state.
        Constraint #3.2: Deterministic in Replay.
        """
        
        # Strict Determinism for Replay/Mock
        if self.mode in ["replay", "mock"]:
            # Seed based on symbol and current market data to ensure same input = same output
            seed_input = f"{symbol}_{price}_{vol_ratio}_{market_sentiment}"
            return self._get_deterministic_response(seed_input)

        if not self.api_key:
            return self._fallback_result("API Key missing in env")

        sys_prompt = "You are a quantitative trading expert. Output strict JSON."
        
        news_str = "No major news."
        if news_context:
            news_str = "\n".join([f"- {n['time']} {n['source']}: {n['title']}" for n in news_context])
            
        memory_str = "No past history."
        if past_lessons:
            memory_str = "WARNING - PAST TRADES:\n"
            for m in past_lessons:
                memory_str += f"- {m['exit_date']}: {m['outcome']} ({m['pnl_pct']}%) Reason: {m['entry_reason']}\n"

        user_prompt = f"""
Analyze BUY signal.
Symbol: {symbol} ({name})
Price: {price}
Change: {change_pct}%
Vol Ratio: {vol_ratio:.2f}
Sentiment: {market_sentiment}

News: {news_str}
Memory: {memory_str}

Criteria:
1. Vol Ratio > 1.5
2. Positive Trend
3. Learn from Memory

JSON Schema:
{{ "signal": bool, "confidence": int, "pattern_name": str, "reasoning": str }}
"""
        return await self._call_deepseek(sys_prompt, user_prompt, fallback_key="signal")

    async def audit_daily_performance(self, date: str, account: Dict, trades: List[Dict], events: List[Dict]) -> Dict[str, Any]:
        """
        Constraint #2.3: Audit is read-only.
        """
        if self.mode in ["replay", "mock"]:
             return {
                "score": 100,
                "status": "PASS",
                "checks": [{"rule_name": "Replay Audit", "status": "PASS", "details": "Simulation day completed."}],
                "ai_suggestions": ["Replay mode active. Standard execution."]
            }

        if not self.api_key:
            return self._fallback_audit("API Key missing")

        sys_prompt = "You are a Risk Manager. Output strict JSON."
        trades_summary = json.dumps(trades, indent=2, ensure_ascii=False)
        
        user_prompt = f"""
Audit {date}.
Account: {account.get('total_equity')}
Trades: {trades_summary}

Schema: {{ "score": int, "status": "PASS"|"FAIL", "checks": [], "ai_suggestions": [] }}
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
            "reasoning": f"Analysis Failed: {reason}"
        }

    def _fallback_audit(self, reason: str) -> Dict[str, Any]:
        return {
            "score": 50,
            "status": "WARN",
            "checks": [{"rule_name": "System Check", "status": "WARN", "details": f"Audit Failed: {reason}"}],
            "ai_suggestions": ["Check API connection"]
        }
