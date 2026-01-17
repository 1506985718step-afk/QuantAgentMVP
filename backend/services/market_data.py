
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
        Fetch real-time quotes using AkShare/Sina.
        """
        try:
            # We assume calling the async sina_provider from main flow, 
            # this sync method is a placeholder or legacy.
            return {} 
        except Exception as e:
            print(f"Realtime Data Error: {e}")
            return {}

    @lru_cache(maxsize=20)
    def get_history_bars(self, symbol: str, days: int = 250) -> List[Dict[str, Any]]:
        """
        Fetch historical daily bars with indicators (MA, RSI, MACD, BOLL).
        """
        try:
            start_date = "20240101"
            end_date = datetime.now().strftime("%Y%m%d")
            
            print(f"Fetching AkShare data for {symbol}...")
            df = ak.stock_zh_a_hist(symbol=symbol, period="daily", start_date=start_date, end_date=end_date, adjust="qfq")
            
            if df is None or df.empty:
                return []

            # Clean columns
            df.rename(columns={
                '日期': 'date', '开盘': 'open', '收盘': 'close', 
                '最高': 'high', '最低': 'low', '成交量': 'volume'
            }, inplace=True)

            cols = ['open', 'close', 'high', 'low', 'volume']
            for col in cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # --- Technical Indicators ---
            
            # 1. Moving Averages
            df['ma20'] = df['close'].rolling(window=20).mean()
            df['ma5_vol'] = df['volume'].rolling(window=5).mean()
            
            # 2. RSI (14)
            delta = df['close'].diff()
            up = delta.clip(lower=0)
            down = -1 * delta.clip(upper=0)
            ema_up = up.ewm(com=13, adjust=False).mean()
            ema_down = down.ewm(com=13, adjust=False).mean()
            rs = ema_up / ema_down
            df['rsi'] = 100 - (100 / (1 + rs))

            # 3. MACD (12, 26, 9)
            exp1 = df['close'].ewm(span=12, adjust=False).mean()
            exp2 = df['close'].ewm(span=26, adjust=False).mean()
            df['macd'] = exp1 - exp2
            df['signal_line'] = df['macd'].ewm(span=9, adjust=False).mean()
            df['histogram'] = df['macd'] - df['signal_line']

            # 4. Bollinger Bands (20, 2)
            df['boll_std'] = df['close'].rolling(window=20).std()
            df['boll_upper'] = df['ma20'] + (df['boll_std'] * 2)
            df['boll_lower'] = df['ma20'] - (df['boll_std'] * 2)

            # Fill NaN
            df.fillna(0, inplace=True)

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
                    "rsi": float(row['rsi']),
                    # Add new indicators to output (though frontend might not render all yet)
                    "macd": float(row['macd']),
                    "boll_upper": float(row['boll_upper']),
                    "boll_lower": float(row['boll_lower'])
                })
                
            return bars

        except Exception as e:
            print(f"AkShare History Error for {symbol}: {e}")
            return []

market_data_service = MarketDataService()
