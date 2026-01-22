
import copy
import uuid
from typing import Optional, Dict, List
from ..core.contracts import StrategyConfig, TradeMetrics, AuditReport
from .validation_agent import validation_agent

class RefinementAgent:
    """
    The 'Growth' Engine.
    Analyzes Daily Reports and suggests Strategy Config updates.
    Output: A 'Proposal' that must be applied by the System (or Human).
    """

    def refine_config(self, current_config: StrategyConfig, metrics: TradeMetrics, audit: AuditReport) -> StrategyConfig:
        """
        Generates a new configuration proposal based on performance metrics.
        Does not modify the system state directly; returns a new config object.
        """
        new_config = copy.deepcopy(current_config)
        reasoning = []
        
        # --- Logic: Adaptive Parameter Tuning ---

        # 1. Volatility Threshold (Noise Filter)
        # If win rate is low (< 40%) over enough trades, we are likely trading noise.
        # Action: Increase Volatility Threshold to filter for stronger signals.
        if metrics.total_trades > 5 and metrics.win_rate < 0.40:
            step = 0.2
            new_val = min(3.0, current_config.vol_threshold + step)
            if new_val != current_config.vol_threshold:
                new_config.vol_threshold = new_val
                reasoning.append(f"Low Win Rate ({metrics.win_rate:.2f}) -> Increased Vol Threshold to {new_val:.1f}x")

        # 2. Stop Loss (Risk Control)
        # If Drawdown is approaching limit (> 3%), tighten Stop Loss.
        if metrics.max_drawdown > 0.03: 
            step = 0.5
            new_val = max(1.0, current_config.stop_loss_pct - step)
            if new_val != current_config.stop_loss_pct:
                new_config.stop_loss_pct = new_val
                reasoning.append(f"High Drawdown ({metrics.max_drawdown:.1%}) -> Tightened Stop Loss to {new_val:.1f}%")

        # 3. Take Profit (Trend Capturing)
        # If Win Rate is high (> 60%) and Profit Factor is good (> 1.5), try to let profits run more.
        if metrics.win_rate > 0.60 and metrics.profit_factor > 1.5:
            step = 1.0
            new_val = min(15.0, current_config.take_profit_pct + step)
            if new_val != current_config.take_profit_pct:
                new_config.take_profit_pct = new_val
                reasoning.append(f"Strong Performance -> Expanded Take Profit to {new_val:.1f}%")

        # --- Validation & Versioning ---
        
        # Only return new config if changes were made AND it passes validation
        if reasoning:
            is_valid, msg = validation_agent.validate_strategy_config(new_config)
            if is_valid:
                new_config.update_reason = " | ".join(reasoning)
                new_config.last_updated = audit.date
                # In a real system, we would increment a version number here
                return new_config
            else:
                print(f"[Refinement] Proposal rejected by ValidationAgent: {msg}")
        
        # If no changes or invalid, return original
        return current_config

refinement_agent = RefinementAgent()
