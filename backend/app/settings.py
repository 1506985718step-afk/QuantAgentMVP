
from pydantic_settings import BaseSettings
from typing import Optional, List, Dict
from datetime import datetime
import os

class Settings(BaseSettings):
    # Core Identity
    APP_NAME: str = "QuantAgent MVP"
    VERSION: str = "0.9.1-strict"
    
    # Execution Mode: 'mock' | 'replay' | 'live'
    MODE: str = "mock"  
    
    # Session Context
    SESSION_ID: str = "sess_default"
    # Dynamic default to today's date
    TRADE_DAY: str = datetime.now().strftime("%Y-%m-%d")
    
    # Infrastructure
    REDIS_URL: Optional[str] = None
    
    # LLM Configuration
    DEEPSEEK_API_KEY: str = "sk-bddf5370bddf40ef844bc9637b1cdbe3"
    DEEPSEEK_API_URL: str = "https://api.deepseek.com/chat/completions"
    
    # Security & Auth
    # SECURITY FIX: Read from env, fallback to generated only for dev
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev_secret_key_DO_NOT_USE_IN_PROD")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 

    # --- CONSTAINTS & CONFIG PROFILES (Constraint #7) ---
    
    # Risk Limits
    MAX_DAILY_BUYS: int = 5
    MAX_POSITION_PCT: float = 0.2
    
    # Default Watchlist (Constraint: Not hardcoded in logic)
    DEFAULT_WATCHLIST: List[Dict[str, str]] = [
        {'symbol': '000001', 'name': '平安银行'},
        {'symbol': '600519', 'name': '贵州茅台'},
        {'symbol': '002594', 'name': '比亚迪'},
        {'symbol': '300750', 'name': '宁德时代'},
        {'symbol': '300059', 'name': '东方财富'},
        {'symbol': '601138', 'name': '工业富联'} 
    ]

    # Strategy Profiles (Constraint: Parameter Isolation)
    STRATEGY_PROFILES: Dict[str, Dict] = {
        "conservative": {
            "vol_threshold": 2.0,
            "stop_loss_pct": 2.0,
            "take_profit_pct": 5.0
        },
        "aggressive": {
            "vol_threshold": 1.2,
            "stop_loss_pct": 3.5,
            "take_profit_pct": 12.0
        },
        "default": {
            "vol_threshold": 1.5,
            "stop_loss_pct": 3.0,
            "take_profit_pct": 8.0
        }
    }

    class Config:
        env_file = ".env"

settings = Settings()
