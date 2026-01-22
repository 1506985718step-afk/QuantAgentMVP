
from fastapi import FastAPI, HTTPException, Body, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_inthreadpool
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from typing import List, Dict, Optional
import os
from .settings import settings
from ..core.system import trading_system
from ..core.contracts import TradeIntent
from ..core.security import create_access_token, decode_access_token
# Corrected Import
from ..services.market_data import market_data_service
from ..services.user_service import user_service, UserInDB, BrokerAccount

app = FastAPI(title=settings.APP_NAME, version=settings.VERSION)

# SECURITY FIX: restrict origins in production based on ENV
allow_origins_str = os.getenv("CORS_ORIGINS", "http://localhost,http://localhost:3000,http://127.0.0.1,http://127.0.0.1:3000")
origins = [origin.strip() for origin in allow_origins_str.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

# --- Auth Models ---
class UserRegister(BaseModel):
    username: str
    password: str
    full_name: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str
    username: str

class UserProfile(BaseModel):
    username: str
    full_name: Optional[str]
    role: str
    broker_accounts: List[BrokerAccount]

class BrokerBindRequest(BaseModel):
    broker_name: str
    account_id: str
    account_type: str = "stock"

class BrokerUnbindRequest(BaseModel):
    account_id: str

# --- Simulation Models ---
class SimulationResetRequest(BaseModel):
    initial_equity: float = 100000.0
    trade_day: Optional[str] = None

# --- Dependency ---
async def get_current_user(token: str = Depends(oauth2_scheme)):
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    username: str = payload.get("sub")
    if username is None:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = user_service.get_user(username)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# --- Existing Models ---
class EquityRequest(BaseModel):
    amount: float

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    history: List[ChatMessage]

class WatchlistAddRequest(BaseModel):
    symbol: str
    name: str

class WatchlistRemoveRequest(BaseModel):
    symbol: str

class WatchlistItem(BaseModel):
    symbol: str
    name: str

class WatchlistSetRequest(BaseModel):
    items: List[WatchlistItem]

@app.get("/")
async def read_root():
    return {"status": "online", "mode": settings.MODE}

# --- Auth Endpoints ---

@app.post("/api/auth/register", response_model=Token)
async def register(user_data: UserRegister):
    user = user_service.create_user(user_data.username, user_data.password, user_data.full_name)
    if not user:
        raise HTTPException(status_code=400, detail="Username already exists")
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "username": user.username}

@app.post("/api/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    user = user_service.authenticate_user(form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer", "username": user.username}

@app.get("/api/users/me", response_model=UserProfile)
async def read_users_me(current_user: UserInDB = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "full_name": current_user.full_name,
        "role": current_user.role,
        "broker_accounts": current_user.broker_accounts
    }

# --- Broker Management Endpoints ---

@app.post("/api/users/brokers/add")
async def add_broker(req: BrokerBindRequest, current_user: UserInDB = Depends(get_current_user)):
    new_acc = BrokerAccount(
        broker_name=req.broker_name,
        account_id=req.account_id,
        account_type=req.account_type,
        status="connected"
    )
    success = user_service.add_broker_account(current_user.username, new_acc)
    if not success:
        raise HTTPException(status_code=400, detail="Account already bound")
    return {"status": "ok", "account": new_acc}

@app.post("/api/users/brokers/remove")
async def remove_broker(req: BrokerUnbindRequest, current_user: UserInDB = Depends(get_current_user)):
    success = user_service.remove_broker_account(current_user.username, req.account_id)
    if not success:
        raise HTTPException(status_code=404, detail="Account not found")
    return {"status": "removed"}

# --- Protected System Endpoints ---

@app.get("/api/state")
async def get_state(current_user: UserInDB = Depends(get_current_user)):
    """Get full UI state (polling) - Now Protected"""
    return trading_system.get_state()

@app.get("/api/market/history/{symbol}")
async def get_market_history(symbol: str, current_user: UserInDB = Depends(get_current_user)):
    try:
        data = await run_inthreadpool(market_data_service.get_history_bars, symbol)
        return data
    except Exception as e:
        print(f"Error fetching history for {symbol}: {e}")
        return []

