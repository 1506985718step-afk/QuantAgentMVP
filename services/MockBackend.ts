
import { 
    SimulationStatus 
} from '../types';
import { backend as apiBackend } from './APIBackend';
import { authService } from './authService';
import { config } from './config';

// Constraint Violation Fixed:
// Frontend should NOT contain simulation logic (tickers, equity calc).
// MockBackend now strictly calls Backend APIs to drive the simulation.

class MockBackendService {
    private isPlaying = false;
    private simulationTimer: any = null;
    private listeners: Function[] = [];
    
    // Initial Index for Alpha Calculation (Visual only)
    private initialIndexPrice = 3000;
    private initialEquity = 100000;

    getState() {
        const baseState = apiBackend.getState();
        
        // Visual Metadata for Frontend
        const simStatus: SimulationStatus = {
            isPlaying: this.isPlaying,
            speed: 1,
            currentDate: baseState.market.replay_date || 'Init',
            progress: 50, 
            totalDays: 100
        };

        const currentEquity = baseState.account.total_equity;
        const currentIndex = baseState.market.index_price;
        const safeInitialIndex = this.initialIndexPrice || 3000;
        
        const myReturn = ((currentEquity - this.initialEquity) / this.initialEquity) * 100;
        const indexReturn = ((currentIndex - safeInitialIndex) / safeInitialIndex) * 100;
        const alpha = myReturn - indexReturn;

        return {
            ...baseState,
            simulation: simStatus,
            performance: {
                myReturn,
                indexReturn,
                alpha
            }
        };
    }

    subscribe(callback: Function) {
        this.listeners.push(callback);
        // Relay API updates
        const unsub = apiBackend.subscribe(() => {
            const s = apiBackend.getState();
            // Capture initial state once loaded
            if (this.initialIndexPrice === 3000 && s.market.index_price > 0 && s.market.index_price !== 3000) {
                 this.initialIndexPrice = s.market.index_price;
            }
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

    // --- Simulation Controls (Remote Control) ---

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
        this.notify(); // Just UI update
    }

    stepForward() {
        this.isPlaying = false;
        if (this.simulationTimer) clearTimeout(this.simulationTimer);
        this.triggerBackendTick();
    }

    async jumpToDate(date: string) {
        this.isPlaying = false;
        if (this.simulationTimer) clearTimeout(this.simulationTimer);
        
        // Constraint: Backend is Truth. Reset Backend State via API.
        const token = authService.getToken();
        if(!token) return;

        try {
            await fetch(`${config.apiBaseUrl}/simulation/reset`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    initial_equity: 100000,
                    trade_day: date
                })
            });
            // Reset local visual trackers
            this.initialEquity = 100000;
            this.initialIndexPrice = 3000;
            
        } catch(e) {
            console.error("Failed to reset backend simulation", e);
        }
        
        this.notify();
    }

    private scheduleNextTick() {
        this.simulationTimer = setTimeout(() => {
            this.triggerBackendTick().then(() => {
                if (this.isPlaying) this.scheduleNextTick();
            });
        }, 1500); 
    }

    private async triggerBackendTick() {
        // Drive the Python loop
        try {
            await apiBackend.nextDay();
            await fetch(`${config.apiBaseUrl}/debug/tick`, { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authService.getToken()}` } 
            });
        } catch (e) {
            console.warn("Simulation tick failed (Backend offline?)");
            this.isPlaying = false; // Stop playback if backend dies
            this.notify();
        }
    }

    // --- Passthroughs ---
    approveSignal(id: string, price: number) { apiBackend.approveSignal(id, price); }
    rejectSignal(id: string) { apiBackend.rejectSignal(id); }
    cancelOrder(id: string) { apiBackend.cancelOrder(id); }
    setTotalEquity(amount: number) { apiBackend.setTotalEquity(amount); }
    addToWatchlist(s: string, n: string) { apiBackend.addToWatchlist(s, n); }
    removeFromWatchlist(s: string) { apiBackend.removeFromWatchlist(s); }
    setWatchlist(items: any[]) { apiBackend.setWatchlist(items); }
}

export const backend = new MockBackendService();
