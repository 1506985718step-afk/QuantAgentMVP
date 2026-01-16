import requests
from typing import Dict, Any, List

class SinaDataProvider:
    """
    Fetch Real-Time A-Share Data from Sina Finance Interface.
    URL Format: http://hq.sinajs.cn/list=sh600519,sz000001
    """
    
    BASE_URL = "http://hq.sinajs.cn/list="
    
    def get_realtime_data(self, symbols: List[str]) -> Dict[str, Any]:
        """
        Input: ['000001', '600519'] (Raw codes)
        Output: Dictionary of market data
        """
        # 1. Format codes for Sina (sh=Shanghai, sz=Shenzhen)
        # Simple heuristic: 6 starts = sh, others = sz (simplified)
        sina_codes = []
        mapping = {}
        
        for sym in symbols:
            prefix = "sh" if sym.startswith("6") else "sz"
            code = f"{prefix}{sym}"
            sina_codes.append(code)
            mapping[code] = sym

        query_str = ",".join(sina_codes)
        url = f"{self.BASE_URL}{query_str}"
        
        headers = {
            "Referer": "https://finance.sina.com.cn", 
            "User-Agent": "QuantAgent/MVP"
        }

        try:
            resp = requests.get(url, headers=headers, timeout=2.0)
            if resp.status_code != 200:
                print(f"Sina API Error: {resp.status_code}")
                return {}
                
            results = {}
            content = resp.text # e.g., var hq_str_sh600519="贵州茅台,1700.00,..."
            
            lines = content.strip().split("\n")
            for line in lines:
                if not line: continue
                
                # Parse: var hq_str_sh600519="Data..."
                try:
                    left, right = line.split('=')
                    code_with_prefix = left.split('_')[-1] # sh600519
                    raw_data = right.strip('"').strip('";')
                    
                    parts = raw_data.split(',')
                    if len(parts) < 30: continue
                    
                    symbol = mapping.get(code_with_prefix)
                    if not symbol: continue

                    # Sina Data Format:
                    # 0: Name, 1: Open, 2: PreClose, 3: Current, 4: High, 5: Low
                    name = parts[0]
                    open_px = float(parts[1])
                    pre_close = float(parts[2])
                    current = float(parts[3])
                    high = float(parts[4])
                    low = float(parts[5])
                    volume = float(parts[8]) # Shares
                    amount = float(parts[9]) # Money
                    date = parts[30]
                    time = parts[31]
                    
                    # Calculate change
                    change = current - pre_close
                    pct = (change / pre_close * 100) if pre_close > 0 else 0
                    
                    results[symbol] = {
                        "symbol": symbol,
                        "name": name,
                        "price": current,
                        "open": open_px,
                        "high": high,
                        "low": low,
                        "close": current, # Current is close for now
                        "pre_close": pre_close,
                        "volume": volume,
                        "amount": amount,
                        "change_pct": round(pct, 2),
                        "time": f"{date} {time}"
                    }
                except Exception as e:
                    print(f"Parse error for line: {line[:20]}... {e}")
                    continue
            
            return results

        except Exception as e:
            print(f"Network error fetching Sina data: {e}")
            return {}

sina_provider = SinaDataProvider()
