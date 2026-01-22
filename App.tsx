
import React, { useState, useEffect, useRef } from 'react';
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
import AIChatPanel, { ChatMessage } from './components/AIChatPanel';
import BacktestControls from './components/BacktestControls'; 
import NewsSentiment from './components/NewsSentiment';
import AuthPage from './components/AuthPage'; 

import { backend as mockBackend } from './services/MockBackend'; 
import { backend as apiBackend } from './services/APIBackend';
import { authService } from './services/authService';
import { config, setBackendMode } from './services/config';
import { dataProvider } from './services/DataProvider';
import { Loader2, Activity, PieChart, BarChart2, LayoutDashboard, MessageSquareText, TrendingUp, Power, ScanLine, Plus, X, ChevronDown, Pause, SkipForward } from 'lucide-react';
import { BarData } from './services/historicalData';

// Preset Sectors for Quick Import
const SECTORS = {
    "白酒龙头": [
        { symbol: '600519', name: '贵州茅台' },
        { symbol: '000858', name: '五粮液' },
        { symbol: '000568', name: '泸州老窖' }
    ],
    "新能源车": [
        { symbol: '002594', name: '比亚迪' },
        { symbol: '300750', name: '宁德时代' },
        { symbol: '601012', name: '隆基绿能' }
    ],
    "AI算力": [
        { symbol: '601138', name: '工业富联' },
        { symbol: '000977', name: '浪潮信息' },
        { symbol: '300308', name: '中际旭创' }
    ],
    "大金融": [
        { symbol: '300059', name: '东方财富' },
        { symbol: '600030', name: '中信证券' },
        { symbol: '000001', name: '平安银行' }
    ]
};

const DEFAULT_WATCHLIST = SECTORS["大金融"];

