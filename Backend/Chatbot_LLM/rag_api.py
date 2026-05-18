import logging, os, pickle, re, tarfile, threading, traceback
from pathlib import Path
from typing import Optional

import faiss
import numpy as np
import requests
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, field_validator

from fastembed import TextEmbedding

log = logging.getLogger("ncert-rag")

INDEX_URL = os.environ.get("INDEX_URL", "")
IMAGES_URL = os.environ.get("IMAGES_URL", INDEX_URL)
CACHE_DIR = Path("/tmp/ncert_rag")
CLASS_ARCHIVES_DIR = CACHE_DIR / "archives"

router = APIRouter(prefix="/v1/rag")

# Lazy init — model/index loaded once on first request
_embed_model: TextEmbedding | None = None
_index: faiss.Index | None = None
_chunks_meta: list = []
_prefix_class_map: dict = {}
_class_archives_lock = threading.Lock()
_downloading_classes = set()
_extraction_semaphore = threading.Semaphore(1)

def _ensure_loaded():
    global _embed_model, _index, _chunks_meta, _prefix_class_map
    if _index is not None:
        return
    CACHE_DIR.mkdir(parents=True, exist_ok=True)

    log.info("Loading embedding model (ONNX)...")
    _embed_model = TextEmbedding(
        model_name="sentence-transformers/all-MiniLM-L6-v2",
        providers=["CPUExecutionProvider"],
    )
    log.info("Embedding model loaded")

    if INDEX_URL:
        for name in ["faiss.index", "chunks_meta.pkl"]:
            path = CACHE_DIR / name
            if not path.exists():
                url = f"{INDEX_URL}/{name}"
                log.info("Downloading %s ...", url)
                r = requests.get(url, timeout=300, stream=True)
                r.raise_for_status()
                with open(path, "wb") as f:
                    for chunk in r.iter_content(8192):
                        if chunk:
                            f.write(chunk)
                log.info("Downloaded %s (%d KB)", name, path.stat().st_size // 1024)

    _index = faiss.read_index(str(CACHE_DIR / "faiss.index"))
    with open(CACHE_DIR / "chunks_meta.pkl", "rb") as f:
        _chunks_meta = pickle.load(f)
    for m in _chunks_meta:
        std = m["std"]
        for img in m.get("images", []):
            prefix = img.split("_")[0]
            if prefix not in _prefix_class_map:
                _prefix_class_map[prefix] = std
    log.info(
        "RAG ready: %d vectors, %d chunks, %d image prefixes",
        _index.ntotal, len(_chunks_meta), len(_prefix_class_map),
    )

def _get_embedding(texts: list[str]) -> list[list[float]]:
    _ensure_loaded()
    emb_gen = _embed_model.embed([t[:2000] for t in texts])
    return [list(e) for e in emb_gen]

# --- Image helpers ---

def _get_class_extract_dir(std: str) -> Path:
    return CLASS_ARCHIVES_DIR / std

def _get_class_archive_path(std: str) -> Path:
    return CLASS_ARCHIVES_DIR / f"class_{std}.tar.gz"

def _download_class_archive(std: str):
    with _extraction_semaphore:
        with _class_archives_lock:
            if _get_class_extract_dir(std).exists():
                _downloading_classes.discard(std)
                return
        tar_path = _get_class_archive_path(std)
        extract_dir = _get_class_extract_dir(std)
        try:
            CLASS_ARCHIVES_DIR.mkdir(parents=True, exist_ok=True)
            url = f"{IMAGES_URL}/class_{std}.tar.gz"
            log.info("Downloading class %s archive ...", std)
            r = requests.get(url, timeout=600, stream=True)
            r.raise_for_status()
            with open(tar_path, "wb") as f:
                for chunk in r.iter_content(8192):
                    if chunk:
                        f.write(chunk)
            log.info("Extracting class %s ...", std)
            extract_dir.mkdir(exist_ok=True)
            with tarfile.open(str(tar_path), "r:gz") as tar:
                tar.extractall(path=str(extract_dir))
            tar_path.unlink()
            count = len(list(extract_dir.iterdir()))
            log.info("Class %s ready: %d files", std, count)
        except Exception as e:
            log.warning("Failed to load class %s archive: %s", std, e)
            if tar_path.exists():
                tar_path.unlink()
        finally:
            with _class_archives_lock:
                _downloading_classes.discard(std)

def _ensure_class_archive(std: str) -> bool:
    extract_dir = _get_class_extract_dir(std)
    if extract_dir.exists():
        return True
    with _class_archives_lock:
        if extract_dir.exists():
            return True
        if std in _downloading_classes:
            return False
        _downloading_classes.add(std)
    threading.Thread(target=_download_class_archive, args=(std,), daemon=True).start()
    return False

def _build_image_urls(images: list[str]) -> list[str]:
    return [f"/v1/rag/image/{img.replace('.png', '.jpg')}" for img in images]

# --- Pydantic models ---

class RAGQuery(BaseModel):
    query: str
    top_k: int = 5

    @field_validator("query")
    @classmethod
    def query_not_empty(cls, v):
        if not v.strip():
            raise ValueError("query must not be empty")
        return v

    @field_validator("top_k")
    @classmethod
    def top_k_positive(cls, v):
        if v < 1:
            raise ValueError("top_k must be >= 1")
        return v

class ChapterQuery(BaseModel):
    chapter: str
    std: Optional[str] = None
    subject: Optional[str] = None

    @field_validator("chapter")
    @classmethod
    def chapter_not_empty(cls, v):
        if not v.strip():
            raise ValueError("chapter must not be empty")
        return v

# --- Endpoints ---

@router.get("/health")
def rag_health():
    _ensure_loaded()
    cached = len([p for p in CLASS_ARCHIVES_DIR.iterdir() if p.is_dir()]) if CLASS_ARCHIVES_DIR.exists() else 0
    return {
        "status": "ok",
        "vectors": _index.ntotal,
        "chunks": len(_chunks_meta),
        "images_available": cached,
    }

@router.post("/query")
def rag_query(req: RAGQuery):
    _ensure_loaded()
    q_emb = _get_embedding([req.query])[0]
    q_vec = np.array([q_emb], dtype=np.float32)
    scores, indices = _index.search(q_vec, req.top_k)
    results = []
    for score, idx in zip(scores[0], indices[0]):
        m = _chunks_meta[idx]
        results.append({
            "text": m["text"],
            "source": {
                "std": m["std"],
                "subject": m["subj"],
                "textbook": m["book"],
                "chapter": m["ch"],
                "chapter_number": str(m["ch_num"]),
                "pages": m.get("pages", []),
            },
            "relevance_score": round(float(score), 4),
            "image_count": len(m.get("images", [])),
            "image_urls": _build_image_urls(m.get("images", [])),
        })
    return {"object": "rag.query", "query": req.query, "results": results, "total_results": len(results)}

@router.get("/rag-query")
def rag_query_get(query: str, top_k: int = 5):
    return rag_query(RAGQuery(query=query, top_k=top_k))

@router.post("/chapter")
def get_chapter(req: ChapterQuery):
    _ensure_loaded()
    name_lower = req.chapter.strip().lower()
    pattern = re.escape(name_lower)
    matched = []
    for m in _chunks_meta:
        ch_lower = m["ch"].strip().lower()
        if not re.search(pattern, ch_lower):
            continue
        if req.std and m["std"] != req.std:
            continue
        if req.subject and m["subj"].lower() != req.subject.lower():
            continue
        matched.append(m)
    if not matched:
        raise HTTPException(404, f"No chapters matching '{req.chapter}'")
    groups = {}
    for m in matched:
        key = (m["std"], m["subj"], m["book"], m["ch"], m["ch_num"])
        groups.setdefault(key, []).append(m)
    matches = []
    for (std, subj, book, ch, ch_num), chunks in groups.items():
        matches.append({
            "std": std, "subject": subj, "textbook": book,
            "chapter": ch, "chapter_number": str(ch_num),
            "total_chunks": len(chunks),
            "chunks": [{
                "text": c["text"],
                "pages": c.get("pages", []),
                "image_count": len(c.get("images", [])),
                "image_urls": _build_image_urls(c.get("images", [])),
            } for c in chunks],
        })
    return {"object": "rag.chapter", "query": req.chapter, "matches": matches, "total_matches": len(matches)}

@router.get("/chapters")
def list_chapters():
    _ensure_loaded()
    seen = set()
    chapters = []
    for m in _chunks_meta:
        key = (m["std"], m["subj"], m["book"], m["ch"])
        if key not in seen:
            seen.add(key)
            chapters.append({
                "std": m["std"],
                "subject": m["subj"],
                "textbook": m["book"],
                "chapter": m["ch"],
                "chapter_number": m["ch_num"],
            })
    return {"object": "rag.chapters", "chapters": chapters, "total": len(chapters)}

@router.get("/image/{filename:path}")
def get_image(filename: str):
    _ensure_loaded()
    safe = Path(filename).name
    prefix = safe.split("_")[0]
    std = _prefix_class_map.get(prefix)
    if not std:
        raise HTTPException(404, "Image not found")
    extract_dir = _get_class_extract_dir(std)
    if not extract_dir.exists():
        ready = _ensure_class_archive(std)
        if not ready:
            raise HTTPException(503, detail=f"Class {std} images loading, retry in 30s")
    img_path = extract_dir / safe
    if not img_path.exists():
        raise HTTPException(404, f"Image not found in class {std}")
    try:
        data = img_path.read_bytes()
    except Exception as e:
        raise HTTPException(500, detail=str(e))
    return Response(content=data, media_type="image/jpeg")

# --- Exposed for chatbot integration ---

def rag_search(query: str, top_k: int = 3) -> list[dict]:
    """Search NCERT RAG and return structured context chunks for chatbot injection."""
    _ensure_loaded()
    q_emb = _get_embedding([query])[0]
    q_vec = np.array([q_emb], dtype=np.float32)
    scores, indices = _index.search(q_vec, top_k)
    results = []
    for score, idx in zip(scores[0], indices[0]):
        m = _chunks_meta[idx]
        results.append({
            "text": m["text"],
            "source": f"NCERT Class {m['std']} {m['subj']} — Chapter {m['ch_num']}: {m['ch']}",
            "relevance_score": round(float(score), 4),
        })
    return results
