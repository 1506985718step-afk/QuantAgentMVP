
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
            content: '你好，我是 **DeepSeek Quant**。随时准备为您分析趋势或讨论策略逻辑。' 
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
                    body: JSON.stringify({ history: [...messages, userMsg].slice(-10) })
                });

                if (response.ok) {
                    const data = await response.json();
                    setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
                } else {
                    setMessages(prev => [...prev, { role: 'assistant', content: '连接错误。' }]);
                }
            } else {
                await new Promise(r => setTimeout(r, 1000));
                setMessages(prev => [...prev, { role: 'assistant', content: '模拟模式：AI 聊天需连接真实后端。' }]);
            }
        } catch (e) {
            setMessages(prev => [...prev, { role: 'assistant', content: '网络错误。' }]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="glass-panel rounded-lg h-[600px] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/5 bg-white/[0.02] px-4 py-3">
                <div className="flex items-center gap-2">
                    <BrainCircuit className="h-4 w-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-zinc-200">DeepSeek 投资顾问</h3>
                </div>
                <button onClick={() => setMessages([messages[0]])} className="p-2 text-zinc-500 hover:text-white transition-colors" title="清除对话">
                    <Eraser className="h-4 w-4" />
                </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#050505]">
                {messages.map((msg, idx) => {
                    const isAi = msg.role === 'assistant';
                    return (
                        <div key={idx} className={`flex gap-3 ${isAi ? 'justify-start' : 'justify-end'}`}>
                            {isAi && (
                                <div className="h-8 w-8 rounded bg-indigo-600 flex items-center justify-center shrink-0">
                                    <Bot className="h-5 w-5 text-white" />
                                </div>
                            )}
                            
                            <div className={`max-w-[80%] rounded px-4 py-2 text-sm leading-relaxed ${
                                isAi 
                                ? 'bg-zinc-800 text-zinc-200 border border-zinc-700' 
                                : 'bg-white text-black font-medium'
                            }`}>
                                <div className="markdown-body whitespace-pre-wrap">{msg.content}</div>
                            </div>

                            {!isAi && (
                                <div className="h-8 w-8 rounded bg-zinc-700 flex items-center justify-center shrink-0">
                                    <User className="h-5 w-5 text-zinc-300" />
                                </div>
                            )}
                        </div>
                    );
                })}
                {isLoading && (
                    <div className="flex gap-3 justify-start items-center text-zinc-500 text-xs pl-12">
                        <Loader2 className="h-3 w-3 animate-spin" /> 思考中...
                    </div>
                )}
            </div>

            <div className="p-3 border-t border-white/5 bg-zinc-900/50 flex gap-2">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="询问策略逻辑或市场走势..."
                    className="flex-1 bg-black border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:border-indigo-500 focus:outline-none"
                    disabled={isLoading}
                />
                <button onClick={handleSend} disabled={!input.trim() || isLoading} className="p-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-50">
                    <Send className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
};

export default AIChatPanel;
