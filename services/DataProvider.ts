import { BarData, HISTORY_DATA_PINGAN, HISTORY_DATA_MOUTAI, HISTORY_DATA_BYD } from './historicalData';
import { MarketSnapshot } from '../types';
import { config } from './config';

export interface IDataProvider {
    getBars(symbol: string, limit?: number): Promise<BarData[]>;
    getSnapshot(symbol: string): Promise<MarketSnapshot>;
}

export class HybridDataProvider implements IDataProvider {
    
    async getBars(symbol: string, limit: number = 60): Promise<BarData[]> {
        // 1. Try Real Backend if enabled
        if (config.useRealBackend) {
            try {
                const res = await fetch(`${config.apiBaseUrl}/market/history/${symbol}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data && data.length > 0) {
                        return data;
                    }
                }
            } catch (e) {
                console.warn(`Failed to fetch history for ${symbol} from backend. Falling back to mock.`);
            }
        }

        // 2. Fallback to Mock Data
        // await new Promise(resolve => setTimeout(resolve, 50)); // Sim latency
        let data: BarData[] = [];
        switch (symbol) {
            case '000001': data = HISTORY_DATA_PINGAN; break;
            case '600519': data = HISTORY_DATA_MOUTAI; break;
            case '002594': data = HISTORY_DATA_BYD; break;
            default: data = []; // Return empty or generic mock
        }
        return data.slice(-limit);
    }

    async getSnapshot(symbol: string): Promise<MarketSnapshot> {
        // Snapshot usually comes from the main system state loop, 
        // so this method might be redundant if we use the global state.
        // Keeping it for standalone chart widgets.
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