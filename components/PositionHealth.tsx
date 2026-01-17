
import React from 'react';
import { Activity } from 'lucide-react';

interface PositionHealthProps {
    score?: number;
    kellySuggestion?: number;
    currentExposure: number;
}

const PositionHealth: React.FC<PositionHealthProps> = ({ score = 100, kellySuggestion = 0.3, currentExposure }) => {
    const color = score < 60 ? 'bg-rose-500' : score < 80 ? 'bg-amber-500' : 'bg-emerald-500';
    const textCol = score < 60 ? 'text-rose-500' : score < 80 ? 'text-amber-500' : 'text-emerald-500';

    return (
        <div className="glass-panel rounded-lg p-3 sm:p-4 h-full flex flex-col justify-between relative overflow-hidden min-h-[85px]">
             {/* Glow Effect */}
             <div className={`absolute -right-4 -top-4 w-20 h-20 blur-3xl opacity-20 ${color}`}></div>

            <div>
                <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">持仓健康度</span>
                    <Activity className={`h-3.5 w-3.5 ${textCol}`} />
                </div>
                <div className="flex items-end gap-3">
                    <div className="text-3xl font-bold text-white font-mono tracking-tighter leading-none">
                        {score}
                    </div>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1.5">
                        <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${score}%` }}></div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-white/5">
                <div>
                    <span className="text-[9px] text-zinc-500 block">仓位占比</span>
                    <span className="font-mono text-zinc-200 font-bold text-sm">{(currentExposure * 100).toFixed(0)}%</span>
                </div>
                <div className="text-right">
                    <span className="text-[9px] text-zinc-500 block">凯利建议</span>
                    <span className="font-mono text-indigo-400 font-bold text-sm">{(kellySuggestion * 100).toFixed(0)}%</span>
                </div>
            </div>
        </div>
    );
};

export default PositionHealth;
