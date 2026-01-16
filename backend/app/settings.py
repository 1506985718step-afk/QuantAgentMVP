from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Core Identity
    APP_NAME: str = "QuantAgent MVP"
    VERSION: str = "0.9.0"
    
    # Execution Mode
    MODE: str = "mock"  # mock | replay | paper
    
    # Session Context
    SESSION_ID: str = "sess_default"
    TRADE_DAY: str = "2023-10-27"
    
    # Infrastructure
    REDIS_URL: Optional[str] = None
    
    # LLM Configuration
    DEEPSEEK_API_KEY: str = "sk-bddf5370bddf40ef844bc9637b1cdbe3"
    DEEPSEEK_API_URL: str = "https://api.deepseek.com/chat/completions"
    
    # Risk Limits (MVP Hardcoded)
    MAX_DAILY_BUYS: int = 5
    MAX_POSITION_PCT: float = 0.2
    
    # Trading Rules
    DEFAULT_STOP_LOSS_PCT: float = 0.05
    DEFAULT_TAKE_PROFIT_PCT: float = 0.05

    class Config:
        env_file = ".env"

settings = Settings()