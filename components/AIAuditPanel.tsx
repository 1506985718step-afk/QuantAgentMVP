import React, { useState } from 'react';
import { AuditReport } from '../types';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Sparkles, BrainCircuit, Activity, RefreshCw } from 'lucide-react';
import { config } from '../services/config';

interface AIAuditPanelProps {
    report: AuditReport;
}

const AIAuditPanel: React.FC<AIAuditPanelProps> = ({ report }) => {
    const isPass = report.score >= 80;
    const configData = report.active_config;
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            if (config.useRealBackend) {
                await fetch(`${config.apiBaseUrl}/audit/generate`, { method: 'POST' });
                // We rely on polling to pick up the new state, or could force a fetch in App
            } else {
                 // In Mock mode, MockBackend handles this via nextDay or we could add a method
                 // But strictly, mock backend updates audit on nextDay automatically.
                 // We will just simulate a delay for UI feedback here.
                 await new Promise(r => setTimeout(r, 800));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsRefreshing(false);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Strategy Evolution Card (New) */}
            {configData && (
                <div className="md:col-span-2 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-6 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-10">
                         <BrainCircuit className="h-32 w-32 text-indigo-500" />
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4 relative z-10">
                        <BrainCircuit className="h-5 w-5 text-indigo-400" />
                        <h3 className="text-lg font-bold text-slate-100">AI 策略进化引擎</h3>
                        <span className="text-xs text-indigo-400 font-mono ml-2 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                            自适应参数 (Adaptive)
                        </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6 relative z-10">
                        <div>
                            <span className="text-sm text-slate-400 block mb-1">量比阈值 (Filter)</span>
                            <span className="text-2xl font-bold text-slate-100 font-mono">{configData.vol_threshold.toFixed(1)}x</span>
                            <span className="text-xs text-slate-500 block mt-1">突破力度要求</span>
                        </div>
                        <div>
                            <span className="text-sm text-slate-400 block mb-1">动态止损 (Stop)</span>
                            <span className="text-2xl font-bold text-rose-400 font-mono">-{configData.stop_loss_pct.toFixed(1)}%</span>
                            <span className="text-xs text-slate-500 block mt-1">根据回撤调整</span>
                        </div>
                        <div>
                            <span className="text-sm text-slate-400 block mb-1">动态止盈 (TP)</span>
                            <span className="text-2xl font-bold text-emerald-400 font-mono">+{configData.take_profit_pct.toFixed(1)}%</span>
                            <span className="text-xs text-slate-500 block mt-1">根据波动率调整</span>
                        </div>
                        <div>
                            <span className="text-sm text-slate-400 block mb-1">上次进化</span>
                            <span className="text-xs font-mono text-slate-300 block bg-slate-800/50 p-2 rounded truncate" title={configData.update_reason}>
                                {configData.update_reason}
                            </span>
                        </div>
                    </div>
                </div>
            )}

            {/* Score Card */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-sm relative">
                <button 
                    onClick={handleRefresh}
                    disabled={isRefreshing}
                    className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-800 text-slate-500 hover:text-indigo-400 transition-all disabled:opacity-50"
                    title="重新生成 AI 报告"
                >
                    <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </button>

                <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck className="h-5 w-5 text-emerald-500" />
                    <h3 className="text-lg font-bold text-slate-100">AI 审计评分</h3>
                </div>
                
                <div className="flex items-center justify-between">
                    <div>
                        <div className={`text-5xl font-bold ${isPass ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {report.score}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                            状态: 
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${isPass ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                                {report.status}
                            </span>
                        </div>
                    </div>
                    
                    <div className="h-20 w-px bg-slate-800 mx-4"></div>
                    
                    <div className="flex-1 text-sm text-slate-400">
                        <p>审计日期: <span className="text-slate-200 font-mono">{report.date}</span></p>
                        <p className="mt-1">基于 <span className="text-slate-200">{report.checks.length}</span> 项核心风控规则验证</p>
                    </div>
                </div>
            </div>

            {/* AI Insights */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 shadow-sm">
                <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-indigo-400" />
                    <h3 className="text-lg font-bold text-slate-100">DeepSeek 优化建议</h3>
                </div>
                <div className="space-y-3">
                    {report.ai_suggestions.map((suggestion, idx) => (
                        <div key={idx} className="flex gap-3 rounded-lg bg-indigo-500/5 p-3 text-sm text-indigo-200 border border-indigo-500/10">
                            <span className="flex-shrink-0 font-mono font-bold text-indigo-500">{idx + 1}.</span>
                            <p>{suggestion}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Detailed Checks */}
            <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                 <div className="bg-slate-950/50 px-6 py-4 border-b border-slate-800">
                    <h3 className="font-bold text-slate-200">规则执行详情</h3>
                 </div>
                 <div className="divide-y divide-slate-800">
                     {report.checks.map((check, idx) => (
                         <div key={idx} className="flex items-center justify-between px-6 py-4 hover:bg-slate-800/30 transition-colors">
                             <div className="flex items-start gap-3">
                                 {check.status === 'PASS' && <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5" />}
                                 {check.status === 'FAIL' && <XCircle className="h-5 w-5 text-rose-500 mt-0.5" />}
                                 {check.status === 'WARN' && <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />}
                                 
                                 <div>
                                     <p className="font-medium text-slate-200">{check.rule_name}</p>
                                     <p className="text-sm text-slate-500">{check.details}</p>
                                 </div>
                             </div>
                             <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                                 check.status === 'PASS' ? 'text-emerald-500 bg-emerald-500/10' :
                                 check.status === 'FAIL' ? 'text-rose-500 bg-rose-500/10' :
                                 'text-amber-500 bg-amber-500/10'
                             }`}>
                                 {check.status}
                             </span>
                         </div>
                     ))}
                 </div>
            </div>
        </div>
    );
};

export default AIAuditPanel;
