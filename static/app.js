let allProblems = [];
let filteredProblems = [];
let currentPage = 1;
const itemsPerPage = 12;

const themeState = {
    current: 'light',
    manual: false
};

const editorState = {
    mode: 'add',
    slug: null,
    title: ''
};

const filters = {
    search: '',
    difficulty: 'All',
    tag: '',
    sort: 'number_asc',
    smart: 'all'
};

document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    setupEventListeners();
    fetchAllProblems().then(() => handleRouting());
});

function setupEventListeners() {
    const searchInput = document.getElementById('search-input');
    const sortSelect = document.getElementById('sort-select');
    const tagSelect = document.getElementById('tag-filter');
    const difficultyChips = document.getElementById('difficulty-chips');
    const smartFilters = document.getElementById('smart-filters');
    const categoryList = document.getElementById('category-list');
    const activeFilters = document.getElementById('active-filters');
    const themeToggle = document.getElementById('theme-toggle');
    const editorScreen = document.getElementById('editor-screen');
    const editorClose = document.getElementById('editor-close');

    if (searchInput) {
        searchInput.addEventListener('input', debounce(() => {
            filters.search = searchInput.value.trim();
            applyFilters();
        }, 250));
    }

    if (sortSelect) {
        sortSelect.addEventListener('change', () => {
            filters.sort = sortSelect.value;
            applyFilters();
        });
    }

    if (tagSelect) {
        tagSelect.addEventListener('change', () => {
            setTagFilter(tagSelect.value);
        });
    }

    if (difficultyChips) {
        difficultyChips.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-difficulty]');
            if (!button) return;
            filters.difficulty = button.dataset.difficulty;
            updateChipGroup('difficulty-chips', 'difficulty', filters.difficulty);
            applyFilters();
        });
    }

    if (smartFilters) {
        smartFilters.addEventListener('click', (event) => {
            const button = event.target.closest('button[data-smart]');
            if (!button) return;
            filters.smart = button.dataset.smart;
            updateChipGroup('smart-filters', 'smart', filters.smart);
            applyFilters();
        });
    }

    if (categoryList) {
        categoryList.addEventListener('click', (event) => {
            const item = event.target.closest('[data-tag]');
            if (!item) return;
            setTagFilter(item.dataset.tag || '');
        });
    }

    if (activeFilters) {
        activeFilters.addEventListener('click', (event) => {
            const clearButton = event.target.closest('[data-clear]');
            if (!clearButton) return;
            const key = clearButton.dataset.clear;
            clearFilter(key);
        });
    }

    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    document.getElementById('toggle-editor').addEventListener('click', openAddEditor);
    document.getElementById('editor-clear').addEventListener('click', clearEditor);
    document.getElementById('editor-save').addEventListener('click', handleEditorSave);
    if (editorClose) {
        editorClose.addEventListener('click', closeEditorScreen);
    }
    if (editorScreen) {
        editorScreen.addEventListener('click', (event) => {
            if (event.target === editorScreen) {
                closeEditorScreen();
            }
        });
    }

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && isEditorOpen()) {
            closeEditorScreen();
        }
    });

    document.getElementById('prev-btn').addEventListener('click', () => changePage(-1));
    document.getElementById('next-btn').addEventListener('click', () => changePage(1));
    window.addEventListener('popstate', handleRouting);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function initializeTheme() {
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') {
        themeState.manual = true;
        setTheme(stored, false);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light', false);
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', (event) => {
        if (!themeState.manual) {
            setTheme(event.matches ? 'dark' : 'light', false);
        }
    });
}

function setTheme(theme, persist = true) {
    themeState.current = theme;
    document.documentElement.setAttribute('data-theme', theme);
    if (persist) {
        localStorage.setItem('theme', theme);
        themeState.manual = true;
    }
    updateThemeToggle();
}

function toggleTheme() {
    const next = themeState.current === 'dark' ? 'light' : 'dark';
    setTheme(next, true);
}

function updateThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;
    themeToggle.textContent = themeState.current === 'dark' ? 'Light mode' : 'Dark mode';
}

