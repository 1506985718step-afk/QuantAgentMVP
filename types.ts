// Enum mapping to backend constraints
export enum Side {
    BUY = 'BUY',
    SELL = 'SELL'
}

export enum IntentType {
    BUY = 'BUY',
    SELL = 'SELL',
    STOP_LOSS_SELL = 'STOP_LOSS_SELL',
    TAKE_PROFIT_SELL = 'TAKE_PROFIT_SELL',
    REDUCE_ONLY = 'REDUCE_ONLY'
}

export enum AgentType {
    MARKET = 'market',
    STRATEGY = 'strategy',
    RISK = 'risk',
    EXIT = 'exit',
    EXECUTION = 'execution',
    AUDIT = 'audit',
    SYSTEM = 'system',
    BROKER = 'broker' // New Agent
}

export enum Decision {
    ALLOW = 'ALLOW',
    BLOCK = 'BLOCK',
    EXECUTE = 'EXECUTE',
    INFO = 'INFO'
}

export enum Severity {
    DEBUG = 'DEBUG',
    INFO = 'INFO',
    WARN = 'WARN',
    ERROR = 'ERROR',
    CRITICAL = 'CRITICAL'
}

export enum OrderStatus {
    PENDING = 'PENDING',
    SUBMITTED = 'SUBMITTED',
    PARTIALLY_FILLED = 'PARTIALLY_FILLED',
    FILLED = 'FILLED',
    CANCELLED = 'CANCELLED',
    REJECTED = 'REJECTED'
}

// MVP Event Set v1
export enum EventType {
    MARKET_SNAPSHOT = 'MARKET_SNAPSHOT',
    SIGNAL_EMITTED = 'SIGNAL_EMITTED',
    HUMAN_APPROVED = 'HUMAN_APPROVED',
    GUARD_CHECKED = 'GUARD_CHECKED',
    GUARD_BLOCKED = 'GUARD_BLOCKED',
    ORDER_SUBMITTED = 'ORDER_SUBMITTED',
    ORDER_FILLED = 'ORDER_FILLED',
    ORDER_PARTIAL_FILL = 'ORDER_PARTIAL_FILL', // New
    ORDER_REJECTED = 'ORDER_REJECTED',
    POSITION_UPDATED = 'POSITION_UPDATED',
    EXIT_SIGNAL_EMITTED = 'EXIT_SIGNAL_EMITTED',
    DAILY_REPORT = 'DAILY_REPORT',
    STRATEGY_UPDATED = 'STRATEGY_UPDATED'
}

// Sub-structures for TradeIntent
export interface IntentSource {
    source_event_id: string;
    parent_intent_id: string | null;
    trigger: 'signal' | 'human' | 'exit_policy';
}

export interface IntentVersion {
    intent_schema: string;
    rule_version: string;
}

// Data structures
export interface TradeIntent {
    intent_id: string;
    trade_day: string;
    session_id: string;
    symbol: string;
    name: string; // A-share Name
    side: Side;
    intent_type: IntentType;
    
    // Core Trade Params
    qty: number; 
    price: number; 
    stop_loss?: number;
    take_profit?: number;
    time_in_force: string; 
    reduce_only: boolean;

    // Metadata
    strategy_id: string;
    reason: string;
    source: IntentSource;
    version: IntentVersion;

    // Frontend State 
    timestamp: string;
    status: OrderStatus | 'PENDING_APPROVAL'; // Updated to use OrderStatus
    filled_qty?: number; // New: Track partial fills
}

export interface Position {
    symbol: string;
    name: string; // A-share Name
    quantity: number;
    sellable: number; // T+1 Available Quantity
    average_cost: number;
    current_price: number;
    market_value: number;
    unrealized_pnl: number;
    unrealized_pnl_pct: number;
    today_buys: number; 
    days_held: number; // New: Tracks T+N status. 0 = Bought Today.
}

export interface AccountSummary {
    total_equity: number;
    available_cash: number;
    market_value: number;
    day_pnl: number;
    day_pnl_pct: number;
    filled_buys_today: number; 
    position_health_score?: number; // New: 0-100
    kelly_suggestion?: number; // New: Suggested position %
}

// Dynamic Strategy Configuration (The "Brain" State)
export interface StrategyConfig {
    vol_threshold: number;      // e.g., 1.5x -> 1.8x
    stop_loss_pct: number;      // e.g., 3.0% -> 2.5%
    take_profit_pct: number;    // e.g., 9.0% -> 10.0%
    max_drawdown_limit: number; // e.g., 5%
    last_updated: string;
    update_reason: string;
}

// Event Contract v1.1 (Strict Mode)
export interface SystemEvent {
    event_id: string;
    ts: string;
    trade_day: string;
    session_id: string;

    // Tracing (MANDATORY)
    trace_id: string;
    parent_event_id: string | null;
    idempotency_key?: string;

    type: EventType | string;
    agent: AgentType;
    decision: Decision;
    
    severity: Severity;

    symbol: string | null;

    reason_code: string;
    reason_text: string;

    payload?: any;

    // Audit Evidence (MANDATORY for GUARD events)
    snapshots?: {
        config?: any;      // e.g. { max_daily_buys: 5 }
        state?: any;       // e.g. { filled_buys_today: 4 }
        evidence?: any;    // e.g. { input_value: 100, threshold: 500 }
    };

    meta: {
        mode: string; // 'mock' | 'replay' | 'live'
        seed?: number;
        tags?: string[];
        version?: {
            rule_version: string;
            schema_version: string;
            build: string;
        };
    };
}

export interface MarketSnapshot {
    replay_date?: string; // New: For replay mode
    index_price: number;
    change_pct: number;
    sentiment_score: number; 
    volatility_index: number;
    up_count: number;
    down_count: number;
    limit_up_count: number;   // 涨停家数
    limit_down_count: number; // 跌停家数
}

// --- Analytics & Audit Types ---

export interface AuditCheck {
    rule_name: string;
    status: 'PASS' | 'FAIL' | 'WARN';
    details: string;
}

export interface AuditReport {
    date: string;
    score: number;
    status: 'PASS' | 'FAIL';
    checks: AuditCheck[];
    ai_suggestions: string[];
    active_config?: StrategyConfig; // New: Include current strategy params for UI display
}

export interface TradeMetrics {
    win_rate: number;
    profit_factor: number;
    avg_win_pnl: number;
    avg_loss_pnl: number;
    total_trades: number;
    max_drawdown: number;
    cost_ratio: number; // Transaction costs / Total PnL
}

export interface BrokerOrder {
    orderId: string;
    intentId: string;
    symbol: string;
    side: Side;
    qty: number;
    filledQty: number;
    price: number; // Limit Price
    status: OrderStatus;
    submittedAt: number;
}