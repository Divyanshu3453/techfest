import os
import itertools
from threading import Lock

from dotenv import load_dotenv

load_dotenv()

API_KEYS = [
    os.getenv("GEMINI_API_KEY_1"),
    os.getenv("GEMINI_API_KEY_2"),
    os.getenv("GEMINI_API_KEY_3"),
   # os.getenv("GEMINI_API_KEY_4"),
   # os.getenv("GEMINI_API_KEY_5"),
]

API_KEYS = [k for k in API_KEYS if k]

if not API_KEYS:
    raise ValueError("No Gemini API keys found.")

_key_cycle = itertools.cycle(API_KEYS)
_lock = Lock()


def get_api_key():
    with _lock:
        return next(_key_cycle)


def total_keys():
    return len(API_KEYS)