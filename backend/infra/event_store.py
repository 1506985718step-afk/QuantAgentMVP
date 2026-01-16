from typing import List, Optional
from ..core.contracts import SystemEvent

class InMemoryEventStore:
    def __init__(self):
        self._events: List[SystemEvent] = []

    def append(self, event: SystemEvent) -> None:
        self._events.append(event)
        # In a real app, this would also publish to Redis

    def get_all(self) -> List[SystemEvent]:
        return self._events.copy()

    def get_by_trace(self, trace_id: str) -> List[SystemEvent]:
        return [e for e in self._events if e.trace_id == trace_id]
        
    def get_latest(self) -> Optional[SystemEvent]:
        return self._events[-1] if self._events else None
