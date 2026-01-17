
import math
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any

class MockGenerator:
    """
    Generates deterministic mock market data for replay/training modes.
    Ported from frontend logic to ensure Backend is the Single Source of Truth.
    """
    
    MARKET_ANCHORS = [
        # 2024 Reality
        {"date": "2024-01-02", "price": 9.30, "vol": 0.8},
        {"date": "2024-02-05", "price": 7.80, "vol": 1.5},
        {"date": "2024-02-28", "price": 9.20, "vol": 1.2},
        {"date": "2024-05-20", "price": 9.80, "vol": 1.0},
        {"date": "2024-09-18", "price": 8.50, "vol": 0.6},
        {"date": "2024-09-30", "price": 10.80, "vol": 2.5},
        {"date": "2024-10-08", "price": 11.50, "vol": 3.0},
        {"date": "2024-11-15", "price": 10.20, "vol": 1.2},
        {"date": "2024-12-31", "price": 10.80, "vol": 1.0},
        # 2025 Projection
        {"date": "2025-02-15", "price": 11.50, "vol": 1.2},
        {"date": "2025-04-10", "price": 11.20, "vol": 0.9},
        {"date": "2025-07-20", "price": 12.80, "vol": 1.5},
        {"date": "2025-09-15", "price": 12.50, "vol": 1.0},
        {"date": "2025-11-10", "price": 14.00, "vol": 1.8},
        {"date": "2025-12-31", "price": 14.50, "vol": 1.5},
        # 2026 Extension (Fix for default date)
        {"date": "2026-03-01", "price": 15.20, "vol": 1.1},
        {"date": "2026-06-01", "price": 14.80, "vol": 0.8},
    ]

    def _pseudo_random(self, seed_val: int) -> float:
        """Deterministic PRNG"""
        seed_val = (seed_val * 9301 + 49297) % 233280
        return seed_val / 233280.0

    def generate_bars(self, symbol: str) -> List[Dict[str, Any]]:
        # 1. Initialize Seed based on symbol string
        seed = 0
        for char in symbol:
            seed = (seed << 5) - seed + ord(char)
        seed = abs(seed)

        def get_random():
            nonlocal seed
            res = self._pseudo_random(seed)
            seed = int(res * 233280) # Update seed for next call
            return res

        # 2. Determine Price Multiplier
        price_multiplier = 1.0
        if symbol == '600519': price_multiplier = 170.0
        elif symbol == '002594': price_multiplier = 25.0
        elif symbol == '300750': price_multiplier = 18.0
        elif symbol == '300059': price_multiplier = 1.4
        elif symbol == '000001': price_multiplier = 1.1
        else: price_multiplier = 1.0 + (get_random() * 2)

        alpha_drift_per_day = (get_random() - 0.5) * 0.002
        bars = []
        volatility = 0.025

        # 3. Generate Data Points
        for i in range(len(self.MARKET_ANCHORS) - 1):
            start = self.MARKET_ANCHORS[i]
            end = self.MARKET_ANCHORS[i+1]
            
            start_date = datetime.strptime(start["date"], "%Y-%m-%d")
            end_date = datetime.strptime(end["date"], "%Y-%m-%d")
            
            days_diff = (end_date - start_date).days
            price_diff = end["price"] - start["price"]
            vol_diff = end["vol"] - start["vol"]

            for d in range(days_diff):
                current_date = start_date + timedelta(days=d)
                # Skip weekends
                if current_date.weekday() >= 5:
                    continue
                
                date_str = current_date.strftime("%Y-%m-%d")
                progress = d / days_diff
                global_trend_price = start["price"] + (price_diff * progress)
                
                # Apply Drift
                total_days_idx = len(bars)
                drift_factor = 1 + (total_days_idx * alpha_drift_per_day)
                
                # Apply Noise
                noise = (get_random() - 0.5) * (global_trend_price * volatility * 2)
                
                # Momentum Logic
                momentum = 1.0
                if date_str.startswith('2024-01'): momentum = 0.995
                elif date_str.startswith('2024-02-0'): momentum = 0.95
                elif date_str.startswith('2024-09-2'): momentum = 1.05

                raw_close = (global_trend_price + noise) * momentum * drift_factor
                
                # OHLC Simulation
                close = raw_close * price_multiplier
                open_px = close * (1 + (get_random() - 0.5) * 0.02)
                high = max(open_px, close) * (1 + get_random() * 0.015)
                low = min(open_px, close) * (1 - get_random() * 0.015)
                
                # Volume
                base_vol = 500000
                vol_factor = start["vol"] + (vol_diff * progress)
                volume = int(base_vol * vol_factor * (0.8 + get_random() * 0.4))

                bars.append({
                    "date": date_str,
                    "open": round(open_px, 2),
                    "close": round(close, 2),
                    "high": round(high, 2),
                    "low": round(low, 2),
                    "volume": volume,
                    "ma20": 0.0,
                    "ma5_vol": 0.0,
                    "rsi": 50.0
                })

        # 4. Post-Process Indicators
        closes = [b["close"] for b in bars]
        volumes = [b["volume"] for b in bars]
        
        for i in range(len(bars)):
            # MA20
            if i >= 19:
                bars[i]["ma20"] = round(sum(closes[i-19:i+1]) / 20, 2)
            else:
                bars[i]["ma20"] = bars[i]["close"]
            
            # MA5 Vol
            if i >= 4:
                bars[i]["ma5_vol"] = int(sum(volumes[i-4:i+1]) / 5)
            else:
                bars[i]["ma5_vol"] = bars[i]["volume"]
                
            # RSI (Simple calc for mock)
            if i > 14:
                gains = 0
                losses = 0
                for j in range(14):
                    diff = closes[i-j] - closes[i-j-1]
                    if diff > 0: gains += diff
                    else: losses -= diff
                rs = gains / (losses if losses > 0 else 1)
                bars[i]["rsi"] = round(100 - (100 / (1 + rs)), 2)

        return bars

mock_generator = MockGenerator()
