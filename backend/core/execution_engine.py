from typing import List, Tuple, Optional
from .contracts import Position, TradeIntent, Side

class ExecutionEngine:
    """
    Core Logic for Order Validation (T+1) and Position Management.
    """

    def validate_order(self, intent: TradeIntent, positions: List[Position], available_cash: float) -> Tuple[bool, str]:
        # 1. Buy Checks
        if intent.side == Side.BUY:
            # Basic cash check (ignoring exact costs for pre-check)
            est_cost = intent.price * intent.qty
            if available_cash < est_cost:
                return False, f"Insufficient cash: Need {est_cost}, Have {available_cash}"
            return True, "OK"

        # 2. Sell Checks (T+1 Rule)
        if intent.side == Side.SELL:
            pos = next((p for p in positions if p.symbol == intent.symbol), None)
            if not pos:
                return False, f"Position {intent.symbol} not found"
            
            # STRICT T+1 CHECK
            if pos.sellable < intent.qty:
                return False, f"T+1 Violation: Sellable {pos.sellable} < Requested {intent.qty}"
            
            return True, "OK"

        return False, "Invalid Side"

    def apply_fill(self, positions: List[Position], intent: TradeIntent, fill_price: float, costs: float) -> List[Position]:
        """
        Updates the positions list based on a filled order.
        Returns the updated list (mutated or new).
        """
        # Find existing position
        idx = next((i for i, p in enumerate(positions) if p.symbol == intent.symbol), -1)

        if intent.side == Side.BUY:
            # BUY Logic: Increase Qty, Sellable UNCHANGED (T+1)
            cost_basis = (fill_price * intent.qty) + costs
            
            if idx >= 0:
                p = positions[idx]
                new_qty = p.quantity + intent.qty
                # Avg Cost = (Old Val + New Val) / New Qty
                new_avg = ((p.quantity * p.average_cost) + cost_basis) / new_qty
                
                p.quantity = new_qty
                p.average_cost = new_avg
                p.today_buys += 1
                p.current_price = fill_price
                p.market_value = new_qty * fill_price
                # Recalculate PnL
                p.unrealized_pnl = p.market_value - (p.quantity * p.average_cost)
                if p.quantity * p.average_cost > 0:
                     p.unrealized_pnl_pct = (p.unrealized_pnl / (p.quantity * p.average_cost)) * 100
            else:
                # New Position
                new_pos = Position(
                    symbol=intent.symbol,
                    name=intent.name,
                    quantity=intent.qty,
                    sellable=0, # T+1 Rule: Newly bought is not sellable today
                    average_cost=cost_basis / intent.qty,
                    current_price=fill_price,
                    market_value=fill_price * intent.qty,
                    unrealized_pnl=-costs,
                    unrealized_pnl_pct=0.0,
                    today_buys=1
                )
                positions.append(new_pos)

        elif intent.side == Side.SELL:
            # SELL Logic: Decrease Qty AND Sellable
            if idx >= 0:
                p = positions[idx]
                new_qty = p.quantity - intent.qty
                new_sellable = p.sellable - intent.qty
                
                if new_qty <= 0:
                    positions.pop(idx)
                else:
                    p.quantity = new_qty
                    p.sellable = new_sellable # Reduce available
                    p.market_value = new_qty * fill_price
                    # PnL update
                    p.unrealized_pnl = p.market_value - (p.quantity * p.average_cost)
                    if p.quantity * p.average_cost > 0:
                        p.unrealized_pnl_pct = (p.unrealized_pnl / (p.quantity * p.average_cost)) * 100

        return positions

    def settle_overnight(self, positions: List[Position]) -> List[Position]:
        """
        Simulate Day-End Settlement.
        Rule: sellable becomes equal to quantity.
        """
        for p in positions:
            p.sellable = p.quantity
            p.today_buys = 0
        return positions