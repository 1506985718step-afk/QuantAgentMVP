
from abc import ABC, abstractmethod
from typing import Dict, Any, List
from .contracts import AgentProfile

class BaseAgent(ABC):
    @abstractmethod
    def get_profile(self) -> AgentProfile:
        """Return the standardized Agent Card"""
        pass

class Orchestrator(ABC):
    @abstractmethod
    def register_agent(self, agent: BaseAgent):
        pass

    @abstractmethod
    async def run_tick_cycle(self) -> Dict[str, Any]:
        pass
