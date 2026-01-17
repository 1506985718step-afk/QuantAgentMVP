
from typing import List, Dict, Any
from datetime import datetime
import uuid
import json
import os
import shutil
import asyncio
from ..app.settings import settings

from .contracts import (
    AccountSummary, Position, TradeIntent, SystemEvent, MarketSnapshot,
    AgentType, Decision, Severity, EventType, Side, OrderStatus, StrategyConfig, AuditReport, TradeMetrics
)
from .trade_guard import TradeGuard
from .execution_engine import ExecutionEngine
from .exit_policy import ExitPolicy
from .events import *
from ..services.sina_data import sina_provider
from ..agents.strategy_agent import StrategyAgent
from ..services.llm_service import LLMService
from ..services.memory_service import memory_service

DATA_FILE = "data/state.json"

class TradingSystem:
    def __init__(self):
        # 1. State Initialization
        self.account = AccountSummary(
            total_equity=100000.0, 
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
        self.llm_service = LLMService() 
        
        # 3. Market State
        self.market_snapshot = MarketSnapshot(
            index_price=3000.0, change_pct=0.0, sentiment_score=60, 
            volatility_index=15, up_count=0, down_count=0, 
            limit_up_count=0, limit_down_count=0,
            replay_date=settings.TRADE_DAY
        )
        
        # 4. Strategy Config
        self.strategy_config = StrategyConfig(
            vol_threshold=1.5, stop_loss_pct=3.0, take_profit_pct=8.0, 
            max_drawdown_limit=5.0, last_updated=datetime.now().isoformat(), 
            update_reason="Init"
        )
        
        # 5. Metrics & Audit
        self.metrics = TradeMetrics(
            win_rate=0, profit_factor=0, total_trades=0, 
            avg_win_pnl=0, avg_loss_pnl=0, max_drawdown=0, cost_ratio=0
        )
        self.audit_report = AuditReport(
            date=settings.TRADE_DAY,
            score=100, status="PASS", checks=[], 
            ai_suggestions=["System Initialized."], 
            active_config=self.strategy_config
        )
        
        self._load_from_disk()

    def get_state(self) -> Dict[str, Any]:
        return {
            "account": self.account.model_dump(),
            "positions": [p.model_dump() for p in self.positions],
            "intents": [i.model_dump() for i in self.intents],
            "market": self.market_snapshot.model_dump(),
            "events": [e.model_dump() for e in self.events[-50:]], 
            "audit": self.audit_report.model_dump(),
            "metrics": self.metrics.model_dump(),
            "orders": [],
            # Exposed Watchlist for Frontend Sync
            "watchlist": self.strategy_agent.get_watchlist() 
        }

    def _calculate_metrics(self):
        """Re-calculate metrics based on event history (Closed Trades)"""
        filled_sells = [e for e in self.events if e.type == EventType.ORDER_FILLED and "SELL" in e.reason_text]
        total_trades = len(filled_sells)
        
        start_equity = 100000.0
        current_equity = self.account.total_equity
        
        # Drawdown
        peak_equity = max(start_equity, current_equity) 
        drawdown = (peak_equity - current_equity) / peak_equity if peak_equity > 0 else 0
        
        # Estimate Win Rate
        win_rate = 0.5 
        if total_trades > 0:
            win_rate = 0.55 if self.account.day_pnl >= 0 else 0.45
            
        self.metrics.max_drawdown = drawdown
        self.metrics.total_trades = total_trades
        self.metrics.win_rate = win_rate
        
        # Pass active config to audit report for UI visibility
        self.audit_report.active_config = self.strategy_config

    async def tick(self):
        """
        Main Loop (Replay/Live)
        """
        # 1. Sync Data (Positions + Watchlist + Index)
        realtime_data = await self._sync_market_data()
        
        # 2. Update Market Snapshot (Index)
        if '000001' in realtime_data:
            idx = realtime_data['000001']
            self.market_snapshot.index_price = idx['price']
            self.market_snapshot.change_pct = idx['change_pct']
        
        # 3. Mark-to-Market (Update Position Values)
        self._update_valuations(realtime_data)

        # 4. Update Metrics & Adapt Strategy
        self._calculate_metrics()
        
        # --- ADAPTIVE LOGIC START ---
        self.strategy_config = self.strategy_agent.adapt_config(self.strategy_config, self.metrics)
        
        if "Mode" in self.strategy_config.update_reason and self.events and self.events[-1].reason_text != self.strategy_config.update_reason:
             self._log(EventType.STRATEGY_UPDATED, AgentType.STRATEGY, Decision.INFO, 
                       self.strategy_config.update_reason)
        # --- ADAPTIVE LOGIC END ---

        # 5. Exit Policy Scan (Check against updated PnL)
        for pos in self.positions:
            exit_intent = self.exit_policy.check_exit(pos, "sess_live", settings.TRADE_DAY)
            if exit_intent:
                self._process_intent_lifecycle(exit_intent)

        # 6. Strategy Scan (Entry)
        new_intents = await self.strategy_agent.run_cycle(self.market_snapshot, realtime_data, self.strategy_config)
        
        for intent in new_intents:
            # Dedup
            if any(i.symbol == intent.symbol and i.side == intent.side and i.status == OrderStatus.PENDING for i in self.intents):
                continue
            self._process_intent_lifecycle(intent)

        self._save_to_disk()
        return {"status": "ticked", "signals": len(new_intents)}

    def _update_valuations(self, data_map: Dict[str, Any]):
        """Update PnL and Market Value for all positions based on latest prices"""
        total_mv = 0.0
        
        for pos in self.positions:
            if pos.symbol in data_map:
                quote = data_map[pos.symbol]
                current_price = quote['price']
                
                # Update Position State
                pos.current_price = current_price
                pos.market_value = pos.quantity * current_price
                
                # Update PnL
                cost_basis = pos.quantity * pos.average_cost
                pos.unrealized_pnl = pos.market_value - cost_basis
                if cost_basis > 0:
                    pos.unrealized_pnl_pct = (pos.unrealized_pnl / cost_basis) * 100
            
            total_mv += pos.market_value

        # Update Account State
        prev_equity = self.account.total_equity
        self.account.market_value = total_mv
        self.account.total_equity = self.account.available_cash + total_mv
        
        self.account.day_pnl = self.account.total_equity - 100000.0 
        self.account.day_pnl_pct = (self.account.day_pnl / 100000.0) * 100

    def _process_intent_lifecycle(self, intent: TradeIntent):
        # 1. Guard Check
        receipt = self.guard.check(intent, self.account.filled_buys_today)
        
        if receipt.decision == Decision.BLOCK:
            self._log(EventType.GUARD_BLOCKED, AgentType.RISK, Decision.BLOCK, 
                      f"Blocked: {receipt.reason_text}", symbol=intent.symbol)
            return

        # 2. Add to Pending
        intent.status = OrderStatus.PENDING
        self.intents.insert(0, intent)
        self._log(EventType.SIGNAL_EMITTED, AgentType.STRATEGY, Decision.INFO, 
                  f"New Signal: {intent.side} {intent.symbol} ({intent.intent_type})", symbol=intent.symbol)

    def submit_intent(self, intent: TradeIntent) -> bool:
        """Handle human approval"""
        # Re-check Guard (Safety)
        receipt = self.guard.check(intent, self.account.filled_buys_today)
        if receipt.decision == Decision.BLOCK:
            return False

        # Update status
        existing = next((i for i in self.intents if i.intent_id == intent.intent_id), None)
        if existing:
            existing.status = OrderStatus.SUBMITTED
        else:
            intent.status = OrderStatus.SUBMITTED
            self.intents.insert(0, intent)
        
        self._log(EventType.HUMAN_APPROVED, AgentType.EXECUTION, Decision.ALLOW, 
                  f"Approved: {intent.side} {intent.symbol}", symbol=intent.symbol)
        
        # Execute
        self._execute_trade(intent)
        self._save_to_disk()
        return True

    def _execute_trade(self, intent: TradeIntent):
        costs = 5.0 
        fill_price = intent.price 
        
        # VALIDATE via Engine (Cash, T+1)
        valid, msg = self.engine.validate_order(intent, self.positions, self.account.available_cash)
        
        if not valid:
            self._log(EventType.ORDER_REJECTED, AgentType.EXECUTION, Decision.BLOCK, 
                      f"Execution Failed: {msg}", symbol=intent.symbol)
            intent.status = OrderStatus.REJECTED
            return
        
        # Record Memory (PnL)
        if intent.side == Side.SELL:
             pos = next((p for p in self.positions if p.symbol == intent.symbol), None)
             if pos:
                 realized_pnl = (fill_price - pos.average_cost) * intent.qty - costs
                 realized_pnl_pct = (realized_pnl / (pos.average_cost * intent.qty)) * 100 if pos.average_cost > 0 else 0
                 
                 memory_service.record_trade(
                     symbol=intent.symbol,
                     entry_date="Unknown", 
                     exit_date=settings.TRADE_DAY,
                     pnl_pct=realized_pnl_pct,
                     reason=intent.reason,
                     strategy=intent.strategy_id
                 )

        # FILL
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

    async def _sync_market_data(self) -> Dict[str, Any]:
        """Fetch prices for Positions + Watchlist + Index"""
        position_symbols = [p.symbol for p in self.positions]
        watchlist_symbols = [w['symbol'] for w in self.strategy_agent.watchlist]
        index_symbols = ['000001']
        all_symbols = list(set(position_symbols + watchlist_symbols + index_symbols))
        return await sina_provider.get_realtime_data(all_symbols)

    def cancel_order(self, intent_id: str):
        for i in self.intents:
            if i.intent_id == intent_id:
                i.status = OrderStatus.CANCELLED
                self._log(EventType.ORDER_REJECTED, AgentType.BROKER, Decision.INFO, "Cancelled by User")
                self._save_to_disk()
                break

    def set_equity(self, amount: float):
        self.account.total_equity = amount
        self.account.available_cash = amount - self.account.market_value
        self._save_to_disk()

    async def generate_audit(self):
        """Call LLM to generate audit report based on current state"""
        try:
            trades_summary = [
                {"symbol": e.symbol, "type": e.type, "desc": e.reason_text} 
                for e in self.events if e.type == EventType.ORDER_FILLED
            ]
            
            report_data = await self.llm_service.audit_daily_performance(
                date=settings.TRADE_DAY,
                account=self.account.model_dump(),
                trades=trades_summary,
                events=[e.model_dump() for e in self.events]
            )
            
            self.audit_report = AuditReport(
                date=settings.TRADE_DAY,
                score=report_data.get("score", 0),
                status=report_data.get("status", "FAIL"),
                checks=[{"rule_name": c["rule_name"], "status": c["status"], "details": c["details"]} for c in report_data.get("checks", [])],
                ai_suggestions=report_data.get("ai_suggestions", []),
                active_config=self.strategy_config
            )
            
            self._log(EventType.DAILY_REPORT, AgentType.AUDIT, Decision.INFO, f"Audit Generated. Score: {self.audit_report.score}")
            self._save_to_disk()
            return self.audit_report
        except Exception as e:
            print(f"Audit Generation Error: {e}")
            return self.audit_report

    def _log(self, type: str, agent: str, decision: str, text: str, symbol: str = None):
        evt = SystemEvent(
            trade_day=settings.TRADE_DAY,
            session_id="sess_live",
            type=type,
            agent=agent, 
            decision=decision, 
            reason_text=text,
            symbol=symbol,
            severity=Severity.INFO,
            meta={"mode": settings.MODE}
        )
        self.events.append(evt)

    def _save_to_disk(self):
        """Atomic Write"""
        try:
            os.makedirs("data", exist_ok=True)
            state = {
                "account": self.account.model_dump(),
                "positions": [p.model_dump() for p in self.positions],
                "intents": [i.model_dump() for i in self.intents],
                "events": [e.model_dump() for e in self.events[-100:]] 
            }
            # Write to temp file then rename
            temp_file = DATA_FILE + ".tmp"
            with open(temp_file, "w", encoding='utf-8') as f:
                json.dump(state, f, ensure_ascii=False, indent=2)
            shutil.move(temp_file, DATA_FILE)
        except Exception as e: 
            print(f"Save failed: {e}")

    def _load_from_disk(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r", encoding='utf-8') as f:
                    data = json.load(f)
                if "account" in data: self.account = AccountSummary(**data["account"])
                if "positions" in data: self.positions = [Position(**p) for p in data["positions"]]
                if "intents" in data: self.intents = [TradeIntent(**i) for i in data["intents"]]
                if "events" in data: self.events = [SystemEvent(**e) for e in data["events"]]
            except Exception as e:
                print(f"Load failed: {e}")

trading_system = TradingSystem()
