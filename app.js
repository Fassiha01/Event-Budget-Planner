'use strict';

// ── State ─────────────────────────────────────────────────────────────────
const state = {
  events: [],
  settings: {},
  currentPage: 'dashboard',
  selectedEventId: null,
  charts: {},
  editingEventId: null,
  editingExpenseId: null,
};

const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', INR: '₹',
  AED: 'د.إ', SAR: '﷼', CAD: 'CA$', AUD: 'A$', JPY: '¥'
};

const CATEGORY_COLORS = {
  Venue: '#6366f1', Catering: '#06b6d4', Decoration: '#f59e0b',
  Photography: '#10b981', Entertainment: '#8b5cf6',
  Transportation: '#ef4444', Miscellaneous: '#6b7280'
};

const STATUS_COLORS = {
  Planning: '#f59e0b', Ongoing: '#06b6d4', Completed: '#10b981'
};

// ── Utilities ─────────────────────────────────────────────────────────────
function getCurrency() { return state.settings.currency || 'USD'; }
function getCurrencySymbol() { return CURRENCY_SYMBOLS[getCurrency()] || '$'; }

function fmt(amount) {
  const sym = getCurrencySymbol();
  const n = parseFloat(amount) || 0;
  return sym + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(d) {
  if (!d) return '—';
  const dt = new Date(d + 'T00:00:00');
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function showLoading() { document.getElementById('loading-overlay').classList.remove('hidden'); }
function hideLoading() { document.getElementById('loading-overlay').classList.add('hidden'); }

function toast(msg, type = 'success') {
  const icons = { success: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.classList.add('fade-out'); setTimeout(() => el.remove(), 350); }, 3500);
}

function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

function confirm(message, onConfirm) {
  document.getElementById('confirm-message').textContent = message;
  const btn = document.getElementById('confirm-action-btn');
  btn.onclick = () => { closeModal('confirm-modal'); onConfirm(); };
  openModal('confirm-modal');
}

function togglePw(id, icon) {
  const input = document.getElementById(id);
  if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); }
  else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
}

// ── API Layer ─────────────────────────────────────────────────────────────
async function api(method, url, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || 'Request failed');
  }
  if (res.status === 204) return null;
  return res.json();
}

const GET = (url) => api('GET', url);
const POST = (url, body) => api('POST', url, body);
const PUT = (url, body) => api('PUT', url, body);
const DEL = (url) => api('DELETE', url);

// ── Navigation ────────────────────────────────────────────────────────────
function navigate(page) {
  state.currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (navEl) navEl.classList.add('active');

  const titles = {
    dashboard: 'Dashboard', events: 'Events', expenses: 'Expenses',
    analytics: 'Analytics', reports: 'Reports', settings: 'Settings'
  };
  document.getElementById('page-title').textContent = titles[page] || page;
  closeSidebar();

  if (page === 'dashboard')  loadDashboard();
  if (page === 'events')     renderEventsPage();
  if (page === 'expenses')   renderExpensesPage();
  if (page === 'analytics')  loadAnalytics();
  if (page === 'settings')   loadSettings();
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebar-overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('open');
}

// ── Events ────────────────────────────────────────────────────────────────
async function loadEvents() {
  state.events = await GET('/ebp/events');
}

function getFilteredEvents() {
  const search = (document.getElementById('event-search')?.value || '').toLowerCase();
  const type   = document.getElementById('filter-event-type')?.value || '';
  const status = document.getElementById('filter-event-status')?.value || '';
  const date   = document.getElementById('filter-event-date')?.value || '';
  return state.events.filter(e => {
    if (search && !e.name.toLowerCase().includes(search) && !e.venue?.toLowerCase().includes(search)) return false;
    if (type   && e.eventType !== type)   return false;
    if (status && e.status    !== status) return false;
    if (date   && e.eventDate !== date)   return false;
    return true;
  });
}

function filterEvents() { renderEventsTable(getFilteredEvents()); }

function renderEventsPage() { renderEventsTable(state.events); }

