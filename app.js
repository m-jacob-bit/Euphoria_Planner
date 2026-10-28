const APP_KEY = 'queenValleyPlanner.v1';

const DEFAULT_STATE = {
  settings: {
    salary: 0,
    raiseDate: '2027-01',
    raisePct: 9,
    rent: 0,
    titheAmount: 8000,
    emergency: 0,
    lifeTarget: 0,
    buffer: 5000,
    reminderDay: 1
  },
  chequeBalance: 0,
  paid: {},
  lastUpdated: null
};

const fmt = new Intl.NumberFormat('en-EG', { maximumFractionDigits: 0 });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric' });
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function loadState() {
  try {
    const raw = localStorage.getItem(APP_KEY);
    if (!raw) return clone(DEFAULT_STATE);
    const parsed = JSON.parse(raw);
    return {
      ...clone(DEFAULT_STATE),
      ...parsed,
      settings: { ...clone(DEFAULT_STATE.settings), ...(parsed.settings || {}) },
      paid: parsed.paid || {}
    };
  } catch {
    return clone(DEFAULT_STATE);
  }
}
let state = loadState();

function saveState() {
  state.lastUpdated = new Date().toISOString();
  localStorage.setItem(APP_KEY, JSON.stringify(state));
}

function money(n) { return `EGP ${fmt.format(Math.round(Number(n || 0)))}`; }
function isoDate(d) { return d.toISOString().slice(0,10); }
function localDate(y,m,d) { return new Date(y, m-1, d, 12, 0, 0); }

function buildPayments() {
  const rows = [];
  let y = 2027, m = 1;
  for (let i = 1; i <= 40; i++) {
    const amount = i === 40 ? 60451 : 60414;
    const due = localDate(y,m,5);
    rows.push({ id:`inst-${i}`, date:due, amount, kind:'Quarterly installment', cheque:true, order:i });
    m += 3;
    if (m > 12) { m -= 12; y += 1; }
  }
  for (let year = 2027; year <= 2031; year++) {
    rows.push({ id:`garage-${year}`, date:localDate(year,10,5), amount:50000, kind:'Garage payment', cheque:false });
  }
  rows.push({ id:'maintenance-2030', date:localDate(2030,4,4), amount:268510, kind:'Maintenance deposit', cheque:false });
  return rows.sort((a,b) => a.date - b.date || a.kind.localeCompare(b.kind));
}
const PAYMENTS = buildPayments();

function isPaid(p) { return Boolean(state.paid[p.id]); }
function activePayments() { return PAYMENTS.filter(p => !isPaid(p)); }

function nextBundle() {
  const active = activePayments();
  if (!active.length) return null;
  const first = active[0];
  const cutoff = new Date(first.date);
  cutoff.setDate(cutoff.getDate() + 1); // bundle Apr 4 + Apr 5, or same-day garage + installment
  const items = active.filter(p => p.date <= cutoff);
  return {
    date: first.date,
    items,
    amount: items.reduce((s,p) => s + p.amount, 0)
  };
}

function recommendedContribution(date = new Date()) {
  const ym = date.getFullYear()*100 + (date.getMonth()+1);
  if (ym >= 202611 && ym <= 202612) return 35000;
  if (ym >= 202701 && ym <= 203003) return 31600;
  if (ym >= 203004 && ym <= 203109) return 24700;
  if (ym >= 203110 && ym <= 203609) return 20500;
  return 0;
}

function salaryFor(date) {
  const s = state.settings;
  const ym = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
  if (ym >= s.raiseDate) return s.salary * (1 + s.raisePct/100);
  return s.salary;
}

// Tithe is a manually entered monthly budget amount.
function titheForSalary() {
  return Math.max(0, Number(state.settings.titheAmount) || 0);
}

function paymentDueInMonth(date) {
  return PAYMENTS.filter(p => !isPaid(p) && p.date.getFullYear() === date.getFullYear() && p.date.getMonth() === date.getMonth());
}

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function daysBetween(a,b) {
  return Math.ceil((b - a) / 86400000);
}

