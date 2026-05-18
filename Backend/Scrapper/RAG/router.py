import re
from pathlib import Path
from typing import Optional

import numpy as np
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, field_validator

from .engine import (
    index, chunks_meta, prefix_class_map, log,
    CLASS_ARCHIVES_DIR,
    build_citation_text, enrich_chunk_text,
    format_page_range, format_single_page,
    resolve_pages, get_embedding,
    get_class_extract_dir, ensure_class_archive,
    serve_image_from_class_archive,
)

router = APIRouter(prefix="/v1/rag")


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


class SourceInfo(BaseModel):
    std: str
    subject: str
    textbook: str
    chapter: str
    chapter_number: str
    pages: list[int]
    textbook_pages: list[int] = []
    page_range: str = ""
    citation_text: str = ""


class RAGResult(BaseModel):
    text: str
    formatted_text: str = ""
    source: SourceInfo
    relevance_score: float
    image_count: int
    image_urls: list[str] = []


class RAGResponse(BaseModel):
    object: str = "rag.query"
    query: str
    results: list[RAGResult]
    total_results: int


class ChapterChunk(BaseModel):
    text: str
    formatted_text: str = ""
    pages: list[int]
    textbook_pages: list[int] = []
    page_range: str = ""
    image_count: int
    image_urls: list[str] = []


class ChapterResult(BaseModel):
    std: str
    subject: str
    textbook: str
    chapter: str
    chapter_number: str
    citation_text: str = ""
    total_chunks: int
    chunks: list[ChapterChunk]


class ChapterResponse(BaseModel):
    object: str = "rag.chapter"
    query: str
    matches: list[ChapterResult]
    total_matches: int


class HealthResponse(BaseModel):
    status: str
    vectors: int
    chunks: int
    images_available: int = 0


def build_image_urls(images: list[str]) -> list[str]:
    return [f"/v1/rag/image/{img.replace('.png', '.jpg')}" for img in images]


@router.get("/health")
def health() -> HealthResponse:
    cached = len([p for p in CLASS_ARCHIVES_DIR.iterdir() if p.is_dir()]) if CLASS_ARCHIVES_DIR.exists() else 0
    return HealthResponse(status="ok", vectors=index.ntotal, chunks=len(chunks_meta), images_available=cached)


@router.post("/query")
def rag_query(req: RAGQuery) -> RAGResponse:
    q_emb = get_embedding([req.query])[0]
    q_vec = np.array([q_emb], dtype=np.float32)
    scores, indices = index.search(q_vec, req.top_k)
    results = []
    for score, idx in zip(scores[0], indices[0]):
        m = chunks_meta[idx]
        pages_list = m.get("pages", [])
        resolved = resolve_pages(m)
        formatted_text = enrich_chunk_text(m["text"], m["ch"], m["ch_num"], m)
        citation_text = build_citation_text(m)
        page_range_val = format_page_range(resolved) if resolved else ""
        results.append(RAGResult(
            text=m["text"],
            formatted_text=formatted_text,
            source=SourceInfo(
                std=m["std"],
                subject=m["subj"],
                textbook=m["book"],
                chapter=m["ch"],
                chapter_number=str(m["ch_num"]),
                pages=pages_list,
                textbook_pages=resolved,
                page_range=page_range_val,
                citation_text=citation_text,
            ),
            relevance_score=round(float(score), 4),
            image_count=len(m.get("images", [])),
            image_urls=build_image_urls(m.get("images", [])),
        ))
    return RAGResponse(query=req.query, results=results, total_results=len(results))


@router.post("/chapter")
def get_chapter(req: ChapterQuery) -> ChapterResponse:
    name_lower = req.chapter.strip().lower()
    pattern = re.escape(name_lower)
    matched_chunks = []
    for m in chunks_meta:
        ch_lower = m["ch"].strip().lower()
        if not re.search(pattern, ch_lower):
            continue
        if req.std and m["std"] != req.std:
            continue
        if req.subject and m["subj"].lower() != req.subject.lower():
            continue
        matched_chunks.append(m)
    if not matched_chunks:
        raise HTTPException(404, f"No chapters matching '{req.chapter}'")
    groups = {}
    for m in matched_chunks:
        key = (m["std"], m["subj"], m["book"], m["ch"], m["ch_num"])
        if key not in groups:
            groups[key] = []
        groups[key].append(m)
    matches = []
    for (std, subj, book, ch, ch_num), chapter_chunks in groups.items():
        first = chapter_chunks[0]
        citation_text = build_citation_text(first)
        matches.append(ChapterResult(
            std=std, subject=subj, textbook=book,
            chapter=ch, chapter_number=str(ch_num),
            citation_text=citation_text,
            total_chunks=len(chapter_chunks),
            chunks=[ChapterChunk(
                text=c["text"],
                formatted_text=enrich_chunk_text(c["text"], c["ch"], c["ch_num"], c),
                pages=c.get("pages", []),
                textbook_pages=resolve_pages(c),
                page_range=format_page_range(resolve_pages(c)),
                image_count=len(c.get("images", [])),
                image_urls=build_image_urls(c.get("images", [])),
            ) for c in chapter_chunks],
        ))
    return ChapterResponse(query=req.chapter, matches=matches, total_matches=len(matches))


@router.get("/chapters")
def list_chapters():
    seen = set()
    chapters = []
    for m in chunks_meta:
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
    safe = Path(filename).name
    prefix = safe.split("_")[0]
    std = prefix_class_map.get(prefix)
    if not std:
        raise HTTPException(404, "Image not found")
    extract_dir = get_class_extract_dir(std)
    if not extract_dir.exists():
        ready = ensure_class_archive(std)
        if not ready:
            raise HTTPException(503, detail=f"Class {std} images loading, retry in 30s")
    data = serve_image_from_class_archive(safe)
    if data is None:
        raise HTTPException(404, "Image not found in class {std}")
    return Response(content=data, media_type="image/jpeg")
