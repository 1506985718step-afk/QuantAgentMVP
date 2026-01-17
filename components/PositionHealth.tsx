
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
        <div className="glass-panel rounded-lg p-5 h-full flex flex-col justify-between relative overflow-hidden">
             {/* Glow Effect */}
             <div className={`absolute -right-4 -top-4 w-20 h-20 blur-3xl opacity-20 ${color}`}></div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">持仓健康度</span>
                    <Activity className={`h-4 w-4 ${textCol}`} />
                </div>
                <div className="text-4xl font-bold text-white font-mono tracking-tighter">
                    {score}
                </div>
                <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden mt-3">
                    <div className={`h-full ${color} transition-all duration-1000`} style={{ width: `${score}%` }}></div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-white/5">
                <div>
                    <span className="text-[10px] text-zinc-500 block mb-0.5">仓位占比</span>
                    <span className="font-mono text-zinc-200 font-bold">{(currentExposure * 100).toFixed(0)}%</span>
                </div>
                <div className="text-right">
                    <span className="text-[10px] text-zinc-500 block mb-0.5">凯利建议</span>
                    <span className="font-mono text-indigo-400 font-bold">{(kellySuggestion * 100).toFixed(0)}%</span>
                </div>
            </div>
        </div>
    );
};

export default PositionHealth;
