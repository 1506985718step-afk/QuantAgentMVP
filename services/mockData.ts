import { AgentType, Decision, EventType, IntentType, MarketSnapshot, Position, Side, SystemEvent, TradeIntent, AccountSummary, Severity, AuditReport, TradeMetrics } from '../types';

// Initial State
export const MOCK_MARKET: MarketSnapshot = {
    index_price: 3250.45,
    change_pct: 0.00,
    sentiment_score: 50,
    volatility_index: 15.0,
    up_count: 2500,
    down_count: 2500,
    limit_up_count: 40,
    limit_down_count: 5
};

// Start Fresh: 10,000 RMB Small Account
export const MOCK_ACCOUNT: AccountSummary = {
    total_equity: 10000.00,
    available_cash: 10000.00,
    market_value: 0.00,
    day_pnl: 0.00,
    day_pnl_pct: 0.00,
    filled_buys_today: 0
};

// No positions initially
export const MOCK_POSITIONS: Position[] = [];

// No intents initially
export const MOCK_INTENTS: TradeIntent[] = [];

// Clean Event Log
export const MOCK_EVENTS: SystemEvent[] = [
    {
        event_id: 'evt-init',
        ts: new Date().toISOString(),
        trade_day: '2025-01-01',
        session_id: 'sess-init',
        trace_id: 'trace-init',
        parent_event_id: null,
        type: EventType.MARKET_SNAPSHOT,
        agent: AgentType.SYSTEM,
        decision: Decision.INFO,
        severity: Severity.INFO,
        symbol: null,
        reason_code: 'SYSTEM_INIT',
        reason_text: '小资金模拟系统初始化完成 (10,000 RMB)',
        meta: { mode: 'replay' }
    }
];

export const MOCK_AUDIT_REPORT: AuditReport = {
    date: '2025-01-01',
    score: 100,
    status: 'PASS',
    checks: [],
    ai_suggestions: [
        "系统初始化完成。当前为小资金模式，建议严格遵守单笔 40% 仓位限制。"
    ]
};

export const MOCK_METRICS: TradeMetrics = {
    win_rate: 0,
    profit_factor: 0,
    avg_win_pnl: 0,
    avg_loss_pnl: 0,
    total_trades: 0,
    max_drawdown: 0,
    cost_ratio: 0
};

// Helper to generate a random ID
export const generateId = () => Math.random().toString(36).substr(2, 9);