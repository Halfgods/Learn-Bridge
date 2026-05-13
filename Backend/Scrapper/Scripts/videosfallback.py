import yt_dlp

def ytdlp_videos(query_text:str, std:int ,  limit:int):
    search_query = f"ytsearch{limit}:{query_text} educational animation for {std} kids"
    
    # ydl_opts configures yt-dlp to be fast and not download anything
    ydl_opts = {
        'quiet': True,              # Don't print progress to terminal
        'skip_download': True,      # Don't download the video
        'extract_flat': True,       # Only get metadata, don't process every format
        'force_generic_extractor': True,
    }

    video_links = []

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # Extract info based on the search query
            info = ydl.extract_info(search_query, download=False)
            
            if 'entries' in info:
                for entry in info['entries']:
                    if 'id' not in entry:
                        continue
                    video_url = f"https://www.youtube.com/watch?v={entry['id']}"
                    video_links.append({
                        "title": entry.get("title"),
                        "url": video_url
                    })
                    
    except Exception as e:
        print(f"An error occurred: {e}")

    return video_links
