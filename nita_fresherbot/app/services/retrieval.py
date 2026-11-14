from app.core.pinecone_client import index


class RetrievalService:

    def retrieve(self, embedding, top_k=1):

        response = index.query(
            vector=embedding,
            top_k=top_k,
            include_metadata=True
        )

        chunks = []

        for match in response["matches"]:

            chunks.append({
                "text": match["metadata"]["text"],
                "source": match["metadata"].get("source"),
                "page": match["metadata"].get("page"),
                "score": match["score"]
            })

        return chunks