import { 
    AgentType, Decision, EventType, IntentType, MarketSnapshot, 
    Position, Side, SystemEvent, TradeIntent, AccountSummary, Severity,
    AuditReport, TradeMetrics, IntentSource, IntentVersion, AuditCheck, StrategyConfig, OrderStatus, BrokerOrder
} from '../types';
import { 
    MOCK_MARKET, MOCK_POSITIONS, MOCK_INTENTS, MOCK_EVENTS, MOCK_ACCOUNT, MOCK_AUDIT_REPORT, MOCK_METRICS, generateId 
} from './mockData';
import { BarData } from './historicalData'; // Keeping for type def, but usage via provider
import { MockBrokerService } from './MockBroker';
import { analyzeMarketWithLLM, generateAuditReportWithLLM } from './LLMService';
import { dataProvider } from './DataProvider';

/**
 * MockBackendService 2.3 (With AI Cooldown)
 */

// --- USER CONFIGURATION (Strict Mode) ---
const MAX_DAILY_BUYS = 1;         
const MAX_POS_PCT = 0.4;          // 40% (Between 30-50%)
const TAKE_PROFIT_TIER_1 = 8.0;   

const REPLAY_INTERVAL = 6000;     
const STORAGE_KEY = 'quant_agent_mvp_v1';
const AI_COOLDOWN_DAYS = 3; // How many ticks/days to wait before re-analyzing same stock

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

    // Replay State
    private listeners: Function[] = [];
    private simulationTimer: any = null;
    private currentReplayIndex = 0;
    // We will dynamically determine length from data provider
    private maxReplayLength = 10; 

    // AI Control
    private _lastAnalysisIndex: Record<string, number> = {};

    // Cache for Charts
    private _chartData: Record<string, BarData[]> = {};

    constructor() {
        console.log("Backend Initialized.");
        this._loadState(); // Load from LocalStorage
        this.initData();
        this.startSimulation();
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
                
                this._emit({
                    type: EventType.MARKET_SNAPSHOT,
                    agent: AgentType.SYSTEM,
                    decision: Decision.INFO,
                    reason_code: 'STATE_LOADED',
                    reason_text: '本地存档已加载',
                    severity: Severity.INFO,
                    meta: { mode: 'replay' }
                });
            }
        } catch (e) {
            console.warn("Failed to load state", e);
        }
    }

    private async initData() {
        // Pre-fetch data for pingan to determine length
        const bars = await dataProvider.getBars('000001', 50);
        this.maxReplayLength = bars.length;
        this._chartData['000001'] = bars;
        this._chartData['600519'] = await dataProvider.getBars('600519', 50);
        this._chartData['002594'] = await dataProvider.getBars('002594', 50);
    }

    // --- Core Simulation Loop ---
    
    private startSimulation() {
        if (this.simulationTimer) return;
        
        this.simulationTimer = setInterval(async () => {
            if (this.currentReplayIndex >= this.maxReplayLength) {
                this.currentReplayIndex = 0; 
                this._lastAnalysisIndex = {}; // Reset AI memory on loop
                this._emit({
                     type: EventType.DAILY_REPORT,
                     agent: AgentType.SYSTEM,
                     decision: Decision.INFO,
                     reason_code: 'REPLAY_LOOP',
                     reason_text: '回放循环重置',
                     trace_id: `trace-${generateId()}`,
                     meta: { mode: 'replay' }
                });
            }

            // Fetch Data via Provider (Simulating getting "Today's" bar)
            // In a real replay, we slice the array.
            const getDayData = (symbol: string) => {
                const allBars = this._chartData[symbol] || [];
                return allBars[this.currentReplayIndex] || allBars[allBars.length - 1];
            };

            const currentDayData = {
                pingan: getDayData('000001'),
                moutai: getDayData('600519'),
                byd: getDayData('002594')
            };

            if (!currentDayData.pingan) {
                this.currentReplayIndex = 0; // Reset if out of bounds
                return;
            }
            
            this._tickMarketReplay(currentDayData);
            
            // 1. Process Pending Broker Orders First
            this._processBrokerUpdates(currentDayData);

            // 2. Run Strategy (LLM Async)
            await this._runAIStrategy(currentDayData); 
            
            this._runExitPolicy(); 
            // Audit is now triggered manually or on Next Day to save tokens
            // this._runAuditEngine(); 
            this._updatePositionHealth(); 
            
            // Only advance day logic if index actually moved (simple throttling)
            // For MVP we just call nextDay explicitly via button or very slowly.
            // But here we just move the "data cursor".
            this.currentReplayIndex++;
            this._notify();
        }, REPLAY_INTERVAL);
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

        if (changePct > 0.3) {
            upCount = 3600 + Math.floor(Math.random() * 500); 
            limitUp = 65 + Math.floor(Math.random() * 40);     
            limitDown = Math.floor(Math.random() * 8);         
        } else if (changePct > 0) {
            upCount = 2800 + Math.floor(Math.random() * 500);
            limitUp = 40 + Math.floor(Math.random() * 20);
            limitDown = 5 + Math.floor(Math.random() * 10);
        } else {
            upCount = 1000 + Math.floor(Math.random() * 1000);
            limitUp = 10 + Math.floor(Math.random() * 20);
            limitDown = 20 + Math.floor(Math.random() * 20);
        }

        this._market = {
            ...this._market,
            replay_date: date,
            index_price: 3200 + (this.currentReplayIndex * 5),
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

            const daysHeld = pos.days_held + 1;

            return {
                ...pos,
                current_price: newPrice,
                market_value: marketVal,
                unrealized_pnl: pnl,
                unrealized_pnl_pct: pnlPct,
                days_held: daysHeld 
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

        const cond1 = this._market.up_count >= 3500;
        const cond2 = this._market.limit_up_count >= 60;
        const score = (cond1 ? 1 : 0) + (cond2 ? 1 : 0);
        const isMarketGood = score >= 1; 

        if (!isMarketGood) return;

        const calculateSafeQty = (price: number): number => {
            if (price <= 0) return 0;
            const maxAllocation = this._account.total_equity * MAX_POS_PCT;
            let lots = Math.floor(maxAllocation / (price * 100));
            const cashLots = Math.floor(this._account.available_cash / (price * 100));
            lots = Math.min(lots, cashLots);
            return lots * 100;
        };

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
                const safeQty = calculateSafeQty(bar.close);
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
            } else {
                 // Log rejected by LLM (Optional: for verbose debug)
                 // console.log(`[Gemini] Rejected ${symbol}: ${analysis.reasoning}`);
            }
        };

        await Promise.all([
            checkSignalLLM('000001', '平安银行', data.pingan),
            checkSignalLLM('600519', '贵州茅台', data.moutai),
            checkSignalLLM('002594', '比亚迪', data.byd)
        ]);
    }

    private _updatePositionHealth() {
        let p = this._metrics.win_rate || 0.4;
        let b = this._metrics.profit_factor || 1.5;
        if (b === 0) b = 1;

        let kelly = p - ((1 - p) / b);
        if (kelly < 0) kelly = 0;
        kelly = Math.min(kelly, 0.5);

        const stockPct = this._account.market_value / this._account.total_equity;
        const diff = Math.abs(stockPct - kelly);
        const healthScore = Math.max(0, 100 - (diff * 200));

        this._account.position_health_score = Number(healthScore.toFixed(0));
        this._account.kelly_suggestion = Number(kelly.toFixed(2));
    }

    private _runExitPolicy() {
        this._positions.forEach(pos => {
            const hasPending = this._intents.some(i => i.symbol === pos.symbol && i.status === 'PENDING_APPROVAL');
            if (hasPending) return;

            if (pos.unrealized_pnl_pct <= -this._strategyConfig.stop_loss_pct) {
                this._createAutoIntent(pos, IntentType.STOP_LOSS_SELL, `自适应止损: 触及 -${this._strategyConfig.stop_loss_pct}%. 执行保护.`, pos.quantity);
                return;
            }

            if (pos.unrealized_pnl_pct >= this._strategyConfig.take_profit_pct) {
                this._createAutoIntent(pos, IntentType.TAKE_PROFIT_SELL, `自适应止盈: 达到 +${this._strategyConfig.take_profit_pct}%. 止盈清仓.`, pos.quantity);
                return;
            }

            if (pos.unrealized_pnl_pct >= TAKE_PROFIT_TIER_1) {
                if (pos.quantity >= 200) { 
                     let qtyToSell = Math.floor((pos.quantity * 0.5) / 100) * 100;
                     if (qtyToSell > 0) {
                         this._createAutoIntent(pos, IntentType.TAKE_PROFIT_SELL, `基础止盈: 达到 +${TAKE_PROFIT_TIER_1}%. 减半锁定利润.`, qtyToSell);
                         return;
                     }
                }
            }
            
            const daysHeld = pos.days_held;
            if (daysHeld >= 1 && pos.unrealized_pnl_pct < 1.0) {
                this._createAutoIntent(
                    pos, 
                    IntentType.SELL, 
                    `T+1时间止损: 持仓${daysHeld}天滞涨(当前+${pos.unrealized_pnl_pct.toFixed(2)}%). 弱势清理.`, 
                    pos.quantity
                );
                return;
            }
        });
    }

    private _optimizeStrategy() {
        if (this._closedTrades.length < 2) return; 

        const recentTrades = this._closedTrades.slice(-5); 
        const winRate = recentTrades.filter(t => t.pnl > 0).length / recentTrades.length;
        
        const recentLosses = recentTrades.filter(t => t.pnl < 0);
        let avgLossPct = 0;
        if (recentLosses.length > 0) {
            avgLossPct = recentLosses.reduce((acc, t) => acc + t.pnlPct, 0) / recentLosses.length;
        }

        let newConfig = { ...this._strategyConfig };
        let updated = false;
        let reasons: string[] = [];

        if (winRate < 0.3) {
            if (newConfig.vol_threshold < 3.0) {
                newConfig.vol_threshold = Math.min(3.0, newConfig.vol_threshold + 0.2);
                updated = true;
                reasons.push(`胜率极低(${(winRate*100).toFixed(0)}%) -> 大幅提高量比阈值至 ${newConfig.vol_threshold.toFixed(1)}x`);
            }
        } else if (winRate < 0.5) {
             if (newConfig.vol_threshold < 2.5) {
                 newConfig.vol_threshold = Math.min(2.5, newConfig.vol_threshold + 0.1);
                 updated = true;
                 reasons.push(`胜率不足(${(winRate*100).toFixed(0)}%) -> 微调提高阈值至 ${newConfig.vol_threshold.toFixed(1)}x`);
             }
        } else if (winRate >= 0.8) {
             if (newConfig.vol_threshold > 1.2) {
                 newConfig.vol_threshold = Math.max(1.2, newConfig.vol_threshold - 0.1);
                 updated = true;
                 reasons.push(`胜率优异(${(winRate*100).toFixed(0)}%) -> 适当放宽阈值至 ${newConfig.vol_threshold.toFixed(1)}x`);
             }
        }

        if (recentLosses.length >= 2 && avgLossPct < -0.035) {
            if (newConfig.stop_loss_pct > 2.0) {
                newConfig.stop_loss_pct = Math.max(2.0, newConfig.stop_loss_pct - 0.5);
                updated = true;
                reasons.push(`近期亏损幅度大(${(avgLossPct*100).toFixed(1)}%) -> 收紧止损至 -${newConfig.stop_loss_pct}%`);
            }
        }

        if (updated) {
            newConfig.last_updated = new Date().toISOString();
            newConfig.update_reason = reasons.join(" | ");
            this._strategyConfig = newConfig;

            this._emit({
                type: EventType.STRATEGY_UPDATED,
                agent: AgentType.SYSTEM,
                decision: Decision.INFO,
                reason_code: 'AI_OPTIMIZATION',
                reason_text: `AI 自进化: ${reasons.join(", ")}`,
                severity: Severity.INFO,
                payload: newConfig,
                meta: { mode: 'replay' }
            });
        }
    }

    private _createAutoIntent(pos: Position, type: IntentType, reason: string, qty: number) {
        if (qty <= 0) return;

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
            source: {
                source_event_id: `evt-scan-${generateId()}`,
                parent_intent_id: null,
                trigger: 'exit_policy'
            },
            version: { intent_schema: '1.0.0', rule_version: '2.0.0' },
            timestamp: new Date().toISOString(),
            status: 'PENDING_APPROVAL'
        };

        this._intents = [intent, ...this._intents];
        this._saveState();

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

    private async _runAuditEngine() {
        const riskEventsCount = this._events.filter(e => e.decision === Decision.BLOCK || e.severity === Severity.WARN).length;
        const tradesCount = this._closedTrades.length + this._positions.filter(p => p.today_buys > 0).length;

        // Use LLM to generate Audit Report
        const aiResult = await generateAuditReportWithLLM(
             this._market.replay_date || 'Unknown',
             this._account.total_equity,
             this._account.day_pnl,
             tradesCount,
             riskEventsCount
        );

        this._audit = {
            date: this._market.replay_date || 'Unknown',
            score: aiResult.score || 80, 
            status: aiResult.status || 'PASS',
            checks: aiResult.checks || [],
            ai_suggestions: aiResult.ai_suggestions || [],
            active_config: this._strategyConfig
        };
    }

    private _updateMetrics() {
        if (this._closedTrades.length === 0) return;

        const wins = this._closedTrades.filter(t => t.pnl > 0);
        const losses = this._closedTrades.filter(t => t.pnl <= 0);

        const totalTrades = this._closedTrades.length;
        const winRate = wins.length / totalTrades;
        
        const avgWin = wins.length > 0 
            ? wins.reduce((acc, t) => acc + t.pnl, 0) / wins.length 
            : 0;
            
        const avgLoss = losses.length > 0
            ? Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0) / losses.length)
            : 0;

        const grossProfit = wins.reduce((acc, t) => acc + t.pnl, 0);
        const grossLoss = Math.abs(losses.reduce((acc, t) => acc + t.pnl, 0));
        const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 99 : 0) : grossProfit / grossLoss;
        
        const totalCosts = this._closedTrades.reduce((acc, t) => acc + t.costs, 0);
        const netPnl = grossProfit - grossLoss;
        const costRatio = Math.abs(netPnl) > 0 ? totalCosts / Math.abs(netPnl) : 0;

        let peak = 0;
        let runningPnl = 0;
        let maxDd = 0;
        
        this._closedTrades.forEach(t => {
            runningPnl += t.pnl;
            if (runningPnl > peak) peak = runningPnl;
            const dd = peak - runningPnl;
            const ddPct = dd / 10000; 
            if (ddPct > maxDd) maxDd = ddPct;
        });

        this._metrics = {
            win_rate: winRate,
            profit_factor: profitFactor,
            avg_win_pnl: avgWin,
            avg_loss_pnl: avgLoss,
            total_trades: totalTrades,
            max_drawdown: maxDd,
            cost_ratio: costRatio
        };
    }

    // --- Standard Methods ---

    subscribe(callback: Function) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    getState() {
        // Only return chart data if explicitly asked (optimization) or let UI fetch via provider
        // But for "current snapshot of everything", we can just return orders via broker
        return {
            market: this._market,
            account: this._account,
            positions: this._positions,
            intents: this._intents,
            events: this._events,
            audit: this._audit,
            metrics: this._metrics,
            orders: this.broker.getOrders() // New
        };
    }

    nextDay(log = true) {
        // Trigger AI Audit before day end processing
        this._runAuditEngine();

        this._optimizeStrategy();

        if (this._account.day_pnl < 0) {
            this.consecutiveLossDays++;
        } else {
            this.consecutiveLossDays = 0;
        }

        if (this.consecutiveLossDays >= 2) {
            this.isRestDay = true;
            this.consecutiveLossDays = 0; 
        } else {
            this.isRestDay = false;
        }

        this._positions = this._positions.map(p => ({
            ...p,
            sellable: p.quantity,
            today_buys: 0
        }));
        this._account = { ...this._account, filled_buys_today: 0 };
        
        this._saveState();

        if (log) {
            this._emit({
                type: EventType.DAILY_REPORT,
                agent: AgentType.SYSTEM,
                decision: Decision.INFO,
                reason_code: 'NEW_DAY_START',
                reason_text: `T+1 结算完成. 强制休息日: ${this.isRestDay}.`,
                trace_id: `trace-${generateId()}`,
                meta: { mode: 'replay' }
            });
            this._notify();
        }
    }

    setTotalEquity(amount: number) {
        const newCash = amount - this._account.market_value;
        const oldEquity = this._account.total_equity;
        this._account = { ...this._account, total_equity: amount, available_cash: newCash };
        this._saveState();

        this._emit({
            type: EventType.DAILY_REPORT,
            agent: AgentType.SYSTEM,
            decision: Decision.INFO,
            reason_code: 'CAPITAL_ADJUSTMENT',
            reason_text: `资金调整: ¥${oldEquity.toFixed(2)} -> ¥${amount.toFixed(2)}`,
            trace_id: `trace-${generateId()}`,
            payload: { old: oldEquity, new: amount },
            meta: { mode: 'replay' }
        });
        this._notify();
    }

    async approveSignal(intentId: string, overridePrice?: number) {
        const intent = this._intents.find(i => i.intent_id === intentId);
        if (!intent) return;

        let finalIntent = intent;
        if (overridePrice !== undefined) finalIntent = { ...intent, price: overridePrice };

        this._emit({
            type: EventType.HUMAN_APPROVED,
            agent: AgentType.EXECUTION,
            decision: Decision.ALLOW,
            reason_code: 'USER_APPROVED',
            reason_text: `用户批准 ${intent.symbol} 价格 ¥${finalIntent.price}`,
            symbol: intent.symbol,
            trace_id: `trace-${generateId()}`,
            meta: { mode: 'replay', tags: ['ui_action'] }
        });

        await this._submitToBroker(finalIntent, `trace-${generateId()}`);
        finalIntent.status = OrderStatus.SUBMITTED;
        this._saveState();
        this._notify();
    }

    rejectSignal(intentId: string) {
        const intent = this._intents.find(i => i.intent_id === intentId);
        if (!intent) return;
        this._emit({
            type: EventType.GUARD_BLOCKED,
            agent: AgentType.EXECUTION,
            decision: Decision.BLOCK,
            reason_code: 'USER_REJECT',
            reason_text: `用户拒绝信号 ${intentId}`,
            symbol: intent.symbol,
            trace_id: `trace-${generateId()}`,
            meta: { mode: 'replay', tags: ['ui_action'] }
        });
        this._intents = this._intents.filter(i => i.intent_id !== intentId);
        this._saveState();
        this._notify();
    }

    // New: Cancel Order Logic
    cancelOrder(intentId: string) {
        const success = this.broker.cancelOrder(intentId);
        if (success) {
            const intent = this._intents.find(i => i.intent_id === intentId);
            if (intent) intent.status = OrderStatus.CANCELLED;
            
            this._emit({
                type: EventType.ORDER_REJECTED, // Using Rejected as cancelled for log
                agent: AgentType.BROKER,
                decision: Decision.INFO,
                reason_code: 'USER_CANCEL',
                reason_text: '用户发起撤单',
                symbol: intent?.symbol,
                meta: { mode: 'replay' }
            });
            this._saveState();
            this._notify();
        }
    }

    private async _submitToBroker(intent: TradeIntent, traceId: string) {
        const filledBuysToday = this._account.filled_buys_today;
        if (intent.side === Side.BUY && filledBuysToday >= MAX_DAILY_BUYS) {
             this._emit({ type: EventType.GUARD_BLOCKED, agent: AgentType.RISK, decision: Decision.BLOCK, reason_code: 'DAILY_LIMIT', reason_text: '达到单日买入限制', trace_id: traceId, severity: Severity.WARN, meta: { mode: 'replay' } });
             return;
        }

        if (intent.side === Side.SELL) {
            const pos = this._positions.find(p => p.symbol === intent.symbol);
            if (!pos || pos.sellable < intent.qty) {
                 this._emit({ type: EventType.ORDER_REJECTED, agent: AgentType.EXECUTION, decision: Decision.BLOCK, reason_code: 'T_PLUS_ONE', reason_text: '违反 T+1 规则', trace_id: traceId, severity: Severity.ERROR, meta: { mode: 'replay' } });
                 return;
        }
        }

        this.broker.submitOrder(intent);

        this._emit({
            type: EventType.ORDER_SUBMITTED,
            agent: AgentType.BROKER,
            decision: Decision.INFO,
            symbol: intent.symbol,
            reason_code: 'ORDER_SUBMITTED',
            reason_text: `订单已提交至模拟券商: ${intent.side} ${intent.qty} @ ${intent.price}`,
            trace_id: traceId,
            meta: { mode: 'replay' }
        });
    }

    private _applyFillLogic(intent: TradeIntent, fillPrice: number, fillQty: number, costs: number) {
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
                 
                 const pnl = (fillPrice * fillQty) - (p.average_cost * fillQty) - costs;
                 const pnlPct = (pnl / (p.average_cost * fillQty));
                 
                 this._closedTrades.push({
                     symbol: intent.symbol, side: Side.SELL, qty: fillQty,
                     entryPrice: p.average_cost, exitPrice: fillPrice,
                     pnl: pnl, pnlPct: pnlPct, costs: costs
                 });
                 this._updateMetrics();

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

    // Boilerplate _emit, _notify etc.
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
