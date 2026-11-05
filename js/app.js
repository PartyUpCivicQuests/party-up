// Party Up app shell: routes, data loading, and every button's behavior.
import { getApi } from './api.js';
import { esc, icon, D20, fmtLeft, safeUrl, downloadText, ymd } from './util.js';
import { CLASSES } from './content.js';
import { t, tx, qtx, setLang, getLang } from './i18n.js';
import { viewJoin, viewQuests, viewParty, viewSheet, inviteLink, snoozeNudge } from './views-member.js';
import { viewSchedule, viewCompose, viewLibrary, viewCrew, blankDraft, draftFromQuest, draftFromTemplate, readDraft, questRowFromDraft, validateDraft, renderPreview } from './views-gm.js';
import { viewReports, reportCsv } from './reports.js';

const MEMBER = ['quests', 'party', 'sheet'];
const GM = ['gm-schedule', 'gm-new', 'gm-library', 'gm-reports', 'gm-crew'];
const TICKS = 'partyup-ticks';

const S = {
  api: null, me: null, account: null, quests: [], done: {}, ticked: {}, open: {}, speaking: null,
  buddy: null, board: [], turnout: [], loaded: {}, busy: false,
  gm: { week0: null, quests: [], templates: [], archive: [], guilds: [], settings: null, crew: [], invites: [], report: null, range: 84, draft: null, editing: null }
};
try { S.ticked = JSON.parse(localStorage.getItem(TICKS) || '{}'); } catch { S.ticked = {}; }
const saveTicks = () => { try { localStorage.setItem(TICKS, JSON.stringify(S.ticked)); } catch { /* ignore */ } };

const $ = id => document.getElementById(id);
const isStaff = () => S.me && (S.me.role === 'captain' || S.me.role === 'guildmaster');
function route() { const h = location.hash.replace('#', ''); return MEMBER.includes(h) || GM.includes(h) ? h : 'quests'; }

let toastTimer;
function toast(msg, ms = 2800) { const el = $('toast'); el.textContent = msg; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), ms); }
async function copyText(text, ok) {
  try { await navigator.clipboard.writeText(text); toast(ok); } catch { toast(`${t('shareFail')} ${text}`, 8000); }
}
async function share(data, fallback) {
  if (navigator.share) { try { await navigator.share(data); return true; } catch (e) { if (e && e.name === 'AbortError') return false; } }
  await copyText(fallback, t('shareCopied')); return true;
}

// ---------- shell ----------
function header(r) {
  const gm = r.startsWith('gm-');
  const tabs = gm
    ? [['gm-schedule', 'Schedule', 'cal'], ['gm-new', 'New quest', 'plus'], ['gm-library', 'Library', 'book'], ['gm-reports', 'Reports', 'chart'], ['gm-crew', 'Crew', 'crew']]
    : [['quests', t('tabQuests'), 'quests'], ['party', t('tabParty'), 'party'], ['sheet', t('tabSheet'), 'sheet']];
  const nav = S.me ? `<nav class="tabs" aria-label="Sections">${tabs.map(([h, l, i]) => `<a href="#${h}"${r === h ? ' aria-current="page"' : ''}>${icon(i)}<span>${esc(l)}</span></a>`).join('')}</nav>` : '';
  const mode = isStaff() ? `<div class="mode" role="group" aria-label="Mode"><button type="button" data-act="mode" data-m="play" aria-pressed="${!gm}">${esc(t('modePlay'))}</button><button type="button" data-act="mode" data-m="lead" aria-pressed="${gm}">${esc(t('modeLead'))}</button></div>` : '';
  $('top').innerHTML = `<div class="top-in"><a class="brand" href="#quests" aria-label="Party Up home">${D20}<span>Party Up</span></a>${nav}${mode}</div>`;
  $('banner').hidden = !(S.api && S.api.mode === 'demo');
  $('banner').textContent = t('demoBanner');
  document.body.classList.toggle('no-tabs', !S.me);
}
function paint() {
  const r = route(), app = $('app');
  header(r);
  app.className = r.startsWith('gm-') ? 'wide' : '';
  if (!S.me) { app.innerHTML = viewJoin(S); return; }
  const v = { quests: viewQuests, party: viewParty, sheet: viewSheet, 'gm-schedule': viewSchedule, 'gm-new': viewCompose, 'gm-library': viewLibrary, 'gm-reports': viewReports, 'gm-crew': viewCrew }[r];
  app.innerHTML = v(S);
  if (r === 'party') drawQR();
  if (r === 'gm-new') renderPreview(S);
}
function drawQR() {
  const el = $('qr'); if (!el) return;
  if (typeof window.QRCode !== 'function' || !S.me.invite_code) { el.hidden = true; return; }
  try { new window.QRCode(el, { text: inviteLink(S), width: 112, height: 112, colorDark: '#1C2452', colorLight: '#FFFFFF' }); } catch { el.hidden = true; }
}