@app.post("/api/watchlist/add")
async def add_watchlist(req: WatchlistAddRequest, current_user: UserInDB = Depends(get_current_user)):
    trading_system.strategy_agent.add_to_watchlist(req.symbol, req.name)
    return {"status": "added", "watchlist": trading_system.strategy_agent.get_watchlist()}

@app.post("/api/watchlist/remove")
async def remove_watchlist(req: WatchlistRemoveRequest, current_user: UserInDB = Depends(get_current_user)):
    trading_system.strategy_agent.remove_from_watchlist(req.symbol)
    return {"status": "removed", "watchlist": trading_system.strategy_agent.get_watchlist()}

@app.post("/api/watchlist/set")
async def set_watchlist(req: WatchlistSetRequest, current_user: UserInDB = Depends(get_current_user)):
    items_dict = [{"symbol": item.symbol, "name": item.name} for item in req.items]
    trading_system.strategy_agent.set_watchlist(items_dict)
    return {"status": "set", "watchlist": trading_system.strategy_agent.get_watchlist()}

@app.post("/api/intent/approve")
async def approve_intent(intent: TradeIntent, current_user: UserInDB = Depends(get_current_user)):
    success = await trading_system.submit_intent(intent) # NOW AWAIT
    if not success:
        raise HTTPException(status_code=400, detail="Guard blocked the trade")
    return {"status": "accepted", "intent_id": intent.intent_id}

@app.post("/api/intent/reject")
async def reject_intent(intent_id: str, current_user: UserInDB = Depends(get_current_user)):
    return {"status": "rejected", "intent_id": intent_id}

@app.post("/api/orders/cancel")
async def cancel_order(intent_id: str, current_user: UserInDB = Depends(get_current_user)):
    await trading_system.cancel_order(intent_id) # NOW AWAIT
    return {"status": "cancelled"}

@app.post("/api/account/equity")
async def set_equity(req: EquityRequest, current_user: UserInDB = Depends(get_current_user)):
    await trading_system.set_equity(req.amount) # NOW AWAIT
    return {"status": "updated"}

@app.post("/api/audit/generate")
async def generate_audit(current_user: UserInDB = Depends(get_current_user)):
    report = await trading_system.generate_audit()
    return report

@app.post("/api/experiments/run")
async def run_experiments(current_user: UserInDB = Depends(get_current_user)):
    """Trigger automated scenario validation"""
    results = await trading_system.run_experiments()
    return results

@app.post("/api/chat")
async def chat_with_expert(req: ChatRequest, current_user: UserInDB = Depends(get_current_user)):
    msgs = [{"role": m.role, "content": m.content} for m in req.history]
    response = await trading_system.llm_service.chat_completion(msgs)
    return {"role": "assistant", "content": response}

# --- Simulation Control Endpoints (Constraint: Backend = Truth) ---

@app.post("/api/debug/next_day")
async def debug_next_day(current_user: UserInDB = Depends(get_current_user)):
    trading_system.positions = trading_system.engine.settle_overnight(trading_system.positions)
    trading_system.account.filled_buys_today = 0
    trading_system._log("DAILY_REPORT", "SYSTEM", "INFO", "Manual Next Day Triggered")
    
    # Close previous episode logic via reset/next logic would ideally be here or in system
    # For now, relying on system's internal state tracking
    
    await trading_system.generate_audit()
    return {"status": "ok"}

@app.post("/api/debug/tick")
async def debug_tick(current_user: UserInDB = Depends(get_current_user)):
    result = await trading_system.tick()
    return result

@app.post("/api/simulation/reset")
async def simulation_reset(req: SimulationResetRequest, current_user: UserInDB = Depends(get_current_user)):
    """Reset the entire system state for replay"""
    await trading_system.reset_state(initial_equity=req.initial_equity, trade_day=req.trade_day)
    return {"status": "reset", "current_state": trading_system.get_state()}
