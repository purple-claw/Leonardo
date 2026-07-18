/* ═══════════════════════════════════════════════════════════════
   LEONARDO — Complete Application Logic
   State Management, Routing, API, Components
   ═══════════════════════════════════════════════════════════════ */

const API = '/api';

// ── State Store (Pub/Sub) ──────────────────────────────────────
const Store = {
  state: {
    user: null,
    token: localStorage.getItem('auth_token') || null,
    artifacts: [],
    categories: [],
    currentView: 'dashboard',
    selectedCategory: null,
    viewMode: 'grid',
    searchQuery: '',
    editingArtifact: null,
    cmdPaletteOpen: false,
  },
  listeners: [],

  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.listeners.forEach(fn => fn(this.state));
  },

  subscribe(fn) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }
};

// ── API Client ─────────────────────────────────────────────────
async function apiFetch(url, options = {}) {
  const headers = { ...options.headers };
  if (Store.state.token) {
    headers['Authorization'] = `Bearer ${Store.state.token}`;
  }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    Store.setState({ token: null, user: null });
    localStorage.removeItem('auth_token');
    showAuthScreen();
    throw new Error('Unauthorized');
  }

  return res;
}

// ── Toast Notifications ────────────────────────────────────────
function showToast(type, title, message = '') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
    warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || icons.info}</div>
    <div class="toast-content">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
    </div>
    <button class="toast-close">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));

  const dismiss = () => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  };

  toast.querySelector('.toast-close').onclick = dismiss;
  setTimeout(dismiss, 4000);
}

// ── Context Menu ───────────────────────────────────────────────
function showContextMenu(x, y, items) {
  const menu = document.getElementById('context-menu');
  menu.innerHTML = items.map(item => {
    if (item.separator) return '<div class="context-menu-separator"></div>';
    return `
      <button class="context-menu-item ${item.danger ? 'danger' : ''}" data-action="${item.action}">
        ${item.icon ? `<span class="context-menu-item-icon">${item.icon}</span>` : ''}
        ${escapeHtml(item.label)}
      </button>
    `;
  }).join('');

  menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
  menu.style.top = `${Math.min(y, window.innerHeight - 200)}px`;
  menu.classList.add('active');

  menu.querySelectorAll('.context-menu-item').forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.action;
      const item = items.find(i => i.action === action);
      if (item?.onClick) item.onClick();
      hideContextMenu();
    };
  });
}

function hideContextMenu() {
  document.getElementById('context-menu').classList.remove('active');
}

document.addEventListener('click', (e) => {
  // Ignore clicks originating from the user menu trigger so the
  // context menu can be toggled reliably without being immediately
  // dismissed by this global handler.
  if (e.target.closest('#user-menu-trigger')) return;
  if (!e.target.closest('.context-menu')) hideContextMenu();
});

// ── Command Palette ────────────────────────────────────────────
function openCmdPalette() {
  Store.setState({ cmdPaletteOpen: true });
  const palette = document.getElementById('cmd-palette');
  const input = document.getElementById('cmd-input');
  palette.classList.add('active');
  input.value = '';
  input.focus();
  renderCmdResults('');
}

function closeCmdPalette() {
  Store.setState({ cmdPaletteOpen: false });
  document.getElementById('cmd-palette').classList.remove('active');
}

