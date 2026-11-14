from app.services.cache import CacheService
from app.services.embedding import EmbeddingService
from app.services.retrieval import RetrievalService
from app.services.llm import LLMService
from app.services.prompt import build_prompt


class RAGPipeline:

    def __init__(self):

        self.cache = CacheService()   #maintaing a cache

        self.embedding_service = EmbeddingService()   #embedding the query

        self.retrieval_service = RetrievalService()   # retrieval of chunks from pinecone

        self.llm = LLMService()   # passing the prompt with chunks to llm


    def ask(self, question: str):

        print("Generating query embedding...")

        embedding = self.embedding_service.embed_query(question)


        print("Checking semantic cache...")

        cached_answer = self.cache.search(
            embedding,
            threshold=0.87
        )


        if cached_answer:

            print("Semantic Cache Hit")

            return {
                "answer": cached_answer,
                "cache": True,
                "chunks": []
            }


        print("Semantic Cache Miss")


        print("Searching Pinecone...")

        chunks = self.retrieval_service.retrieve(
            embedding
        )


        print("Building Prompt...")

        prompt = build_prompt(
            question,
            chunks
        )


        print("Generating answer using Gemini...")

        answer = self.llm.generate(
            prompt
        )


        print("Saving answer in semantic cache...")

        self.cache.add(
            question,
            embedding,
            answer
        )


        return {

            "answer": answer,

            "cache": False,

            "chunks": chunks

        }