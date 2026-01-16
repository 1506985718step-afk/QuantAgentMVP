import uuid
from datetime import datetime
from typing import List, Dict, Any
from ..core.contracts import TradeIntent, Side, IntentType, IntentSource, IntentVersion, OrderStatus
from ..services.llm_service import LLMService

class StrategyAgent:
    def __init__(self):
        self.llm = LLMService()
        # Default Watchlist (In real app, this comes from config or DB)
        self.watchlist = [
            {'symbol': '000001', 'name': '平安银行'},
            {'symbol': '600519', 'name': '贵州茅台'},
            {'symbol': '002594', 'name': '比亚迪'}
        ]
        self.cooldowns: Dict[str, datetime] = {}
        self.last_scan_time = None

    def run_cycle(self, market_snapshot: Any, market_data_map: Dict[str, Any], config: Any) -> List[TradeIntent]:
        """
        Scan watchlist and return new intents.
        """
        intents = []
        now = datetime.now()
        
        # Simple frequency control (e.g., max once per minute per symbol in this basic loop)
        # For MVP, we allow every manual trigger.

        for item in self.watchlist:
            symbol = item['symbol']
            name = item['name']
            
            data = market_data_map.get(symbol)
            if not data:
                continue

            # Skip if recently signaled (Cooldown 1 hour for MVP example)
            # last_sig = self.cooldowns.get(symbol)
            # if last_sig and (now - last_sig).total_seconds() < 3600:
            #    continue

            # Mock Vol Ratio calculation (Real app needs history)
            vol_ratio = 1.8 if data.get('volume', 0) > 0 else 0.0 # Placeholder
            
            # 1. Pre-filter (Save LLM tokens)
            if data['change_pct'] < -2.0:
                continue # Don't buy dropping knives

            # 2. LLM Analysis
            analysis = self.llm.analyze(
                symbol=symbol,
                name=name,
                price=data['price'],
                change_pct=data['change_pct'],
                vol_ratio=vol_ratio,
                market_sentiment=market_snapshot.sentiment_score
            )

            if analysis.get('signal'):
                # Calculate Qty (Simple fixed value for MVP)
                price = data['price']
                if price <= 0.01: continue
                
                # Logic: Buy approx 50,000 CNY value
                # Cap at 50000 RMB per trade or simple logic
                raw_lots = int(50000 / (price * 100))
                qty = raw_lots * 100
                if qty == 0: qty = 100

                intent = TradeIntent(
                    intent_id=f"strat-{uuid.uuid4().hex[:8]}",
                    trade_day=now.strftime("%Y-%m-%d"),
                    session_id="python-backend",
                    symbol=symbol,
                    name=name,
                    side=Side.BUY,
                    intent_type=IntentType.BUY,
                    qty=qty,
                    price=price,
                    stop_loss=round(price * (1 - config.stop_loss_pct/100), 2),
                    take_profit=round(price * (1 + config.take_profit_pct/100), 2),
                    strategy_id="DeepSeek-V3-Quant",
                    reason=analysis.get('reasoning', 'No reason'),
                    source=IntentSource(
                        source_event_id=f"scan-{uuid.uuid4().hex[:6]}",
                        trigger="signal"
                    ),
                    version=IntentVersion(rule_version="py.1.0"),
                    timestamp=now.isoformat(),
                    status=OrderStatus.PENDING
                )
                
                intents.append(intent)
                self.cooldowns[symbol] = now
                
        return intents
