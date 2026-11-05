// Reports: which quests do better over time, and what to do about it.
// Everything here works from anonymous totals (see supabase/01_schema.sql,
// report_quests and report_weeks). There is no per-person drill-down, by design.
import { esc, icon, ts, fmtDate, fmtDay, pct, avg, csv, dayTs } from './util.js';
import { CLASSES, KINDS, PLATFORMS } from './content.js';
import { templateStats } from './views-gm.js';

const MIN_AUDIENCE = 10;          // below this, a quest is marked "small sample" and not flagged
const FLAG_POINTS = 8;            // how far from its kind's average a quest must be to count as strong or lagging
const en = o => (o && o.en) || '';
const kindName = k => `${KINDS[k] ? KINDS[k].label : k}`;
const platName = p => (PLATFORMS[p] && PLATFORMS[p].en) || p;

export function analyze(rows, weeks, templates, now = Date.now()) {
  const R = rows.map(r => {
    const aud = Math.max(0, r.audience || 0);
    const rate = aud ? Math.min(1, r.completions / aud) : 0;
    const timed = r.shelf !== 'evergreen';
    const first20 = timed && r.completions ? r.buckets.slice(0, 4).reduce((a, b) => a + b, 0) / r.completions : null;
    const start = ts(r.run_at), end = ts(r.ends_at);
    const d = new Date(start);
    const slot = timed ? `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]} ${d.getHours() < 12 ? 'morning' : d.getHours() < 17 ? 'afternoon' : 'evening'}` : 'No timer (evergreen)';
    return Object.assign({}, r, { aud, rate, timed, first20, start, end, live: end > now, slot,
      openRate: aud ? Math.min(1, r.opens / aud) : 0, small: aud < MIN_AUDIENCE, avgMins: r.completions ? r.minutes_sum / r.completions : null });
  });
  const finished = R.filter(r => !r.live && !r.small);
  const baseAll = avg(finished.map(r => r.rate));
  const baseKind = {};
  for (const k of Object.keys(KINDS)) { const xs = finished.filter(r => r.kind === k).map(r => r.rate); baseKind[k] = xs.length >= 2 ? avg(xs) : baseAll; }
  for (const r of R) { r.base = baseKind[r.kind] ?? baseAll; r.delta = Math.round(100 * (r.rate - r.base)); r.flag = r.small || r.live ? '' : (r.delta >= FLAG_POINTS ? 'strong' : r.delta <= -FLAG_POINTS ? 'lagging' : 'typical'); }

  // Typical first-hour curve from past timed waves, for "on pace" checks.
  const curves = finished.filter(r => r.timed && r.completions >= 5);
  const curve = Array(12).fill(0);
  for (const r of curves) { let c = 0; r.buckets.forEach((b, i) => { c += b; curve[i] += c / r.completions; }); }
  const cum = curves.length ? curve.map(v => v / curves.length) : [.25, .45, .6, .7, .77, .82, .86, .9, .93, .95, .98, 1];

  const pace = R.filter(r => r.live && r.aud).map(r => {
    const expectedFinal = r.base * r.aud;
    let share;
    if (r.timed) { const mins = (now - r.start) / 6e4; share = mins >= 60 ? 1 : cum[Math.max(0, Math.min(11, Math.floor(mins / 5)))]; }
    else share = Math.min(1, Math.max(.05, (now - r.start) / (r.end - r.start)));
    const expected = expectedFinal * share;
    const ratio = expected > 0 ? r.completions / expected : 1;
    return Object.assign(r, { expected: Math.round(expected), ratio, behind: ratio < .7 && expected >= 3 });
  });

  const group = key => {
    const m = {};
    for (const r of finished) (m[r[key]] = m[r[key]] || []).push(r.rate);
    return Object.entries(m).map(([k, xs]) => ({ key: k, rate: avg(xs), n: xs.length })).sort((a, b) => b.rate - a.rate);
  };

  const byWeek = {};
  for (const r of R.filter(x => !x.small)) { const w = mondayOf(r.start); (byWeek[w] = byWeek[w] || []).push(r.rate); }
  const trend = weeks.map(w => ({ week: w.week, rate: byWeek[w.week] ? avg(byWeek[w.week]) : null, activeShare: w.members ? w.active / w.members : 0, returners: w.active ? w.returners / w.active : 0, w }));

  const tstats = templateStats(rows);
  const library = templates.map(tp => {
    const runs = (tstats[tp.id] || []).sort((a, b) => a.at - b.at);
    const n = runs.length, all = avg(runs.map(x => x.rate));
    const early = avg(runs.slice(0, Math.min(3, Math.floor(n / 2) || 1)).map(x => x.rate));
    const late = avg(runs.slice(-Math.min(3, Math.ceil(n / 2) || 1)).map(x => x.rate));
    const change = Math.round(100 * (late - early));
    const health = n < 4 ? 'new' : change <= -FLAG_POINTS ? 'stale' : change >= FLAG_POINTS ? 'rising' : 'steady';
    return { tp, n, all, change, health, runs };
  });

  const lastFull = weeks.length >= 2 ? weeks[weeks.length - 2] : weeks[weeks.length - 1];
  const second = R.filter(r => r.second_call);
  return {
    R, finished, baseAll, baseKind, pace, trend, library,
    byKind: group('kind'), byPlatform: group('platform'), byShelf: group('shelf'), bySlot: group('slot'),
    kpi: {
      runs: R.length, avgRate: baseAll,
      returning: lastFull && lastFull.active ? lastFull.returners / lastFull.active : 0,
      first20: avg(finished.filter(r => r.first20 != null).map(r => r.first20)),
      newMembers: weeks.reduce((a, w) => a + (w.new_members || 0), 0)
    },
    secondCalls: { n: second.length, lift: second.length ? avg(second.map(r => r.completions ? r.after_second_call / r.completions : 0)) : 0 }
  };
}
function mondayOf(t) { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; }

