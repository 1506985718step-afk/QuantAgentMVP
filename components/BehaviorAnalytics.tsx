import React from 'react';
import { TradeMetrics } from '../types';
import { PieChart, TrendingUp, BarChart, AlertOctagon } from 'lucide-react';

interface BehaviorAnalyticsProps {
    metrics: TradeMetrics;
}

const MetricCard = ({ label, value, subtext, icon, trend }: any) => (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-400">{label}</span>
            <div className="text-slate-500">{icon}</div>
        </div>
        <div className="text-2xl font-bold text-slate-100">{value}</div>
        {subtext && <div className={`text-xs mt-1 ${trend === 'good' ? 'text-emerald-500' : trend === 'bad' ? 'text-rose-500' : 'text-slate-500'}`}>{subtext}</div>}
    </div>
);

const BehaviorAnalytics: React.FC<BehaviorAnalyticsProps> = ({ metrics }) => {
    // Safe formatting helpers
    const formatPct = (val: number) => isNaN(val) ? '0.0%' : `${(val * 100).toFixed(1)}%`;
    const formatNum = (val: number) => isNaN(val) || !isFinite(val) ? '0.00' : val.toFixed(2);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <MetricCard 
                    label="胜率 (Win Rate)" 
                    value={formatPct(metrics.win_rate)}
                    subtext="目标: >55%"
                    trend={metrics.win_rate > 0.55 ? 'good' : 'bad'}
                    icon={<PieChart className="h-4 w-4" />}
                />
                <MetricCard 
                    label="盈亏比 (P/L Ratio)" 
                    value={formatNum(metrics.profit_factor)}
                    subtext="目标: >1.5"
                    trend={metrics.profit_factor > 1.5 ? 'good' : 'bad'}
                    icon={<TrendingUp className="h-4 w-4" />}
                />
                <MetricCard 
                    label="最大回撤" 
                    value={formatPct(metrics.max_drawdown)}
                    subtext="风控线: <5%"
                    trend={metrics.max_drawdown < 0.05 ? 'good' : 'bad'}
                    icon={<AlertOctagon className="h-4 w-4" />}
                />
                <MetricCard 
                    label="交易总数" 
                    value={metrics.total_trades}
                    subtext="样本量充足"
                    trend="neutral"
                    icon={<BarChart className="h-4 w-4" />}
                />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* Cost Analysis */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                    <h3 className="text-lg font-bold text-slate-100 mb-4">成本与效率分析</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-400">平均盈利 (Avg Win)</span>
                                <span className="text-emerald-400 font-mono">+{formatNum(metrics.avg_win_pnl)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                                <div className="h-full bg-emerald-500" style={{ width: '70%' }}></div>
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-slate-400">平均亏损 (Avg Loss)</span>
                                <span className="text-rose-400 font-mono">-{formatNum(metrics.avg_loss_pnl)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                                <div className="h-full bg-rose-500" style={{ width: '40%' }}></div>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-slate-800">
                             <div className="flex justify-between text-sm items-center">
                                <span className="text-slate-400">交易摩擦成本占比</span>
                                <span className={`font-mono font-bold ${(metrics.cost_ratio > 0.15) ? 'text-amber-500' : 'text-slate-200'}`}>
                                    {formatPct(metrics.cost_ratio)}
                                </span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">包含佣金、印花税及估算滑点</p>
                        </div>
                    </div>
                </div>

                {/* Behavioral Diagnosis */}
                <div className="rounded-xl border border-slate-800 bg-slate-900 p-6">
                    <h3 className="text-lg font-bold text-slate-100 mb-4">交易习惯诊断</h3>
                    <ul className="space-y-3">
                        <li className="flex items-start gap-3">
                            <div className="h-2 w-2 mt-2 rounded-full bg-emerald-500"></div>
                            <div>
                                <p className="text-sm text-slate-200 font-medium">处置效应 (Disposition Effect)</p>
                                <p className="text-xs text-slate-500">低风险。您倾向于“截断亏损，让利润奔跑”，未发现过早止盈现象。</p>
                            </div>
                        </li>
                        <li className="flex items-start gap-3">
                            <div className="h-2 w-2 mt-2 rounded-full bg-amber-500"></div>
                            <div>
                                <p className="text-sm text-slate-200 font-medium">过度交易 (Overtrading)</p>
                                <p className="text-xs text-slate-500">中等风险。请持续关注交易频率。</p>
                            </div>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default BehaviorAnalytics;