"""
Configuration management for the AI service.
Uses pydantic-settings for type-safe environment variable handling.
"""

from pydantic_settings import BaseSettings
from pydantic import Field
from functools import lru_cache
from typing import Optional


class Settings(BaseSettings):
    # Google Gemini
    gemini_api_key: str = Field(default="", env="GEMINI_API_KEY")

    # Pinecone
    pinecone_api_key: str = Field(default="", env="PINECONE_API_KEY")
    pinecone_index_name: str = Field(default="college-chatbot", env="PINECONE_INDEX_NAME")
    pinecone_environment: str = Field(default="us-east-1", env="PINECONE_ENVIRONMENT")

    # MongoDB
    mongodb_uri: str = Field(
        default="mongodb://localhost:27017/college_chatbot", env="MONGODB_URI"
    )

    # Service config
    ai_service_port: int = Field(default=8000, env="AI_SERVICE_PORT")
    ai_service_host: str = Field(default="0.0.0.0", env="AI_SERVICE_HOST")
    log_level: str = Field(default="INFO", env="LOG_LEVEL")

    # Backend URL
    backend_url: str = Field(default="http://localhost:8080", env="BACKEND_URL")

    # RAG parameters
    embedding_model: str = Field(default="gemini-embedding-001", env="EMBEDDING_MODEL")
    embedding_dimensions: int = Field(default=768, env="EMBEDDING_DIMENSIONS")
    generation_model: str = Field(default="gemini-2.5-flash", env="GENERATION_MODEL")
    top_k_retrieval: int = Field(default=5, env="TOP_K_RETRIEVAL")
    chunk_size: int = Field(default=800, env="CHUNK_SIZE")
    chunk_overlap: int = Field(default=120, env="CHUNK_OVERLAP")
    min_relevance_score: float = Field(default=0.45, env="MIN_RELEVANCE_SCORE")

    # Security
    internal_api_key: str = Field(default="internal_secret_key_2025", env="INTERNAL_API_KEY")

    @property
    def rag_enabled(self) -> bool:
        """Returns True only if both Gemini and Pinecone are configured."""
        return bool(self.gemini_api_key and self.pinecone_api_key)

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()
