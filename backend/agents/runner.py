import asyncio
from typing import List
from ..infra.event_store import InMemoryEventStore
from ..app.settings import settings

class AgentRunner:
    def __init__(self):
        self.event_store = InMemoryEventStore()
        self.agents: List[object] = []
        self.running = False
        print(f"AgentRunner initialized in {settings.MODE} mode.")

    def register_agent(self, agent):
        self.agents.append(agent)

    async def run(self):
        self.running = True
        print("Agents started. Waiting for events...")
        while self.running:
            # 1. Poll for events (Mocking event loop)
            # 2. Dispatch to agents
            await asyncio.sleep(1)

    def stop(self):
        self.running = False
        print("Agents stopped.")