function renderCmdResults(query) {
  const results = document.getElementById('cmd-results');
  const q = query.toLowerCase().trim();

  const commands = [
    { icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>', title: 'New Artifact', desc: 'Create a new artifact', action: () => openUploadModal() },
    { icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>', title: 'Go to Library', desc: 'View all artifacts', action: () => switchView('library') },
    { icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>', title: 'Go to Dashboard', desc: 'View workspace overview', action: () => switchView('dashboard') },
    { icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4h6v6H4z"/><path d="M14 4h6v6h-6z"/><path d="M4 14h6v6H4z"/><path d="M14 14h6v6h-6z"/></svg>', title: 'Manage Categories', desc: 'Organize your artifacts', action: () => openCategoryModal() },
    { icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>', title: 'Sign Out', desc: 'Log out of your account', action: () => logout() },
  ];

  const artifacts = Store.state.artifacts.filter(a =>
    !q || a.title.toLowerCase().includes(q) || (a.category || '').toLowerCase().includes(q)
  ).slice(0, 5);

  const filteredCmds = commands.filter(c => !q || c.title.toLowerCase().includes(q));

  let html = '';

  if (filteredCmds.length > 0) {
    html += '<div class="cmd-palette-section"><div class="cmd-palette-section-title">Commands</div>';
    html += filteredCmds.map((cmd, i) => `
      <div class="cmd-palette-item" data-cmd-idx="${i}">
        <div class="cmd-palette-item-icon">${cmd.icon}</div>
        <div class="cmd-palette-item-content">
          <div class="cmd-palette-item-title">${escapeHtml(cmd.title)}</div>
          <div class="cmd-palette-item-desc">${escapeHtml(cmd.desc)}</div>
        </div>
      </div>
    `).join('');
    html += '</div>';
  }

  if (artifacts.length > 0) {
    const typeIcons = {
      jsx: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
      html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
      md: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
    };
    html += '<div class="cmd-palette-section"><div class="cmd-palette-section-title">Artifacts</div>';
    html += artifacts.map(art => `
      <div class="cmd-palette-item" data-art-id="${art.id}">
        <div class="cmd-palette-item-icon">${typeIcons[art.type] || typeIcons.html}</div>
        <div class="cmd-palette-item-content">
          <div class="cmd-palette-item-title">${escapeHtml(art.title)}</div>
          <div class="cmd-palette-item-desc">${escapeHtml(art.category || 'Uncategorized')}</div>
        </div>
        <kbd class="cmd-palette-item-shortcut">${art.type.toUpperCase()}</kbd>
      </div>
    `).join('');
    html += '</div>';
  }

  if (!html) {
    html = '<div style="padding: 32px; text-align: center; color: var(--text-muted);">No results found</div>';
  }

  results.innerHTML = html;

  results.querySelectorAll('[data-cmd-idx]').forEach(el => {
    el.onclick = () => {
      filteredCmds[parseInt(el.dataset.cmdIdx)].action();
      closeCmdPalette();
    };
  });

  results.querySelectorAll('[data-art-id]').forEach(el => {
    el.onclick = () => {
      window.open(`/viewer/${el.dataset.artId}`, '_blank');
      closeCmdPalette();
    };
  });
}

// ── View Routing ───────────────────────────────────────────────
function switchView(view) {
  Store.setState({ currentView: view });

  document.querySelectorAll('.workspace-content').forEach(el => el.style.display = 'none');
  const target = document.getElementById(`view-${view}`);
  if (target) target.style.display = '';

  document.querySelectorAll('.sidebar-item[data-view]').forEach(el => {
    el.classList.toggle('active', el.dataset.view === view);
  });

  const titles = { dashboard: 'Dashboard', library: 'Library', editor: 'Editor' };
  document.getElementById('breadcrumb-current').textContent = titles[view] || view;
}

// ── Admin UI ───────────────────────────────────────────────────
function updateAdminUI() {
  const isAdmin = Store.state.user?.role === 'admin';
  document.querySelectorAll('[data-admin]').forEach(el => {
    el.style.display = isAdmin ? '' : 'none';
  });
}

// ── Auth ───────────────────────────────────────────────────────
function showAuthScreen() {
  document.getElementById('auth-screen').style.display = 'flex';
  document.getElementById('app-shell').style.display = 'none';
}

function showAppShell() {
  document.getElementById('auth-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'grid';
  updateAdminUI();
}

async function checkAuth() {
  if (!Store.state.token) {
    showAuthScreen();
    return;
  }

  try {
    const res = await apiFetch(`${API}/auth/me`);
    if (res.ok) {
      const data = await res.json();
      Store.setState({ user: data.user });
      showAppShell();
      await loadData();
    } else {
      showAuthScreen();
    }
  } catch {
    showAuthScreen();
  }
}

async function login(username, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');

  Store.setState({ token: data.token, user: data.user });
  localStorage.setItem('auth_token', data.token);
  showAppShell();
  await loadData();
  showToast('success', 'Welcome back!', `Signed in as ${data.user.username}`);
}

async function register(username, password) {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Registration failed');

  Store.setState({ token: data.token, user: data.user });
  localStorage.setItem('auth_token', data.token);
  showAppShell();
  await loadData();
  showToast('success', 'Account created!', `Welcome to Leonardo, ${data.user.username}`);
}

function logout() {
  Store.setState({ token: null, user: null });
  localStorage.removeItem('auth_token');
  showAuthScreen();
  showToast('info', 'Signed out', 'See you next time!');
}

// ── Data Loading ───────────────────────────────────────────────
async function loadData() {
  try {
    const [artRes, catRes] = await Promise.all([
      apiFetch(`${API}/artifacts`),
      apiFetch(`${API}/artifacts/categories`)
    ]);

    if (artRes.ok) {
      Store.setState({ artifacts: await artRes.json() });
    }
    if (catRes.ok) {
      Store.setState({ categories: await catRes.json() });
    }
  } catch (err) {
    showToast('error', 'Failed to load data', err.message);
  }
}

// ── CRUD Operations ────────────────────────────────────────────
async function createArtifact(data) {
  const res = await apiFetch(`${API}/artifacts`, {
    method: 'POST',
    body: JSON.stringify(data)
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create');
  }

  await loadData();
  showToast('success', 'Artifact created', data.title);
  return res.json();
}

async function uploadArtifact(file, metadata) {
  const content = await file.text();
  const res = await apiFetch(`${API}/artifacts/upload`, {
    method: 'POST',
    body: JSON.stringify({
      filename: file.name,
      content,
      ...metadata
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Upload failed');
  }

  await loadData();
  showToast('success', 'File uploaded', file.name);
  return res.json();
}

async function deleteArtifact(id) {
  const res = await apiFetch(`${API}/artifacts/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Delete failed');
  await loadData();
  showToast('success', 'Artifact deleted');
}

async function addCategory(name) {
  const res = await apiFetch(`${API}/artifacts/categories`, {
    method: 'POST',
    body: JSON.stringify({ name })
  });
  if (!res.ok) throw new Error('Failed to create category');
  await loadData();
  showToast('success', 'Category added', name);
}

async function deleteCategory(name) {
  const res = await apiFetch(`${API}/artifacts/category/${encodeURIComponent(name)}`, {
    method: 'DELETE'
  });
  if (!res.ok) throw new Error('Failed to delete category');
  await loadData();
  showToast('success', 'Category removed', name);
}

// ── Modal Management ───────────────────────────────────────────
function openUploadModal(tab = 'paste') {
  document.getElementById('upload-modal').classList.add('active');
  switchUploadTab(tab);
}

function closeUploadModal() {
  document.getElementById('upload-modal').classList.remove('active');
  document.getElementById('paste-title').value = '';
  document.getElementById('paste-content').value = '';
  document.getElementById('paste-category').value = '';
  document.getElementById('paste-tags').value = '';
  document.getElementById('file-info').style.display = 'none';
  selectedFile = null;
}

function switchUploadTab(tab) {
  document.querySelectorAll('#upload-modal .tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.getElementById('tab-paste').style.display = tab === 'paste' ? '' : 'none';
  document.getElementById('tab-upload').style.display = tab === 'upload' ? '' : 'none';
}

function openCategoryModal() {
  document.getElementById('category-modal').classList.add('active');
  renderCategoryList();
}

function closeCategoryModal() {
  document.getElementById('category-modal').classList.remove('active');
}

function openProfileModal() {
  document.getElementById('profile-modal').classList.add('active');
  renderProfileModal();
}

function closeProfileModal() {
  document.getElementById('profile-modal').classList.remove('active');
}

function renderProfileModal() {
  const user = Store.state.user;
  if (!user) return;

  document.getElementById('profile-username').value = user.username || '';
  document.getElementById('profile-email').value = user.email || '';
  document.getElementById('profile-avatar').textContent = user.username ? user.username[0].toUpperCase() : 'U';
}

async function saveProfile() {
  const username = document.getElementById('profile-username').value.trim();
  const email = document.getElementById('profile-email').value.trim();
  const currentPassword = document.getElementById('profile-current-password').value;
  const newPassword = document.getElementById('profile-new-password').value;
  const confirmPassword = document.getElementById('profile-confirm-password').value;

  if (!username) {
    showToast('error', 'Invalid input', 'Username is required');
    return;
  }

  if (newPassword && newPassword !== confirmPassword) {
    showToast('error', 'Passwords do not match', 'Please confirm your new password');
    return;
  }

  try {
    const body = { username, email };
    if (currentPassword && newPassword) {
      body.currentPassword = currentPassword;
      body.newPassword = newPassword;
    }

    const res = await apiFetch(`${API}/auth/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Failed to update profile');
    }

    const data = await res.json();
    Store.setState({ user: data.user });
    showToast('success', 'Profile updated', 'Your profile has been saved');
    closeProfileModal();
  } catch (err) {
    showToast('error', 'Update failed', err.message);
  }
}

function renderCategoryList() {
  const list = document.getElementById('category-list');
  const cats = Store.state.categories;

  if (cats.length === 0) {
    list.innerHTML = '<div class="empty-state" style="padding: 32px;"><p class="text-muted">No categories yet. Add one above.</p></div>';
    return;
  }

  list.innerHTML = cats.map(cat => `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-3); background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); margin-bottom: var(--space-2);">
      <div>
        <div style="font-weight: 500;">${escapeHtml(cat.name)}</div>
        <div class="text-xs text-muted">${cat.count} artifact${cat.count !== 1 ? 's' : ''}</div>
      </div>
      <button class="btn btn-ghost btn-sm" style="color: var(--error);" onclick="handleDeleteCategory('${escapeHtml(cat.name)}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        </svg>
      </button>
    </div>
  `).join('');
}

window.handleDeleteCategory = async (name) => {
  if (confirm(`Remove category "${name}" from all artifacts?`)) {
    try {
      await deleteCategory(name);
      renderCategoryList();
    } catch (err) {
      showToast('error', 'Delete failed', err.message);
    }
  }
};

// ── Render Functions ───────────────────────────────────────────
function renderDashboard() {
  const { artifacts, categories } = Store.state;

  const totalWords = artifacts.reduce((sum, a) => sum + (a.wordCount || 0), 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = artifacts.filter(a => new Date(a.createdAt) > weekAgo).length;

  document.getElementById('stat-total').textContent = artifacts.length;
  document.getElementById('stat-words').textContent = totalWords.toLocaleString();
  document.getElementById('stat-categories').textContent = categories.length;
  document.getElementById('stat-week').textContent = thisWeek;
  document.getElementById('artifact-count').textContent = artifacts.length;

  const recent = [...artifacts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);
  const recentList = document.getElementById('recent-list');

  if (recent.length === 0) {
    recentList.innerHTML = '<div class="empty-state" style="padding: 16px;"><div class="empty-state-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></div><p class="empty-state-title">No artifacts yet</p><p class="empty-state-desc">Create your first artifact to get started.</p></div>';
    return;
  }

  const typeIcons = {
    jsx: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FBBF24" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    html: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>',
    md: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>'
  };

  recentList.innerHTML = recent.map(art => `
    <div class="recent-item" onclick="window.open('/viewer/${art.id}', '_blank')">
      <div class="recent-item-icon">${typeIcons[art.type] || typeIcons.html}</div>
      <div class="recent-item-content">
        <div class="recent-item-title">${escapeHtml(art.title)}</div>
        <div class="recent-item-meta">${escapeHtml(art.category || 'Uncategorized')} ${formatDate(art.createdAt)}</div>
      </div>
      <span class="artifact-type-badge type-${art.type}">${art.type.toUpperCase()}</span>
    </div>
  `).join('');
}

function renderSidebarCategories() {
  const container = document.getElementById('sidebar-categories');
  const { categories, selectedCategory } = Store.state;

  if (!container) return;

  container.innerHTML = categories.map(cat => `
    <button class="sidebar-item ${selectedCategory === cat.name ? 'active' : ''}" data-category="${escapeHtml(cat.name)}">
      <span style="width: 8px; height: 8px; border-radius: 50%; background: var(--crimson);"></span>
      ${escapeHtml(cat.name)}
      <span class="sidebar-item-badge">${cat.count}</span>
    </button>
  `).join('');

  container.querySelectorAll('[data-category]').forEach(btn => {
    btn.onclick = () => {
      Store.setState({ selectedCategory: btn.dataset.category, currentView: 'library' });
      switchView('library');
    };
  });
}

function renderFilterBar() {
  const bar = document.getElementById('filter-bar');
  const { categories, selectedCategory, artifacts } = Store.state;

  if (!bar) return;

  const allCount = artifacts.length;
  let html = `<button class="filter-chip ${!selectedCategory ? 'active' : ''}" data-cat="">All <span class="filter-chip-count">${allCount}</span></button>`;

  html += categories.map(cat => `
    <button class="filter-chip ${selectedCategory === cat.name ? 'active' : ''}" data-cat="${escapeHtml(cat.name)}">
      ${escapeHtml(cat.name)} <span class="filter-chip-count">${cat.count}</span>
    </button>
  `).join('');

  bar.innerHTML = html;

  bar.querySelectorAll('[data-cat]').forEach(btn => {
    btn.onclick = () => {
      Store.setState({ selectedCategory: btn.dataset.cat || null });
    };
  });
}

function renderLibrary() {
  const { artifacts, selectedCategory, viewMode, searchQuery, user } = Store.state;
  const container = document.getElementById('library-content');

  if (!container) return;

  let filtered = artifacts;
  if (selectedCategory) {
    filtered = filtered.filter(a => a.category === selectedCategory);
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(a =>
      a.title.toLowerCase().includes(q) ||
      (a.category || '').toLowerCase().includes(q) ||
      (a.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div>
        <p class="empty-state-title">No artifacts found</p>
        <p class="empty-state-desc">${selectedCategory ? 'Try a different category or ' : ''}Create a new artifact to get started.</p>
        <button class="btn btn-primary mt-4" onclick="openUploadModal()">Create Artifact</button>
      </div>
    `;
    return;
  }

  if (viewMode === 'grid') {
    container.innerHTML = `<div class="artifact-grid">${filtered.map(renderArtifactCard).join('')}</div>`;
  } else {
    container.innerHTML = `
      <div class="artifact-list">
        <div class="artifact-list-header">
          <span>Title</span><span>Category</span><span>Type</span><span>Words</span><span>Date</span>
        </div>
        ${filtered.map(renderArtifactRow).join('')}
      </div>
    `;
  }

  const isAdmin = user?.role === 'admin';

  container.querySelectorAll('[data-artifact-id]').forEach(el => {
    const id = el.dataset.artifactId;
    const art = artifacts.find(a => a.id === id);

    el.onclick = (e) => {
      if (e.target.closest('.artifact-card-menu')) return;
      window.open(`/viewer/${id}`, '_blank');
    };

    el.oncontextmenu = (e) => {
      e.preventDefault();
      const menuItems = [
        { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>', label: 'Open in new tab', action: 'open', onClick: () => window.open(`/viewer/${id}`, '_blank') },
        { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>', label: 'Copy link', action: 'copy', onClick: () => {
          navigator.clipboard.writeText(`${location.origin}/viewer/${id}`);
          showToast('success', 'Link copied');
        }},
      ];
      if (isAdmin) {
        menuItems.push({ separator: true });
        menuItems.push({ icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>', label: 'Delete', action: 'delete', danger: true, onClick: async () => {
          if (confirm(`Delete "${art.title}"?`)) {
            try { await deleteArtifact(id); } catch (err) { showToast('error', 'Delete failed', err.message); }
          }
        }});
      }
      showContextMenu(e.clientX, e.clientY, menuItems);
    };
  });
}

function renderArtifactCard(art) {
  const tags = (art.tags || []).slice(0, 3).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('');
  const desc = art.desc || stripHtml(art.content || '').slice(0, 100);

  return `
    <div class="artifact-card" data-artifact-id="${art.id}">
      <div class="artifact-card-header">
        <span class="artifact-type-badge type-${art.type}">${art.type.toUpperCase()}</span>
        <button class="btn-icon btn-ghost artifact-card-menu">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>
          </svg>
        </button>
      </div>
      <h3 class="artifact-card-title">${escapeHtml(art.title)}</h3>
      <p class="artifact-card-desc">${escapeHtml(desc)}${desc.length >= 100 ? '...' : ''}</p>
      <div class="artifact-card-meta">
        <span class="artifact-card-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/></svg>
          ${art.wordCount || 0} words
        </span>
        <span class="artifact-card-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          ${art.readTimeMin || 1} min
        </span>
        <span class="artifact-card-meta-item">${formatDate(art.createdAt)}</span>
      </div>
      ${tags ? `<div class="artifact-card-tags">${tags}</div>` : ''}
    </div>
  `;
}

function renderArtifactRow(art) {
  return `
    <div class="artifact-list-row" data-artifact-id="${art.id}">
      <div class="artifact-list-title">
        <span class="artifact-type-badge type-${art.type}" style="font-size: 9px;">${art.type.toUpperCase()}</span>
        ${escapeHtml(art.title)}
      </div>
      <span class="artifact-list-category">${escapeHtml(art.category || '')}</span>
      <span class="artifact-type-badge type-${art.type}">${art.type.toUpperCase()}</span>
      <span class="text-muted">${art.wordCount || 0}</span>
      <span class="artifact-list-date">${formatDate(art.createdAt)}</span>
    </div>
  `;
}

// ── File Upload ────────────────────────────────────────────────
let selectedFile = null;

function initDropZone() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  if (!dropZone || !fileInput) return;

  dropZone.onclick = () => fileInput.click();

  dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('dragover'); };
  dropZone.ondragleave = () => dropZone.classList.remove('dragover');
  dropZone.ondrop = (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length) selectFile(e.dataTransfer.files[0]);
  };

  fileInput.onchange = () => {
    if (fileInput.files.length) selectFile(fileInput.files[0]);
  };
}

function selectFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const allowed = ['html', 'htm', 'jsx', 'tsx', 'md'];

  if (!allowed.includes(ext)) {
    showToast('error', 'Invalid file type', 'Only .html, .jsx, .tsx, .md are supported');
    return;
  }

  selectedFile = file;
  document.getElementById('file-info').style.display = '';
  document.getElementById('file-name').textContent = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;

  if (!document.getElementById('upload-title').value) {
    document.getElementById('upload-title').value = file.name.replace(/\.[^.]+$/, '');
  }
}

// ── Utilities ──────────────────────────────────────────────────
function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || '';
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── Initialize ─────────────────────────────────────────────────
function init() {
  let authMode = 'login';
  const authForm = document.getElementById('auth-form');
  const authTitle = document.getElementById('auth-title');
  const authSubtitle = document.getElementById('auth-subtitle');
  const authSubmit = document.getElementById('auth-submit');
  const authSwitchLink = document.getElementById('auth-switch-link');

  function updateAuthUIMode() {
    if (authMode === 'login') {
      authTitle.textContent = 'Welcome back';
      authSubtitle.textContent = 'Sign in to your workspace';
      authSubmit.textContent = 'Sign in';
      document.getElementById('auth-switch-text').innerHTML = `Don't have an account? <a href="#" id="auth-switch-link">Create one</a>`;
    } else {
      authTitle.textContent = 'Create account';
      authSubtitle.textContent = 'Get started with Leonardo';
      authSubmit.textContent = 'Create account';
      document.getElementById('auth-switch-text').innerHTML = `Already have an account? <a href="#" id="auth-switch-link">Sign in</a>`;
    }
    document.getElementById('auth-switch-link').onclick = (e) => {
      e.preventDefault();
      authMode = authMode === 'login' ? 'register' : 'login';
      updateAuthUIMode();
    };
  }

  authForm.onsubmit = async (e) => {
    e.preventDefault();
    const username = document.getElementById('auth-username').value.trim();
    const password = document.getElementById('auth-password').value;

    if (!username || !password) return;

    authSubmit.disabled = true;
    authSubmit.textContent = authMode === 'login' ? 'Signing in...' : 'Creating...';

    try {
      if (authMode === 'login') {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err) {
      showToast('error', authMode === 'login' ? 'Login failed' : 'Registration failed', err.message);
    } finally {
      authSubmit.disabled = false;
      updateAuthUIMode();
    }
  };

  updateAuthUIMode();

  // Navigation
  document.querySelectorAll('[data-view]').forEach(btn => {
    btn.onclick = () => switchView(btn.dataset.view);
  });

  // Sidebar collapse/expand (topbar hamburger + sidebar header button)
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');

  function toggleSidebar() {
    // If on mobile/tablet, toggle overlay "open" state instead of collapsed
    const isMobile = window.innerWidth <= 900;
    if (isMobile) {
      const isOpen = sidebar.classList.toggle('open');
      sidebarToggle.title = isOpen ? 'Close sidebar' : 'Open sidebar';
      sidebarToggleBtn.title = sidebarToggle.title;
      // prevent body scroll when open
      document.body.style.overflow = isOpen ? 'hidden' : '';
      return;
    }

    const isCollapsed = sidebar.classList.toggle('collapsed');
    const label = isCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
    sidebarToggle.title = label;
    sidebarToggleBtn.title = label;
    sidebarToggleBtn.innerHTML = isCollapsed
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>`;
    const w = isCollapsed ? 64 : 240;
    const workspace = document.querySelector('.workspace');
    const topbar = document.querySelector('.topbar');
    if (workspace) workspace.style.marginLeft = w + 'px';
    if (topbar) topbar.style.left = w + 'px';
  }

  sidebarToggle.onclick = toggleSidebar;
  sidebarToggleBtn.onclick = toggleSidebar;

  // Backwards-compat mobile fix: if an older handler toggles `collapsed`,
  // normalize behavior so mobile always uses `open` overlay.
  const normalizeMobileSidebar = (e) => {
    if (window.innerWidth > 900) return;
    const s = document.getElementById('sidebar');
    // If old handler left `collapsed`, switch to `open` overlay
    if (s.classList.contains('collapsed') && !s.classList.contains('open')) {
      s.classList.remove('collapsed');
      s.classList.add('open');
      document.body.style.overflow = 'hidden';
      return;
    }
    // Otherwise toggle open normally
    const isOpen = s.classList.toggle('open');
    document.body.style.overflow = isOpen ? 'hidden' : '';
  };

  sidebarToggle.addEventListener('click', normalizeMobileSidebar);
  sidebarToggleBtn.addEventListener('click', normalizeMobileSidebar);

  // Close mobile sidebar when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth > 900) return;
    const open = sidebar.classList.contains('open');
    if (!open) return;
    if (!e.target.closest('#sidebar') && !e.target.closest('#sidebar-toggle')) {
      sidebar.classList.remove('open');
      document.body.style.overflow = '';
    }
  });

  // Profile — user avatar in topbar opens profile modal or dropdown
  document.getElementById('user-menu-trigger').onclick = (e) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    showContextMenu(rect.left, rect.bottom + 8, [
      { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', label: 'Profile', action: 'profile', onClick: openProfileModal },
      { separator: true },
      { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>', label: 'Sign out', action: 'logout', onClick: logout }
    ]);
  };

  // Command palette
  document.getElementById('cmd-trigger').onclick = openCmdPalette;
  document.getElementById('cmd-input').oninput = (e) => renderCmdResults(e.target.value);

  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      Store.state.cmdPaletteOpen ? closeCmdPalette() : openCmdPalette();
    }
    if (e.key === 'Escape') {
      if (Store.state.cmdPaletteOpen) closeCmdPalette();
      closeUploadModal();
      closeCategoryModal();
    }
  });

  // New artifact buttons
  document.getElementById('new-artifact-btn').onclick = () => openUploadModal();
  document.getElementById('dashboard-new-btn').onclick = () => openUploadModal();
  document.getElementById('library-new-btn').onclick = () => openUploadModal();
  document.getElementById('quick-upload-btn').onclick = () => openUploadModal('upload');
  document.getElementById('quick-paste-btn').onclick = () => openUploadModal('paste');
  const bottomNavNew = document.getElementById('bottom-nav-new');
  if (bottomNavNew) bottomNavNew.onclick = () => openUploadModal();

  // Upload modal
  document.getElementById('upload-modal-close').onclick = closeUploadModal;
  document.getElementById('upload-cancel').onclick = closeUploadModal;

  document.querySelectorAll('#upload-modal .tab').forEach(tab => {
    tab.onclick = () => switchUploadTab(tab.dataset.tab);
  });

  document.getElementById('upload-submit').onclick = async () => {
    const activeTab = document.querySelector('#upload-modal .tab.active')?.dataset.tab;

    try {
      if (activeTab === 'paste') {
        const title = document.getElementById('paste-title').value.trim();
        const content = document.getElementById('paste-content').value.trim();
        const type = document.getElementById('paste-type').value;

        if (!title || !content) {
          showToast('error', 'Missing fields', 'Title and content are required');
          return;
        }

        await createArtifact({
          title,
          type,
          content,
          category: document.getElementById('paste-category').value.trim(),
          tags: document.getElementById('paste-tags').value.split(',').map(t => t.trim()).filter(Boolean)
        });
      } else {
        if (!selectedFile) {
          showToast('error', 'No file selected', 'Please select a file to upload');
          return;
        }

        await uploadArtifact(selectedFile, {
          title: document.getElementById('upload-title').value.trim(),
          category: document.getElementById('upload-category').value.trim(),
          tags: document.getElementById('upload-tags').value
        });
      }

      closeUploadModal();
    } catch (err) {
      showToast('error', 'Creation failed', err.message);
    }
  };

  // Category modal
  document.getElementById('manage-categories-btn').onclick = openCategoryModal;
  document.getElementById('category-modal-close').onclick = closeCategoryModal;

  // Profile modal
  document.getElementById('profile-modal-close').onclick = closeProfileModal;
  document.getElementById('profile-cancel').onclick = closeProfileModal;
  document.getElementById('profile-save').onclick = saveProfile;
  document.getElementById('profile-logout').onclick = logout;

  document.getElementById('add-category-btn').onclick = async () => {
    const input = document.getElementById('new-category-input');
    const name = input.value.trim().toLowerCase().replace(/\s+/g, '-');

    if (!name) return;
    if (Store.state.categories.some(c => c.name === name)) {
      showToast('error', 'Category exists', `"${name}" already exists`);
      return;
    }

    try {
      await addCategory(name);
      input.value = '';
      renderCategoryList();
    } catch (err) {
      showToast('error', 'Failed to add category', err.message);
    }
  };

  // View mode toggle
  document.querySelectorAll('[data-view-mode]').forEach(btn => {
    btn.onclick = () => {
      Store.setState({ viewMode: btn.dataset.viewMode });
      document.querySelectorAll('[data-view-mode]').forEach(b => b.classList.toggle('active', b === btn));
    };
  });

  // User menu
  document.getElementById('user-menu-trigger').onclick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    showContextMenu(rect.left, rect.bottom + 8, [
      { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', label: Store.state.user?.username || 'User', action: 'user' },
      { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', label: 'Profile', action: 'profile', onClick: openProfileModal },
      { separator: true },
      { icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>', label: 'Sign out', action: 'logout', onClick: logout }
    ]);
  };

  // Drop zone
  initDropZone();

  // State subscriptions
  Store.subscribe((state) => {
    renderDashboard();
    renderSidebarCategories();
    renderFilterBar();
    renderLibrary();
    updateAdminUI();

    if (state.user) {
      document.getElementById('user-name').textContent = state.user.username;
      document.getElementById('user-avatar').textContent = state.user.username[0].toUpperCase();
    }

    // Init mouse-tracking glow on stat cards after render
    initStatCardGlow();
  });

  // Mouse-tracking glow effect for glass cards
  function initStatCardGlow() {
    document.querySelectorAll('.stat-card, .dashboard-section, .artifact-card').forEach(card => {
      if (card.dataset.glowInit) return;
      card.dataset.glowInit = 'true';
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty('--mouse-x', `${x}%`);
        card.style.setProperty('--mouse-y', `${y}%`);
      });
    });
  }

  // Subtle tilt effect on artifact cards for liquid depth
  function initCardTilt() {
    document.querySelectorAll('.artifact-card').forEach(card => {
      if (card.dataset.tiltInit) return;
      card.dataset.tiltInit = 'true';
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width;
        const y = (e.clientY - rect.top) / rect.height;
        const tiltX = (y - 0.5) * 6;
        const tiltY = (x - 0.5) * -6;
        card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px) scale(1.01)`;
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
      });
    });
  }

  // Call tilt init after library render
  const origRenderLibrary = renderLibrary;
  renderLibrary = function() {
    origRenderLibrary.apply(this, arguments);
    setTimeout(initCardTilt, 50);
  };

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.onclick = (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    };
  });

  // Click outside command palette
  document.getElementById('cmd-palette').onclick = (e) => {
    if (e.target.id === 'cmd-palette') closeCmdPalette();
  };

  // Check auth and start
  checkAuth();
}

document.addEventListener('DOMContentLoaded', init);
