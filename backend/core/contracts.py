from enum import Enum
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime
import uuid

# --- Enums ---

class Side(str, Enum):
    BUY = "BUY"
    SELL = "SELL"

class IntentType(str, Enum):
    BUY = "BUY"
    SELL = "SELL"
    STOP_LOSS_SELL = "STOP_LOSS_SELL"
    TAKE_PROFIT_SELL = "TAKE_PROFIT_SELL"
    REDUCE_ONLY = "REDUCE_ONLY"

class AgentType(str, Enum):
    MARKET = "market"
    STRATEGY = "strategy"
    RISK = "risk"
    EXIT = "exit"
    EXECUTION = "execution"
    AUDIT = "audit"
    SYSTEM = "system"
    BROKER = "broker"

class Decision(str, Enum):
    ALLOW = "ALLOW"
    BLOCK = "BLOCK"
    EXECUTE = "EXECUTE"
    INFO = "INFO"

class Severity(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"

class OrderStatus(str, Enum):
    PENDING = "PENDING"
    SUBMITTED = "SUBMITTED"
    PARTIALLY_FILLED = "PARTIALLY_FILLED"
    FILLED = "FILLED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"

# --- Sub-models ---

class IntentSource(BaseModel):
    source_event_id: str
    parent_intent_id: Optional[str] = None
    trigger: str = "signal" # signal, human, exit_policy

class IntentVersion(BaseModel):
    intent_schema: str = "1.0.0"
    rule_version: str = "1.0.0"

class EventMeta(BaseModel):
    mode: str = "mock" # mock | replay | live
    seed: Optional[int] = None
    tags: List[str] = []
    version: Dict[str, str] = {
        "rule_version": "1.0.0",
        "schema_version": "1.0.0",
        "build": "unknown"
    }

class EventSnapshots(BaseModel):
    config: Optional[Dict[str, Any]] = None
    state: Optional[Dict[str, Any]] = None
    evidence: Optional[Dict[str, Any]] = None

# --- Primary Models ---

class TradeIntent(BaseModel):
    intent_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    trade_day: str
    session_id: str
    symbol: str
    name: str = "Unknown" # A-share Name
    side: Side
    intent_type: IntentType
    
    qty: int
    price: float
    stop_loss: Optional[float] = None
    take_profit: Optional[float] = None
    time_in_force: str = "DAY"
    reduce_only: bool = False
    
    strategy_id: str
    reason: str
    source: IntentSource
    version: IntentVersion
    
    # Frontend/System State (Added)
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    status: OrderStatus = OrderStatus.PENDING
    filled_qty: int = 0

class Position(BaseModel):
    symbol: str
    name: str = "Unknown" # A-share Name
    quantity: int
    sellable: int # T+1 Available
    average_cost: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    today_buys: int
    days_held: int = 0 # New: Tracks T+N status. 0 = Bought Today.
    # Helper for logic
    stop_loss_price: Optional[float] = None 

# --- Event Contract v1.1 ---

class SystemEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: f"evt-{uuid.uuid4()}")
    ts: str = Field(default_factory=lambda: datetime.now().isoformat())
    trade_day: str
    session_id: str
    
    # Traceability
    trace_id: str = Field(default_factory=lambda: f"trace-{uuid.uuid4()}")
    parent_event_id: Optional[str] = None
    idempotency_key: Optional[str] = None
    
    type: str
    agent: AgentType
    decision: Decision
    severity: Severity = Severity.INFO
    
    symbol: Optional[str] = None
    reason_code: str = "OP_LOG"
    reason_text: str
    
    payload: Dict[str, Any] = {}
    snapshots: Optional[EventSnapshots] = None
    
    meta: EventMeta = EventMeta()
    
    # Guard Result Helper (Not persisted directly, but used to build event)
class GuardReceipt(BaseModel):
    decision: Decision
    reason_code: str
    reason_text: str
    snapshots: EventSnapshots
