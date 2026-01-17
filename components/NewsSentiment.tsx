
import React from 'react';
import { Newspaper, Zap } from 'lucide-react';
import { NewsItem } from '../types';

interface NewsSentimentProps {
    news: NewsItem[];
    sentimentScore: number;
    aiComment?: string;
}

const NewsSentiment: React.FC<NewsSentimentProps> = ({ news, sentimentScore, aiComment }) => {
    // Score Bar
    const scoreColor = sentimentScore > 60 ? 'bg-emerald-500' : sentimentScore < 40 ? 'bg-rose-500' : 'bg-zinc-500';

    return (
        <div className="glass-panel rounded-lg h-full flex flex-col md:flex-row overflow-hidden">
            {/* AI Insight */}
            <div className="p-4 md:w-1/3 border-b md:border-b-0 md:border-r border-white/5 bg-zinc-900/30">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-zinc-500 uppercase flex items-center gap-1">
                        <Zap className="h-3 w-3 text-amber-500" /> 宏观 AI 简评
                    </span>
                    <div className="flex gap-0.5 h-1.5 w-10">
                        <div className={`h-full flex-1 rounded-l-sm ${scoreColor}`} style={{opacity: 0.3}}></div>
                        <div className={`h-full flex-1 ${scoreColor}`} style={{opacity: 0.6}}></div>
                        <div className={`h-full flex-1 rounded-r-sm ${scoreColor}`}></div>
                    </div>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed font-sans line-clamp-4">
                    {aiComment || "正在分析市场实时数据流..."}
                </p>
            </div>

            {/* News Feed */}
            <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#09090b]">
                {news.length === 0 ? (
                     <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                        暂无重大新闻
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {news.map((item) => (
                            <div key={item.id} className="p-3 hover:bg-white/[0.02] transition-colors">
                                <div className="flex justify-between items-start gap-2 mb-1">
                                    <h4 className="text-xs font-medium text-zinc-200 line-clamp-1">
                                        {item.title}
                                    </h4>
                                    <span className={`text-[9px] px-1 rounded font-bold uppercase shrink-0 ${
                                        item.sentiment === 'positive' ? 'text-emerald-500 bg-emerald-500/10' :
                                        item.sentiment === 'negative' ? 'text-rose-500 bg-rose-500/10' :
                                        'text-zinc-500 bg-zinc-800'
                                    }`}>
                                        {item.sentiment === 'positive' ? '利好' : item.sentiment === 'negative' ? '利空' : '中性'}
                                    </span>
                                </div>
                                <div className="flex gap-2 text-[10px] text-zinc-600 font-mono">
                                    <span>{item.time.split('T')[1]?.slice(0,5)}</span>
                                    <span>{item.source}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewsSentiment;
