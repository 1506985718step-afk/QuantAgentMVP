
import React, { useState } from 'react';
import { Play, Pause, SkipForward, Clock, Map, TrendingUp, Eye, ChevronDown } from 'lucide-react';
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
    
    // Retrieve performance data
    const perf = (status as any).performance || { myReturn: 0, indexReturn: 0, alpha: 0 };
    const currentScenario = SCENARIOS.find(s => s.date === status.currentDate) || SCENARIOS[0];

    const handleScenarioSelect = (scenario: typeof SCENARIOS[0]) => {
        if (status.isPlaying) onPause();
        (backend as any).jumpToDate(scenario.date);
        setIsMenuOpen(false);
    };

    const cycleSpeed = () => {
        const speeds = [1, 5, 20];
        const idx = speeds.indexOf(status.speed);
        const next = speeds[(idx + 1) % speeds.length];
        onSpeedChange(next);
    };

    return (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-3 w-[94%] max-w-xl pointer-events-none transition-all duration-300">
            
            {/* 1. Stats & Insights Layer */}
            <div className="pointer-events-auto w-full flex flex-col items-center gap-2">
                 
                 {/* God Mode Insight (Conditional) */}
                 {showGodMode && !status.isPlaying && (
                     <div className="w-full bg-indigo-950/90 backdrop-blur-xl border border-indigo-500/30 rounded-xl p-3 text-xs text-indigo-100 shadow-2xl animate-in slide-in-from-bottom-2 ring-1 ring-indigo-500/50">
                         <div className="flex items-start gap-3">
                             <div className="bg-indigo-500/20 p-1.5 rounded-lg shrink-0 mt-0.5">
                                <TrendingUp className="h-4 w-4 text-indigo-300" />
                             </div>
                             <div>
                                 <h4 className="font-bold text-indigo-200 mb-1">未来 5 日走势剧透</h4>
                                 <p className="opacity-90 leading-relaxed text-[11px] text-indigo-100/80">
                                     AI 预测当前处于<span className="font-bold text-white border-b border-indigo-400/50 mx-1">震荡洗盘</span>阶段。
                                     主力资金持续吸筹，预计 3 个交易日后开启主升浪，建议持股待涨。
                                 </p>
                             </div>
                         </div>
                     </div>
                 )}

                 <div className="flex items-stretch justify-between w-full gap-2">
                     {/* Stats Grid */}
                     <div className="flex-1 bg-zinc-950/90 backdrop-blur-xl rounded-xl border border-white/10 p-1 shadow-2xl grid grid-cols-3 divide-x divide-white/5 ring-1 ring-black/50">
                        <div className="px-1 py-1 flex flex-col justify-center items-center gap-0.5">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider scale-90">收益率</span>
                            <span className={`text-xs sm:text-sm font-mono font-bold tracking-tight ${perf.myReturn >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {perf.myReturn > 0 ? '+' : ''}{perf.myReturn.toFixed(1)}%
                            </span>
                        </div>
                        <div className="px-1 py-1 flex flex-col justify-center items-center gap-0.5">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider scale-90">基准</span>
                            <span className={`text-xs sm:text-sm font-mono font-bold tracking-tight ${perf.indexReturn >= 0 ? 'text-zinc-400' : 'text-zinc-500'}`}>
                                {perf.indexReturn > 0 ? '+' : ''}{perf.indexReturn.toFixed(1)}%
                            </span>
                        </div>
                        <div className="px-1 py-1 flex flex-col justify-center items-center gap-0.5">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider scale-90 flex items-center gap-0.5">
                                Alpha
                            </span>
                            <span className={`text-xs sm:text-sm font-mono font-bold tracking-tight ${perf.alpha >= 0 ? 'text-indigo-400' : 'text-amber-500'}`}>
                                {perf.alpha > 0 ? '+' : ''}{perf.alpha.toFixed(1)}%
                            </span>
                        </div>
                     </div>

                     {/* God Mode Toggle */}
                     {!status.isPlaying && (
                         <button 
                            onClick={() => setShowGodMode(!showGodMode)}
                            className={`w-12 shrink-0 rounded-xl flex items-center justify-center border shadow-lg transition-all active:scale-95 ${
                                showGodMode 
                                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 ring-1 ring-indigo-500/50' 
                                : 'bg-zinc-950/90 border-white/10 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900 ring-1 ring-black/50'
                            }`}
                         >
                            <Eye className="h-5 w-5" />
                         </button>
                     )}
                 </div>
            </div>

            {/* 2. Main Control Bar */}
             <div className="pointer-events-auto w-full p-2 bg-zinc-950/90 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl ring-1 ring-black/50 flex items-center gap-2 sm:gap-3">
                
                {/* Scenario / Date Display */}
                <div className="relative flex-1 min-w-0">
                    <button 
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="w-full flex items-center gap-3 p-1.5 hover:bg-white/5 rounded-xl transition-colors text-left group"
                    >
                        <div className="h-9 w-9 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center shrink-0 group-hover:bg-zinc-800 transition-colors shadow-inner">
                            <Map className="h-4 w-4 text-zinc-400 group-hover:text-zinc-200" />
                        </div>
                        <div className="flex-1 min-w-0">
                             <div className="flex items-center gap-1">
                                <span className="text-xs font-bold text-zinc-200 truncate">{currentScenario?.name}</span>
                                <ChevronDown className={`h-3 w-3 text-zinc-600 transition-transform duration-300 ${isMenuOpen ? 'rotate-180' : ''}`} />
                             </div>
                             <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-mono mt-0.5">
                                <Clock className="h-2.5 w-2.5" />
                                <span>{status.currentDate}</span>
                             </div>
                        </div>
                    </button>

                    {/* Scenario Menu */}
                    {isMenuOpen && (
                        <div className="absolute bottom-full left-0 mb-4 w-72 bg-[#09090b] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-2 fade-in zoom-in-95 origin-bottom-left z-50 ring-1 ring-white/10">
                            <div className="p-3 bg-zinc-900/50 border-b border-zinc-800 text-[10px] text-zinc-500 font-bold uppercase tracking-wider flex items-center justify-between">
                                <span>历史行情剧本</span>
                                <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded text-[9px]">Select</span>
                            </div>
                            <div className="max-h-64 overflow-y-auto custom-scrollbar p-1.5 space-y-1">
                                {SCENARIOS.map(s => (
                                    <button
                                        key={s.id}
                                        onClick={() => handleScenarioSelect(s)}
                                        className={`w-full text-left px-3 py-3 rounded-xl transition-all group border ${
                                            currentScenario?.id === s.id 
                                            ? 'bg-indigo-500/10 border-indigo-500/30' 
                                            : 'hover:bg-zinc-900 border-transparent hover:border-zinc-800'
                                        }`}
                                    >
                                        <div className="flex justify-between items-center mb-1">
                                            <span className={`text-xs font-bold transition-colors ${
                                                currentScenario?.id === s.id ? 'text-indigo-400' : 'text-zinc-300 group-hover:text-white'
                                            }`}>{s.name}</span>
                                            <span className="text-[10px] font-mono text-zinc-600">{s.date}</span>
                                        </div>
                                        <div className="text-[10px] text-zinc-500 line-clamp-2 leading-relaxed opacity-80 group-hover:opacity-100">{s.desc}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Vertical Divider */}
                <div className="w-px h-8 bg-white/10"></div>

                {/* Controls Group */}
                <div className="flex items-center gap-2">
                     
                     {/* Play / Pause */}
                     <button 
                        onClick={status.isPlaying ? onPause : onPlay}
                        className={`h-10 w-14 rounded-xl flex items-center justify-center transition-all active:scale-95 shadow-lg border border-transparent ${
                            status.isPlaying 
                            ? 'bg-amber-500 text-zinc-950 hover:bg-amber-400 shadow-amber-900/20' 
                            : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 shadow-emerald-900/20'
                        }`}
                    >
                        {status.isPlaying ? <Pause className="h-5 w-5 fill-current" /> : <Play className="h-5 w-5 fill-current ml-1" />}
                    </button>

                    {/* Next Step */}
                    <button 
                        onClick={onNextStep}
                        disabled={status.isPlaying}
                        className="h-10 w-10 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 flex items-center justify-center hover:bg-zinc-800 hover:text-zinc-200 transition-all active:scale-95 disabled:opacity-30 disabled:hover:bg-zinc-900"
                    >
                        <SkipForward className="h-4 w-4" />
                    </button>

                    {/* Speed Toggle */}
                    <button
                        onClick={cycleSpeed}
                        className="h-10 w-10 rounded-xl bg-zinc-900 border border-white/5 text-xs font-bold font-mono text-zinc-400 flex items-center justify-center hover:bg-zinc-800 hover:text-white transition-all active:scale-95"
                    >
                        {status.speed}x
                    </button>
                </div>
            </div>
            
            {/* Minimal Progress Bar */}
            <div className="w-full h-1 bg-zinc-900 rounded-full overflow-hidden flex ring-1 ring-white/5">
                <div 
                    className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500 transition-all duration-300 shadow-[0_0_10px_rgba(16,185,129,0.5)]" 
                    style={{ width: `${status.progress}%` }}
                ></div>
            </div>
        </div>
    );
};

export default BacktestControls;
