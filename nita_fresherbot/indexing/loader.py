from pathlib import Path

from langchain_community.document_loaders import PyPDFLoader
from langchain_core.documents import Document


class DocumentLoader:

    def __init__(self, data_folder: str):
        self.data_folder = Path(data_folder)

    def load_documents(self):

        documents = []

        # Scan all files recursively
        for file in self.data_folder.rglob("*"):

            if not file.is_file():
                continue

            # PDF
            if file.suffix.lower() == ".pdf":

                print(f"Loading PDF: {file.name}")

                loader = PyPDFLoader(str(file))
                documents.extend(loader.load())

            # TXT
            elif file.suffix.lower() == ".txt":

                print(f"Loading TXT: {file.name}")

                with open(file, "r", encoding="utf-8") as f:

                    text = f.read()

                documents.append(
                    Document(
                        page_content=text,
                        metadata={
                            "source": file.name
                        }
                    )
                )

        return documents