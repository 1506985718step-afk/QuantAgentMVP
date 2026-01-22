
import React, { useState } from 'react';
import { AuditReport, ExperimentResult } from '../types';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck, Sparkles, BrainCircuit, Activity, RefreshCw, Beaker, Play } from 'lucide-react';
import { config } from '../services/config';
import { authService } from '../services/authService';

interface AIAuditPanelProps {
    report: AuditReport;
    experimentResults?: ExperimentResult[];
}

const AIAuditPanel: React.FC<AIAuditPanelProps> = ({ report, experimentResults = [] }) => {
    const isPass = report.score >= 80;
    const configData = report.active_config;
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isRunningExp, setIsRunningExp] = useState(false);
    
    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            if (config.useRealBackend) {
                await fetch(`${config.apiBaseUrl}/audit/generate`, { 
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${authService.getToken()}` }
                });
            } else {
                 await new Promise(r => setTimeout(r, 800));
            }
        } catch (e) {
            console.error(e);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleRunExperiments = async () => {
        if (!config.useRealBackend) {
            alert("Experiments require connected backend.");
            return;
        }
        setIsRunningExp(true);
        try {
             await fetch(`${config.apiBaseUrl}/experiments/run`, { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authService.getToken()}` }
            });
            // Polling will pick up results
        } catch(e) {
            console.error(e);
        } finally {
            setIsRunningExp(false);
        }
    };

    return (
        <div className="grid gap-6 md:grid-cols-2">
            {/* Strategy Evolution Card */}
            {configData && (
                <div className="md:col-span-2 rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-6 shadow-sm relative overflow-hidden">
                    <div className="absolute right-0 top-0 opacity-10">
                         <BrainCircuit className="h-32 w-32 text-indigo-500" />
                    </div>
                    
                    <div className="flex items-center gap-2 mb-4 relative z-10">
                        <BrainCircuit className="h-5 w-5 text-indigo-400" />
                        <h3 className="text-lg font-bold text-slate-100">AI 策略进化引擎 (Evolution)</h3>
                        <span className="text-xs text-indigo-400 font-mono ml-2 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                            自适应参数
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
            
            {/* Experiments Card (Validation Results) */}
            <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900 overflow-hidden">
                <div className="bg-slate-950/50 px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Beaker className="h-5 w-5 text-purple-500" />
                        <h3 className="font-bold text-slate-200">策略验证实验室 (Validation)</h3>
                    </div>
                    <button 
                        onClick={handleRunExperiments}
                        disabled={isRunningExp}
                        className="flex items-center gap-2 px-3 py-1.5 bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 rounded text-xs font-bold border border-purple-500/30 disabled:opacity-50"
                    >
                        {isRunningExp ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        {isRunningExp ? '验证中...' : '运行历史剧本验证'}
                    </button>
                </div>
                
                {experimentResults.length === 0 ? (
                    <div className="p-8 text-center text-slate-500 text-sm">
                        暂无验证数据，请点击右上角运行验证。
                    </div>
                ) : (
                    <div className="divide-y divide-slate-800">
                        {experimentResults.map((exp, idx) => (
                            <div key={idx} className="flex items-center justify-between px-6 py-3 hover:bg-slate-800/30 transition-colors">
                                <div>
                                    <p className="font-bold text-slate-200 text-sm">{exp.scenario}</p>
                                    <p className="text-xs text-slate-500 mt-0.5">历史场景模拟</p>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <p className={`font-mono text-sm font-bold ${exp.pnl_pct >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                            {exp.pnl_pct > 0 ? '+' : ''}{exp.pnl_pct.toFixed(2)}%
                                        </p>
                                        <p className="text-[10px] text-slate-500">收益率</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-sm font-bold text-amber-400">
                                            {(exp.drawdown * 100).toFixed(1)}%
                                        </p>
                                        <p className="text-[10px] text-slate-500">最大回撤</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-sm font-bold text-slate-300">
                                            {exp.trades}
                                        </p>
                                        <p className="text-[10px] text-slate-500">交易次数</p>
                                    </div>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                        exp.status === 'PASS' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                                    }`}>
                                        {exp.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

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
