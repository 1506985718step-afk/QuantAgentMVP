
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

// 关键行情锚点 (Date, Price, VolumeFactor)
// 模拟 2024 真实 A 股 + 2025 推演
// Base price is roughly ~10.0. We will scale this based on the stock symbol.
const MARKET_ANCHORS = [
    // --- 2024 REALITY ---
    { date: '2024-01-02', price: 9.30, vol: 0.8 }, // 开年
    { date: '2024-02-05', price: 7.80, vol: 1.5 }, // 雪球敲入底 (Panic Bottom)
    { date: '2024-02-28', price: 9.20, vol: 1.2 }, // V型反转
    { date: '2024-05-20', price: 9.80, vol: 1.0 }, // 年中高点
    { date: '2024-09-18', price: 8.50, vol: 0.6 }, // 阴跌缩量
    { date: '2024-09-30', price: 10.80, vol: 2.5 }, // 9.24 政策牛暴涨 (Stimulus)
    { date: '2024-10-08', price: 11.50, vol: 3.0 }, // 情绪高潮
    { date: '2024-11-15', price: 10.20, vol: 1.2 }, // 回调消化
    { date: '2024-12-31', price: 10.80, vol: 1.0 }, // 跨年企稳

    // --- 2025 PROJECTION (慢牛) ---
    { date: '2025-02-15', price: 11.50, vol: 1.2 }, // 春季躁动
    { date: '2025-04-10', price: 11.20, vol: 0.9 }, // 财报季波动
    { date: '2025-07-20', price: 12.80, vol: 1.5 }, // 年中拉升
    { date: '2025-09-15', price: 12.50, vol: 1.0 }, // 平台整理
    { date: '2025-11-10', price: 14.00, vol: 1.8 }, // 主升浪
    { date: '2025-12-31', price: 14.50, vol: 1.5 }, // 收官
];

/**
 * Generate distinct, deterministic chart data for a given symbol.
 */
export function getMockBars(symbol: string): BarData[] {
    // 1. Initialize Seeded PRNG
    // This ensures that for the same symbol, we always generate the same "Random" graph.
    let seed = 0;
    for (let i = 0; i < symbol.length; i++) seed = (seed << 5) - seed + symbol.charCodeAt(i);
    seed = Math.abs(seed | 0);

    const random = () => {
        seed = (seed * 9301 + 49297) % 233280;
        return seed / 233280;
    };

    // 2. Determine Price Scale based on Symbol (Mock Realism)
    let priceMultiplier = 1.0;
    // Specific overrides for the watchlist
    if (symbol === '600519') priceMultiplier = 170.0; // Maotai ~1700
    else if (symbol === '002594') priceMultiplier = 25.0; // BYD ~250
    else if (symbol === '300750') priceMultiplier = 18.0; // CATL ~180
    else if (symbol === '300059') priceMultiplier = 1.4; // EastMoney ~14
    else if (symbol === '000001') priceMultiplier = 1.1; // PingAn ~11
    else priceMultiplier = 1.0 + (random() * 2); // Random stocks 10-30

    // Individual Alpha (Idiosyncratic Drift)
    // Some stocks outperform the index (anchors), some underperform
    const alphaDriftPerDay = (random() - 0.5) * 0.002; 

    const bars: BarData[] = [];
    
    // 3. Generate Data Points
    for (let i = 0; i < MARKET_ANCHORS.length - 1; i++) {
        const start = MARKET_ANCHORS[i];
        const end = MARKET_ANCHORS[i+1];
        
        const startDate = new Date(start.date);
        const endDate = new Date(end.date);
        
        const timeDiff = endDate.getTime() - startDate.getTime();
        const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
        
        const priceDiff = end.price - start.price;
        const volDiff = end.vol - start.vol;
        
        const volatility = 0.025; // Daily volatility

        for (let d = 0; d < daysDiff; d++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + d);
            
            // Skip weekends
            if (currentDate.getDay() === 0 || currentDate.getDay() === 6) continue;
            
            const dateStr = currentDate.toISOString().split('T')[0];
            
            // Linear Trend + Noise + Alpha
            const progress = d / daysDiff;
            const globalTrendPrice = start.price + (priceDiff * progress);
            
            // Apply drift accumulated over total bars generated so far
            const totalDaysIdx = bars.length;
            const driftFactor = 1 + (totalDaysIdx * alphaDriftPerDay);

            const noise = (random() - 0.5) * (globalTrendPrice * volatility * 2); 
            
            // Special events logic (preserved from original)
            let momentum = 1.0;
            if (dateStr.startsWith('2024-01')) momentum = 0.995; 
            if (dateStr.startsWith('2024-02-0')) momentum = 0.95; 
            if (dateStr.startsWith('2024-09-2')) momentum = 1.05; 
            
            // Compose Final Price
            const rawClose = (globalTrendPrice + noise) * momentum * driftFactor;
            
            // Scale to specific stock price
            const close = rawClose * priceMultiplier;
            const open = close * (1 + (random() - 0.5) * 0.02);
            const high = Math.max(open, close) * (1 + random() * 0.015);
            const low = Math.min(open, close) * (1 - random() * 0.015);
            
            // Volume
            const baseVol = 500000;
            const volFactor = start.vol + (volDiff * progress);
            const volume = Math.floor(baseVol * volFactor * (0.8 + random() * 0.4));

            bars.push({
                date: dateStr,
                open: Number(open.toFixed(2)),
                close: Number(close.toFixed(2)),
                high: Number(high.toFixed(2)),
                low: Number(low.toFixed(2)),
                volume: volume,
                ma20: 0, 
                ma5_vol: 0,
                rsi: 50
            });
        }
    }
    
    // 4. Post-processing: Indicators
    for (let i = 0; i < bars.length; i++) {
        // MA20
        if (i >= 19) {
            const sum = bars.slice(i - 19, i + 1).reduce((acc, b) => acc + b.close, 0);
            bars[i].ma20 = Number((sum / 20).toFixed(2));
        } else {
            bars[i].ma20 = bars[i].close;
        }
        
        // MA5 Vol
        if (i >= 4) {
            const sum = bars.slice(i - 4, i + 1).reduce((acc, b) => acc + b.volume, 0);
            bars[i].ma5_vol = Math.floor(sum / 5);
        } else {
            bars[i].ma5_vol = bars[i].volume;
        }

        // RSI (14)
        if (i > 14) {
             let gains = 0, losses = 0;
             for (let j = 0; j < 14; j++) {
                 const diff = bars[i-j].close - bars[i-j-1].close;
                 if (diff > 0) gains += diff;
                 else losses -= diff;
             }
             const rs = gains / (losses || 1);
             bars[i].rsi = Math.floor(100 - (100 / (1 + rs)));
        }
    }

    return bars;
}
