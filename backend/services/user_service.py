
import json
import os
from typing import Optional, Dict, List
from pydantic import BaseModel
from ..core.security import get_password_hash, verify_password

USERS_FILE = "data/users.json"

class BrokerAccount(BaseModel):
    broker_name: str  # e.g., "中信证券", "国泰君安"
    account_id: str   # e.g., "8880001"
    account_type: str # e.g., "stock", "margin", "futures"
    status: str = "connected" # connected | disconnected

class UserInDB(BaseModel):
    username: str
    hashed_password: str
    full_name: Optional[str] = None
    role: str = "trader"
    created_at: str
    broker_accounts: List[BrokerAccount] = []

class UserService:
    def __init__(self):
        self.users: Dict[str, UserInDB] = self._load_users()
        self._ensure_default_user()

    def _load_users(self) -> Dict[str, UserInDB]:
        if not os.path.exists(USERS_FILE):
            return {}
        try:
            with open(USERS_FILE, "r", encoding='utf-8') as f:
                data = json.load(f)
                return {k: UserInDB(**v) for k, v in data.items()}
        except Exception as e:
            print(f"Error loading users: {e}")
            return {}

    def _save_users(self):
        os.makedirs("data", exist_ok=True)
        with open(USERS_FILE, "w", encoding='utf-8') as f:
            data = {k: v.model_dump() for k, v in self.users.items()}
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _ensure_default_user(self):
        """Seed a default user from ENV variables for production safety"""
        if not self.users:
            admin_user = os.getenv("ADMIN_USER", "admin")
            admin_pass = os.getenv("ADMIN_PASSWORD", "admin123")
            
            print(f">>> System: Initializing default admin user: {admin_user}")
            self.create_user(admin_user, admin_pass, "系统管理员")
            
            if admin_pass == "admin123":
                print(">>> WARNING: Using insecure default password. Set ADMIN_PASSWORD in .env for production.")

    def get_user(self, username: str) -> Optional[UserInDB]:
        return self.users.get(username)

    def create_user(self, username: str, password: str, full_name: str = "") -> Optional[UserInDB]:
        if username in self.users:
            return None # User already exists
        
        hashed_password = get_password_hash(password)
        from datetime import datetime
        
        new_user = UserInDB(
            username=username,
            hashed_password=hashed_password,
            full_name=full_name,
            created_at=datetime.now().isoformat(),
            broker_accounts=[] 
        )
        
        self.users[username] = new_user
        self._save_users()
        return new_user

    def authenticate_user(self, username: str, password: str) -> Optional[UserInDB]:
        user = self.get_user(username)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    def add_broker_account(self, username: str, account: BrokerAccount) -> bool:
        user = self.get_user(username)
        if not user:
            return False
        
        # Check duplicate
        for acc in user.broker_accounts:
            if acc.account_id == account.account_id:
                return False
        
        user.broker_accounts.append(account)
        self._save_users()
        return True

    def remove_broker_account(self, username: str, account_id: str) -> bool:
        user = self.get_user(username)
        if not user:
            return False
        
        initial_len = len(user.broker_accounts)
        user.broker_accounts = [acc for acc in user.broker_accounts if acc.account_id != account_id]
        
        if len(user.broker_accounts) < initial_len:
            self._save_users()
            return True
        return False

user_service = UserService()
