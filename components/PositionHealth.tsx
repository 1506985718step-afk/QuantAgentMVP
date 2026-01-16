import React from 'react';
import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface PositionHealthProps {
    score?: number; // 0-100
    kellySuggestion?: number; // 0.0 - 1.0 (e.g. 0.4 for 40%)
    currentExposure: number; // 0.0 - 1.0
}

const PositionHealth: React.FC<PositionHealthProps> = ({ score = 100, kellySuggestion = 0.3, currentExposure }) => {
    
    // Determine color based on score
    let color = 'bg-emerald-500';
    let textColor = 'text-emerald-500';
    let icon = <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
    
    if (score < 60) {
        color = 'bg-rose-500';
        textColor = 'text-rose-500';
        icon = <AlertTriangle className="h-4 w-4 text-rose-500" />;
    } else if (score < 80) {
        color = 'bg-amber-500';
        textColor = 'text-amber-500';
        icon = <Activity className="h-4 w-4 text-amber-500" />;
    }

    return (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm relative overflow-hidden h-full flex flex-col justify-between transition-all hover:border-slate-700">
            <div>
                <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-slate-400">仓位健康度 (Kelly)</span>
                    {icon}
                </div>
                
                <div className="flex items-end gap-2 mb-3">
                    <span className={`text-3xl font-bold ${textColor}`}>{score}</span>
                    <span className="text-xs text-slate-500 mb-1">/ 100</span>
                </div>

                {/* Progress Bar */}
                <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden mb-3">
                    <div 
                        className={`h-full ${color} transition-all duration-500`} 
                        style={{ width: `${score}%` }}
                    ></div>
                </div>
            </div>

            {/* Details */}
            <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <span className="block text-slate-500 mb-0.5">当前仓位</span>
                    <span className="font-mono text-slate-200 font-bold">{(currentExposure * 100).toFixed(1)}%</span>
                </div>
                <div className="bg-slate-950/50 p-2 rounded border border-slate-800/50">
                    <span className="block text-slate-500 mb-0.5">凯利建议</span>
                    <span className="font-mono text-emerald-400 font-bold">{(kellySuggestion * 100).toFixed(1)}%</span>
                </div>
            </div>
        </div>
    );
};

export default PositionHealth;