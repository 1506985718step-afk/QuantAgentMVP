
import { BarData, getMockBars } from './historicalData';
import { MarketSnapshot } from '../types';
import { config } from './config';

export interface IDataProvider {
    getBars(symbol: string, limit?: number): Promise<BarData[]>;
    getSnapshot(symbol: string): Promise<MarketSnapshot>;
}

export class HybridDataProvider implements IDataProvider {
    
    async getBars(symbol: string, limit: number = 300): Promise<BarData[]> {
        // If explicitly in Simulation/Mock mode, use the Vintage Data immediately.
        // This ensures the "Training Board" always has high-quality data to replay.
        if (!config.useRealBackend) {
            // Now generates symbol-specific mock data
            const allBars = getMockBars(symbol);
            return allBars; // In mock, we usually return full history so replay works from start
        }

        // Only try to fetch from backend if in Real Backend mode
        const apiBase = config.apiBaseUrl || 'http://localhost:8000/api';

        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(`${apiBase}/market/history/${symbol}`, {
                signal: controller.signal
            });
            clearTimeout(id);

            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    return data.slice(-limit);
                }
            }
        } catch (e) {
            console.warn(`Real Backend unreachable. Switching to Training Data.`);
        }

        // Fallback for failed real request
        return getMockBars(symbol);
    }

    async getSnapshot(symbol: string): Promise<MarketSnapshot> {
        return {
            index_price: 3300,
            change_pct: 0,
            sentiment_score: 50,
            volatility_index: 20,
            up_count: 2000,
            down_count: 2000,
            limit_up_count: 30,
            limit_down_count: 5
        };
    }
}

export const dataProvider = new HybridDataProvider();
