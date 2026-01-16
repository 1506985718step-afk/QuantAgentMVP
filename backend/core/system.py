from typing import List, Dict, Any
from datetime import datetime
import uuid

from .contracts import (
    AccountSummary, Position, TradeIntent, SystemEvent, MarketSnapshot,
    AgentType, Decision, Severity, EventType, Side, OrderStatus, StrategyConfig, AuditReport
)
from .trade_guard import TradeGuard
from .execution_engine import ExecutionEngine
from .exit_policy import ExitPolicy
from .events import *
from ..services.sina_data import sina_provider
from ..agents.strategy_agent import StrategyAgent
from ..services.llm_service import LLMService

class TradingSystem:
    def __init__(self):
        # 1. State Initialization
        self.account = AccountSummary(
            total_equity=100000.0, # Increased for Python backend demo
            available_cash=100000.0,
            market_value=0.0,
            day_pnl=0.0,
            day_pnl_pct=0.0,
            filled_buys_today=0
        )
        self.positions: List[Position] = []
        self.intents: List[TradeIntent] = []
        self.events: List[SystemEvent] = []
        
        # 2. Components
        self.guard = TradeGuard(max_daily_buys=5)
        self.engine = ExecutionEngine()
        self.exit_policy = ExitPolicy()
        self.strategy_agent = StrategyAgent()
        self.llm_service = LLMService() # Integrated LLM Service
        
        # 3. Market State
        self.market_snapshot = MarketSnapshot(
            index_price=3000.0, change_pct=0.0, sentiment_score=60, 
            volatility_index=15, up_count=0, down_count=0, 
            limit_up_count=0, limit_down_count=0
        )
        
        # 4. Strategy Config
        self.strategy_config = StrategyConfig(
            vol_threshold=1.5, stop_loss_pct=3.0, take_profit_pct=8.0, 
            max_drawdown_limit=5.0, last_updated=datetime.now().isoformat(), 
            update_reason="Init"
        )
        
        # 5. Audit Cache
        self.audit_report = AuditReport(
            date=datetime.now().strftime("%Y-%m-%d"),
            score=100, status="PASS", checks=[], 
            ai_suggestions=["System Initialized. Waiting for trading data."], 
            active_config=self.strategy_config
        )
        
        self._log(EventType.MARKET_SNAPSHOT, "SYSTEM", Decision.INFO, "System Initialized (Python Backend)")

    def get_state(self) -> Dict[str, Any]:
        """Return full UI state"""
        # Note: We don't sync on every read to avoid API limits, assuming sync happens on 'tick'
        return {
            "account": self.account.model_dump(),
            "positions": [p.model_dump() for p in self.positions],
            "intents": [i.model_dump() for i in self.intents],
            "market": self.market_snapshot.model_dump(),
            "events": [e.model_dump() for e in self.events[-50:]], 
            "audit": self.audit_report.model_dump(),
            "metrics": { "win_rate": 0, "profit_factor": 0, "total_trades": 0, "avg_win_pnl": 0, "avg_loss_pnl": 0, "max_drawdown": 0, "cost_ratio": 0 },
            "orders": [] 
        }

    def tick(self):
        """
        Main Loop Cycle:
        1. Sync Market Data
        2. Run Strategy Agent (Generate Signals)
        3. Run Exit Policy (Generate Sells)
        """
        # 1. Sync Data
        realtime_data = self._sync_market_data()
        
        # 2. Strategy Scan
        new_intents = self.strategy_agent.run_cycle(self.market_snapshot, realtime_data, self.strategy_config)
        
        for intent in new_intents:
            # Check for duplicates
            if any(i.symbol == intent.symbol and i.side == intent.side and i.status == OrderStatus.PENDING for i in self.intents):
                continue
                
            # Guard Check (Pre-check)
            receipt = self.guard.check(intent, self.account.filled_buys_today)
            if receipt.decision == Decision.ALLOW:
                # Add to Intents List as PENDING (Waiting for human approval)
                intent.status = OrderStatus.PENDING 
                self.intents.insert(0, intent)
                
                self._log(EventType.SIGNAL_EMITTED, AgentType.STRATEGY, Decision.INFO, 
                          f"Signal: {intent.symbol} {intent.reason}", symbol=intent.symbol)

        # 3. Exit Policy
        # (Already implemented in mock, needs integration here if we want auto-exits)
        # For now, we skip auto-exit generation to keep it simple, or we can iterate positions.
        
        return {"status": "ticked", "signals": len(new_intents)}

    def submit_intent(self, intent: TradeIntent) -> bool:
        """Handle human approval"""
        
        # 1. Guard Check
        receipt = self.guard.check(intent, self.account.filled_buys_today)
        
        if receipt.decision == Decision.BLOCK:
            self._log(EventType.GUARD_BLOCKED, AgentType.RISK, Decision.BLOCK, 
                      f"Guard Blocked: {receipt.reason_text}", symbol=intent.symbol)
            return False

        # 2. Update status and move to execution
        # Find local object if exists to update status in place
        existing = next((i for i in self.intents if i.intent_id == intent.intent_id), None)
        if existing:
            existing.status = OrderStatus.SUBMITTED
        else:
            intent.status = OrderStatus.SUBMITTED
            self.intents.insert(0, intent)
        
        self._log(EventType.HUMAN_APPROVED, AgentType.EXECUTION, Decision.ALLOW, 
                  f"Intent Accepted: {intent.side} {intent.symbol}", symbol=intent.symbol)
        
        # 3. Execute immediately
        self._execute_trade(intent)
        return True

    def cancel_order(self, intent_id: str):
        found = False
        for i in self.intents:
            if i.intent_id == intent_id:
                i.status = OrderStatus.CANCELLED
                found = True
                break
        
        if found:
            self._log(EventType.ORDER_REJECTED, AgentType.BROKER, Decision.INFO, "Order Cancelled by User", symbol=None)

    def set_equity(self, amount: float):
        old = self.account.total_equity
        self.account.total_equity = amount
        self.account.available_cash = amount - self.account.market_value
        self._log(EventType.DAILY_REPORT, AgentType.SYSTEM, Decision.INFO, f"Equity Adjusted: {old} -> {amount}")

    def generate_audit(self) -> Dict[str, Any]:
        """Trigger AI Audit Generation"""
        self._log(EventType.DAILY_REPORT, AgentType.AUDIT, Decision.INFO, "Starting AI Audit...")
        
        # Prepare Data
        filled_orders = [i.model_dump() for i in self.intents if i.status == OrderStatus.FILLED]
        recent_events = [e.model_dump() for e in self.events if e.ts.startswith(datetime.now().strftime("%Y-%m-%d"))]
        
        # Call LLM
        result = self.llm_service.audit_daily_performance(
            date=datetime.now().strftime("%Y-%m-%d"),
            account=self.account.model_dump(),
            trades=filled_orders,
            events=recent_events
        )
        
        # Update State
        self.audit_report = AuditReport(
            date=datetime.now().strftime("%Y-%m-%d"),
            score=result.get("score", 0),
            status=result.get("status", "FAIL"),
            checks=result.get("checks", []),
            ai_suggestions=result.get("ai_suggestions", []),
            active_config=self.strategy_config
        )
        
        return self.audit_report.model_dump()

    def _execute_trade(self, intent: TradeIntent):
        costs = 5.0 
        fill_price = intent.price 
        
        valid, msg = self.engine.validate_order(intent, self.positions, self.account.available_cash)
        if not valid:
            self._log(EventType.ORDER_REJECTED, AgentType.EXECUTION, Decision.BLOCK, msg, symbol=intent.symbol)
            intent.status = OrderStatus.REJECTED
            return

        self.positions = self.engine.apply_fill(self.positions, intent, fill_price, costs)
        
        cash_change = (fill_price * intent.qty)
        if intent.side == Side.BUY:
            self.account.available_cash -= (cash_change + costs)
            self.account.filled_buys_today += 1
        else:
            self.account.available_cash += (cash_change - costs)
            
        intent.status = OrderStatus.FILLED
        intent.filled_qty = intent.qty
        
        self._log(EventType.ORDER_FILLED, AgentType.BROKER, Decision.EXECUTE, 
                  f"Filled {intent.side} {intent.qty} @ {fill_price}", symbol=intent.symbol)

    def _sync_market_data(self) -> Dict[str, Any]:
        """Fetch real prices"""
        symbols = [item['symbol'] for item in self.strategy_agent.watchlist]
        for p in self.positions:
            if p.symbol not in symbols:
                symbols.append(p.symbol)
                
        data = sina_provider.get_realtime_data(symbols)
        
        if '000001' in data:
            sz_data = data['000001']
            self.market_snapshot.index_price = sz_data['price']
            self.market_snapshot.change_pct = sz_data['change_pct']
        
        # Update Positions PnL
        total_mkt_val = 0
        total_pnl = 0
        
        for pos in self.positions:
            if pos.symbol in data:
                mkt = data[pos.symbol]
                curr_price = mkt['price']
                if curr_price > 0:
                    pos.current_price = curr_price
                    pos.market_value = pos.quantity * curr_price
                    pos.unrealized_pnl = pos.market_value - (pos.quantity * pos.average_cost)
                    cost_basis = pos.quantity * pos.average_cost
                    pos.unrealized_pnl_pct = (pos.unrealized_pnl / cost_basis * 100) if cost_basis > 0 else 0
            
            total_mkt_val += pos.market_value
            total_pnl += pos.unrealized_pnl

        self.account.market_value = total_mkt_val
        self.account.total_equity = self.account.available_cash + total_mkt_val
        self.account.day_pnl = total_pnl
        
        return data
        
    def _log(self, type: str, agent: str, decision: str, text: str, symbol: str = None):
        evt = SystemEvent(
            trade_day=datetime.now().strftime("%Y-%m-%d"),
            session_id="sess_live",
            type=type,
            agent=agent, 
            decision=decision, 
            reason_text=text,
            symbol=symbol,
            severity=Severity.INFO
        )
        self.events.append(evt)

trading_system = TradingSystem()
