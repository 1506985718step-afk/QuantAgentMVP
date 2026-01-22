
from typing import Optional, List, Dict, Any
from uuid import UUID
from datetime import date, datetime
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Episode, Step
from .database import AsyncSessionLocal

class TruthStore:
    """
    The Single Source of Truth Accessor.
    Ensures all writes are compliant with the QuantAgent Constitution v0.1.
    """
    
    async def create_episode(self, 
                             session_id: str, 
                             mode: str,
                             trade_day: date, 
                             initial_equity: float, 
                             policy_version: str) -> UUID:
        """
        Start a new trading day (Episode).
        """
        async with AsyncSessionLocal() as db:
            episode = Episode(
                session_id=session_id,
                mode=mode,
                trade_day=trade_day,
                initial_equity=initial_equity,
                policy_version=policy_version,
                status="ACTIVE",
                violations=[],
                reward_total=0
            )
            db.add(episode)
            await db.commit()
            await db.refresh(episode)
            return episode.episode_id

    async def close_episode(self, 
                            episode_id: UUID, 
                            final_equity: float, 
                            max_drawdown: float, 
                            pnl_amount: float,
                            pnl_rate: float):
        """
        Seal the episode at end of day with strict PnL separation.
        """
        async with AsyncSessionLocal() as db:
            stmt = (
                update(Episode)
                .where(Episode.episode_id == episode_id)
                .values(
                    final_equity=final_equity,
                    max_drawdown=max_drawdown,
                    pnl_amount=pnl_amount,
                    pnl_rate=pnl_rate,
                    status="COMPLETED",
                    # updated_at handled by Trigger
                )
            )
            await db.execute(stmt)
            await db.commit()

    async def record_step(self, 
                          episode_id: UUID, 
                          step_index: int, 
                          timestamp: datetime, # Event time
                          observation: Dict[str, Any], 
                          action: Optional[Dict[str, Any]] = None,
                          tool_calls: List[Dict[str, Any]] = [],
                          guardrails: List[Dict[str, Any]] = [],
                          violations: List[Dict[str, Any]] = [], # Step-level violations
                          reward: float = 0.0) -> UUID:
        """
        Record an atomic decision point.
        """
        async with AsyncSessionLocal() as db:
            step = Step(
                episode_id=episode_id,
                step_index=step_index,
                timestamp=timestamp,
                # ingested_at handled by DB default
                observation=observation,
                action=action,
                tool_calls=tool_calls,
                guardrails=guardrails,
                violations=violations,
                reward_step=reward
            )
            db.add(step)
            await db.commit()
            await db.refresh(step)
            return step.step_id
            
    async def log_violation(self, episode_id: UUID, violation: Dict[str, Any]):
        """
        Append a violation to the episode (Episode-level aggregation).
        """
        async with AsyncSessionLocal() as db:
            # Fetch current list
            result = await db.execute(select(Episode).where(Episode.episode_id == episode_id))
            episode = result.scalar_one_or_none()
            if episode:
                # Append to JSONB list (Immutable append logic)
                current_violations = list(episode.violations) if episode.violations else []
                current_violations.append(violation)
                
                episode.violations = current_violations
                await db.commit()

    async def load_episode_replay(self, episode_id: UUID) -> List[Dict[str, Any]]:
        """
        Replay Support: Load all steps strictly ordered by step_index.
        """
        async with AsyncSessionLocal() as db:
            stmt = (
                select(Step)
                .where(Step.episode_id == episode_id)
                .order_by(Step.step_index.asc())
            )
            result = await db.execute(stmt)
            steps = result.scalars().all()
            
            # Convert to dictionary for easy consumption by ReplayLoader
            return [
                {
                    "step_index": s.step_index,
                    "timestamp": s.timestamp.isoformat(),
                    "observation": s.observation,
                    "action": s.action,
                    "violations": s.violations,
                    "guardrails": s.guardrails
                }
                for s in steps
            ]

truth_store = TruthStore()
