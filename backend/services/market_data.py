import akshare as ak
import pandas as pd
from datetime import datetime, timedelta
from typing import List, Dict, Any
from functools import lru_cache

class MarketDataService:
    """
    Unified Data Service using AkShare.
    """

    def get_realtime_snapshot(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Fetch real-time quotes using AkShare (optimized wrapper around Sina/EastMoney).
        Returns a dict mapped by symbol.
        """
        try:
            from .sina_data import sina_provider
            # This is async in the other file, but we might need a sync wrapper here if called synchronously
            # However, for now, we rely on the caller to use the async provider directly if needed.
            # Or we just return empty if this is used strictly synchronously.
            return {} 
        except Exception as e:
            print(f"Realtime Data Error: {e}")
            return {}

    @lru_cache(maxsize=20)
    def get_history_bars(self, symbol: str, days: int = 250) -> List[Dict[str, Any]]:
        """
        Fetch historical daily bars for K-Line chart.
        Defaults to ~1 year to cover 2024.
        """
        try:
            # Fixed start date for "2024 Market Conditions" backtest
            start_date = "20240101"
            end_date = datetime.now().strftime("%Y%m%d")
            
            print(f"Fetching AkShare data for {symbol}...")
            # stock_zh_a_hist: A股日线数据
            df = ak.stock_zh_a_hist(symbol=symbol, period="daily", start_date=start_date, end_date=end_date, adjust="qfq")
            
            if df is None or df.empty:
                print(f"AkShare returned empty for {symbol}")
                return []

            # Clean up column names
            df.rename(columns={
                '日期': 'date', '开盘': 'open', '收盘': 'close', 
                '最高': 'high', '最低': 'low', '成交量': 'volume'
            }, inplace=True)

            # Ensure numeric types
            cols = ['open', 'close', 'high', 'low', 'volume']
            for col in cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # --- Technical Indicators Calculation ---
            
            # 1. MA20
            df['ma20'] = df['close'].rolling(window=20).mean()
            
            # 2. MA5 Volume
            df['ma5_vol'] = df['volume'].rolling(window=5).mean()
            
            # 3. RSI (14)
            delta = df['close'].diff()
            up = delta.clip(lower=0)
            down = -1 * delta.clip(upper=0)
            ema_up = up.ewm(com=13, adjust=False).mean()
            ema_down = down.ewm(com=13, adjust=False).mean()
            rs = ema_up / ema_down
            df['rsi'] = 100 - (100 / (1 + rs))

            # Fill NaN
            df.fillna(0, inplace=True)

            # Take requested limit if needed
            if len(df) > days:
                df = df.tail(days)
            
            bars = []
            for _, row in df.iterrows():
                bars.append({
                    "date": str(row['date']),
                    "open": float(row['open']),
                    "close": float(row['close']),
                    "high": float(row['high']),
                    "low": float(row['low']),
                    "volume": float(row['volume']),
                    "ma20": float(row['ma20']),
                    "ma5_vol": float(row['ma5_vol']),
                    "rsi": float(row['rsi'])
                })
                
            return bars

        except Exception as e:
            print(f"AkShare History Error for {symbol}: {e}")
            return []

market_data_service = MarketDataService()
