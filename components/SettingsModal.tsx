
import React, { useState, useEffect } from 'react';
import { X, User, Briefcase, Plus, Trash2, Shield, CheckCircle2 } from 'lucide-react';
import { authService, UserProfile, BrokerAccount } from '../services/authService';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
    const [user, setUser] = useState<UserProfile | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'brokers'>('brokers');
    const [newBrokerName, setNewBrokerName] = useState('中信证券');
    const [newAccountId, setNewAccountId] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            authService.fetchMe().then(setUser);
        }
    }, [isOpen]);

    const handleAddBroker = async () => {
        if (!newAccountId) return;
        setIsLoading(true);
        const success = await authService.addBroker(newBrokerName, newAccountId);
        if (success) {
            const updatedUser = await authService.fetchMe();
            setUser(updatedUser);
            setNewAccountId('');
        }
        setIsLoading(false);
    };

    const handleRemoveBroker = async (id: string) => {
        setIsLoading(true);
        const success = await authService.removeBroker(id);
        if (success) {
            const updatedUser = await authService.fetchMe();
            setUser(updatedUser);
        }
        setIsLoading(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="w-full max-w-2xl bg-[#09090b] border border-zinc-800 rounded-xl shadow-2xl flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <User className="h-5 w-5 text-indigo-500" /> 用户设置
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded transition-colors text-zinc-500 hover:text-white">
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-48 border-r border-zinc-800 bg-zinc-900/30 p-4 space-y-2 hidden sm:block">
                        <button 
                            onClick={() => setActiveTab('brokers')}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-all ${activeTab === 'brokers' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                        >
                            <Briefcase className="h-4 w-4" /> 券商绑定
                        </button>
                        <button 
                            onClick={() => setActiveTab('profile')}
                            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium transition-all ${activeTab === 'profile' ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-600/20' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'}`}
                        >
                            <User className="h-4 w-4" /> 个人资料
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {activeTab === 'brokers' && (
                            <div className="space-y-6">
                                <div>
                                    <h3 className="text-sm font-bold text-white mb-1">实盘券商配置</h3>
                                    <p className="text-xs text-zinc-500 mb-4">绑定您的实盘证券账户以启用 QMT 自动交易功能。</p>
                                    
                                    <div className="glass-panel rounded-lg p-4 border border-zinc-800 space-y-4">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 block mb-1.5">券商名称</label>
                                                <select 
                                                    value={newBrokerName}
                                                    onChange={(e) => setNewBrokerName(e.target.value)}
                                                    className="w-full bg-black border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                                                >
                                                    <option value="中信证券">中信证券 (CITIC)</option>
                                                    <option value="国泰君安">国泰君安 (GTJA)</option>
                                                    <option value="华泰证券">华泰证券 (Huatai)</option>
                                                    <option value="招商证券">招商证券 (CMS)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-zinc-500 block mb-1.5">资金账号</label>
                                                <input 
                                                    type="text" 
                                                    value={newAccountId}
                                                    onChange={(e) => setNewAccountId(e.target.value)}
                                                    placeholder="请输入资金账号"
                                                    className="w-full bg-black border border-zinc-700 rounded px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={handleAddBroker}
                                            disabled={isLoading || !newAccountId}
                                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 rounded text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <Plus className="h-4 w-4" /> 绑定新账户
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-3">已绑定账户</h3>
                                    <div className="space-y-3">
                                        {user?.broker_accounts && user.broker_accounts.length > 0 ? (
                                            user.broker_accounts.map((acc, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-3 rounded bg-zinc-900 border border-zinc-800">
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-8 w-8 rounded bg-emerald-900/30 flex items-center justify-center border border-emerald-500/20">
                                                            <Shield className="h-4 w-4 text-emerald-500" />
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-zinc-200">{acc.broker_name}</div>
                                                            <div className="text-xs text-zinc-500 font-mono">ID: {acc.account_id} | Stock</div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-[10px] text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                                                            <CheckCircle2 className="h-3 w-3" /> 已连接
                                                        </span>
                                                        <button 
                                                            onClick={() => handleRemoveBroker(acc.account_id)}
                                                            className="p-1.5 text-zinc-600 hover:text-rose-500 hover:bg-rose-500/10 rounded transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-6 text-zinc-600 text-sm border border-dashed border-zinc-800 rounded">
                                                暂无绑定账户
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'profile' && (
                            <div className="space-y-4">
                                <h3 className="text-sm font-bold text-white">基本信息</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-zinc-900 p-3 rounded border border-zinc-800">
                                        <div className="text-xs text-zinc-500 mb-1">用户名</div>
                                        <div className="text-sm text-white font-mono">{user?.username}</div>
                                    </div>
                                    <div className="bg-zinc-900 p-3 rounded border border-zinc-800">
                                        <div className="text-xs text-zinc-500 mb-1">全名</div>
                                        <div className="text-sm text-white">{user?.full_name || '-'}</div>
                                    </div>
                                    <div className="bg-zinc-900 p-3 rounded border border-zinc-800">
                                        <div className="text-xs text-zinc-500 mb-1">角色权限</div>
                                        <div className="text-sm text-emerald-400 font-bold uppercase">{user?.role}</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;