function updateHero() {
  const bundle = nextBundle();
  const banner = document.getElementById('criticalBanner');
  if (!bundle) {
    document.getElementById('nextDueDate').textContent = 'Plan complete';
    document.getElementById('nextDueAmount').textContent = 'EGP 0';
    document.getElementById('nextDueBreakdown').textContent = 'All scheduled obligations are marked paid.';
    document.getElementById('protectedAmount').textContent = 'EGP 0';
    document.getElementById('daysRemaining').textContent = '—';
    banner.className = 'banner hidden';
    return;
  }

  document.getElementById('nextDueDate').textContent = dateFmt.format(bundle.date);
  document.getElementById('nextDueAmount').textContent = money(bundle.amount);
  document.getElementById('nextDueBreakdown').textContent = bundle.items.map(p => `${p.kind}: ${money(p.amount)}`).join(' • ');
  const protectedAmount = bundle.amount + Number(state.settings.buffer || 0);
  document.getElementById('protectedAmount').textContent = money(protectedAmount);
  const days = daysBetween(startOfToday(), bundle.date);
  document.getElementById('daysRemaining').textContent = days >= 0 ? String(days) : `${Math.abs(days)} overdue`;

  const balanceInput = document.getElementById('chequeBalance');
  balanceInput.value = state.chequeBalance || '';
  const status = document.getElementById('fundingStatus');
  const message = document.getElementById('fundingMessage');
  const bal = Number(state.chequeBalance || 0);
  const gap = protectedAmount - bal;

  if (!state.lastUpdated && bal === 0) {
    status.className = 'status-pill neutral';
    status.textContent = 'Enter your balance';
    message.textContent = 'Use CIB’s “Available to Use” figure, not a remembered balance.';
  } else if (gap <= 0) {
    status.className = 'status-pill good';
    status.textContent = 'FUNDED';
    message.textContent = `${money(Math.abs(gap))} above the protected floor. Leave the protected amount untouched until the payment clears.`;
  } else {
    status.className = 'status-pill bad';
    status.textContent = 'SHORTFALL';
    message.textContent = `Add ${money(gap)} to reach the protected floor for the next payment bundle.`;
  }

  banner.className = 'banner hidden';
  if (days < 0) {
    banner.className = 'banner danger';
    banner.textContent = `Payment appears overdue and is not marked paid. Check CIB immediately and confirm whether the cheque/payment cleared.`;
  } else if (days <= 10 && gap > 0) {
    banner.className = 'banner danger';
    banner.textContent = `${days} day${days===1?'':'s'} left and the cheque account is short by ${money(gap)}. Fix this now.`;
  } else if (days <= 10) {
    banner.className = 'banner warning';
    banner.textContent = `${days} day${days===1?'':'s'} until the next payment. The account is funded; do not spend below ${money(protectedAmount)} until it clears.`;
  }
}

function updateMetrics() {
  const now = new Date();
  const salary = salaryFor(now);
  const contribution = recommendedContribution(now);
  const tithe = titheForSalary(salary);
  const life = salary - Number(state.settings.rent) - contribution - Number(state.settings.emergency) - tithe;
  document.getElementById('monthlyTithe').textContent = money(tithe);
  document.getElementById('titheNote').textContent = 'Your manually entered monthly amount. Change it in Settings.';
  document.getElementById('monthlySave').textContent = money(contribution);
  document.getElementById('monthlySaveNote').textContent = contribution ? 'Recommended property contribution for this phase.' : 'No planned contribution for this month.';
  document.getElementById('lifeMoney').textContent = money(life);
  document.getElementById('salaryUsed').textContent = money(salary);
  const raiseDateLabel = state.settings.raiseDate ? new Date(`${state.settings.raiseDate}-01T12:00:00`) : null;
  document.getElementById('salaryNote').textContent = now < raiseDateLabel
    ? `${state.settings.raisePct}% raise assumed from ${monthFmt.format(raiseDateLabel)}.`
    : `Includes the ${state.settings.raisePct}% raise assumption.`;
}

function monthIterator(start, count) {
  const out = [];
  let d = new Date(start.getFullYear(), start.getMonth(), 1, 12);
  for (let i=0; i<count; i++) {
    out.push(new Date(d));
    d.setMonth(d.getMonth()+1);
  }
  return out;
}

