
import { 
    AccountSummary, Position, TradeIntent, SystemEvent, MarketSnapshot, 
    AuditReport, TradeMetrics, BrokerOrder, SimulationStatus 
} from '../types';
import { backend as apiBackend } from './APIBackend';

// MOCK BACKEND NOW PROXIES TO REAL BACKEND (SIMULATION MODE)
// This ensures Logic Single Source of Truth in Python.

class MockBackendService {
    private isPlaying = false;
    private simulationTimer: any = null;
    private listeners: Function[] = [];
    
    // Proxy state from API Backend
    getState() {
        // We wrap the API state with Simulation Status metadata
        const baseState = apiBackend.getState();
        
        // Mock Simulation Status (In a real app, backend should provide this progress)
        const simStatus: SimulationStatus = {
            isPlaying: this.isPlaying,
            speed: 1,
            currentDate: baseState.market.replay_date || 'Init',
            progress: 50, // Placeholder
            totalDays: 100
        };

        return {
            ...baseState,
            simulation: simStatus
        };
    }

    subscribe(callback: Function) {
        this.listeners.push(callback);
        // Subscribe to API Backend updates and forward them
        const unsub = apiBackend.subscribe(() => {
            this.notify();
        });
        return () => {
            unsub();
            this.listeners = this.listeners.filter(l => l !== callback);
        };
    }

    private notify() {
        this.listeners.forEach(cb => cb(this.getState()));
    }

    // --- Simulation Controls (Drive the Backend) ---

    togglePlayback() {
        this.isPlaying = !this.isPlaying;
        if (this.isPlaying) {
            this.scheduleNextTick();
        } else {
            if (this.simulationTimer) clearTimeout(this.simulationTimer);
        }
        this.notify();
    }

    setSpeed(speed: number) {
        // Just UI update for now
        this.notify();
    }

    stepForward() {
        this.isPlaying = false;
        if (this.simulationTimer) clearTimeout(this.simulationTimer);
        this.triggerBackendTick();
    }

    private scheduleNextTick() {
        this.simulationTimer = setTimeout(() => {
            this.triggerBackendTick().then(() => {
                if (this.isPlaying) this.scheduleNextTick();
            });
        }, 1500); // 1.5s per day
    }

    private async triggerBackendTick() {
        // 1. Advance Day
        await apiBackend.nextDay();
        // 2. Scan Market (Tick)
        await fetch('/api/debug/tick', { method: 'POST' });
        // State update happens via polling in APIBackend
    }

    // --- Passthrough Actions ---
    
    approveSignal(id: string, price: number) {
        apiBackend.approveSignal(id, price);
    }

    rejectSignal(id: string) {
        apiBackend.rejectSignal(id);
    }

    cancelOrder(id: string) {
        apiBackend.cancelOrder(id);
    }

    setTotalEquity(amount: number) {
        apiBackend.setTotalEquity(amount);
    }

    addToWatchlist(symbol: string, name: string) {
        apiBackend.addToWatchlist(symbol, name);
    }

    removeFromWatchlist(symbol: string) {
        apiBackend.removeFromWatchlist(symbol);
    }

    setWatchlist(items: {symbol: string, name: string}[]) {
        apiBackend.setWatchlist(items);
    }
}

export const backend = new MockBackendService();