async function fetchAllProblems() {
    showLoading(true);
    try {
        const response = await fetch('/api/problems?sort=number_asc');
        const data = await response.json();
        allProblems = data.problems || [];
        renderStats(allProblems);
        renderCategories(allProblems);
        renderTagSelect(allProblems);
        applyFilters(false);
    } catch (error) {
        console.error('Failed to load problems:', error);
        showError('Failed to load problems. Please try again.');
    } finally {
        showLoading(false);
    }
}

async function loadProblem(slug) {
    showLoading(true);
    try {
        const response = await fetch(`/api/problems/${slug}`);
        if (!response.ok) throw new Error('Problem not found');
        const problem = await response.json();
        renderProblemDetail(problem);
    } catch (error) {
        console.error('Failed to load problem:', error);
        showError('Problem not found. Redirecting to list...');
        setTimeout(() => {
            window.history.pushState({}, '', '/');
            handleRouting();
        }, 1500);
    } finally {
        showLoading(false);
    }
}

function renderStats(problems) {
    const stats = {
        total: problems.length,
        easy: problems.filter(p => p.difficulty === 'Easy').length,
        medium: problems.filter(p => p.difficulty === 'Medium').length,
        hard: problems.filter(p => p.difficulty === 'Hard').length
    };

    document.getElementById('stat-total').textContent = stats.total;
    document.getElementById('stat-easy').textContent = stats.easy;
    document.getElementById('stat-medium').textContent = stats.medium;
    document.getElementById('stat-hard').textContent = stats.hard;
}

function renderTagSelect(problems) {
    const tagSelect = document.getElementById('tag-filter');
    if (!tagSelect) return;

    const tags = Array.from(new Set(problems.flatMap(problem => problem.tags || [])));
    tags.sort((a, b) => a.localeCompare(b));

    tagSelect.innerHTML = '<option value="">All tags</option>';
    tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag;
        option.textContent = tag;
        tagSelect.appendChild(option);
    });

    tagSelect.value = filters.tag;
}

function renderCategories(problems) {
    const categoryList = document.getElementById('category-list');
    if (!categoryList) return;

    const counts = {};
    problems.forEach(problem => {
        (problem.tags || []).forEach(tag => {
            counts[tag] = (counts[tag] || 0) + 1;
        });
    });

    const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const items = [''].concat(entries.map(([tag]) => tag));

    categoryList.innerHTML = items.map(tag => {
        const label = tag || 'All categories';
        const count = tag ? counts[tag] : problems.length;
        const isActive = filters.tag === tag;
        const activeClass = isActive ? 'is-active' : '';
        return `
            <button class="category-item ${activeClass}" type="button" data-tag="${escapeHtml(tag)}">
                <span>${escapeHtml(label)}</span>
                <span class="count">${count}</span>
            </button>
        `;
    }).join('');
}

function updateChipGroup(containerId, dataAttr, value) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.querySelectorAll(`[data-${dataAttr}]`).forEach(button => {
        if (button.dataset[dataAttr] === value) {
            button.classList.add('is-active');
        } else {
            button.classList.remove('is-active');
        }
    });
}

function setTagFilter(tag) {
    filters.tag = tag || '';
    const tagSelect = document.getElementById('tag-filter');
    if (tagSelect) {
        tagSelect.value = filters.tag;
    }
    renderCategories(allProblems);
    applyFilters();
}

function clearFilter(key) {
    if (key === 'all') {
        filters.search = '';
        filters.difficulty = 'All';
        filters.tag = '';
        filters.smart = 'all';
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
        updateChipGroup('difficulty-chips', 'difficulty', filters.difficulty);
        updateChipGroup('smart-filters', 'smart', filters.smart);
        setTagFilter('');
        applyFilters();
        return;
    }

    if (key === 'search') {
        filters.search = '';
        const searchInput = document.getElementById('search-input');
        if (searchInput) searchInput.value = '';
    }
    if (key === 'difficulty') {
        filters.difficulty = 'All';
        updateChipGroup('difficulty-chips', 'difficulty', filters.difficulty);
    }
    if (key === 'tag') {
        filters.tag = '';
        renderCategories(allProblems);
        const tagSelect = document.getElementById('tag-filter');
        if (tagSelect) tagSelect.value = '';
    }
    if (key === 'smart') {
        filters.smart = 'all';
        updateChipGroup('smart-filters', 'smart', filters.smart);
    }

    applyFilters();
}

