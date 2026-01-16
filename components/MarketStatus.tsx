import React from 'react';
import { TrendingUp, TrendingDown, BarChart3, Wind, CalendarClock, Flame } from 'lucide-react';
import { MarketSnapshot } from '../types';

interface MarketStatusProps {
    data: MarketSnapshot;
}

const MarketStatus: React.FC<MarketStatusProps> = ({ data }) => {
    const isPositive = data.change_pct >= 0;
    
    // 2/3 Rule Calculation for visual cue
    const cond1 = data.up_count >= 3500;
    const cond2 = data.limit_up_count >= 60;
    const cond3 = data.limit_down_count <= 10;
    const score = (cond1 ? 1 : 0) + (cond2 ? 1 : 0) + (cond3 ? 1 : 0);
    const isGoodEnv = score >= 2;

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between pb-2">
                    <span className="text-sm font-medium text-slate-400">大盘环境评分</span>
                    <Flame className={`h-4 w-4 ${isGoodEnv ? 'text-rose-500' : 'text-slate-600'}`} />
                </div>
                <div className="flex items-end gap-2 relative z-10">
                    <span className={`text-xl font-bold font-mono tracking-wide ${isGoodEnv ? 'text-rose-400' : 'text-slate-400'}`}>
                        {isGoodEnv ? '可操作 (HOT)' : '建议空仓 (COLD)'}
                    </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                    赚钱效应满足 {score}/3 条件
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                <div className="flex items-center justify-between pb-2">
                    <span className="text-sm font-medium text-slate-400">指数仿真</span>
                    <BarChart3 className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-bold text-slate-100">{data.index_price.toFixed(2)}</span>
                    <span className={`text-sm font-medium ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isPositive ? '+' : ''}{data.change_pct}%
                    </span>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                <div className="flex items-center justify-between pb-2">
                    <span className="text-sm font-medium text-slate-400">涨跌家数</span>
                    <Wind className="h-4 w-4 text-slate-500" />
                </div>
                <div className="flex items-center gap-2 text-sm">
                    <span className="text-emerald-500 font-bold">{data.up_count}</span>
                    <span className="text-slate-600">/</span>
                    <span className="text-rose-500 font-bold">{data.down_count}</span>
                </div>
                 <div className="h-1.5 w-full rounded-full bg-slate-800 mt-2 flex overflow-hidden">
                    <div className="bg-emerald-500 h-full" style={{ width: `${(data.up_count / (data.up_count + data.down_count)) * 100}%` }}></div>
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-sm">
                <div className="flex items-center justify-between pb-2">
                    <span className="text-sm font-medium text-slate-400">涨停/跌停</span>
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex items-center gap-4">
                     <div>
                        <span className="text-xs text-slate-500 block">涨停</span>
                        <span className={`text-lg font-bold ${cond2 ? 'text-emerald-400' : 'text-slate-300'}`}>{data.limit_up_count}</span>
                     </div>
                     <div>
                        <span className="text-xs text-slate-500 block">跌停</span>
                        <span className={`text-lg font-bold ${cond3 ? 'text-slate-300' : 'text-rose-400'}`}>{data.limit_down_count}</span>
                     </div>
                </div>
            </div>
        </div>
    );
};

export default MarketStatus;