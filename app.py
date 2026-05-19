import re
import hashlib
from pathlib import Path
from datetime import date
import streamlit as st
import yaml

# Constants - Like your Ex Haha

PDIR = Path(__file__).parent / "problems"
ITMS = 9

DIFFODR = {"Easy": 0, "Medium": 1, "Hard": 2, "Unknown": 3}
DIFFCOL = {
    "Easy": "#00b8a3",
    "Medium": "#ffa116",
    "Hard": "#ff375f",
    "Unknown": "#888888",
}
DIFFICULTY_BG = {
    "Easy": "#e8f8f5",
    "Medium": "#fff7e6",
    "Hard": "#fff0f0",
    "Unknown": "#f5f5f5",
}

# Known LeetCode topic tags used for auto-classification
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

# ---------------------------------------------------------------------------
# Page configuration — must be the first Streamlit call
# ---------------------------------------------------------------------------

st.set_page_config(
    page_title="Leonardo",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ---------------------------------------------------------------------------
# Custom CSS
# ---------------------------------------------------------------------------

st.markdown(
    """
<style>
/* ── Global ── */
[data-testid="stAppViewContainer"] { background: #f8f9fb; }
[data-testid="stSidebar"] { background: #1a1a2e; }
[data-testid="stSidebar"] * { color: #e0e0e0 !important; }
[data-testid="stSidebar"] .stSelectbox label,
[data-testid="stSidebar"] .stMultiSelect label,
[data-testid="stSidebar"] .stTextInput label { color: #aaaacc !important; font-size: 0.8rem; }

/* ── Header banner ── */
.lc-header {
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%);
    border-radius: 16px;
    padding: 2rem 2.5rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1.2rem;
}
.lc-header h1 { color: #fff; margin: 0; font-size: 2rem; font-weight: 800; }
.lc-header p  { color: #a0aec0; margin: 0.3rem 0 0; font-size: 1rem; }

/* ── Problem cards ── */
.problem-card {
    background: #ffffff;
    border-radius: 14px;
    padding: 1.2rem 1.4rem;
    margin-bottom: 1rem;
    border: 1px solid #e8ecf0;
    transition: box-shadow 0.2s, transform 0.2s;
    cursor: pointer;
    position: relative;
    overflow: hidden;
}
.problem-card:hover {
    box-shadow: 0 8px 24px rgba(0,0,0,0.10);
    transform: translateY(-2px);
}
.problem-card::before {
    content: "";
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 4px;
    border-radius: 14px 0 0 14px;
}
.card-easy::before   { background: #00b8a3; }
.card-medium::before { background: #ffa116; }
.card-hard::before   { background: #ff375f; }
.card-unknown::before { background: #888; }

.problem-number { font-size: 0.75rem; color: #888; font-weight: 600; letter-spacing: 0.04em; }
.problem-title  { font-size: 1.1rem; font-weight: 700; color: #1a202c; margin: 0.2rem 0 0.5rem; }

.badge {
    display: inline-block;
    padding: 0.15rem 0.65rem;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    margin-right: 0.35rem;
}
.badge-easy   { background: #e8f8f5; color: #00b8a3; }
.badge-medium { background: #fff7e6; color: #b97800; }
.badge-hard   { background: #fff0f0; color: #c0392b; }
.badge-tag    { background: #eef2ff; color: #4f46e5; }

.card-date { font-size: 0.72rem; color: #aaa; margin-top: 0.6rem; }

/* ── Detail view ── */
.detail-header {
    background: #ffffff;
    border-radius: 14px;
    padding: 1.5rem 2rem;
    margin-bottom: 1.5rem;
    border: 1px solid #e8ecf0;
}
.back-btn button {
    background: none !important;
    border: 1px solid #e2e8f0 !important;
    color: #555 !important;
    font-size: 0.85rem !important;
    border-radius: 8px !important;
    padding: 0.3rem 1rem !important;
}

/* ── Pagination ── */
.pagination-bar {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding: 1rem 0;
}
.page-info { color: #555; font-size: 0.9rem; }

/* ── Upload zone ── */
[data-testid="stFileUploader"] {
    border: 2px dashed #c7d2fe !important;
    border-radius: 12px !important;
    background: #f5f7ff !important;
    padding: 1rem !important;
}

/* ── Metrics strip ── */
.metric-strip {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.2rem;
    flex-wrap: wrap;
}
.metric-box {
    background: #fff;
    border-radius: 12px;
    padding: 0.8rem 1.2rem;
    border: 1px solid #e8ecf0;
    min-width: 100px;
    text-align: center;
}
.metric-val { font-size: 1.6rem; font-weight: 800; color: #1a202c; }
.metric-lbl { font-size: 0.72rem; color: #888; font-weight: 600; }

/* ── Permalink box ── */
.permalink-box {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 8px;
    padding: 0.6rem 1rem;
    font-size: 0.82rem;
    color: #166534;
    font-family: monospace;
    word-break: break-all;
}

/* Hide Streamlit branding */
#MainMenu, footer { visibility: hidden; }
</style>
""",
    unsafe_allow_html=True,
)

# ---------------------------------------------------------------------------
# Helpers — parsing
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


def _detect_tags(content: str) -> list[str]:
    found = []
    content_lower = content.lower()
    for tag in KNOWN_TAGS:
        if tag.lower() in content_lower and tag not in found:
            found.append(tag)
    return found[:8]  # cap at 8


def _extract_number(filename: str, content: str) -> int | None:
    # From filename like "0001-two-sum.md" or "problem-42-title.md"
    m = re.search(r"(?:^|[-_])0*(\d+)", filename)
    if m:
        return int(m.group(1))
    # From first heading like "# 1. Two Sum" or "## Problem 42"
    m = re.search(r"#\s+(\d+)\.", content)
    if m:
        return int(m.group(1))
    return None


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

    # Derive slug from number + title, or just title
    title = meta.get("title") or _infer_title(body, filename)
    number = meta.get("number") or _extract_number(filename, body)
    difficulty = meta.get("difficulty") or _detect_difficulty(body)
    tags = meta.get("tags") or _detect_tags(body)
    problem_date = meta.get("date") or None
    url = meta.get("url") or ""

    # Normalise types
    if isinstance(tags, str):
        tags = [t.strip() for t in tags.split(",")]
    if isinstance(problem_date, date):
        problem_date = str(problem_date)

    # Build slug from number + title, or just title; uid hash as fallback
    slug_base = f"{number}-{_slugify(title)}" if number else _slugify(title)
    uid = hashlib.md5(filename.encode()).hexdigest()[:6]
    slug = slug_base if slug_base else uid

    return {
        "slug": slug,
        "title": title,
        "number": number,
        "difficulty": difficulty if difficulty in DIFFCOL else "Unknown",
        "tags": tags if isinstance(tags, list) else [],
        "date": problem_date,
        "url": url,
        "body": body.strip(),
        "filename": filename,
    }


def _infer_title(body: str, filename: str) -> str:
    """Grab title from first H1/H2 heading or fall back to filename stem."""
    m = re.search(r"^#{1,2}\s+(.+)$", body, re.MULTILINE)
    if m:
        # Remove leading "N. " pattern
        title = re.sub(r"^\d+\.\s+", "", m.group(1)).strip()
        return title
    stem = Path(filename).stem
    # Convert "0001-two-sum" → "Two Sum"
    stem = re.sub(r"^\d+-", "", stem)
    return stem.replace("-", " ").title()

@st.cache_data(show_spinner=False)
def load_bundled_problems() -> list[dict]:
    """Load all .md files shipped in the problems/ directory and subdirectories."""
    problems = []
    if PDIR.exists():
        # Load from root problems/ directory
        for path in sorted(PDIR.glob("*.md")):
            try:
                raw = path.read_text(encoding="utf-8")
                p = parse_markdown(raw, path.name)
                problems.append(p)
            except Exception:
                pass
        
        # Load from subdirectories (tag-based folders)
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


def load_uploaded_problems(uploaded_files) -> list[dict]:
    """Parse a list of Streamlit UploadedFile objects."""
    problems = []
    for f in uploaded_files:
        try:
            raw = f.read().decode("utf-8")
            p = parse_markdown(raw, f.name)
            problems.append(p)
        except Exception:
            pass
    return problems


def _generate_markdown_with_frontmatter(problem_data: dict) -> str:
    """Generate a properly formatted markdown file with YAML front-matter."""
    # Build front-matter
    frontmatter = "---\n"
    frontmatter += f"title: \"{problem_data.get('title', 'Untitled')}\"\n"
    
    if problem_data.get('number'):
        frontmatter += f"number: {problem_data['number']}\n"
    
    frontmatter += f"difficulty: \"{problem_data.get('difficulty', 'Unknown')}\"\n"
    
    if problem_data.get('tags'):
        tags_yaml = "[" + ", ".join(f'\"{tag}\"' for tag in problem_data['tags']) + "]"
        frontmatter += f"tags: {tags_yaml}\n"
    
    if problem_data.get('date'):
        frontmatter += f"date: \"{problem_data['date']}\"\n"
    else:
        from datetime import datetime
        frontmatter += f"date: \"{datetime.now().strftime('%Y-%m-%d')}\"\n"
    
    if problem_data.get('url'):
        frontmatter += f"url: \"{problem_data['url']}\"\n"
    
    frontmatter += "---\n\n"
    
    # Add body content
    content = frontmatter + problem_data.get('body', '')
    return content


def save_problem_to_disk(problem_data: dict) -> str:
    """Save a problem to disk in the appropriate tag directory.
    
    Returns the path where the file was saved.
    """
    # Determine directory based on primary tag
    tags = problem_data.get('tags', [])
    
    # Use first tag as primary directory, or 'Uncategorized' if no tags
    if tags:
        # Map common tag variations to existing directories
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
        
        primary_tag = tags[0]
        dir_name = tag_mapping.get(primary_tag, primary_tag.replace(' ', ''))
    else:
        dir_name = 'Uncategorized'
    
    # Create directory if it doesn't exist
    target_dir = PDIR / dir_name
    target_dir.mkdir(parents=True, exist_ok=True)
    
    # Generate filename
    number = problem_data.get('number')
    title_slug = _slugify(problem_data.get('title', 'problem'))
    
    if number:
        filename = f"{number:04d}-{title_slug}.md"
    else:
        filename = f"{title_slug}.md"
    
    # Full path
    file_path = target_dir / filename
    
    # Generate content with front-matter
    content = _generate_markdown_with_frontmatter(problem_data)
    
    # Write to file
    file_path.write_text(content, encoding='utf-8')
    
    return str(file_path)


# ---------------------------------------------------------------------------
# Session state initialisation
# ---------------------------------------------------------------------------


def _init_state():
    defaults = {
        "uploaded_problems": [],
        "current_problem_slug": None,
        "page": 1,
        "difficulty_filter": "All",
        "tag_filter": [],
        "search_query": "",
    }
    for key, val in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = val


# ---------------------------------------------------------------------------
# Routing via query params
# ---------------------------------------------------------------------------


def _read_route() -> str | None:
    """Return the ?problem= query param value if present."""
    params = st.query_params
    return params.get("problem", None)


def _set_route(slug: str | None):
    if slug:
        st.query_params["problem"] = slug
    else:
        st.query_params.clear()


# ---------------------------------------------------------------------------
# UI components
# ---------------------------------------------------------------------------


def _difficulty_badge(difficulty: str) -> str:
    cls = f"badge-{difficulty.lower()}" if difficulty != "Unknown" else "badge-tag"
    return f'<span class="badge {cls}">{difficulty}</span>'


def _tag_badges(tags: list[str], max_tags: int = 3) -> str:
    shown = tags[:max_tags]
    html = "".join(f'<span class="badge badge-tag">{t}</span>' for t in shown)
    if len(tags) > max_tags:
        html += f'<span class="badge badge-tag">+{len(tags) - max_tags}</span>'
    return html


def render_header():
    st.markdown(
        """
<div class="lc-header">
  <div style="font-size:2.8rem;">⚡</div>
  <div>
    <h1>LeetCode Daily Series</h1>
    <p>Browse, upload, and explore optimised LeetCode problem solutions</p>
  </div>
</div>
""",
        unsafe_allow_html=True,
    )


def render_metrics(problems: list[dict]):
    easy = sum(1 for p in problems if p["difficulty"] == "Easy")
    medium = sum(1 for p in problems if p["difficulty"] == "Medium")
    hard = sum(1 for p in problems if p["difficulty"] == "Hard")

    st.markdown(
        f"""
<div class="metric-strip">
  <div class="metric-box">
    <div class="metric-val">{len(problems)}</div>
    <div class="metric-lbl">TOTAL</div>
  </div>
  <div class="metric-box">
    <div class="metric-val" style="color:#00b8a3">{easy}</div>
    <div class="metric-lbl">EASY</div>
  </div>
  <div class="metric-box">
    <div class="metric-val" style="color:#ffa116">{medium}</div>
    <div class="metric-lbl">MEDIUM</div>
  </div>
  <div class="metric-box">
    <div class="metric-val" style="color:#ff375f">{hard}</div>
    <div class="metric-lbl">HARD</div>
  </div>
</div>
""",
        unsafe_allow_html=True,
    )


def render_sidebar(all_problems: list[dict]):
    """Render filters and uploader in the sidebar."""
    with st.sidebar:
        st.markdown("## LeetCode Series")
        st.markdown("---")

        # ── Upload ──────────────────────────────────────────────
        st.markdown("### Upload Problems")
        st.caption("Drop one or more `.md` files to add them.")
        uploaded = st.file_uploader(
            "Upload .md files",
            type=["md"],
            accept_multiple_files=True,
            label_visibility="collapsed",
        )
        if uploaded:
            new_problems = load_uploaded_problems(uploaded)
            # Merge, avoiding duplicates by slug
            existing_slugs = {p["slug"] for p in st.session_state.uploaded_problems}
            added = 0
            saved_paths = []
            
            for p in new_problems:
                if p["slug"] not in existing_slugs:
                    # Save to disk
                    try:
                        file_path = save_problem_to_disk(p)
                        saved_paths.append(file_path)
                        st.session_state.uploaded_problems.append(p)
                        existing_slugs.add(p["slug"])
                        added += 1
                    except Exception as e:
                        st.error(f"Failed to save {p.get('title', 'problem')}: {str(e)}")
            
            if added:
                st.success(f"Added and saved {added} problem(s)!")
                with st.expander("View saved locations"):
                    for path in saved_paths:
                        st.code(path, language="text")
                st.session_state.page = 1
                # Clear cache to reload bundled problems
                st.cache_data.clear()

        st.markdown("---")

        # ── Filters ─────────────────────────────────────────────
        st.markdown("### Filters")

        st.session_state.search_query = st.text_input(
            "Search by title or number",
            value=st.session_state.search_query,
            placeholder="e.g. Two Sum, 121, sliding window…",
        )

        st.session_state.difficulty_filter = st.selectbox(
            "Difficulty",
            ["All", "Easy", "Medium", "Hard"],
            index=["All", "Easy", "Medium", "Hard"].index(
                st.session_state.difficulty_filter
            ),
        )

        # Collect all tags present in the current problem set
        all_tags = sorted(
            {tag for p in all_problems for tag in p.get("tags", [])}
        )
        st.session_state.tag_filter = st.multiselect(
            "Topic Tags",
            all_tags,
            default=[t for t in st.session_state.tag_filter if t in all_tags],
        )

        st.markdown("---")

        # ── Sort ────────────────────────────────────────────────
        sort_key = st.selectbox(
            "Sort by",
            ["Number ↑", "Number ↓", "Difficulty ↑", "Difficulty ↓", "Date ↓"],
        )

        if st.button(" Reset Filters", use_container_width=True):
            st.session_state.search_query = ""
            st.session_state.difficulty_filter = "All"
            st.session_state.tag_filter = []
            st.session_state.page = 1
            _set_route(None)
            st.rerun()

    return sort_key


def _apply_filters(problems: list[dict]) -> list[dict]:
    result = problems

    # Search
    q = st.session_state.search_query.strip().lower()
    if q:
        result = [
            p for p in result
            if q in p["title"].lower()
            or (p["number"] and q in str(p["number"]))
            or any(q in t.lower() for t in p.get("tags", []))
        ]

    # Difficulty
    diff = st.session_state.difficulty_filter
    if diff != "All":
        result = [p for p in result if p["difficulty"] == diff]

    # Tags
    tag_filter = st.session_state.tag_filter
    if tag_filter:
        result = [
            p for p in result
            if any(t in p.get("tags", []) for t in tag_filter)
        ]

    return result


def _sort_problems(problems: list[dict], sort_key: str) -> list[dict]:
    if sort_key == "Number ↑":
        return sorted(problems, key=lambda p: (p["number"] or 99999))
    if sort_key == "Number ↓":
        return sorted(problems, key=lambda p: (p["number"] or 0), reverse=True)
    if sort_key == "Difficulty ↑":
        return sorted(problems, key=lambda p: DIFFODR.get(p["difficulty"], 3))
    if sort_key == "Difficulty ↓":
        return sorted(
            problems, key=lambda p: DIFFODR.get(p["difficulty"], 3), reverse=True
        )
    if sort_key == "Date ↓":
        return sorted(problems, key=lambda p: p["date"] or "", reverse=True)
    return problems


def render_problem_card(problem: dict, col):
    """Render a single problem card inside a Streamlit column."""
    diff = problem["difficulty"]
    card_cls = f"card-{diff.lower()}"
    num_str = f"#{problem['number']}" if problem["number"] else ""
    tags_html = _tag_badges(problem.get("tags", []))
    date_str = f"{problem['date']}" if problem.get("date") else ""

    card_html = f"""
<div class="problem-card {card_cls}">
  <div class="problem-number">{num_str}</div>
  <div class="problem-title">{problem['title']}</div>
  {_difficulty_badge(diff)}
  {tags_html}
  <div class="card-date">{date_str}</div>
</div>
"""
    with col:
        st.markdown(card_html, unsafe_allow_html=True)
        if st.button("Open →", key=f"btn_{problem['slug']}"):
            st.session_state.current_problem_slug = problem["slug"]
            _set_route(problem["slug"])
            st.rerun()


def render_pagination(total: int) -> int:
    total_pages = max(1, (total + ITMS - 1) // ITMS)
    page = st.session_state.page

    # Clamp
    page = max(1, min(page, total_pages))
    st.session_state.page = page

    col_prev, col_info, col_next = st.columns([1, 2, 1])

    with col_prev:
        if st.button("← Prev", disabled=(page <= 1), use_container_width=True):
            st.session_state.page = page - 1
            st.rerun()

    with col_info:
        st.markdown(
            f'<div class="pagination-bar"><span class="page-info">Page {page} of {total_pages}  •  {total} problem(s)</span></div>',
            unsafe_allow_html=True,
        )

    with col_next:
        if st.button("Next →", disabled=(page >= total_pages), use_container_width=True):
            st.session_state.page = page + 1
            st.rerun()

    return page


def render_list_view(problems: list[dict], sort_key: str):
    """Render the paginated grid of problem cards."""
    filtered = _apply_filters(problems)
    sorted_problems = _sort_problems(filtered, sort_key)

    render_metrics(problems)

    if not sorted_problems:
        st.info("No problems match your filters. Try adjusting the search or filters in the sidebar.")
        return

    page = render_pagination(len(sorted_problems))

    start = (page - 1) * ITMS
    page_items = sorted_problems[start: start + ITMS]

    # 3-column grid
    for row_start in range(0, len(page_items), 3):
        cols = st.columns(3, gap="medium")
        for i, problem in enumerate(page_items[row_start: row_start + 3]):
            render_problem_card(problem, cols[i])


def render_detail_view(problem: dict):
    """Render the full problem detail / solution page."""
    diff = problem["difficulty"]
    diff_color = DIFFCOL.get(diff, "#888")
    num_str = f"#{problem['number']} · " if problem["number"] else ""
    tags_html = _tag_badges(problem.get("tags", []), max_tags=10)
    date_str = f"{problem['date']}" if problem.get("date") else ""

    # Permalink
    permalink = f"?problem={problem['slug']}"

    # Back button
    bcol, _ = st.columns([1, 5])
    with bcol:
        if st.button("← Back to list"):
            st.session_state.current_problem_slug = None
            _set_route(None)
            st.rerun()

    # Header card
    st.markdown(
        f"""
<div class="detail-header">
  <div style="font-size:0.85rem; color:#888; margin-bottom:0.3rem">{num_str}{date_str}</div>
  <h2 style="margin:0 0 0.6rem; color:#1a202c">{problem['title']}</h2>
  <div style="margin-bottom:0.7rem">
    <span class="badge" style="background:{DIFFICULTY_BG.get(diff,'#eee')}; color:{diff_color}; font-weight:700">{diff}</span>
    {tags_html}
  </div>
  <div class="permalink-box">Permalink: {permalink}</div>
</div>
""",
        unsafe_allow_html=True,
    )

    # LeetCode link
    if problem.get("url"):
        st.markdown(
            f"[ View on LeetCode]({problem['url']})",
            help="Opens the original LeetCode problem page",
        )

    st.markdown("---")

    # Render body markdown
    st.markdown(problem["body"])


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    _init_state()

    # Combine bundled + uploaded problems
    bundled = load_bundled_problems()
    all_problems = bundled + st.session_state.uploaded_problems

    # Render sidebar (returns sort preference)
    sort_key = render_sidebar(all_problems)

    render_header()

    # ── Routing ────────────────────────────────────────────────────────────
    # Priority: URL query param > session state
    url_slug = _read_route()
    if url_slug:
        st.session_state.current_problem_slug = url_slug

    current_slug = st.session_state.current_problem_slug

    if current_slug:
        # Find the problem by slug
        problem_map = {p["slug"]: p for p in all_problems}
        problem = problem_map.get(current_slug)
        if problem:
            render_detail_view(problem)
        else:
            st.warning(f"Problem **{current_slug}** not found.")
            if st.button("← Back to list"):
                st.session_state.current_problem_slug = None
                _set_route(None)
                st.rerun()
    else:
        render_list_view(all_problems, sort_key)


if __name__ == "__main__":
    main()
