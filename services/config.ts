// Configuration for Backend Selection

// Check if we are running in a mode that expects a Python backend
// In a real build, this might be controlled by .env variables (VITE_USE_REAL_BACKEND)
const USE_REAL_BACKEND_DEFAULT = (import.meta as any).env?.VITE_USE_REAL_BACKEND === 'true';

export const config = {
    useRealBackend: USE_REAL_BACKEND_DEFAULT,
    apiBaseUrl: 'http://localhost:8000/api',
    
    // Feature Flags
    enableGemini: true,
    enableRealMarketData: true,
};

export const setBackendMode = (useReal: boolean) => {
    config.useRealBackend = useReal;
    // Persist preference if needed
    localStorage.setItem('use_real_backend', String(useReal));
};

// Initial load
const saved = localStorage.getItem('use_real_backend');
if (saved !== null) {
    config.useRealBackend = saved === 'true';
}