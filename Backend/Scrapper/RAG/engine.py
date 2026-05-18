import json, os, pickle, time, logging, re, traceback, tarfile, io, threading
from pathlib import Path
from typing import Optional

import faiss
import numpy as np
import requests
from fastembed import TextEmbedding


def format_page_range(pages: list[int]) -> str:
    if not pages:
        return ""
    pgs = sorted(set(pages))
    ranges = []
    start = pgs[0]
    end = pgs[0]
    for p in pgs[1:]:
        if p == end + 1:
            end = p
        else:
            ranges.append(f"{start}" if start == end else f"{start}–{end}")
            start = end = p
    ranges.append(f"{start}" if start == end else f"{start}–{end}")
    return ", ".join(ranges)


def format_single_page(pages: list[int]) -> str:
    if not pages:
        return ""
    pgs = sorted(set(pages))
    if len(pgs) == 1:
        return f"p. {pgs[0]}"
    return f"pp. {pgs[0]}–{pgs[-1]}"


def extract_textbook_pages(text: str) -> list[int]:
    lines = text.split("\n")
    found = []
    for line in lines[:15]:
        line = line.strip()
        m = re.match(r"^(\d{2,4})\s*$", line)
        if m:
            num = int(m.group(1))
            if 1 <= num <= 500:
                found.append(num)
                continue
        m = re.match(r"^(\d{2,4})\s+[A-Z]", line)
        if m:
            num = int(m.group(1))
            if 1 <= num <= 500:
                found.append(num)
    return found


chapter_page_map: dict[tuple, dict[int, int]] = {}


def build_page_map(chunks: list[dict]) -> dict[int, int]:
    pdf_to_tb = {}
    for c in chunks:
        tb = extract_textbook_pages(c["text"])
        pdf_pages = c.get("pages", [])
        if tb and pdf_pages:
            for pp in pdf_pages:
                if pp not in pdf_to_tb:
                    idx = pdf_pages.index(pp) if pp in pdf_pages else 0
                    tb_idx = min(idx, len(tb) - 1)
                    pdf_to_tb[pp] = tb[tb_idx]
    return pdf_to_tb


def resolve_pages(m: dict) -> list[int]:
    key = (m["std"], m["subj"], m["book"], m["ch"], m["ch_num"])
    pmap = chapter_page_map.get(key, {})
    pdf_pages = m.get("pages", [])
    resolved = []
    for p in pdf_pages:
        tb = pmap.get(p)
        if tb is not None:
            resolved.append(tb)
    return resolved


def strip_page_header(text: str) -> str:
    lines = text.split("\n")
    stripped = []
    seen_content = False
    for line in lines:
        ls = line.strip()
        if not seen_content:
            if not ls:
                continue
            if re.match(r"^\d{2,4}\s*$", ls):
                continue
            if re.match(r"^\d{2,4}\s+[A-Z]", ls):
                continue
            if ls.isupper() and len(ls) > 3 and len(ls) < 60:
                stripped.append(line)
                seen_content = True
                continue
            stripped.append(line)
            seen_content = True
        else:
            stripped.append(line)
    return "\n".join(stripped).strip()


def enrich_chunk_text(text: str, ch: str, ch_num: int | str,
                      m: dict) -> str:
    resolved = resolve_pages(m)
    page_part = ""
    if resolved:
        page_part = " [" + format_single_page(resolved) + "]"
    clean_text = strip_page_header(text)
    return f"[{ch}, Ch. {ch_num}]{page_part}\n{clean_text}"


def build_citation_text(m: dict) -> str:
    std, subj, book = m["std"], m["subj"], m["book"]
    ch, ch_num = m["ch"], m["ch_num"]
    resolved = resolve_pages(m)
    base = f"NCERT Class {std} {subj} — {book}, Ch. {ch_num}: {ch}"
    if resolved:
        return f"{base}, {format_single_page(resolved)}."
    return f"{base}."


logging.basicConfig(level=logging.INFO)
log = logging.getLogger("ncert-rag")

EMBED_DIM = 384
INDEX_URL = os.environ.get("INDEX_URL", "")
IMAGES_URL = os.environ.get("IMAGES_URL", INDEX_URL)
CACHE_DIR = Path("/tmp/ncert_rag")
CLASS_ARCHIVES_DIR = CACHE_DIR / "archives"

index: faiss.Index = None
chunks_meta: list = []
prefix_class_map: dict = {}
class_archives_lock = threading.Lock()
downloading_classes = set()
extraction_semaphore = threading.Semaphore(1)