function applyFilters(resetPage = true) {
    let results = [...allProblems];

    if (filters.search) {
        const query = filters.search.toLowerCase();
        results = results.filter(problem => {
            const titleMatch = problem.title.toLowerCase().includes(query);
            const numberMatch = problem.number && String(problem.number).includes(query);
            const tagMatch = (problem.tags || []).some(tag => tag.toLowerCase().includes(query));
            return titleMatch || numberMatch || tagMatch;
        });
    }

    if (filters.difficulty !== 'All') {
        results = results.filter(problem => problem.difficulty === filters.difficulty);
    }

    if (filters.tag) {
        results = results.filter(problem => (problem.tags || []).includes(filters.tag));
    }

    if (filters.smart === 'recent') {
        results = results.filter(problem => isRecent(problem));
    } else if (filters.smart === 'has_answer') {
        results = results.filter(problem => hasAnswer(problem));
    } else if (filters.smart === 'needs_answer') {
        results = results.filter(problem => !hasAnswer(problem));
    }

    results = sortProblems(results, filters.sort);
    filteredProblems = results;

    if (resetPage) {
        currentPage = 1;
    }

    updateActiveFilters();

    if (!getActiveSlug()) {
        renderProblems();
    }
}

function sortProblems(problems, sortKey) {
    const difficultyOrder = { Easy: 0, Medium: 1, Hard: 2, Unknown: 3 };

    const sorted = [...problems];
    if (sortKey === 'number_asc') {
        sorted.sort((a, b) => (a.number || 99999) - (b.number || 99999));
    } else if (sortKey === 'number_desc') {
        sorted.sort((a, b) => (b.number || 0) - (a.number || 0));
    } else if (sortKey === 'difficulty_asc') {
        sorted.sort((a, b) => difficultyOrder[a.difficulty] - difficultyOrder[b.difficulty]);
    } else if (sortKey === 'difficulty_desc') {
        sorted.sort((a, b) => difficultyOrder[b.difficulty] - difficultyOrder[a.difficulty]);
    } else if (sortKey === 'date_desc') {
        sorted.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    }
    return sorted;
}

function updateActiveFilters() {
    const container = document.getElementById('active-filters');
    if (!container) return;

    const chips = [];
    if (filters.search) chips.push({ label: `Search: ${filters.search}`, key: 'search' });
    if (filters.difficulty !== 'All') chips.push({ label: `Difficulty: ${filters.difficulty}`, key: 'difficulty' });
    if (filters.tag) chips.push({ label: `Tag: ${filters.tag}`, key: 'tag' });
    if (filters.smart !== 'all') {
        const labelMap = {
            recent: 'Recent 30d',
            has_answer: 'Has answer',
            needs_answer: 'Needs answer'
        };
        chips.push({ label: labelMap[filters.smart], key: 'smart' });
    }

    const countLabel = `Showing ${filteredProblems.length} of ${allProblems.length}`;

    container.innerHTML = `
        <span class="filter-note">${countLabel}</span>
        ${chips.map(chip => `<button class="filter-pill" type="button" data-clear="${chip.key}">${escapeHtml(chip.label)}</button>`).join('')}
        ${chips.length ? '<button class="filter-pill clear" type="button" data-clear="all">Clear all</button>' : ''}
    `;
}

