// Mock Historical Data for "Replay Mode"
// Scenario: "May 2025 Post-Holiday Rebound"
// Simulating a cohesive market timeline across all assets.

export interface BarData {
    date: string;
    close: number;
    open: number;
    high: number;
    low: number;
    ma20: number; // Support/Resistance level
    volume: number; // Current Volume
    ma5_vol: number; // 5-Day Moving Average Volume (New: for Volume Surge check)
    rsi: number; // Relative Strength Index (0-100)
}

// 000001 (Pingan Bank) - The Stable Index Proxy
export const HISTORY_DATA_PINGAN: BarData[] = [
    { date: '2025-05-05', open: 10.10, close: 10.15, high: 10.20, low: 10.05, ma20: 10.00, volume: 50000, ma5_vol: 52000, rsi: 45 },
    { date: '2025-05-06', open: 10.15, close: 10.22, high: 10.25, low: 10.12, ma20: 10.02, volume: 48000, ma5_vol: 51000, rsi: 48 },
    { date: '2025-05-07', open: 10.22, close: 10.35, high: 10.38, low: 10.20, ma20: 10.05, volume: 60000, ma5_vol: 50000, rsi: 52 },
    { date: '2025-05-08', open: 10.35, close: 10.30, high: 10.40, low: 10.28, ma20: 10.08, volume: 45000, ma5_vol: 50500, rsi: 50 }, 
    
    // May 09: Strong Buy Signal (Volume Breakout)
    { date: '2025-05-09', open: 10.30, close: 10.48, high: 10.50, low: 10.25, ma20: 10.12, volume: 95000, ma5_vol: 50600, rsi: 62 }, 
    
    // Holding Phase (T+1 to T+3)
    { date: '2025-05-12', open: 10.48, close: 10.55, high: 10.60, low: 10.45, ma20: 10.15, volume: 60000, ma5_vol: 65600, rsi: 65 }, // Monday
    { date: '2025-05-13', open: 10.55, close: 10.62, high: 10.65, low: 10.50, ma20: 10.20, volume: 55000, ma5_vol: 73000, rsi: 68 },
    { date: '2025-05-14', open: 10.62, close: 10.85, high: 10.90, low: 10.60, ma20: 10.25, volume: 75000, ma5_vol: 75000, rsi: 72 }, // Profit Zone
    { date: '2025-05-15', open: 10.85, close: 10.70, high: 10.88, low: 10.65, ma20: 10.30, volume: 60000, ma5_vol: 78000, rsi: 65 },
    { date: '2025-05-16', open: 10.70, close: 10.60, high: 10.75, low: 10.55, ma20: 10.35, volume: 55000, ma5_vol: 70000, rsi: 60 },
];

// 600519 (Mini Moutai) - The Blue Chip Leader
export const HISTORY_DATA_MOUTAI: BarData[] = [
    { date: '2025-05-05', open: 16.00, close: 16.20, high: 16.30, low: 15.90, ma20: 15.80, volume: 3000, ma5_vol: 3100, rsi: 55 },
    { date: '2025-05-06', open: 16.20, close: 16.45, high: 16.50, low: 16.10, ma20: 15.85, volume: 3200, ma5_vol: 3100, rsi: 58 },
    { date: '2025-05-07', open: 16.45, close: 16.60, high: 16.70, low: 16.35, ma20: 15.95, volume: 3500, ma5_vol: 3200, rsi: 60 },
    { date: '2025-05-08', open: 16.60, close: 16.30, high: 16.65, low: 16.20, ma20: 16.00, volume: 2800, ma5_vol: 3100, rsi: 52 },
    { date: '2025-05-09', open: 16.30, close: 16.80, high: 16.90, low: 16.25, ma20: 16.10, volume: 4500, ma5_vol: 3400, rsi: 65 },
    // May 12: BREAKOUT Setup
    { date: '2025-05-12', open: 16.80, close: 17.10, high: 17.20, low: 16.75, ma20: 16.20, volume: 6000, ma5_vol: 3800, rsi: 72 },
    // Smoother uptrend
    { date: '2025-05-13', open: 17.10, close: 17.35, high: 17.45, low: 17.05, ma20: 16.35, volume: 5200, ma5_vol: 4120, rsi: 74 }, 
    { date: '2025-05-14', open: 17.35, close: 17.70, high: 17.80, low: 17.30, ma20: 16.50, volume: 5500, ma5_vol: 4220, rsi: 76 }, 
    { date: '2025-05-15', open: 17.70, close: 18.20, high: 18.30, low: 17.60, ma20: 16.60, volume: 6800, ma5_vol: 4420, rsi: 80 }, 
    { date: '2025-05-16', open: 18.20, close: 17.90, high: 18.25, low: 17.80, ma20: 16.65, volume: 4500, ma5_vol: 4220, rsi: 65 },
];

// 002594 (Mini BYD) - The Growth Momentum
export const HISTORY_DATA_BYD: BarData[] = [
    { date: '2025-05-05', open: 25.00, close: 25.20, high: 25.50, low: 24.80, ma20: 24.50, volume: 10000, ma5_vol: 9500, rsi: 50 },
    { date: '2025-05-06', open: 25.20, close: 25.80, high: 26.00, low: 25.10, ma20: 24.80, volume: 12000, ma5_vol: 10000, rsi: 55 },
    { date: '2025-05-07', open: 25.80, close: 26.50, high: 26.80, low: 25.60, ma20: 25.20, volume: 15000, ma5_vol: 11000, rsi: 62 },
    { date: '2025-05-08', open: 26.50, close: 26.20, high: 26.60, low: 26.00, ma20: 25.50, volume: 8000, ma5_vol: 11500, rsi: 58 },
    { date: '2025-05-09', open: 26.20, close: 27.00, high: 27.50, low: 26.10, ma20: 25.80, volume: 13000, ma5_vol: 11600, rsi: 65 },
    // May 12: BREAKOUT Setup
    { date: '2025-05-12', open: 27.00, close: 28.00, high: 28.50, low: 26.80, ma20: 26.20, volume: 20000, ma5_vol: 12800, rsi: 70 },
    // Gradual uptrend
    { date: '2025-05-13', open: 28.00, close: 28.50, high: 28.80, low: 27.90, ma20: 26.50, volume: 15000, ma5_vol: 13200, rsi: 72 }, 
    { date: '2025-05-14', open: 28.50, close: 29.10, high: 29.30, low: 28.40, ma20: 26.80, volume: 14000, ma5_vol: 12000, rsi: 74 }, 
    { date: '2025-05-15', open: 29.10, close: 29.80, high: 30.00, low: 29.00, ma20: 27.00, volume: 18000, ma5_vol: 12100, rsi: 78 }, 
    { date: '2025-05-16', open: 29.80, close: 29.20, high: 29.90, low: 29.00, ma20: 27.10, volume: 12000, ma5_vol: 11100, rsi: 65 },
];