import React, { useState } from 'react';
import { Activity, ShieldCheck, Wifi, Moon, Sun, BrainCircuit } from 'lucide-react';
import { APP_NAME } from '../constants';
import { backend } from '../services/MockBackend';

const Header: React.FC = () => {
    const [isSimulating, setIsSimulating] = useState(false);

    const handleNextDay = () => {
        setIsSimulating(true);
        // Simulate network delay for effect
        setTimeout(() => {
            backend.nextDay();
            setIsSimulating(false);
        }, 500);
    };

    return (
        <header className="sticky top-0 z-50 w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur-md">
            <div className="flex h-16 items-center justify-between px-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
                        <Activity className="h-5 w-5" />
                    </div>
                    <h1 className="text-lg font-bold tracking-tight text-slate-100">
                        {APP_NAME} <span className="text-xs font-normal text-slate-500 ml-2">模拟交易</span>
                    </h1>
                </div>

                <div className="flex items-center gap-6">
                    {/* LLM Indicator */}
                    <div className="hidden lg:flex items-center gap-1.5 rounded bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-400 border border-blue-500/20" title="DeepSeek API 已连接">
                        <BrainCircuit className="h-3 w-3" />
                        <span>DeepSeek V3</span>
                    </div>

                    <div className="hidden md:flex items-center gap-2 text-emerald-400 text-sm">
                        <ShieldCheck className="h-4 w-4" />
                        <span>风控守卫已激活</span>
                    </div>
                    
                    <div className="h-4 w-px bg-slate-800 hidden md:block"></div>

                    <button 
                        onClick={handleNextDay}
                        disabled={isSimulating}
                        className="flex items-center gap-2 rounded-md bg-indigo-600/10 px-3 py-1.5 text-xs font-bold text-indigo-400 hover:bg-indigo-600/20 hover:text-indigo-300 transition-colors disabled:opacity-50"
                        title="重置 T+1 限制，结算持仓"
                    >
                        {isSimulating ? (
                             <Sun className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                             <Moon className="h-3.5 w-3.5" />
                        )}
                        {isSimulating ? '结算中...' : '模拟过夜 (Next Day)'}
                    </button>

                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="font-mono hidden sm:inline">实时仿真</span>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
