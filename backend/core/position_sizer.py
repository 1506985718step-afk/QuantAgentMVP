import math
from typing import Optional
from .contracts import TradeIntent, Side

class PositionSizer:
    """
    MVP Position Sizer:
    1. Risk-Based Sizing: Qty = (Account * Risk%) / (Price - StopLoss)
    2. Small Capital Exemption: If calculated < 1 lot but cash allows, buy 1 lot.
    3. A-Share Rules: Round to 100 shares.
    """
    
    def __init__(self, risk_per_trade_pct: float = 0.02):
        self.risk_per_trade_pct = risk_per_trade_pct
        self.lot_size = 100

    def calculate_qty(
        self, 
        total_equity: float, 
        available_cash: float, 
        price: float, 
        stop_loss: Optional[float] = None
    ) -> int:
        if price <= 0:
            return 0

        # 1. Determine base quantity
        if stop_loss and price > stop_loss:
            # Risk Model: Amount to lose = Equity * Risk%
            risk_amount = total_equity * self.risk_per_trade_pct
            risk_per_share = price - stop_loss
            raw_qty = risk_amount / risk_per_share
        else:
            # Fallback: Fixed percentage of equity (e.g. 20% position)
            # Or simplified MVP: Buy max possible within constraints
            target_position_value = total_equity * 0.2 
            raw_qty = target_position_value / price

        # 2. Round down to nearest lot
        lots = math.floor(raw_qty / self.lot_size)
        qty = lots * self.lot_size

        # 3. Small Capital Exemption (MVP Goal 4)
        # If risk model says "buy 0" (too risky or small account), 
        # but we have enough cash for 1 lot, allow it.
        cost_1_lot = price * self.lot_size
        if qty == 0 and available_cash >= cost_1_lot:
             qty = self.lot_size

        # 4. Hard Cash Constraint (Absolute limit)
        total_cost = qty * price
        if total_cost > available_cash:
            # Downgrade size to fit cash
            max_lots = math.floor(available_cash / (price * self.lot_size))
            qty = max_lots * self.lot_size

        return int(qty)
