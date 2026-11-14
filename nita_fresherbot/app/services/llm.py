from google import genai
from google.genai import errors

from app.services.api_key_manager import (
    get_api_key,
    total_keys
)


class LLMService:

    def generate(self, prompt: str):

        last_error = None

        for attempt in range(total_keys()):

            api_key = get_api_key()

            print(
                f"Trying key ending with ...{api_key[-6:]}"
            )

            try:

                client = genai.Client(
                    api_key=api_key
                )

                response = client.models.generate_content(
                    model="gemini-3.5-flash",
                    contents=prompt
                )

                print(
                    f"SUCCESS using key ...{api_key[-6:]}"
                )

                return response.text.strip()

            except Exception as e:   # ClientError, ServerError, network errors

                print(
                    f"FAILED using key ...{api_key[-6:]}"
                )

                print(e)

                last_error = e

                continue

        raise RuntimeError(
            f"All Gemini API Keys failed.\nLast Error:\n{last_error}"
        )