function bars(list, label, max = 1) {
  const top = Math.max(max, ...list.map(x => x.rate));
  return list.map((x, i) => `<div class="gbar wide"><span class="nm">${esc(label(x.key))}</span><span class="track"><i class="${i === 0 ? 'best' : ''}" style="width:${Math.round(100 * x.rate / top)}%"></i></span><span class="v">${pct(x.rate, 1)}% <small>n=${x.n}</small></span></div>`).join('');
}
function trendChart(trend) {
  const W = 300, H = 120, pad = 20, n = trend.length || 1, bw = (W - pad - 6) / n;
  const top = Math.max(.1, ...trend.map(t => t.rate || 0), ...trend.map(t => t.activeShare)) * 1.1;
  const y = v => H - 18 - (v / top) * (H - 30);
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Weekly average finish rate and share of members active">`;
  trend.forEach((t, i) => { if (t.rate != null) s += `<rect class="bar" x="${pad + i * bw + 2}" y="${y(t.rate)}" width="${Math.max(2, bw - 4)}" height="${H - 18 - y(t.rate)}" rx="2"><title>${fmtDate(dayTs(t.week))}: ${pct(t.rate, 1)}% average finish rate</title></rect>`; });
  const pts = trend.map((t, i) => `${pad + i * bw + bw / 2},${y(t.activeShare)}`).join(' ');
  s += `<polyline class="line" points="${pts}"/>`;
  trend.forEach((t, i) => { s += `<circle class="dot" cx="${pad + i * bw + bw / 2}" cy="${y(t.activeShare)}" r="2.6"><title>${fmtDate(dayTs(t.week))}: ${pct(t.activeShare, 1)}% of members active</title></circle>`; });
  s += `<line class="axis" x1="${pad - 2}" y1="${H - 17.5}" x2="${W - 4}" y2="${H - 17.5}"/>`;
  if (trend.length) {
    s += `<text x="${pad}" y="${H - 4}">${esc(fmtDate(dayTs(trend[0].week)))}</text>`;
    s += `<text x="${W - 4}" y="${H - 4}" text-anchor="end">${esc(fmtDate(dayTs(trend[trend.length - 1].week)))}</text>`;
  }
  return s + '</svg>';
}
function questLine(r, action) {
  const sign = r.delta > 0 ? '+' : '';
  return `<li><div class="lm"><div class="lt">${esc(r.title)}</div><div class="ls">${esc(fmtDay(r.start))}. ${esc(kindName(r.kind))} on ${esc(platName(r.platform))}. ${pct(r.rate, 1)}% finished (${r.completions} of ${r.aud}), ${sign}${r.delta} points vs. its kind’s average.${r.first20 != null ? ` ${pct(r.first20, 1)}% in the first 20 minutes.` : ''}</div></div>${action}</li>`;
}

