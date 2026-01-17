
import React, { useState } from 'react';
import { Activity, Lock, User, ArrowRight, ShieldCheck, Mail } from 'lucide-react';
import { authService } from '../services/authService';

interface AuthPageProps {
    onLoginSuccess: () => void;
}

const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            if (isLogin) {
                const success = await authService.login(username, password);
                if (success) {
                    onLoginSuccess();
                } else {
                    setError('用户名或密码错误');
                }
            } else {
                const success = await authService.register(username, password, fullName);
                if (success) {
                    onLoginSuccess();
                } else {
                    setError('注册失败，用户名可能已存在');
                }
            }
        } catch (err) {
            setError('网络错误，请稍后重试');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[#09090b]">
             {/* Background Effects */}
             <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                 <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-600/20 blur-[100px] rounded-full"></div>
                 <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 blur-[100px] rounded-full"></div>
             </div>

            <div className="w-full max-w-md p-6 relative z-10">
                <div className="text-center mb-8">
                    <div className="flex justify-center mb-4">
                        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-indigo-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                            <Activity className="h-7 w-7 text-white" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight mb-2">QuantAgent MVP</h1>
                    <p className="text-zinc-400 text-sm">专业级 AI 量化投研终端</p>
                </div>

                <div className="glass-card rounded-2xl p-8 border border-white/10 shadow-2xl backdrop-blur-xl bg-zinc-900/60">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        {isLogin ? '欢迎回来' : '创建新账户'}
                        {isLogin && <ShieldCheck className="h-4 w-4 text-emerald-500" />}
                    </h2>

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5 ml-1">用户名</label>
                            <div className="relative group">
                                <User className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                                <input 
                                    type="text" 
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    className="w-full bg-black/40 border border-zinc-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600"
                                    placeholder="输入您的用户名"
                                    required
                                />
                            </div>
                        </div>

                        {!isLogin && (
                             <div>
                                <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5 ml-1">全名 (可选)</label>
                                <div className="relative group">
                                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                                    <input 
                                        type="text" 
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        className="w-full bg-black/40 border border-zinc-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600"
                                        placeholder="用于显示昵称"
                                    />
                                </div>
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-zinc-500 uppercase mb-1.5 ml-1">密码</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500 group-focus-within:text-indigo-400 transition-colors" />
                                <input 
                                    type="password" 
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full bg-black/40 border border-zinc-700 rounded-lg py-2 pl-10 pr-4 text-sm text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-zinc-600"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg flex items-center gap-2">
                                <Activity className="h-3 w-3" /> {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={isLoading}
                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-lg transition-all flex items-center justify-center gap-2 mt-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                        >
                            {isLoading ? '处理中...' : (isLogin ? '安全登录' : '立即注册')}
                            {!isLoading && <ArrowRight className="h-4 w-4" />}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <p className="text-zinc-500 text-xs">
                            {isLogin ? "还没有账号？" : "已有账号？"}
                            <button 
                                onClick={() => { setIsLogin(!isLogin); setError(''); }}
                                className="text-indigo-400 hover:text-indigo-300 ml-1 font-bold underline decoration-indigo-500/30 underline-offset-4"
                            >
                                {isLogin ? "立即注册" : "去登录"}
                            </button>
                        </p>
                    </div>
                </div>
                
                <p className="text-center text-[10px] text-zinc-600 mt-6 font-mono">
                    Protected by Bcrypt & JWT • 256-bit Encryption
                </p>
            </div>
        </div>
    );
};

export default AuthPage;
