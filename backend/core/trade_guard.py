from typing import Tuple
from .contracts import TradeIntent, Decision, IntentType, Side, AgentType, GuardReceipt, EventSnapshots
from .events import GUARD_BLOCKED, GUARD_CHECKED

class TradeGuard:
    """
    Hard-coded risk rules. 
    Rule 1: Only block BUYs. SELLs are escape hatches.
    Rule 2: Daily buy limit per symbol.
    """
    
    def __init__(self, max_daily_buys: int = 5):
        self.max_daily_buys = max_daily_buys
        self.rule_version = "1.0.0"

    def check(self, intent: TradeIntent, filled_buys_today: int) -> GuardReceipt:
        
        # Base Snapshot for evidence
        snapshots = EventSnapshots(
            config={"max_daily_buys": self.max_daily_buys, "rule_version": self.rule_version},
            state={"filled_buys_today": filled_buys_today},
            evidence={"intent_side": intent.side, "intent_type": intent.intent_type}
        )

        # Rule 1: Always allow sells (Escape Hatch)
        if intent.side == Side.SELL:
            return GuardReceipt(
                decision=Decision.ALLOW,
                reason_code="ESCAPE_HATCH",
                reason_text="Sell side always allowed (Escape Hatch)",
                snapshots=snapshots
            )
        
        # Rule 1.b: Allow specific reduce-only intents explicitly
        if intent.intent_type in [IntentType.STOP_LOSS_SELL, IntentType.TAKE_PROFIT_SELL, IntentType.REDUCE_ONLY]:
            return GuardReceipt(
                decision=Decision.ALLOW,
                reason_code="REDUCE_ONLY_ALLOW",
                reason_text="Reduce-only intent allowed",
                snapshots=snapshots
            )

        # Rule 2: Check Daily Buy Limit
        if filled_buys_today >= self.max_daily_buys:
            return GuardReceipt(
                decision=Decision.BLOCK,
                reason_code="DAILY_LIMIT_REACHED",
                reason_text=f"Daily buy limit reached ({filled_buys_today}/{self.max_daily_buys})",
                snapshots=snapshots
            )
            
        return GuardReceipt(
            decision=Decision.ALLOW,
            reason_code="RISK_CHECK_PASS",
            reason_text="Risk check passed",
            snapshots=snapshots
        )
