from pydantic_settings import BaseSettings
from pydantic import ConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "THANKHUN Trade Jornal"
    ENVIRONMENT: str = "development"
    
    # Database Settings (Defaults to SQLite for easy lightweight local dev, can override with Postgres URL)
    DATABASE_URL: str = "sqlite:///./jornaltrade.db"
    
    # Redis Settings
    REDIS_URL: str = "redis://localhost:6379/0"
    
    # Security Settings
    SECRET_KEY: str = "supersecretjwtkeythatisreallylongandsecure12345!"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    
    # Encryption key for Investor Passwords (must be 32 bytes URL-safe base64 key for cryptography.fernet)
    # Default is a placeholder, in production it should be set via env
    ENCRYPTION_KEY: str = "v_mJ6mpxP_rE2T7n7wzQe2XQ8UfCg7q83N_K5Hk2X8c="
    
    model_config = ConfigDict(case_sensitive=True, env_file=".env")

settings = Settings()
