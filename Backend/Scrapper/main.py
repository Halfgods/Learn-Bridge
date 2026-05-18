import uvicorn
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from Scripts.images import ddgs_images
from Scripts.imagefallback import wikimedia_images
from Scripts.videos import ddgs_videos
from Scripts.videosfallback import ytdlp_videos
from Scripts.links import ddgs_links
from urllib.parse import quote_plus
import asyncio
from fastapi.concurrency import run_in_threadpool

from RAG.router import router as rag_router

_DEFAULT_ORIGINS = (
    "http://localhost:5173,http://127.0.0.1:5173,"
    "http://localhost:8080,http://127.0.0.1:8080,"
    "http://localhost:8081,http://127.0.0.1:8081,"
    "http://localhost:3000,http://127.0.0.1:3000"
)
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(rag_router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the Educational Content API! Use /imglinks, /ytlinks, or /shaalaalinks endpoints with a query parameter."}

@app.get("/imglinks")
async def get_images(query:str = ""):
    if not query:
        return {"error": "Please provide a 'query' parameter"}

    images = await run_in_threadpool(ddgs_images, query)

    if len(images) < 3:
        try:
            fallback = await run_in_threadpool(wikimedia_images, query)
            if isinstance(fallback, list):
                for img in fallback:
                    if img not in images and isinstance(img, str):
                        images.append(img)
                    if len(images) == 5:
                        break
        except Exception:
            pass

    return {"images": images[:5]}

@app.get("/ytlinks")
async def get_videos(std: int, query:str = "", limit:int = 5):
    if not query:
        return {"error": "Please provide a 'query' parameter"}

    videos = await run_in_threadpool(ddgs_videos, query, std, limit)

    if len(videos) < limit:
        fallback = await run_in_threadpool(ytdlp_videos, query, std, limit)
        for vid in fallback:
            if vid not in videos:
                videos.append(vid)
            if len(videos) == limit:
                break

    return {"videos": videos[:limit]}

@app.get("/shaalaalinks")
async def get_links(std: int, query: str = "", limit: int = 2):
    if not query:
        return {"error": "Please provide a 'query' parameter"}

    links = await run_in_threadpool(ddgs_links, query, std, limit) or []

    encoded_query = quote_plus(f"{query} class {std}")
    fallback_link = f"https://www.shaalaa.com/search?q={encoded_query}"

    while len(links) < limit:
        if fallback_link not in links:
            links.append(fallback_link)
        else:
            break

    return {"links": links[:limit]}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0" , port= 8080)