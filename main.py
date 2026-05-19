import re
import hashlib
from pathlib import Path
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yaml

# Constants
PDIR = Path(__file__).parent / "problems"
PDIR.mkdir(exist_ok=True)

KNOWN_TAGS = [
    "Array", "String", "Hash Table", "Dynamic Programming", "Math",
    "Sorting", "Greedy", "Depth-First Search", "Binary Search", "Database",
    "Breadth-First Search", "Tree", "Matrix", "Two Pointers", "Binary Tree",
    "Bit Manipulation", "Stack", "Heap", "Priority Queue", "Graph",
    "Prefix Sum", "Simulation", "Design", "Counting", "Backtracking",
    "Sliding Window", "Linked List", "Union Find", "Queue", "Recursion",
    "Divide and Conquer", "Memoization", "Monotonic Stack", "Trie",
    "Number Theory", "Geometry", "Game Theory", "Segment Tree",
]

app = FastAPI(
    title="LeetCode Daily Series",
    description="Browse, edit, and explore LeetCode problem solutions",
    version="2.0.0"
)


class MarkdownEditorPayload(BaseModel):
    markdown: str
    filename: Optional[str] = None


class MarkdownUpdatePayload(BaseModel):
    slug: str
    markdown: str

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Helper Functions
# ---------------------------------------------------------------------------

def _slugify(text: str) -> str:
    """Convert a string into a URL-safe slug."""
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text


def _detect_difficulty(content: str) -> str:
    content_lower = content.lower()
    for word in ["hard", "difficult", "complex"]:
        if word in content_lower:
            return "Hard"
    for word in ["medium", "moderate"]:
        if word in content_lower:
            return "Medium"
    for word in ["easy", "simple", "basic"]:
        if word in content_lower:
            return "Easy"
    return "Unknown"


def _detect_tags(content: str) -> List[str]:
    found = []
    content_lower = content.lower()
    for tag in KNOWN_TAGS:
        if tag.lower() in content_lower and tag not in found:
            found.append(tag)
    return found[:8]


def _extract_number(filename: str, content: str) -> Optional[int]:
    m = re.search(r"(?:^|[-_])0*(\d+)", filename)
    if m:
        return int(m.group(1))
    m = re.search(r"#\s+(\d+)\.", content)
    if m:
        return int(m.group(1))
    return None


def _infer_title(body: str, filename: str) -> str:
    m = re.search(r"^#{1,2}\s+(.+)$", body, re.MULTILINE)
    if m:
        title = re.sub(r"^\d+\.\s+", "", m.group(1)).strip()
        return title
    stem = Path(filename).stem
    stem = re.sub(r"^\d+-", "", stem)
    return stem.replace("-", " ").title()


def parse_markdown(raw: str, filename: str = "") -> dict:
    meta: dict = {}
    body = raw
    fm_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", raw, re.DOTALL)
    if fm_match:
        try:
            meta = yaml.safe_load(fm_match.group(1)) or {}
        except yaml.YAMLError:
            meta = {}
        body = raw[fm_match.end():]

    title = meta.get("title") or _infer_title(body, filename)
    number = meta.get("number") or _extract_number(filename, body)
    difficulty = meta.get("difficulty") or _detect_difficulty(body)
    tags = meta.get("tags") or _detect_tags(body)
    problem_date = meta.get("date") or None
    url = meta.get("url") or ""

    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",")]
    if isinstance(problem_date, datetime):
        problem_date = str(problem_date.date())

    slug_base = f"{number}-{_slugify(title)}" if number else _slugify(title)
    uid = hashlib.md5(filename.encode()).hexdigest()[:6]
    slug = slug_base if slug_base else uid

    return {
        "slug": slug,
        "title": title,
        "number": number,
        "difficulty": difficulty if difficulty in ["Easy", "Medium", "Hard"] else "Unknown",
        "tags": tags if isinstance(tags, list) else [],
        "date": str(problem_date) if problem_date else None,
        "url": url,
        "body": body.strip(),
        "filename": filename,
    }


def load_all_problems() -> List[dict]:
    """Load all problems from the problems directory and subdirectories."""
    problems = []
    if PDIR.exists():
        # Load from root
        for path in sorted(PDIR.glob("*.md")):
            try:
                raw = path.read_text(encoding="utf-8")
                p = parse_markdown(raw, path.name)
                problems.append(p)
            except Exception:
                pass
        
        # Load from subdirectories
        for subdir in PDIR.iterdir():
            if subdir.is_dir():
                for path in sorted(subdir.glob("*.md")):
                    try:
                        raw = path.read_text(encoding="utf-8")
                        p = parse_markdown(raw, path.name)
                        problems.append(p)
                    except Exception:
                        pass
    return problems