function renderProblems() {
    document.body.classList.remove('view-detail');
    const container = document.getElementById('problems-container');
    const pagination = document.getElementById('pagination');

    if (filteredProblems.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-text">No problems match the current filters.</div>
            </div>
        `;
        pagination.style.display = 'none';
        return;
    }

    const totalPages = Math.ceil(filteredProblems.length / itemsPerPage);
    const startIdx = (currentPage - 1) * itemsPerPage;
    const endIdx = startIdx + itemsPerPage;
    const pageProblems = filteredProblems.slice(startIdx, endIdx);

    const gridHTML = `
        <div class="problems-grid">
            ${pageProblems.map((problem, index) => createProblemCard(problem, index)).join('')}
        </div>
    `;

    container.innerHTML = gridHTML;

    if (totalPages > 1) {
        pagination.style.display = 'flex';
        document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
        document.getElementById('prev-btn').disabled = currentPage === 1;
        document.getElementById('next-btn').disabled = currentPage === totalPages;
    } else {
        pagination.style.display = 'none';
    }

    document.querySelectorAll('.problem-card').forEach(card => {
        card.addEventListener('click', () => {
            const slug = card.dataset.slug;
            window.history.pushState({ slug }, '', `/?problem=${slug}`);
            handleRouting();
        });
    });
}

function createProblemCard(problem, index) {
    const numberText = problem.number ? `#${problem.number}` : 'Unnumbered';
    const dateText = problem.date || 'No date';
    const difficultyBadge = createDifficultyBadge(problem.difficulty);
    const tagBadges = createTagBadges(problem.tags, 2);
    const answerBadge = hasAnswer(problem) ? '<span class="badge badge-tag">Answer</span>' : '<span class="badge badge-tag">Needs answer</span>';

    return `
        <article class="problem-card" data-slug="${problem.slug}" style="--delay: ${index * 40}ms">
            <div class="problem-meta">
                <span>${numberText}</span>
                <span>${dateText}</span>
            </div>
            <div class="problem-title">${escapeHtml(problem.title)}</div>
            <div class="problem-tags">
                ${difficultyBadge}
                ${answerBadge}
                ${tagBadges}
            </div>
        </article>
    `;
}

function renderProblemDetail(problem) {
    document.body.classList.add('view-detail');
    const container = document.getElementById('problems-container');
    const pagination = document.getElementById('pagination');
    const toggleBtn = document.getElementById('toggle-editor');
    if (pagination) pagination.style.display = 'none';
    if (isEditorOpen()) closeEditorScreen();
    if (toggleBtn) toggleBtn.textContent = 'Add Markdown';

    const numberText = problem.number ? `#${problem.number}` : 'Unnumbered';
    const dateText = problem.date || 'No date';
    const difficultyBadge = createDifficultyBadge(problem.difficulty);
    const tagBadges = createTagBadges(problem.tags, 8);
    const permalink = `${window.location.origin}/?problem=${problem.slug}`;

    const split = splitMarkdownForPanels(problem.body || '');
    const problemHtml = markdownToHTML(split.problemMarkdown || '');
    const answerHtml = split.answerMarkdown ? markdownToHTML(split.answerMarkdown) : '<p>No answer section yet.</p>';

    container.innerHTML = `
        <div class="detail-view">
            <div class="detail-top-actions">
                <button class="btn ghost back-btn" type="button" onclick="goBack()">Back to list</button>
                <button class="btn ghost" type="button" id="edit-problem-btn">Edit Markdown</button>
            </div>
            <div class="detail-header">
                <div class="detail-meta">${numberText} | ${dateText}</div>
                <h1 class="detail-title">${escapeHtml(problem.title)}</h1>
                <div class="detail-badges">
                    ${difficultyBadge}
                    ${tagBadges}
                </div>
                <div class="detail-links">
                    ${problem.url ? `<a href="${problem.url}" target="_blank" rel="noopener">View on LeetCode</a>` : ''}
                    <span class="permalink-box">${permalink}</span>
                </div>
            </div>
            <div class="detail-layout">
                <section class="detail-panel">
                    <div class="panel-title">Problem</div>
                    <div class="detail-body">${problemHtml}</div>
                </section>
                <section class="detail-panel">
                    <div class="panel-title">Answer</div>
                    <div class="detail-body">${answerHtml}</div>
                </section>
            </div>
        </div>
    `;

    const editButton = document.getElementById('edit-problem-btn');
    if (editButton) {
        editButton.addEventListener('click', () => {
            openEditForSlug(problem.slug, problem.title);
        });
    }
}

function createDifficultyBadge(difficulty) {
    const badgeClass = `badge-${difficulty.toLowerCase()}`;
    return `<span class="badge ${badgeClass}">${difficulty}</span>`;
}

function createTagBadges(tags, maxTags) {
    if (!tags || tags.length === 0) return '';
    const shown = tags.slice(0, maxTags);
    let html = shown.map(tag => `<span class="badge badge-tag">${escapeHtml(tag)}</span>`).join('');
    if (tags.length > maxTags) {
        html += `<span class="badge badge-tag">+${tags.length - maxTags}</span>`;
    }
    return html;
}

function splitMarkdownForPanels(markdown) {
    const cleaned = stripLeadingTitle(markdown);
    const sections = splitH2Sections(cleaned);
    const problemIndex = sections.findIndex(section => section.title && /problem/i.test(section.title));

    if (problemIndex !== -1) {
        const hasPreface = sections[0] && !sections[0].title;
        const preface = hasPreface ? sections[0].content : '';
        const problemContent = sections[problemIndex].content || '';
        const problemMarkdown = [preface, problemContent].filter(Boolean).join('\n\n');
        const answerSections = sections.filter((section, index) => {
            if (index === problemIndex) return false;
            if (hasPreface && index === 0) return false;
            return true;
        });
        return {
            problemMarkdown,
            answerMarkdown: joinSections(answerSections)
        };
    }

    const answerStart = sections.findIndex(section => section.title && /(solution|approach|answer|analysis|complexity|notes)/i.test(section.title));
    if (answerStart !== -1) {
        return {
            problemMarkdown: joinSections(sections.slice(0, answerStart)),
            answerMarkdown: joinSections(sections.slice(answerStart))
        };
    }

    return { problemMarkdown: cleaned, answerMarkdown: '' };
}

function splitH2Sections(markdown) {
    const regex = /^##\s+(.+)$/gm;
    const sections = [];
    let lastIndex = 0;
    let lastTitle = null;
    let lastHeading = null;
    let match;

    while ((match = regex.exec(markdown)) !== null) {
        if (lastTitle !== null) {
            const content = markdown.slice(lastIndex, match.index).trim();
            sections.push({ title: lastTitle, heading: lastHeading, content });
        } else {
            const preface = markdown.slice(0, match.index).trim();
            if (preface) {
                sections.push({ title: null, heading: null, content: preface });
            }
        }
        lastTitle = match[1].trim();
        lastHeading = match[0];
        lastIndex = regex.lastIndex;
    }

    if (lastTitle !== null) {
        const content = markdown.slice(lastIndex).trim();
        sections.push({ title: lastTitle, heading: lastHeading, content });
    } else {
        const trimmed = markdown.trim();
        if (trimmed) sections.push({ title: null, heading: null, content: trimmed });
    }

    return sections;
}

function joinSections(sections) {
    return sections
        .filter(section => section && (section.content || section.heading))
        .map(section => {
            if (!section.title) return section.content || '';
            return `${section.heading}\n${section.content}`.trim();
        })
        .filter(Boolean)
        .join('\n\n');
}

function stripLeadingTitle(markdown) {
    const trimmed = markdown.trim();
    return trimmed.replace(/^#{1,2}\s+.+\n+/, '').trim();
}

function markdownToHTML(markdown) {
    if (!markdown) return '';
    let html = markdown.replace(/\r\n/g, '\n').trim();

    const codeBlocks = [];
    html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
        return placeholder;
    });

    html = convertTables(html);
    html = convertLists(html);
    html = html.replace(/^>\s?(.*)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/^---$/gm, '<hr>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(?!\s)([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    html = wrapParagraphs(html);

    codeBlocks.forEach((block, index) => {
        html = html.replace(`__CODE_BLOCK_${index}__`, block);
    });

    return html;
}

function convertLists(text) {
    const lines = text.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        if (/^\s*[-*]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*[-*]\s+/, '').trim());
                i++;
            }
            result.push(`<ul>${items.map(item => `<li>${item}</li>`).join('')}</ul>`);
            continue;
        }

        if (/^\s*\d+\.\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
                i++;
            }
            result.push(`<ol>${items.map(item => `<li>${item}</li>`).join('')}</ol>`);
            continue;
        }

        result.push(line);
        i++;
    }

    return result.join('\n');
}

