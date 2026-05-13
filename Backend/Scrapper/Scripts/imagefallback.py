import requests

def wikimedia_images(keyword: str):
    if not keyword:
        return {"error": "Please provide a 'keyword' parameter"}

    try:
        url = "https://commons.wikimedia.org/w/api.php"
        params = {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": f"{keyword} diagram OR schematic OR illustration OR labeled",
            "gsrlimit": 20,
            "prop": "imageinfo",
            "iiprop": "url|extmetadata",
            "gsrnamespace": 6,  # File namespace
            "iiurlwidth": 800
        }

        headers = {
            "User-Agent": "MyImageApp/1.0 (contact@project.com)"
        }

        response = requests.get(url, params=params, headers=headers, timeout=5)
        response.raise_for_status()
        data = response.json()

        image_links = []

        if 'query' in data and 'pages' in data['query']:
            pages = data['query']['pages']
            for page_id in pages:
                if 'imageinfo' in pages[page_id] and pages[page_id]['imageinfo']:
                    info = pages[page_id]['imageinfo'][0]
                    url = info.get('thumburl') or info.get('url')
                    if url:
                        image_links.append(url)
                    if len(image_links) == 5:
                        break

        return image_links

    except Exception as e:
        return {"error": str(e)}
