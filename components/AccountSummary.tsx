import React, { useState, useEffect, useRef } from 'react';
import { Wallet, TrendingUp, TrendingDown, DollarSign, ShieldCheck, Pencil, Check, X } from 'lucide-react';
import { AccountSummary as AccountSummaryType } from '../types';

interface AccountSummaryProps {
    data: AccountSummaryType;
    onUpdateEquity: (amount: number) => void;
}

const AccountSummary: React.FC<AccountSummaryProps> = ({ data, onUpdateEquity }) => {
    const isPositive = (data.day_pnl || 0) >= 0;
    const [isEditing, setIsEditing] = useState(false);
    
    // Safe initialization with fallback to "0" if undefined
    const [inputValue, setInputValue] = useState(data.total_equity?.toString() || "0");
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync when not editing
    useEffect(() => {
        if (!isEditing) {
            setInputValue(data.total_equity?.toString() || "0");
        }
    }, [data.total_equity, isEditing]);

    // Focus input when entering edit mode
    useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isEditing]);

    const handleSave = () => {
        const val = parseFloat(inputValue);
        if (!isNaN(val) && val > 0) {
            onUpdateEquity(val);
            setIsEditing(false);
        }
    };

    const handleCancel = () => {
        setInputValue(data.total_equity?.toString() || "0");
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') handleCancel();
    };

    const cardBaseClass = "rounded-xl border border-slate-800 bg-slate-900 p-5 shadow-sm transition-all hover:border-slate-700 flex flex-col justify-between h-full";

    return (
        <>
            {/* Card 1: Total Equity (Editable) */}
            <div className={`relative overflow-hidden group ${cardBaseClass} ${isEditing ? 'border-emerald-500/50 ring-1 ring-emerald-500/20' : ''}`}>
                
                {/* Background Decoration */}
                <div className="absolute top-0 right-0 p-3 opacity-[0.03] pointer-events-none">
                    <Wallet className="w-24 h-24 text-slate-100" />
                </div>

                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div className="flex items-center justify-between pb-2">
                        <span className="text-sm font-medium text-slate-400">账户总资产</span>
                        {!isEditing && (
                             <button 
                                onClick={() => setIsEditing(true)}
                                className="opacity-0 group-hover:opacity-100 transition-all p-1.5 hover:bg-slate-800 rounded-md text-slate-500 hover:text-emerald-400"
                                title="调整资金"
                             >
                                 <Pencil className="h-3.5 w-3.5" />
                             </button>
                         )}
                    </div>
                    
                    {isEditing ? (
                        <div className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                            <div className="relative flex-1">
                                 <span className="absolute left-0 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-xl">¥</span>
                                 <input 
                                    ref={inputRef}
                                    type="number" 
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    className="w-full bg-transparent border-b-2 border-emerald-500/50 px-0 pl-5 py-1 text-2xl font-bold text-emerald-400 placeholder-slate-700 focus:outline-none focus:border-emerald-400 transition-colors"
                                />
                            </div>
                            <div className="flex flex-col gap-1">
                                <button onClick={handleSave} className="p-1 text-emerald-500 hover:bg-emerald-500/20 rounded-md transition-colors" title="确认 (Enter)">
                                    <Check className="h-4 w-4" />
                                </button>
                                <button onClick={handleCancel} className="p-1 text-slate-500 hover:bg-rose-500/20 hover:text-rose-500 rounded-md transition-colors" title="取消 (Esc)">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="flex items-baseline gap-1 cursor-text" onClick={() => setIsEditing(true)}>
                            <span className="text-2xl font-bold text-slate-100 group-hover:text-emerald-50 transition-colors truncate">
                                ¥ {(data.total_equity || 0).toLocaleString()}
                            </span>
                        </div>
                    )}
                    
                    <div className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${isEditing ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                        {isEditing ? '正在调整资金...' : '模拟账户'}
                    </div>
                </div>
            </div>

            {/* Card 2: Buying Power */}
            <div className={cardBaseClass}>
                <div>
                    <div className="flex items-center justify-between pb-2">
                        <span className="text-sm font-medium text-slate-400">可用资金</span>
                        <DollarSign className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-bold text-slate-100 truncate">¥ {(data.available_cash || 0).toLocaleString()}</div>
                </div>
                <div className="text-xs text-slate-500 mt-2">当前购买力</div>
            </div>

            {/* Card 3: Day PnL */}
            <div className={cardBaseClass}>
                <div>
                    <div className="flex items-center justify-between pb-2">
                        <span className="text-sm font-medium text-slate-400">当日盈亏</span>
                        {isPositive ? (
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                        ) : (
                            <TrendingDown className="h-4 w-4 text-rose-500" />
                        )}
                    </div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <span className={`text-2xl font-bold ${isPositive ? 'text-emerald-500' : 'text-rose-500'}`}>
                            {isPositive ? '+' : ''}{(data.day_pnl || 0).toLocaleString()}
                        </span>
                        <span className={`text-sm font-medium ${isPositive ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                            ({isPositive ? '+' : ''}{data.day_pnl_pct || 0}%)
                        </span>
                    </div>
                </div>
                <div className="text-xs text-slate-500 mt-2">含持仓浮动盈亏</div>
            </div>

            {/* Card 4: Risk / Guard Status */}
            <div className={`${cardBaseClass} relative overflow-hidden group`}>
                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-15 transition-opacity pointer-events-none">
                    <ShieldCheck className="w-20 h-20 text-emerald-500" />
                </div>
                <div className="relative z-10 flex flex-col h-full justify-between">
                    <div className="flex items-center justify-between pb-2">
                        <span className="text-sm font-medium text-slate-400">风控状态</span>
                        <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-baseline">
                             <span className="text-2xl font-bold text-slate-100">{data.filled_buys_today || 0}</span>
                             <span className="text-sm text-slate-500 ml-1">/ 5</span>
                        </div>
                        <div className="h-6 w-px bg-slate-800 mx-1"></div>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 whitespace-nowrap">
                            TradeGuard™
                        </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-2">今日买入次数监控中</div>
                </div>
            </div>
        </>
    );
};

export default AccountSummary;