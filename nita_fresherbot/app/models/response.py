from pydantic import BaseModel
from typing import List, Dict, Any


class ChatResponse(BaseModel):

    answer: str

    cache: bool

    chunks: List[Dict[str, Any]]