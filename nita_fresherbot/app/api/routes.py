import traceback

from fastapi import APIRouter, HTTPException

from app.models.request import ChatRequest
from app.models.response import ChatResponse

from app.services.rag_pipeline import RAGPipeline


router = APIRouter()

pipeline = RAGPipeline()


@router.post("/chat", response_model=ChatResponse)
def chat(request: ChatRequest):

    question = request.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="Question is empty")

    try:
        result = pipeline.ask(question)

    except Exception as e:
        # Full traceback goes to the terminal; the browser gets a readable JSON error
        traceback.print_exc()
        raise HTTPException(
            status_code=502,
            detail=f"Backend error ({type(e).__name__}). Check the server terminal for details."
        )

    return ChatResponse(**result)
