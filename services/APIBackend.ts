
import { 
    AccountSummary, Position, TradeIntent, SystemEvent, MarketSnapshot, 
    AuditReport, TradeMetrics, BrokerOrder
} from '../types';

const API_BASE = 'http://localhost:8000';

class APIBackendService {
    private listeners: Function[] = [];
    private pollInterval: any = null;

    // Initial Safe State
    private state = {
        isConnected: false, // New: Track connection status
        market: {
            index_price: 0,
            change_pct: 0,
            sentiment_score: 50,
            volatility_index: 0,
            up_count: 0,
            down_count: 0,
            limit_up_count: 0,
            limit_down_count: 0,
            // Removed duplicate properties that were causing errors
            replay_date: '2026-01-17' // Default to requested date
        } as MarketSnapshot,
        account: {
            total_equity: 100000, // Default Start
            available_cash: 100000,
            market_value: 0,
            day_pnl: 0,
            day_pnl_pct: 0,
            filled_buys_today: 0
        } as AccountSummary,
        positions: [] as Position[],
        intents: [] as TradeIntent[],
        events: [] as SystemEvent[],
        audit: {
            date: '2026-01-17', // Default to requested date
            score: 100,
            status: 'PASS',
            checks: [],
            ai_suggestions: []
        } as AuditReport,
        metrics: {
            win_rate: 0,
            profit_factor: 0,
            avg_win_pnl: 0,
            avg_loss_pnl: 0,
            total_trades: 0,
            max_drawdown: 0,
            cost_ratio: 0
        } as TradeMetrics,
        orders: [] as BrokerOrder[],
        watchlist: [] as {symbol: string, name: string}[]
    };

    constructor() {
        console.log("API Backend Initialized. Connecting to " + API_BASE);
        this.startPolling();
    }

    private startPolling() {
        // Poll every 2 seconds for real-ish time updates
        this.fetchState();
        this.pollInterval = setInterval(() => this.fetchState(), 2000);
    }

    private async fetchState() {
        try {
            const res = await fetch(`${API_BASE}/api/state`);
            if (!res.ok) throw new Error("API Error");
            const data = await res.json();
            
            // Merge with local state structure
            this.state = {
                ...this.state,
                ...data,
                isConnected: true // Connection successful
            };
            this.notify();
        } catch (e) {
            // console.warn("Backend disconnected (Is Python server running?):", e);
            if (this.state.isConnected) {
                this.state = { ...this.state, isConnected: false };
                this.notify();
            }
        }
    }

    getState() {
        return this.state;
    }

    subscribe(callback: Function) {
        this.listeners.push(callback);
        return () => {
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notify() {
        this.listeners.forEach(cb => cb(this.state));
    }

    // --- Actions ---

    async approveSignal(id: string, price: number) {
        const intent = this.state.intents.find(i => i.intent_id === id);
        if (!intent) return;
        
        const payload = { ...intent, price }; // Update price if modified

        try {
            await fetch(`${API_BASE}/api/intent/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            this.fetchState(); // Immediate refresh
        } catch (e) {
            console.error("Failed to approve:", e);
        }
    }

    rejectSignal(id: string) {
        // Optimistic UI update could be done here
        console.log("Reject logic sent to backend");
        fetch(`${API_BASE}/api/intent/reject?intent_id=${id}`, { method: 'POST' }).catch(console.error);
    }

    async nextDay() {
        try {
            await fetch(`${API_BASE}/api/debug/next_day`, { method: 'POST' });
            this.fetchState();
        } catch (e) {}
    }
    
    async cancelOrder(id: string) {
        try {
            await fetch(`${API_BASE}/api/orders/cancel?intent_id=${id}`, { method: 'POST' });
            this.fetchState();
        } catch (e) {
            console.error("Failed to cancel order:", e);
        }
    }
    
    async setTotalEquity(amount: number) {
        // Optimistic Update for Mock Mode / Fast UI
        this.state.account.total_equity = amount;
        // Reset buying power assumption roughly
        this.state.account.available_cash = amount - this.state.account.market_value;
        this.notify();

        try {
            await fetch(`${API_BASE}/api/account/equity`, { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ amount })
            });
            this.fetchState();
        } catch (e) {
            // console.error("Failed to update equity (Backend offline):", e);
        }
    }

    async addToWatchlist(symbol: string, name: string) {
        // Optimistic
        const exists = this.state.watchlist.some(w => w.symbol === symbol);
        if (!exists) {
            this.state.watchlist = [...this.state.watchlist, {symbol, name}];
            this.notify();
        }

        try {
            await fetch(`${API_BASE}/api/watchlist/add`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol, name })
            });
            this.fetchState();
        } catch(e) { console.error(e); }
    }

    async removeFromWatchlist(symbol: string) {
        // Optimistic
        this.state.watchlist = this.state.watchlist.filter(w => w.symbol !== symbol);
        this.notify();
        try {
            await fetch(`${API_BASE}/api/watchlist/remove`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol })
            });
            this.fetchState();
        } catch(e) { console.error(e); }
    }

    async setWatchlist(items: {symbol: string, name: string}[]) {
        // Optimistic
        this.state.watchlist = items;
        this.notify();
        try {
            await fetch(`${API_BASE}/api/watchlist/set`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items })
            });
            this.fetchState();
        } catch(e) { console.error(e); }
    }
}

export const backend = new APIBackendService();