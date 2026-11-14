import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import router

app = FastAPI(
    title="NITA FresherBot"
)

# CORS: lets the widget on the Ayaam site (a different origin) call /chat.
# Set CORS_ORIGINS in .env to a comma-separated list (e.g. https://your-site.vercel.app) to lock it down.
_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)

app.mount(
    "/static",
    StaticFiles(directory="app/static"),
    name="static"
)


@app.get("/config")
def config():
    # Some frontends call this on load; adjust the fields to whatever your widget reads.
    return {"name": "NITA FresherBot", "status": "ok"}


@app.get("/", response_class=HTMLResponse)
def home():

    with open(
        "app/templates/index.html",
        "r",
        encoding="utf-8"
    ) as f:

        return f.read()