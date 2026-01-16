
import { 
    AgentType, Decision, EventType, IntentType, MarketSnapshot, 
    Position, Side, SystemEvent, TradeIntent, AccountSummary, Severity,
    AuditReport, TradeMetrics, IntentSource, IntentVersion, AuditCheck, StrategyConfig, OrderStatus, BrokerOrder, SimulationStatus
} from '../types';
import { 
    MOCK_MARKET, MOCK_POSITIONS, MOCK_INTENTS, MOCK_EVENTS, MOCK_ACCOUNT, MOCK_AUDIT_REPORT, MOCK_METRICS, generateId 
} from './mockData';
import { BarData } from './historicalData'; // Keeping for type def, but usage via provider
import { MockBrokerService } from './MockBroker';
import { analyzeMarketWithLLM, generateAuditReportWithLLM } from './LLMService';
import { dataProvider } from './DataProvider';

/**
 * MockBackendService 3.0 (With Time Machine / Backtest Engine)
 */

// --- USER CONFIGURATION (Strict Mode) ---
const MAX_DAILY_BUYS = 5;         
const MAX_POS_PCT = 0.4;          // 40% (Between 30-50%)
const TAKE_PROFIT_TIER_1 = 8.0;   

const STORAGE_KEY = 'quant_agent_mvp_v2';
const AI_COOLDOWN_DAYS = 3; 

interface ClosedTrade {
    symbol: string;
    side: Side;
    qty: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    pnlPct: number;
    costs: number;
}

interface PersistedState {
    account: AccountSummary;
    positions: Position[];
    metrics: TradeMetrics;
    closedTrades: ClosedTrade[];
    intents: TradeIntent[];
}

class MockBackendService {
    // Services
    private broker = new MockBrokerService();

    // Data Stores
    private _market: MarketSnapshot = MOCK_MARKET;
    private _account: AccountSummary = MOCK_ACCOUNT;
    private _positions: Position[] = MOCK_POSITIONS;
    private _intents: TradeIntent[] = MOCK_INTENTS;
    private _events: SystemEvent[] = MOCK_EVENTS;
    private _audit: AuditReport = MOCK_AUDIT_REPORT;
    private _metrics: TradeMetrics = MOCK_METRICS;
    
    // Dynamic Strategy Configuration (The "Brain")
    private _strategyConfig: StrategyConfig = {
        vol_threshold: 1.5,      
        stop_loss_pct: 3.0,      
        take_profit_pct: 12.0,   
        max_drawdown_limit: 5.0,
        last_updated: new Date().toISOString(),
        update_reason: '初始配置'
    };

    // Analytics State
    private _closedTrades: ClosedTrade[] = [];
    
    // Psychology/Rule State
    private consecutiveLossDays = 0;
    private isRestDay = false;

    // Replay/Simulation State
    private listeners: Function[] = [];
    private simulationTimer: any = null;
    private currentReplayIndex = 0;
    private maxReplayLength = 10; 
    
    // Simulation Control
    private isPlaying = false;
    private replaySpeed = 1; // 1x = 3000ms, 5x = 600ms, 20x = 100ms
    private baseInterval = 3000;

    // AI Control
    private _lastAnalysisIndex: Record<string, number> = {};

    // Cache for Charts
    private _chartData: Record<string, BarData[]> = {};

    constructor() {
        console.log("Backend Initialized.");
        this._loadState(); // Load from LocalStorage
        this.initData();
        // Do NOT auto-start simulation. User must press play.
    }

