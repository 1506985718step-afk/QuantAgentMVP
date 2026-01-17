
import React, { useEffect, useRef } from 'react';
import { createChart, ColorType, CrosshairMode, IChartApi, ISeriesApi } from 'lightweight-charts';
import { BarData } from '../services/historicalData';

interface KLineChartProps {
    symbol: string;
    data: BarData[];
    height?: number;
    highlightDate?: string;
}

const KLineChart: React.FC<KLineChartProps> = ({ symbol, data, height = 450, highlightDate }) => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
    const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

    // 1. Initialize Chart Only Once
    useEffect(() => {
        if (!chartContainerRef.current) return;

        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#09090b' },
                textColor: '#71717a',
            },
            grid: {
                vertLines: { color: 'rgba(255, 255, 255, 0.05)' },
                horzLines: { color: 'rgba(255, 255, 255, 0.05)' },
            },
            width: chartContainerRef.current.clientWidth,
            height: height,
            crosshair: { mode: CrosshairMode.Normal },
            rightPriceScale: { borderColor: 'rgba(255, 255, 255, 0.1)' },
            timeScale: { borderColor: 'rgba(255, 255, 255, 0.1)', timeVisible: true },
        });

        const candlestickSeries = chart.addCandlestickSeries({
            upColor: '#ef4444', downColor: '#10b981',
            borderVisible: false, wickUpColor: '#ef4444', wickDownColor: '#10b981',
        });

        const volumeSeries = chart.addHistogramSeries({
            priceFormat: { type: 'volume' },
            priceScaleId: '', 
        });
        volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

        const maSeries = chart.addLineSeries({
            color: '#fbbf24', lineWidth: 1, lineStyle: 0, title: 'MA20'
        });

        chartRef.current = chart;
        candleSeriesRef.current = candlestickSeries;
        volumeSeriesRef.current = volumeSeries;
        maSeriesRef.current = maSeries;

        // Efficient Resizing via Observer
        const resizeObserver = new ResizeObserver(entries => {
            if (entries.length === 0 || !entries[0].contentRect) return;
            const newRect = entries[0].contentRect;
            chart.applyOptions({ width: newRect.width, height: newRect.height });
        });
        
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            chart.remove();
        };
    }, []); // Run once on mount

    // 2. Update Data Independently
    useEffect(() => {
        if (!chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current || !maSeriesRef.current) return;
        if (data.length === 0) return;

        const candleData = data.map(d => ({
            time: d.date, open: d.open, high: d.high, low: d.low, close: d.close
        }));

        const volumeData = data.map(d => ({
            time: d.date, value: d.volume,
            color: d.close >= d.open ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)',
        }));
        
        const maData = data.map(d => ({
            time: d.date, value: d.ma20
        })).filter(d => d.value > 0);

        candleSeriesRef.current.setData(candleData);
        volumeSeriesRef.current.setData(volumeData);
        maSeriesRef.current.setData(maData);

        // Handle Highlight
        if (highlightDate) {
             const index = data.findIndex(d => d.date === highlightDate);
             if (index !== -1) {
                 const visibleRange = 60;
                 const fromIndex = Math.max(0, index - visibleRange + 10);
                 const toIndex = Math.min(data.length - 1, index + 5);
                 
                 if (data[fromIndex] && data[toIndex]) {
                     chartRef.current.timeScale().setVisibleRange({
                         from: data[fromIndex].date,
                         to: data[toIndex].date
                     });
                 }
             }
        }
    }, [data, highlightDate]);

    // Handle Height Prop Change explicitly if needed (though resize observer handles container size)
    useEffect(() => {
        if (chartRef.current && height) {
             chartRef.current.applyOptions({ height });
        }
    }, [height]);

    if (data.length === 0) {
        return (
            <div className="flex h-full w-full items-center justify-center text-zinc-600 text-xs font-mono bg-[#09090b] rounded-lg border border-white/5">
                等待数据源...
            </div>
        );
    }

    return (
        <div className="relative w-full h-full bg-[#09090b] rounded-lg border border-white/5 overflow-hidden shadow-inner">
             <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
                 <span className="text-zinc-400 font-bold font-mono text-xs bg-zinc-900/80 px-2 py-1 rounded border border-zinc-800">
                     {symbol}
                 </span>
                 <span className="text-amber-500 font-bold font-mono text-[10px] flex items-center gap-1">
                     <div className="w-2 h-0.5 bg-amber-500"></div> MA20
                 </span>
             </div>
            <div ref={chartContainerRef} className="w-full h-full" />
        </div>
    );
};

export default KLineChart;
