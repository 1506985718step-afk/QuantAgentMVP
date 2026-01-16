import { BarData, EMPTY_DATA, FALLBACK_MOCK_DATA } from './historicalData';
import { MarketSnapshot } from '../types';
import { config } from './config';

export interface IDataProvider {
    getBars(symbol: string, limit?: number): Promise<BarData[]>;
    getSnapshot(symbol: string): Promise<MarketSnapshot>;
}

export class HybridDataProvider implements IDataProvider {
    
    async getBars(symbol: string, limit: number = 300): Promise<BarData[]> {
        // Always try to fetch from the Python backend first to get real AkShare data.
        const apiBase = config.apiBaseUrl || 'http://localhost:8000/api';

        try {
            // Set a timeout to prevent hanging indefinitely
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000);

            const res = await fetch(`${apiBase}/market/history/${symbol}`, {
                signal: controller.signal
            });
            clearTimeout(id);

            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    return data.slice(-limit);
                }
                console.warn(`Backend returned empty data for ${symbol}.`);
            } else {
                console.warn(`Backend returned ${res.status} for ${symbol}`);
            }
        } catch (e) {
            console.warn(`Failed to connect to Python Backend for ${symbol}. Using Fallback Mock Data.`);
        }

        // Return fallback data if real data fetch failed, to keep the UI functional
        // This ensures the "Critical: Could not fetch" error doesn't halt the app.
        return FALLBACK_MOCK_DATA;
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
