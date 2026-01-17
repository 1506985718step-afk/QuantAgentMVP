
import React, { useState } from 'react';
import { Play, Pause, SkipForward, Clock, Map, TrendingUp, Eye, Target, AlertTriangle, ChevronDown } from 'lucide-react';
import { SimulationStatus } from '../types';
import { SCENARIOS } from '../services/historicalData';
import { backend } from '../services/MockBackend';

interface BacktestControlsProps {
    status: SimulationStatus;
    onPlay: () => void;
    onPause: () => void;
    onSpeedChange: (speed: number) => void;
    onNextStep: () => void;
}

const BacktestControls: React.FC<BacktestControlsProps> = ({ status, onPlay, onPause, onSpeedChange, onNextStep }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [showGodMode, setShowGodMode] = useState(false);
    
    // Retrieve performance data (injected by MockBackend)
    const perf = (status as any).performance || { myReturn: 0, indexReturn: 0, alpha: 0 };
    const currentScenario = SCENARIOS.find(s => s.date === status.currentDate) || SCENARIOS[0];

    const handleScenarioSelect = (scenario: typeof SCENARIOS[0]) => {
        // Stop playback
        if (status.isPlaying) onPause();
        // Trigger jump (Simulated)
        (backend as any).jumpToDate(scenario.date);
        setIsMenuOpen(false);
        // Alert user (Mock feedback)
        alert(`已加载剧本：${scenario.name}\n时间已重置为 ${scenario.date}。\n初始资金已重置。`);
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-3 w-full max-w-2xl px-4 pointer-events-none">
            
            {/* 1. Alpha Dashboard (Floating above controls) */}
            <div className="pointer-events-auto flex gap-4 mb-2">
                 <div className="bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/50 p-2 flex items-center gap-3 shadow-xl">
                    <div className="flex flex-col px-2 border-r border-slate-700/50">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">我的收益</span>
                        <span className={`text-sm font-mono font-bold ${perf.myReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {perf.myReturn > 0 ? '+' : ''}{perf.myReturn.toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex flex-col px-2 border-r border-slate-700/50">
                        <span className="text-[9px] text-slate-500 font-bold uppercase">基准 (Index)</span>
                        <span className={`text-sm font-mono font-bold ${perf.indexReturn >= 0 ? 'text-zinc-300' : 'text-zinc-400'}`}>
                            {perf.indexReturn > 0 ? '+' : ''}{perf.indexReturn.toFixed(2)}%
                        </span>
                    </div>
                    <div className="flex flex-col px-2">
                        <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
                            Alpha <Target className="h-2 w-2" />
                        </span>
                        <span className={`text-sm font-mono font-bold ${perf.alpha >= 0 ? 'text-indigo-400' : 'text-amber-500'}`}>
                            {perf.alpha > 0 ? '+' : ''}{perf.alpha.toFixed(2)}%
                        </span>
                    </div>
                 </div>

                 {/* God Mode Button */}
                 {!status.isPlaying && (
                     <button 
                        onClick={() => setShowGodMode(!showGodMode)}
                        className={`pointer-events-auto bg-slate-900/90 backdrop-blur-md rounded-lg border border-slate-700/50 px-3 flex flex-col justify-center items-center shadow-xl transition-all ${showGodMode ? 'border-indigo-500 ring-1 ring-indigo-500' : 'hover:bg-slate-800'}`}
                        title="查看未来走势 (God Mode)"
                     >
                        <Eye className={`h-4 w-4 ${showGodMode ? 'text-indigo-400' : 'text-slate-400'}`} />
                        <span className="text-[9px] font-bold text-slate-500 mt-0.5">上帝视角</span>
                     </button>
                 )}
            </div>

            {/* God Mode Insight Panel */}
            {showGodMode && !status.isPlaying && (
                 <div className="pointer-events-auto w-full bg-indigo-950/80 backdrop-blur-xl border border-indigo-500/30 rounded-lg p-3 text-xs text-indigo-100 mb-2 shadow-2xl animate-in slide-in-from-bottom-2">
                     <div className="flex items-start gap-2">
                         <div className="bg-indigo-500/20 p-1.5 rounded">
                            <TrendingUp className="h-4 w-4 text-indigo-300" />
                         </div>
                         <div>
                             <h4 className="font-bold text-indigo-200 mb-1">未来 5 日剧透 (AI 预测)</h4>
                             <p className="opacity-80 leading-relaxed">
                                 当前处于<span className="font-bold text-white"> 震荡洗盘 </span>阶段。
                                 主力资金正在吸筹，预计 3 天后会有一次假摔（诱空），随后开启主升浪。
                                 建议：逢低吸纳，不要被短期波动洗出局。
                             </p>
                         </div>
                     </div>
                 </div>
            )}

            {/* 2. Main Control Bar */}
             <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-slate-700/50 bg-slate-900/90 p-2 shadow-2xl backdrop-blur-xl ring-1 ring-white/10 w-full relative">
                
                {/* Scenario Picker */}
                <div className="relative border-r border-slate-700/50 pr-2 mr-1">
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="flex flex-col justify-center px-3 py-1 hover:bg-slate-800 rounded transition-colors text-left min-w-[140px]"
                    >
                        <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                            <Map className="h-3 w-3" />
                            训练剧本
                        </span>
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-200 truncate max-w-[100px]">{currentScenario?.name || '自定义回放'}</span>
                            <ChevronDown className="h-3 w-3 text-slate-500" />
                        </div>
                    </button>

                    {isMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-3 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 origin-bottom-left">
                            <div className="p-2 bg-slate-950/50 border-b border-slate-800 text-[10px] text-slate-500 font-bold uppercase">
                                选择历史行情
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                {SCENARIOS.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleScenarioSelect(s)}
                                        className="w-full text-left px-4 py-3 hover:bg-slate-800 border-b border-slate-800/50 last:border-0 transition-colors group"
                                    >
                                        <div className="flex justify-between items-center mb-0.5">
                                            <span className="text-sm font-bold text-slate-200 group-hover:text-indigo-400">{s.name}</span>
                                            <span className="text-[10px] font-mono text-slate-500">{s.date}</span>
                                        </div>
                                        <div className="text-xs text-slate-500 line-clamp-1">{s.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Progress Info */}
                <div className="hidden sm:flex flex-col justify-center px-2 min-w-[100px]">
                    <span className="text-[9px] text-slate-500 font-bold uppercase flex items-center gap-1">
                        <Clock className="h-3 w-3" /> 当前时间
                    </span>
                    <span className="text-sm font-bold text-slate-200 font-mono tracking-wide">{status.currentDate}</span>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center gap-1.5 ml-auto">
                     <button 
                        onClick={status.isPlaying ? onPause : onPlay}
                        className={`flex h-10 w-12 items-center justify-center rounded-xl transition-all shadow-lg active:scale-95 ${
                            status.isPlaying 
                            ? 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-amber-500/20' 
                            : 'bg-emerald-500 text-slate-950 hover:bg-emerald-400 shadow-emerald-500/20'
                        }`}
                        title={status.isPlaying ? "暂停回放" : "开始回放"}
                    >
                        {status.isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-0.5" />}
                    </button>

                    <button 
                        onClick={onNextStep}
                        disabled={status.isPlaying}
                        className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-50 disabled:hover:bg-slate-800 transition-colors border border-slate-700/50"
                        title="单步执行 (+1 Day)"
                    >
                        <SkipForward className="h-5 w-5" />
                    </button>
                    
                    <div className="h-8 w-px bg-slate-700/50 mx-1"></div>

                    {/* Speed Toggles */}
                    <div className="flex bg-slate-950/50 rounded-lg p-1 border border-slate-800/50">
                        {[1, 5, 20].map((s) => (
                            <button
                                key={s}
                                onClick={() => onSpeedChange(s)}
                                className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                                    status.speed === s 
                                    ? 'bg-indigo-600 text-white shadow-md' 
                                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                {s}x
                            </button>
                        ))}
                    </div>
                </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-slate-800/80 rounded-full overflow-hidden shadow-lg border border-slate-900/50 backdrop-blur-sm">
                <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                    style={{ width: `${status.progress}%` }}
                ></div>
            </div>
        </div>
    );
};

export default BacktestControls;
