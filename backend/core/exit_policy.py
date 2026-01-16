from typing import Optional, Dict, Any
import uuid
from .contracts import Position, TradeIntent, Side, IntentType, IntentSource, IntentVersion

class ExitPolicy:
    """
    方案 B (Enhanced): Configurable Exit Strategy
    Features:
    - Percentage-based Stop Loss
    - Percentage-based Take Profit
    - Partial Position Scaling (tp1_sell_ratio)
    - T+1 Time Stop (Strict)
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        # Default config per requirements
        self.config = config or {
            "take_profit_pct": 0.05,          # 第一止盈阈值：+5%
            "tp1_sell_ratio": 0.5,            # 达到止盈后卖出比例：50%
            "trailing_drawdown_pct": 0.03,    # 移动止损回撤：3% (Placeholder for MVP)
            "stop_loss_pct": 0.02,            # 固定止损：-2%
            "time_stop_days": 1,              # T+1
            "time_stop_threshold": 0.01,      # 1%
            "rule_version": "exit_B_1.0"
        }

    def check_exit(self, position: Position, session_id: str, trade_day: str) -> Optional[TradeIntent]:
        # Convert thresholds to percentage (0-100 scale matches Position model)
        tp_threshold = self.config["take_profit_pct"] * 100
        sl_threshold = self.config["stop_loss_pct"] * 100
        time_stop_threshold = self.config["time_stop_threshold"] * 100
        
        # 1. Hard Stop Loss Check (Logic: PnL % <= -2%)
        # Priority: High. Protect capital first.
        if position.unrealized_pnl_pct <= -sl_threshold:
             return self._create_intent(
                 position, 
                 IntentType.STOP_LOSS_SELL, 
                 1.0, # Sell 100% on Stop Loss
                 f"Hit Stop Loss (-{sl_threshold}%): Current {position.unrealized_pnl_pct:.2f}%",
                 session_id,
                 trade_day
             )

        # 2. Hard Take Profit Check (+5%) with Partial Sell
        if position.unrealized_pnl_pct >= tp_threshold:
             ratio = self.config.get("tp1_sell_ratio", 1.0)
             return self._create_intent(
                 position, 
                 IntentType.TAKE_PROFIT_SELL, 
                 ratio,
                 f"Hit Take Profit (+{tp_threshold}%), Selling {ratio*100}%: Current {position.unrealized_pnl_pct:.2f}%",
                 session_id,
                 trade_day
             )
        
        # 3. Time Stop (Strict T+1)
        # 在买入后的第一个“完整交易日结束时”（T+1 收盘）
        # 若该标的“收盘价相对成本涨幅 < 1%”
        # 则在下一交易日（T+2）开盘卖出。
        if position.days_held >= self.config["time_stop_days"] and position.unrealized_pnl_pct < time_stop_threshold:
             return self._create_intent(
                 position,
                 IntentType.SELL,
                 1.0, # Sell All
                 f"Time Stop T+{position.days_held}: Held >= {self.config['time_stop_days']} days & PnL < {time_stop_threshold}%",
                 session_id,
                 trade_day
             )

        return None

    def _create_intent(self, pos: Position, type: IntentType, ratio: float, reason: str, session_id: str, trade_day: str) -> TradeIntent:
        # Calculate quantity based on ratio
        qty_to_sell = int(pos.quantity * ratio)
        
        # Ensure we don't sell 0 if we own something
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
