
import json
from typing import Dict, Any, Tuple, Optional
from ..core.contracts import TradeIntent, StrategyConfig, TradeMetrics, Side

class ValidationAgent:
    """
    Gatekeeper for Data Integrity & Safety.
    1. Validates LLM JSON structure.
    2. Validates Business Constraints (e.g. Price > 0).
    3. Validates Logical Consistency (e.g. StopLoss < Price for BUY).
    4. Validates Strategy Parameters (Sanity Check).
    """

    def validate_llm_json(self, raw_content: str, required_keys: list) -> Tuple[bool, Any, str]:
        """
        Parses and validates JSON from LLM.
        Returns: (is_valid, parsed_data, error_msg)
        """
        try:
            # Strip Markdown code blocks if present
            clean_content = raw_content.strip()
            if clean_content.startswith("```"):
                lines = clean_content.split('\n')
                if len(lines) >= 3:
                    clean_content = '\n'.join(lines[1:-1])
            
            data = json.loads(clean_content)
            
            missing = [key for key in required_keys if key not in data]
            if missing:
                return False, None, f"Missing keys: {missing}"
            
            return True, data, "OK"
        except json.JSONDecodeError:
            return False, None, "Invalid JSON format"
        except Exception as e:
            return False, None, str(e)

    def validate_intent(self, intent: TradeIntent) -> Tuple[bool, str]:
        """
        Business Logic & Consistency Validation before Guard.
        """
        # 1. Basic Sanity
        if intent.price <= 0:
            return False, "Price must be positive"
        
        if intent.qty <= 0:
            return False, "Quantity must be positive"
            
        if intent.qty % 100 != 0:
            return False, "Quantity must be a multiple of 100 (A-Share Rule)"

        # 2. Logic Consistency (The "Common Sense" Check)
        if intent.side == Side.BUY:
            if intent.stop_loss and intent.stop_loss >= intent.price:
                return False, f"Logical Error: Stop Loss ({intent.stop_loss}) >= Buy Price ({intent.price})"
            if intent.take_profit and intent.take_profit <= intent.price:
                return False, f"Logical Error: Take Profit ({intent.take_profit}) <= Buy Price ({intent.price})"
        
        elif intent.side == Side.SELL:
            # For Limit Sell, usually price is target, but if it's a Stop Loss Sell order triggered by engine:
            pass 

        return True, "OK"

    def validate_strategy_config(self, config: StrategyConfig) -> Tuple[bool, str]:
        """
        Sanity check for new AI-proposed configs to prevent dangerous parameters.
        """
        if config.stop_loss_pct <= 0 or config.stop_loss_pct > 20:
             return False, "Unsafe Parameter: Stop Loss % must be between 0.1 and 20"
             
        if config.take_profit_pct <= 0:
             return False, "Unsafe Parameter: Take Profit % must be positive"
             
        if config.vol_threshold < 0.5:
             return False, "Unsafe Parameter: Volume threshold too low (Signal noise risk)"
             
        if config.max_drawdown_limit > 0.3:
             return False, "Unsafe Parameter: Max Drawdown Limit > 30% is too loose"

        return True, "OK"

validation_agent = ValidationAgent()
