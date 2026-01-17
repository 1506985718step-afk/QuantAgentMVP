
// Configuration for Backend Selection

// Check if we are running in a mode that expects a Python backend
// In a real build, this might be controlled by .env variables (VITE_USE_REAL_BACKEND)
// CHANGED: Default to false for MVP Simulation/Training mode
const USE_REAL_BACKEND_DEFAULT = false; 

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

// Initial load
const saved = localStorage.getItem('use_real_backend');
if (saved !== null) {
    config.useRealBackend = saved === 'true';
}
