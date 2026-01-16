from typing import Dict, Tuple
from .contracts import Side

class CostModel:
    """
    A-Share Cost Simulation
    - Commission: 0.025% (min 5 CNY)
    - Stamp Duty: 0.1% (Sell only)
    - Slippage: 0.02% (Simulated execution impact)
    """

    def __init__(self, commission_rate=0.00025, min_commission=5.0, stamp_duty_rate=0.001, slippage_rate=0.0002):
        self.commission_rate = commission_rate
        self.min_commission = min_commission
        self.stamp_duty_rate = stamp_duty_rate
        self.slippage_rate = slippage_rate

    def get_execution_price(self, side: Side, signal_price: float) -> float:
        """
        Apply slippage to the signal price.
        Buy pays more, Sell gets less.
        """
        if side == Side.BUY:
            return signal_price * (1 + self.slippage_rate)
        else:
            return signal_price * (1 - self.slippage_rate)

    def calculate_costs(self, side: Side, price: float, qty: int) -> Dict[str, float]:
        """
        Calculate total transaction costs.
        """
        trade_value = price * qty
        
        # 1. Commission (Buy & Sell)
        commission = max(self.min_commission, trade_value * self.commission_rate)
        
        # 2. Stamp Duty (Sell only)
        stamp_duty = trade_value * self.stamp_duty_rate if side == Side.SELL else 0.0
        
        # 3. Transfer Fee (Simplified: ignored or part of commission for MVP)
        transfer_fee = 0.0

        total = commission + stamp_duty + transfer_fee
        
        return {
            "commission": float(f"{commission:.2f}"),
            "stamp_duty": float(f"{stamp_duty:.2f}"),
            "total": float(f"{total:.2f}")
        }