// ---------- data ----------
async function loadMember(r) {
  const [me, quests, done] = await Promise.all([S.api.me(), S.api.memberQuests(), S.api.myCompletions()]);
  S.me = me; S.quests = quests || [];
  const fresh = {};
  for (const id of done || []) { const q = S.quests.find(x => x.id === id); fresh[id] = S.done[id] != null ? S.done[id] : (q ? q.xp : 0); }
  S.done = fresh;
  if (me && me.lang && me.lang !== getLang()) setLang(me.lang);
  if (r === 'party') [S.board, S.turnout, S.buddy] = await Promise.all([S.api.board(), S.api.turnout(), S.api.buddy()]);
  if (r === 'sheet' || r === 'quests') S.account = await S.api.account();
}
async function loadReport() {
  const [rows, weeks] = await Promise.all([S.api.reportQuests(S.gm.range), S.api.reportWeeks(Math.ceil(S.gm.range / 7))]);
  S.gm.report = { rows: rows || [], weeks: weeks || [] };
}
async function loadGm(r) {
  if (!S.gm.guilds.length) S.gm.guilds = await S.api.guilds();
  if (!S.gm.week0) S.gm.week0 = await S.api.currentWeek();
  if (r === 'gm-schedule') [S.gm.quests, S.gm.templates, S.gm.settings] = await Promise.all([S.api.gmQuests(), S.api.templates(), S.api.settings()]);
  if (r === 'gm-new' && !S.gm.templates.length) S.gm.templates = await S.api.templates();
  if (r === 'gm-library') { [S.gm.templates, S.gm.archive] = await Promise.all([S.api.templates(), S.api.archive()]); await loadReport(); }
  if (r === 'gm-reports') { S.gm.templates = await S.api.templates(); await loadReport(); }
  if (r === 'gm-crew') [S.gm.crew, S.gm.invites, S.gm.settings] = await Promise.all([S.api.crew(), S.api.invites(), S.api.settings()]);
}
let lastRoute = null;
async function go() {
  let r = route();
  if (r.startsWith('gm-') && !isStaff()) { location.hash = 'quests'; return; }
  if (!S.me) { paint(); return; }
  if (!S.loaded[r]) { header(r); $('app').className = r.startsWith('gm-') ? 'wide' : ''; $('app').innerHTML = `<p class="note" style="margin-top:24px">${esc(t('loading'))}</p>`; }
  try {
    if (r.startsWith('gm-')) await loadGm(r); else await loadMember(r);
    S.loaded[r] = true;
    if (route() !== r) return;   // user moved on while loading
    paint();
    if (lastRoute !== r) { window.scrollTo(0, 0); lastRoute = r; }
  } catch (e) {
    $('app').innerHTML = `<fieldset class="box"><legend>${esc(t('errorBox'))}</legend><p>${esc(e.message || String(e))}</p><button type="button" class="btn ghost sm" data-act="retry">${esc(t('retry'))}</button></fieldset>`;
  }
}

// ---------- the roll ----------
let lastFocus = null;
function showRoll(res) {
  lastFocus = document.activeElement;
  const box = $('roll'), d20 = $('d20'), n = $('roll-n');
  $('roll-xp').textContent = `+${res.gain} XP`;
  $('roll-sub').textContent = t('toClass', tx((CLASSES[res.cls] || CLASSES.paladin).name));
  $('roll-bonus').textContent = '';
  $('roll-close').textContent = t('back');
  box.hidden = false;
  const finish = () => { n.textContent = res.roll; $('roll-bonus').textContent = res.roll === 20 ? t('nat20') : ''; };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
  else {
    d20.classList.remove('spin'); void d20.getBoundingClientRect(); d20.classList.add('spin');
    let k = 0; const iv = setInterval(() => { n.textContent = 1 + Math.floor(Math.random() * 20); if (++k > 11) { clearInterval(iv); finish(); } }, 75);
  }
  $('roll-close').focus();
}
function hideRoll() { $('roll').hidden = true; if (lastFocus && document.contains(lastFocus)) lastFocus.focus(); }

