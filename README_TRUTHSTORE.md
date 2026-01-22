
# TruthStore Specification (Constitution v0.1)

TruthStore 是 QuantAgent 系统中唯一的、不可变的事实来源。所有模型训练、回测评估、审计追踪必须以此数据库为准。

## 1. 核心概念

### Episode (回合/交易日)
最小的结算单位。
*   **mode**: `sim` (回测/模拟), `paper` (仿真), `live` (实盘)。
*   **pnl_amount**: 绝对盈亏金额 (e.g. +500.00)。
*   **pnl_rate**: 收益率 (e.g. 0.050000 代表 5%)。**禁止**存储百分比字符串。
*   **violations**: 当日所有违规事件的聚合列表。
*   **policy_version**: 关联的策略版本号，确保结果可追溯。

### Step (决策步)
最小的回放单位。
*   **step_index**: 严格递增 (0, 1, 2...)，保证回放顺序确定性。
*   **timestamp**: **事件发生时间** (Agent 看到数据的时间)。
*   **ingested_at**: **数据入库时间** (用于诊断系统延迟)。
*   **violations**: 该步骤触发的具体违规 (e.g. "Attempted to buy 500 lots, limit 200").
*   **observation**: 决策时的完整市场与账户状态快照。

## 2. Replay (回放) 规则

1.  **加载**: 使用 `truth_store.load_episode_replay(episode_id)`。
2.  **顺序**: 必须严格按照 `step_index ASC` 执行。
3.  **验证**: 回放时，Agent 接收 `observation`，其输出的 Action 应与数据库中的 `action` 一致（除非是为了验证新策略）。
4.  **只读**: 回放过程中不得产生新的 Side Effect（如真实下单），除非 `mode` 明确标记为 `sim` 且用于生成新轨迹。

## 3. 字段语义速查

| 表 | 字段 | 类型 | 语义 |
|---|---|---|---|
| episodes | mode | ENUM | 运行模式，严格区分实盘与模拟 |
| episodes | pnl_amount | NUMERIC | `final_equity - initial_equity` |
| episodes | pnl_rate | NUMERIC | `pnl_amount / initial_equity` |
| steps | timestamp | TIMESTAMPTZ | 决策时刻 (业务时间) |
| steps | ingested_at | TIMESTAMPTZ | 写入时刻 (系统时间) |
| steps | guardrails | JSONB[] | 风控拦截详情 |
| steps | violations | JSONB[] | 违规记录 |

## 4. 数据库维护

*   Schema 变更必须通过 Migration 脚本执行。
*   `updated_at` 字段由数据库 Trigger 自动维护，应用层禁止手动写入。