function convertTables(text) {
    const lines = text.split('\n');
    const result = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const next = lines[i + 1];
        if (isTableHeader(line, next)) {
            const headerCells = splitTableRow(line);
            const rows = [];
            i += 2;
            while (i < lines.length && lines[i].includes('|')) {
                rows.push(splitTableRow(lines[i]));
                i++;
            }
            const headerHtml = headerCells.map(cell => `<th>${cell}</th>`).join('');
            const bodyHtml = rows
                .map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`)
                .join('');
            result.push(`<table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`);
            continue;
        }

        result.push(line);
        i++;
    }

    return result.join('\n');
}

function isTableHeader(line, separatorLine) {
    if (!line || !separatorLine) return false;
    if (!line.includes('|')) return false;
    if (!/^[\s|:-]+$/.test(separatorLine)) return false;
    return /-/.test(separatorLine);
}

function splitTableRow(line) {
    const rawCells = line.split('|');
    if (rawCells.length <= 1) return [];
    if (rawCells[0].trim() === '') rawCells.shift();
    if (rawCells[rawCells.length - 1].trim() === '') rawCells.pop();
    return rawCells.map(cell => cell.trim());
}

function wrapParagraphs(text) {
    const blocks = text.split(/\n{2,}/);
    return blocks.map(block => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        if (/^__CODE_BLOCK_\d+__$/.test(trimmed)) {
            return trimmed;
        }
        if (/^(<h\d|<ul|<ol|<pre|<table|<blockquote|<hr)/.test(trimmed)) {
            return trimmed;
        }
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
}

function changePage(delta) {
    currentPage += delta;
    renderProblems();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goBack() {
    window.history.pushState({}, '', '/');
    handleRouting();
}

function handleRouting() {
    const slug = getActiveSlug();
    if (slug) {
        const cached = allProblems.find(problem => problem.slug === slug);
        if (cached) {
            renderProblemDetail(cached);
        } else {
            loadProblem(slug);
        }
    } else {
        renderProblems();
    }
}

function getActiveSlug() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('problem');
}

function isEditorOpen() {
    const screen = document.getElementById('editor-screen');
    return screen ? screen.classList.contains('is-visible') : false;
}

function openAddEditor() {
    openEditorScreen({ mode: 'add' });
}

function openEditorScreen({ mode = 'add', markdown = '', filename = '', slug = null, title = '' } = {}) {
    const screen = document.getElementById('editor-screen');
    const modeLabel = document.getElementById('editor-mode-label');
    const subtitle = document.getElementById('editor-subtitle');
    const filenameInput = document.getElementById('editor-filename');
    const markdownEditor = document.getElementById('markdown-editor');
    const saveButton = document.getElementById('editor-save');

    editorState.mode = mode;
    editorState.slug = slug;
    editorState.title = title || '';

    if (modeLabel) {
        modeLabel.textContent = mode === 'edit' ? 'Edit Markdown' : 'Add Markdown';
    }
    if (subtitle) {
        subtitle.textContent = mode === 'edit'
            ? `Editing ${editorState.title || 'problem'}.`
            : 'Create a new problem entry.';
    }
    if (filenameInput) {
        filenameInput.value = filename || '';
        filenameInput.disabled = mode === 'edit';
    }
    if (markdownEditor) {
        markdownEditor.value = markdown || '';
    }
    if (saveButton) {
        saveButton.textContent = mode === 'edit' ? 'Update Markdown' : 'Save Markdown';
    }

    if (screen) {
        screen.classList.add('is-visible');
        screen.setAttribute('aria-hidden', 'false');
    }
    document.body.classList.add('editor-open');
    if (markdownEditor) {
        markdownEditor.focus();
    }
}

function closeEditorScreen() {
    const screen = document.getElementById('editor-screen');
    if (screen) {
        screen.classList.remove('is-visible');
        screen.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('editor-open');
    editorState.mode = 'add';
    editorState.slug = null;
    editorState.title = '';
}

function clearEditor() {
    const markdownEditor = document.getElementById('markdown-editor');
    const filenameInput = document.getElementById('editor-filename');
    if (markdownEditor) markdownEditor.value = '';
    if (filenameInput && !filenameInput.disabled) filenameInput.value = '';
}

async function openEditForSlug(slug, title = '') {
    if (!slug) return;
    showLoading(true);
    try {
        const data = await fetchProblemRaw(slug);
        openEditorScreen({
            mode: 'edit',
            markdown: data.markdown || '',
            filename: data.filename || '',
            slug: slug,
            title: title || data.title || ''
        });
    } catch (error) {
        console.error('Failed to load markdown:', error);
        showError(error.message || 'Failed to load markdown.');
    } finally {
        showLoading(false);
    }
}

async function handleEditorSave() {
    const markdownEditor = document.getElementById('markdown-editor');
    const filenameInput = document.getElementById('editor-filename');
    const rawMarkdown = markdownEditor ? markdownEditor.value.trim() : '';
    const filename = filenameInput ? filenameInput.value.trim() : '';

    if (!rawMarkdown) {
        showError('Markdown content is empty. Paste some content first.');
        return;
    }

    showLoading(true);

    const currentMode = editorState.mode;
    const currentSlug = editorState.slug;

    try {
        let result = null;
        if (currentMode === 'edit') {
            if (!currentSlug) throw new Error('Missing problem slug for update.');
            result = await updateMarkdown(currentSlug, rawMarkdown);
        } else {
            result = await saveMarkdown(rawMarkdown, filename || null);
        }

        showSuccess(currentMode === 'edit' ? 'Updated markdown.' : `Saved: ${result.title}`);
        closeEditorScreen();
        await fetchAllProblems();

        if (currentMode === 'edit') {
            const nextSlug = result && result.slug ? result.slug : currentSlug;
            if (nextSlug) {
                window.history.pushState({ slug: nextSlug }, '', `/?problem=${nextSlug}`);
                handleRouting();
            }
        }
    } catch (error) {
        console.error('Save failed:', error);
        showError(error.message || 'Failed to save markdown.');
    } finally {
        showLoading(false);
    }
}

async function fetchProblemRaw(slug) {
    const response = await fetch(`/api/problems/${slug}/raw`);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.detail || 'Failed to load markdown.');
    }
    return data;
}

async function saveMarkdown(markdown, filename) {
    const response = await fetch('/api/editor/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            markdown: markdown,
            filename: filename
        })
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.detail || 'Failed to save markdown.');
    }
    return result;
}

async function updateMarkdown(slug, markdown) {
    const response = await fetch('/api/editor/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            slug: slug,
            markdown: markdown
        })
    });

    const result = await response.json();
    if (!response.ok) {
        throw new Error(result.detail || 'Failed to update markdown.');
    }
    return result;
}

function showLoading(show) {
    document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showError(message) {
    const statusDiv = document.getElementById('status-message');
    statusDiv.className = 'status-message is-error';
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3000);
}

function showSuccess(message) {
    const statusDiv = document.getElementById('status-message');
    statusDiv.className = 'status-message is-success';
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';

    setTimeout(() => {
        statusDiv.style.display = 'none';
    }, 3500);
}

function isRecent(problem) {
    if (!problem.date) return false;
    const parsed = new Date(problem.date);
    if (Number.isNaN(parsed.getTime())) return false;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    return parsed >= cutoff;
}

function hasAnswer(problem) {
    const body = problem.body || '';
    return /^(##|###)\s+(solution|answer|approach|analysis|complexity|notes)/mi.test(body);
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}
