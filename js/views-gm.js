// Organizer (Guildmaster and captain) screens. English only for now.
import { esc, icon, fmtLeft, fmtDay, fmtTime, fmtDate, ts, dayTs, addDays, toLocalInput, atLocal, HOUR, DAY, safeUrl } from './util.js';
import { CLASSES, KINDS, KIND_ORDER, PLATFORMS, PLATFORM_ORDER, STEP_OPTIONS } from './content.js';
import { questBody } from './ui.js';

const en = o => (o && o.en) || '';
const kindLabel = k => `${KINDS[k].label} (${en(CLASSES[KINDS[k].cls].name)}, ${KINDS[k].xp} XP)`;
const startOf = q => q.shelf === 'evergreen' ? dayTs(q.week_of) : ts(q.starts_at);

export function gmStatus(q, now = Date.now()) {
  if (q.shelved) return 'shelved';
  if (q.claim && !q.signed_by) return 'sign';
  if (q.shelf === 'evergreen') return 'open';
  const s = ts(q.starts_at), e = ts(q.ends_at);
  if (e <= now) return 'past';
  if (!q.confirmed) return s <= now ? 'held' : (s - now < 48 * HOUR ? 'check' : 'pending');
  if (s <= now) return 'live';
  return 'sched';
}
const STATUS = {
  live: '<span class="tag live">Live now</span>', check: '<span class="tag check">Check before it fires</span>',
  pending: '<span class="tag plain">Check due 2 days before</span>', held: '<span class="tag sign">Held: not confirmed in time</span>',
  sign: '<span class="tag sign">Needs a second sign-off</span>', sched: '<span class="tag plain">Confirmed</span>',
  shelved: '<span class="tag plain">Shelved</span>', open: '<span class="tag plain">On the board</span>', past: '<span class="tag plain">Finished</span>'
};
const SHELF = { evergreen: '<span class="tag ever">Evergreen</span>', dated: '<span class="tag dated">Dated</span>', rapid: '<span class="tag rapid">Rapid</span>' };