def find_problem_by_slug(slug: str) -> Optional[tuple[Path, str, dict]]:
    """Find a problem file by slug and return its path, raw markdown, and parsed data."""
    if not PDIR.exists():
        return None

    for path in sorted(PDIR.rglob("*.md")):
        try:
            raw = path.read_text(encoding="utf-8")
            parsed = parse_markdown(raw, path.name)
            if parsed["slug"] == slug:
                return path, raw, parsed
        except Exception:
            continue

    return None


def _generate_markdown_with_frontmatter(problem_data: dict) -> str:
    """Generate a properly formatted markdown file with YAML front-matter."""
    frontmatter = "---\n"
    frontmatter += f"title: \"{problem_data.get('title', 'Untitled')}\"\n"
    
    if problem_data.get('number'):
        frontmatter += f"number: {problem_data['number']}\n"
    
    frontmatter += f"difficulty: \"{problem_data.get('difficulty', 'Unknown')}\"\n"
    
    if problem_data.get('tags'):
        tags_yaml = "[" + ", ".join(f'"{tag}"' for tag in problem_data['tags']) + "]"
        frontmatter += f"tags: {tags_yaml}\n"
    
    if problem_data.get('date'):
        frontmatter += f"date: \"{problem_data['date']}\"\n"
    else:
        frontmatter += f"date: \"{datetime.now().strftime('%Y-%m-%d')}\"\n"
    
    if problem_data.get('url'):
        frontmatter += f"url: \"{problem_data['url']}\"\n"
    
    frontmatter += "---\n\n"
    content = frontmatter + problem_data.get('body', '')
    return content


def save_problem_to_disk(problem_data: dict) -> str:
    """Save a problem to disk in the appropriate tag directory."""
    tags = problem_data.get('tags', [])
    
    tag_mapping = {
        'Hash Table': 'Array',
        'Dynamic Programming': 'Dp',
        'Two Pointers': 'TwoPointers',
        'Linked List': 'LinkedList',
        'Bit Manipulation': 'BitManipulation',
        'Binary Tree': 'Trees',
        'Tree': 'Trees',
        'String': 'Strings',
        'Trie': 'Tries',
    }
    
    if tags:
        primary_tag = tags[0]
        dir_name = tag_mapping.get(primary_tag, primary_tag.replace(' ', ''))
    else:
        dir_name = 'Uncategorized'
    
    target_dir = PDIR / dir_name
    target_dir.mkdir(parents=True, exist_ok=True)
    
    number = problem_data.get('number')
    title_slug = _slugify(problem_data.get('title', 'problem'))
    
    if number:
        filename = f"{number:04d}-{title_slug}.md"
    else:
        filename = f"{title_slug}.md"
    
    file_path = target_dir / filename
    content = _generate_markdown_with_frontmatter(problem_data)
    file_path.write_text(content, encoding='utf-8')
    
    return str(file_path.relative_to(Path.cwd()))


# ---------------------------------------------------------------------------
# API Endpoints
# ---------------------------------------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def read_root():
    """Serve the main HTML page."""
    html_file = Path(__file__).parent / "static" / "index.html"
    if html_file.exists():
        return HTMLResponse(content=html_file.read_text())
    return HTMLResponse(content="<h1>LeetCode Daily Series API</h1><p>Frontend not found. API is running at /docs</p>")


