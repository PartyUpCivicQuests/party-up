// Small helpers shared across the app. No dependencies.

export const MIN = 60e3, HOUR = 36e5, DAY = 864e5;

export function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function safeUrl(u) {
  try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; }
}

export function shortUrl(u) {
  try { const x = new URL(u); return x.hostname.replace(/^www\./, '') + (x.pathname.length > 1 ? x.pathname : ''); } catch { return u || ''; }
}

export function ts(v) { return v == null ? null : (typeof v === 'number' ? v : new Date(v).getTime()); }

export function fmtLeft(ms) {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// "2026-11-02" -> local midnight timestamp
export function dayTs(s) { const [y, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d).getTime(); }
export function addDays(t, n) { const d = new Date(t); d.setDate(d.getDate() + n); return d.getTime(); }
export function ymd(t) { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }
export function localWeekStart(t = Date.now()) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); }
export function toLocalInput(t) { const d = new Date(t), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; }
export function atLocal(dayOffset, h, m = 0) { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + dayOffset); d.setHours(h, m, 0, 0); return d.getTime(); }

export function fmtWhen(t, locale = 'en-US') { return new Intl.DateTimeFormat(locale, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(t); }
export function fmtDay(t, locale = 'en-US') { return new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }).format(t); }
export function fmtDate(t, locale = 'en-US') { return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' }).format(t); }
export function fmtTime(t, locale = 'en-US') { return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' }).format(t); }

export function pct(n, d) { return d > 0 ? Math.round(100 * n / d) : 0; }
export function avg(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }

export function downloadText(filename, text, type = 'text/csv') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

export function csv(rows) {
  const cell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  return rows.map(r => r.map(cell).join(',')).join('\n');
}

const P = {
  quests: '<path d="M5 21V4"/><path d="M5 4h11l-2.2 4 2.2 4H5"/>',
  party: '<circle cx="9" cy="8" r="3.4"/><path d="M2.6 20c.6-3.6 3.2-5.6 6.4-5.6s5.8 2 6.4 5.6"/><path d="M15.8 4.7a3.4 3.4 0 0 1 0 6.6"/><path d="M18 14.9c2 .8 3.1 2.5 3.4 5.1"/>',
  sheet: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h3.5"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  book: '<path d="M5 19.5V5.5A2.5 2.5 0 0 1 7.5 3H19v14H7.5A2.5 2.5 0 0 0 5 19.5 2.5 2.5 0 0 0 7.5 22H19"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-5M12 16V8M16 16v-3"/>',
  crew: '<circle cx="12" cy="8" r="3.4"/><path d="M5 20c.7-3.7 3.5-5.6 7-5.6s6.3 1.9 7 5.6"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  share: '<circle cx="18" cy="5.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="18.5" r="2.5"/><path d="M8.3 10.8l7.4-4M8.3 13.2l7.4 4"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.5-3.2 8.2-7.5 9.5-4.3-1.3-7.5-5-7.5-9.5V6z"/>',
  bell: '<path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  down: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>',
  megaphone: '<path d="M4 10v4h3l7 4V6L7 10z"/><path d="M17.5 9a4 4 0 0 1 0 6"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  repeat: '<path d="M17 3l3 3-3 3"/><path d="M4 11V9a3 3 0 0 1 3-3h13"/><path d="M7 21l-3-3 3-3"/><path d="M20 13v2a3 3 0 0 1-3 3H4"/>'
};
export function icon(name, cls = '') {
  return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${P[name] || ''}</svg>`;
}
export const D20 = '<svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="50,4 90,27 90,73 50,96 10,73 10,27" fill="#F0B429" stroke="currentColor" stroke-width="6" stroke-linejoin="round"/><polygon points="50,24 76,67 24,67" fill="#FFD66B" stroke="currentColor" stroke-width="5" stroke-linejoin="round"/></svg>';
