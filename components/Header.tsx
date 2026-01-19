
import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, BrainCircuit, Server, MonitorSmartphone, LogOut, User as UserIcon, Settings } from 'lucide-react';
import { APP_NAME } from '../constants';
import { authService, UserProfile } from '../services/authService';
import SettingsModal from './SettingsModal';

interface HeaderProps {
    isLiveMode: boolean;
    onToggleMode: () => void;
    onManualNextDay: () => void;
}

const Header: React.FC<HeaderProps> = ({ isLiveMode, onToggleMode, onManualNextDay }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    useEffect(() => {
        authService.fetchMe().then(u => setUser(u));
    }, [isSettingsOpen]); // Refresh user when settings modal closes/updates

    const handleLogout = () => {
        authService.logout();
    };

    return (
        <>
            <header className="sticky top-0 z-50 w-full border-b border-white/5 bg-[#09090b]/80 backdrop-blur-md">
                <div className="relative flex h-14 items-center justify-between px-3 sm:px-6 max-w-[1800px] mx-auto">
                    
                    {/* Brand (Left) */}
                    <div className="flex items-center gap-2 sm:gap-3 shrink-0 z-20">
                        <div className="relative group">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-500 ${isLiveMode ? 'bg-indigo-500 text-white shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]'}`}>
                                <Activity className="h-5 w-5" />
                            </div>
                        </div>
                        <div className="hidden sm:block">
                            <h1 className="text-sm font-bold tracking-tight text-white font-mono">
                                {APP_NAME} <span className="opacity-40 font-normal">PRO</span>
                            </h1>
                        </div>
                    </div>

                    {/* Mode Switcher (Absolute Center) */}
                    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
                        <div className="flex bg-zinc-900/80 p-1 rounded-lg border border-white/10 shadow-sm backdrop-blur-sm">
                            <button
                                onClick={() => !isLiveMode && onToggleMode()}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                                    isLiveMode 
                                    ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-white/10' 
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                                }`}
                            >
                                <Server className="h-3 w-3" />
                                <span>实盘</span>
                            </button>
                            <button
                                onClick={() => isLiveMode && onToggleMode()}
                                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all duration-300 ${
                                    !isLiveMode 
                                    ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-white/10' 
                                    : 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5'
                                }`}
                            >
                                <MonitorSmartphone className="h-3 w-3" />
                                <span>训练</span>
                            </button>
                        </div>
                    </div>

                    {/* Status Items (Right) */}
                    <div className="flex items-center gap-1 sm:gap-4 shrink-0 z-20">
                        <div className="hidden lg:flex items-center gap-2 text-[10px] text-zinc-400 font-mono">
                            <span className={`h-1.5 w-1.5 rounded-full ${isLiveMode ? 'bg-indigo-500 animate-pulse' : 'bg-emerald-500'}`}></span>
                            {isLiveMode ? '网关: 在线' : '网关: 模拟'}
                        </div>

                        <div className="h-4 w-px bg-white/10 hidden sm:block"></div>

                        <div className="flex items-center gap-1 sm:gap-2">
                            {user && (
                                <button 
                                    onClick={() => setIsSettingsOpen(true)}
                                    className="flex items-center gap-2 bg-zinc-800/50 hover:bg-zinc-800 pl-2 pr-2 sm:pr-3 py-1 rounded-full border border-white/5 transition-all group min-w-0"
                                >
                                    <div className="p-1 rounded-full bg-indigo-500/10 group-hover:bg-indigo-500/20 shrink-0">
                                        <UserIcon className="h-3 w-3 text-indigo-400" />
                                    </div>
                                    <span className="text-[10px] font-bold text-zinc-300 truncate hidden md:block max-w-[80px]">
                                        {user.full_name || user.username}
                                    </span>
                                    {user.broker_accounts && user.broker_accounts.length > 0 && (
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" title="已绑定券商"></span>
                                    )}
                                </button>
                            )}
                            
                            <button 
                                onClick={() => setIsSettingsOpen(true)}
                                className="p-2 hover:bg-white/10 rounded-md text-zinc-500 hover:text-white transition-colors"
                                title="设置"
                            >
                                <Settings className="h-4 w-4" />
                            </button>

                            <button 
                                onClick={handleLogout}
                                className="p-2 hover:bg-white/10 rounded-md text-zinc-500 hover:text-rose-400 transition-colors"
                                title="退出登录"
                            >
                                <LogOut className="h-4 w-4" />
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
        </>
    );
};

export default Header;
