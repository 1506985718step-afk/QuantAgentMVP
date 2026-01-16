
import React from 'react';
import { Play, Pause, FastForward, Rewind, SkipForward, Clock } from 'lucide-react';
import { SimulationStatus } from '../types';

interface BacktestControlsProps {
    status: SimulationStatus;
    onPlay: () => void;
    onPause: () => void;
    onSpeedChange: (speed: number) => void;
    onNextStep: () => void;
}

const BacktestControls: React.FC<BacktestControlsProps> = ({ status, onPlay, onPause, onSpeedChange, onNextStep }) => {
    return (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
             <div className="flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-900/90 p-2 shadow-2xl backdrop-blur-md">
                {/* Info Display */}
                <div className="hidden md:flex flex-col px-3 border-r border-slate-700/50 min-w-[120px]">
                    <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        策略训练模式
                    </span>
                    <span className="text-sm font-bold text-slate-200 font-mono">{status.currentDate}</span>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1">
                     <button 
                        onClick={status.isPlaying ? onPause : onPlay}
                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all ${
                            status.isPlaying 
                            ? 'bg-amber-500 text-slate-900 hover:bg-amber-400' 
                            : 'bg-emerald-500 text-slate-900 hover:bg-emerald-400'
                        }`}
                        title={status.isPlaying ? "暂停回放" : "开始回放"}
                    >
                        {status.isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                    </button>

                    <button 
                        onClick={onNextStep}
                        disabled={status.isPlaying}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50 transition-colors"
                        title="单步执行 (+1 Day)"
                    >
                        <SkipForward className="h-5 w-5" />
                    </button>
                    
                    <div className="h-8 w-px bg-slate-700/50 mx-1"></div>

                    {/* Speed Toggles */}
                    <div className="flex bg-slate-800 rounded-lg p-1">
                        {[1, 5, 20].map((s) => (
                            <button
                                key={s}
                                onClick={() => onSpeedChange(s)}
                                className={`px-2 py-1 rounded text-xs font-bold transition-all ${
                                    status.speed === s 
                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full max-w-[300px] h-1.5 bg-slate-800 rounded-full overflow-hidden shadow-lg border border-slate-900">
                <div 
                    className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 transition-all duration-300" 
                    style={{ width: `${status.progress}%` }}
                ></div>
            </div>
        </div>
    );
};

export default BacktestControls;
