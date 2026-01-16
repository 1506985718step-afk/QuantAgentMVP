import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, BrainCircuit, Loader2, Eraser } from 'lucide-react';
import { config } from '../services/config';

interface ChatMessage {
    role: 'user' | 'assistant';
    content: string;
}

const AIChatPanel: React.FC = () => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { 
            role: 'assistant', 
            content: '你好！我是 **DeepSeek Quant**。作为你的专属量化投资顾问，我可以帮你解读市场情绪、分析策略逻辑，或者聊聊你的交易心态。\n\n*请注意：我不做具体个股推荐，让我们专注于提升你的交易体系。*' 
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: ChatMessage = { role: 'user', content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setIsLoading(true);

        try {
            if (config.useRealBackend) {
                const response = await fetch(`${config.apiBaseUrl}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        history: [...messages, userMsg].slice(-10) // Send last 10 messages for context
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 连接服务器失败，请检查网络或后端日志。' }]);
                }
            } else {
                // Mock Response
                await new Promise(r => setTimeout(r, 1000));
                setMessages(prev => [...prev, { 
                    role: 'assistant', 
                    content: '当前处于 **浏览器模拟模式**。请连接 Python 后端 (Port 8000) 以启用 DeepSeek 实时对话功能。\n\n在模拟模式下，我只能做这些简单的回应。' 
                }]);
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ 发生错误，无法连接到 AI 服务。' }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex h-[600px] flex-col rounded-xl border border-slate-800 bg-slate-900 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/50 px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
                        <BrainCircuit className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-100">AI 投资专家</h3>
                        <div className="flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            <span className="text-xs text-slate-500">DeepSeek V3 Online</span>
                        </div>
                    </div>
                </div>
                <button 
                    onClick={() => setMessages([messages[0]])}
                    className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded transition-colors"
                    title="清空对话"
                >
                    <Eraser className="h-4 w-4" />
                </button>
            </div>

            {/* Chat Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-slate-900">
                {messages.map((msg, idx) => {
                    const isAi = msg.role === 'assistant';
                    return (
                        <div key={idx} className={`flex gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}>
                            {isAi && (
                                <div className="flex-shrink-0 mt-1">
                                    <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center shadow-md">
                                        <Bot className="h-5 w-5 text-white" />
                                    </div>
                                </div>
                            )}
                            
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                                isAi 
                                ? 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700/50' 
                                : 'bg-indigo-600 text-white rounded-tr-none'
                            }`}>
                                <div className="markdown-body whitespace-pre-wrap font-sans">
                                    {msg.content}
                                </div>
                            </div>

                            {!isAi && (
                                <div className="flex-shrink-0 mt-1">
                                    <div className="h-8 w-8 rounded-full bg-slate-700 flex items-center justify-center">
                                        <User className="h-5 w-5 text-slate-300" />
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
                {isLoading && (
                    <div className="flex gap-3 justify-start">
                         <div className="flex-shrink-0 mt-1">
                            <div className="h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center">
                                <Bot className="h-5 w-5 text-white" />
                            </div>
                        </div>
                        <div className="bg-slate-800 rounded-2xl rounded-tl-none px-4 py-3 border border-slate-700/50 flex items-center gap-2 text-slate-400 text-sm">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>DeepSeek 正在思考...</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Input Area */}
            <div className="border-t border-slate-800 bg-slate-950 p-4">
                <div className="relative flex items-center gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="输入关于市场、策略或心态的问题..."
                        className="flex-1 bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-slate-600"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors shadow-lg"
                    >
                        <Send className="h-4 w-4" />
                    </button>
                </div>
                <div className="text-center mt-2">
                    <p className="text-[10px] text-slate-600">
                        AI生成内容仅供参考，不构成投资建议。量化交易存在风险，入市需谨慎。
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AIChatPanel;
