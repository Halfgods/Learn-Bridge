from ddgs import DDGS

def ddgs_videos(query_text:str , std:int , limit:int):
    search_query = f"{query_text} animation explanation class {std}"
    results_list = []
    try:
        # 1. Use the DDGS context manager
        with DDGS() as ddgs:
            results = ddgs.videos(
                search_query,
                safesearch="on",
                max_results=limit
            )
            for res in results:
                video = {
                    "title": res.get("title"),
                    "url": res.get("content"),  # usually the video link
                    "source": res.get("publisher"),
                    "duration": res.get("duration")
                }

            # only keep valid ones
                if video["url"] and video["title"]:
                    results_list.append(video)
        return results_list
    except Exception as e:
        return []
