// Data Type Definition
// Actual data is now fetched from backend via AkShare

export interface BarData {
    date: string;
    close: number;
    open: number;
    high: number;
    low: number;
    ma20: number; // Support/Resistance level
    volume: number; // Current Volume
    ma5_vol: number; // 5-Day Moving Average Volume
    rsi: number; // Relative Strength Index (0-100)
}

// Fallback empty data if backend is offline
export const EMPTY_DATA: BarData[] = [];

// Minimal fallback data to ensure UI renders even if backend is offline (Mock Mode)
export const FALLBACK_MOCK_DATA: BarData[] = Array.from({ length: 20 }, (_, i) => {
    const basePrice = 10 + Math.sin(i * 0.5);
    return {
        date: new Date(Date.now() - (20 - i) * 86400000).toISOString().split('T')[0],
        open: basePrice,
        close: basePrice + (Math.random() - 0.5),
        high: basePrice + 1,
        low: basePrice - 1,
        volume: 100000 + Math.random() * 50000,
        ma20: basePrice,
        ma5_vol: 100000,
        rsi: 50 + Math.sin(i) * 20
    };
});
