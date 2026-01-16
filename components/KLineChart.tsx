import React, { useMemo, useState, useRef, useEffect } from 'react';
import { BarData } from '../services/historicalData';

interface KLineChartProps {
    symbol: string;
    data: BarData[];
    height?: number;
    highlightDate?: string;
}

const KLineChart: React.FC<KLineChartProps> = ({ symbol, data, height = 300, highlightDate }) => {
    const [hoverData, setHoverData] = useState<BarData | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(600);

    // Responsive Width Handler
    useEffect(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.contentRect.width > 0) {
                    setWidth(entry.contentRect.width);
                }
            }
        });
        resizeObserver.observe(containerRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    // Layout config
    const padding = { top: 20, right: 50, bottom: 25, left: 10 };
    
    // Calculations
    const { minPrice, maxPrice, priceRange } = useMemo(() => {
        if (data.length === 0) return { minPrice: 0, maxPrice: 100, priceRange: 100 };
        const min = Math.min(...data.map(d => d.low));
        const max = Math.max(...data.map(d => d.high));
        // Add 10% padding top/bottom
        const range = max - min;
        return { 
            minPrice: min - range * 0.1, 
            maxPrice: max + range * 0.1, 
            priceRange: range * 1.2 
        };
    }, [data]);

    const getY = (price: number) => {
        if (priceRange === 0) return padding.top + (height - padding.top - padding.bottom) / 2;
        return padding.top + ((maxPrice - price) / priceRange) * (height - padding.top - padding.bottom);
    };

    const candleWidth = (width - padding.left - padding.right) / Math.max(1, data.length);
    const gap = candleWidth * 0.3;
    const barW = Math.max(1, candleWidth - gap);

    if (data.length === 0) return (
        <div className="flex h-full w-full items-center justify-center rounded-lg border border-slate-800 bg-slate-900/50 text-slate-500 text-xs">
            暂无 K 线数据
        </div>
    );

    return (
        <div ref={containerRef} className="relative w-full h-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900 shadow-sm group">
            {/* Legend / Status Overlay */}
            <div className="absolute top-2 right-2 flex gap-3 text-[10px] font-mono text-slate-500 z-10 bg-slate-900/80 px-2 py-1 rounded backdrop-blur-sm border border-slate-800">
                 <div className="flex items-center gap-1"><div className="w-2 h-2 bg-rose-500 rounded-sm"></div> 涨</div>
                 <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-sm"></div> 跌</div>
                 <div className="flex items-center gap-1"><div className="w-3 h-0.5 bg-amber-500"></div> MA20</div>
            </div>

            {/* Hover Tooltip - Floating */}
            {hoverData && (
                <div className="absolute top-2 left-2 z-20 pointer-events-none">
                    <div className="rounded-lg bg-slate-950/90 px-3 py-2 text-[10px] font-mono text-slate-300 border border-slate-700 shadow-xl backdrop-blur-md">
                        <div className="flex gap-4 items-center mb-1 pb-1 border-b border-slate-800">
                            <span className="font-bold text-slate-100">{hoverData.date}</span>
                            <span className="text-indigo-400">Vol: {hoverData.volume.toLocaleString()}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-x-3 gap-y-0.5">
                            <span className="text-slate-500">O:</span> <span className={hoverData.open > hoverData.close ? 'text-emerald-400' : 'text-rose-400'}>{hoverData.open.toFixed(2)}</span>
                            <span className="text-slate-500">H:</span> <span>{hoverData.high.toFixed(2)}</span>
                            <span className="text-slate-500">L:</span> <span>{hoverData.low.toFixed(2)}</span>
                            <span className="text-slate-500">C:</span> <span className="font-bold">{hoverData.close.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
            )}

            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full" preserveAspectRatio="none">
                {/* Y-Axis Grid & Labels */}
                {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                    const y = padding.top + pct * (height - padding.top - padding.bottom);
                    const price = maxPrice - pct * priceRange;
                    return (
                        <g key={i}>
                            <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
                            <text x={width - 5} y={y + 3} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="monospace" fontWeight="500">
                                {price.toFixed(2)}
                            </text>
                        </g>
                    );
                })}

                {/* Candles */}
                {data.map((bar, i) => {
                    const x = padding.left + i * candleWidth;
                    const centerX = x + candleWidth / 2;
                    const yOpen = getY(bar.open);
                    const yClose = getY(bar.close);
                    const yHigh = getY(bar.high);
                    const yLow = getY(bar.low);
                    
                    const isUp = bar.close >= bar.open;
                    const color = isUp ? '#f43f5e' : '#10b981'; // Rose : Emerald
                    
                    // MA20 Line
                    const prevBar = data[i - 1];
                    let maLine = null;
                    if (prevBar) {
                        const x1 = padding.left + (i - 1) * candleWidth + candleWidth / 2;
                        const y1 = getY(prevBar.ma20);
                        const y2 = getY(bar.ma20);
                        maLine = <line x1={x1} y1={y1} x2={centerX} y2={y2} stroke="#f59e0b" strokeWidth="1.5" strokeOpacity="0.8" />;
                    }

                    const isHighlighted = highlightDate === bar.date;

                    return (
                        <g 
                            key={i} 
                            onMouseEnter={() => setHoverData(bar)}
                            onMouseLeave={() => setHoverData(null)}
                            className="cursor-crosshair transition-opacity hover:opacity-100 opacity-90"
                        >
                             {/* Highlight Background */}
                             {isHighlighted && (
                                <rect 
                                    x={x + gap/2} 
                                    y={padding.top} 
                                    width={barW} 
                                    height={height - padding.top - padding.bottom} 
                                    fill="#6366f1" 
                                    fillOpacity="0.1" 
                                />
                            )}
                             
                             {/* Hover Column Indicator */}
                             <rect 
                                x={x} 
                                y={padding.top} 
                                width={candleWidth} 
                                height={height - padding.top - padding.bottom} 
                                fill="transparent"
                                className="hover:fill-slate-800/30"
                            />

                            {/* Wick */}
                            <line x1={centerX} y1={yHigh} x2={centerX} y2={yLow} stroke={color} strokeWidth="1" />
                            
                            {/* Body */}
                            <rect 
                                x={centerX - barW/2} 
                                y={Math.min(yOpen, yClose)} 
                                width={barW} 
                                height={Math.max(1, Math.abs(yOpen - yClose))} 
                                fill={color} 
                            />

                            {/* MA Line Segment */}
                            {maLine}
                            
                            {/* Highlight Dot */}
                            {isHighlighted && (
                                <circle cx={centerX} cy={yHigh - 8} r="2" fill="#fff" />
                            )}
                        </g>
                    );
                })}
            </svg>
        </div>
    );
};

export default KLineChart;