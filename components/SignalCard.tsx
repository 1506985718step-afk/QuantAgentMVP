
import React, { useState, useEffect } from 'react';
import { X, Check, Target, Zap, Clock, TrendingUp } from 'lucide-react';
import { Side, TradeIntent } from '../types';

interface SignalCardProps {
    intent: TradeIntent;
    onApprove: (id: string, price: number) => void;
    onReject: (id: string) => void;
}

const SignalCard: React.FC<SignalCardProps> = ({ intent, onApprove, onReject }) => {
    const [priceInput, setPriceInput] = useState(intent.price?.toString() || "0");
    useEffect(() => { setPriceInput(intent.price?.toString() || "0"); }, [intent.price]);

    const isBuy = intent.side === Side.BUY;
    const accentColor = isBuy ? 'emerald' : intent.intent_type.includes('PROFIT') ? 'indigo' : 'rose';
    
    const colors = {
        emerald: { border: 'border-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500' },
        indigo: { border: 'border-indigo-500', text: 'text-indigo-400', bg: 'bg-indigo-500' },
        rose: { border: 'border-rose-500', text: 'text-rose-400', bg: 'bg-rose-500' }
    }[accentColor];

    const sideText = isBuy ? '买入' : '卖出';

    return (
        <div className={`glass-card rounded-lg border-l-2 ${colors?.border} p-0 overflow-hidden flex flex-col h-full shadow-sm`}>
            {/* Top Strip */}
            <div className="px-4 py-3 border-b border-white/5 bg-white/[0.02] flex justify-between items-center gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${colors?.bg} text-[#09090b] tracking-wider shrink-0`}>
                        {sideText}
                    </span>
                    <span className="font-mono text-sm font-bold text-white shrink-0">{intent.symbol}</span>
                    <span className="text-sm text-zinc-400 font-medium truncate">{intent.name}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-mono shrink-0">
                    <Clock className="h-3 w-3" />
                    {intent.timestamp.split('T')[1].slice(0, 5)}
                </div>
            </div>

            {/* Main Content */}
            <div className="p-4 flex-1 flex flex-col gap-4">
                {/* Inputs Row */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold block mb-1">限价 (Limit)</label>
                        <div className="relative group">
                            <span className="absolute left-0 bottom-1.5 text-zinc-500 text-sm">¥</span>
                            <input 
                                type="number" 
                                value={priceInput}
                                onChange={(e) => setPriceInput(e.target.value)}
                                className="w-full bg-transparent border-b border-zinc-700 text-lg font-bold font-mono text-white focus:border-white focus:outline-none pl-4 pb-1 transition-colors"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-zinc-500 font-bold block mb-1">数量 (Qty)</label>
                        <div className="text-lg font-bold font-mono text-zinc-200 border-b border-transparent pb-1">
                            {intent.qty} <span className="text-xs text-zinc-600 font-sans">股</span>
                        </div>
                    </div>
                </div>

                {/* AI Reason */}
                <div className="bg-[#050505]/50 p-3 rounded border border-white/5 text-xs text-zinc-400 leading-relaxed relative flex-1">
                    <Zap className="h-3 w-3 text-indigo-500 absolute top-3 left-3" />
                    <div className="pl-6 line-clamp-3">
                        {intent.reason}
                    </div>
                </div>

                {/* Stops Tags */}
                {(intent.stop_loss || intent.take_profit) && (
                    <div className="flex flex-wrap gap-2">
                        {intent.take_profit && (
                            <div className="flex items-center gap-1 text-[10px] text-indigo-400 bg-indigo-500/5 px-2 py-1 rounded border border-indigo-500/10">
                                <Target className="h-3 w-3" /> <span className="font-mono">止盈: {intent.take_profit}</span>
                            </div>
                        )}
                        {intent.stop_loss && (
                             <div className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10">
                                <TrendingUp className="h-3 w-3" /> <span className="font-mono">止损: {intent.stop_loss}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 border-t border-white/5 divide-x divide-white/5 bg-zinc-900/50">
                <button 
                    onClick={() => onReject(intent.intent_id)}
                    className="py-3 px-4 text-zinc-400 hover:text-white hover:bg-white/5 transition-all flex justify-center items-center gap-2 text-xs font-bold uppercase tracking-wide group"
                >
                    <X className="h-3.5 w-3.5 group-hover:text-rose-500 transition-colors" /> 拒绝
                </button>
                <button 
                    onClick={() => onApprove(intent.intent_id, parseFloat(priceInput))}
                    className={`py-3 px-4 ${colors?.text} hover:bg-white/5 transition-all flex justify-center items-center gap-2 text-xs font-bold uppercase tracking-wide`}
                >
                    <Check className="h-3.5 w-3.5" /> 执行
                </button>
            </div>
        </div>
    );
};

export default SignalCard;
