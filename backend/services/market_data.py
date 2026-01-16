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
        results = {}
        try:
            # AkShare's stock_zh_a_spot_em is heavy, so for specific symbols we might use simpler APIs
            # or filter the big dataframe. For MVP performance, Sina is faster for small watchlists.
            # Let's stick to the lightweight Sina crawler for *Tick* updates (sub-second),
            # but use AkShare format if needed. 
            # For this MVP, to ensure speed, we will use a lightweight fetcher pattern.
            
            # Using specific stock quote function from AkShare if available, otherwise fallback to Sina logic
            # inside AkShare. 
            # Actually, let's keep the sina_provider logic for real-time ticks because downloading 
            # the entire market table via AkShare takes seconds.
            
            from .sina_data import sina_provider
            return sina_provider.get_realtime_data(symbols)

        except Exception as e:
            print(f"Realtime Data Error: {e}")
            return {}

    @lru_cache(maxsize=20)
    def get_history_bars(self, symbol: str, days: int = 60) -> List[Dict[str, Any]]:
        """
        Fetch historical daily bars for K-Line chart.
        Cached to avoid hitting API limits on UI re-renders.
        """
        try:
            # AkShare symbol format usually needs adjustment
            # 000001 -> 000001 (Main board)
            start_date = (datetime.now() - timedelta(days=days*2)).strftime("%Y%m%d")
            end_date = datetime.now().strftime("%Y%m%d")
            
            # stock_zh_a_hist: A股日线数据
            df = ak.stock_zh_a_hist(symbol=symbol, period="daily", start_date=start_date, end_date=end_date, adjust="qfq")
            
            if df.empty:
                return []

            # Format for Frontend: { date, open, close, high, low, volume, ma20... }
            bars = []
            
            # Calculate MA20 manually since API might not return it
            df['ma20'] = df['收盘'].rolling(window=20).mean()
            # Calculate MA5 Volume
            df['ma5_vol'] = df['成交量'].rolling(window=5).mean()
            
            # Take last N days
            df = df.tail(days)
            
            for _, row in df.iterrows():
                bars.append({
                    "date": row['日期'],
                    "open": float(row['开盘']),
                    "close": float(row['收盘']),
                    "high": float(row['最高']),
                    "low": float(row['最低']),
                    "volume": float(row['成交量']),
                    "ma20": float(row['ma20']) if not pd.isna(row['ma20']) else float(row['开盘']),
                    "ma5_vol": float(row['ma5_vol']) if not pd.isna(row['ma5_vol']) else float(row['成交量']),
                    "rsi": 50 # Placeholder, calculating RSI in pandas is verbose for this snippet
                })
                
            return bars

        except Exception as e:
            print(f"AkShare History Error for {symbol}: {e}")
            return []

market_data_service = MarketDataService()