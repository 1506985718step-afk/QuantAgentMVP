import pytest
from backend.infra.event_store import InMemoryEventStore
from backend.core.trade_guard import TradeGuard
from backend.core.exit_policy import ExitPolicy

@pytest.fixture
def event_store():
    return InMemoryEventStore()

@pytest.fixture
def trade_guard():
    return TradeGuard(max_daily_buys=5)

@pytest.fixture
def exit_policy():
    return ExitPolicy()

@pytest.fixture
def mock_context():
    return {
        "session_id": "test_sess_01",
        "trade_day": "2023-10-27"
    }
