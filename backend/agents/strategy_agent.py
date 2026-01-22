
import uuid
import asyncio
import random
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any
from ..app.settings import settings
from ..core.contracts import TradeIntent, Side, IntentType, IntentSource, IntentVersion, OrderStatus, StrategyConfig, TradeMetrics
from ..services.llm_service import LLMService
from ..services.news_service import news_service
from ..services.memory_service import memory_service
from ..infra.scratchpad_store import scratchpad

class StrategyAgent:
    def __init__(self):
        self.llm = LLMService()
        # Initialize from Config Profile
        self.watchlist = list(settings.DEFAULT_WATCHLIST)
        self.cooldowns: Dict[str, datetime] = {}
        self.last_scan_time = None

    def get_watchlist(self) -> List[Dict[str, str]]:
        return self.watchlist

    def add_to_watchlist(self, symbol: str, name: str):
        """Add a stock if it doesn't exist"""
        if not any(x['symbol'] == symbol for x in self.watchlist):
            self.watchlist.append({'symbol': symbol, 'name': name})

    def remove_from_watchlist(self, symbol: str):
        """Remove a stock by symbol"""
        self.watchlist = [x for x in self.watchlist if x['symbol'] != symbol]

    def set_watchlist(self, items: List[Dict[str, str]]):
        """Replace the entire watchlist"""
        self.watchlist = items

    def adapt_config(self, current_config: StrategyConfig, metrics: TradeMetrics) -> StrategyConfig:
        """
        Dynamically adjust strategy parameters based on recent performance.
        Now uses Profiles from settings for boundaries.
        """
        new_config = current_config.model_copy()
        now_str = datetime.now().isoformat()
        
        # 1. DEFENSIVE MODE
        if metrics.max_drawdown > 0.05 or (metrics.total_trades > 5 and metrics.win_rate < 0.4):
            profile = settings.STRATEGY_PROFILES["conservative"]
            new_config.vol_threshold = profile["vol_threshold"]
            new_config.stop_loss_pct = profile["stop_loss_pct"]
            new_config.take_profit_pct = profile["take_profit_pct"]
            new_config.update_reason = f"Defensive Mode: Drawdown {metrics.max_drawdown*100:.1f}%"
            new_config.last_updated = now_str
            return new_config

        # 2. AGGRESSIVE MODE
        if metrics.total_trades > 5 and metrics.win_rate > 0.6 and metrics.max_drawdown < 0.03:
            profile = settings.STRATEGY_PROFILES["aggressive"]
            new_config.vol_threshold = profile["vol_threshold"]
            new_config.stop_loss_pct = profile["stop_loss_pct"]
            new_config.take_profit_pct = profile["take_profit_pct"]
            new_config.update_reason = f"Aggressive Mode: Win Rate {metrics.win_rate*100:.0f}%"
            new_config.last_updated = now_str
            return new_config

        # 3. NEUTRAL MODE
        default = settings.STRATEGY_PROFILES["default"]
        if current_config.vol_threshold != default["vol_threshold"]:
            new_config.vol_threshold = default["vol_threshold"]
            new_config.stop_loss_pct = default["stop_loss_pct"]
            new_config.take_profit_pct = default["take_profit_pct"]
            new_config.update_reason = "Neutral Mode: Baseline"
            new_config.last_updated = now_str
        
        return new_config

    async def run_cycle(self, market_snapshot: Any, market_data_map: Dict[str, Any], config: StrategyConfig) -> List[TradeIntent]:
        """
        Scan watchlist and return new intents (Async).
        Parallelized LLM Analysis for performance.
        """
        intents = []
        now = datetime.now()
        
        # 0. Get Real-Time News Context
        latest_news = news_service.get_latest_news()

        candidates = []
        analysis_tasks = []

        for item in self.watchlist:
            symbol = item['symbol']
            name = item['name']
            
            data = market_data_map.get(symbol)
            if not data:
                continue

            if symbol in self.cooldowns:
                if now - self.cooldowns[symbol] < timedelta(minutes=30):
                    continue

            # Deterministic/Mock Vol Ratio
            vol_ratio = 1.2 + (random.random() * 1.0) if data.get('volume', 0) > 0 else 0.0
            
            # 1. Pre-filter using Dynamic Config
            if vol_ratio < config.vol_threshold:
                 continue

            if data['change_pct'] < -3.0:
                continue 
            
            candidates.append({
                "symbol": symbol,
                "name": name,
                "data": data,
                "vol_ratio": vol_ratio
            })

        # 2. Parallel LLM Analysis
        for c in candidates:
            past_lessons = memory_service.get_context(c["symbol"])
            
            # Trace: Log Input to Scratchpad
            # Using asyncio.create_task to not block strategy loop
            asyncio.create_task(scratchpad.log("LLM_INPUT", {
                "symbol": c["symbol"],
                "price": c["data"]['price'],
                "vol_ratio": c["vol_ratio"],
                "news_count": len(latest_news),
                "lessons_count": len(past_lessons)
            }))

            task = self.llm.analyze(
                symbol=c["symbol"],
                name=c["name"],
                price=c["data"]['price'],
                change_pct=c["data"]['change_pct'],
                vol_ratio=c["vol_ratio"],
                market_sentiment=market_snapshot.sentiment_score,
                news_context=latest_news,
                past_lessons=past_lessons
            )
            analysis_tasks.append(task)

        if not analysis_tasks:
            return []

        results = await asyncio.gather(*analysis_tasks)

        # 3. Process Results
        for i, analysis in enumerate(results):
            c = candidates[i]
            
            # Trace: Log Output to Scratchpad
            asyncio.create_task(scratchpad.log("LLM_OUTPUT", {
                "symbol": c["symbol"],
                "result": analysis
            }))
            
            if analysis.get('signal'):
                price = c["data"]['price']
                if price <= 0.01: continue
                
                raw_lots = int(50000 / (price * 100))
                qty = raw_lots * 100
                if qty == 0: qty = 100

                # Traceability: Generate Hash for LLM decision
                # Combine input factors + analysis output to create a "receipt"
                trace_str = f"{c['symbol']}_{price}_{c['vol_ratio']}_{analysis.get('reasoning')}"
                llm_hash = hashlib.sha256(trace_str.encode('utf-8')).hexdigest()[:16]

                intent = TradeIntent(
                    intent_id=f"strat-{uuid.uuid4().hex[:8]}",
                    correlation_id=f"trace-{uuid.uuid4().hex[:8]}", # Start of a new trace chain
                    llm_request_hash=llm_hash,
                    
                    trade_day=now.strftime("%Y-%m-%d"),
                    session_id="python-backend",
                    symbol=c["symbol"],
                    name=c["name"],
                    side=Side.BUY,
                    intent_type=IntentType.BUY,
                    qty=qty,
                    price=price,
                    stop_loss=round(price * (1 - config.stop_loss_pct/100), 2),
                    take_profit=round(price * (1 + config.take_profit_pct/100), 2),
                    strategy_id="DeepSeek-V3-Quant",
                    reason=f"{analysis.get('reasoning')} (Vol={c['vol_ratio']:.2f})",
                    source=IntentSource(
                        source_event_id=f"scan-{uuid.uuid4().hex[:6]}",
                        trigger="signal"
                    ),
                    version=IntentVersion(rule_version="py.1.0"),
                    timestamp=now.isoformat(),
                    status=OrderStatus.PENDING
                )
                
                intents.append(intent)
                self.cooldowns[c["symbol"]] = now
                
        return intents
