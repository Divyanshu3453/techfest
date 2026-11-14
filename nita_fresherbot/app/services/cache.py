import json
import os
import numpy as np

from sklearn.metrics.pairwise import cosine_similarity


class CacheService:


    def __init__(self):

        self.cache_file = "app/storage/cache.json"

        self._create_cache_file()



    def _create_cache_file(self):

        directory = os.path.dirname(self.cache_file)

        os.makedirs(
            directory,
            exist_ok=True
        )


        if not os.path.exists(self.cache_file):

            with open(
                self.cache_file,
                "w"
            ) as f:

                json.dump([], f)



    def _load_cache(self):

        with open(
            self.cache_file,
            "r"
        ) as f:

            return json.load(f)



    def _save_cache(
        self,
        data
    ):

        with open(
            self.cache_file,
            "w"
        ) as f:

            json.dump(
                data,
                f,
                indent=4
            )



    def search(
        self,
        query_embedding,
        threshold=0.87
    ):


        cache = self._load_cache()


        if len(cache)==0:

            return None



        stored_embeddings = np.array(
            [
                item["embedding"]
                for item in cache
            ]
        )


        query_embedding = np.array(
            query_embedding
        ).reshape(1,-1)



        scores = cosine_similarity(
            query_embedding,
            stored_embeddings
        )[0]



        best_index = np.argmax(scores)

        best_score = scores[best_index]


        print(
            "Semantic cache score:",
            best_score
        )



        if best_score >= threshold:

            return cache[best_index]["answer"]



        return None



    def add(
        self,
        question,
        embedding,
        answer
    ):


        cache = self._load_cache()


        cache.append(

            {
                "question": question,

                "embedding": embedding,

                "answer": answer
            }

        )


        self._save_cache(cache)