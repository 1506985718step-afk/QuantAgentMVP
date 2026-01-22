
import json
import os
import aiofiles
from datetime import datetime
from typing import Dict, Any

class ScratchpadStore:
    """
    Append-only storage for high-frequency logs (JSONL).
    Used for:
    1. Ticks (Market Data Snapshots)
    2. Intent Generation Traces (Raw LLM I/O)
    3. Tool Calls
    """
    
    def __init__(self, log_dir: str = "data/logs"):
        self.log_dir = log_dir
        os.makedirs(self.log_dir, exist_ok=True)
        self.current_file = f"{self.log_dir}/scratchpad_{datetime.now().strftime('%Y%m%d')}.jsonl"

    async def log(self, category: str, payload: Dict[str, Any]):
        """
        Async write to JSONL.
        """
        entry = {
            "ts": datetime.now().isoformat(),
            "cat": category,
            "data": payload
        }
        
        try:
            async with aiofiles.open(self.current_file, mode='a', encoding='utf-8') as f:
                await f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception as e:
            print(f"[Scratchpad] Write failed: {e}")

scratchpad = ScratchpadStore()
