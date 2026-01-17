
import React, { useState, useEffect, useRef } from 'react';
import { Lock, Check, X, Pencil } from 'lucide-react';
import { AccountSummary as AccountSummaryType } from '../types';

interface AccountSummaryProps {
    data: AccountSummaryType;
    onUpdateEquity: (amount: number) => void;
}

const AccountSummary: React.FC<AccountSummaryProps> = ({ data, onUpdateEquity }) => {
    const isPositive = (data.day_pnl || 0) >= 0;
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(data.total_equity?.toString() || "0");
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isEditing) setInputValue(data.total_equity?.toString() || "0");
    }, [data.total_equity, isEditing]);

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
        } else {
            // Revert if invalid
            setInputValue(data.total_equity?.toString() || "0");
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

    // Compact Card styling
    const cardClass = "glass-card rounded-lg p-3 sm:p-4 flex flex-col justify-between h-full min-h-[85px] transition-all hover:border-white/10 group relative overflow-hidden";
    const labelClass = "text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-0.5 flex items-center gap-1.5 truncate";

    return (
        <>
            {/* Total Equity */}
            <div className={`${cardClass} col-span-1 border-l-2 border-l-indigo-500`}>
                <div className="flex justify-between items-start">
                    <div className={labelClass}>
                        总资产 (Equity)
                    </div>
                    {!isEditing && (
                        <button 
                            onClick={() => setIsEditing(true)}
                            className="text-zinc-600 hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100 scale-75"
                            title="修改初始资金"
                        >
                            <Pencil className="h-3 w-3" />
                        </button>
                    )}
                </div>
                
                {isEditing ? (
                    <div className="flex flex-col mt-auto w-full relative">
                        <div className="flex items-baseline gap-1">
                             <span className="text-zinc-500 font-mono text-lg">¥</span>
                             <input 
                                ref={inputRef}
                                type="number" 
                                value={inputValue}
                                onChange={(e) => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                onBlur={handleSave}
                                className="w-full bg-zinc-900/50 border border-indigo-500/50 rounded px-2 py-0.5 text-lg font-bold text-white font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500/50"
                            />
                        </div>
                        <div className="text-[9px] text-zinc-500 mt-1 flex gap-2">
                            <span>Enter 保存</span>
                            <span>Esc 取消</span>
                        </div>
                    </div>
                ) : (
                    <div 
                        onClick={() => setIsEditing(true)} 
                        className="mt-auto cursor-pointer"
                    >
                        <div className="text-xl sm:text-2xl font-bold text-zinc-100 font-mono tracking-tight tabular-nums truncate hover:text-indigo-200 transition-colors">
                            <span className="text-zinc-500 text-base mr-1 align-baseline">¥</span>
                            {(data.total_equity || 0).toLocaleString()}
                        </div>
                    </div>
                )}
            </div>

            {/* Buying Power */}
            <div className={cardClass}>
                <div className={labelClass}>可用资金 (Cash)</div>
                <div className="mt-auto truncate">
                    <div className="text-lg sm:text-xl font-bold text-zinc-300 font-mono tabular-nums truncate">
                        <span className="text-zinc-600 text-sm mr-1">¥</span>
                        {(data.available_cash || 0).toLocaleString()}
                    </div>
                </div>
            </div>

            {/* PnL & Risk */}
            <div className={cardClass}>
                <div className="flex justify-between items-start h-full">
                    <div className="flex flex-col justify-between h-full">
                        <div className={labelClass}>当日盈亏 (Day P&L)</div>
                        <div>
                            <div className={`text-lg sm:text-xl font-bold font-mono tabular-nums leading-none ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {isPositive ? '+' : ''}{(data.day_pnl || 0).toLocaleString()}
                            </div>
                            <div className={`text-[10px] font-mono mt-1 ${isPositive ? 'text-emerald-500/60' : 'text-rose-500/60'}`}>
                                {isPositive ? '+' : ''}{data.day_pnl_pct || 0}%
                            </div>
                        </div>
                    </div>
                    
                    <div className="text-right flex flex-col justify-between h-full items-end">
                         <div className={labelClass + " justify-end"}>风控额度</div>
                         <div>
                             <div className="flex items-center justify-end gap-1 mb-1">
                                 {[...Array(5)].map((_, i) => (
                                     <div 
                                        key={i} 
                                        className={`h-1.5 w-1.5 sm:w-2 rounded-sm ${i < (data.filled_buys_today || 0) ? 'bg-rose-500' : 'bg-zinc-800'}`}
                                     ></div>
                                 ))}
                             </div>
                             <div className="text-[9px] text-zinc-500 font-mono">
                                 {data.filled_buys_today}/5 笔
                             </div>
                         </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AccountSummary;
