from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel
from typing import List
from .settings import settings
from ..core.system import trading_system
from ..core.contracts import TradeIntent
from ..services.market_data import market_data_service

app = FastAPI(title=settings.APP_NAME, version=settings.VERSION)

# Allow Frontend access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EquityRequest(BaseModel):
    amount: float

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    history: List[ChatMessage]

@app.get("/")
async def read_root():
    return {"status": "online", "mode": "real_backend"}

@app.get("/api/state")
async def get_state():
    """Get full UI state (polling)"""
    return trading_system.get_state()

@app.get("/api/market/history/{symbol}")
async def get_market_history(symbol: str):
    """
    Get historical K-Line data for a symbol.
    Uses run_in_threadpool to prevent blocking the event loop during AkShare sync calls.
    """
    try:
        data = await run_in_threadpool(market_data_service.get_history_bars, symbol)
        return data
    except Exception as e:
        print(f"Error fetching history for {symbol}: {e}")
        return []

@app.post("/api/intent/approve")
async def approve_intent(intent: TradeIntent):
    """Frontend sends an approved intent to execute"""
    success = trading_system.submit_intent(intent)
    if not success:
        raise HTTPException(status_code=400, detail="Guard blocked the trade")
    return {"status": "accepted", "intent_id": intent.intent_id}

@app.post("/api/intent/reject")
async def reject_intent(intent_id: str):
    return {"status": "rejected", "intent_id": intent_id}

@app.post("/api/orders/cancel")
async def cancel_order(intent_id: str):
    trading_system.cancel_order(intent_id)
    return {"status": "cancelled"}

@app.post("/api/account/equity")
async def set_equity(req: EquityRequest):
    trading_system.set_equity(req.amount)
    return {"status": "updated"}

@app.post("/api/audit/generate")
async def generate_audit():
    """Manually trigger AI Audit generation"""
    report = await trading_system.generate_audit()
    return report

@app.post("/api/chat")
async def chat_with_expert(req: ChatRequest):
    """
    Chat with the AI Investment Expert.
    """
    # Convert Pydantic models to dicts for the service
    msgs = [{"role": m.role, "content": m.content} for m in req.history]
    response = await trading_system.llm_service.chat_completion(msgs)
    return {"role": "assistant", "content": response}

@app.post("/api/debug/next_day")
async def debug_next_day():
    trading_system.positions = trading_system.engine.settle_overnight(trading_system.positions)
    trading_system.account.filled_buys_today = 0
    trading_system._log("DAILY_REPORT", "SYSTEM", "INFO", "Manual Next Day Triggered")
    # Auto-generate audit on day end (Async await)
    await trading_system.generate_audit()
    return {"status": "ok"}

@app.post("/api/debug/tick")
async def debug_tick():
    """Trigger a strategy cycle"""
    result = await trading_system.tick()
    return result