// ---------- actions ----------
const findQuest = id => S.quests.find(q => q.id === id) || S.gm.quests.find(q => q.id === id) || (S.gm.archive || []).find(q => q.id === id);
function tick(id, i) { const a = S.ticked[id] || (S.ticked[id] = []); if (!a.includes(i)) a.push(i); saveTicks(); }
async function complete(id, fn) {
  if (S.busy) return; S.busy = true;
  try {
    const res = await fn();
    if (id) S.done[id] = res.gain;
    S.me = await S.api.me();
    paint(); showRoll(res);
  } catch (e) { toast(e.message); } finally { S.busy = false; }
}
function speak(id, text) {
  if (!('speechSynthesis' in window)) { toast(t('readIt')); return; }
  speechSynthesis.cancel();
  if (S.speaking === id) { S.speaking = null; paint(); return; }
  const u = new SpeechSynthesisUtterance(text); u.lang = getLang() === 'es' ? 'es-US' : 'en-US';
  u.onend = u.onerror = () => { if (S.speaking === id) { S.speaking = null; paint(); } };
  S.speaking = id; paint(); speechSynthesis.speak(u);
}
async function gmUpdate(id, patch, msg) {
  try { await S.api.updateQuest(id, patch); await loadGm(route()); paint(); if (msg) toast(msg); } catch (e) { toast(e.message); }
}
async function saveQuest(firing) {
  const form = $('compose'); const d = readDraft(form);
  d.template_id = S.gm.draft && S.gm.draft.template_id;
  if (firing) d.shelf = 'rapid';
  const err = validateDraft(d, firing); $('f-err').textContent = err; if (err) return;
  const row = questRowFromDraft(d, S.gm.week0);
  if (firing) { const now = Date.now(); Object.assign(row, { starts_at: new Date(now).toISOString(), ends_at: new Date(now + (parseInt(d.length, 10) || 60) * 6e4).toISOString(), stale_at: new Date(now + 36e5).toISOString(), confirmed: true }); }
  if (S.gm.editing) row.replaces = S.gm.editing;
  try {
    const saved = await S.api.saveQuest(row);
    if (S.gm.editing) await S.api.updateQuest(S.gm.editing, { shelved: true });
    if (d.to_library && d.shelf === 'evergreen') {
      const tp = await S.api.saveTemplate({ title: row.title, flavor: row.flavor, kind: row.kind, platform: row.platform, steps: row.steps, caption: row.caption, note: row.note, link: row.link, source: row.source });
      await S.api.updateQuest(saved.id, { template_id: tp.id });
    }
    S.gm.draft = null; S.gm.editing = null;
    toast(row.claim ? 'Saved. It waits for a second organizer’s sign-off.' : firing ? 'Fired. It’s live and will post to Discord within a minute.' : 'Added to the schedule.');
    location.hash = 'gm-schedule';
  } catch (e) { $('f-err').textContent = e.message; }
}
function startDraft(d, editing = null) { S.gm.draft = d; S.gm.editing = editing; if (location.hash !== '#gm-new') location.hash = 'gm-new'; else paint(); }