@app.get("/api/problems")
async def get_problems(
    difficulty: Optional[str] = Query(None, description="Filter by difficulty"),
    tag: Optional[str] = Query(None, description="Filter by tag"),
    search: Optional[str] = Query(None, description="Search in title or number"),
    sort: Optional[str] = Query("number_asc", description="Sort by: number_asc, number_desc, difficulty_asc, difficulty_desc, date_desc")
):
    """Get all problems with optional filters."""
    problems = load_all_problems()
    
    # Apply filters
    if difficulty and difficulty != "All":
        problems = [p for p in problems if p["difficulty"] == difficulty]
    
    if tag:
        problems = [p for p in problems if tag in p.get("tags", [])]
    
    if search:
        search_lower = search.lower()
        problems = [
            p for p in problems
            if search_lower in p["title"].lower()
            or (p["number"] and search_lower in str(p["number"]))
            or any(search_lower in t.lower() for t in p.get("tags", []))
        ]
    
    # Apply sorting
    difficulty_order = {"Easy": 0, "Medium": 1, "Hard": 2, "Unknown": 3}
    
    if sort == "number_asc":
        problems = sorted(problems, key=lambda p: (p["number"] or 99999))
    elif sort == "number_desc":
        problems = sorted(problems, key=lambda p: (p["number"] or 0), reverse=True)
    elif sort == "difficulty_asc":
        problems = sorted(problems, key=lambda p: difficulty_order.get(p["difficulty"], 3))
    elif sort == "difficulty_desc":
        problems = sorted(problems, key=lambda p: difficulty_order.get(p["difficulty"], 3), reverse=True)
    elif sort == "date_desc":
        problems = sorted(problems, key=lambda p: p["date"] or "", reverse=True)
    
    return JSONResponse(content={"problems": problems, "total": len(problems)})


@app.get("/api/problems/{slug}")
async def get_problem(slug: str):
    """Get a single problem by slug."""
    problems = load_all_problems()
    problem = next((p for p in problems if p["slug"] == slug), None)
    
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")
    
    return JSONResponse(content=problem)


@app.get("/api/problems/{slug}/raw")
async def get_problem_raw(slug: str):
    """Get the raw markdown for a problem by slug."""
    result = find_problem_by_slug(slug)
    if not result:
        raise HTTPException(status_code=404, detail="Problem not found")

    path, raw, parsed = result
    return JSONResponse(content={
        "slug": parsed["slug"],
        "title": parsed["title"],
        "filename": path.name,
        "path": str(path.relative_to(Path.cwd())),
        "markdown": raw,
    })


@app.get("/api/stats")
async def get_stats():
    """Get statistics about all problems."""
    problems = load_all_problems()
    
    stats = {
        "total": len(problems),
        "easy": sum(1 for p in problems if p["difficulty"] == "Easy"),
        "medium": sum(1 for p in problems if p["difficulty"] == "Medium"),
        "hard": sum(1 for p in problems if p["difficulty"] == "Hard"),
        "tags": {}
    }
    
    # Count problems per tag
    for problem in problems:
        for tag in problem.get("tags", []):
            stats["tags"][tag] = stats["tags"].get(tag, 0) + 1
    
    return JSONResponse(content=stats)


@app.get("/api/tags")
async def get_tags():
    """Get all unique tags from problems."""
    problems = load_all_problems()
    all_tags = sorted(set(tag for p in problems for tag in p.get("tags", [])))
    return JSONResponse(content={"tags": all_tags})


@app.post("/api/editor/save")
async def save_markdown_from_editor(payload: MarkdownEditorPayload):
    """Save markdown pasted in editor to disk."""
    raw = (payload.markdown or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="Markdown content is empty")

    filename = (payload.filename or "").strip()
    if filename and not filename.endswith(".md"):
        filename = f"{filename}.md"
    if not filename:
        filename = "editor.md"

    try:
        problem = parse_markdown(raw, filename)
        file_path = save_problem_to_disk(problem)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return JSONResponse(content={
        "title": problem["title"],
        "slug": problem["slug"],
        "path": file_path
    })


@app.put("/api/editor/update")
async def update_markdown_from_editor(payload: MarkdownUpdatePayload):
    """Update an existing markdown file by slug."""
    raw = payload.markdown or ""
    if not raw.strip():
        raise HTTPException(status_code=400, detail="Markdown content is empty")

    result = find_problem_by_slug(payload.slug)
    if not result:
        raise HTTPException(status_code=404, detail="Problem not found")

    path, _, _ = result
    raw_to_write = raw.rstrip() + "\n"
    path.write_text(raw_to_write, encoding="utf-8")
    updated = parse_markdown(raw_to_write, path.name)

    return JSONResponse(content=updated)


@app.get("/health")
async def health_check():
    """Health check endpoint for deployment platforms."""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


# Mount static files
static_dir = Path(__file__).parent / "static"
static_dir.mkdir(exist_ok=True)

try:
    app.mount("/static", StaticFiles(directory=str(static_dir)), name="static")
except Exception:
    pass  # Static directory might not exist yet


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