function btn(act, id, label, cls = '') { return `<button type="button" class="btn ghost sm ${cls}" data-act="${act}" data-q="${esc(id)}">${label}</button>`; }
function actions(S, q, st) {
  if (st === 'shelved') return btn('unshelve', q.id, 'Put back');
  if (st === 'past') return '';
  const out = [];
  if (['check', 'pending', 'held'].includes(st)) out.push(btn('confirm', q.id, 'Still good'));
  if (st === 'sign') out.push(btn('signoff', q.id, 'Sign off as second organizer'));
  if (st === 'live' && !q.second_call_at && !q.second_call_requested) out.push(btn('secondcall', q.id, `${icon('megaphone')}Second call`));
  if (st !== 'live') out.push(btn('edit', q.id, 'Edit'));
  out.push(btn('shelve', q.id, 'Shelve', 'warn'));
  return out.join('');
}
function schedRow(S, q) {
  const st = gmStatus(q);
  const when = q.shelf === 'evergreen' ? 'All week<small>No timer</small>' : `${esc(fmtDay(ts(q.starts_at)))}<small>${esc(fmtTime(ts(q.starts_at)))}</small>`;
  const extra = st === 'live' ? `<span class="tag plain">Ends in <span data-ends="${ts(q.ends_at)}">${fmtLeft(ts(q.ends_at) - Date.now())}</span></span>` : '';
  const called = q.second_call_at || q.second_call_requested ? '<span class="tag plain">Second call sent</span>' : '';
  const guild = (S.gm.guilds.find(g => g.id === q.guild_id) || {}).name;
  return `<li class="${st === 'shelved' ? 'shelved' : ''}"><div class="when">${when}</div><div class="what"><div class="t">${esc(q.title)}</div>
    <div class="tags">${SHELF[q.shelf] || ''}${STATUS[st]}${extra}${called}<span class="tag plain">${esc(en(CLASSES[q.cls].name))}</span>${guild ? `<span class="tag plain">${esc(guild)}</span>` : ''}</div>
    <div class="btn-row">${actions(S, q, st)}</div></div></li>`;
}
function weekBox(S, label, ws) {
  const we = addDays(ws, 7);
  const qs = S.gm.quests.filter(q => { const s = startOf(q); return s >= ws && s < we; });
  const open = qs.filter(q => q.shelf === 'evergreen'), timed = qs.filter(q => q.shelf !== 'evergreen');
  const count = qs.filter(q => !q.shelved).length;
  const set = S.gm.settings || { autopilot: false, min_per_week: 3 };
  const ghosts = [];
  if (set.autopilot && count < set.min_per_week && ws > Date.now() - 7 * DAY) {
    const used = new Set(S.gm.quests.filter(q => q.shelf === 'evergreen').map(q => q.template_id));
    for (const tp of S.gm.templates.filter(x => x.active)) { if (count + ghosts.length >= set.min_per_week) break; if (!used.has(tp.id)) ghosts.push(tp); }
  }
  const budget = S.me.max_per_week || 5, total = count + ghosts.length, pings = timed.filter(q => !q.shelved).length;
  let meter = '';
  for (let k = 0; k < Math.max(budget, total); k++) meter += `<span class="${k < count ? (k >= budget ? 'over' : 'on') : (k < total ? 'ghost' : '')}"></span>`;
  let rows = '';
  if (open.length || ghosts.length) rows += `<p class="subhead">Open all week</p><ul class="sched">${open.map(q => schedRow(S, q)).join('')}${ghosts.map(g => `<li class="ghost"><div class="when">All week<small>Autopilot</small></div><div class="what"><div class="t">${esc(g.title)}</div><div class="tags"><span class="tag ever">Evergreen</span><span class="tag auto">Autopilot adds this Monday</span></div></div></li>`).join('')}</ul>`;
  if (timed.length) rows += `<p class="subhead">Timed waves</p><ul class="sched">${timed.map(q => schedRow(S, q)).join('')}</ul>`;
  if (!rows) rows = '<p class="note">Nothing scheduled.</p>';
  const warn = total > budget ? ` That’s more than your own weekly limit of ${budget}.` : '';
  return `<fieldset class="box"><legend>${esc(label)}, ${esc(fmtDay(ws))} to ${esc(fmtDay(addDays(ws, 6)))}</legend>
    <div class="load"><span class="meter" role="img" aria-label="${total} quests this week">${meter}</span><span class="load-txt">${total} on the board. ${pings} timed ${pings === 1 ? 'wave posts' : 'waves post'} to Discord when ${pings === 1 ? 'it starts' : 'they start'}.${esc(warn)}</span></div>${rows}</fieldset>`;
}
export function viewSchedule(S) {
  const ws = dayTs(S.gm.week0);
  const set = S.gm.settings;
  return `<h1 class="view-title">Schedule</h1><p class="view-sub">Evergreen quests carry the week. Timed waves get a freshness check before they go out.</p>
    <div class="btn-row" style="margin-top:12px"><a class="btn ghost sm" href="#gm-new" data-act="newquest">${icon('plus')}New quest</a></div>
    ${weekBox(S, 'This week', ws)}${weekBox(S, 'Next week', addDays(ws, 7))}
    ${set ? `<p class="note" style="margin-top:14px">Autopilot is ${set.autopilot ? `on: it keeps at least ${set.min_per_week} quests on each week’s board` : 'off'}. Change it under Crew.</p>` : ''}`;
}