def download_file(name: str, url_base: str, dest: Path):
    url = f"{url_base}/{name}"
    log.info(f"Downloading {url}...")
    r = requests.get(url, timeout=300, stream=True)
    r.raise_for_status()
    size = 0
    with open(dest, "wb") as f:
        for chunk in r.iter_content(chunk_size=8192):
            if chunk:
                f.write(chunk)
                size += len(chunk)
    log.info(f"Downloaded {name} ({size//1024} KB)")


def download_index():
    for name in ["faiss.index", "chunks_meta.pkl"]:
        path = CACHE_DIR / name
        if path.exists():
            log.info(f"Using cached {name}")
            continue
        download_file(name, INDEX_URL, path)


def load_index():
    global index, chunks_meta, prefix_class_map, chapter_page_map
    index = faiss.read_index(str(CACHE_DIR / "faiss.index"))
    with open(CACHE_DIR / "chunks_meta.pkl", "rb") as f:
        chunks_meta = pickle.load(f)
    for m in chunks_meta:
        std = m["std"]
        for img in m.get("images", []):
            prefix = img.split("_")[0]
            if prefix not in prefix_class_map:
                prefix_class_map[prefix] = std
    groups: dict = {}
    for m in chunks_meta:
        key = (m["std"], m["subj"], m["book"], m["ch"], m["ch_num"])
        groups.setdefault(key, []).append(m)
    for key, chunks in groups.items():
        pmap = build_page_map(chunks)
        if pmap:
            chapter_page_map[key] = pmap
    log.info(f"Loaded index: {index.ntotal} vectors, {len(chunks_meta)} chunks")
    log.info(f"Mapped {len(prefix_class_map)} image prefixes to classes")
    log.info(f"Built page maps for {len(chapter_page_map)}/{len(groups)} chapters")


def get_class_extract_dir(std: str) -> Path:
    return CLASS_ARCHIVES_DIR / std


def get_class_archive_path(std: str) -> Path:
    return CLASS_ARCHIVES_DIR / f"class_{std}.tar.gz"


def download_class_archive(std: str):
    with extraction_semaphore:
        with class_archives_lock:
            if get_class_extract_dir(std).exists():
                downloading_classes.discard(std)
                return
        tar_path = get_class_archive_path(std)
        extract_dir = get_class_extract_dir(std)
        try:
            CLASS_ARCHIVES_DIR.mkdir(parents=True, exist_ok=True)
            download_file(f"class_{std}.tar.gz", IMAGES_URL, tar_path)
            log.info(f"Extracting class {std} archive...")
            extract_dir.mkdir(exist_ok=True)
            with tarfile.open(str(tar_path), "r:gz") as tar:
                tar.extractall(path=str(extract_dir))
            tar_path.unlink()
            count = len(list(extract_dir.iterdir()))
            log.info(f"Class {std} images ready: {count} files in {extract_dir}")
        except Exception as e:
            log.warning(f"Failed to download/extract class {std} archive: {e}")
            if tar_path.exists():
                tar_path.unlink()
        finally:
            with class_archives_lock:
                downloading_classes.discard(std)


def ensure_class_archive(std: str):
    extract_dir = get_class_extract_dir(std)
    if extract_dir.exists():
        return True
    with class_archives_lock:
        if extract_dir.exists():
            return True
        if std in downloading_classes:
            return False
        downloading_classes.add(std)
    threading.Thread(target=download_class_archive, args=(std,), daemon=True).start()
    return False


def serve_image_from_class_archive(filename: str) -> Optional[bytes]:
    prefix = filename.split("_")[0]
    std = prefix_class_map.get(prefix)
    if not std:
        log.warning(f"No class mapping for prefix '{prefix}' in '{filename}'")
        return None
    extract_dir = get_class_extract_dir(std)
    if not extract_dir.exists():
        ready = ensure_class_archive(std)
        if not ready:
            return None
    if not extract_dir.exists():
        return None
    img_path = extract_dir / filename
    if not img_path.exists():
        return None
    try:
        return img_path.read_bytes()
    except Exception as e:
        log.warning(f"Error reading {filename}: {e}")
        return None


log.info("Loading embedding model...")
embed_model = TextEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2", providers=["CPUExecutionProvider"])
log.info("Model loaded")

if INDEX_URL:
    CACHE_DIR.mkdir(exist_ok=True)
    download_index()
load_index()


def get_embedding(texts: list[str]) -> list[list[float]]:
    emb_gen = embed_model.embed([t[:2000] for t in texts])
    return [list(e) for e in emb_gen]
