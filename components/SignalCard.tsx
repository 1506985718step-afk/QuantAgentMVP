import React, { useState, useEffect } from 'react';
import { ArrowRight, ThumbsUp, XOctagon, Shield, Target, TrendingUp, AlertOctagon, RotateCcw, Pencil, Calendar, Scale, Quote } from 'lucide-react';
import { IntentType, Side, TradeIntent } from '../types';

interface SignalCardProps {
    intent: TradeIntent;
    onApprove: (id: string, price: number) => void;
    onReject: (id: string) => void;
}

const SignalCard: React.FC<SignalCardProps> = ({ intent, onApprove, onReject }) => {
    // Local state for editable price with safe fallback
    const [priceInput, setPriceInput] = useState(intent.price?.toString() || "0");

    // Sync state if intent prop updates
    useEffect(() => {
        setPriceInput(intent.price?.toString() || "0");
    }, [intent.price]);

    // Calculate R:R Ratio (Profit / Risk)
    const calculateRR = () => {
        if (!intent.take_profit || !intent.stop_loss || intent.side !== Side.BUY) return null;
        const profit = intent.take_profit - intent.price;
        const risk = intent.price - intent.stop_loss;
        if (risk <= 0) return null; // Avoid division by zero
        return (profit / risk).toFixed(1);
    };

    const rrRatio = calculateRR();

    // Determine visual style based on intent type
    const getStyle = () => {
        switch (intent.intent_type) {
            case IntentType.BUY:
                return {
                    borderColor: 'border-emerald-500/50',
                    barColor: 'bg-emerald-500',
                    badgeBg: 'bg-emerald-500/10',
                    badgeText: 'text-emerald-400',
                    badgeRing: 'ring-emerald-500/20',
                    btnColor: 'bg-emerald-600 hover:bg-emerald-500 focus:ring-emerald-500',
                    icon: <TrendingUp className="h-3.5 w-3.5" />,
                    intentLabel: '买入'
                };
            case IntentType.TAKE_PROFIT_SELL:
                return {
                    borderColor: 'border-blue-500/50', // Blue/Gold for profit taking
                    barColor: 'bg-blue-500',
                    badgeBg: 'bg-blue-500/10',
                    badgeText: 'text-blue-400',
                    badgeRing: 'ring-blue-500/20',
                    btnColor: 'bg-blue-600 hover:bg-blue-500 focus:ring-blue-500',
                    icon: <Target className="h-3.5 w-3.5" />,
                    intentLabel: '止盈卖出'
                };
            case IntentType.STOP_LOSS_SELL:
                return {
                    borderColor: 'border-rose-500/50', // Red for stop loss
                    barColor: 'bg-rose-500',
                    badgeBg: 'bg-rose-500/10',
                    badgeText: 'text-rose-400',
                    badgeRing: 'ring-rose-500/20',
                    btnColor: 'bg-rose-600 hover:bg-rose-500 focus:ring-rose-500',
                    icon: <AlertOctagon className="h-3.5 w-3.5" />,
                    intentLabel: '止损卖出'
                };
            default: // General Sell
                return {
                    borderColor: 'border-slate-600',
                    barColor: 'bg-slate-500',
                    badgeBg: 'bg-slate-500/10',
                    badgeText: 'text-slate-400',
                    badgeRing: 'ring-slate-500/20',
                    btnColor: 'bg-slate-600 hover:bg-slate-500 focus:ring-slate-500',
                    icon: <ArrowRight className="h-3.5 w-3.5" />,
                    intentLabel: '卖出'
                };
        }
    };

    const style = getStyle();
    const isBuy = intent.side === Side.BUY;
    
    return (
        <div className={`relative overflow-hidden rounded-xl border bg-slate-900 shadow-lg transition-all hover:border-slate-500 ${style.borderColor} flex flex-col`}>
            {/* Type Indicator Bar */}
            <div className={`absolute left-0 top-0 h-full w-1 ${style.barColor}`}></div>

            <div className="p-5 flex-1 flex flex-col">
                {/* Header */}
                <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold text-slate-100 leading-none">{intent.name}</span>
                            <span className="font-mono text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">{intent.symbol}</span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset ${style.badgeBg} ${style.badgeText} ${style.badgeRing}`}>
                                {style.icon}
                                {style.intentLabel}
                            </span>
                            {intent.reduce_only && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 ring-1 ring-inset ring-slate-700">
                                    <RotateCcw className="h-3 w-3" />
                                    减仓
                                </span>
                            )}
                        </div>
                    </div>
                    {/* Trade Date Display */}
                    <div className="flex items-center gap-1.5 rounded-md bg-slate-800/50 px-2 py-1 text-[10px] text-slate-300 border border-slate-700/50">
                        <Calendar className="h-3 w-3 text-slate-500" />
                        <span className="font-mono font-medium">{intent.trade_day}</span>
                    </div>
                </div>

                {/* Core Data Inputs */}
                <div className="mb-4 grid grid-cols-2 gap-4 bg-slate-950/30 p-3 rounded-lg border border-slate-800/50">
                    <div>
                        <div className="flex items-center gap-1 mb-1">
                            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Price (CNY)</p>
                            <Pencil className="h-2.5 w-2.5 text-slate-600" />
                        </div>
                        <div className="flex items-center gap-1 relative">
                            <span className="text-slate-500 font-mono text-base absolute left-0 top-1/2 -translate-y-1/2">¥</span>
                            <input 
                                type="number"
                                step="0.01"
                                value={priceInput}
                                onChange={(e) => setPriceInput(e.target.value)}
                                className="w-full bg-transparent border-b border-slate-700 font-mono text-lg font-bold text-slate-100 focus:outline-none focus:border-emerald-500 transition-colors pl-4"
                            />
                        </div>
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold mb-1">Volume (Lots)</p>
                        <p className="font-mono text-lg font-bold text-slate-100 pl-1">{intent.qty}</p>
                    </div>
                </div>

                {/* Strategy/Reason - Scrollable Container */}
                <div className="mb-4 rounded-lg bg-slate-800/50 p-3 flex-1 flex flex-col min-h-[100px]">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                            <Target className="h-3 w-3" />
                            <span>Strategy: {intent.strategy_id}</span>
                        </div>
                        <span className="text-[9px] text-slate-600 font-mono border border-slate-700/50 px-1 rounded">v{intent.version.rule_version}</span>
                    </div>
                    
                    <div className="relative flex-1 overflow-y-auto max-h-[80px] custom-scrollbar pr-1">
                        <Quote className="absolute top-0 left-0 h-4 w-4 text-slate-700 opacity-20" />
                        <p className="text-sm text-slate-300 italic leading-relaxed pl-3 indent-1">
                            {intent.reason}
                        </p>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-700/30 flex justify-between items-center text-[10px] text-slate-500">
                        <span>Source: {intent.source.trigger}</span>
                        <span className="font-mono">{intent.timestamp.split('T')[1].split('.')[0]}</span>
                    </div>
                </div>

                {/* Risk Parameters */}
                {(isBuy || intent.stop_loss || intent.take_profit) && (
                    <div className="mb-5 flex flex-wrap gap-4 text-xs border-t border-slate-800/50 pt-3">
                        {intent.stop_loss && (
                            <div className="flex items-center gap-1.5 bg-rose-500/5 px-2 py-1 rounded text-rose-400 border border-rose-500/10" title="止损价格">
                                <Shield className="h-3 w-3" />
                                <span className="font-mono">{intent.stop_loss.toFixed(2)}</span>
                            </div>
                        )}
                        {intent.take_profit && (
                            <div className="flex items-center gap-1.5 bg-emerald-500/5 px-2 py-1 rounded text-emerald-400 border border-emerald-500/10" title="止盈目标">
                                <Target className="h-3 w-3" />
                                <span className="font-mono">{intent.take_profit.toFixed(2)}</span>
                            </div>
                        )}
                        {/* R:R Ratio Display */}
                        {rrRatio && (
                            <div className="flex items-center gap-1.5 bg-indigo-500/5 px-2 py-1 rounded text-indigo-400 border border-indigo-500/10 ml-auto" title="盈亏比 (Reward:Risk)">
                                <Scale className="h-3 w-3" />
                                <span className="font-mono font-bold">1 : {rrRatio}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 mt-auto">
                    <button
                        onClick={() => onReject(intent.intent_id)}
                        className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-transparent py-2.5 text-sm font-semibold text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 focus:ring-offset-slate-900"
                    >
                        <XOctagon className="h-4 w-4" />
                        拒绝
                    </button>
                    <button
                        onClick={() => {
                            const val = parseFloat(priceInput);
                            if (!isNaN(val)) {
                                onApprove(intent.intent_id, val);
                            }
                        }}
                        className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 ${style.btnColor}`}
                    >
                        <ThumbsUp className="h-4 w-4" />
                        {isBuy ? '批准买入' : '执行卖出'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SignalCard;