// ---------- Composer ----------
// Voice recorder state lives in S.gm.rec: null, { status: 'recording' }, or { status: 'ready', blob, url }.
export function recHtml(S) {
  const r = S.gm.rec, saved = S.gm.draft && S.gm.draft.note_audio;
  const canRecord = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  if (r && r.status === 'recording') {
    return `<div class="btn-row rec-row"><button type="button" class="btn warn" data-act="recstop">${icon('stop')}Stop</button><span class="rec-live"><span class="rec-dot" aria-hidden="true"></span>Recording <span id="rec-time">0:00</span> of 0:30</span></div>`;
  }
  const src = (r && r.url) || saved;
  if (src) {
    return `<audio controls preload="metadata" src="${esc(src)}"></audio><div class="btn-row rec-row">${canRecord ? `<button type="button" class="btn ghost sm" data-act="recstart">${icon('mic')}Record again</button>` : ''}<button type="button" class="btn ghost sm warn" data-act="recremove">Remove</button></div>${r && r.blob ? '<p class="hint">Not saved yet. It uploads when you save the quest.</p>' : ''}`;
  }
  return canRecord
    ? `<div class="btn-row rec-row"><button type="button" class="btn ghost" data-act="recstart">${icon('mic')}Record</button></div><p class="hint">Your browser will ask to use the microphone. Recording stops by itself at 30 seconds.</p>`
    : '<p class="hint">This browser can’t record. Upload a file instead.</p>';
}
export function blankDraft(S) {
  const when = atLocal(1, 18);
  const mn = S.gm.guilds.find(g => g.name === 'Minnesota') || S.gm.guilds[0] || {};
  return { title: '', flavor: '', kind: 'amplify', shelf: 'dated', platform: 'instagram', link: '', steps: ['open', 'watch', 'like', 'save', 'share'],
    caption: '', note: '', note_audio: null, source: '', claim: false, when: toLocalInput(when), length: '60', stale: toLocalInput(when + DAY), guild_id: mn.id || '',
    es_title: '', es_flavor: '', es_caption: '', es_note: '', to_library: false, template_id: null };
}
export function draftFromQuest(S, q) {
  const d = blankDraft(S), es = (q.tr && q.tr.es) || {};
  return Object.assign(d, { title: q.title, flavor: q.flavor || '', kind: q.kind, shelf: q.shelf, platform: q.platform, link: q.link || '',
    steps: (q.steps || []).slice(), caption: q.caption || '', note: q.note || '', note_audio: q.note_audio || null, source: q.source || '', claim: !!q.claim,
    when: toLocalInput(q.starts_at ? ts(q.starts_at) : atLocal(1, 18)),
    length: String(q.starts_at && q.ends_at ? Math.round((ts(q.ends_at) - ts(q.starts_at)) / 6e4) : 60),
    stale: toLocalInput(q.stale_at ? ts(q.stale_at) : (q.starts_at ? ts(q.starts_at) : atLocal(1, 18)) + DAY),
    guild_id: q.guild_id || d.guild_id, es_title: es.title || '', es_flavor: es.flavor || '', es_caption: es.caption || '', es_note: es.note || '',
    template_id: q.template_id || null });
}
export function draftFromTemplate(S, tp) {
  return Object.assign(blankDraft(S), { title: tp.title, flavor: tp.flavor || '', kind: tp.kind, shelf: 'evergreen', platform: tp.platform,
    steps: (tp.steps || []).slice(), caption: tp.caption || '', note: tp.note || '', note_audio: tp.note_audio || null, link: tp.link || '', source: tp.source || '', template_id: tp.id });
}
const sel = (name, opts, val) => `<select name="${name}">${opts.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(val) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
const SHELF_HINT = { evergreen: 'Stays on the board all week. Posted to Discord once, no timer.', dated: 'Tied to a calendar moment. Needs a freshness check unless it starts within two days.', rapid: 'Same-day response. Short wave, expires fast.' };

export function viewCompose(S) {
  const d = S.gm.draft || (S.gm.draft = blankDraft(S));
  const timed = d.shelf !== 'evergreen';
  const guilds = S.gm.guilds.map(g => [g.id, g.name]);
  return `<h1 class="view-title">${S.gm.editing ? 'Edit quest' : 'New quest'}</h1>
  <p class="view-sub">${S.gm.editing ? 'Saving makes a new version and shelves the old one. Both stay in the archive.' : 'Plain words, one job, under a minute to do.'}</p>
  <div class="gm-grid"><form id="compose" novalidate>
  <fieldset class="box"><legend>The quest</legend>
    <label class="f">Title <span class="req">required</span><input name="title" maxlength="120" value="${esc(d.title)}" placeholder="Lift the Northside rally video"></label>
    <label class="f">One line of flavor <span class="opt">optional</span><input name="flavor" maxlength="160" value="${esc(d.flavor)}"></label>
    <label class="f">Kind of quest${sel('kind', KIND_ORDER.map(k => [k, kindLabel(k)]), d.kind)}</label>
    <div class="f"><span class="f-lbl" id="shelf-l">Shelf life</span><div class="seg" role="radiogroup" aria-labelledby="shelf-l">${['evergreen', 'dated', 'rapid'].map(s => `<label><input type="radio" name="shelf" value="${s}"${d.shelf === s ? ' checked' : ''}>${s[0].toUpperCase() + s.slice(1)}</label>`).join('')}</div><p class="hint" id="shelf-hint">${esc(SHELF_HINT[d.shelf])}</p></div>
    <label class="f">Where${sel('platform', PLATFORM_ORDER.map(p => [p, PLATFORMS[p].en]), d.platform)}</label>
    <label class="f">Link to the post or page<input name="link" type="url" inputmode="url" placeholder="https://" value="${esc(d.link)}"></label>
    <div class="f"><span class="f-lbl">Steps members tick off</span><div class="checks">${STEP_OPTIONS.map(([v, l]) => `<label class="chk"><input type="checkbox" name="steps" value="${v}"${d.steps.includes(v) ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></div>
    <label class="f">Caption to copy <span class="opt">optional</span><textarea name="caption" rows="3">${esc(d.caption)}</textarea></label>
  </fieldset>
  <fieldset class="box"><legend>Voice and sourcing</legend>
    <div class="f"><span class="f-lbl">Guildmaster’s voice note <span class="opt">about 20 seconds, 30 at most</span></span>
      <div id="rec" class="rec">${recHtml(S)}</div>
      <label class="upl">Or upload a recording <input type="file" id="voice-file" accept="audio/*"></label></div>
    <label class="f">Transcript <span class="opt">with no recording, the Cheery Bard babbles it while the words type out. Members can also have it read aloud.</span><textarea name="note" rows="3">${esc(d.note)}</textarea></label>
    <div style="margin-top:8px"><button type="button" class="btn ghost sm" data-act="previewvoice">${icon('play')}Hear the note</button></div>
    <label class="f">Source link <span class="req">required</span><input name="source" type="url" inputmode="url" placeholder="https://" value="${esc(d.source)}"></label>
    <p class="hint">Every quest carries its source. Quests are archived, never deleted. Fix mistakes with a visible correction.</p>
    <div class="f"><label class="chk"><input type="checkbox" name="claim"${d.claim ? ' checked' : ''}><span>Makes a factual claim about a named person. A second organizer signs off before it goes out.</span></label></div>
  </fieldset>
  <fieldset class="box"><legend>Spanish version</legend>
    <p class="hint" style="margin-top:0">Optional. Spanish-speaking members see this when it’s filled in, and a “translation pending” tag when it isn’t.</p>
    <label class="f">Título<input name="es_title" maxlength="120" value="${esc(d.es_title)}"></label>
    <label class="f">Frase<input name="es_flavor" maxlength="160" value="${esc(d.es_flavor)}"></label>
    <label class="f">Texto para copiar<textarea name="es_caption" rows="2">${esc(d.es_caption)}</textarea></label>
    <label class="f">Nota del gremio<textarea name="es_note" rows="2">${esc(d.es_note)}</textarea></label>
  </fieldset>
  <fieldset class="box"><legend>When and who</legend>
    <div id="timed"${timed ? '' : ' hidden'}>
      <label class="f">Starts<input type="datetime-local" name="when" value="${esc(d.when)}"></label>
      <label class="f">Wave length${sel('length', [['60', '1 hour'], ['180', '3 hours'], ['1440', '24 hours']], d.length)}</label>
      <label class="f">Stale after<input type="datetime-local" name="stale" value="${esc(d.stale)}"></label>
      <p class="hint">If nobody has confirmed it by its start time, it’s held instead of going out stale.</p>
    </div>
    <div id="ever"${timed ? ' hidden' : ''}><p class="hint">Evergreen quests go on this week’s board right away.</p>
      <label class="chk"><input type="checkbox" name="to_library"${d.to_library ? ' checked' : ''}><span>Also save it to the evergreen library</span></label></div>
    <label class="f">Guild${sel('guild_id', guilds, d.guild_id)}</label>
    <p class="err" id="f-err" role="alert"></p>
    <div class="actions"><button type="submit" class="btn primary" id="f-submit">${timed ? 'Add to schedule' : 'Put it on the board'}</button>
      <button type="button" class="btn ghost" data-act="firenow" id="f-fire"${timed ? '' : ' hidden'}>Fire now as a rapid wave</button>
      ${S.gm.editing ? '<button type="button" class="btn ghost" data-act="canceledit">Cancel</button>' : ''}</div>
  </fieldset></form>
  <div class="sticky"><fieldset class="box"><legend>What members see</legend><div id="pv-member" class="pv" inert></div></fieldset>
  <fieldset class="box"><legend>Discord post</legend><div id="pv-discord"></div><p class="hint">Posted automatically when the quest goes live.</p>
    <div class="btn-row" style="margin-top:8px"><button type="button" class="btn ghost sm" data-act="copymirror">${icon('copy')}Copy text for WhatsApp or other chats</button></div></fieldset></div>
  </div>`;
}

export function readDraft(form) {
  const fd = new FormData(form), d = {};
  ['title', 'flavor', 'kind', 'shelf', 'platform', 'link', 'caption', 'note', 'source', 'when', 'length', 'stale', 'guild_id', 'es_title', 'es_flavor', 'es_caption', 'es_note']
    .forEach(k => { d[k] = String(fd.get(k) || '').trim(); });
  d.steps = fd.getAll('steps').map(String); d.claim = !!fd.get('claim'); d.to_library = !!fd.get('to_library');
  return d;
}
export function questRowFromDraft(d, week0) {
  const tr = {};
  if (d.es_title) tr.es = { title: d.es_title, flavor: d.es_flavor || null, caption: d.es_caption || null, note: d.es_note || null };
  const row = { title: d.title, flavor: d.flavor || null, kind: d.kind, shelf: d.shelf, platform: d.platform, link: safeUrl(d.link) || null,
    steps: d.steps.length ? d.steps : ['open'], caption: d.caption || null, note: d.note || null, source: safeUrl(d.source) || null, tr,
    claim: d.claim, guild_id: d.guild_id || null, template_id: d.template_id || null };
  if (d.shelf === 'evergreen') Object.assign(row, { week_of: week0, starts_at: null, ends_at: null, stale_at: null });
  else {
    let s = new Date(d.when).getTime(); if (isNaN(s)) s = atLocal(1, 18);
    let st = new Date(d.stale).getTime(); if (isNaN(st)) st = s + DAY;
    Object.assign(row, { week_of: null, starts_at: new Date(s).toISOString(), ends_at: new Date(s + (parseInt(d.length, 10) || 60) * 6e4).toISOString(), stale_at: new Date(st).toISOString() });
  }
  return row;
}
export function validateDraft(d, firing) {
  if (!d.title) return 'Add a title.';
  if (!safeUrl(d.source)) return 'Add a source link that starts with https://';
  if ((d.steps.includes('open') || d.steps.includes('sendchat')) && !safeUrl(d.link)) return 'Add the link members should open.';
  if (d.platform === 'reddit') return 'Reddit quests aren’t supported. See docs/PRINCIPLES.md.';
  if (d.shelf !== 'evergreen' && !firing && isNaN(new Date(d.when).getTime())) return 'Pick a start time.';
  return '';
}
export function renderPreview(S) {
  const form = document.getElementById('compose'); if (!form) return;
  const d = S.gm.draft = Object.assign(S.gm.draft || {}, readDraft(form));
  const k = KINDS[d.kind] || KINDS.amplify;
  const q = Object.assign(questRowFromDraft(d, S.gm.week0), { id: 'preview', cls: k.cls, xp: k.xp, note_audio: (S.gm.rec && S.gm.rec.url) || d.note_audio || null });
  if (q.shelf !== 'evergreen') { q.starts_at = new Date(Date.now() - 6e4).toISOString(); q.ends_at = new Date(Date.now() + 36e5).toISOString(); }
  document.getElementById('pv-member').innerHTML = questBody(q, { done: {}, ticked: {}, inert: true, guildName: id => (S.gm.guilds.find(g => g.id === id) || {}).name || '' }, { title: true });
  const wave = q.shelf === 'evergreen' ? 'Open all week' : (d.length === '1440' ? 'Ends in 24 hours' : d.length === '180' ? 'Ends in 3 hours' : 'Ends in 1 hour');
  document.getElementById('pv-discord').innerHTML = `<div class="dc"><div class="bot"><span class="av">PU</span>Party Up <small>APP</small></div><div class="emb"><div class="et">New quest: ${esc(d.title || 'Untitled quest')}</div><div class="ed">${esc(d.flavor || 'Open Party Up for the steps.')}</div><div class="ef"><span><b>Where</b>${esc(PLATFORMS[d.platform] ? PLATFORMS[d.platform].en : d.platform)}</span><span><b>Worth</b>${k.xp} XP</span><span><b>Wave</b>${esc(wave)}</span></div></div></div>`;
  const timed = d.shelf !== 'evergreen';
  document.getElementById('timed').hidden = !timed;
  document.getElementById('ever').hidden = timed;
  document.getElementById('f-fire').hidden = !timed;
  document.getElementById('f-submit').textContent = timed ? 'Add to schedule' : 'Put it on the board';
  document.getElementById('shelf-hint').textContent = SHELF_HINT[d.shelf] || '';
}

// ---------- Library and archive ----------
export function templateStats(rows) {
  const by = {};
  for (const r of rows || []) {
    if (!r.template_id || !r.audience) continue;
    (by[r.template_id] = by[r.template_id] || []).push({ at: ts(r.run_at), rate: r.completions / r.audience });
  }
  return by;
}
export function viewLibrary(S) {
  const stats = templateStats(S.gm.report && S.gm.report.rows);
  const lib = S.gm.templates.map(tp => {
    const runs = (stats[tp.id] || []).sort((a, b) => a.at - b.at);
    const avgRate = runs.length ? Math.round(100 * runs.reduce((x, r) => x + r.rate, 0) / runs.length) : null;
    const line = runs.length ? `Run ${runs.length} times. ${avgRate}% of members finished it on average.` : 'Not run yet.';
    return `<li class="${tp.active ? '' : 'retired'}"><div class="lm"><div class="lt">${esc(tp.title)}</div><div class="ls">${esc(en(CLASSES[KINDS[tp.kind].cls].name))}. ${esc(line)}${tp.active ? '' : ' Retired, so autopilot skips it.'}</div></div>
      <div class="btn-row"><button type="button" class="btn ghost sm" data-act="usetemplate" data-t="${esc(tp.id)}">${icon('plus')}Schedule this</button>
      <button type="button" class="btn ghost sm" data-act="${tp.active ? 'retire' : 'restore'}" data-t="${esc(tp.id)}">${tp.active ? 'Retire' : 'Bring back'}</button></div></li>`;
  }).join('');
  const arch = (S.gm.archive || []).filter(q => startOf(q) <= Date.now()).slice(0, 60).map(q => {
    const when = fmtDate(startOf(q));
    return `<li><div class="at">${esc(q.title)}</div><div class="ad">${esc(when)}. ${esc(en(CLASSES[q.cls] ? CLASSES[q.cls].name : null))}.${q.shelved ? ' Shelved.' : ''}${q.source ? ` Source: <a href="${esc(safeUrl(q.source))}" target="_blank" rel="noopener">${esc(q.source.replace(/^https?:\/\//, ''))}</a>` : ''}</div>
      ${q.correction ? `<p class="corr"><b>Correction:</b> ${esc(q.correction)}</p>` : `<details class="fix"><summary>Add a correction</summary><form class="corr-form" data-q="${esc(q.id)}"><label class="f">What was wrong, and what’s right<textarea name="correction" rows="2" required></textarea></label><button type="submit" class="btn ghost sm">Add correction</button></form></details>`}</li>`;
  }).join('');
  return `<h1 class="view-title">Library</h1><p class="view-sub">Evergreen quests you can run again. Autopilot pulls from the top, least recently used first.</p>
    <fieldset class="box"><legend>Evergreen library</legend><ul class="lib">${lib || '<li>No templates yet. Save one from the New quest form.</li>'}</ul></fieldset>
    <fieldset class="box"><legend>Archive</legend><p class="note">Every quest that went out, with its source. Nothing gets deleted. Mistakes get a visible correction that members see too.</p><ul class="arch">${arch || '<li>No past quests yet.</li>'}</ul></fieldset>`;
}

// ---------- Crew, invites, settings ----------
export function viewCrew(S) {
  const isGM = S.me.role === 'guildmaster';
  const set = S.gm.settings || {};
  const base = location.origin + location.pathname;
  const guildName = id => (S.gm.guilds.find(g => g.id === id) || {}).name || 'Everyone';
  const invites = (S.gm.invites || []).filter(i => i.note !== 'personal').map(i => `<li><div class="lm"><div class="lt code">${esc(i.code)}</div><div class="ls">${esc(guildName(i.guild_id))}. Used ${i.uses} of ${i.max_uses}.${i.note ? ' ' + esc(i.note) + '.' : ''}</div></div><button type="button" class="btn ghost sm" data-act="copyinvite" data-code="${esc(i.code)}">${icon('copy')}Copy link</button></li>`).join('');
  const crew = (S.gm.crew || []).map(c => `<li><div class="lm"><div class="lt">${esc(c.handle)}</div><div class="ls">${esc(c.role === 'guildmaster' ? 'Guildmaster' : c.role === 'captain' ? 'Captain' : 'Member')}. ${esc(c.guild || 'No guild')}. Joined ${esc(fmtDate(ts(c.joined)))}. Recruited ${c.recruits}.</div></div></li>`).join('');
  const guildOpts = S.gm.guilds.map(g => [g.id, g.name]);
  return `<h1 class="view-title">Crew</h1><p class="view-sub">Invite codes, organizer roles, guilds, and settings.</p>
  <div class="pulse-grid"><div>
  <form id="invite-form" novalidate><fieldset class="box"><legend>Invite codes</legend>
    <label class="f">Guild for new members${sel('guild_id', guildOpts, (S.gm.guilds.find(g => g.name === 'Minnesota') || {}).id)}</label>
    <label class="f">How many people can use it<input name="max" type="number" min="1" max="5000" value="50"></label>
    <label class="f">Note <span class="opt">optional</span><input name="note" maxlength="60" placeholder="Discord, March meetup"></label>
    <div class="actions"><button type="submit" class="btn ghost">${icon('plus')}Make a code</button></div>
    <p class="hint">Links look like ${esc(base)}?invite=CODE. Members also get their own personal link.</p>
    <ul class="lib" style="margin-top:8px">${invites || '<li>No shared codes yet.</li>'}</ul>
  </fieldset></form>
  <fieldset class="box"><legend>Organizers and members</legend><ul class="lib">${crew}</ul>
    ${isGM ? `<form id="role-form" novalidate><label class="f">Change someone’s role<input name="handle" placeholder="Their name on the board"></label>${sel('role', [['captain', 'Captain: writes quests'], ['guildmaster', 'Guildmaster: everything'], ['member', 'Member']], 'captain')}<p class="err" id="role-err" role="alert"></p><button type="submit" class="btn ghost sm" style="margin-top:8px">Save role</button></form>` : '<p class="hint">Only a guildmaster can change roles.</p>'}
  </fieldset>
  </div><div>
  ${isGM ? `<form id="settings-form" novalidate><fieldset class="box"><legend>Settings</legend>
    <label class="chk"><input type="checkbox" name="autopilot"${set.autopilot ? ' checked' : ''}><span>Autopilot: fill quiet weeks from the evergreen library</span></label>
    <div class="setting"><label for="minpw">Keep at least this many quests on each week’s board</label><div class="row2"><input type="range" id="minpw" name="min_per_week" min="1" max="10" value="${set.min_per_week || 3}"><output id="minpw-out" for="minpw">${set.min_per_week || 3}</output></div></div>
    <label class="f">Party Up’s web address<input name="app_url" type="url" value="${esc(set.app_url || '')}" placeholder="${esc(base)}"></label>
    <label class="f">Discord invite link for members<input name="discord_url" type="url" value="${esc(set.discord_url || '')}" placeholder="https://discord.gg/..."></label>
    <p class="hint">Autopilot only adds evergreen quests. It never fires a timed wave on its own.</p>
    <div class="actions"><button type="submit" class="btn ghost">Save settings</button></div>
  </fieldset></form>
  <form id="guild-form" novalidate><fieldset class="box"><legend>Guilds</legend>
    <p class="note">${S.gm.guilds.map(g => esc(g.name)).join(', ')}</p>
    <label class="f">New guild name<input name="name" maxlength="40" placeholder="Mankato"></label>
    <label class="f">Part of${sel('parent_id', guildOpts, (S.gm.guilds.find(g => g.name === 'Minnesota') || {}).id)}</label>
    <p class="err" id="guild-err" role="alert"></p><div class="actions"><button type="submit" class="btn ghost sm">${icon('plus')}Add guild</button></div>
  </fieldset></form>` : ''}
  </div></div>`;
}