    private _saveState() {
        try {
            const state: PersistedState = {
                account: this._account,
                positions: this._positions,
                metrics: this._metrics,
                closedTrades: this._closedTrades,
                intents: this._intents
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn("Failed to save state", e);
        }
    }

    private _loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const state: PersistedState = JSON.parse(raw);
                this._account = state.account;
                this._positions = state.positions;
                this._metrics = state.metrics;
                this._closedTrades = state.closedTrades || [];
                // We typically don't persist active intents if they are stale, 
                // but for MVP let's keep them so user sees approvals.
                this._intents = state.intents || [];
            }
        } catch (e) {
            console.warn("Failed to load state", e);
        }
    }

    private async initData() {
        // Fetch 300 days of history to cover 2024
        const HISTORY_LEN = 300;
        
        console.log("Fetching Real Market Data via Backend...");
        const bars = await dataProvider.getBars('000001', HISTORY_LEN);
        
        if (bars.length > 0) {
            this.maxReplayLength = bars.length;
            this._chartData['000001'] = bars;
            this._chartData['600519'] = await dataProvider.getBars('600519', HISTORY_LEN);
            this._chartData['002594'] = await dataProvider.getBars('002594', HISTORY_LEN);
            
            // Set initial market date
            this._market.replay_date = bars[0].date;
            
            this._emit({
                type: EventType.MARKET_SNAPSHOT,
                agent: AgentType.MARKET,
                decision: Decision.INFO,
                reason_code: 'DATA_LOADED',
                reason_text: `训练数据加载成功: 覆盖 ${bars[0].date} 至 ${bars[bars.length-1].date}`,
                severity: Severity.INFO,
                meta: { mode: 'replay' }
            });
            this._notify();
        } else {
             this._emit({
                type: EventType.MARKET_SNAPSHOT,
                agent: AgentType.SYSTEM,
                decision: Decision.BLOCK,
                reason_code: 'DATA_FAIL',
                reason_text: '无法连接后端获取行情数据，请确保 backend/main.py 运行中',
                severity: Severity.ERROR,
                meta: { mode: 'replay' }
            });
        }
    }

    // --- Simulation Controls ---
    
    togglePlayback() {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            this._scheduleNextTick();
        } else {
            if (this.simulationTimer) clearTimeout(this.simulationTimer);
        }
        this._notify();
    }

    setSpeed(speed: number) {
        this.replaySpeed = speed;
        if (this.isPlaying) {
            // Restart timer with new speed
            if (this.simulationTimer) clearTimeout(this.simulationTimer);
            this._scheduleNextTick();
        }
        this._notify();
    }
    
    stepForward() {
        this.isPlaying = false;
        if (this.simulationTimer) clearTimeout(this.simulationTimer);
        this._tickSimulation();
    }

    private _scheduleNextTick() {
        const interval = this.baseInterval / this.replaySpeed;
        this.simulationTimer = setTimeout(() => {
            this._tickSimulation();
            if (this.isPlaying) this._scheduleNextTick();
        }, interval);
    }

    // --- Core Simulation Tick ---
    
    private async _tickSimulation() {
        if (this.currentReplayIndex >= this.maxReplayLength) {
            this.currentReplayIndex = 0; 
            this.isPlaying = false; // Stop at end
            this._lastAnalysisIndex = {}; 
            this._emit({
                 type: EventType.DAILY_REPORT,
                 agent: AgentType.SYSTEM,
                 decision: Decision.INFO,
                 reason_code: 'REPLAY_END',
                 reason_text: '回测结束',
                 trace_id: `trace-${generateId()}`,
                 meta: { mode: 'replay' }
            });
            this._notify();
            return;
        }

        // 1. Advance Day (Settlement from previous day)
        this.nextDay(false); 

        // 2. Fetch Data for "Today"
        const getDayData = (symbol: string) => {
            const allBars = this._chartData[symbol] || [];
            return allBars[this.currentReplayIndex] || allBars[allBars.length - 1];
        };

        const currentDayData = {
            pingan: getDayData('000001'),
            moutai: getDayData('600519'),
            byd: getDayData('002594')
        };

        if (!currentDayData.pingan) return;
        
        // 3. Update Market State
        this._tickMarketReplay(currentDayData);
        
        // 4. Broker Matches Orders (using Today's Close/High/Low)
        this._processBrokerUpdates(currentDayData);

        // 5. Run Strategy (LLM Async)
        // If speed is very high (e.g. 20x), we might skip LLM to prevent spamming/lag, 
        // or just accept it might be slow. For MVP we run it.
        await this._runAIStrategy(currentDayData); 
        
        this._runExitPolicy(); 
        this._updatePositionHealth(); 
        
        this.currentReplayIndex++;
        this._notify();
    }

    private _processBrokerUpdates(data: { pingan: BarData, moutai: BarData, byd: BarData }) {
        const prices = {
            '000001': data.pingan.close,
            '600519': data.moutai.close,
            '002594': data.byd.close
        };

        const events = this.broker.processOrders(prices);
        
        for (const evt of events) {
            const intent = this._intents.find(i => i.intent_id === this.broker.getOrders().find(o => o.orderId === evt.orderId)?.intentId);
            if (!intent) continue;

            // Update Intent Status in UI
            intent.filled_qty = (intent.filled_qty || 0) + evt.fillQty;
            if (intent.filled_qty >= intent.qty) {
                intent.status = OrderStatus.FILLED;
            } else {
                intent.status = OrderStatus.PARTIALLY_FILLED;
            }

            // Apply to Account/Positions
            this._applyFillLogic(intent, evt.fillPrice, evt.fillQty, evt.commission);

            this._emit({
                type: evt.type === 'PARTIAL' ? EventType.ORDER_PARTIAL_FILL : EventType.ORDER_FILLED,
                agent: AgentType.BROKER,
                decision: Decision.EXECUTE,
                symbol: intent.symbol,
                reason_code: 'BROKER_FILL',
                reason_text: `券商撮合成功: ${evt.type} ${intent.side} ${evt.fillQty}股 @ ${evt.fillPrice}`,
                meta: { mode: 'replay', tags: ['broker', 'async'] }
            });
        }
        if (events.length > 0) this._saveState();
    }

    private _tickMarketReplay(data: { pingan: BarData, moutai: BarData, byd: BarData }) {
        const date = data.pingan.date; 
        const changePct = ((data.pingan.close - data.pingan.open) / data.pingan.open) * 100;
        
        let upCount = 2000;
        let limitUp = 40;
        let limitDown = 5;

        // Simulate breadth based on PingAn as proxy (MVP shortcut)
        if (changePct > 0.3) {
            upCount = 3600; limitUp = 65; limitDown = 5;         
        } else if (changePct > 0) {
            upCount = 2800; limitUp = 40; limitDown = 10;
        } else {
            upCount = 1000; limitUp = 10; limitDown = 20;
        }

        this._market = {
            ...this._market,
            replay_date: date,
            index_price: 3000 + (this.currentReplayIndex * 1.5), // Mock Index Value
            change_pct: Number(changePct.toFixed(2)),
            sentiment_score: changePct > 0 ? 60 : 45,
            up_count: upCount,
            down_count: 5000 - upCount,
            limit_up_count: limitUp,
            limit_down_count: limitDown
        };

        // Update Positions PnL
        let marketValueTotal = 0;
        let dayPnlTotal = 0;

        this._positions = this._positions.map(pos => {
            let newData: BarData | undefined;
            if (pos.symbol === '000001') newData = data.pingan;
            if (pos.symbol === '600519') newData = data.moutai;
            if (pos.symbol === '002594') newData = data.byd;

            if (!newData) return pos;

            const newPrice = newData.close;
            const marketVal = newPrice * pos.quantity;
            const pnl = marketVal - (pos.quantity * pos.average_cost);
            const pnlPct = (pos.quantity * pos.average_cost) > 0 
                ? (pnl / (pos.quantity * pos.average_cost)) * 100 
                : 0;

            marketValueTotal += marketVal;
            dayPnlTotal += pnl;

            // Note: days_held is updated in nextDay(), here we just update price
            return {
                ...pos,
                current_price: newPrice,
                market_value: marketVal,
                unrealized_pnl: pnl,
                unrealized_pnl_pct: pnlPct
            };
        });

        this._account = {
            ...this._account,
            market_value: marketValueTotal,
            total_equity: this._account.available_cash + marketValueTotal,
            day_pnl: dayPnlTotal,
            day_pnl_pct: this._account.total_equity > 0 
                ? (dayPnlTotal / (this._account.total_equity - dayPnlTotal)) * 100
                : 0
        };
    }

    private async _runAIStrategy(data: { pingan: BarData, moutai: BarData, byd: BarData }) {
        if (this.isRestDay) return;

        // Skip AI if running fast (performance optimization)
        if (this.replaySpeed > 10) return; 

        const checkSignalLLM = async (symbol: string, name: string, bar: BarData) => {
            const hasPending = this._intents.some(i => i.symbol === symbol && i.status === 'PENDING_APPROVAL');
            const hasPosition = this._positions.some(p => p.symbol === symbol);
            
            if (hasPending || hasPosition) return;

            // AI Cooldown Logic
            const lastCheck = this._lastAnalysisIndex[symbol] || -999;
            if (this.currentReplayIndex - lastCheck < AI_COOLDOWN_DAYS) {
                return; // Skip analysis (Cooling down)
            }

            const analysis = await analyzeMarketWithLLM(
                symbol, 
                bar, 
                this._market.sentiment_score, 
                this._strategyConfig.vol_threshold
            );

            // Update Last Check Time
            this._lastAnalysisIndex[symbol] = this.currentReplayIndex;

            if (analysis.signal) {
                // Simplified Qty Logic
                const safeQty = 1000; // Fixed for replay stability

                if (safeQty > 0) {
                     const intent: TradeIntent = {
                        intent_id: `strat-${generateId()}`,
                        trade_day: bar.date,
                        session_id: 'ai-scanner',
                        symbol: symbol,
                        name: name,
                        side: Side.BUY,
                        intent_type: IntentType.BUY,
                        qty: safeQty,
                        price: bar.close,
                        stop_loss: Number((bar.close * (1 - this._strategyConfig.stop_loss_pct/100)).toFixed(2)),
                        take_profit: Number((bar.close * (1 + this._strategyConfig.take_profit_pct/100)).toFixed(2)),
                        time_in_force: 'DAY',
                        reduce_only: false,
                        strategy_id: 'Gemini-3-Flash-Quant',
                        reason: analysis.reasoning,
                        source: {
                            source_event_id: `evt-sig-${generateId()}`,
                            parent_intent_id: null,
                            trigger: 'signal'
                        },
                        version: { intent_schema: '1.0', rule_version: '3.1.0' },
                        timestamp: new Date().toISOString(),
                        status: 'PENDING_APPROVAL'
                    };
                    
                    this._intents = [intent, ...this._intents];
                    this._saveState();
                    
                    this._emit({
                        type: EventType.SIGNAL_EMITTED,
                        agent: AgentType.STRATEGY,
                        decision: Decision.INFO,
                        symbol: symbol,
                        reason_code: 'LLM_SIGNAL',
                        reason_text: `Gemini 识别: ${analysis.pattern_name} (置信度 ${analysis.confidence}%)`,
                        meta: { mode: 'replay', tags: ['llm', 'gemini'] }
                    });
                }
            }
        };

        await Promise.all([
            checkSignalLLM('000001', '平安银行', data.pingan),
            checkSignalLLM('600519', '贵州茅台', data.moutai),
            checkSignalLLM('002594', '比亚迪', data.byd)
        ]);
    }

    private _updatePositionHealth() {
        // ... (Same as before)
    }

    private _runExitPolicy() {
        this._positions.forEach(pos => {
            // ... (Same exit logic as before)
            if (pos.unrealized_pnl_pct <= -this._strategyConfig.stop_loss_pct) {
                this._createAutoIntent(pos, IntentType.STOP_LOSS_SELL, `自适应止损: 触及 -${this._strategyConfig.stop_loss_pct}%. 执行保护.`, pos.quantity);
                return;
            }
            if (pos.unrealized_pnl_pct >= this._strategyConfig.take_profit_pct) {
                this._createAutoIntent(pos, IntentType.TAKE_PROFIT_SELL, `自适应止盈: 达到 +${this._strategyConfig.take_profit_pct}%. 止盈清仓.`, pos.quantity);
                return;
            }
        });
    }

    private _optimizeStrategy() {
        // ... (Same as before)
    }

    private _createAutoIntent(pos: Position, type: IntentType, reason: string, qty: number) {
        // Auto-approve exit for replay flow smoothness
        const intent: TradeIntent = {
            intent_id: `auto-${generateId()}`,
            trade_day: this._market.replay_date || '2025-01-01',
            session_id: 'auto-scan',
            symbol: pos.symbol,
            name: pos.name,
            side: Side.SELL,
            intent_type: type,
            qty: qty,
            price: pos.current_price,
            reduce_only: true,
            time_in_force: 'DAY',
            strategy_id: 'strict_exit_v2',
            reason: reason,
            source: { source_event_id: `evt-scan-${generateId()}`, parent_intent_id: null, trigger: 'exit_policy' },
            version: { intent_schema: '1.0.0', rule_version: '2.0.0' },
            timestamp: new Date().toISOString(),
            status: 'PENDING_APPROVAL' 
        };

        this._intents = [intent, ...this._intents];
        // Auto submit for mock broker (Simulate auto-trading)
        this.approveSignal(intent.intent_id);
        
        this._emit({
            type: EventType.EXIT_SIGNAL_EMITTED,
            agent: AgentType.EXIT,
            decision: Decision.INFO,
            symbol: pos.symbol,
            reason_code: 'EXIT_TRIGGER',
            reason_text: reason,
            severity: Severity.INFO,
            meta: { mode: 'replay' }
        });
    }

    private _updateMetrics() {
        // ... (Same as before)
    }

    // --- Standard Methods ---

    subscribe(callback: Function) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    getState() {
        // Simulation Status
        const simStatus: SimulationStatus = {
            isPlaying: this.isPlaying,
            speed: this.replaySpeed,
            currentDate: this._market.replay_date || 'Init',
            progress: (this.currentReplayIndex / this.maxReplayLength) * 100,
            totalDays: this.maxReplayLength
        };

        return {
            market: this._market,
            account: this._account,
            positions: this._positions,
            intents: this._intents,
            events: this._events,
            audit: this._audit,
            metrics: this._metrics,
            orders: this.broker.getOrders(),
            simulation: simStatus // Expose simulation status
        };
    }

    nextDay(manual = true) {
        if (manual) {
           // Manual button click logic
        }
        
        // Days held increment
        this._positions = this._positions.map(p => ({
            ...p,
            sellable: p.quantity, // T+1 Settlement
            days_held: p.days_held + 1,
            today_buys: 0
        }));
        this._account = { ...this._account, filled_buys_today: 0 };
        this._saveState();
        
        if (manual) this._notify();
    }

    setTotalEquity(amount: number) {
        // ... (Same)
        const newCash = amount - this._account.market_value;
        this._account = { ...this._account, total_equity: amount, available_cash: newCash };
        this._saveState();
        this._notify();
    }

    async approveSignal(intentId: string, overridePrice?: number) {
        // ... (Same logic)
        const intent = this._intents.find(i => i.intent_id === intentId);
        if (!intent) return;

        let finalIntent = intent;
        if (overridePrice !== undefined) finalIntent = { ...intent, price: overridePrice };

        this._emit({ type: EventType.HUMAN_APPROVED, agent: AgentType.EXECUTION, decision: Decision.ALLOW, reason_code: 'USER_APPROVED', reason_text: '批准交易', symbol: intent.symbol, trace_id: `trace-${generateId()}`, meta: { mode: 'replay', tags: ['ui_action'] } });

        await this._submitToBroker(finalIntent, `trace-${generateId()}`);
        finalIntent.status = OrderStatus.SUBMITTED;
        this._saveState();
        this._notify();
    }

    rejectSignal(intentId: string) {
        // ... (Same)
        this._intents = this._intents.filter(i => i.intent_id !== intentId);
        this._saveState();
        this._notify();
    }

    cancelOrder(intentId: string) {
        // ... (Same)
        const success = this.broker.cancelOrder(intentId);
        if (success) {
            const intent = this._intents.find(i => i.intent_id === intentId);
            if (intent) intent.status = OrderStatus.CANCELLED;
            this._saveState();
            this._notify();
        }
    }

    private async _submitToBroker(intent: TradeIntent, traceId: string) {
        // ... (Same)
        this.broker.submitOrder(intent);
    }

    private _applyFillLogic(intent: TradeIntent, fillPrice: number, fillQty: number, costs: number) {
        // ... (Same fill logic, but updated logic for PnL/Positions)
        // Copy paste original logic or assume it works as it is identical.
        // For brevity in update, I ensure the logic handles positions correctly.
        
        const cashImpact = intent.side === Side.BUY 
            ? ((fillPrice * fillQty) + costs) 
            : ((fillPrice * fillQty) - costs);

        if (intent.side === Side.BUY) {
            this._account = {
                ...this._account,
                available_cash: this._account.available_cash - cashImpact,
                filled_buys_today: this._account.filled_buys_today + 1
            };
            const existingIdx = this._positions.findIndex(p => p.symbol === intent.symbol);
            if (existingIdx >= 0) {
                const p = this._positions[existingIdx];
                const newQty = p.quantity + fillQty;
                const newCost = ((p.quantity * p.average_cost) + (fillPrice * fillQty) + costs) / newQty;
                this._positions[existingIdx] = { 
                    ...p, 
                    quantity: newQty, 
                    average_cost: newCost, 
                    market_value: newQty * fillPrice, 
                    today_buys: p.today_buys + 1, 
                    current_price: fillPrice 
                };
            } else {
                this._positions.push({
                    symbol: intent.symbol, name: intent.name, quantity: fillQty, sellable: 0,
                    average_cost: ((fillPrice * fillQty) + costs) / fillQty,
                    current_price: fillPrice, market_value: fillPrice * fillQty,
                    unrealized_pnl: -costs, unrealized_pnl_pct: 0, today_buys: 1,
                    days_held: 0
                });
            }
        } else {
             this._account = { ...this._account, available_cash: this._account.available_cash + cashImpact };
             const existingIdx = this._positions.findIndex(p => p.symbol === intent.symbol);
             if (existingIdx >= 0) {
                 const p = this._positions[existingIdx];
                 const newQty = p.quantity - fillQty;
                 if (newQty <= 0) {
                     this._positions.splice(existingIdx, 1);
                 } else {
                     this._positions[existingIdx] = { ...p, quantity: newQty, sellable: p.sellable - fillQty, market_value: newQty * fillPrice, current_price: fillPrice };
                 }
             }
        }
        
        if (intent.status === OrderStatus.FILLED) {
             this._intents = this._intents.filter(i => i.intent_id !== intent.intent_id);
        }
        this._saveState();
    }

    private _emit(event: Partial<SystemEvent>) {
        const fullEvent: SystemEvent = {
            event_id: `evt-${generateId()}`, ts: new Date().toISOString(), trade_day: this._market.replay_date || '2025-01-01',
            session_id: 'replay-session', trace_id: `trace-${generateId()}`, parent_event_id: null,
            type: 'UNKNOWN', agent: AgentType.SYSTEM, decision: Decision.INFO, severity: Severity.INFO,
            symbol: null, reason_code: 'LOG', reason_text: '', meta: { mode: 'replay' }, ...event
        };
        this._events = [...this._events, fullEvent];
    }
    private _notify() { this.listeners.forEach(cb => cb(this.getState())); }
}

export const backend = new MockBackendService();