function renderMonthlyTable() {
  const tbody = document.getElementById('monthlyTableBody');
  tbody.innerHTML = '';
  for (const d of monthIterator(new Date(), 12)) {
    const salary = salaryFor(d);
    const rent = Number(state.settings.rent || 0);
    const apt = recommendedContribution(d);
    const emergency = Number(state.settings.emergency || 0);
    const tithe = titheForSalary(salary);
    const life = salary - rent - apt - emergency - tithe;
    const dues = paymentDueInMonth(d);
    const dueText = dues.length ? dues.map(p => `${p.kind} ${money(p.amount)}`).join(' + ') : '—';
    const tr = document.createElement('tr');
    const cls = life < 0 ? 'life-bad' : life < Number(state.settings.lifeTarget) ? 'life-tight' : 'life-good';
    tr.innerHTML = `
      <td><strong>${monthFmt.format(d)}</strong></td>
      <td>${money(salary)}</td>
      <td>${money(rent)}</td>
      <td>${money(apt)}</td>
      <td>${money(emergency)}</td>
      <td>${money(tithe)}</td>
      <td class="${cls}">${money(life)}</td>
      <td>${dueText}</td>`;
    tbody.appendChild(tr);
  }
}

function renderPayments() {
  const list = document.getElementById('paymentList');
  list.innerHTML = '';
  const today = startOfToday();
  for (const p of PAYMENTS) {
    const paid = isPaid(p);
    const row = document.createElement('div');
    row.className = `payment-row ${paid ? 'paid' : ''} ${!paid && p.date < today ? 'overdue' : ''}`;
    row.innerHTML = `
      <div><strong>${dateFmt.format(p.date)}</strong></div>
      <div><div class="payment-kind">${p.kind}</div><div class="subtle">${p.cheque ? `Signed cheque #${p.order}` : 'Property obligation'}</div></div>
      <div class="payment-amount">${money(p.amount)}</div>
      <button class="button ${paid ? 'secondary' : 'primary'}" data-payment-id="${p.id}">${paid ? 'Undo paid' : 'Mark paid'}</button>`;
    list.appendChild(row);
  }
  list.querySelectorAll('[data-payment-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.paymentId;
      if (state.paid[id]) delete state.paid[id]; else state.paid[id] = new Date().toISOString();
      saveState();
      renderAll();
    });
  });
}

function fillSettingsForm() {
  const s = state.settings;
  document.getElementById('salaryInput').value = s.salary;
  document.getElementById('raiseDateInput').value = s.raiseDate;
  document.getElementById('raisePctInput').value = s.raisePct;
  document.getElementById('rentInput').value = s.rent;
  document.getElementById('titheAmountInput').value = s.titheAmount;
  document.getElementById('emergencyInput').value = s.emergency;
  document.getElementById('lifeTargetInput').value = s.lifeTarget;
  document.getElementById('bufferInput').value = s.buffer;
  document.getElementById('reminderDayInput').value = s.reminderDay;
}

function saveSettingsFromForm() {
  state.settings = {
    salary: Number(document.getElementById('salaryInput').value || 0),
    raiseDate: document.getElementById('raiseDateInput').value || '2027-01',
    raisePct: Number(document.getElementById('raisePctInput').value || 0),
    rent: Number(document.getElementById('rentInput').value || 0),
    titheAmount: Math.max(0, Number(document.getElementById('titheAmountInput').value) || 0),
    emergency: Number(document.getElementById('emergencyInput').value || 0),
    lifeTarget: Number(document.getElementById('lifeTargetInput').value || 0),
    buffer: Number(document.getElementById('bufferInput').value || 0),
    reminderDay: Math.min(28, Math.max(1, Number(document.getElementById('reminderDayInput').value || 1)))
  };
  saveState();
  renderAll();
}

function download(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function icsDate(d, hour=9, minute=0) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  const h = String(hour).padStart(2,'0');
  const min = String(minute).padStart(2,'0');
  return `${y}${m}${day}T${h}${min}00`;
}
function icsEscape(s) { return String(s).replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;'); }

function exportCalendar() {
  const lines = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Queen Valley Planner//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:Queen Valley Apartment'];

  // Monthly saving reminders through Sep 2036.
  let d = new Date(2026,10,Math.min(28,state.settings.reminderDay),9,0,0);
  const end = new Date(2036,8,28,9,0,0);
  while (d <= end) {
    const target = recommendedContribution(d);
    if (target > 0) {
      lines.push('BEGIN:VEVENT',
        `UID:qv-save-${d.getFullYear()}-${d.getMonth()+1}@planner`,
        `DTSTART;TZID=Africa/Cairo:${icsDate(d,9,0)}`,
        `DTEND;TZID=Africa/Cairo:${icsDate(new Date(d.getTime()+30*60000),9,30)}`,
        `SUMMARY:${icsEscape(`Queen Valley: save ${money(target)}`)}`,
        `DESCRIPTION:${icsEscape('Move the planned apartment saving into the protected Queen Valley/cheque-clearing setup. Treat it as already spent.')}`,
        'BEGIN:VALARM','TRIGGER:-PT30M','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(`Save ${money(target)} for Queen Valley`)}`,'END:VALARM',
        'END:VEVENT');
    }
    d = new Date(d.getFullYear(), d.getMonth()+1, Math.min(28,state.settings.reminderDay), 9,0,0);
  }

  // Payment events with 10-day, 3-day and 1-day alarms.
  for (const p of PAYMENTS) {
    const title = `${p.kind}: ${money(p.amount)}`;
    lines.push('BEGIN:VEVENT',
      `UID:qv-${p.id}@planner`,
      `DTSTART;TZID=Africa/Cairo:${icsDate(p.date,9,0)}`,
      `DTEND;TZID=Africa/Cairo:${icsDate(new Date(p.date.getTime()+30*60000),9,30)}`,
      `SUMMARY:${icsEscape(title)}`,
      `DESCRIPTION:${icsEscape('Ensure the required amount remains in the CIB cheque-clearing account until the cheque/payment has actually cleared.')}`,
      'BEGIN:VALARM','TRIGGER:-P10D','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(`10-day funding check: ${title}`)}`,'END:VALARM',
      'BEGIN:VALARM','TRIGGER:-P3D','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(`Final funding check: ${title}`)}`,'END:VALARM',
      'BEGIN:VALARM','TRIGGER:-P1D','ACTION:DISPLAY',`DESCRIPTION:${icsEscape(`Do not spend below the protected amount: ${title}`)}`,'END:VALARM',
      'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  download('queen-valley-calendar.ics', lines.join('\r\n'), 'text/calendar;charset=utf-8');
}

function exportData() {
  download(`queen-valley-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(state,null,2), 'application/json');
}

async function importData(file) {
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    if (!parsed || typeof parsed !== 'object' || !parsed.settings) throw new Error('Invalid backup');
    state = { ...clone(DEFAULT_STATE), ...parsed, settings: { ...clone(DEFAULT_STATE.settings), ...(parsed.settings || {}) }, paid: parsed.paid || {} };
    saveState();
    renderAll();
    alert('Backup restored.');
  } catch (e) {
    alert('Could not restore that backup file.');
  }
}

function renderAll() {
  updateHero();
  updateMetrics();
  renderMonthlyTable();
  renderPayments();
}

// Events
const settingsDialog = document.getElementById('settingsDialog');
document.getElementById('settingsBtn').addEventListener('click', () => { fillSettingsForm(); settingsDialog.showModal(); });
document.getElementById('saveSettingsBtn').addEventListener('click', (e) => { e.preventDefault(); saveSettingsFromForm(); settingsDialog.close(); });
document.getElementById('resetBtn').addEventListener('click', () => {
  if (confirm('Reset all local Queen Valley planner data on this device?')) {
    state = clone(DEFAULT_STATE); saveState(); fillSettingsForm(); renderAll(); settingsDialog.close();
  }
});
document.getElementById('markFundedBtn').addEventListener('click', () => {
  state.chequeBalance = Number(document.getElementById('chequeBalance').value || 0);
  saveState(); renderAll();
});
document.getElementById('chequeBalance').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('markFundedBtn').click(); });
document.getElementById('exportCalendarBtn').addEventListener('click', exportCalendar);
document.getElementById('exportDataBtn').addEventListener('click', exportData);
document.getElementById('importDataInput').addEventListener('change', e => { if (e.target.files?.[0]) importData(e.target.files[0]); e.target.value=''; });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

renderAll();