const App: React.FC = () => {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(authService.isAuthenticated());
    const [useRealBackend, setUseRealBackend] = useState(config.useRealBackend);
    const activeBackend = useRealBackend ? apiBackend : mockBackend;
    const [state, setState] = useState(activeBackend.getState());
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [activeTab, setActiveTab] = useState<'live' | 'analysis' | 'advisor'>('live');
    const [chartSymbol, setChartSymbol] = useState('000001'); 
    const [chartData, setChartData] = useState<BarData[]>([]);
    
    // Auto-Scan State (Live)
    const [isAutoScanning, setIsAutoScanning] = useState(false);
    const autoScanTimer = useRef<any>(null);

    // Watchlist UI State
    const [isAddStockOpen, setIsAddStockOpen] = useState(false);
    const [newStockCode, setNewStockCode] = useState('');
    const [newStockName, setNewStockName] = useState('');
    const [showSectorMenu, setShowSectorMenu] = useState(false);

    // Lifted Chat State (Persistence)
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

    // Initial Auth Check
    useEffect(() => {
        setIsAuthenticated(authService.isAuthenticated());
    }, []);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
        // Force reload state
        activeBackend.setWatchlist(DEFAULT_WATCHLIST); 
    };

    const toggleBackend = () => {
        const newValue = !useRealBackend;
        setUseRealBackend(newValue);
        setBackendMode(newValue);
        setIsLoading(true);
        // Reset auto scan when switching modes
        setIsAutoScanning(false);
        setTimeout(() => setIsLoading(false), 300);
    };

    useEffect(() => {
        if (!isAuthenticated) return;
        const unsubscribe = activeBackend.subscribe((newState: any) => {
            setState(newState);
        });
        const init = async () => {
            await fetchChartData(chartSymbol);
            setIsLoading(false);
        };
        init();
        return () => unsubscribe();
    }, [chartSymbol, useRealBackend, isAuthenticated]);

    useEffect(() => {
        if (!isAuthenticated) return;
        fetchChartData(chartSymbol);
    }, [chartSymbol, isAuthenticated]);

    // Auto-Scan Effect (Live Mode)
    useEffect(() => {
        if (!isAuthenticated) return;
        if (isAutoScanning && useRealBackend) {
            autoScanTimer.current = setInterval(async () => {
                await handleForceTick();
            }, 10000); // Scan every 10 seconds
        } else {
            if (autoScanTimer.current) clearInterval(autoScanTimer.current);
        }
        return () => {
            if (autoScanTimer.current) clearInterval(autoScanTimer.current);
        };
    }, [isAutoScanning, useRealBackend, isAuthenticated]);

    const fetchChartData = async (sym: string) => {
        const data = await dataProvider.getBars(sym, 1000);
        setChartData(data);
    };

    const handleApprove = (id: string, price: number) => activeBackend.approveSignal(id, price);
    const handleReject = (id: string) => activeBackend.rejectSignal(id);
    const handleCancelOrder = (id: string) => activeBackend.cancelOrder(id);
    const handleUpdateEquity = (amount: number) => activeBackend.setTotalEquity(amount);
    
    const handleManualNextDay = async () => {
        if (useRealBackend) await fetch(`${config.apiBaseUrl}/debug/next_day`, { 
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authService.getToken()}` }
        });
        else (mockBackend as any).nextDay();
    };
    
    const handleForceTick = async () => {
        try {
            await fetch(`${config.apiBaseUrl}/debug/tick`, { 
                method: 'POST',
                headers: { 'Authorization': `Bearer ${authService.getToken()}` }
            });
        } catch (e) {
            console.error("Scan failed", e);
        }
    };

    // Watchlist Handlers
    const handleAddStock = async () => {
        if (!newStockCode || !newStockName) return;
        // Use active backend (works for both Real and Mock via Optimistic update)
        await activeBackend.addToWatchlist(newStockCode, newStockName);
        setIsAddStockOpen(false);
        setNewStockCode('');
        setNewStockName('');
    };

    const handleRemoveStock = async (symbol: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await activeBackend.removeFromWatchlist(symbol);
    };

    const handleLoadSector = async (sectorName: string) => {
        const stocks = SECTORS[sectorName as keyof typeof SECTORS];
        
        // Optimistically replace the watchlist view
        await activeBackend.setWatchlist(stocks);
        
        // Auto-select the first stock in the new sector for the chart
        if (stocks.length > 0) {
            setChartSymbol(stocks[0].symbol);
        }
        setShowSectorMenu(false);
    };

    const handleSimPlay = () => !useRealBackend && (mockBackend as any).togglePlayback();
    const handleSimPause = () => !useRealBackend && (mockBackend as any).togglePlayback();
    const handleSimSpeed = (s: number) => !useRealBackend && (mockBackend as any).setSpeed(s);
    const handleSimStep = () => !useRealBackend && (mockBackend as any).stepForward();

    // --- Render Auth Page if not logged in ---
    if (!isAuthenticated) {
        return <AuthPage onLoginSuccess={handleLoginSuccess} />;
    }

    if (isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-[#09090b] text-emerald-500">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
                    <span className="font-mono text-xs tracking-widest text-zinc-500 uppercase">系统初始化中...</span>
                </div>
            </div>
        );
    }

    const { market, account, positions, intents, events, audit, metrics, orders, isConnected, simulation, watchlist, experiment_results } = state as any;
    const showConnectionError = useRealBackend && isConnected === false;
    const pendingIntents = intents?.filter((i: any) => i.status === 'PENDING_APPROVAL' || i.status === 'PENDING') || [];
    const visibleChartData = (!useRealBackend && market?.replay_date && chartData.length > 0)
        ? chartData.filter(d => d.date <= market.replay_date)
        : chartData;
    
    // Use dynamic watchlist from backend if available, else default
    const currentWatchlist = (watchlist && watchlist.length > 0) ? watchlist : DEFAULT_WATCHLIST;

    // Unified Auto Scan/Play State
    const isSimPlaying = (!useRealBackend && simulation?.isPlaying) || false;
    const isAutoActive = useRealBackend ? isAutoScanning : isSimPlaying;

    return (
        <div className="min-h-screen pb-32 relative font-sans antialiased text-zinc-200">
            <Header 
                isLiveMode={useRealBackend} 
                onToggleMode={toggleBackend}
                onManualNextDay={handleManualNextDay}
            />
            
            {!useRealBackend && simulation && (
                <BacktestControls 
                    status={simulation}
                    onPlay={handleSimPlay}
                    onPause={handleSimPause}
                    onSpeedChange={handleSimSpeed}
                    onNextStep={handleSimStep}
                />
            )}
            
            <main className="container mx-auto mt-4 sm:mt-6 max-w-[1800px] px-3 sm:px-6 space-y-4 sm:space-y-6">
                
                {/* Status Banners */}
                {!useRealBackend && (
                    <div className="glass-panel rounded-lg p-3 flex items-center justify-between text-sm text-emerald-400/90 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                        <div className="flex items-center gap-3">
                             <div className="relative flex h-2 w-2 ml-1">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </div>
                            <span className="font-medium tracking-wide">训练模式 ACTIVE</span>
                            <span className="text-zinc-500 hidden sm:inline">|</span>
                            <span className="text-zinc-400 text-xs hidden sm:inline">2024-2025 历史行情回放</span>
                        </div>
                        <span className="text-[10px] font-mono opacity-70 bg-emerald-950/30 px-2 py-0.5 rounded border border-emerald-500/20">VIRTUAL FUND</span>
                    </div>
                )}

                {useRealBackend && showConnectionError && (
                     <div className="bg-rose-950/20 border border-rose-500/20 rounded-lg p-3 text-sm text-rose-400 flex items-center gap-3">
                        <div className="h-1.5 w-1.5 rounded-full bg-rose-500"></div>
                        <span><b>Connection Lost:</b> Please verify Python backend (Port 8000).</span>
                    </div>
                )}
                
                {/* Dashboard Grid - Row 1 (Optimized Compact Layout) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
                    <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                         <AccountSummary 
                            data={account || {}} 
                            onUpdateEquity={handleUpdateEquity}
                        />
                    </div>
                    <div className="lg:col-span-4">
                        <PositionHealth 
                            score={account?.position_health_score || 100} 
                            kellySuggestion={account?.kelly_suggestion || 0}
                            currentExposure={account ? (account.market_value / account.total_equity) : 0}
                        />
                    </div>
                </div>

                {/* Navigation Tabs */}
                <div className="flex justify-between items-center border-b border-white/5 pb-1 overflow-x-auto no-scrollbar">
                    <div className="flex gap-4 sm:gap-6">
                        {[
                            { id: 'live', label: '交易看板', icon: LayoutDashboard },
                            { id: 'analysis', label: '分析报表', icon: PieChart },
                            { id: 'advisor', label: 'AI 顾问', icon: MessageSquareText }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 pb-3 text-sm font-medium transition-all relative whitespace-nowrap ${
                                    activeTab === tab.id 
                                    ? 'text-white' 
                                    : 'text-zinc-500 hover:text-zinc-300'
                                }`}
                            >
                                <tab.icon className="h-4 w-4" />
                                {tab.label}
                                {activeTab === tab.id && (
                                    <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {activeTab === 'live' && (
                    <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        {/* Market Context */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-6">
                            <div className="lg:col-span-2">
                                <MarketStatus data={market || {}} />
                            </div>
                            <div className="lg:col-span-1 h-[140px] lg:h-auto">
                                <NewsSentiment 
                                    news={market?.top_news || []} 
                                    sentimentScore={market?.sentiment_score || 50} 
                                    aiComment={market?.ai_market_comment}
                                />
                            </div>
                        </div>

                        {/* Chart & Execution */}
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-6 h-auto lg:h-[500px]">
                            <div className="lg:col-span-8 flex flex-col gap-3 sm:gap-4 h-full min-h-[400px]">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-zinc-400">
                                        <BarChart2 className="h-4 w-4" />
                                        <span className="text-sm font-medium">行业验证</span>
                                        
                                        {/* Sector Presets */}
                                        <div className="relative ml-2">
                                            <button 
                                                onClick={() => setShowSectorMenu(!showSectorMenu)}
                                                className="text-[10px] text-indigo-400 flex items-center gap-1 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20"
                                            >
                                                导入板块 <ChevronDown className="h-3 w-3" />
                                            </button>
                                            
                                            {showSectorMenu && (
                                                <div className="absolute top-full left-0 mt-1 w-32 bg-zinc-900 border border-zinc-700 rounded-md shadow-xl z-20 py-1 flex flex-col">
                                                    {Object.keys(SECTORS).map(sector => (
                                                        <button 
                                                            key={sector}
                                                            onClick={() => handleLoadSector(sector)}
                                                            className="text-left px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white"
                                                        >
                                                            {sector}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Watchlist Scroll & Add */}
                                    <div className="flex gap-2 items-center flex-1 justify-end min-w-0">
                                        <div className="flex gap-1 bg-zinc-900/50 p-1 rounded-lg border border-white/5 overflow-x-auto no-scrollbar max-w-[70%]">
                                            {currentWatchlist.map((stock: any) => (
                                                <div key={stock.symbol} className="relative group">
                                                    <button 
                                                        onClick={() => setChartSymbol(stock.symbol)}
                                                        className={`px-3 py-1 rounded text-[10px] font-bold font-mono transition-all whitespace-nowrap pr-5 ${
                                                            chartSymbol === stock.symbol 
                                                            ? 'bg-zinc-800 text-white shadow-sm border border-white/10' 
                                                            : 'text-zinc-500 hover:text-zinc-300'
                                                        }`}
                                                    >
                                                        {stock.name}
                                                    </button>
                                                    <button 
                                                        onClick={(e) => handleRemoveStock(stock.symbol, e)}
                                                        className="absolute right-1 top-1.5 text-zinc-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add Stock Button */}
                                        <div className="relative">
                                            <button 
                                                onClick={() => setIsAddStockOpen(!isAddStockOpen)}
                                                className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 border border-zinc-700"
                                            >
                                                <Plus className="h-3 w-3" />
                                            </button>
                                            {isAddStockOpen && (
                                                <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-20 p-3">
                                                    <div className="space-y-2">
                                                        <input 
                                                            placeholder="代码 (e.g 600030)" 
                                                            className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                                                            value={newStockCode}
                                                            onChange={e => setNewStockCode(e.target.value)}
                                                        />
                                                        <input 
                                                            placeholder="名称 (e.g 中信证券)" 
                                                            className="w-full bg-black border border-zinc-700 rounded px-2 py-1 text-xs text-white"
                                                            value={newStockName}
                                                            onChange={e => setNewStockName(e.target.value)}
                                                        />
                                                        <button 
                                                            onClick={handleAddStock}
                                                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs py-1 rounded font-bold"
                                                        >
                                                            添加
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex-1 glass-card rounded-lg overflow-hidden relative shadow-lg h-[400px] lg:h-auto"> 
                                    <KLineChart 
                                        symbol={chartSymbol} 
                                        data={visibleChartData} 
                                        height={450} 
                                        highlightDate={market?.replay_date} 
                                    />
                                </div>
                            </div>
                            
                            <div className="lg:col-span-4 flex flex-col h-full min-h-[300px]">
                                <div className="hidden lg:block h-8 mb-4"></div> 
                                <OrderList orders={orders || []} onCancel={handleCancelOrder} />
                            </div>
                        </div>

                        {/* Signals & Positions */}
                        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
                            <div className="xl:col-span-8 space-y-6">
                                <section>
                                    <div className="flex items-center justify-between mb-4 bg-zinc-900/40 p-2 rounded-lg border border-white/5">
                                        <h2 className="text-lg font-medium text-white flex items-center gap-2 pl-2">
                                            <TrendingUp className="h-5 w-5 text-emerald-500" />
                                            信号队列
                                        </h2>
                                        
                                        <div className="flex items-center gap-3">
                                            {/* Auto Scan/Play Toggle */}
                                            <button
                                                onClick={() => {
                                                    if (useRealBackend) setIsAutoScanning(!isAutoScanning);
                                                    else isSimPlaying ? handleSimPause() : handleSimPlay();
                                                }}
                                                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all border ${
                                                    isAutoActive 
                                                    ? 'bg-indigo-500/20 text-indigo-400 border-indigo-500/50 shadow-[0_0_10px_rgba(99,102,241,0.3)]' 
                                                    : 'bg-zinc-800 text-zinc-500 border-zinc-700 hover:text-zinc-300'
                                                }`}
                                                title={useRealBackend ? (isAutoActive ? "自动巡航中 (每10秒)" : "点击开启自动巡航") : (isAutoActive ? "回放进行中" : "点击开始回放")}
                                            >
                                                {isAutoActive 
                                                 ? <Pause className="h-3.5 w-3.5 text-indigo-400" /> 
                                                 : <Power className="h-3.5 w-3.5" />}
                                                {isAutoActive 
                                                    ? (useRealBackend ? 'AUTO: ON' : 'PLAYING') 
                                                    : (useRealBackend ? 'AUTO: OFF' : 'PAUSED')}
                                            </button>

                                            <div className="h-4 w-px bg-white/10"></div>

                                            {/* Manual Scan/Step Button */}
                                            <button
                                                onClick={() => {
                                                    if (useRealBackend) handleForceTick();
                                                    else handleSimStep();
                                                }}
                                                className="flex items-center gap-2 px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded shadow-lg border border-white/10 transition-all active:scale-95 hover:border-white/20"
                                                title={useRealBackend ? "立即触发全市场扫描" : "单步执行并扫描"}
                                            >
                                                {useRealBackend 
                                                 ? <ScanLine className="h-3.5 w-3.5 text-emerald-400" />
                                                 : <SkipForward className="h-3.5 w-3.5 text-emerald-400" />}
                                                {useRealBackend ? '立即扫描' : '单步扫描'}
                                            </button>

                                            {pendingIntents.length > 0 && (
                                                <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2 py-0.5 rounded border border-emerald-500/20 animate-pulse">
                                                    {pendingIntents.length} 待处理
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {pendingIntents.length === 0 ? (
                                        <div className="glass-panel rounded-lg p-8 flex flex-col items-center justify-center text-zinc-600 border-dashed border-zinc-800">
                                            <Activity className={`h-8 w-8 mb-3 opacity-20 ${isAutoActive ? 'animate-pulse text-indigo-500 opacity-50' : ''}`} />
                                            <p className="text-sm font-medium">
                                                {isAutoActive 
                                                    ? (useRealBackend ? "系统正在自动巡航中..." : "历史回放进行中...") 
                                                    : "等待扫描指令..."}
                                            </p>
                                            <p className="text-xs text-zinc-700 mt-1">
                                                {isAutoActive 
                                                    ? (useRealBackend ? "AI 正在实时监控盘口异动" : "策略正在逐日扫描历史数据") 
                                                    : (useRealBackend ? "点击上方“立即扫描”开始寻找机会" : "点击“播放”或“单步扫描”生成信号")}
                                            </p>
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
                                    <h2 className="text-lg font-medium text-white mb-4 pl-2">当前持仓</h2>
                                    <PositionTable 
                                        positions={positions || []} 
                                        config={audit?.active_config}
                                    />
                                </section>
                            </div>

                            <div className="xl:col-span-4">
                                <div className="sticky top-24">
                                    <EventLog events={events || []} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'analysis' && (
                    <div className="grid grid-cols-1 gap-6 animate-in fade-in">
                        <AIAuditPanel 
                            report={audit || {}} 
                            experimentResults={experiment_results || []}
                        />
                        <BehaviorAnalytics metrics={metrics || {}} />
                    </div>
                )}

                {activeTab === 'advisor' && (
                    <div className="max-w-4xl mx-auto animate-in fade-in">
                        <AIChatPanel 
                            messages={chatMessages}
                            onMessagesChange={setChatMessages}
                        />
                    </div>
                )}

            </main>
        </div>
    );
};

export default App;
