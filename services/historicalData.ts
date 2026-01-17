
export interface BarData {
    date: string;
    close: number;
    open: number;
    high: number;
    low: number;
    ma20: number; 
    volume: number; 
    ma5_vol: number; 
    rsi: number; 
}

// Scenarios definition for UI selection - kept here for UI dropdowns, 
// but actual data generation is now in Python.
export const SCENARIOS = [
    { id: 'panic_2024', name: '2024 雪球敲入 (急跌)', date: '2024-01-15', desc: '高波动单边下跌，考验止损与抄底能力' },
    { id: 'rebound_v', name: '2024 V型反转 (超跌)', date: '2024-02-01', desc: '极端情绪冰点后的暴力反弹' },
    { id: 'sideways', name: '2024 阴跌磨底 (震荡)', date: '2024-06-01', desc: '缩量阴跌，考验空仓耐心' },
    { id: 'bull_start', name: '9.24 政策牛 (暴涨)', date: '2024-09-18', desc: '政策驱动的史诗级逼空行情' },
    { id: 'slow_bull', name: '2025 机构慢牛 (推演)', date: '2025-01-01', desc: 'AI 推演的理想化震荡上行趋势' },
];

/**
 * DEPRECATED: getMockBars
 * Logic moved to backend/services/mock_generator.py
 * Frontend now fetches from /api/market/history even in mock mode.
 */
export function getMockBars(symbol: string): BarData[] {
    console.warn("Frontend mock generation is deprecated. Fetching from backend...");
    return [];
}
