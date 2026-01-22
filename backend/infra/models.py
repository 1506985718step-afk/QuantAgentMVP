
import uuid
from sqlalchemy import Column, String, Integer, Date, Numeric, JSON, DateTime, ForeignKey, UniqueConstraint, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from datetime import datetime
from .database import Base

class Episode(Base):
    __tablename__ = "episodes"

    episode_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    session_id = Column(String(64), nullable=False)
    trade_day = Column(Date, nullable=False)
    mode = Column(String(16), nullable=False) # sim/paper/live
    
    policy_version = Column(String(128), nullable=False)
    
    initial_equity = Column(Numeric(20, 4), nullable=False)
    final_equity = Column(Numeric(20, 4), nullable=True)
    
    # PnL Split
    pnl_amount = Column(Numeric(20, 4), default=0)
    pnl_rate = Column(Numeric(10, 6), default=0)
    
    max_drawdown = Column(Numeric(10, 6), default=0)
    
    violations = Column(JSONB, default=list)
    reward_total = Column(Numeric(20, 6), default=0)
    
    status = Column(String(32), default="ACTIVE")
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    steps = relationship("Step", back_populates="episode", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint('session_id', 'trade_day', 'mode', name='uq_episodes_mode_day'),
        CheckConstraint("mode IN ('sim', 'paper', 'live')", name='chk_episodes_mode'),
    )

class Step(Base):
    __tablename__ = "steps"

    step_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    episode_id = Column(UUID(as_uuid=True), ForeignKey("episodes.episode_id"), nullable=False)
    
    step_index = Column(Integer, nullable=False)
    
    # Time Truth
    timestamp = Column(DateTime(timezone=True), nullable=False) # Event Time
    ingested_at = Column(DateTime(timezone=True), default=datetime.utcnow) # Write Time
    
    observation = Column(JSONB, nullable=False)
    action = Column(JSONB, nullable=True)
    
    tool_calls = Column(JSONB, default=list)
    guardrails = Column(JSONB, default=list)
    violations = Column(JSONB, default=list) # Step-level violations
    
    reward_step = Column(Numeric(20, 6), default=0)

    episode = relationship("Episode", back_populates="steps")

    __table_args__ = (
        UniqueConstraint('episode_id', 'step_index', name='uq_steps_episode_index'),
        CheckConstraint('step_index >= 0', name='chk_step_index_positive'),
    )
