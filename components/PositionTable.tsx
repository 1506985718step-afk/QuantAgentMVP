import React from 'react';
import { Position } from '../types';
import { ArrowUpRight, ArrowDownRight, Lock, Unlock } from 'lucide-react';

interface PositionTableProps {
    positions: Position[];
}

const PositionTable: React.FC<PositionTableProps> = ({ positions }) => {
    if (positions.length === 0) {
        return (
            <div className="flex h-40 items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-500">
                当前无持仓
            </div>
        );
    }

    return (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950/50 text-slate-400">
                        <tr>
                            <th className="px-6 py-3 font-medium">标的</th>
                            <th className="px-6 py-3 font-medium text-right">数量</th>
                            <th className="px-6 py-3 font-medium text-right">状态</th>
                            <th className="px-6 py-3 font-medium text-right">均价/现价</th>
                            <th className="px-6 py-3 font-medium text-right">浮动盈亏</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {positions.map((pos) => {
                            const isProfit = pos.unrealized_pnl >= 0;
                            const isFrozen = pos.quantity > pos.sellable;
                            
                            return (
                                <tr key={pos.symbol} className="hover:bg-slate-800/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-slate-200">{pos.name}</span>
                                            <span className="font-mono text-xs text-slate-500">{pos.symbol}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-slate-300">
                                        <span className="text-lg">{pos.quantity}</span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            {isFrozen ? (
                                                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-500 border border-amber-500/20">
                                                    <Lock className="h-3 w-3" />
                                                    T+0 冻结
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-500 border border-emerald-500/20">
                                                    <Unlock className="h-3 w-3" />
                                                    可卖出
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-1">
                                            持仓 {pos.days_held} 天
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono">
                                        <div className="text-slate-400 text-xs">成本: {pos.average_cost.toFixed(2)}</div>
                                        <div className="text-slate-200 font-bold">{pos.current_price.toFixed(2)}</div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className={`flex items-center justify-end gap-1 ${isProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {isProfit ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                                            <span className="font-mono font-medium text-lg">
                                                {pos.unrealized_pnl_pct.toFixed(2)}%
                                            </span>
                                        </div>
                                        <div className={`text-xs font-mono ${isProfit ? 'text-emerald-500/70' : 'text-rose-500/70'}`}>
                                            {isProfit ? '+' : ''}{pos.unrealized_pnl.toFixed(2)}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default PositionTable;