
// Configuration for Backend Selection

// Safe access to environment variables with fallback to prevent runtime crashes
// @ts-ignore - Bypass TS check for import.meta if types are missing in some environments
const meta = import.meta as any;
const env = (meta && meta.env) || {};

// Check if we are running in a mode that expects a Python backend
// Docker build sets VITE_USE_REAL_BACKEND=true
const USE_REAL_BACKEND_DEFAULT = env.VITE_USE_REAL_BACKEND === 'true';

export const config = {
    useRealBackend: USE_REAL_BACKEND_DEFAULT,
    // IMPORTANT: In production (behind Nginx), we use relative path '/api'.
    // Nginx will forward '/api' to 'http://localhost:8000/api'.
    // This allows access from mobile without CORS issues or hardcoding IP.
    apiBaseUrl: '/api',
    
    // Feature Flags
    enableGemini: true,
    enableRealMarketData: true,
};

export const setBackendMode = (useReal: boolean) => {
    config.useRealBackend = useReal;
    localStorage.setItem('use_real_backend', String(useReal));
};

// Initial load - LocalStorage overrides Env var if present (user preference)
const saved = localStorage.getItem('use_real_backend');
if (saved !== null) {
    config.useRealBackend = saved === 'true';
}
