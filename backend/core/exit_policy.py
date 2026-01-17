
from typing import Optional, Dict, Any
import uuid
from .contracts import Position, TradeIntent, Side, IntentType, IntentSource, IntentVersion

class ExitPolicy:
    """
    Exit Strategy
    - Take Profit / Stop Loss (Real-time or EOD)
    - Time Stop: Evaluated at T+1 Close, Executed at T+2 Open (via next day scan).
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {
            "take_profit_pct": 0.05,
            "tp1_sell_ratio": 0.5,
            "stop_loss_pct": 0.02,
            "time_stop_days": 1, 
            "time_stop_threshold": 0.01,
            "rule_version": "exit_B_1.0"
        }

    def check_exit(self, position: Position, session_id: str, trade_day: str) -> Optional[TradeIntent]:
        # Convert thresholds to percentage
        tp_threshold = self.config["take_profit_pct"] * 100
        sl_threshold = self.config["stop_loss_pct"] * 100
        time_stop_threshold = self.config["time_stop_threshold"] * 100
        
        # 1. Hard Stop Loss
        if position.unrealized_pnl_pct <= -sl_threshold:
             return self._create_intent(
                 position, 
                 IntentType.STOP_LOSS_SELL, 
                 1.0, 
                 f"Hit Stop Loss (-{sl_threshold}%): Current {position.unrealized_pnl_pct:.2f}%",
                 session_id, trade_day
             )

        # 2. Hard Take Profit
        if position.unrealized_pnl_pct >= tp_threshold:
             ratio = self.config.get("tp1_sell_ratio", 1.0)
             return self._create_intent(
                 position, 
                 IntentType.TAKE_PROFIT_SELL, 
                 ratio,
                 f"Hit Take Profit (+{tp_threshold}%), Selling {ratio*100}%",
                 session_id, trade_day
             )
        
        # 3. Time Stop (Strict Definition)
        # Evaluated when days_held >= time_stop_days.
        # This check runs during the "next day" scan.
        # If today is T+2 (held=2) and performance was bad at T+1 close (implied by current state if early in day), we sell.
        if position.days_held > self.config["time_stop_days"] and position.unrealized_pnl_pct < time_stop_threshold:
             return self._create_intent(
                 position,
                 IntentType.TIME_STOP_SELL, # Correct Intent Type
                 1.0,
                 f"Time Stop: Held {position.days_held} days, PnL {position.unrealized_pnl_pct:.2f}% < {time_stop_threshold}%",
                 session_id, trade_day
             )

        return None

    def _create_intent(self, pos: Position, type: IntentType, ratio: float, reason: str, session_id: str, trade_day: str) -> TradeIntent:
        qty_to_sell = int(pos.quantity * ratio)
        if qty_to_sell == 0 and pos.quantity > 0:
            qty_to_sell = pos.quantity 

        return TradeIntent(
            trade_day=trade_day,
            session_id=session_id,
            symbol=pos.symbol,
            name=pos.name,
            side=Side.SELL,
            intent_type=type,
            qty=qty_to_sell,
            price=pos.current_price, 
            reduce_only=True,
            strategy_id="exit_policy_v1",
            reason=reason,
            source=IntentSource(
                source_event_id=f"auto_gen_{uuid.uuid4().hex[:8]}", 
                trigger="exit_policy"
            ),
            version=IntentVersion(rule_version=self.config["rule_version"])
        )
