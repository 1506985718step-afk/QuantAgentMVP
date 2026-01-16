
import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import MarketStatus from './components/MarketStatus';
import AccountSummary from './components/AccountSummary';
import SignalCard from './components/SignalCard';
import PositionTable from './components/PositionTable';
import EventLog from './components/EventLog';
import AIAuditPanel from './components/AIAuditPanel';
import BehaviorAnalytics from './components/BehaviorAnalytics';
import PositionHealth from './components/PositionHealth';
import KLineChart from './components/KLineChart';
import OrderList from './components/OrderList';
import AIChatPanel from './components/AIChatPanel';
import BacktestControls from './components/BacktestControls'; // New Import

import { backend as mockBackend } from './services/MockBackend'; 
import { backend as apiBackend } from './services/APIBackend';
import { config, setBackendMode } from './services/config';
import { dataProvider } from './services/DataProvider';
import { Loader2, Activity, PieChart, BarChart2, LayoutDashboard, Server, MonitorSmartphone, WifiOff, MessageSquareText } from 'lucide-react';
import { BarData } from './services/historicalData';

const App: React.FC = () => {
    // Determine active backend based on config
    const [useRealBackend, setUseRealBackend] = useState(config.useRealBackend);
    
    // Dynamic backend reference
    const activeBackend = useRealBackend ? apiBackend : mockBackend;

    const [state, setState] = useState(activeBackend.getState());
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<'live' | 'analysis' | 'advisor'>('live');
    const [chartSymbol, setChartSymbol] = useState('000001'); 
    const [chartData, setChartData] = useState<BarData[]>([]);

    // Handle Backend Switch
    const toggleBackend = () => {
        const newValue = !useRealBackend;
        setUseRealBackend(newValue);
        setBackendMode(newValue);
        window.location.reload(); // Simple reload to reset all subscriptions cleanly
    };

    useEffect(() => {
        // Subscribe to the selected backend
        const unsubscribe = activeBackend.subscribe((newState: any) => {
            setState(newState);
            // If backend provides fresh orders/intents, chart might need refresh, 
            // but usually chart data is static history + live ticks.
        });
        
        // Initial Fetch
        const init = async () => {
            await fetchChartData(chartSymbol);
            setIsLoading(false);
        };
        init();

        return () => unsubscribe();
    }, [chartSymbol, useRealBackend]);

    const fetchChartData = async (sym: string) => {
        const data = await dataProvider.getBars(sym, 60);
        setChartData(data);
    };

    const handleApprove = (id: string, price: number) => {
        activeBackend.approveSignal(id, price);
    };

    const handleReject = (id: string) => {
        activeBackend.rejectSignal(id);
    };
    
    const handleCancelOrder = (id: string) => {
        activeBackend.cancelOrder(id);
    }

    const handleUpdateEquity = (amount: number) => {
        activeBackend.setTotalEquity(amount);
    };
    
    // Debug Trigger (Only for Real Backend to force tick)
    const handleForceTick = async () => {
        if (useRealBackend) {
            await fetch(`${config.apiBaseUrl}/debug/tick`, { method: 'POST' });
        }
    };

    // Simulation Handlers (Only valid for Mock Backend)
    const handleSimPlay = () => !useRealBackend && (mockBackend as any).togglePlayback();
    const handleSimPause = () => !useRealBackend && (mockBackend as any).togglePlayback();
    const handleSimSpeed = (s: number) => !useRealBackend && (mockBackend as any).setSpeed(s);
    const handleSimStep = () => !useRealBackend && (mockBackend as any).stepForward();

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-950 text-emerald-500">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin" />
                    <span className="font-mono text-sm tracking-widest text-slate-400">正在连接交易核心...</span>
                </div>
            </div>
        );
    }

    const { market, account, positions, intents, events, audit, metrics, orders, isConnected, simulation } = state as any;
    
    // Check if we are in real mode but disconnected
    const showConnectionError = useRealBackend && isConnected === false;

    // Filter intents: Show PENDING (from Python) or PENDING_APPROVAL (from Mock)
    const pendingIntents = intents?.filter((i: any) => i.status === 'PENDING_APPROVAL' || i.status === 'PENDING') || [];

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-emerald-500/30 pb-20 relative">
            <Header />
            
            {/* Connection Error Banner */}
            {showConnectionError && (
                <div className="bg-rose-600/90 text-white px-4 py-2 text-sm text-center font-bold flex items-center justify-center gap-2 sticky top-16 z-40 backdrop-blur-sm shadow-lg animate-in slide-in-from-top-2">
                    <WifiOff className="h-4 w-4" />
                    后端连接断开：请启动 Python 服务器 (Port 8000) 或切换至 Mock 模式
                </div>
            )}
            
            {/* Backend Mode Switcher (Dev Tool) */}
            <div className="fixed bottom-4 right-4 z-50">
                <button 
                    onClick={toggleBackend}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border text-xs font-bold transition-all ${
                        useRealBackend 
                        ? 'bg-indigo-600 border-indigo-400 text-white hover:bg-indigo-500' 
                        : 'bg-slate-800 border-slate-600 text-slate-400 hover:bg-slate-700'
                    }`}
                >
                    {useRealBackend ? <Server className="h-4 w-4" /> : <MonitorSmartphone className="h-4 w-4" />}
                    {useRealBackend ? '模式: Python 实盘' : '模式: AI 策略训练'}
                </button>
            </div>
            
            {/* Simulation Controls (Visible only in Mock Mode) */}
            {!useRealBackend && simulation && (
                <BacktestControls 
                    status={simulation}
                    onPlay={handleSimPlay}
                    onPause={handleSimPause}
                    onSpeedChange={handleSimSpeed}
                    onNextStep={handleSimStep}
                />
            )}
            
            <main className={`container mx-auto mt-8 max-w-[1400px] px-4 sm:px-6 space-y-8 ${showConnectionError ? 'opacity-50 pointer-events-none' : ''}`}>
                
                {/* Top Section: Summary & Health (Unified Grid) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 auto-rows-fr">
                     <AccountSummary 
                        data={account || {}} 
                        onUpdateEquity={handleUpdateEquity}
                    />
                    <PositionHealth 
                        score={account?.position_health_score || 100} 
                        kellySuggestion={account?.kelly_suggestion || 0}
                        currentExposure={account ? (account.market_value / account.total_equity) : 0}
                    />
                </div>

                {/* Tab Navigation (Pill Style) */}
                <div className="flex justify-center items-center gap-4">
                    <div className="inline-flex rounded-lg bg-slate-900 p-1 border border-slate-800 shadow-sm">
                        <button
                            onClick={() => setActiveTab('live')}
                            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                                activeTab === 'live' 
                                ? 'bg-slate-800 text-emerald-400 shadow-sm ring-1 ring-slate-700' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                        >
                            <LayoutDashboard className="h-4 w-4" />
                            {useRealBackend ? '实盘监控' : '训练看板'}
                        </button>
                        <button
                            onClick={() => setActiveTab('analysis')}
                            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                                activeTab === 'analysis' 
                                ? 'bg-slate-800 text-indigo-400 shadow-sm ring-1 ring-slate-700' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                        >
                            <PieChart className="h-4 w-4" />
                            复盘分析
                        </button>
                        <button
                            onClick={() => setActiveTab('advisor')}
                            className={`flex items-center gap-2 px-6 py-2.5 text-sm font-medium rounded-md transition-all duration-200 ${
                                activeTab === 'advisor' 
                                ? 'bg-slate-800 text-indigo-400 shadow-sm ring-1 ring-slate-700' 
                                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                            }`}
                        >
                            <MessageSquareText className="h-4 w-4" />
                            AI 顾问
                        </button>
                    </div>
                    
                    {useRealBackend && (
                         <button 
                            onClick={handleForceTick}
                            className="flex items-center gap-1 text-xs bg-indigo-500/20 text-indigo-400 px-3 py-1 rounded-md hover:bg-indigo-500/30 border border-indigo-500/20"
                            title="Force Strategy Scan"
                        >
                            <Activity className="h-3 w-3" />
                            扫描市场
                        </button>
                    )}
                </div>

                {/* --- TAB CONTENT: LIVE --- */}
                {activeTab === 'live' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Market Overview */}
                        <MarketStatus data={market || {}} />

                        {/* Visual Verification Section (Fixed Heights) */}
                        <div className="grid gap-6 lg:grid-cols-3 items-start">
                            <div className="lg:col-span-2 flex flex-col gap-4">
                                <div className="flex items-center justify-between px-1">
                                    <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
                                        <BarChart2 className="h-5 w-5 text-indigo-400" />
                                        市场形态验证
                                    </h2>
                                    <div className="flex bg-slate-900 rounded-lg p-1 border border-slate-800">
                                        {['000001', '600519', '002594'].map(sym => (
                                            <button 
                                                key={sym}
                                                onClick={() => setChartSymbol(sym)}
                                                className={`px-3 py-1 rounded-md text-xs font-mono transition-all ${
                                                    chartSymbol === sym 
                                                    ? 'bg-indigo-600 text-white shadow-sm' 
                                                    : 'text-slate-400 hover:text-slate-200'
                                                }`}
                                            >
                                                {sym}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Chart Container */}
                                <div className="h-[320px] w-full"> 
                                    <KLineChart 
                                        symbol={chartSymbol} 
                                        data={chartData} 
                                        height={320} 
                                        highlightDate={market?.replay_date} 
                                    />
                                </div>
                            </div>
                            
                            <div className="lg:col-span-1 flex flex-col gap-4">
                                <div className="h-8"></div> {/* Spacer to align with chart header */}
                                {/* Order List Container (Fixed Height to match chart) */}
                                <div className="h-[320px]">
                                    <OrderList orders={orders || []} onCancel={handleCancelOrder} />
                                </div>
                            </div>
                        </div>

                        {/* Main Interaction Area */}
                        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
                            {/* Left Column: Actionable Signals & Positions */}
                            <div className="lg:col-span-8 flex flex-col gap-8">
                                <section>
                                    <div className="mb-4 flex items-center justify-between">
                                        <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
                                            <Activity className="h-5 w-5 text-emerald-500" />
                                            待审批信号 (AI)
                                        </h2>
                                        <span className="rounded-full bg-slate-800 border border-slate-700 px-3 py-1 text-xs font-medium text-slate-400">
                                            {pendingIntents.length || 0} 待处理
                                        </span>
                                    </div>
                                    
                                    {pendingIntents.length === 0 ? (
                                        <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/30 p-12 text-center text-slate-500">
                                            <div className="mx-auto w-12 h-12 bg-slate-900 rounded-full flex items-center justify-center mb-3">
                                                <Activity className="h-6 w-6 opacity-50" />
                                            </div>
                                            <p className="font-medium">暂时没有来自 StrategyAgent 的信号</p>
                                            <p className="text-xs mt-1 opacity-60">LLM 正在实时扫描市场形态...</p>
                                        </div>
                                    ) : (
                                        <div className="grid gap-4 md:grid-cols-2">
                                            {pendingIntents.map((intent: any) => (
                                                <SignalCard 
                                                    key={intent.intent_id} 
                                                    intent={intent} 
                                                    onApprove={handleApprove} 
                                                    onReject={handleReject} 
                                                />
                                            ))}
                                        </div>
                                    )}
                                </section>

                                <section>
                                    <h2 className="mb-4 text-xl font-bold text-slate-100">当前持仓</h2>
                                    <PositionTable positions={positions || []} />
                                </section>
                            </div>

                            {/* Right Column: Event Stream (Sticky) */}
                            <div className="lg:col-span-4">
                                <div className="sticky top-24 h-[calc(100vh-8rem)] min-h-[500px] max-h-[800px]">
                                    <EventLog events={events || []} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB CONTENT: ANALYSIS --- */}
                {activeTab === 'analysis' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                         <section>
                            <h2 className="mb-4 text-xl font-bold text-slate-100">AI 审计报告</h2>
                            <AIAuditPanel report={audit || {}} />
                        </section>
                        <section>
                            <h2 className="mb-4 text-xl font-bold text-slate-100">交易行为分析</h2>
                            <BehaviorAnalytics metrics={metrics || {}} />
                        </section>
                    </div>
                )}

                {/* --- TAB CONTENT: AI ADVISOR --- */}
                {activeTab === 'advisor' && (
                    <div className="mx-auto max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <section>
                             <div className="mb-4">
                                <h2 className="text-xl font-bold text-slate-100">DeepSeek 投资顾问</h2>
                                <p className="text-sm text-slate-500">您的专属量化专家，提供策略分析与心理建设支持</p>
                             </div>
                            <AIChatPanel />
                        </section>
                    </div>
                )}

            </main>
        </div>
    );
};

export default App;
