
import { config } from './config';

const API_BASE = config.apiBaseUrl;

export interface BrokerAccount {
    broker_name: string;
    account_id: string;
    account_type: string;
    status: string;
}

export interface UserProfile {
    username: string;
    full_name?: string;
    role: string;
    broker_accounts: BrokerAccount[];
}

export const authService = {
    async login(username: string, password: string): Promise<boolean> {
        if (!config.useRealBackend) {
            // Mock Login
            if (username && password) {
                localStorage.setItem('quant_token', 'mock_token');
                localStorage.setItem('quant_user', JSON.stringify({ 
                    username, 
                    role: 'trader', 
                    broker_accounts: [{broker_name: "Mock Sec", account_id: "888888", account_type: "stock", status: "connected"}] 
                }));
                return true;
            }
            return false;
        }

        const formData = new FormData();
        formData.append('username', username);
        formData.append('password', password);

        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                body: formData,
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('quant_token', data.access_token);
                await this.fetchMe();
                return true;
            }
            return false;
        } catch (e) {
            console.error("Login failed", e);
            return false;
        }
    },

    async register(username: string, password: string, fullName: string): Promise<boolean> {
        if (!config.useRealBackend) {
            localStorage.setItem('quant_token', 'mock_token');
            localStorage.setItem('quant_user', JSON.stringify({ username, full_name: fullName, role: 'trader', broker_accounts: [] }));
            return true;
        }

        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, full_name: fullName }),
            });

            if (res.ok) {
                const data = await res.json();
                localStorage.setItem('quant_token', data.access_token);
                await this.fetchMe();
                return true;
            }
            return false;
        } catch (e) {
            console.error("Registration failed", e);
            return false;
        }
    },

    async fetchMe(): Promise<UserProfile | null> {
        const token = localStorage.getItem('quant_token');
        if (!token) return null;
        
        if (!config.useRealBackend) {
             const u = localStorage.getItem('quant_user');
             return u ? JSON.parse(u) : { username: 'MockUser', role: 'trader', broker_accounts: [] };
        }

        try {
            const res = await fetch(`${API_BASE}/users/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const user = await res.json();
                localStorage.setItem('quant_user', JSON.stringify(user));
                return user;
            }
        } catch (e) {}
        return null;
    },

    async addBroker(brokerName: string, accountId: string): Promise<boolean> {
        if (!config.useRealBackend) return true;
        const token = this.getToken();
        if (!token) return false;

        try {
            const res = await fetch(`${API_BASE}/users/brokers/add`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    broker_name: brokerName,
                    account_id: accountId,
                    account_type: "stock"
                })
            });
            if (res.ok) {
                await this.fetchMe();
                return true;
            }
        } catch (e) {}
        return false;
    },

    async removeBroker(accountId: string): Promise<boolean> {
        if (!config.useRealBackend) return true;
        const token = this.getToken();
        if (!token) return false;

        try {
             const res = await fetch(`${API_BASE}/users/brokers/remove`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ account_id: accountId })
            });
            if (res.ok) {
                await this.fetchMe();
                return true;
            }
        } catch (e) {}
        return false;
    },

    logout() {
        localStorage.removeItem('quant_token');
        localStorage.removeItem('quant_user');
        window.location.reload();
    },

    getToken() {
        return localStorage.getItem('quant_token');
    },

    isAuthenticated() {
        return !!localStorage.getItem('quant_token');
    }
};