export function viewReports(S) {
  const rep = S.gm.report;
  if (!rep) return '<p class="note">Loading reports…</p>';
  const A = analyze(rep.rows, rep.weeks, S.gm.templates);
  const range = S.gm.range;
  const rangeBtns = [[28, '4 weeks'], [84, '12 weeks'], [182, '6 months']].map(([d, l]) => `<button type="button" class="btn ghost sm" data-act="range" data-days="${d}" aria-pressed="${range === d}">${l}</button>`).join('');
  const strong = A.finished.filter(r => r.flag === 'strong').sort((a, b) => b.delta - a.delta).slice(0, 5);
  const lag = A.finished.filter(r => r.flag === 'lagging').sort((a, b) => a.delta - b.delta).slice(0, 5);
  const runAgain = r => `<button type="button" class="btn ghost sm" data-act="runagain" data-q="${esc(r.id)}">${icon('repeat')}Run again</button>`;
  const rework = r => `<button type="button" class="btn ghost sm" data-act="runagain" data-q="${esc(r.id)}">Rework it</button>`;
  const paceRows = A.pace.map(r => `<li><div class="lm"><div class="lt">${esc(r.title)}</div><div class="ls">${r.completions} done so far; about ${r.expected} would be typical by now. ${r.behind ? '<b class="behind">Behind pace.</b>' : 'On pace.'}${r.second_call ? ' Second call already sent.' : ''}</div></div>${r.behind && !r.second_call ? `<button type="button" class="btn ghost sm" data-act="secondcall" data-q="${esc(r.id)}">${icon('megaphone')}Second call</button>` : ''}</li>`).join('');
  const HEALTH = { stale: '<span class="tag sign">Getting stale</span>', rising: '<span class="tag ever">Rising</span>', steady: '<span class="tag plain">Steady</span>', new: '<span class="tag plain">Too new to judge</span>' };
  const lib = A.library.filter(x => x.tp.active).sort((a, b) => (a.health === 'stale' ? -1 : 0) - (b.health === 'stale' ? -1 : 0) || b.all - a.all).map(x => `<li><div class="lm"><div class="lt">${esc(x.tp.title)}</div><div class="ls">${x.n ? `${x.n} ${x.n === 1 ? 'run' : 'runs'}. ${pct(x.all, 1)}% average.` : 'Not run yet.'}${x.n >= 4 ? ` Recent runs are ${x.change >= 0 ? 'up' : 'down'} ${Math.abs(x.change)} points from the early ones.` : ''}</div><div class="tags">${HEALTH[x.health]}</div></div>${x.health === 'stale' ? `<div class="btn-row"><button type="button" class="btn ghost sm" data-act="usetemplate" data-t="${esc(x.tp.id)}" data-rewrite="1">Rewrite it</button><button type="button" class="btn ghost sm" data-act="retire" data-t="${esc(x.tp.id)}">Retire</button></div>` : ''}</li>`).join('');

  return `<h1 class="view-title">Reports</h1><p class="view-sub">Which quests land, which lag, and what to do next. Anonymous totals only.</p>
  <div class="btn-row range" role="group" aria-label="Time range">${rangeBtns}<button type="button" class="btn ghost sm" data-act="exportcsv">${icon('down')}Export CSV</button></div>
  ${S.api.mode === 'demo' ? '<span class="sample-flag">Sample data</span>' : ''}
  <div class="kpis">
    <div class="kpi"><div class="big">${pct(A.kpi.avgRate, 1)}%</div><div class="lbl">Average share of members who finished a quest</div></div>
    <div class="kpi"><div class="big">${pct(A.kpi.returning, 1)}%</div><div class="lbl">Of last week’s active members were also active the week before</div></div>
    <div class="kpi"><div class="big">${pct(A.kpi.first20, 1)}%</div><div class="lbl">Of a timed wave’s finishes land in its first 20 minutes</div></div>
    <div class="kpi"><div class="big">${A.kpi.runs}</div><div class="lbl">Quests run in this range, with ${A.kpi.newMembers} new members</div></div>
  </div>
  <fieldset class="box"><legend>Running now</legend>${paceRows ? `<ul class="lib">${paceRows}</ul><p class="hint">Pace compares finishes so far with how quests of the same kind usually build up. A second call reposts the quest to Discord once.</p>` : '<p class="note">Nothing is live right now.</p>'}</fieldset>
  <div class="pulse-grid"><div>
    <fieldset class="box chart"><legend>Week by week</legend>${trendChart(A.trend)}<div class="legend-row" style="margin-top:6px"><span><b style="background:var(--gold)"></b>Average finish rate</span><span><b style="background:var(--sea);border-radius:50%"></b>Share of members active</span></div></fieldset>
    <fieldset class="box"><legend>Beat their kind’s average</legend>${strong.length ? `<ul class="lib">${strong.map(r => questLine(r, runAgain(r))).join('')}</ul>` : '<p class="note">Nothing stands out yet. Patterns show up after a few weeks.</p>'}</fieldset>
    <fieldset class="box"><legend>Fell short of their kind’s average</legend>${lag.length ? `<ul class="lib">${lag.map(r => questLine(r, rework(r))).join('')}</ul><p class="hint">Try a different platform, an evening start, a shorter caption, or a voice note.</p>` : '<p class="note">No laggards in this range.</p>'}</fieldset>
  </div><div>
    <fieldset class="box"><legend>By kind of quest</legend>${bars(A.byKind, kindName)}</fieldset>
    <fieldset class="box"><legend>By platform</legend>${bars(A.byPlatform, platName)}</fieldset>
    <fieldset class="box"><legend>By start time</legend>${bars(A.bySlot.slice(0, 8), x => x)}</fieldset>
    <fieldset class="box"><legend>Evergreen library health</legend><ul class="lib">${lib || '<li>No evergreen runs yet.</li>'}</ul></fieldset>
    ${A.secondCalls.n ? `<fieldset class="box"><legend>Second calls</legend><p class="note">Used ${A.secondCalls.n} times. On average ${pct(A.secondCalls.lift, 1)}% of those quests’ finishes came after the second call.</p></fieldset>` : ''}
  </div></div>
  <p class="fine">Finish rate is finishes divided by members who could see the quest. Quests seen by fewer than ${MIN_AUDIENCE} members are left out of comparisons. “Kind’s average” compares amplify quests with amplify quests, and so on.</p>`;
}

export function reportCsv(S) {
  const A = analyze(S.gm.report.rows, S.gm.report.weeks, S.gm.templates);
  const head = ['date', 'title', 'kind', 'class', 'shelf', 'platform', 'guild', 'audience', 'opens', 'finishes', 'finish_rate_pct', 'kind_avg_pct', 'vs_kind_points', 'first_20_min_pct', 'avg_minutes_to_finish', 'second_call', 'flag'];
  const lines = A.R.map(r => [new Date(r.start).toISOString().slice(0, 16).replace('T', ' '), r.title, r.kind, en(CLASSES[r.cls] && CLASSES[r.cls].name), r.shelf, r.platform, r.guild || '',
    r.aud, r.opens, r.completions, pct(r.rate, 1), pct(r.base, 1), r.delta, r.first20 == null ? '' : pct(r.first20, 1), r.avgMins == null ? '' : Math.round(r.avgMins), r.second_call ? 'yes' : 'no', r.small ? 'small sample' : (r.live ? 'live' : r.flag)]);
  return csv([head].concat(lines));
}
