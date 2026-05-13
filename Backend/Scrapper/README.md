# ThinkBridge Backend

An educational content API that provides images, videos, links, and AI-powered tutoring using Ollama models.

## Features

- **Educational Content Aggregation**: Fetch relevant images, videos, and links for any educational query
- **AI Tutoring with Mermaid Diagrams**: Interactive learning with AI-generated explanations and visual diagrams
- **Multi-Model LLM Support**: Uses Ollama with fallback mechanisms (llama3.1, gemma3, deepseek-r1)
- **Session-Based Chat History**: Maintains conversation context per user session
- **Streaming Responses**: Real-time streaming of AI responses in NDJSON format

## Project Structure

```
backend/
├── main.py                 # Content API (images, videos, links)
├── ollama.py              # Legacy standalone Ollama wrapper
├── llmtest/
│   ├── main.py            # AI Tutoring API with chat history
│   └── chat.py            # (Legacy chat module)
├── Scripts/
│   ├── images.py          # DuckDuckGo image search
│   ├── imagefallback.py   # Wikimedia fallback for images
│   ├── videos.py          # DuckDuckGo video search
│   ├── videosfallback.py  # YouTube-DLP fallback for videos
│   └── links.py           # DuckDuckGo link search
├── pyproject.toml         # Project metadata
└── uv.lock                # Dependency lock file
```

## API Endpoints

### Content API (main.py) - Port 8080

#### GET `/`
Health check endpoint
- **Response**: `{ "message": "Welcome to the Educational Content API! ..." }`

#### GET `/images`
Fetch educational images for a given query
- **Parameters**:
  - `query` (required, string): Search query
- **Response**:
  ```json
  {
    "query": "photosynthesis",
    "images": ["image_url_1", "image_url_2", ...]
  }
  ```
- **Fallback**: Uses Wikimedia images if DuckDuckGo returns < 3 results

#### GET `/videos`
Fetch educational videos for a given query
- **Parameters**:
  - `query` (required, string): Search query
  - `std` (optional, int, default=7): Grade/standard level
  - `limit` (optional, int, default=5): Max number of videos to return
- **Response**:
  ```json
  {
    "query": "algebra basics",
    "videos": ["video_url_1", "video_url_2", ...]
  }
  ```
- **Fallback**: Uses YouTube-DLP if DuckDuckGo returns fewer results than limit

#### GET `/links`
Fetch relevant educational links for a given query
- **Parameters**:
  - `query` (required, string): Search query
  - `std` (optional, int, default=7): Grade/standard level
  - `limit` (optional, int, default=2): Max number of links to return
- **Response**:
  ```json
  {
    "query": "geometry",
    "links": ["link_1", "link_2"]
  }
  ```
- **Fallback**: Uses Shaalaa.com if DuckDuckGo returns fewer results than limit

---

### AI Tutoring API (llmtest/main.py) - Port 8000

#### POST `/chat`
Stream AI-powered tutoring responses with Socratic method and Mermaid diagrams
- **Parameters**:
  - `query` (required, string): Student's question
  - `session_id` (optional, string, default="default"): Session identifier for conversation history
  - `deep_research` (optional, bool, default=false): Use DeepSeek-r1 for deeper reasoning
- **Response**: Streaming NDJSON format
  ```json
  {"session_id": "user1", "model_name": "llama3.1:8b", "response": "token"}
  {"session_id": "user1", "model_name": "llama3.1:8b", "response": " of"}
  {"session_id": "user1", "model_name": "llama3.1:8b", "response": " text"}
  ```
- **Model Selection**:
  - `deepseek-r1:latest`: Deep reasoning (when `deep_research=true`)
  - `llama3.1:8b`: Why/how/explain questions
  - `gemma3:12b`: Summarize/list/define/solve questions

#### GET `/chat/history`
Retrieve conversation history for a session (debugging)
- **Parameters**:
  - `session_id` (optional, string, default="default"): Session identifier
- **Response**:
  ```json
  {
    "session_id": "user1",
    "history": [
      {"role": "user", "content": "Explain photosynthesis"},
      {"role": "assistant", "content": "..."},
      ...
    ]
  }
  ```

#### DELETE `/chat/history`
Clear conversation history for a session
- **Parameters**:
  - `session_id` (optional, string, default="default"): Session identifier
- **Response**: `{ "cleared": true, "session_id": "user1" }`

---

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/Halfgods/ThinkBridge-Backend.git
   cd backend
   ```

2. **Create and activate virtual environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   # or with uv:
   uv sync
   ```

4. **Ensure Ollama is running**:
   ```bash
   ollama serve
   # In another terminal, pull models:
   ollama pull llama3.1:8b
   ollama pull gemma3:12b
   ollama pull deepseek-r1:latest
   ```

## Running the APIs

### Content API (Port 8080)
```bash
python main.py
```

### AI Tutoring API (Port 8000)
```bash
python llmtest/main.py
```

## Usage Examples

### Fetch Educational Images
```bash
curl "http://localhost:8080/images?query=photosynthesis"
```

### Fetch Videos
```bash
curl "http://localhost:8080/videos?query=algebra&std=8&limit=5"
```

### Get Tutoring Response (Streaming)
```bash
curl -N "http://localhost:8000/chat?query=explain+photosynthesis&session_id=student1"
```

### With Python + Mermaid Rendering
```python
import asyncio
import httpx
import json

async def stream_tutoring():
    url = "http://localhost:8000/chat?query=explain+dijkstra&session_id=user1"
    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("GET", url) as resp:
            async for line in resp.aiter_lines():
                if line.strip():
                    data = json.loads(line)
                    print(data.get("response", ""), end="", flush=True)

asyncio.run(stream_tutoring())
```

## AI Tutoring Features

The `/chat` endpoint follows a structured teaching methodology:

1. **Hook**: A surprising fact or question to engage curiosity
2. **Core Explanation**: 2-4 key ideas with analogies
3. **Mermaid Diagram**: Visual representation (flowcharts, mind maps, class diagrams)
4. **Real-World Example**: Concrete, vivid scenario
5. **Quick Summary**: 2-3 sentence recap
6. **Recall Questions**: 3 progressive questions (Easy → Medium → Moderate)

The AI adapts to student grade levels and uses the Socratic method for deeper learning.

## Dependencies

See `pyproject.toml` for a complete list. Key packages:
- `fastapi`: Web framework
- `uvicorn`: ASGI server
- `httpx`: Async HTTP client for Ollama
- `duckduckgo-search`: Content aggregation
- `youtube-dl`: Video fallback
- `requests`: Additional HTTP support

## Environment Variables

None required (uses localhost Ollama by default). To customize:
- Edit `OLLAMA_URL` in `main.py` or `llmtest/main.py`
- Modify `SYSTEM_PROMPT` for different teaching styles

## License

MIT (or as specified in your GitHub repo)

## Author

Halfgods
