
import json
import os
from typing import List, Dict, Any
from datetime import datetime

class MemoryService:
    """
    RAG Lite: Trading Journal & Memory System.
    Stores closed trades and their outcomes.
    Retrieves 'Lessons Learned' when analyzing the same symbol again.
    """
    
    FILE_PATH = "data/trade_memory.json"

    def __init__(self):
        self.memories = self._load()

    def record_trade(self, symbol: str, entry_date: str, exit_date: str, pnl_pct: float, reason: str, strategy: str):
        """
        Save a closed trade to memory.
        """
        entry = {
            "symbol": symbol,
            "entry_date": entry_date,
            "exit_date": exit_date,
            "pnl_pct": pnl_pct,
            "outcome": "WIN" if pnl_pct > 0 else "LOSS",
            "entry_reason": reason,
            "strategy": strategy,
            "timestamp": datetime.now().isoformat()
        }
        self.memories.append(entry)
        self._save()

    def get_context(self, symbol: str) -> List[Dict[str, Any]]:
        """
        Retrieve relevant history for this symbol.
        Returns top 3 most recent interactions.
        """
        related = [m for m in self.memories if m['symbol'] == symbol]
        # Sort by date desc
        related.sort(key=lambda x: x['timestamp'], reverse=True)
        return related[:3]

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
