import React from 'react';
import { BrokerOrder } from '../types'; // Changed from ../services/MockBroker
import { OrderStatus } from '../types';
import { RefreshCcw, XCircle, Clock, CheckCircle2 } from 'lucide-react';

interface OrderListProps {
    orders: BrokerOrder[];
    onCancel: (intentId: string) => void;
}

const OrderList: React.FC<OrderListProps> = ({ orders, onCancel }) => {
    // Show active first, then recent filled/cancelled
    const sortedOrders = [...orders].sort((a, b) => b.submittedAt - a.submittedAt);
    
    const getStatusStyle = (status: OrderStatus) => {
        switch (status) {
            case OrderStatus.SUBMITTED: return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
            case OrderStatus.PARTIALLY_FILLED: return 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20';
            case OrderStatus.FILLED: return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
            case OrderStatus.CANCELLED: return 'text-slate-400 bg-slate-400/10 border-slate-400/20';
            default: return 'text-slate-500';
        }
    };

    if (orders.length === 0) {
        return (
            <div className="h-full rounded-xl border border-slate-800 bg-slate-900 flex flex-col items-center justify-center text-slate-500 text-sm p-6">
                <RefreshCcw className="h-8 w-8 mb-3 opacity-30" />
                <p>券商通道空闲</p>
                <p className="text-xs opacity-50 mt-1">暂无挂单记录</p>
            </div>
        );
    }

    return (
        <div className="h-full rounded-xl border border-slate-800 bg-slate-900 overflow-hidden shadow-sm flex flex-col">
            <div className="bg-slate-950/50 px-4 py-3 border-b border-slate-800 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <h3 className="font-bold text-slate-200 text-sm">委托队列 (Order Book)</h3>
                </div>
                <span className="text-[10px] text-slate-500 font-mono bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
                    MockBroker v1.0
                </span>
            </div>
            
            <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-800">
                {sortedOrders.map((order) => {
                    const isActive = order.status === OrderStatus.SUBMITTED || order.status === OrderStatus.PARTIALLY_FILLED;
                    
                    return (
                        <div key={order.orderId} className="px-4 py-2.5 hover:bg-slate-800/30 transition-colors flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                                <div className={`h-8 w-8 rounded flex items-center justify-center text-xs font-bold ${order.side === 'BUY' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                                    {order.side === 'BUY' ? '买' : '卖'}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-mono font-bold text-slate-200 text-sm">{order.symbol}</span>
                                        <span className={`text-[9px] px-1.5 py-0 rounded border uppercase font-semibold ${getStatusStyle(order.status)}`}>
                                            {order.status}
                                        </span>
                                    </div>
                                    <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                                        <span className="text-slate-400">{order.filledQty}</span>
                                        <span className="opacity-50">/</span>
                                        <span>{order.qty}</span>
                                        <span className="mx-1 opacity-50">@</span>
                                        <span className="text-slate-300">¥{order.price.toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-3">
                                <div className="text-right hidden sm:block">
                                    <span className="text-[9px] text-slate-500 font-mono block leading-none">ID: {order.orderId.slice(-6)}</span>
                                    <span className="text-[9px] text-slate-600 font-mono leading-none">
                                        {new Date(order.submittedAt).toLocaleTimeString('zh-CN', {hour:'2-digit', minute:'2-digit', second:'2-digit'})}
                                    </span>
                                </div>
                                {isActive ? (
                                    <button 
                                        onClick={() => onCancel(order.intentId)}
                                        className="text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded p-1.5 transition-all"
                                        title="撤单"
                                    >
                                        <XCircle className="h-4 w-4" />
                                    </button>
                                ) : (
                                    <div className="p-1.5 opacity-0">
                                        <div className="h-4 w-4"></div>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
                {/* Spacer for scroll */}
                <div className="h-2"></div>
            </div>
        </div>
    );
};

export default OrderList;