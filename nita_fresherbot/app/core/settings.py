import os
from dotenv import load_dotenv

load_dotenv()


class Settings:

    PINECONE_API_KEY = os.getenv("PINECONE_API_KEY")
    PINECONE_INDEX_NAME = os.getenv("PINECONE_INDEX_NAME")

    HF_API_KEY = os.getenv("HF_API_KEY")

    LLM_API_KEY = os.getenv("LLM_API_KEY")


settings = Settings()