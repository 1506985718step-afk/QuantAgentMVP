
import { 
    AccountSummary, Position, TradeIntent, SystemEvent, MarketSnapshot, 
    AuditReport, TradeMetrics, BrokerOrder
} from '../types';
import { authService } from './authService';
import { config } from './config';

class APIBackendService {
    private listeners: Function[] = [];
    private pollInterval: any = null;

    // Initial Safe State
    private state = {
        isConnected: false, // Track connection status
        market: {
            index_price: 0,
            change_pct: 0,
            sentiment_score: 50,
            volatility_index: 0,
            up_count: 0,
            down_count: 0,
            limit_up_count: 0,
            limit_down_count: 0,
            replay_date: '2026-01-17' 
        } as MarketSnapshot,
        account: {
            total_equity: 100000, 
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
            date: '2026-01-17', 
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
        console.log("API Backend Initialized. Connecting to relative path: " + config.apiBaseUrl);
        this.startPolling();
    }

    private startPolling() {
        // Poll every 2 seconds for real-ish time updates
        this.fetchState();
        this.pollInterval = setInterval(() => this.fetchState(), 2000);
    }
    
    private getHeaders() {
        const token = authService.getToken();
        return token ? { 'Authorization': `Bearer ${token}` } : {};
    }

    // Helper to construct URLs
    // config.apiBaseUrl is '/api'
    // endpoint should be 'state' -> result '/api/state'
    private getUrl(endpoint: string) {
        // Remove leading slash from endpoint to avoid //
        const path = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
        return `${config.apiBaseUrl}/${path}`;
    }

    private async fetchState() {
        if (!authService.isAuthenticated()) return; // Stop polling if not logged in

        try {
            // URL: /api/state
            const res = await fetch(this.getUrl('state'), {
                headers: this.getHeaders()
            });
            
            if (res.status === 401) {
                authService.logout();
                return;
            }
            if (!res.ok) throw new Error(`API Error: ${res.status}`);
            
            const data = await res.json();
            
            // Merge with local state structure - Always create new object reference
            this.state = {
                ...this.state,
                ...data,
                isConnected: true // Connection successful
            };
            this.notify();
        } catch (e) {
            // Silent failure for polling to avoid console spam, but update status
            if (this.state.isConnected) {
                console.warn("Lost connection to backend.");
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
        
        const payload = { ...intent, price }; 

        try {
            await fetch(this.getUrl('intent/approve'), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...this.getHeaders()
                },
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
        fetch(this.getUrl(`intent/reject?intent_id=${id}`), { 
            method: 'POST',
            headers: this.getHeaders() 
        }).catch(console.error);
    }

    async nextDay() {
        try {
            await fetch(this.getUrl('debug/next_day'), { 
                method: 'POST',
                headers: this.getHeaders()
            });
            this.fetchState();
        } catch (e) {}
    }
    
    async cancelOrder(id: string) {
        try {
            await fetch(this.getUrl(`orders/cancel?intent_id=${id}`), { 
                method: 'POST',
                headers: this.getHeaders()
            });
            this.fetchState();
        } catch (e) {
            console.error("Failed to cancel order:", e);
        }
    }
    
    async setTotalEquity(amount: number) {
        // Optimistic Update for Mock Mode / Fast UI
        // Use immutable update to trigger React re-render
        this.state = {
            ...this.state,
            account: {
                ...this.state.account,
                total_equity: amount,
                available_cash: amount - this.state.account.market_value
            }
        };
        this.notify();

        try {
            await fetch(this.getUrl('account/equity'), { 
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...this.getHeaders()
                },
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
            this.state = {
                ...this.state,
                watchlist: [...this.state.watchlist, {symbol, name}]
            };
            this.notify();
        }

        try {
            await fetch(this.getUrl('watchlist/add'), { 
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json',
                    ...this.getHeaders()
                },
                body: JSON.stringify({ symbol, name })
            });
            this.fetchState();
        } catch(e) { console.error(e); }
    }

    async removeFromWatchlist(symbol: string) {
        // Optimistic
        this.state = {
            ...this.state,
            watchlist: this.state.watchlist.filter(w => w.symbol !== symbol)
        };
        this.notify();
        try {
            await fetch(this.getUrl('watchlist/remove'), { 
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json',
                    ...this.getHeaders()
                },
                body: JSON.stringify({ symbol })
            });
            this.fetchState();
        } catch(e) { console.error(e); }
    }

    async setWatchlist(items: {symbol: string, name: string}[]) {
        // Optimistic - Use immutable update
        this.state = {
            ...this.state,
            watchlist: items
        };
        this.notify();
        try {
            await fetch(this.getUrl('watchlist/set'), {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    ...this.getHeaders()
                },
                body: JSON.stringify({ items })
            });
            this.fetchState();
        } catch(e) { console.error(e); }
    }
}

export const backend = new APIBackendService();
