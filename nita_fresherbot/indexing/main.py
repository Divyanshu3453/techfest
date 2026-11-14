import json

from loader import DocumentLoader
from chunker import Chunker
import re
from pathlib import Path
import hashlib
import json


def clean_text(text: str) -> str:
    # Replace multiple whitespace/newlines with a single space
    text = re.sub(r"\s+", " ", text)

    # Remove leading/trailing spaces
    return text.strip()


loader = DocumentLoader(r"D:\NITA_FRESHERBOT\indexing\data")

documents = loader.load_documents()

print(f"Loaded {len(documents)} documents")


chunker = Chunker()

chunks = chunker.chunk_documents(documents)

print(f"Generated {len(chunks)} chunks")


processed = []

for i, chunk in enumerate(chunks):

    chunk_text = clean_text(chunk.page_content)

chunk_id = hashlib.sha256(
    chunk_text.encode("utf-8")
).hexdigest()

processed.append({

    "id": chunk_id,

    "text": chunk_text,

    "metadata": {
        "source": Path(chunk.metadata["source"]).name,
        "page": chunk.metadata["page"],
        "page_label": chunk.metadata.get("page_label")
    }

})


with open(
    "output/processed_chunks.json",
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        processed,
        f,
        indent=4,
        ensure_ascii=False
    )


print("Chunks saved successfully.")

