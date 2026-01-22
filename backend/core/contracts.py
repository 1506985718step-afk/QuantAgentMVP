
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
    TIME_STOP_SELL = "TIME_STOP_SELL"

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
    DEFERRED = "DEFERRED"

# --- Sub-models ---

class IntentSource(BaseModel):
    source_event_id: str # Link to Trigger Event (e.g. MarketSnapshot ID)
    parent_intent_id: Optional[str] = None
    trigger: str = "signal" # signal, human, exit_policy

class IntentVersion(BaseModel):
    intent_schema: str = "1.1.0"
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

class NewsItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    summary: Optional[str] = None
    source: str
    time: str
    sentiment: str = "neutral"
    impact_score: int = 0

class AuditCheck(BaseModel):
    rule_name: str
    status: str
    details: str

# --- Primary Models ---

class StrategyConfig(BaseModel):
    vol_threshold: float
    stop_loss_pct: float
    take_profit_pct: float
    max_drawdown_limit: float
    last_updated: str
    update_reason: str

class AccountSummary(BaseModel):
    total_equity: float
    available_cash: float
    market_value: float
    day_pnl: float
    day_pnl_pct: float
    filled_buys_today: int
    position_health_score: int = 100
    kelly_suggestion: float = 0.0

class MarketSnapshot(BaseModel):
    index_price: float
    change_pct: float
    sentiment_score: int
    volatility_index: float
    up_count: int
    down_count: int
    limit_up_count: int
    limit_down_count: int
    replay_date: Optional[str] = None
    top_news: List[NewsItem] = []
    ai_market_comment: Optional[str] = None

class TradeMetrics(BaseModel):
    win_rate: float
    profit_factor: float
    avg_win_pnl: float
    avg_loss_pnl: float
    total_trades: int
    max_drawdown: float
    cost_ratio: float

class AuditReport(BaseModel):
    date: str
    score: int
    status: str
    checks: List[AuditCheck]
    ai_suggestions: List[str]
    active_config: Optional[StrategyConfig] = None

class TradeIntent(BaseModel):
    intent_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    
    # Traceability & Idempotency
    correlation_id: str = Field(default_factory=lambda: f"corr-{uuid.uuid4().hex[:8]}")
    idempotency_key: Optional[str] = None
    llm_request_hash: Optional[str] = None
    
    trade_day: str
    session_id: str
    symbol: str
    name: str = "Unknown"
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
    
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
    status: OrderStatus = OrderStatus.PENDING
    filled_qty: int = 0

class Position(BaseModel):
    symbol: str
    name: str = "Unknown"
    quantity: int
    sellable: int
    average_cost: float
    current_price: float
    market_value: float
    unrealized_pnl: float
    unrealized_pnl_pct: float
    today_buys: int
    days_held: int = 0
    strategy_id: str = "Manual" # Tracks which strategy initiated this
    max_pnl_pct: float = 0.0 # High Water Mark
    stop_loss_price: Optional[float] = None

class SystemEvent(BaseModel):
    event_id: str = Field(default_factory=lambda: f"evt-{uuid.uuid4()}")
    ts: str = Field(default_factory=lambda: datetime.now().isoformat())
    trade_day: str
    session_id: str
    
    # Traceability
    trace_id: str = Field(default_factory=lambda: f"trace-{uuid.uuid4()}")
    correlation_id: Optional[str] = None # Link to Intent or Parent Event
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

class GuardReceipt(BaseModel):
    decision: Decision
    reason_code: str
    reason_text: str
    snapshots: EventSnapshots