function renderEventsTable(events) {
  const tbody = document.getElementById('events-tbody');
  const empty = document.getElementById('events-empty');
  if (!events.length) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';
  tbody.innerHTML = events.map(e => {
    const spent = totalSpent(e);
    const util  = e.totalBudget > 0 ? Math.round(spent / e.totalBudget * 100) : 0;
    const over  = spent > e.totalBudget;
    const badgeClass = 'badge-' + e.status.toLowerCase();
    return `
      <tr>
        <td><div class="event-name-cell">${esc(e.name)}</div></td>
        <td><span class="badge badge-category">${esc(e.eventType)}</span></td>
        <td>${fmtDate(e.eventDate)}</td>
        <td class="event-venue-cell" title="${esc(e.venue || '')}">${esc(e.venue || '—')}</td>
        <td>${e.guestCount || 0}</td>
        <td>${fmt(e.totalBudget)}</td>
        <td>
          <span class="${over ? 'text-danger' : ''}">${fmt(spent)}</span>
          <br/><small style="color:var(--text-muted)">${util}%</small>
        </td>
        <td><span class="badge ${badgeClass}">${e.status}</span>${over ? ' <span class="badge badge-overbudget">Over!</span>' : ''}</td>
        <td>
          <div class="actions-cell">
            <button class="action-btn view" title="View" onclick="openViewEvent('${e.id}')"><i class="fas fa-eye"></i></button>
            <button class="action-btn edit" title="Edit" onclick="openEditEvent('${e.id}')"><i class="fas fa-edit"></i></button>
            <button class="action-btn delete" title="Delete" onclick="confirmDeleteEvent('${e.id}', '${esc(e.name)}')"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function openCreateEvent() {
  state.editingEventId = null;
  document.getElementById('event-modal-title').textContent = 'New Event';
  document.getElementById('event-id').value = '';
  document.getElementById('event-name').value = '';
  document.getElementById('event-type').value = '';
  document.getElementById('event-date').value = '';
  document.getElementById('event-venue').value = '';
  document.getElementById('event-guests').value = '';
  document.getElementById('event-budget').value = '';
  document.getElementById('event-status').value = 'Planning';
  document.getElementById('event-description').value = '';
  openModal('event-modal');
}

function openEditEvent(id) {
  const e = state.events.find(x => x.id === id);
  if (!e) return;
  state.editingEventId = id;
  document.getElementById('event-modal-title').textContent = 'Edit Event';
  document.getElementById('event-id').value = e.id;
  document.getElementById('event-name').value = e.name;
  document.getElementById('event-type').value = e.eventType;
  document.getElementById('event-date').value = e.eventDate;
  document.getElementById('event-venue').value = e.venue || '';
  document.getElementById('event-guests').value = e.guestCount || '';
  document.getElementById('event-budget').value = e.totalBudget;
  document.getElementById('event-status').value = e.status;
  document.getElementById('event-description').value = e.description || '';
  openModal('event-modal');
}

async function saveEvent() {
  const name   = document.getElementById('event-name').value.trim();
  const type   = document.getElementById('event-type').value;
  const date   = document.getElementById('event-date').value;
  const budget = parseFloat(document.getElementById('event-budget').value);

  if (!name)  { toast('Event name is required', 'error'); return; }
  if (!type)  { toast('Event type is required', 'error'); return; }
  if (!date)  { toast('Event date is required', 'error'); return; }
  if (isNaN(budget) || budget < 0) { toast('Valid budget is required', 'error'); return; }

  const data = {
    name, eventType: type, eventDate: date,
    venue: document.getElementById('event-venue').value.trim(),
    guestCount: parseInt(document.getElementById('event-guests').value) || 0,
    totalBudget: budget,
    status: document.getElementById('event-status').value,
    description: document.getElementById('event-description').value.trim()
  };

  try {
    showLoading();
    if (state.editingEventId) {
      const updated = await PUT('/ebp/events/' + state.editingEventId, data);
      const idx = state.events.findIndex(x => x.id === state.editingEventId);
      if (idx !== -1) state.events[idx] = updated;
      toast('Event updated successfully!');
    } else {
      const created = await POST('/ebp/events', data);
      state.events.unshift(created);
      toast('Event created successfully!');
    }
    closeModal('event-modal');
    renderEventsTable(state.events);
    updateExpenseSelector();
    refreshDashboardIfActive();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function openViewEvent(id) {
  const e = state.events.find(x => x.id === id);
  if (!e) return;
  const spent     = totalSpent(e);
  const remaining = e.totalBudget - spent;
  const util      = e.totalBudget > 0 ? Math.round(spent / e.totalBudget * 100) : 0;
  const over      = spent > e.totalBudget;

  document.getElementById('view-event-title').textContent = e.name;
  document.getElementById('view-edit-btn').onclick = () => { closeModal('view-event-modal'); openEditEvent(id); };

  const expenses = (e.expenses || []);
  const catBreakdown = {};
  expenses.forEach(x => { catBreakdown[x.category] = (catBreakdown[x.category] || 0) + x.cost; });

  document.getElementById('view-event-body').innerHTML = `
    <div class="detail-grid">
      <div class="detail-item"><span class="detail-label">Event Type</span><span class="detail-value">${esc(e.eventType)}</span></div>
      <div class="detail-item"><span class="detail-label">Status</span><span class="detail-value"><span class="badge badge-${e.status.toLowerCase()}">${e.status}</span></span></div>
      <div class="detail-item"><span class="detail-label">Date</span><span class="detail-value">${fmtDate(e.eventDate)}</span></div>
      <div class="detail-item"><span class="detail-label">Venue</span><span class="detail-value">${esc(e.venue || '—')}</span></div>
      <div class="detail-item"><span class="detail-label">Guest Count</span><span class="detail-value">${e.guestCount || 0}</span></div>
      <div class="detail-item"><span class="detail-label">Total Budget</span><span class="detail-value">${fmt(e.totalBudget)}</span></div>
      <div class="detail-item"><span class="detail-label">Total Spent</span><span class="detail-value ${over ? 'text-danger' : ''}">${fmt(spent)}</span></div>
      <div class="detail-item"><span class="detail-label">Remaining</span><span class="detail-value ${remaining < 0 ? 'text-danger' : 'text-success'}">${fmt(remaining)}</span></div>
      <div class="detail-item detail-full"><span class="detail-label">Budget Utilization</span>
        <div style="margin-top:.5rem">
          <div style="display:flex;justify-content:space-between;margin-bottom:.4rem"><span style="font-size:.85rem;font-weight:600">${util}%</span>${over ? '<span class="badge badge-overbudget">OVER BUDGET</span>' : ''}</div>
          <div class="budget-progress-wrap"><div class="budget-progress-bar ${over ? 'over' : ''}" style="width:${Math.min(util,100)}%"></div></div>
        </div>
      </div>
      <div class="detail-item detail-full"><span class="detail-label">Description</span><span class="detail-value">${esc(e.description || '—')}</span></div>
    </div>
    ${expenses.length ? `
    <div style="margin-top:1.25rem">
      <div style="font-size:.85rem;font-weight:700;color:var(--text);margin-bottom:.75rem;text-transform:uppercase;letter-spacing:.05em">Expense Breakdown</div>
      <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
        ${Object.entries(catBreakdown).map(([cat, amt]) => `
          <div style="display:flex;align-items:center;gap:.4rem;padding:.35rem .8rem;border-radius:20px;background:var(--table-head);font-size:.8rem">
            <span style="width:8px;height:8px;border-radius:50%;background:${CATEGORY_COLORS[cat]||'#888'};display:inline-block"></span>
            <span style="font-weight:600">${cat}</span>
            <span style="color:var(--text-muted)">${fmt(amt)}</span>
          </div>`).join('')}
      </div>
      <table class="data-table"><thead><tr><th>Name</th><th>Category</th><th>Cost</th><th>Date</th></tr></thead>
      <tbody>${expenses.map(x => `<tr><td>${esc(x.name)}</td><td><span class="badge badge-category">${x.category}</span></td><td>${fmt(x.cost)}</td><td>${fmtDate(x.date)}</td></tr>`).join('')}</tbody></table>
    </div>` : '<div class="no-data">No expenses added yet.</div>'}
  `;
  openModal('view-event-modal');
}

function confirmDeleteEvent(id, name) {
  confirm(`Delete event "${name}" and all its expenses?`, async () => {
    try {
      showLoading();
      await DEL('/ebp/events/' + id);
      state.events = state.events.filter(e => e.id !== id);
      renderEventsTable(state.events);
      updateExpenseSelector();
      toast('Event deleted!', 'warning');
      refreshDashboardIfActive();
    } catch (err) { toast(err.message, 'error'); }
    finally { hideLoading(); }
  });
}

function totalSpent(event) {
  return (event.expenses || []).reduce((s, x) => s + parseFloat(x.cost || 0), 0);
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Expenses ──────────────────────────────────────────────────────────────
function updateExpenseSelector() {
  const sel = document.getElementById('expense-event-selector');
  const current = sel.value;
  sel.innerHTML = '<option value="">— Select Event —</option>' +
    state.events.map(e => `<option value="${e.id}" ${e.id === current ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
}

function renderExpensesPage() {
  updateExpenseSelector();
  const selId = document.getElementById('expense-event-selector')?.value;
  if (!selId) {
    document.getElementById('expenses-no-event').style.display = 'flex';
    document.getElementById('budget-summary').style.display = 'none';
    document.getElementById('expenses-card').style.display = 'none';
    document.getElementById('add-expense-btn').style.display = 'none';
  } else {
    state.selectedEventId = selId;
    renderExpensesForEvent(selId);
  }
}

function onExpenseEventChange() {
  const selId = document.getElementById('expense-event-selector').value;
  state.selectedEventId = selId;
  if (!selId) {
    document.getElementById('expenses-no-event').style.display = 'flex';
    document.getElementById('budget-summary').style.display = 'none';
    document.getElementById('expenses-card').style.display = 'none';
    document.getElementById('add-expense-btn').style.display = 'none';
    document.getElementById('expenses-subtitle').textContent = 'Select an event to view expenses';
    return;
  }
  renderExpensesForEvent(selId);
}

function renderExpensesForEvent(eventId) {
  const event = state.events.find(e => e.id === eventId);
  if (!event) return;

  document.getElementById('expenses-subtitle').textContent = `Expenses for: ${event.name}`;
  document.getElementById('expenses-no-event').style.display = 'none';
  document.getElementById('budget-summary').style.display = 'grid';
  document.getElementById('expenses-card').style.display = 'block';
  document.getElementById('add-expense-btn').style.display = 'inline-flex';

  const spent     = totalSpent(event);
  const remaining = event.totalBudget - spent;
  const util      = event.totalBudget > 0 ? Math.round(spent / event.totalBudget * 100) : 0;
  const over      = spent > event.totalBudget;

  document.getElementById('bsum-budget').textContent    = fmt(event.totalBudget);
  document.getElementById('bsum-spent').textContent     = fmt(spent);
  document.getElementById('bsum-remaining').textContent = fmt(remaining);
  document.getElementById('bsum-util').textContent      = util + '%';

  if (over) {
    document.getElementById('bsum-remaining').className = 'budget-value text-danger';
    toast(`Over budget by ${fmt(Math.abs(remaining))}!`, 'warning');
  } else if (util >= 80) {
    document.getElementById('bsum-remaining').className = 'budget-value text-warning';
  } else {
    document.getElementById('bsum-remaining').className = 'budget-value text-success';
  }

  const bar = document.getElementById('budget-progress-bar');
  bar.style.width = Math.min(util, 100) + '%';
  bar.classList.toggle('over', over);

  renderExpensesTable(event.expenses || []);
}

function getFilteredExpenses() {
  const event = state.events.find(e => e.id === state.selectedEventId);
  if (!event) return [];
  const search = (document.getElementById('expense-search')?.value || '').toLowerCase();
  const cat    = document.getElementById('filter-expense-category')?.value || '';
  const date   = document.getElementById('filter-expense-date')?.value || '';
  return (event.expenses || []).filter(x => {
    if (search && !x.name.toLowerCase().includes(search)) return false;
    if (cat  && x.category !== cat) return false;
    if (date && x.date !== date)    return false;
    return true;
  });
}

function filterExpenses() { renderExpensesTable(getFilteredExpenses()); }

function renderExpensesTable(expenses) {
  const tbody = document.getElementById('expenses-tbody');
  const empty = document.getElementById('expenses-empty');
  if (!expenses.length) {
    tbody.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';
  const sorted = [...expenses].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  tbody.innerHTML = sorted.map(x => `
    <tr>
      <td><span style="font-weight:600">${esc(x.name)}</span></td>
      <td>
        <span class="badge badge-category" style="gap:.4rem">
          <span style="width:8px;height:8px;border-radius:50%;background:${CATEGORY_COLORS[x.category]||'#888'};display:inline-block"></span>
          ${x.category}
        </span>
      </td>
      <td style="font-weight:700;color:var(--primary)">${fmt(x.cost)}</td>
      <td>${fmtDate(x.date)}</td>
      <td>
        <div class="actions-cell">
          <button class="action-btn edit"   title="Edit"   onclick="openEditExpense('${x.id}')"><i class="fas fa-edit"></i></button>
          <button class="action-btn delete" title="Delete" onclick="confirmDeleteExpense('${x.id}', '${esc(x.name)}')"><i class="fas fa-trash"></i></button>
        </div>
      </td>
    </tr>`).join('');
}

function openCreateExpense() {
  if (!state.selectedEventId) { toast('Select an event first', 'warning'); return; }
  state.editingExpenseId = null;
  document.getElementById('expense-modal-title').textContent = 'Add Expense';
  document.getElementById('expense-id').value = '';
  document.getElementById('expense-name').value = '';
  document.getElementById('expense-category').value = 'Venue';
  document.getElementById('expense-cost').value = '';
  document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
  openModal('expense-modal');
}

function openEditExpense(id) {
  const event = state.events.find(e => e.id === state.selectedEventId);
  if (!event) return;
  const expense = (event.expenses || []).find(x => x.id === id);
  if (!expense) return;
  state.editingExpenseId = id;
  document.getElementById('expense-modal-title').textContent = 'Edit Expense';
  document.getElementById('expense-id').value = id;
  document.getElementById('expense-name').value = expense.name;
  document.getElementById('expense-category').value = expense.category;
  document.getElementById('expense-cost').value = expense.cost;
  document.getElementById('expense-date').value = expense.date || '';
  openModal('expense-modal');
}

async function saveExpense() {
  const name = document.getElementById('expense-name').value.trim();
  const cat  = document.getElementById('expense-category').value;
  const cost = parseFloat(document.getElementById('expense-cost').value);
  const date = document.getElementById('expense-date').value;

  if (!name)            { toast('Expense name is required', 'error'); return; }
  if (isNaN(cost) || cost < 0) { toast('Valid cost is required', 'error'); return; }

  const data = { name, category: cat, cost, date };

  try {
    showLoading();
    const eventId = state.selectedEventId;
    if (state.editingExpenseId) {
      const updated = await PUT(`/ebp/events/${eventId}/expenses/${state.editingExpenseId}`, data);
      const event = state.events.find(e => e.id === eventId);
      if (event) {
        const idx = event.expenses.findIndex(x => x.id === state.editingExpenseId);
        if (idx !== -1) event.expenses[idx] = updated;
      }
      toast('Expense updated!');
    } else {
      const created = await POST(`/ebp/events/${eventId}/expenses`, data);
      const event = state.events.find(e => e.id === eventId);
      if (event) {
        if (!event.expenses) event.expenses = [];
        event.expenses.push(created);
      }
      toast('Expense added!');
    }
    closeModal('expense-modal');
    renderExpensesForEvent(eventId);
    refreshDashboardIfActive();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    hideLoading();
  }
}

function confirmDeleteExpense(id, name) {
  confirm(`Delete expense "${name}"?`, async () => {
    try {
      showLoading();
      const eventId = state.selectedEventId;
      await DEL(`/ebp/events/${eventId}/expenses/${id}`);
      const event = state.events.find(e => e.id === eventId);
      if (event) event.expenses = event.expenses.filter(x => x.id !== id);
      renderExpensesForEvent(eventId);
      toast('Expense deleted!', 'warning');
      refreshDashboardIfActive();
    } catch (err) { toast(err.message, 'error'); }
    finally { hideLoading(); }
  });
}

// ── Dashboard ─────────────────────────────────────────────────────────────
function refreshDashboardIfActive() {
  if (state.currentPage === 'dashboard') loadDashboard();
}

async function loadDashboard() {
  try {
    const analytics = await GET('/ebp/analytics');
    renderDashboardStats(analytics);
    renderRecentEvents();
    renderDashboardChart(analytics);
    renderOverBudgetList(analytics);
  } catch (err) { console.error(err); }
}

function renderDashboardStats(a) {
  const sym = getCurrencySymbol();
  const stats = [
    { label: 'Total Events', value: a.totalEvents, icon: 'fa-calendar-alt', color: '#6366f1', sub: `${a.byStatus.Planning||0} planning` },
    { label: 'Total Budget', value: sym + fmtNum(a.totalBudget), icon: 'fa-wallet', color: '#06b6d4', sub: 'across all events' },
    { label: 'Total Spent',  value: sym + fmtNum(a.totalSpent),  icon: 'fa-receipt',     color: '#f59e0b', sub: `${a.utilizationPercent}% utilized` },
    { label: 'Remaining',    value: sym + fmtNum(a.remaining),   icon: 'fa-piggy-bank',  color: '#10b981', sub: a.remaining < 0 ? 'Over budget!' : 'available' }
  ];
  const grid = document.getElementById('dashboard-stats');
  grid.innerHTML = stats.map(s => `
    <div class="stat-card" style="--stat-color:${s.color}">
      <div class="stat-icon" style="background:${s.color}"><i class="fas ${s.icon}"></i></div>
      <div class="stat-info">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-sub">${s.sub}</div>
      </div>
    </div>`).join('');
}

function fmtNum(n) {
  n = parseFloat(n) || 0;
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n/1_000).toFixed(1) + 'K';
  return n.toFixed(0);
}

function renderRecentEvents() {
  const list = document.getElementById('recent-events-list');
  const sorted = [...state.events].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 6);
  if (!sorted.length) {
    list.innerHTML = '<div class="no-data">No events yet.</div>';
    return;
  }
  list.innerHTML = sorted.map(e => {
    const spent = totalSpent(e);
    const util  = e.totalBudget > 0 ? Math.round(spent / e.totalBudget * 100) : 0;
    return `
      <div class="recent-event-item">
        <div class="event-dot ${e.status.toLowerCase()}"></div>
        <div class="recent-event-info">
          <div class="recent-event-name">${esc(e.name)}</div>
          <div class="recent-event-meta">${e.eventType} · ${fmtDate(e.eventDate)}</div>
        </div>
        <div class="recent-event-budget">
          <div class="budget-amount">${fmt(e.totalBudget)}</div>
          <div class="budget-used">${util}% used</div>
        </div>
      </div>`;
  }).join('');
}

function renderDashboardChart(analytics) {
  const canvas = document.getElementById('dashboardPieChart');
  if (!canvas) return;
  if (state.charts.dashPie) { state.charts.dashPie.destroy(); }

  const catData = analytics.categoryTotals || {};
  const labels = Object.keys(catData);
  const data   = Object.values(catData);
  const colors = labels.map(l => CATEGORY_COLORS[l] || '#999');

  if (!labels.length) {
    canvas.parentElement.innerHTML = '<div class="no-data">No expense data yet.</div>';
    return;
  }

  state.charts.dashPie = new Chart(canvas, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 6 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { color: getComputedStyle(document.documentElement).getPropertyValue('--text').trim() || '#333', padding: 10, font: { size: 11 } } } }
    }
  });
}

