
import React from 'react';
import { Position } from '../types';
import { ArrowUpRight, ArrowDownRight, Lock, Clock, AlertTriangle, Target } from 'lucide-react';
import { config } from '../services/config';

interface PositionTableProps {
    positions: Position[];
}

const PositionTable: React.FC<PositionTableProps> = ({ positions }) => {
    // Hardcoded config fallback if not available in context, ideally should come from props or global store
    // Matching backend defaults: SL -3%, TP +8% (Dynamic config might change this)
    const TARGET_TP = 8.0;
    const TARGET_SL = -3.0;

    if (positions.length === 0) {
        return (
            <div className="h-32 glass-panel rounded-lg flex items-center justify-center text-zinc-600 text-sm border-dashed border-zinc-800">
                当前无持仓
            </div>
        );
    }

    return (
        <div className="glass-panel rounded-lg overflow-hidden">
            <table className="w-full text-left text-sm">
                <thead className="bg-white/[0.02] text-zinc-500 border-b border-white/5">
                    <tr>
                        <th className="px-4 py-3 font-medium text-[10px] uppercase tracking-wider">资产 (Asset)</th>
                        <th className="px-4 py-3 font-medium text-[10px] uppercase tracking-wider text-right">持仓 (Size)</th>
                        <th className="px-4 py-3 font-medium text-[10px] uppercase tracking-wider text-center">周期 (Time)</th>
                        <th className="px-4 py-3 font-medium text-[10px] uppercase tracking-wider text-center">风险距离 (Risk)</th>
                        <th className="px-4 py-3 font-medium text-[10px] uppercase tracking-wider text-right">浮动盈亏 (P&L)</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                    {positions.map((pos) => {
                        const isProfit = pos.unrealized_pnl >= 0;
                        const isFrozen = pos.quantity > pos.sellable;
                        const pnlPct = pos.unrealized_pnl_pct;
                        
                        // Calculate Progress bars
                        // TP Progress (0 to 100%)
                        const tpProgress = Math.min(100, Math.max(0, (pnlPct / TARGET_TP) * 100));
                        // SL Progress (0 to 100%) - note SL is negative, e.g. -3
                        const slProgress = Math.min(100, Math.max(0, (pnlPct / TARGET_SL) * 100));

                        return (
                            <tr key={pos.symbol} className="hover:bg-white/[0.02] transition-colors group">
                                <td className="px-4 py-3">
                                    <div className="font-bold text-zinc-200 flex items-center gap-2">
                                        {pos.name}
                                        {isFrozen && (
                                            <span className="text-[9px] text-amber-500 bg-amber-500/10 border border-amber-500/20 px-1 rounded flex items-center gap-0.5" title="T+1 冻结中">
                                                <Lock className="h-2 w-2" /> T+1
                                            </span>
                                        )}
                                    </div>
                                    <div className="font-mono text-xs text-zinc-500">{pos.symbol}</div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className="font-mono text-zinc-300">{pos.quantity.toLocaleString()}</div>
                                    <div className="text-[10px] text-zinc-600">可卖: {pos.sellable.toLocaleString()}</div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <div className="inline-flex flex-col items-center">
                                        <div className={`flex items-center gap-1 font-mono font-bold ${pos.days_held > 1 ? 'text-amber-500' : 'text-zinc-400'}`}>
                                            <Clock className="h-3 w-3" />
                                            T+{pos.days_held}
                                        </div>
                                        {pos.days_held >= 2 && <span className="text-[9px] text-rose-500">超期风险</span>}
                                    </div>
                                </td>
                                <td className="px-4 py-3 align-middle w-32">
                                    {/* Risk Bars */}
                                    <div className="flex flex-col gap-1.5 w-full max-w-[120px] mx-auto">
                                        {/* TP Bar */}
                                        <div className="flex items-center gap-1.5">
                                            <Target className="h-2.5 w-2.5 text-emerald-500/70" />
                                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 transition-all duration-500" style={{width: `${tpProgress}%`}}></div>
                                            </div>
                                        </div>
                                        {/* SL Bar */}
                                        <div className="flex items-center gap-1.5">
                                            <AlertTriangle className="h-2.5 w-2.5 text-rose-500/70" />
                                            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
                                                <div className="h-full bg-rose-500 transition-all duration-500" style={{width: `${slProgress}%`}}></div>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <div className={`font-mono font-bold flex items-center justify-end gap-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {isProfit ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                        {pos.unrealized_pnl_pct.toFixed(2)}%
                                    </div>
                                    <div className={`text-xs font-mono opacity-60 ${isProfit ? 'text-emerald-500' : 'text-rose-500'}`}>
                                        {isProfit ? '+' : ''}{pos.unrealized_pnl.toFixed(0)}
                                    </div>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default PositionTable;
