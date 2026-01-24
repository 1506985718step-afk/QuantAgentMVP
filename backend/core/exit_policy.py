
from typing import Optional, Dict, Any
import uuid
from datetime import datetime
from .contracts import Position, TradeIntent, Side, IntentType, IntentSource, IntentVersion, AgentProfile, AgentType
from .interfaces import BaseAgent

class ExitPolicy(BaseAgent):
    """
    ExitPolicy-B (Trend Following Decision Tree).
    Rules:
    1. Hard Stop Loss: price <= stop_loss
    2. Time Stop (Smart): Held > N days AND return < Threshold (and sellable).
    3. Trailing Stop: If (Max_PnL - Current_PnL) > Drawdown_Limit -> SELL.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {
            "rule_version": "Exit-B-1.2",
            "stop_loss_pct": 3.0,
            "time_stop_days": 1, 
            "time_stop_threshold": 1.0,
            "trailing_stop_activation_pct": 5.0,
            "trailing_drawdown_pct": 2.5,
            "tp1_sell_ratio": 1.0,
        }
        self.last_triggered = None

    def get_profile(self) -> AgentProfile:
        return AgentProfile(
            agent_id="exit_policy_v1",
            type=AgentType.EXIT,
            authority="AUTO_SELL_ONLY",
            can_open_position=False,
            can_close_position=True,
            last_triggered=self.last_triggered,
            impact_score=-0.3, # Negative impact means selling/risk reduction
            description="Exit Policy B: Trend Following + Hard Stop + Time Stop"
        )

    def check_exit(self, position: Position, session_id: str, trade_day: str) -> Optional[TradeIntent]:
        """
        Evaluates position against the decision tree.
        """
        sl_threshold = self.config["stop_loss_pct"]
        time_limit = self.config["time_stop_days"]
        time_min_return = self.config["time_stop_threshold"]
        trailing_activation = self.config["trailing_stop_activation_pct"]
        trailing_drawdown = self.config["trailing_drawdown_pct"]
        
        current_pnl = position.unrealized_pnl_pct
        max_pnl = position.max_pnl_pct
        
        intent = None
        
        # --- Rule 1: Hard Stop Loss ---
        if current_pnl <= -sl_threshold:
             intent = self._create_intent(
                 position, 
                 IntentType.STOP_LOSS_SELL, 
                 1.0, 
                 f"Hard Stop: PnL {current_pnl:.2f}% <= -{sl_threshold}%",
                 session_id, trade_day
             )

        # --- Rule 2: Time Stop (T+1 Impatience) ---
        elif position.days_held >= time_limit and current_pnl < time_min_return:
             intent = self._create_intent(
                 position,
                 IntentType.TIME_STOP_SELL,
                 1.0,
                 f"Time Stop: Held {position.days_held}d, PnL {current_pnl:.2f}% < {time_min_return}%",
                 session_id, trade_day
             )

        # --- Rule 3: Trailing Stop (Trend Reversal) ---
        elif max_pnl >= trailing_activation:
            drawdown = max_pnl - current_pnl
            if drawdown >= trailing_drawdown:
                intent = self._create_intent(
                    position,
                    IntentType.TAKE_PROFIT_SELL,
                    1.0,
                    f"Trailing Stop: Peak {max_pnl:.2f}%, Drawdown {drawdown:.2f}% >= {trailing_drawdown}%",
                    session_id, trade_day
                )

        if intent:
            self.last_triggered = datetime.now().isoformat()
            
        return intent

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
            strategy_id="exit_policy_B",
            reason=reason,
            source=IntentSource(
                source_event_id=f"exit_{uuid.uuid4().hex[:8]}", 
                trigger="exit_policy"
            ),
            version=IntentVersion(rule_version=self.config["rule_version"])
        )