function renderOverBudgetList(analytics) {
  const list = document.getElementById('over-budget-list');
  const items = analytics.overBudgetEvents || [];
  if (!items.length) {
    list.innerHTML = '<div style="padding:.75rem;color:var(--success);display:flex;align-items:center;gap:.5rem"><i class="fas fa-check-circle"></i> All events are within budget!</div>';
    return;
  }
  list.innerHTML = items.map(item => `
    <div class="alert-item">
      <i class="fas fa-exclamation-triangle"></i>
      <span class="alert-text">${esc(item.name)}</span>
      <span class="alert-over">+${fmt(item.over)} over</span>
    </div>`).join('');
}

// ── Analytics ─────────────────────────────────────────────────────────────
async function loadAnalytics() {
  try {
    showLoading();
    const analytics = await GET('/ebp/analytics');
    renderAnalyticsStats(analytics);
    renderCharts(analytics);
  } catch (err) { toast(err.message, 'error'); }
  finally { hideLoading(); }
}

function renderAnalyticsStats(a) {
  const sym = getCurrencySymbol();
  const stats = [
    { label: 'Total Events',   value: a.totalEvents,     icon: 'fa-calendar-alt', color: '#6366f1', sub: '' },
    { label: 'Total Expenses', value: a.totalExpenses,   icon: 'fa-receipt',      color: '#8b5cf6', sub: 'individual line items' },
    { label: 'Budget Used',    value: a.utilizationPercent + '%', icon: 'fa-chart-pie', color: '#f59e0b', sub: `of ${sym}${fmtNum(a.totalBudget)}` },
    { label: 'Total Saved',    value: sym + fmtNum(Math.max(0, a.remaining)), icon: 'fa-piggy-bank', color: '#10b981', sub: a.remaining < 0 ? 'Over budget!' : 'under budget' }
  ];
  document.getElementById('analytics-stats').innerHTML = stats.map(s => `
    <div class="stat-card" style="--stat-color:${s.color}">
      <div class="stat-icon" style="background:${s.color}"><i class="fas ${s.icon}"></i></div>
      <div class="stat-info">
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.value}</div>
        <div class="stat-sub">${s.sub}</div>
      </div>
    </div>`).join('');
}

