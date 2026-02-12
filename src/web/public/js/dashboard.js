let channels = [];
let roles = [];

async function api(url, opts = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...opts.headers },
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  if (res.status === 401) { window.location = '/auth/login'; return null; }
  return res.json();
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
}

function fmtDate(d) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function badge(status) {
  const cls = { active: 'badge-active', expired: 'badge-expired', open: 'badge-open', closed: 'badge-closed', cancelled: 'badge-cancelled' };
  return `<span class="badge ${cls[status] || ''}">${status}</span>`;
}

function showModal(html) {
  document.getElementById('modalContent').innerHTML = html;
  document.getElementById('modalOverlay').classList.add('active');
}

function hideModal() {
  document.getElementById('modalOverlay').classList.remove('active');
}

document.getElementById('modalOverlay').addEventListener('click', e => {
  if (e.target === e.currentTarget) hideModal();
});

document.querySelectorAll('.sidebar-nav a').forEach(a => {
  a.addEventListener('click', e => {
    e.preventDefault();
    const section = a.dataset.section;
    document.querySelectorAll('.sidebar-nav a').forEach(x => x.classList.remove('active'));
    a.classList.add('active');
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`sec-${section}`).classList.add('active');
    loadSection(section);
  });
});

function channelName(id) {
  const ch = channels.find(c => c.id === id);
  return ch ? `#${ch.name}` : id || '-';
}

function channelSelect(selected = '', filter = null) {
  const filtered = filter ? channels.filter(c => c.type === filter) : channels.filter(c => c.type === 0);
  return `<select class="channel-select">${['<option value="">Select channel</option>', ...filtered.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>#${c.name}</option>`)].join('')}</select>`;
}

function categorySelect(selected = '') {
  const cats = channels.filter(c => c.type === 4);
  return `<select class="category-select">${['<option value="">None</option>', ...cats.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.name}</option>`)].join('')}</select>`;
}

function roleSelect(selected = '') {
  return `<select class="role-select">${['<option value="">None</option>', ...roles.map(r => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${r.name}</option>`)].join('')}</select>`;
}

async function init() {
  const user = await api('/auth/me');
  if (!user) return;
  document.getElementById('userInfo').innerHTML = `
    ${user.avatar ? `<img src="${user.avatar}" alt="">` : ''}
    <span>${user.username}</span>
  `;
  [channels, roles] = await Promise.all([api('/api/channels'), api('/api/roles')]);
  loadSection('overview');
}

async function loadSection(section) {
  switch (section) {
    case 'overview': return loadOverview();
    case 'panels': return loadPanels();
    case 'plans': return loadPlans();
    case 'payments': return loadPayments();
    case 'subscriptions': return loadSubscriptions();
    case 'tickets': return loadTickets();
    case 'reminders': return loadReminders();
    case 'settings': return loadSettings();
    case 'logs': return loadLogs();
  }
}

async function loadOverview() {
  const [analytics, expiring] = await Promise.all([
    api('/api/analytics'),
    api('/api/subscriptions/expiring?days=7')
  ]);
  const s = analytics.subscriptions || {};
  document.getElementById('overviewStats').innerHTML = `
    <div class="stat-card"><div class="label">Active Subscriptions</div><div class="value green">${s.active_count || 0}</div></div>
    <div class="stat-card"><div class="label">Total Subscriptions</div><div class="value">${s.total_count || 0}</div></div>
    <div class="stat-card"><div class="label">Total Revenue</div><div class="value">&#8377;${parseFloat(s.total_revenue || 0).toLocaleString()}</div></div>
    <div class="stat-card"><div class="label">Expiring Soon</div><div class="value yellow">${s.expiring_soon || 0}</div></div>
    <div class="stat-card"><div class="label">Expired</div><div class="value red">${s.expired_count || 0}</div></div>
    <div class="stat-card"><div class="label">Open Tickets</div><div class="value">${(analytics.tickets || []).find(t => t.status === 'open')?.count || 0}</div></div>
  `;
  document.getElementById('planStatsBody').innerHTML = (analytics.planBreakdown || []).map(p =>
    `<tr><td>${p.plan_name}</td><td>${p.count}</td><td>&#8377;${parseFloat(p.revenue || 0).toLocaleString()}</td></tr>`
  ).join('') || '<tr><td colspan="3" class="empty-state">No data yet</td></tr>';
  document.getElementById('expiringBody').innerHTML = (expiring || []).map(s =>
    `<tr><td>${s.user_id}</td><td>${s.plan_name}</td><td>${fmtDate(s.end_date)}</td>
    <td class="actions-cell"><button class="btn btn-sm btn-primary" onclick="triggerReminder(${s.id})">Send Reminder</button></td></tr>`
  ).join('') || '<tr><td colspan="4" class="empty-state">No expiring subscriptions</td></tr>';
}

