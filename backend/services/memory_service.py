
import json
import os
import hashlib
from typing import List, Dict, Any, Optional
from datetime import datetime

class MemoryService:
    """
    Experience Store (RAG Core).
    Stores trading episodes with full context for future retrieval/replay.
    Key Structure: trade_day + symbol + intent_type + strategy_id + rule_version
    """
    
    FILE_PATH = "data/trade_memory.json"

    def __init__(self):
        self.memories = self._load()

    def record_experience(self, 
                          trade_day: str, 
                          symbol: str, 
                          intent_type: str, 
                          strategy_id: str, 
                          rule_version: str, 
                          outcome_data: Dict[str, Any]):
        """
        Save a completed trading episode (Experience).
        outcome_data should include:
        - entry_reason
        - exit_reason
        - pnl_pct
        - costs
        - slippage
        - max_drawdown
        """
        
        # Generate deterministic ID for deduplication
        raw_key = f"{trade_day}_{symbol}_{intent_type}_{strategy_id}_{rule_version}"
        memory_id = hashlib.md5(raw_key.encode()).hexdigest()
        
        entry = {
            "id": memory_id,
            "key_factors": {
                "trade_day": trade_day,
                "symbol": symbol,
                "intent_type": intent_type,
                "strategy_id": strategy_id,
                "rule_version": rule_version
            },
            "outcome": {
                "result": "WIN" if outcome_data.get('pnl_pct', 0) > 0 else "LOSS",
                "pnl_pct": outcome_data.get('pnl_pct', 0),
                "entry_reason": outcome_data.get('entry_reason', ''),
                "exit_reason": outcome_data.get('exit_reason', ''),
                "blocked_reason": outcome_data.get('blocked_reason', None)
            },
            "metrics": {
                "costs": outcome_data.get('costs', 0),
                "slippage": outcome_data.get('slippage', 0),
                "drawdown": outcome_data.get('drawdown', 0)
            },
            "timestamp": datetime.now().isoformat()
        }
        
        # Update existing or append new
        existing_idx = next((i for i, m in enumerate(self.memories) if m['id'] == memory_id), -1)
        if existing_idx >= 0:
            self.memories[existing_idx] = entry
        else:
            self.memories.append(entry)
            
        self._save()

    def record_trade(self, symbol: str, name: str, date: str, pnl_pct: float, reason: str, strategy_id: str):
        """Legacy wrapper for backward compatibility"""
        self.record_experience(
            trade_day=date,
            symbol=symbol,
            intent_type="Legacy",
            strategy_id=strategy_id,
            rule_version="1.0",
            outcome_data={
                "pnl_pct": pnl_pct,
                "entry_reason": reason,
                "exit_reason": "Legacy Exit"
            }
        )

    def get_context(self, symbol: str, top_k: int = 3) -> List[Dict[str, Any]]:
        """
        Retrieve relevant history for this symbol.
        Deterministic retrieval: Sorted by date desc, then outcome.
        """
        related = [m for m in self.memories if m['key_factors']['symbol'] == symbol]
        
        # Sort by date (newest first)
        related.sort(key=lambda x: x['key_factors']['trade_day'], reverse=True)
        
        results = []
        for m in related[:top_k]:
            results.append({
                "date": m['key_factors']['trade_day'],
                "outcome": m['outcome']['result'],
                "pnl_pct": m['outcome']['pnl_pct'],
                "entry_reason": m['outcome']['entry_reason']
            })
        return results

    def _save(self):
        try:
            os.makedirs("data", exist_ok=True)
            with open(self.FILE_PATH, "w", encoding='utf-8') as f:
                json.dump(self.memories, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"Memory Save Error: {e}")

    def _load(self) -> List[Dict]:
        if not os.path.exists(self.FILE_PATH):
            return []
        try:
            with open(self.FILE_PATH, "r", encoding='utf-8') as f:
                return json.load(f)
        except:
            return []

memory_service = MemoryService()
