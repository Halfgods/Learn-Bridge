import logging
from ddgs import DDGS

def ddgs_links(query: str, std: int, limit: int):
    results = []
    try:
        search_query = f"{query} class {std} site:shaalaa.com"
        with DDGS() as ddgs:
            data = ddgs.text(search_query, max_results=limit)
            for item in data:
                href = item.get("href")
                if href and "shaalaa.com" in href:
                    results.append(href)
                    if len(results) == limit:
                        break

        return results
    except Exception as e:
        logging.error(f"Error in ddgs_links: {e}", exc_info=True)
        return []