document.addEventListener('click', async e => {
  if (e.target.id === 'roll') { hideRoll(); return; }
  const el = e.target.closest('[data-act]'); if (!el) return;
  const act = el.dataset.act, id = el.dataset.q, i = el.dataset.i != null ? parseInt(el.dataset.i, 10) : null;
  const q = id ? findQuest(id) : null;
  switch (act) {
    case 'retry': go(); break;
    case 'mode': location.hash = el.dataset.m === 'lead' ? 'gm-schedule' : 'quests'; break;
    case 'closeroll': hideRoll(); break;
    case 'done': complete(id, () => S.api.complete(id)); break;
    case 'vow': complete(null, () => S.api.keepVow()); break;
    case 'open': if (q && i != null) { tick(id, i); S.api.opened(id); setTimeout(paint, 80); } break;
    case 'sendchat': if (q) {
      const text = qtx(q, 'caption') || qtx(q, 'title'), url = safeUrl(q.link);
      if (await share({ title: qtx(q, 'title'), text, url: url || undefined }, text + (url ? ' ' + url : ''))) { tick(id, i); S.api.opened(id); paint(); }
    } break;
    case 'invite': {
      const link = inviteLink(S);
      if (await share({ title: 'Party Up', text: t('inviteText'), url: link }, `${t('inviteText')} ${link}`) && q && i != null) { tick(id, i); paint(); }
    } break;
    case 'copylink': copyText(inviteLink(S), t('linkCopied')); break;
    case 'later': snoozeNudge(); paint(); break;
    case 'copy': if (q) copyText(qtx(q, 'caption'), t('copied')); break;
    case 'voice': if (q) speak(id, qtx(q, 'note')); break;
    case 'unpair': try { await S.api.unlinkBuddy(); await go(); } catch (err) { toast(err.message); } break;
    case 'signout': {
      const acct = S.account || {};
      if (S.api.mode === 'live' && !acct.email && !confirm(t('signOutWarn'))) break;
      await S.api.signOut(); location.hash = ''; location.reload(); break;
    }
    // organizers
    case 'newquest': S.gm.draft = null; S.gm.editing = null; break;
    case 'confirm': gmUpdate(id, { confirmed: true }, 'Confirmed. It goes out as planned.'); break;
    case 'signoff': gmUpdate(id, { signed_by: S.me.id }, 'Signed off.'); break;
    case 'shelve': gmUpdate(id, { shelved: true }, 'Shelved. It stays in the archive.'); break;
    case 'unshelve': gmUpdate(id, { shelved: false }); break;
    case 'secondcall': try { await S.api.secondCall(id); await loadGm(route()); paint(); toast('Second call queued. It reposts to Discord within a minute.'); } catch (err) { toast(err.message); } break;
    case 'edit': if (q) startDraft(draftFromQuest(S, q), q.id); break;
    case 'canceledit': S.gm.draft = null; S.gm.editing = null; location.hash = 'gm-schedule'; break;
    case 'firenow': saveQuest(true); break;
    case 'previewvoice': { const n = new FormData($('compose')).get('note'); if (!n) { toast('Write the note first.'); break; } if ('speechSynthesis' in window) { speechSynthesis.cancel(); speechSynthesis.speak(new SpeechSynthesisUtterance(String(n))); } break; }
    case 'copymirror': { const d = S.gm.draft || {}; copyText(`New quest: ${d.title || 'Untitled'}${d.flavor ? '\n' + d.flavor : ''}\n${location.origin + location.pathname}`, 'Copied.'); break; }
    case 'usetemplate': { const tp = S.gm.templates.find(x => x.id === el.dataset.t); if (tp) { const d = draftFromTemplate(S, tp); if (el.dataset.rewrite) { d.to_library = true; d.template_id = null; } startDraft(d); } break; }
    case 'runagain': {
      let src = findQuest(id);
      if (!src) { S.gm.archive = await S.api.archive(); src = S.gm.archive.find(x => x.id === id); }
      if (!src) { toast('Couldn’t load that quest.'); break; }
      const d = draftFromQuest(S, src); d.template_id = src.template_id || null;
      if (d.shelf !== 'evergreen') { const b = blankDraft(S); d.when = b.when; d.stale = b.stale; }
      startDraft(d); break;
    }
    case 'retire': case 'restore': try { await S.api.updateTemplate(el.dataset.t, { active: act === 'restore' }); S.gm.templates = await S.api.templates(); paint(); } catch (err) { toast(err.message); } break;
    case 'range': S.gm.range = parseInt(el.dataset.days, 10); S.gm.report = null; paint(); await loadReport(); paint(); break;
    case 'exportcsv': downloadText(`party-up-quests-${ymd(Date.now())}.csv`, reportCsv(S)); break;
    case 'copyinvite': copyText(`${location.origin + location.pathname}?invite=${el.dataset.code}`, 'Invite link copied.'); break;
  }
});

