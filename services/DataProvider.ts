
import { BarData } from './historicalData';
import { MarketSnapshot } from '../types';
import { config } from './config';

export interface IDataProvider {
    getBars(symbol: string, limit?: number): Promise<BarData[]>;
    getSnapshot(symbol: string): Promise<MarketSnapshot>;
}

export class HybridDataProvider implements IDataProvider {
    
    async getBars(symbol: string, limit: number = 300): Promise<BarData[]> {
        // CONSTRAINT: Backend is Source of Truth.
        // Even in 'mock' mode, we request the backend to generate the deterministic mock data.
        
        const apiBase = config.apiBaseUrl || 'http://localhost:8000/api';

        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000); // 5s timeout

            const res = await fetch(`${apiBase}/market/history/${symbol}`, {
                signal: controller.signal,
                headers: {
                    // Pass auth token if available, though getBars might be public
                    'Authorization': `Bearer ${localStorage.getItem('quant_token') || ''}`
                }
            });
            clearTimeout(id);

            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    return data.slice(-limit);
                }
            }
        } catch (e) {
            console.error(`Data Fetch Error:`, e);
        }

        return [];
    }

    async getSnapshot(symbol: string): Promise<MarketSnapshot> {
        // Snapshot is usually part of the global system state polling, 
        // but if needed individually, it should also come from API.
        return {
            index_price: 3300,
            change_pct: 0,
            sentiment_score: 50,
            volatility_index: 20,
            up_count: 0,
            down_count: 0,
            limit_up_count: 0,
            limit_down_count: 0
        };
    }
}

export const dataProvider = new HybridDataProvider();
