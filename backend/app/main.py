"""TripBook — 여행 포토북 협업 서비스 API"""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .database import engine, Base
from .routes import trips, pages, messages, books, webhooks, auth

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent.parent / ".env")

app = FastAPI(
    title="TripBook API",
    description="여행 포토북 협업 서비스 — 함께 만드는 여행의 추억",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

app.include_router(trips.router)
app.include_router(pages.router)
app.include_router(messages.router)
app.include_router(books.router)
app.include_router(webhooks.router)
app.include_router(auth.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "tripbook"}


# Uploaded images
uploads_dir = Path(__file__).parent.parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

# Serve React build
frontend_build = Path(__file__).parent.parent.parent / "frontend" / "dist"
if frontend_build.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_build / "assets")), name="static_assets")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        return FileResponse(str(frontend_build / "index.html"))
