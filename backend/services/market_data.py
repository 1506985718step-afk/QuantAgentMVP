
import akshare as ak
import pandas as pd
import asyncio
from datetime import datetime
from typing import List, Dict, Any
from ..app.settings import settings
from .mock_generator import mock_generator

class MarketDataService:
    """
    Unified Data Service.
    Live Mode -> AkShare/Sina
    Mock/Replay Mode -> Deterministic Generator
    """

    def get_realtime_snapshot(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Fetch real-time quotes. In a full implementation, this calls Sina/AkShare.
        For MVP, system.py handles realtime via sina_data.py directly, 
        but we keep this interface for future extensibility.
        """
        return {} 

    async def get_history_bars(self, symbol: str, days: int = 250) -> List[Dict[str, Any]]:
        """
        Async wrapper for historical data fetching.
        """
        # Constraint: Backend must provide history for Replay
        if settings.MODE != "live":
            # Use deterministic mock generator
            # Run in thread pool to avoid blocking the event loop with math calculations
            bars = await asyncio.to_thread(mock_generator.generate_bars, symbol)
            return bars[-days:] if days < len(bars) else bars

        return await asyncio.to_thread(self._get_history_bars_sync, symbol, days)

    def _get_history_bars_sync(self, symbol: str, days: int) -> List[Dict[str, Any]]:
        try:
            start_date = "20240101"
            end_date = datetime.now().strftime("%Y%m%d")
            
            df = ak.stock_zh_a_hist(symbol=symbol, period="daily", start_date=start_date, end_date=end_date, adjust="qfq")
            
            if df is None or df.empty:
                return []

            df.rename(columns={
                '日期': 'date', '开盘': 'open', '收盘': 'close', 
                '最高': 'high', '最低': 'low', '成交量': 'volume'
            }, inplace=True)

            cols = ['open', 'close', 'high', 'low', 'volume']
            for col in cols:
                if col in df.columns:
                    df[col] = pd.to_numeric(df[col], errors='coerce')

            # Indicators
            df['ma20'] = df['close'].rolling(window=20).mean()
            df['ma5_vol'] = df['volume'].rolling(window=5).mean()
            
            # RSI (14)
            delta = df['close'].diff()
            up = delta.clip(lower=0)
            down = -1 * delta.clip(upper=0)
            ema_up = up.ewm(com=13, adjust=False).mean()
            ema_down = down.ewm(com=13, adjust=False).mean()
            rs = ema_up / ema_down
            df['rsi'] = 100 - (100 / (1 + rs))

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
                    "rsi": float(row['rsi'])
                })
                
            return bars

        except Exception as e:
            print(f"AkShare History Error for {symbol}: {e}")
            return []

market_data_service = MarketDataService()