async function loadPanels() {
  const panels = await api('/api/panels');
  document.getElementById('panelsBody').innerHTML = (panels || []).map(p => `
    <tr>
      <td>${p.title}</td>
      <td>${channelName(p.channel_id)}</td>
      <td>${p.enabled ? badge('active') : badge('closed')}</td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-primary" onclick="postPanel(${p.id})">Post</button>
        <button class="btn btn-sm btn-outline" onclick="editPanel(${p.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deletePanel(${p.id})">Delete</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="4" class="empty-state">No panels created</td></tr>';
}

function showPanelModal(panel = null) {
  const isEdit = !!panel;
  showModal(`
    <h2>${isEdit ? 'Edit' : 'Create'} Ticket Panel</h2>
    <div class="form-group"><label>Title</label><input id="pTitle" value="${panel?.title || 'Support Tickets'}"></div>
    <div class="form-group"><label>Description</label><textarea id="pDesc">${panel?.description || 'Click the button below to open a ticket.'}</textarea></div>
    <div class="form-row">
      <div class="form-group"><label>Channel</label>${channelSelect(panel?.channel_id)}</div>
      <div class="form-group"><label>Category</label>${categorySelect(panel?.category_id)}</div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Staff Role</label>${roleSelect(panel?.staff_role_id)}</div>
      <div class="form-group"><label>Logs Channel</label>${channelSelect(panel?.logs_channel_id)}</div>
    </div>
    <div class="form-group"><label>Embed Color</label>
      <div class="color-input"><input type="color" id="pColor" value="${panel?.color || '#5865F2'}"><input type="text" id="pColorText" value="${panel?.color || '#5865F2'}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Button Label</label><input id="pBtnLabel" value="${panel?.button_label || 'Open Ticket'}"></div>
      <div class="form-group"><label>Button Emoji</label><input id="pBtnEmoji" value="${panel?.button_emoji || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Button Color</label>
        <select id="pBtnColor"><option ${panel?.button_color === 'Primary' ? 'selected' : ''}>Primary</option><option ${panel?.button_color === 'Secondary' ? 'selected' : ''}>Secondary</option><option ${panel?.button_color === 'Success' ? 'selected' : ''}>Success</option><option ${panel?.button_color === 'Danger' ? 'selected' : ''}>Danger</option></select>
      </div>
      <div class="form-group"><label>Max Tickets Per User</label><input type="number" id="pMaxTickets" value="${panel?.max_tickets_per_user || 1}" min="1"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Thumbnail URL</label><input id="pThumb" value="${panel?.thumbnail_url || ''}"></div>
      <div class="form-group"><label>Image URL</label><input id="pImage" value="${panel?.image_url || ''}"></div>
    </div>
    <div class="form-group"><label>Footer Text</label><input id="pFooter" value="${panel?.footer_text || ''}"></div>
    <div class="form-group"><label>Enabled</label><label class="toggle"><input type="checkbox" id="pEnabled" ${panel?.enabled !== false ? 'checked' : ''}><span class="slider"></span></label></div>
    <div class="embed-preview">
      <div class="embed-title" id="previewTitle">${panel?.title || 'Support Tickets'}</div>
      <div class="embed-desc" id="previewDesc">${panel?.description || 'Click the button below to open a ticket.'}</div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="hideModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePanel(${panel?.id || 'null'})">${isEdit ? 'Save' : 'Create'}</button>
    </div>
  `);
  const titleEl = document.getElementById('pTitle');
  const descEl = document.getElementById('pDesc');
  titleEl.addEventListener('input', () => document.getElementById('previewTitle').textContent = titleEl.value);
  descEl.addEventListener('input', () => document.getElementById('previewDesc').textContent = descEl.value);
  document.getElementById('pColor').addEventListener('input', e => document.getElementById('pColorText').value = e.target.value);
  document.getElementById('pColorText').addEventListener('input', e => document.getElementById('pColor').value = e.target.value);
}

async function savePanel(id) {
  const data = {
    title: document.getElementById('pTitle').value,
    description: document.getElementById('pDesc').value,
    channel_id: document.querySelector('.channel-select').value,
    category_id: document.querySelector('.category-select').value || null,
    staff_role_id: document.querySelector('.role-select').value || null,
    logs_channel_id: document.querySelectorAll('.channel-select')[1]?.value || null,
    color: document.getElementById('pColorText').value,
    button_label: document.getElementById('pBtnLabel').value,
    button_emoji: document.getElementById('pBtnEmoji').value || null,
    button_color: document.getElementById('pBtnColor').value,
    max_tickets_per_user: parseInt(document.getElementById('pMaxTickets').value) || 1,
    thumbnail_url: document.getElementById('pThumb').value || null,
    image_url: document.getElementById('pImage').value || null,
    footer_text: document.getElementById('pFooter').value || null,
    enabled: document.getElementById('pEnabled').checked
  };
  if (!data.channel_id) return toast('Please select a channel', 'error');
  if (id) {
    await api(`/api/panels/${id}`, { method: 'PUT', body: data });
  } else {
    await api('/api/panels', { method: 'POST', body: data });
  }
  hideModal(); loadPanels(); toast('Panel saved!');
}

async function editPanel(id) {
  const panels = await api('/api/panels');
  const panel = panels.find(p => p.id === id);
  if (panel) showPanelModal(panel);
}

async function postPanel(id) {
  const res = await api(`/api/panels/${id}/post`, { method: 'POST' });
  if (res?.success) toast('Panel posted to channel!');
  else toast(res?.error || 'Failed to post panel', 'error');
}

async function deletePanel(id) {
  if (!confirm('Delete this panel?')) return;
  await api(`/api/panels/${id}`, { method: 'DELETE' });
  loadPanels(); toast('Panel deleted');
}

async function loadPlans() {
  const plans = await api('/api/plans');
  document.getElementById('plansBody').innerHTML = (plans || []).map(p => `
    <tr>
      <td>${p.name}</td>
      <td>${p.duration_days} days</td>
      <td>&#8377;${parseFloat(p.price).toLocaleString()}</td>
      <td>${p.discount_percent > 0 ? p.discount_percent + '%' : '-'}</td>
      <td>${p.recommended ? '🔥 Yes' : 'No'}</td>
      <td>${p.enabled ? '✅' : '❌'}</td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-outline" onclick="editPlan(${p.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deletePlan(${p.id})">Delete</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="empty-state">No plans</td></tr>';
}

function showPlanModal(plan = null) {
  showModal(`
    <h2>${plan ? 'Edit' : 'Add'} Plan</h2>
    <div class="form-group"><label>Name</label><input id="plName" value="${plan?.name || ''}"></div>
    <div class="form-row">
      <div class="form-group"><label>Duration (days)</label><input type="number" id="plDuration" value="${plan?.duration_days || 30}"></div>
      <div class="form-group"><label>Price (INR)</label><input type="number" step="0.01" id="plPrice" value="${plan?.price || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Discount %</label><input type="number" id="plDiscount" value="${plan?.discount_percent || 0}"></div>
      <div class="form-group"><label>Display Order</label><input type="number" id="plOrder" value="${plan?.display_order || 0}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Button Emoji</label><input id="plEmoji" value="${plan?.button_emoji || ''}"></div>
      <div class="form-group"><label>Button Color</label>
        <select id="plColor"><option ${plan?.button_color === 'Primary' ? 'selected' : ''}>Primary</option><option ${plan?.button_color === 'Secondary' ? 'selected' : ''}>Secondary</option><option ${plan?.button_color === 'Success' ? 'selected' : ''}>Success</option><option ${plan?.button_color === 'Danger' ? 'selected' : ''}>Danger</option></select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Recommended</label><label class="toggle"><input type="checkbox" id="plRec" ${plan?.recommended ? 'checked' : ''}><span class="slider"></span></label></div>
      <div class="form-group"><label>Enabled</label><label class="toggle"><input type="checkbox" id="plEnabled" ${plan?.enabled !== false ? 'checked' : ''}><span class="slider"></span></label></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="hideModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePlan(${plan?.id || 'null'})">${plan ? 'Save' : 'Create'}</button>
    </div>
  `);
}

async function savePlan(id) {
  const data = {
    name: document.getElementById('plName').value,
    duration_days: parseInt(document.getElementById('plDuration').value),
    price: parseFloat(document.getElementById('plPrice').value),
    discount_percent: parseInt(document.getElementById('plDiscount').value) || 0,
    display_order: parseInt(document.getElementById('plOrder').value) || 0,
    button_emoji: document.getElementById('plEmoji').value || null,
    button_color: document.getElementById('plColor').value,
    recommended: document.getElementById('plRec').checked,
    enabled: document.getElementById('plEnabled').checked
  };
  if (!data.name) return toast('Plan name is required', 'error');
  if (id) {
    await api(`/api/plans/${id}`, { method: 'PUT', body: data });
  } else {
    await api('/api/plans', { method: 'POST', body: data });
  }
  hideModal(); loadPlans(); toast('Plan saved!');
}

async function editPlan(id) {
  const plans = await api('/api/plans');
  const plan = plans.find(p => p.id === id);
  if (plan) showPlanModal(plan);
}

async function deletePlan(id) {
  if (!confirm('Delete this plan?')) return;
  await api(`/api/plans/${id}`, { method: 'DELETE' });
  loadPlans(); toast('Plan deleted');
}

async function loadPayments() {
  const methods = await api('/api/payment-methods');
  document.getElementById('paymentsBody').innerHTML = (methods || []).map(m => `
    <tr>
      <td>${m.label}</td>
      <td>${m.emoji || '-'}</td>
      <td>${m.recommended ? '⭐ Yes' : 'No'}</td>
      <td>${m.enabled ? '✅' : '❌'}</td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-outline" onclick="editPayment(${m.id})">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deletePayment(${m.id})">Delete</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="empty-state">No payment methods</td></tr>';
}

function showPaymentModal(method = null) {
  showModal(`
    <h2>${method ? 'Edit' : 'Add'} Payment Method</h2>
    <div class="form-row">
      <div class="form-group"><label>Name (internal)</label><input id="pmName" value="${method?.name || ''}"></div>
      <div class="form-group"><label>Label (shown to users)</label><input id="pmLabel" value="${method?.label || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Emoji</label><input id="pmEmoji" value="${method?.emoji || ''}"></div>
      <div class="form-group"><label>Button Color</label>
        <select id="pmColor"><option ${method?.button_color === 'Primary' ? 'selected' : ''}>Primary</option><option ${method?.button_color === 'Secondary' ? 'selected' : ''}>Secondary</option><option ${method?.button_color === 'Success' ? 'selected' : ''}>Success</option><option ${method?.button_color === 'Danger' ? 'selected' : ''}>Danger</option></select>
      </div>
    </div>
    <div class="form-group"><label>Payment Instructions</label><textarea id="pmInstructions">${method?.instructions || ''}</textarea></div>
    <div class="form-group"><label>Payment Link</label><input id="pmLink" value="${method?.payment_link || ''}"></div>
    <div class="form-group"><label>QR Image URL</label><input id="pmQR" value="${method?.qr_image_url || ''}"></div>
    <div class="form-row">
      <div class="form-group"><label>Embed Color</label>
        <div class="color-input"><input type="color" id="pmEmbedColor" value="${method?.embed_color || '#5865F2'}"><input type="text" id="pmEmbedColorText" value="${method?.embed_color || '#5865F2'}"></div>
      </div>
      <div class="form-group"><label>Display Order</label><input type="number" id="pmOrder" value="${method?.display_order || 0}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Embed Thumbnail URL</label><input id="pmThumb" value="${method?.embed_thumbnail || ''}"></div>
      <div class="form-group"><label>Embed Image URL</label><input id="pmImage" value="${method?.embed_image || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Recommended</label><label class="toggle"><input type="checkbox" id="pmRec" ${method?.recommended ? 'checked' : ''}><span class="slider"></span></label></div>
      <div class="form-group"><label>Enabled</label><label class="toggle"><input type="checkbox" id="pmEnabled" ${method?.enabled !== false ? 'checked' : ''}><span class="slider"></span></label></div>
    </div>
    <div class="modal-actions">
      <button class="btn btn-outline" onclick="hideModal()">Cancel</button>
      <button class="btn btn-primary" onclick="savePayment(${method?.id || 'null'})">${method ? 'Save' : 'Create'}</button>
    </div>
  `);
  document.getElementById('pmEmbedColor').addEventListener('input', e => document.getElementById('pmEmbedColorText').value = e.target.value);
}

async function savePayment(id) {
  const data = {
    name: document.getElementById('pmName').value,
    label: document.getElementById('pmLabel').value,
    emoji: document.getElementById('pmEmoji').value || null,
    button_color: document.getElementById('pmColor').value,
    instructions: document.getElementById('pmInstructions').value || null,
    payment_link: document.getElementById('pmLink').value || null,
    qr_image_url: document.getElementById('pmQR').value || null,
    embed_color: document.getElementById('pmEmbedColorText').value,
    embed_thumbnail: document.getElementById('pmThumb').value || null,
    embed_image: document.getElementById('pmImage').value || null,
    display_order: parseInt(document.getElementById('pmOrder').value) || 0,
    recommended: document.getElementById('pmRec').checked,
    enabled: document.getElementById('pmEnabled').checked
  };
  if (!data.name || !data.label) return toast('Name and label required', 'error');
  if (id) {
    await api(`/api/payment-methods/${id}`, { method: 'PUT', body: data });
  } else {
    await api('/api/payment-methods', { method: 'POST', body: data });
  }
  hideModal(); loadPayments(); toast('Payment method saved!');
}

async function editPayment(id) {
  const methods = await api('/api/payment-methods');
  const m = methods.find(x => x.id === id);
  if (m) showPaymentModal(m);
}

async function deletePayment(id) {
  if (!confirm('Delete this payment method?')) return;
  await api(`/api/payment-methods/${id}`, { method: 'DELETE' });
  loadPayments(); toast('Payment method deleted');
}

async function loadSubscriptions() {
  const status = document.getElementById('subFilter')?.value || '';
  const subs = await api(`/api/subscriptions${status ? '?status=' + status : ''}`);
  document.getElementById('subsBody').innerHTML = (subs || []).map(s => `
    <tr>
      <td>${s.user_id}</td>
      <td>${s.email || '-'}</td>
      <td>${s.plan_name}</td>
      <td>&#8377;${parseFloat(s.price).toLocaleString()}</td>
      <td>${fmtDate(s.start_date)}</td>
      <td>${fmtDate(s.end_date)}</td>
      <td>${badge(s.status)}</td>
      <td class="actions-cell">
        <button class="btn btn-sm btn-outline" onclick="showSubDetails(${s.id})">Details</button>
        ${s.status === 'active' ? `<button class="btn btn-sm btn-primary" onclick="extendSub(${s.id})">Extend</button>
        <button class="btn btn-sm btn-danger" onclick="cancelSub(${s.id})">Cancel</button>` : ''}
        <button class="btn btn-sm btn-outline" onclick="triggerReminder(${s.id})">Remind</button>
      </td>
    </tr>
  `).join('') || '<tr><td colspan="8" class="empty-state">No subscriptions</td></tr>';
}

async function showSubDetails(id) {
  const reminders = await api(`/api/subscriptions/${id}/reminders`);
  showModal(`
    <h2>Subscription #${id} - Reminders</h2>
    <table>
      <thead><tr><th>Date</th><th>Days Before</th><th>Sent</th><th>Sent At</th><th>Error</th></tr></thead>
      <tbody>${(reminders || []).map(r => `
        <tr>
          <td>${fmtDate(r.reminder_date)}</td>
          <td>${r.days_before} days</td>
          <td>${r.sent ? '✅' : '⏳'}</td>
          <td>${r.sent_at ? fmtDate(r.sent_at) : '-'}</td>
          <td>${r.error || '-'}</td>
        </tr>
      `).join('')}</tbody>
    </table>
    <div class="modal-actions"><button class="btn btn-outline" onclick="hideModal()">Close</button></div>
  `);
}

async function extendSub(id) {
  const days = prompt('Extend by how many days?', '30');
  if (!days) return;
  const res = await api(`/api/subscriptions/${id}/extend`, { method: 'POST', body: { days: parseInt(days) } });
  if (res?.success) { toast('Subscription extended!'); loadSubscriptions(); }
  else toast(res?.error || 'Failed', 'error');
}

async function cancelSub(id) {
  if (!confirm('Cancel this subscription?')) return;
  const res = await api(`/api/subscriptions/${id}/cancel`, { method: 'POST' });
  if (res?.success) { toast('Subscription cancelled'); loadSubscriptions(); }
}

async function triggerReminder(subId) {
  const res = await api(`/api/reminders/trigger/${subId}`, { method: 'POST' });
  if (res?.success) toast('Reminder sent!');
  else toast(res?.error || 'Failed to send', 'error');
}

async function loadTickets() {
  const status = document.getElementById('ticketFilter')?.value || '';
  const tickets = await api(`/api/tickets${status ? '?status=' + status : ''}`);
  document.getElementById('ticketsBody').innerHTML = (tickets || []).map(t => `
    <tr>
      <td>#${t.id}</td>
      <td>${t.user_id}</td>
      <td>${badge(t.status)}</td>
      <td>${t.plan_id || '-'}</td>
      <td>${t.payment_confirmed ? '✅' : '⏳'}</td>
      <td>${fmtDate(t.created_at)}</td>
    </tr>
  `).join('') || '<tr><td colspan="6" class="empty-state">No tickets</td></tr>';
}

async function loadReminders() {
  const history = await api('/api/reminders/history');
  document.getElementById('remindersBody').innerHTML = (history || []).map(r => `
    <tr>
      <td>${r.user_id}</td>
      <td>${fmtDate(r.reminder_date)}</td>
      <td>${r.days_before} days</td>
      <td>${r.sent ? '✅' : '⏳'}</td>
      <td>${r.sent_at ? fmtDate(r.sent_at) : '-'}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="empty-state">No reminders</td></tr>';
}

async function loadSettings() {
  const guild = await api('/api/guild');
  document.getElementById('settReminderDays').value = (guild.reminder_days || [3, 2, 1]).join(',');

  const cats = channels.filter(c => c.type === 4);
  const textCh = channels.filter(c => c.type === 0);

  document.getElementById('settCategory').innerHTML = '<option value="">None</option>' + cats.map(c =>
    `<option value="${c.id}" ${c.id === guild.ticket_category_id ? 'selected' : ''}>${c.name}</option>`).join('');
  document.getElementById('settLogsChannel').innerHTML = '<option value="">None</option>' + textCh.map(c =>
    `<option value="${c.id}" ${c.id === guild.logs_channel_id ? 'selected' : ''}>#${c.name}</option>`).join('');

  document.getElementById('staffRolesContainer').innerHTML = roles.map(r => `
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:4px;font-size:13px;cursor:pointer">
      <input type="checkbox" class="staff-role-cb" value="${r.id}" ${(guild.staff_role_ids || []).includes(r.id) ? 'checked' : ''}>
      ${r.name}
    </label>
  `).join('');
}

async function saveSettings() {
  const staffRoles = Array.from(document.querySelectorAll('.staff-role-cb:checked')).map(cb => cb.value);
  const reminderDays = document.getElementById('settReminderDays').value.split(',').map(d => parseInt(d.trim())).filter(d => !isNaN(d));
  const data = {
    staffRoleIds: staffRoles.length > 0 ? `{${staffRoles.join(',')}}` : '{}',
    reminderDays: reminderDays.length > 0 ? `{${reminderDays.join(',')}}` : '{3,2,1}',
    ticketCategoryId: document.getElementById('settCategory').value || null,
    logsChannelId: document.getElementById('settLogsChannel').value || null
  };
  await api('/api/guild', { method: 'PUT', body: data });
  toast('Settings saved!');
}

async function loadLogs() {
  const logs = await api('/api/logs');
  document.getElementById('logsBody').innerHTML = (logs || []).map(l => `
    <tr>
      <td>${l.action}</td>
      <td>${l.actor_id || '-'}</td>
      <td>${l.target_id || '-'}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis">${l.details ? JSON.stringify(l.details) : '-'}</td>
      <td>${fmtDate(l.created_at)}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="empty-state">No logs</td></tr>';
}

init();
