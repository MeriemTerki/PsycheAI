from pydantic_settings import BaseSettings, SettingsConfigDict



class Settings(BaseSettings):
    # Existing configurations
    ENVIRONMENT: str = 'development'
    ALLOW_ORIGINS: str = '*'
    GROQ_API_KEY: str
    DEEPGRAM_API_KEY: str
    
    # New RAG-related configurations
    PINECONE_API_KEY: str
    PINECONE_ENVIRONMENT: str = 'us-west1-gcp'  # Default value
    PINECONE_INDEX_NAME: str = 'voice-agent'    # Default value
    COHERE_API_KEY: str
    
    # Optional configurations with defaults
    RAG_ENABLED: bool = True                   # Feature flag for RAG
    MAX_RETRIEVAL_RESULTS: int = 3             # Default number of documents to retrieve
    
    # Audio settings
    SAMPLE_RATE: int = 16000
    CHANNELS: int = 1
    
    model_config = SettingsConfigDict(
        env_file='.env',
        env_file_encoding='utf-8',
        extra='ignore'  # Ignore extra env variables
    )

settings = Settings()

