
import asyncio
from typing import List, Dict, Any
from .contracts import StrategyConfig
from ..services.mock_generator import MockGenerator

class ExperimentRunner:
    """
    Runs automated scenarios ('Experiments') to validate the current strategy.
    Typically run at EOD or triggered manually.
    """
    
    def __init__(self, system_ref):
        self.system = system_ref # Reference to the singleton TradingSystem
        self.scenarios = [
            {"name": "2024 Panic Drop", "date": "2024-01-15", "days": 5},
            {"name": "2024 V-Rebound", "date": "2024-02-01", "days": 5},
            {"name": "9.24 Bull Run", "date": "2024-09-18", "days": 5}
        ]

    async def run_daily_validation(self) -> List[Dict[str, Any]]:
        """
        Runs the bot through key historical scenarios to check robustness.
        Returns a list of results.
        NOTE: This resets the system state temporarily!
        """
        results = []
        original_state = self.system.get_state() # Simple backup (in-memory)

        print("[Experiment] Starting Daily Validation...")

        for scenario in self.scenarios:
            # 1. Reset System for Scenario
            self.system.reset_state(initial_equity=100000.0, trade_day=scenario["date"])
            
            # 2. Run Loop for N days
            for _ in range(scenario["days"]):
                await self.system.tick()
                # Fast forward a day
                self.system.positions = self.system.engine.settle_overnight(self.system.positions)
                self.system.account.filled_buys_today = 0
                
                # Mock Next Date (Simple Increment for MVP)
                # In real app, use calendar. Here we rely on MockGenerator's stateless nature mostly
                # or just run ticks on same day to stress test intraday logic.
                # For MVP experiment, running multiple ticks on same day is safer for MockGen consistency.
            
            # 3. Capture Result
            metrics = self.system.metrics
            results.append({
                "scenario": scenario["name"],
                "pnl_pct": self.system.account.day_pnl_pct,
                "drawdown": metrics.max_drawdown,
                "trades": metrics.total_trades,
                "status": "PASS" if self.system.account.day_pnl_pct > -5.0 else "FAIL" # Hard fail limit
            })

        # 4. Restore (Best Effort) or Leave Reset
        # For MVP, we leave it at the last state or re-init. 
        # Ideally, we should reload from disk.
        self.system._load_from_disk_sync() 
        print("[Experiment] Validation Complete.")
        
        return results
