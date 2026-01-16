import React, { useEffect, useRef } from 'react';
import { AgentType, Decision, SystemEvent } from '../types';
import { Terminal, Shield, Cpu, Activity, LogOut, Play, CalendarClock } from 'lucide-react';

interface EventLogProps {
    events: SystemEvent[];
}

const EventLog: React.FC<EventLogProps> = ({ events }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [events]);

    const getIcon = (agent: AgentType) => {
        switch (agent) {
            case AgentType.RISK: return <Shield className="h-3 w-3" />;
            case AgentType.STRATEGY: return <Cpu className="h-3 w-3" />;
            case AgentType.EXIT: return <LogOut className="h-3 w-3" />;
            case AgentType.EXECUTION: return <Play className="h-3 w-3" />;
            default: return <Activity className="h-3 w-3" />;
        }
    };

    const getColor = (decision: Decision) => {
        switch (decision) {
            case Decision.ALLOW: return 'text-emerald-400';
            case Decision.BLOCK: return 'text-rose-400';
            case Decision.EXECUTE: return 'text-blue-400';
            default: return 'text-slate-400';
        }
    };

    const formatTime = (ts: string) => {
        const date = new Date(ts);
        return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <div className="flex h-full flex-col rounded-xl border border-slate-800 bg-slate-900 shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
                <Terminal className="h-4 w-4 text-slate-500" />
                <h3 className="text-sm font-semibold text-slate-300">系统事件流</h3>
                <span className="ml-auto flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">
                    {events.map((evt) => (
                        <div key={evt.event_id} className="group flex items-start gap-3 rounded px-2 py-2 hover:bg-slate-800/50">
                            <div className="mt-1 flex flex-col items-end min-w-[60px]">
                                <span className="font-mono text-[10px] text-slate-500">{formatTime(evt.ts)}</span>
                                <span className="text-[8px] text-slate-600 bg-slate-800 px-1 rounded">{evt.trade_day.slice(5)}</span>
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <span className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-800 border border-slate-700 ${getColor(evt.decision)}`}>
                                        {getIcon(evt.agent)}
                                        {evt.agent}
                                    </span>
                                    <span className="text-xs font-medium text-slate-300">
                                        {evt.type}
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-slate-400 font-mono pl-1 border-l-2 border-slate-800 group-hover:border-slate-600 transition-colors">
                                    {evt.reason_text}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default EventLog;