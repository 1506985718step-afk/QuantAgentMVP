import pytest
from backend.core.contracts import (
    TradeIntent, Position, Side, IntentType, Decision, 
    IntentSource, IntentVersion, AgentType
)
from backend.core.trade_guard import TradeGuard
from backend.core.exit_policy import ExitPolicy
from backend.core.execution_engine import ExecutionEngine

@pytest.fixture
def execution_engine():
    return ExecutionEngine()

def test_lifecycle_entry_to_take_profit(trade_guard: TradeGuard, exit_policy: ExitPolicy, execution_engine: ExecutionEngine, mock_context):
    """
    主要测试链路：
    1. Strategy 发出 BUY 信号
    2. Guard 检查通过 (ALLOW)
    3. ExecutionEngine 模拟成交 (BUY) -> 验证 T+1 (sellable=0)
    4. ExecutionEngine 模拟结算 (Settle) -> 验证 sellable=quantity
    5. 市场上涨 (+6%)
    6. ExitPolicy 扫描，触发 +5% 止盈
    7. Guard 检查 SELL 意图
    8. ExecutionEngine 模拟成交 (SELL) -> 验证 Partial Close
    """
    
    session_id = mock_context["session_id"]
    trade_day = mock_context["trade_day"]
    symbol = "000001"
    name = "平安银行"
    
    # --- Step 1: Strategy Emits BUY Signal ---
    buy_intent = TradeIntent(
        trade_day=trade_day,
        session_id=session_id,
        symbol=symbol,
        name=name,
        side=Side.BUY,
        intent_type=IntentType.BUY,
        qty=1000,
        price=10.00,
        strategy_id="test_strat_v1",
        reason="Golden Cross",
        source=IntentSource(source_event_id="evt_sig_1", trigger="signal"),
        version=IntentVersion()
    )
    
    # --- Step 2: Guard Check (Entry) ---
    decision, reason = trade_guard.check(buy_intent, filled_buys_today=0)
    assert decision == Decision.ALLOW, f"Buy should be allowed: {reason}"
    
    # --- Step 3: Execution (Buy Fill) ---
    positions = [] # Empty initial
    positions = execution_engine.apply_fill(positions, buy_intent, fill_price=10.00, costs=5.0)
    
    assert len(positions) == 1
    pos = positions[0]
    assert pos.quantity == 1000
    assert pos.sellable == 0, "T+1 Rule: Newly bought shares must not be sellable today"
    
    # --- Step 3.5: Simulate Day Passing (Settlement) ---
    # 为了测试卖出，我们必须先结算，否则 T+1 规则会拦截卖出
    execution_engine.settle_overnight(positions)
    assert pos.sellable == 1000, "After settlement, shares should be sellable"

    # --- Step 4: Market Pumps (+6%) ---
    new_price = 10.60
    pos.current_price = new_price
    pos.market_value = pos.quantity * new_price
    pos.unrealized_pnl = pos.market_value - (pos.quantity * pos.average_cost)
    pos.unrealized_pnl_pct = (pos.unrealized_pnl / (pos.quantity * pos.average_cost)) * 100
    
    assert pos.unrealized_pnl_pct > 5.0
    
    # --- Step 5: Exit Policy Scan ---
    exit_intent = exit_policy.check_exit(pos, session_id, trade_day)
    
    assert exit_intent is not None
    assert exit_intent.side == Side.SELL
    assert exit_intent.qty == 500 # 50% sell
    
    # --- Step 6: Guard Check (Exit) ---
    decision_exit, reason_exit = trade_guard.check(exit_intent, filled_buys_today=1)
    assert decision_exit == Decision.ALLOW

    # --- Step 7: Execution Validation (Sell Check) ---
    valid, msg = execution_engine.validate_order(exit_intent, positions, available_cash=99999)
    assert valid is True, f"Sell should be valid after settlement. Msg: {msg}"

    # --- Step 8: Execution (Sell Fill) ---
    positions = execution_engine.apply_fill(positions, exit_intent, fill_price=10.60, costs=5.0)
    
    assert positions[0].quantity == 500
    assert positions[0].sellable == 500 # 1000 settled - 500 sold
    
    print("\n[Success] Full lifecycle with Engine & T+1 checks passed.")