// Member screens. Each function returns HTML for the main area.
import { esc, icon, fmtLeft, fmtWhen, ts } from './util.js';
import { CLASSES, CLASS_ORDER, BADGES, levelOf, classLevel, topClass } from './content.js';
import { t, tx, qtx, locale, LANGS, getLang } from './i18n.js';
import { questBody, className } from './ui.js';

export function inviteLink(S) {
  const base = (S.me && S.me.app_url) || (location.origin + location.pathname);
  return `${base}?invite=${encodeURIComponent((S.me && S.me.invite_code) || '')}`;
}

function ctx(S) {
  return { done: S.done, ticked: S.ticked, speaking: S.speaking, reading: S.reading, bubble: S.bubble, guildName: () => '' };
}

export function viewJoin(S) {
  const code = new URLSearchParams(location.search).get('invite') || '';
  const langOpts = Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${getLang() === k ? ' selected' : ''}>${esc(v)}</option>`).join('');
  return `<h1 class="view-title">${esc(t('joinTitle'))}</h1><p class="view-sub">${esc(t('joinNote'))}</p>
  <form id="join-form" novalidate><fieldset class="box"><legend>${esc(t('joinTitle'))}</legend>
    <label class="f">${esc(t('code'))}<input name="code" autocomplete="off" autocapitalize="characters" value="${esc(code)}" required></label>
    <label class="f">${esc(t('pickName'))}<input name="handle" maxlength="24" autocomplete="nickname" required><span class="hint">${esc(t('pickNameNote'))}</span></label>
    <label class="f">${esc(t('language'))}<select name="lang" id="join-lang">${langOpts}</select></label>
    <p class="err" id="join-err" role="alert"></p>
    <button type="submit" class="btn primary">${esc(t('join'))}</button>
  </fieldset></form>
  <form id="signin-form" novalidate><fieldset class="box"><legend>${esc(t('returning'))}</legend>
    <label class="f">${esc(t('email'))}<input name="email" type="email" autocomplete="email" required></label>
    <p class="err" id="signin-err" role="alert"></p>
    <button type="submit" class="btn ghost">${esc(t('getLink'))}</button>
  </fieldset></form>
  <p class="fine">${esc(t('footer'))}</p>`;
}

function statStrip(me) {
  const lv = levelOf(me.xp_total), top = topClass(me.class_xp);
  let sh = '';
  for (let i = 0; i < 2; i++) sh += icon('shield', i < me.shields ? 'filled' : '');
  return `<div class="stats">
    <div class="stat"><span class="big">${lv.n}</span><span class="lbl">${esc(t('lvTitle', lv.n, className(top)))}</span><span class="bar" role="img" aria-label="${esc(t('xpLeft', lv.left, lv.n + 1))}"><i style="width:${lv.pct}%"></i></span><span class="tiny">${esc(t('xpLeft', lv.left, lv.n + 1))}</span></div>
    <div class="stat"><span class="big">${me.streak}</span><span class="lbl">${esc(t('streak'))}</span><span class="shields" role="img" aria-label="${esc(t('shieldsAria', me.shields))}">${sh}</span></div>
    <div class="stat"><span class="big">${me.week_done}</span><span class="lbl">${esc(t('weekDone'))}</span></div>
  </div>`;
}

function rowQuest(S, q) {
  const done = S.done[q.id] != null;
  return `<details class="row${done ? ' is-done' : ''}" data-row="${esc(q.id)}"${S.open[q.id] ? ' open' : ''}>
    <summary><span class="r-title">${done ? icon('check') : ''}<span>${esc(qtx(q, 'title'))}</span></span><span class="r-meta"><span>${esc(className(q.cls))}</span><span class="xp">+${q.xp} XP</span></span></summary>
    <div class="r-body">${questBody(q, ctx(S))}</div></details>`;
}

function upRow(q) {
  return `<div class="up"><div class="u-main"><div class="u-title">${esc(qtx(q, 'title'))}</div>
    <div class="u-when">${esc(fmtWhen(ts(q.starts_at), locale()))}</div>
    <div class="u-when">${esc(t('startsIn'))} <span data-starts="${ts(q.starts_at)}">${fmtLeft(ts(q.starts_at) - Date.now())}</span></div></div>
    <span class="chip xp">+${q.xp} XP</span></div>`;
}

const SNOOZE = 'partyup-save-snooze';
export function snoozeNudge() { try { localStorage.setItem(SNOOZE, String(Date.now() + 7 * 864e5)); } catch { /* ignore */ } }
function nudgeSnoozed() { try { return Number(localStorage.getItem(SNOOZE) || 0) > Date.now(); } catch { return false; } }

// "Save your character": shown until the member adds an email. "Maybe later" hides it for a week.
function saveNudge(S) {
  const a = S.account;
  if (!a || a.email) return '';
  if (a.pending) return `<fieldset class="box nudge"><legend>${esc(t('saveTitle'))}</legend><p style="margin:0">${esc(t('pendingNote', a.pending))}</p></fieldset>`;
  if (nudgeSnoozed()) return '';
  return `<form id="nudge-form" novalidate><fieldset class="box nudge"><legend>${esc(t('saveTitle'))}</legend>
    <p class="note">${esc(t('saveNote'))}</p>
    <label class="f"><span class="sr">${esc(t('email'))}</span><input name="email" type="email" autocomplete="email" placeholder="${esc(t('email'))}" required></label>
    <p class="err" id="nudge-err" role="alert"></p>
    <div class="btn-row" style="margin-top:8px"><button type="submit" class="btn primary" style="width:auto;flex:1">${esc(t('saveBtn'))}</button><button type="button" class="btn ghost" data-act="later">${esc(t('later'))}</button></div>
  </fieldset></form>`;
}

export function viewQuests(S) {
  const now = Date.now(), me = S.me, qs = S.quests;
  const live = qs.filter(q => q.shelf !== 'evergreen' && ts(q.starts_at) <= now && ts(q.ends_at) > now).sort((a, b) => ts(a.ends_at) - ts(b.ends_at));
  const upcoming = qs.filter(q => q.shelf !== 'evergreen' && ts(q.starts_at) > now).sort((a, b) => ts(a.starts_at) - ts(b.starts_at)).slice(0, 3);
  const anytime = qs.filter(q => q.shelf === 'evergreen');
  let h = saveNudge(S) + statStrip(me);
  if (live.length) {
    const q = live[0];
    h += `<fieldset class="box hero"><legend><span class="pill">${esc(t('waveNow'))} <span class="clock" data-ends="${ts(q.ends_at)}" aria-label="${esc(t('endsIn'))}">${fmtLeft(ts(q.ends_at) - now)}</span></span></legend>${questBody(q, ctx(S), { title: true })}</fieldset>
      <p class="troll">${icon('shield')}${esc(t('trolls'))}</p>`;
  } else {
    h += `<fieldset class="box"><legend>${esc(t('waveNow'))}</legend><div class="empty"><p>${esc(t('noWave'))}</p>${upcoming[0] ? `<p class="note">${esc(t('nextWave', fmtWhen(ts(upcoming[0].starts_at), locale())))}</p>` : ''}</div></fieldset>`;
  }
  if (live.length > 1) h += `<fieldset class="box"><legend>${esc(t('alsoLive'))}</legend>${live.slice(1).map(q => rowQuest(S, q)).join('')}</fieldset>`;
  if (upcoming.length) h += `<fieldset class="box"><legend>${esc(t('upNext'))}</legend>${upcoming.map(upRow).join('')}</fieldset>`;
  if (anytime.length) h += `<fieldset class="box"><legend>${esc(t('anytime'))}</legend><p class="note">${esc(t('anytimeNote'))}</p>${anytime.map(q => rowQuest(S, q)).join('')}</fieldset>`;
  if (!live.length && !upcoming.length && !anytime.length) h += `<p class="note" style="margin-top:14px">${esc(t('nothingYet'))}</p>`;
  const vowDone = me.vow_week && me.vow_week === me.cur_week;
  h += `<fieldset class="box"><legend>${esc(t('vow'))}</legend><h2 class="q-title" style="font-size:1.3rem">${esc(t('vowTitle'))}</h2><p class="q-flavor">${esc(t('vowText'))}</p>
    ${vowDone ? `<p class="done-note">${icon('check')}${esc(t('vowDone'))}</p>` : `<button type="button" class="btn ghost wide" data-act="vow">${esc(t('iKept'))}</button>`}</fieldset>`;
  h += `<p class="fine">${esc(t('footer'))}</p>`;
  return h;
}

export function viewParty(S) {
  const me = S.me, b = S.buddy;
  let h = `<h1 class="view-title">${esc(t('tabParty'))}</h1>`;
  if (b) {
    const mine = Math.min(me.week_done, 5), theirs = Math.min(b.week_done, 5 - mine);
    let pips = '';
    for (let i = 0; i < 5; i++) pips += `<span class="${i < mine ? 'me' : (i < mine + theirs ? 'bud' : '')}"></span>`;
    const streak = Math.min(me.streak, b.streak);
    h += `<fieldset class="box"><legend>${esc(t('partyQuest'))}</legend><p style="margin:0">${esc(t('partyGoal', b.handle))}</p>
      <div class="pips" role="img" aria-label="${mine + theirs} / 5">${pips}</div>
      <div class="legend-row"><span><b style="background:var(--gold)"></b>${esc(t('youKey'))}: ${me.week_done}</span><span><b style="background:var(--sea)"></b>${esc(b.handle)}: ${b.week_done}</span></div></fieldset>
      <fieldset class="box"><legend>${esc(t('buddy'))}</legend><div class="duo"><span class="av g">${esc(me.handle.charAt(0).toUpperCase())}</span><span class="av">${esc(b.handle.charAt(0).toUpperCase())}</span><span class="duo-n">${streak}</span><span class="duo-w">${esc(t('weeksWord'))}</span></div>
      <p class="note" style="margin-top:6px">${esc(t('buddyTxt', b.handle, streak))}</p><button type="button" class="btn ghost sm" data-act="unpair">${esc(t('unpair'))}</button></fieldset>`;
  } else {
    h += `<form id="pair-form" novalidate><fieldset class="box"><legend>${esc(t('pairUp'))}</legend><p class="note">${esc(t('pairNote'))}</p>
      <p style="margin:0 0 4px"><b>${esc(t('yourCode'))}:</b> <span class="code">${esc(me.buddy_code || '')}</span></p>
      <label class="f">${esc(t('theirCode'))}<input name="code" autocomplete="off" autocapitalize="characters"></label>
      <p class="err" id="pair-err" role="alert"></p><button type="submit" class="btn ghost">${esc(t('pair'))}</button></fieldset></form>`;
  }
  const board = (S.board || []).map((r, i) => `<li class="${r.is_me ? 'me' : ''}"><span class="rk">${i + 1}</span><span>${esc(r.handle)}${r.is_me ? ` (${esc(t('you'))})` : ''}</span><span class="pts">${r.xp} XP</span></li>`).join('');
  h += `<fieldset class="box"><legend>${esc(t('board'))}</legend><p class="note">${esc(t('boardNote'))}</p><ol class="board">${board}</ol></fieldset>`;
  if ((S.turnout || []).length) {
    h += `<fieldset class="box"><legend>${esc(t('guilds'))}</legend><p class="note">${esc(t('guildsNote'))}</p>` +
      S.turnout.map(g => `<div class="gbar${g.is_mine ? ' mine' : ''}"><span class="nm">${esc(g.name)}</span><span class="track"><i style="width:${g.rate || 0}%"></i></span><span class="v">${g.rate || 0}%</span></div>`).join('') + '</fieldset>';
  }
  const link = inviteLink(S);
  h += `<fieldset class="box"><legend>${esc(t('invite'))}</legend><div class="invite"><div id="qr" class="qr" aria-hidden="true"></div><div class="inv-text"><p class="note">${esc(t('inviteNote'))}</p><p class="link">${esc(link)}</p>
    <div class="btn-row"><button type="button" class="btn ghost sm" data-act="copylink">${icon('copy')}${esc(t('copyLink'))}</button><button type="button" class="btn ghost sm" data-act="invite">${icon('share')}${esc(t('share'))}</button></div></div></div></fieldset>`;
  return h;
}

export function viewSheet(S) {
  const me = S.me, lv = levelOf(me.xp_total), top = topClass(me.class_xp);
  const abil = CLASS_ORDER.map(c => { const x = me.class_xp[c] || 0; return `<div class="ab${c === top ? ' top' : ''}"><div class="nm">${esc(tx(CLASSES[c].name))}</div><div class="lv">${classLevel(x)}</div><div class="px">${x} XP</div><div class="does">${esc(tx(CLASSES[c].does))}</div></div>`; }).join('');
  const btns = BADGES.map(b => `<div class="cbtn ${b.earned(me) ? b.style : 'locked'}">${esc(tx(b.t))}</div>`).join('');
  const langOpts = Object.entries(LANGS).map(([k, v]) => `<option value="${k}"${me.lang === k ? ' selected' : ''}>${esc(v)}</option>`).join('');
  const acct = S.account || { email: '', anonymous: true };
  return `<h1 class="view-title">${esc(t('sheet'))}</h1>
  <form id="me-form" novalidate><fieldset class="box"><legend>${esc(t('handle'))}</legend>
    <div class="row-in"><input name="handle" maxlength="24" value="${esc(me.handle)}" aria-label="${esc(t('handle'))}"><button type="submit" class="btn ghost sm">${esc(t('save'))}</button></div>
    <p class="hint">${esc(t('handleNote'))}</p>
    <p class="title">${esc(t('lvTitle', lv.n, className(top)))}</p><p class="tot">${esc(t('totalXp', me.xp_total))}</p>
  </fieldset></form>
  <fieldset class="box"><legend>${esc(t('classes'))}</legend><p class="note">${esc(t('classesNote'))}</p><div class="ability">${abil}</div></fieldset>
  <fieldset class="box"><legend>${esc(t('buttons'))}</legend><div class="buttons">${btns}</div></fieldset>
  <fieldset class="box"><legend>${esc(t('alerts'))}</legend><p class="note">${esc(t('alertsNote'))}</p>${me.discord_url ? `<a class="btn ghost sm" href="${esc(me.discord_url)}" target="_blank" rel="noopener">${icon('ext')}${esc(t('joinDiscord'))}</a>` : ''}</fieldset>
  <fieldset class="box"><legend>${esc(t('settings'))}</legend>
    <div class="setting"><label for="set-lang">${esc(t('language'))}</label><div class="f" style="margin-top:0"><select id="set-lang">${langOpts}</select></div></div>
    <div class="setting"><label for="set-budget">${esc(t('budget'))}</label><div class="row2"><input type="range" id="set-budget" min="1" max="14" value="${me.max_per_week}"><output id="set-budget-out" for="set-budget">${me.max_per_week}</output></div></div>
    <div class="setting"><label class="chk"><input type="checkbox" id="set-quiet"${me.quiet_hours ? ' checked' : ''}><span>${esc(t('quiet'))}</span></label></div>
    <p class="privacy">${esc(t('privacy'))}</p>
  </fieldset>
  <form id="email-form" novalidate><fieldset class="box"><legend>${esc(t('devices'))}</legend>
    ${acct.email ? `<p style="margin:0 0 8px">${esc(t('signedInAs', acct.email))}</p>` : acct.pending ? `<p style="margin:0 0 8px">${esc(t('pendingNote', acct.pending))}</p>` : `<p class="note">${esc(t('devicesNote'))}</p>
    <label class="f">${esc(t('email'))}<input name="email" type="email" autocomplete="email"></label>
    <p class="err" id="email-err" role="alert"></p><button type="submit" class="btn ghost sm">${esc(t('addEmail'))}</button>`}
    <div class="setting"><button type="button" class="btn ghost warn sm" data-act="signout">${esc(t('signOut'))}</button></div>
  </fieldset></form>
  <p class="fine">${esc(t('footer'))}</p>`;
}
