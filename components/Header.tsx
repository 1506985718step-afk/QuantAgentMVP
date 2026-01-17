
import React from 'react';
import { Activity, ShieldCheck, BrainCircuit, Server, MonitorSmartphone, PlayCircle, Zap } from 'lucide-react';
import { APP_NAME } from '../constants';

interface HeaderProps {
    isLiveMode: boolean;
    onToggleMode: () => void;
    onManualNextDay: () => void;
}

const Header: React.FC<HeaderProps> = ({ isLiveMode, onToggleMode, onManualNextDay }) => {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md">
            <div className="flex h-14 items-center justify-between px-4 sm:px-6 max-w-[1800px] mx-auto">
                
                {/* Brand */}
                <div className="flex items-center gap-3">
                    <div className="relative group">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-500 ${isLiveMode ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'}`}>
                            <Activity className="h-5 w-5" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-sm font-bold tracking-tight text-white font-mono">
                            {APP_NAME} <span className="opacity-40 font-normal">PRO</span>
                        </h1>
                    </div>
                </div>

                {/* Mode Switcher */}
                <div className="hidden md:flex bg-zinc-900/50 p-0.5 rounded-lg border border-white/5">
                    <button
                        onClick={() => !isLiveMode && onToggleMode()}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                            isLiveMode 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        <Server className="h-3 w-3" />
                        实盘 (Live)
                    </button>
                    <button
                        onClick={() => isLiveMode && onToggleMode()}
                        className={`flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                            !isLiveMode 
                            ? 'bg-emerald-600 text-white shadow-sm' 
                            : 'text-zinc-500 hover:text-zinc-300'
                        }`}
                    >
                        <MonitorSmartphone className="h-3 w-3" />
                        训练 (Train)
                    </button>
                </div>

                {/* Status Items */}
                <div className="flex items-center gap-4">
                    <div className="hidden lg:flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                        <span className={`h-1.5 w-1.5 rounded-full ${isLiveMode ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                        {isLiveMode ? '网关: 在线' : '网关: 模拟'}
                    </div>

                    <div className="h-4 w-px bg-white/10 hidden sm:block"></div>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 bg-indigo-500/10 px-2 py-1 rounded border border-indigo-500/20 text-[10px] font-bold text-indigo-400">
                            <BrainCircuit className="h-3 w-3" />
                            <span>DEEPSEEK</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/20 text-[10px] font-bold text-emerald-400">
                            <ShieldCheck className="h-3 w-3" />
                            <span>GUARD</span>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
