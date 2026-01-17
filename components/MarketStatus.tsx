
import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Activity, BarChart2, Clock } from 'lucide-react';
import { MarketSnapshot } from '../types';

interface MarketStatusProps {
    data: MarketSnapshot;
}

const MarketStatus: React.FC<MarketStatusProps> = ({ data }) => {
    const isPositive = data.change_pct >= 0;
    const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date().toLocaleTimeString()), 1000);
        return () => clearInterval(timer);
    }, []);
    
    // Status Logic
    const heatScore = (data.up_count > 3000 ? 1 : 0) + (data.limit_up_count > 50 ? 1 : 0);
    const heatColor = heatScore === 2 ? 'text-rose-500' : heatScore === 1 ? 'text-amber-500' : 'text-zinc-500';

    return (
        <div className="glass-panel rounded-lg p-px grid grid-cols-2 lg:grid-cols-4 gap-px bg-zinc-800/50 overflow-hidden shadow-sm">
            {/* Index & Time */}
            <div className="bg-[#0f0f11]/80 p-4 flex flex-col justify-center min-h-[80px] relative">
                <div className="absolute top-3 right-3 text-[10px] font-mono text-zinc-600 flex items-center gap-1">
                     <Clock className="h-3 w-3" /> {currentTime}
                </div>
                <span className="text-[10px] uppercase text-zinc-500 font-bold mb-1.5 flex items-center gap-1.5 tracking-wider">
                    <BarChart2 className="h-3 w-3" /> 大盘指数 ({data.replay_date || 'Live'})
                </span>
                <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xl font-bold text-white font-mono tracking-tight">{data.index_price.toFixed(2)}</span>
                    <span className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${isPositive ? 'text-emerald-400 bg-emerald-500/10' : 'text-rose-400 bg-rose-500/10'}`}>
                        {isPositive ? '+' : ''}{data.change_pct}%
                    </span>
                </div>
            </div>

            {/* Breadth */}
            <div className="bg-[#0f0f11]/80 p-4 flex flex-col justify-center min-h-[80px]">
                 <span className="text-[10px] uppercase text-zinc-500 font-bold mb-1.5 tracking-wider">市场广度 (Breadth)</span>
                 <div className="flex items-center gap-2 h-4 w-full">
                    <span className="text-emerald-500 font-bold font-mono text-xs w-8 text-right">{data.up_count}</span>
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden flex">
                        <div className="bg-emerald-500 h-full transition-all duration-500" style={{width: `${(data.up_count / (data.up_count+data.down_count||1))*100}%`}}></div>
                    </div>
                    <span className="text-rose-500 font-bold font-mono text-xs w-8">{data.down_count}</span>
                 </div>
            </div>

            {/* Limit Boards */}
            <div className="bg-[#0f0f11]/80 p-4 flex flex-col justify-center min-h-[80px]">
                <span className="text-[10px] uppercase text-zinc-500 font-bold mb-1.5 tracking-wider">涨跌停统计 (Limit)</span>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-white font-mono font-bold text-sm">{data.limit_up_count}</span>
                    </div>
                    <span className="text-zinc-700 h-4 w-px bg-zinc-700"></span>
                    <div className="flex items-center gap-1.5">
                        <TrendingDown className="h-3.5 w-3.5 text-rose-500" />
                        <span className="text-white font-mono font-bold text-sm">{data.limit_down_count}</span>
                    </div>
                </div>
            </div>

            {/* Sentiment */}
            <div className="bg-[#0f0f11]/80 p-4 flex flex-col justify-center min-h-[80px] relative overflow-hidden group">
                 <div className={`absolute right-3 top-3 h-1.5 w-1.5 rounded-full ${heatScore > 0 ? 'bg-amber-500 animate-pulse' : 'bg-zinc-700'}`}></div>
                 <span className="text-[10px] uppercase text-zinc-500 font-bold mb-1.5 tracking-wider">市场情绪 (Sentiment)</span>
                 <div className="flex items-center gap-2 relative z-10">
                     <Activity className={`h-4 w-4 ${heatColor}`} />
                     <span className="text-sm font-bold text-zinc-200 group-hover:text-white transition-colors">
                         {heatScore === 2 ? '情绪过热' : heatScore === 1 ? '情绪中性' : '情绪冰点'}
                     </span>
                 </div>
                 {/* Subtle background glow based on sentiment */}
                 <div className={`absolute -bottom-4 -right-4 w-16 h-16 blur-xl opacity-10 rounded-full ${heatScore > 0 ? 'bg-amber-500' : 'bg-zinc-500'}`}></div>
            </div>
        </div>
    );
};

export default MarketStatus;
