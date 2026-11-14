from huggingface_hub import InferenceClient

from app.core.settings import settings


class EmbeddingService:

    def __init__(self):

        self.client = InferenceClient(
            provider="hf-inference",
            api_key=settings.HF_API_KEY
        )

        self.model = "BAAI/bge-base-en-v1.5"


    def embed_query(self, text: str):

        text = text.strip()

        embedding = self.client.feature_extraction(
            text,
            model=self.model
        )

        return embedding.tolist()