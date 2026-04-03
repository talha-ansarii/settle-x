from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "MSME Intelligence API"
    API_V1_STR: str = "/api/v1"
    
    SECRET_KEY: str = "super-secret-local-dev-key-never-use-in-prod-12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    DATABASE_URL: str = "sqlite:///./msme_local.db"
    
    TWILIO_ACCOUNT_SID: str = ""
    TWILIO_AUTH_TOKEN: str = ""
    TWILIO_VERIFY_SERVICE_SID: str = ""
    PAYMENT_WEBHOOK_SECRET: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

settings = Settings()
