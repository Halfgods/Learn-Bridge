import logging
from ddgs import DDGS

def ddgs_images(query: str):
    results_list = []
    try:
        with DDGS() as ddgs:
            results = ddgs.images(
                query=f"{query} diagram illustration",
                safesearch="moderate",
                max_results=10
            )
            for res in results:
                url = res.get("image") or res.get("thumbnail") or res.get("url")
                if url:
                    results_list.append(url)
        return results_list[:4]
    except Exception as e:
        logging.error(f"DDGS image search error for '{query}': {e}")
        return []
