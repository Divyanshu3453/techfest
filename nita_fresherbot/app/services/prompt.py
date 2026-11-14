def build_prompt(question, chunks):

    context = "\n\n".join(

        chunk["text"]

        for chunk in chunks

    )

    return f"""
You are NITA Assistive Bot.

Answer the student's question using the provided information.

Rules:
- Answer directly.
- Do not mention documents, PDFs, sources, chunks, or context.
- Do not start with "Based on the provided context".
- Give a clear and detailed explanation.
- If the information is unavailable, say that you don't know.

Context:
{context}

Question:
{question}

Answer:
"""