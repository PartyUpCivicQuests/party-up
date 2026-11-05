// Quest card pieces shared by the member views and the organizer preview.
import { esc, safeUrl, shortUrl, icon, ts } from './util.js';
import { CLASSES, PLATFORMS, STEPS } from './content.js';
import { t, tx, qtx, hasTr, getLang } from './i18n.js';

export const platName = p => tx(PLATFORMS[p] || { en: p });
export const className = c => tx((CLASSES[c] || CLASSES.paladin).name);

export function stepLabel(q, key) {
  if (key === 'open' && q.platform === 'google') return tx(STEPS.search);
  if (key === 'open' && ['street', 'chat', 'profile'].includes(q.platform)) return tx(STEPS.openlink);
  return tx(STEPS[key] || { en: key }).replace('{p}', platName(q.platform));
}

function trTag(q) {
  if (getLang() === 'en') return '';
  return hasTr(q) ? `<span class="chip tr">${esc(t('trDone'))}</span>` : `<span class="chip soft">${esc(t('trPending'))}</span>`;
}

// ctx: { done: {id: gain}, ticked: {id: [i...]}, speaking: id, inert: bool, guildName: fn }
export function questBody(q, ctx, opts = {}) {
  const now = Date.now();
  const done = ctx.done[q.id];
  const ticked = ctx.ticked[q.id] || [];
  const timed = q.shelf !== 'evergreen';
  const upcoming = timed && ts(q.starts_at) > now;
  const ended = timed && ts(q.ends_at) <= now;
  const data = ctx.inert ? '' : ` data-q="${esc(q.id)}"`;
  let h = `<div class="chips"><span class="chip">${esc(className(q.cls))}</span><span class="chip">${esc(platName(q.platform))}</span><span class="chip xp">+${q.xp} XP</span>`;
  const gname = ctx.guildName ? ctx.guildName(q.guild_id) : '';
  if (gname) h += `<span class="chip soft">${esc(gname)}</span>`;
  h += trTag(q) + '</div>';
  if (opts.title) h += `<h2 class="q-title">${esc(qtx(q, 'title'))}</h2>`;
  const flavor = qtx(q, 'flavor');
  if (flavor) h += `<p class="q-flavor">${esc(flavor)}</p>`;
  if (q.correction) h += `<p class="corr"><b>${esc(t('correction'))}:</b> ${esc(q.correction)}</p>`;
  // Voice: the main button plays the recording, or the Cheery Bard babble when
  // there's only a transcript. "Read transcript aloud" uses the device's best
  // real voice in the member's language.
  const note = qtx(q, 'note');
  if (note || q.note_audio) {
    const speaking = ctx.speaking === q.id, reading = ctx.reading === q.id;
    const mainLabel = speaking ? t('stop') : (q.note_audio ? t('play') : t('hearBard'));
    h += `<div class="voice"><button type="button" class="btn ghost sm" data-act="voice"${data}>${icon(speaking ? 'stop' : 'play')}<span>${esc(mainLabel)}</span></button>`;
    if (note) h += `<button type="button" class="btn ghost sm" data-act="readaloud"${data}>${icon(reading ? 'stop' : 'volume')}<span>${esc(t(reading ? 'stopReading' : 'readAloud'))}</span></button>`;
    h += '</div>';
    if (ctx.bubble && ctx.bubble.id === q.id) h += `<div class="bubble" data-bubble="${esc(q.id)}" aria-live="polite">${esc(ctx.bubble.text)}</div>`;
    if (note) h += `<details class="transcript"><summary>${esc(t('readIt'))}</summary><p>${esc(note)}</p></details>`;
  }
  const steps = (q.steps || []).map((key, i) => {
    const ok = ticked.includes(i), label = esc(stepLabel(q, key)), di = ctx.inert ? '' : `${data} data-i="${i}"`;
    const tick = `<span class="tick" aria-hidden="true">${ok ? icon('check') : ''}</span>`;
    if (key === 'open' || key === 'openlink') {
      const url = safeUrl(q.link) || '#';
      return `<li class="${ok ? 'ok' : ''}">${tick}<a class="btn ghost sm" href="${esc(url)}" target="_blank" rel="noopener" data-act="open"${di}>${icon('ext')}${label}</a></li>`;
    }
    if (key === 'sendchat' || key === 'invite') {
      return `<li class="${ok ? 'ok' : ''}">${tick}<button type="button" class="btn ghost sm" data-act="${key}"${di}>${icon('share')}${label}</button></li>`;
    }
    return `<li><label class="chk"><input type="checkbox" data-act="step"${di}${ok ? ' checked' : ''}><span>${label}</span></label></li>`;
  }).join('');
  h += `<ul class="steps">${steps}</ul>`;
  const caption = qtx(q, 'caption');
  if (caption) h += `<div class="caption"><p>${esc(caption)}</p><button type="button" class="btn ghost sm" data-act="copy"${data}>${icon('copy')}${esc(t('copy'))}</button></div>`;
  if (done != null) h += `<p class="done-note">${icon('check')}${esc(t('doneLabel', done))}</p>`;
  else if (upcoming) h += `<button type="button" class="btn primary" disabled>${esc(t('notYet'))}</button>`;
  else if (!ended) h += `<button type="button" class="btn primary" data-act="done"${data}>${esc(t('iDidIt'))}</button>`;
  if (q.source && safeUrl(q.source)) h += `<p class="src">${esc(t('source'))}: <a href="${esc(safeUrl(q.source))}" target="_blank" rel="noopener">${esc(shortUrl(q.source))}</a></p>`;
  return h;
}
