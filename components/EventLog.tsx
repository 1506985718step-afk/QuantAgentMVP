
import React, { useEffect, useRef } from 'react';
import { AgentType, Decision, SystemEvent } from '../types';
import { Terminal } from 'lucide-react';

interface EventLogProps {
    events: SystemEvent[];
}

const EventLog: React.FC<EventLogProps> = ({ events }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events]);

    const getColor = (decision: Decision) => {
        switch (decision) {
            case Decision.ALLOW: return 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5';
            case Decision.BLOCK: return 'text-rose-400 border-rose-500/20 bg-rose-500/5';
            case Decision.EXECUTE: return 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5';
            default: return 'text-zinc-500 border-zinc-700 bg-zinc-800/30';
        }
    };

    return (
        <div className="flex h-[calc(100vh-8rem)] min-h-[400px] flex-col glass-panel rounded-lg overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 border-b border-white/5 bg-zinc-900/50 px-4 py-2.5 shrink-0">
                <Terminal className="h-3.5 w-3.5 text-zinc-500" />
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">系统事件日志 (System Events)</h3>
            </div>
            
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-1 bg-[#050505]">
                {events.map((evt) => (
                    <div key={evt.event_id} className="flex gap-2.5 p-2 rounded hover:bg-white/[0.02] group text-xs font-mono transition-colors">
                        <div className="text-zinc-600 shrink-0 w-[52px] text-right">
                            {evt.ts.split('T')[1].split('.')[0]}
                        </div>
                        <div className="flex-1 min-w-0 border-l border-zinc-800 pl-2.5">
                             <div className="flex items-center gap-2 mb-1 flex-wrap">
                                 <span className={`px-1.5 py-px rounded border text-[10px] font-bold uppercase ${getColor(evt.decision)}`}>
                                     {evt.agent}
                                 </span>
                                 <span className="text-zinc-400 font-semibold">{evt.type}</span>
                             </div>
                             <div className="text-zinc-500 break-words leading-relaxed group-hover:text-zinc-300 transition-colors">
                                 {evt.reason_text}
                             </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default EventLog;