document.addEventListener('change', async e => {
  const el = e.target;
  if (el.dataset && el.dataset.act === 'step') {
    const id = el.dataset.q, i = parseInt(el.dataset.i, 10), a = S.ticked[id] || (S.ticked[id] = []);
    const at = a.indexOf(i); if (el.checked && at < 0) a.push(i); if (!el.checked && at > -1) a.splice(at, 1); saveTicks(); return;
  }
  if (el.id === 'join-lang') { setLang(el.value); paint(); $('join-lang').focus(); return; }
  if (el.id === 'set-lang' || el.id === 'set-quiet') {
    const patch = { handle: S.me.handle, lang: el.id === 'set-lang' ? el.value : S.me.lang, max_per_week: S.me.max_per_week, quiet_hours: el.id === 'set-quiet' ? el.checked : S.me.quiet_hours };
    try { S.me = await S.api.updateMe(patch); setLang(S.me.lang); paint(); toast(t('saved')); } catch (err) { toast(err.message); }
    return;
  }
  if (el.closest && el.closest('#compose')) renderPreview(S);
});
let budgetTimer;
document.addEventListener('input', e => {
  const el = e.target;
  if (el.id === 'set-budget') {
    $('set-budget-out').textContent = el.value;
    clearTimeout(budgetTimer);
    budgetTimer = setTimeout(async () => { try { S.me = await S.api.updateMe({ handle: S.me.handle, lang: S.me.lang, max_per_week: parseInt(el.value, 10), quiet_hours: S.me.quiet_hours }); } catch (err) { toast(err.message); } }, 500);
    return;
  }
  if (el.id === 'minpw') { $('minpw-out').textContent = el.value; return; }
  if (el.closest && el.closest('#compose')) renderPreview(S);
});
document.addEventListener('submit', async e => {
  const f = e.target; e.preventDefault();
  const fd = new FormData(f), v = k => String(fd.get(k) || '').trim();
  try {
    if (f.id === 'join-form') {
      if (!v('code') || !v('handle')) { $('join-err').textContent = t('pickNameNote'); return; }
      S.me = await S.api.join(v('code'), v('handle'), v('lang') || getLang());
      setLang(S.me.lang); history.replaceState(null, '', location.pathname + '#quests'); go();
    }
    if (f.id === 'signin-form') { await S.api.signInEmail(v('email')); toast(t('emailSent'), 5000); }
    if (f.id === 'pair-form') { const who = await S.api.linkBuddy(v('code')); toast(t('paired', who)); go(); }
    if (f.id === 'me-form') { S.me = await S.api.updateMe({ handle: v('handle'), lang: S.me.lang, max_per_week: S.me.max_per_week, quiet_hours: S.me.quiet_hours }); paint(); toast(t('saved')); }
    if (f.id === 'nudge-form') { if (!v('email')) return; await S.api.linkEmail(v('email')); S.account = await S.api.account(); paint(); toast(t('emailSent'), 5000); }
    if (f.id === 'email-form') { await S.api.linkEmail(v('email')); S.account = await S.api.account(); toast(t('emailSent'), 5000); paint(); }
    if (f.id === 'compose') saveQuest(false);
    if (f.classList.contains('corr-form')) { await S.api.updateQuest(f.dataset.q, { correction: v('correction') }); S.gm.archive = await S.api.archive(); paint(); toast('Correction added. Members see it on the quest.'); }
    if (f.id === 'invite-form') { const code = await S.api.createInvite(v('guild_id') || null, parseInt(v('max'), 10) || 50, v('note')); S.gm.invites = await S.api.invites(); paint(); copyText(`${location.origin + location.pathname}?invite=${code}`, `Made ${code}. Link copied.`); }
    if (f.id === 'role-form') { await S.api.setRole(v('handle'), v('role')); S.gm.crew = await S.api.crew(); paint(); toast('Role saved.'); }
    if (f.id === 'settings-form') { await S.api.saveSettings({ autopilot: !!fd.get('autopilot'), min_per_week: parseInt(v('min_per_week'), 10), app_url: v('app_url'), discord_url: v('discord_url') }); S.gm.settings = await S.api.settings(); toast('Settings saved.'); }
    if (f.id === 'guild-form') { if (!v('name')) return; await S.api.addGuild(v('name'), v('parent_id')); S.gm.guilds = await S.api.guilds(); paint(); toast('Guild added.'); }
  } catch (err) {
    const box = f.querySelector('.err');
    if (box) box.textContent = err.message; else toast(err.message);
  }
});
document.addEventListener('toggle', e => { const d = e.target; if (d.matches && d.matches('details.row')) S.open[d.dataset.row] = d.open; }, true);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('roll').hidden) hideRoll(); });
window.addEventListener('hashchange', go);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && S.me && !document.activeElement.matches('input,textarea,select')) go(); });

// Live clocks; refresh when a wave starts or ends.
setInterval(() => {
  const now = Date.now(); let crossed = false;
  document.querySelectorAll('[data-ends],[data-starts]').forEach(el => {
    const target = +(el.dataset.ends || el.dataset.starts), left = target - now;
    el.textContent = fmtLeft(left);
    if (left <= 0 && left > -1500) crossed = true;
  });
  if (crossed && !document.activeElement.matches('input,textarea,select')) go();
}, 1000);

// ---------- boot ----------
(async function boot() {
  try {
    S.api = await getApi();
    const me = await S.api.init();
    S.me = me;
    if (me && me.lang) setLang(me.lang);
    else { const nav = (navigator.language || 'en').slice(0, 2); setLang(nav === 'es' ? 'es' : 'en'); }
    if (location.hash.includes('access_token') || location.hash.includes('error=')) history.replaceState(null, '', location.pathname + location.search + '#quests');
    await go();
  } catch (e) {
    $('app').innerHTML = `<fieldset class="box"><legend>Party Up couldn’t start</legend><p>${esc(e.message || String(e))}</p><p class="hint">If you just set up Supabase, check the two values in js/config.js and that you ran all three SQL files.</p></fieldset>`;
  }
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
})();