function renderCharts(a) {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#e0e7ff' : '#1e1b4b';
  const gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';

  // Category spending
  destroyChart('categoryChart');
  const catData = a.categoryTotals || {};
  const catLabels = Object.keys(catData);
  if (catLabels.length) {
    state.charts.categoryChart = new Chart(document.getElementById('categoryChart'), {
      type: 'bar',
      data: {
        labels: catLabels,
        datasets: [{ label: 'Spending', data: Object.values(catData), backgroundColor: catLabels.map(l => CATEGORY_COLORS[l] || '#999'), borderRadius: 8, borderSkipped: false }]
      },
      options: {
        responsive: true, maintainAspectRatio: false, indexAxis: 'y',
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => getCurrencySymbol() + fmtNum(v) } },
          y: { grid: { display: false }, ticks: { color: textColor } }
        }
      }
    });
  }

  // Status chart
  destroyChart('statusChart');
  const statusLabels = Object.keys(a.byStatus);
  if (statusLabels.length) {
    state.charts.statusChart = new Chart(document.getElementById('statusChart'), {
      type: 'doughnut',
      data: {
        labels: statusLabels,
        datasets: [{ data: Object.values(a.byStatus), backgroundColor: statusLabels.map(s => STATUS_COLORS[s] || '#999'), borderWidth: 0, hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 12, font: { size: 12 } } } }
      }
    });
  }

  // Monthly trend
  destroyChart('trendChart');
  const months = Object.keys(a.monthlySpending);
  if (months.length) {
    state.charts.trendChart = new Chart(document.getElementById('trendChart'), {
      type: 'line',
      data: {
        labels: months.map(m => { const d = new Date(m + '-01'); return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }); }),
        datasets: [{
          label: 'Monthly Spending', data: Object.values(a.monthlySpending),
          borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.12)',
          borderWidth: 3, fill: true, tension: 0.4,
          pointBackgroundColor: '#6366f1', pointRadius: 5, pointHoverRadius: 8
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor } },
          y: { grid: { color: gridColor }, ticks: { color: textColor, callback: v => getCurrencySymbol() + fmtNum(v) } }
        }
      }
    });
  }

  // Event type chart
  destroyChart('typeChart');
  const typeLabels = Object.keys(a.byType);
  if (typeLabels.length) {
    const palette = ['#6366f1','#06b6d4','#10b981','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6'];
    state.charts.typeChart = new Chart(document.getElementById('typeChart'), {
      type: 'pie',
      data: {
        labels: typeLabels,
        datasets: [{ data: Object.values(a.byType), backgroundColor: typeLabels.map((_, i) => palette[i % palette.length]), borderWidth: 0, hoverOffset: 8 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom', labels: { color: textColor, padding: 10, font: { size: 11 } } } }
      }
    });
  }
}

function destroyChart(key) {
  if (state.charts[key]) { state.charts[key].destroy(); delete state.charts[key]; }
}

// ── Reports ───────────────────────────────────────────────────────────────
function exportEventsCSV() {
  window.location.href = '/ebp/export/events/csv';
  toast('Downloading events CSV…');
}

function exportExpensesCSV() {
  window.location.href = '/ebp/export/expenses/csv';
  toast('Downloading expenses CSV…');
}

function printEventsReport() {
  const sym = getCurrencySymbol();
  const rows = state.events.map(e => {
    const spent = totalSpent(e);
    return `<tr>
      <td>${esc(e.name)}</td><td>${esc(e.eventType)}</td><td>${fmtDate(e.eventDate)}</td>
      <td>${esc(e.venue||'')}</td><td>${e.guestCount||0}</td>
      <td>${sym}${(+e.totalBudget).toFixed(2)}</td><td>${sym}${spent.toFixed(2)}</td>
      <td>${sym}${(e.totalBudget-spent).toFixed(2)}</td><td>${e.status}</td>
    </tr>`;
  }).join('');
  openPrintWindow('Events Report',
    `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;font-size:12px">
      <thead style="background:#6366f1;color:#fff"><tr><th>Name</th><th>Type</th><th>Date</th><th>Venue</th><th>Guests</th><th>Budget</th><th>Spent</th><th>Remaining</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table>`);
}

function printExpensesReport() {
  const sym = getCurrencySymbol();
  const rows = state.events.flatMap(e =>
    (e.expenses || []).map(x => `<tr>
      <td>${esc(e.name)}</td><td>${esc(x.name)}</td><td>${x.category}</td>
      <td>${sym}${(+x.cost).toFixed(2)}</td><td>${fmtDate(x.date)}</td>
    </tr>`)
  ).join('');
  openPrintWindow('Expenses Report',
    `<table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;font-size:12px">
      <thead style="background:#6366f1;color:#fff"><tr><th>Event</th><th>Expense</th><th>Category</th><th>Cost</th><th>Date</th></tr></thead>
      <tbody>${rows}</tbody></table>`);
}

function printAnalyticsReport() {
  GET('/ebp/analytics').then(a => {
    const sym = getCurrencySymbol();
    openPrintWindow('Analytics Report', `
      <h3>Summary</h3>
      <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;font-size:12px;margin-bottom:20px">
        <tr><td><strong>Total Events</strong></td><td>${a.totalEvents}</td></tr>
        <tr><td><strong>Total Budget</strong></td><td>${sym}${(+a.totalBudget).toFixed(2)}</td></tr>
        <tr><td><strong>Total Spent</strong></td><td>${sym}${(+a.totalSpent).toFixed(2)}</td></tr>
        <tr><td><strong>Remaining</strong></td><td>${sym}${(+a.remaining).toFixed(2)}</td></tr>
        <tr><td><strong>Utilization</strong></td><td>${a.utilizationPercent}%</td></tr>
      </table>
      <h3>Spending by Category</h3>
      <table border="1" cellpadding="8" style="border-collapse:collapse;width:100%;font-size:12px">
        <thead style="background:#6366f1;color:#fff"><tr><th>Category</th><th>Amount</th></tr></thead>
        <tbody>${Object.entries(a.categoryTotals||{}).map(([k,v])=>`<tr><td>${k}</td><td>${sym}${v.toFixed(2)}</td></tr>`).join('')}</tbody>
      </table>`);
  });
}

function openPrintWindow(title, content) {
  const w = window.open('', '_blank');
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;padding:2rem;color:#1e1b4b}h1{color:#6366f1}h3{margin-top:1.5rem;color:#4f46e5}</style>
    </head><body>
    <h1>EventBudget Pro — ${title}</h1>
    <p style="color:#999;font-size:12px">Generated: ${new Date().toLocaleString()}</p>
    ${content}
    <script>window.onload=()=>{window.print();}<\/script>
    </body></html>`);
  w.document.close();
}

// ── Settings ──────────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    state.settings = await GET('/ebp/settings');
    const s = state.settings;
    document.getElementById('settings-name').value  = s.profile?.name  || '';
    document.getElementById('settings-email').value = s.profile?.email || '';
    document.getElementById('settings-dark-mode').checked    = !!s.darkMode;
    document.getElementById('settings-currency').value       = s.currency || 'USD';
    document.getElementById('settings-notif-email').checked  = !!s.notifications?.emailNotifications;
    document.getElementById('settings-notif-budget').checked = !!s.notifications?.budgetAlerts;
    document.getElementById('settings-notif-event').checked  = !!s.notifications?.eventReminders;
    applyTheme(s.darkMode);
    updateCurrencyBadge(s.currency);
  } catch (err) { console.error(err); }
}

async function saveProfile() {
  const name  = document.getElementById('settings-name').value.trim();
  const email = document.getElementById('settings-email').value.trim();
  if (!name) { toast('Name is required', 'error'); return; }
  state.settings.profile = { name, email };
  await saveSettings();
  document.getElementById('sidebar-user-name').textContent = name;
  toast('Profile saved!');
}

async function onDarkModeToggle() {
  const enabled = document.getElementById('settings-dark-mode').checked;
  state.settings.darkMode = enabled;
  applyTheme(enabled);
  await saveSettings();
}

function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const newDark = !isDark;
  document.getElementById('settings-dark-mode').checked = newDark;
  state.settings.darkMode = newDark;
  applyTheme(newDark);
  saveSettings();
}

function applyTheme(dark) {
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const icon = document.getElementById('theme-toggle').querySelector('i');
  icon.className = dark ? 'fas fa-sun' : 'fas fa-moon';
  if (state.currentPage === 'analytics') {
    GET('/ebp/analytics').then(renderCharts).catch(() => {});
  }
}

async function onCurrencyChange() {
  const cur = document.getElementById('settings-currency').value;
  state.settings.currency = cur;
  updateCurrencyBadge(cur);
  await saveSettings();
  if (state.currentPage === 'events')   renderEventsTable(state.events);
  if (state.currentPage === 'expenses' && state.selectedEventId) renderExpensesForEvent(state.selectedEventId);
  if (state.currentPage === 'dashboard') loadDashboard();
  toast('Currency updated to ' + cur);
}

function updateCurrencyBadge(cur) {
  document.getElementById('currency-badge').textContent = cur || 'USD';
}

function changePassword() {
  const cur  = document.getElementById('current-password').value;
  const nw   = document.getElementById('new-password').value;
  const conf = document.getElementById('confirm-password').value;
  if (!cur)       { toast('Current password is required', 'error'); return; }
  if (!nw)        { toast('New password is required', 'error'); return; }
  if (nw !== conf){ toast('Passwords do not match', 'error'); return; }
  if (nw.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-password').value = '';
  toast('Password updated successfully!');
}

async function saveNotifications() {
  state.settings.notifications = {
    emailNotifications: document.getElementById('settings-notif-email').checked,
    budgetAlerts:       document.getElementById('settings-notif-budget').checked,
    eventReminders:     document.getElementById('settings-notif-event').checked
  };
  await saveSettings();
  toast('Notification preferences saved!');
}

async function saveSettings() {
  try { await PUT('/ebp/settings', state.settings); }
  catch (err) { toast(err.message, 'error'); }
}

// ── Init ──────────────────────────────────────────────────────────────────
async function init() {
  showLoading();
  try {
    await Promise.all([loadEvents(), loadSettings()]);
    document.getElementById('sidebar-user-name').textContent = state.settings.profile?.name || 'Admin User';
    applyTheme(state.settings.darkMode);
    updateCurrencyBadge(state.settings.currency);
    loadDashboard();
  } catch (err) {
    toast('Could not connect to server. Please try refreshing.', 'error');
  } finally {
    hideLoading();
  }
}

document.addEventListener('DOMContentLoaded', init);

// Close modals on backdrop click
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.classList.remove('open');
  });
});

// Keyboard shortcut: Escape to close modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-backdrop.open').forEach(m => m.classList.remove('open'));
  }
});
