
from typing import List, Dict, Any, Set, Optional
from datetime import datetime, date
import uuid
import json
import os
import shutil
import asyncio
from ..app.settings import settings

from .contracts import (
    AccountSummary, Position, TradeIntent, SystemEvent, MarketSnapshot,
    AgentType, Decision, Severity, EventType, Side, OrderStatus, StrategyConfig, AuditReport, TradeMetrics,
    Observation
)
from .trade_guard import TradeGuard
from .execution_engine import ExecutionEngine
from .exit_policy import ExitPolicy
from .events import *
from .experiment_runner import ExperimentRunner

from ..services.sina_data import sina_provider
from ..agents.strategy_agent import StrategyAgent
from ..agents.validation_agent import validation_agent
from ..agents.refinement_agent import refinement_agent
from ..infra.scratchpad_store import scratchpad
from ..infra.truth_store import truth_store

from ..services.llm_service import LLMService
from ..services.memory_service import memory_service
# Consolidated Market Data Import
from ..services.market_data import market_data_service

DATA_FILE = "data/state.json"
MAX_EVENTS_HISTORY = 1000  

class TradingSystem:
    def __init__(self):
        # 0. System Safety
        self.lock = asyncio.Lock() # P1: Concurrency Safety
        self.processed_ids: Set[str] = set() # P0: Idempotency (Intent IDs)
        self.processed_idempotency_keys: Set[str] = set() # P0: Idempotency (Client Keys)

        # 1. Initialize Default State
        self.initial_equity = 100000.0 # Track initial equity dynamically
        self._init_state()
        
        # TruthStore Context
        self.current_episode_id: Optional[uuid.UUID] = None
        self.step_index: int = 0
        
        # 2. Components
        self.guard = TradeGuard(max_daily_buys=settings.MAX_DAILY_BUYS)
        self.engine = ExecutionEngine()
        self.exit_policy = ExitPolicy()
        self.strategy_agent = StrategyAgent()
        self.llm_service = LLMService() 
        
        # New Components
        self.experiment_runner = ExperimentRunner(self)
        self.experiment_results: List[Dict] = []
        
        self._load_from_disk_sync() # Initial load is synchronous
    
    def _init_state(self):
        self.account = AccountSummary(
            total_equity=self.initial_equity, 
            available_cash=self.initial_equity,
            market_value=0.0,
            day_pnl=0.0,
            day_pnl_pct=0.0,
            filled_buys_today=0
        )
        self.positions: List[Position] = []
        self.intents: List[TradeIntent] = []
        self.events: List[SystemEvent] = []
        self.experiment_results = []
        
        self.market_snapshot = MarketSnapshot(
            index_price=3000.0, change_pct=0.0, sentiment_score=60, 
            volatility_index=15, up_count=0, down_count=0, 
            limit_up_count=0, limit_down_count=0,
            replay_date=settings.TRADE_DAY
        )
        
        default_strat = settings.STRATEGY_PROFILES["default"]
        self.strategy_config = StrategyConfig(
            vol_threshold=default_strat["vol_threshold"],
            stop_loss_pct=default_strat["stop_loss_pct"],
            take_profit_pct=default_strat["take_profit_pct"],
            max_drawdown_limit=5.0,
            last_updated=datetime.now().isoformat(),
            update_reason="Init"
        )
        
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

    async def reset_state(self, initial_equity: float = 100000.0, trade_day: str = None):
        """
        Async Reset to allow DB operations.
        """
        async with self.lock:
            # Close previous episode if exists
            if self.current_episode_id:
                await self._close_current_episode()

            self.initial_equity = initial_equity
            self._init_state()
            self.account.total_equity = initial_equity
            self.account.available_cash = initial_equity
            
            self.processed_ids.clear() 
            self.processed_idempotency_keys.clear()
            self.step_index = 0
            
            if trade_day:
                settings.TRADE_DAY = trade_day
                self.market_snapshot.replay_date = trade_day
            
            self._log(EventType.MARKET_SNAPSHOT, AgentType.SYSTEM, Decision.INFO, 
                    f"System Reset. Equity: {initial_equity}, Date: {settings.TRADE_DAY}")
            
            # Start new TruthStore Episode
            await self._start_new_episode()
            
            # Trigger async save
            asyncio.create_task(self._save_to_disk_async())

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
            "watchlist": self.strategy_agent.get_watchlist(),
            "experiment_results": self.experiment_results
        }

    def _calculate_metrics(self):
        filled_sells = [e for e in self.events if e.type == EventType.ORDER_FILLED and "SELL" in e.reason_text]
        total_trades = len(filled_sells)
        start_equity = self.initial_equity
        current_equity = self.account.total_equity
        peak_equity = max(start_equity, current_equity) 
        drawdown = (peak_equity - current_equity) / peak_equity if peak_equity > 0 else 0
        win_rate = 0.5 
        if total_trades > 0:
            win_rate = 0.55 if self.account.day_pnl >= 0 else 0.45
        self.metrics.max_drawdown = drawdown
        self.metrics.total_trades = total_trades
        self.metrics.win_rate = win_rate
        self.audit_report.active_config = self.strategy_config

    async def _start_new_episode(self):
        try:
            trade_date = datetime.strptime(settings.TRADE_DAY, "%Y-%m-%d").date()
        except:
            trade_date = date.today()

        self.current_episode_id = await truth_store.create_episode(
            session_id=settings.SESSION_ID,
            mode=settings.MODE,
            trade_day=trade_date,
            initial_equity=self.initial_equity,
            policy_version=settings.POLICY_VERSION
        )
        self.step_index = 0
        print(f"[TruthStore] Started Episode {self.current_episode_id} ({settings.MODE})")

    async def _close_current_episode(self):
        if not self.current_episode_id: return
        
        await truth_store.close_episode(
            episode_id=self.current_episode_id,
            final_equity=self.account.total_equity,
            max_drawdown=self.metrics.max_drawdown,
            pnl_amount=self.account.day_pnl,
            pnl_rate=self.account.day_pnl_pct / 100.0 if self.account.day_pnl_pct else 0
        )
        print(f"[TruthStore] Closed Episode {self.current_episode_id}")
        self.current_episode_id = None

    async def tick(self):
        async with self.lock:
            # Ensure Episode Exists
            if not self.current_episode_id:
                await self._start_new_episode()

            # 0. Log to Scratchpad (Persistent Trace)
            tick_event_id = f"tick_{uuid.uuid4().hex[:8]}"
            await scratchpad.log("TICK_START", {"id": tick_event_id, "time": datetime.now().isoformat(), "equity": self.account.total_equity})
            
            # Capture Start Time (Event Time)
            event_time = datetime.now()

            if settings.MODE == "live":
                settings.TRADE_DAY = datetime.now().strftime("%Y-%m-%d")
                self.market_snapshot.replay_date = settings.TRADE_DAY

            # 1. Market Data Update
            realtime_data = await self._sync_market_data()
            if '000001' in realtime_data:
                idx = realtime_data['000001']
                self.market_snapshot.index_price = idx['price']
                self.market_snapshot.change_pct = idx['change_pct']
            
            self._update_valuations(realtime_data)
            self._calculate_metrics()
            
            # 2. Strategy Adaptation
            self.strategy_config = self.strategy_agent.adapt_config(self.strategy_config, self.metrics)
            if "Mode" in self.strategy_config.update_reason and self.events and self.events[-1].reason_text != self.strategy_config.update_reason:
                 self._log(EventType.STRATEGY_UPDATED, AgentType.STRATEGY, Decision.INFO, 
                           self.strategy_config.update_reason)

            # 3. Exit Policy
            for pos in self.positions:
                exit_intent = self.exit_policy.check_exit(pos, settings.SESSION_ID, settings.TRADE_DAY)
                if exit_intent:
                    exit_intent.source.source_event_id = tick_event_id 
                    self._process_intent_lifecycle(exit_intent)

            # 4. Strategy Agent Run
            # Capture Observation BEFORE Agent runs (Input State)
            current_observation = Observation(
                market=self.market_snapshot,
                account=self.account,
                positions=self.positions,
                intents_pending=[i for i in self.intents if i.status == OrderStatus.PENDING]
            )

            new_intents = await self.strategy_agent.run_cycle(self.market_snapshot, realtime_data, self.strategy_config)
            
            # 5. Validation Agent
            valid_intents = []
            step_violations = [] # Capture for TruthStore

            for i in new_intents:
                i.source.source_event_id = tick_event_id
                is_valid, msg = validation_agent.validate_intent(i)
                if is_valid:
                    valid_intents.append(i)
                else:
                    violation = {
                        "rule": "ValidationAgent",
                        "symbol": i.symbol,
                        "details": msg,
                        "time": event_time.isoformat()
                    }
                    step_violations.append(violation)
                    self._log(EventType.GUARD_BLOCKED, AgentType.RISK, Decision.BLOCK, f"Validation Failed: {msg}", 
                              symbol=i.symbol, correlation_id=i.correlation_id)
            
            # 6. Intent Lifecycle & Execution
            for intent in valid_intents:
                if any(i.symbol == intent.symbol and i.side == intent.side and i.status == OrderStatus.PENDING for i in self.intents):
                    continue
                
                # Check Guard (Capture violations)
                receipt = self.guard.check(intent, self.account.filled_buys_today)
                if receipt.decision == Decision.BLOCK:
                     violation = {
                        "rule": "TradeGuard",
                        "symbol": intent.symbol,
                        "details": receipt.reason_text,
                        "time": event_time.isoformat()
                    }
                     step_violations.append(violation)
                
                self._process_intent_lifecycle(intent)

            # 7. Record to TruthStore (Backend is Truth)
            try:
                await truth_store.record_step(
                    episode_id=self.current_episode_id,
                    step_index=self.step_index,
                    timestamp=event_time,
                    observation=current_observation.model_dump(),
                    action=[i.model_dump() for i in new_intents] if new_intents else None,
                    violations=step_violations,
                    reward=self.account.day_pnl # Simple Reward Signal
                )
                self.step_index += 1
            except Exception as e:
                print(f"[TruthStore] Failed to record step: {e}")

            # Performance: Async save to prevent loop blocking
            asyncio.create_task(self._save_to_disk_async())
            return {"status": "ticked", "signals": len(valid_intents)}

    def _update_valuations(self, data_map: Dict[str, Any]):
        total_mv = 0.0
        for pos in self.positions:
            if pos.symbol in data_map:
                quote = data_map[pos.symbol]
                current_price = quote['price']
                pos.current_price = current_price
                pos.market_value = pos.quantity * current_price
                cost_basis = pos.quantity * pos.average_cost
                pos.unrealized_pnl = pos.market_value - cost_basis
                
                if cost_basis > 0:
                    pos.unrealized_pnl_pct = (pos.unrealized_pnl / cost_basis) * 100
                    # TRACK HIGH WATER MARK (For Trailing Stop)
                    if pos.unrealized_pnl_pct > pos.max_pnl_pct:
                        pos.max_pnl_pct = pos.unrealized_pnl_pct
                        
            total_mv += pos.market_value

        self.account.market_value = total_mv
        self.account.total_equity = self.account.available_cash + total_mv
        
        # FIX: Correct PnL Calculation
        if self.initial_equity > 0:
            self.account.day_pnl = self.account.total_equity - self.initial_equity
            self.account.day_pnl_pct = (self.account.day_pnl / self.initial_equity) * 100
        else:
            self.account.day_pnl = 0
            self.account.day_pnl_pct = 0

    def _process_intent_lifecycle(self, intent: TradeIntent):
        # P0: Idempotency Check
        if intent.intent_id in self.processed_ids:
            return 
        self.processed_ids.add(intent.intent_id)

        receipt = self.guard.check(intent, self.account.filled_buys_today)
        
        if receipt.decision == Decision.BLOCK:
            self._log(EventType.GUARD_BLOCKED, AgentType.RISK, Decision.BLOCK, 
                      f"Blocked: {receipt.reason_text}", symbol=intent.symbol, correlation_id=intent.correlation_id)
            # Log Violation to TruthStore (Aggregated Episode Level)
            if self.current_episode_id:
                asyncio.create_task(truth_store.log_violation(self.current_episode_id, {
                    "rule": "TradeGuard",
                    "details": receipt.reason_text,
                    "intent_id": intent.intent_id,
                    "time": datetime.now().isoformat()
                }))
            return

        intent.status = OrderStatus.PENDING
        self.intents.insert(0, intent)
        self._log(EventType.SIGNAL_EMITTED, AgentType.STRATEGY, Decision.INFO, 
                  f"New Signal: {intent.side} {intent.symbol} ({intent.intent_type})", 
                  symbol=intent.symbol, correlation_id=intent.correlation_id)
        
        # Trace intent generation
        asyncio.create_task(scratchpad.log("INTENT_GENERATED", intent.model_dump()))

    async def submit_intent(self, intent: TradeIntent) -> bool:
        """
        Executed when Human approves a signal.
        NOW ASYNC + LOCKED to prevent race conditions with tick().
        """
        async with self.lock:
            # P0: Strict Idempotency Check (Key based)
            if intent.idempotency_key and intent.idempotency_key in self.processed_idempotency_keys:
                print(f"WARN: Idempotency Key Replay {intent.idempotency_key}")
                return False
                
            if intent.intent_id in self.processed_ids:
                print(f"WARN: Duplicate Intent ID {intent.intent_id}")
                return False
            
            # Lock this operation
            if intent.idempotency_key:
                self.processed_idempotency_keys.add(intent.idempotency_key)
            self.processed_ids.add(intent.intent_id)
            
            # P0: Order Loop Close - Must result in Filled or Rejected
            receipt = self.guard.check(intent, self.account.filled_buys_today)
            if receipt.decision == Decision.BLOCK:
                self._log(EventType.ORDER_REJECTED, AgentType.RISK, Decision.BLOCK,
                          f"Guard Blocked: {receipt.reason_text}", symbol=intent.symbol, correlation_id=intent.correlation_id)
                return False
            
            existing = next((i for i in self.intents if i.intent_id == intent.intent_id), None)
            if existing:
                existing.status = OrderStatus.SUBMITTED
            else:
                intent.status = OrderStatus.SUBMITTED
                self.intents.insert(0, intent)
            
            self._log(EventType.HUMAN_APPROVED, AgentType.EXECUTION, Decision.ALLOW, 
                      f"Approved: {intent.side} {intent.symbol}", symbol=intent.symbol, correlation_id=intent.correlation_id)
            
            self._execute_trade(intent)
            asyncio.create_task(self._save_to_disk_async())
            return True

    def _execute_trade(self, intent: TradeIntent):
        # NOTE: Called from within locked methods (submit_intent), so this is safe.
        costs = 5.0 
        fill_price = intent.price 
        
        # NEW: Validate Order Returns 3 Values
        valid, code, msg = self.engine.validate_order(intent, self.positions, self.account.available_cash)
        
        if not valid:
            if code == "T1_VIOLATION":
                # Special Case: T+1 Violation -> Defer
                intent.status = OrderStatus.DEFERRED
                self._log(EventType.ENGINE_REJECTED, AgentType.EXECUTION, Decision.BLOCK, 
                          f"Deferred to Next Day: {msg}", symbol=intent.symbol, correlation_id=intent.correlation_id)
            else:
                # Standard Rejection
                intent.status = OrderStatus.REJECTED 
                self._log(EventType.ORDER_REJECTED, AgentType.EXECUTION, Decision.BLOCK, 
                          f"Execution Failed: {msg} ({code})", symbol=intent.symbol, correlation_id=intent.correlation_id)
            return
        
        if intent.side == Side.SELL:
             pos = next((p for p in self.positions if p.symbol == intent.symbol), None)
             if pos:
                 realized_pnl = (fill_price - pos.average_cost) * intent.qty - costs
                 realized_pnl_pct = (realized_pnl / (pos.average_cost * intent.qty)) * 100 if pos.average_cost > 0 else 0
                 
                 # ATTRIBUTION FIX: Use the Position's Entry Strategy ID, not the Exit Policy's ID
                 entry_strategy_id = pos.strategy_id if pos.strategy_id else "Manual"
                 
                 memory_service.record_trade(intent.symbol, "Unknown", settings.TRADE_DAY, realized_pnl_pct, intent.reason, entry_strategy_id)

        self.positions = self.engine.apply_fill(self.positions, intent, fill_price, costs)
        
        cash_change = (fill_price * intent.qty)
        if intent.side == Side.BUY:
            self.account.available_cash -= (cash_change + costs)
            self.account.filled_buys_today += 1
        else:
            self.account.available_cash += (cash_change - costs)
            
        intent.status = OrderStatus.FILLED # Terminal State
        intent.filled_qty = intent.qty
        
        self._log(EventType.ORDER_FILLED, AgentType.BROKER, Decision.EXECUTE, 
                  f"Filled {intent.side} {intent.qty} @ {fill_price}", symbol=intent.symbol, correlation_id=intent.correlation_id)

    async def _sync_market_data(self) -> Dict[str, Any]:
        position_symbols = [p.symbol for p in self.positions]
        watchlist_symbols = [w['symbol'] for w in self.strategy_agent.watchlist]
        all_symbols = list(set(position_symbols + watchlist_symbols + ['000001']))

        # If in Mock Mode, we need to generate data for ALL these symbols
        if settings.MODE != "live":
            data_map = {}
            for sym in all_symbols:
                # Get enough history to cover the full simulation range
                bars = await market_data_service.get_history_bars(sym, days=1000)
                if bars:
                    # Find the bar for the current TRADE_DAY
                    # If not found, fall back to the last available bar (to prevent crash, but warn)
                    target_bar = next((b for b in bars if b['date'] == settings.TRADE_DAY), None)
                    
                    if not target_bar:
                        target_bar = bars[-1]
                        # Optional: Print warning if dates mismatch significantly
                        # print(f"WARN: No data for {settings.TRADE_DAY}, using {target_bar['date']}")

                    data_map[sym] = {
                        "symbol": sym,
                        "name": "Mock " + sym,
                        "price": target_bar["close"],
                        "change_pct": 0.0, # Could calculate diff from prev bar
                        "volume": target_bar["volume"]
                    }
            return data_map

        # Live Mode
        return await sina_provider.get_realtime_data(all_symbols)

    async def cancel_order(self, intent_id: str):
        async with self.lock:
            for i in self.intents:
                if i.intent_id == intent_id:
                    i.status = OrderStatus.CANCELLED
                    self._log(EventType.ORDER_REJECTED, AgentType.BROKER, Decision.INFO, "Cancelled by User", correlation_id=i.correlation_id)
                    asyncio.create_task(self._save_to_disk_async())
                    break

    async def set_equity(self, amount: float):
        async with self.lock:
            self.initial_equity = amount # Update baseline
            self.account.total_equity = amount
            self.account.available_cash = amount - self.account.market_value
            self._calculate_metrics() # Recalc PnL
            asyncio.create_task(self._save_to_disk_async())

    async def run_experiments(self):
        """Triggered via API"""
        self.experiment_results = await self.experiment_runner.run_daily_validation()
        self._log(EventType.SYSTEM_STATUS, AgentType.SYSTEM, Decision.INFO, "Experiments Completed")
        asyncio.create_task(self._save_to_disk_async())
        return self.experiment_results

    async def generate_audit(self):
        try:
            trades_summary = [{"symbol": e.symbol, "type": e.type, "desc": e.reason_text} for e in self.events if e.type == EventType.ORDER_FILLED]
            report_data = await self.llm_service.audit_daily_performance(settings.TRADE_DAY, self.account.model_dump(), trades_summary, [e.model_dump() for e in self.events])
            
            self.audit_report = AuditReport(
                date=settings.TRADE_DAY,
                score=report_data.get("score", 0),
                status=report_data.get("status", "FAIL"),
                checks=[{"rule_name": c["rule_name"], "status": c["status"], "details": c["details"]} for c in report_data.get("checks", [])],
                ai_suggestions=report_data.get("ai_suggestions", []),
                active_config=self.strategy_config
            )
            
            # Refinement Agent: Propose evolutions based on audit
            new_config = refinement_agent.refine_config(self.strategy_config, self.metrics, self.audit_report)
            if new_config != self.strategy_config:
                self.strategy_config = new_config
                self.audit_report.active_config = new_config # Update in report
                self._log(EventType.STRATEGY_UPDATED, AgentType.STRATEGY, Decision.INFO, f"Refinement: {new_config.update_reason}")
            
            self._log(EventType.DAILY_REPORT, AgentType.AUDIT, Decision.INFO, f"Audit Generated. Score: {self.audit_report.score}")
            asyncio.create_task(self._save_to_disk_async())
            return self.audit_report
        except Exception as e:
            print(f"Audit Generation Error: {e}")
            return self.audit_report

    def _log(self, type: str, agent: str, decision: str, text: str, symbol: str = None, correlation_id: str = None):
        evt = SystemEvent(
            trade_day=settings.TRADE_DAY,
            session_id=settings.SESSION_ID,
            correlation_id=correlation_id,
            type=type, agent=agent, decision=decision, reason_text=text, symbol=symbol, severity=Severity.INFO,
            meta={"mode": settings.MODE}
        )
        self.events.append(evt)
        if len(self.events) > MAX_EVENTS_HISTORY:
            self.events = self.events[-MAX_EVENTS_HISTORY:]

    async def _save_to_disk_async(self):
        """Run disk I/O in a thread to avoid blocking the event loop"""
        try:
            state = {
                "initial_equity": self.initial_equity,
                "account": self.account.model_dump(),
                "positions": [p.model_dump() for p in self.positions],
                "intents": [i.model_dump() for i in self.intents],
                "events": [e.model_dump() for e in self.events[-100:]],
                "experiment_results": self.experiment_results
            }
            await asyncio.to_thread(self._write_file, state)
        except Exception as e:
             print(f"Async Save failed: {e}")

    def _write_file(self, state: Dict):
        os.makedirs("data", exist_ok=True)
        temp_file = DATA_FILE + ".tmp"
        with open(temp_file, "w", encoding='utf-8') as f:
            json.dump(state, f, ensure_ascii=False, indent=2)
        shutil.move(temp_file, DATA_FILE)

    def _load_from_disk_sync(self):
        if os.path.exists(DATA_FILE):
            try:
                with open(DATA_FILE, "r", encoding='utf-8') as f:
                    data = json.load(f)
                if "initial_equity" in data: self.initial_equity = data["initial_equity"]
                if "account" in data: self.account = AccountSummary(**data["account"])
                if "positions" in data: self.positions = [Position(**p) for p in data["positions"]]
                if "intents" in data: self.intents = [TradeIntent(**i) for i in data["intents"]]
                if "events" in data: self.events = [SystemEvent(**e) for e in data["events"]]
                if "experiment_results" in data: self.experiment_results = data["experiment_results"]
            except Exception as e:
                print(f"Load failed: {e}")

trading_system = TradingSystem()
