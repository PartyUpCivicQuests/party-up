// Demo backend: same functions as backend-supabase.js, backed by sample data
// stored in this browser. Used when js/config.js is blank, so anyone can try
// Party Up (and contributors can work on it) without a database.
import { MIN, HOUR, DAY, addDays, ymd, dayTs, localWeekStart, atLocal } from './util.js';
import { KINDS } from './content.js';

const KEY = 'partyup-demo-v2';
const wait = (v) => new Promise(r => setTimeout(() => r(structuredClone(v)), 60));
const fail = (msg) => new Promise((_, rej) => setTimeout(() => rej(new Error(msg)), 60));
let uid = 0;
const newId = (p = 'q') => `${p}-${Date.now().toString(36)}-${(uid++).toString(36)}`;

function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const GUILDS = [
  { id: 'g-nat', name: 'National', parent_id: null }, { id: 'g-mn', name: 'Minnesota', parent_id: 'g-nat' },
  { id: 'g-tc', name: 'Twin Cities', parent_id: 'g-mn' }, { id: 'g-dul', name: 'Duluth', parent_id: 'g-mn' },
  { id: 'g-roc', name: 'Rochester', parent_id: 'g-mn' }, { id: 'g-stc', name: 'St. Cloud', parent_id: 'g-mn' },
  { id: 'g-ir', name: 'Iron Range', parent_id: 'g-mn' }
];
const TEMPLATES = [
  { id: 't1', title: 'Invite a friend who usually tunes out the news', flavor: 'Not your most political friend. Your most fun one.', kind: 'recruit', platform: 'chat', steps: ['invite'], sort: 10, active: true },
  { id: 't2', title: 'Follow train: follow five people in your guild', flavor: 'More of us following each other means more of us seen.', kind: 'amplify', platform: 'instagram', steps: ['open'], sort: 20, active: true },
  { id: 't3', title: 'Boost the week’s three picks', flavor: 'Watch, like, save, share. Three posts, ten minutes.', kind: 'amplify', platform: 'facebook', steps: ['open', 'watch', 'like', 'save', 'share'], sort: 30, active: true },
  { id: 't4', title: 'Share this week’s explainer in a group chat', flavor: 'Pick a chat that isn’t already on our side.', kind: 'bubble', platform: 'chat', steps: ['sendchat'], sort: 40, active: true },
  { id: 't5', title: 'Banner or profile frame for a day', flavor: 'Show your face. It changes who feels safe to agree.', kind: 'bubble', platform: 'profile', steps: ['open'], sort: 50, active: true },
  { id: 't6', title: 'Flyer or QR drop', flavor: 'Library, laundromat, coffee shop. Ask first.', kind: 'street', platform: 'street', steps: ['open'], sort: 60, active: true },
  { id: 't7', title: 'Scout report: what’s spreading near you?', flavor: 'Tell your captain what your feeds are full of. Don’t engage it.', kind: 'scout', platform: 'chat', steps: ['comment'], sort: 70, active: true }
];

function quest(o) {
  const k = KINDS[o.kind] || KINDS.amplify;
  return Object.assign({ id: newId(), flavor: null, link: null, steps: [], caption: null, note: null, source: null, tr: {}, claim: false, signed_by: null,
    guild_id: 'g-mn', starts_at: null, ends_at: null, stale_at: null, week_of: null, confirmed: true, shelved: false, correction: null,
    template_id: null, replaces: null, announced_at: null, second_call_requested: false, second_call_at: null, created_by: 'u-me', created_at: new Date().toISOString() },
    o, { cls: k.cls, xp: k.xp });
}
const iso = t => new Date(t).toISOString();

function buildHistory(w0) {
  const r = rng(20261105);
  const base = { amplify: .48, bubble: .37, mirror: .30, scout: .17, recruit: .33, street: .21, search: .41 };
  const plat = { instagram: .03, facebook: .02, youtube: 0, tiktok: -.13, x: -.06, threads: -.02, bluesky: .04, chat: 0, profile: .08, street: 0, google: 0 };
  const plan = [
    ['amplify', 'instagram', 'rapid', 'Lift the canvass recap video'], ['bubble', 'chat', 'evergreen', null, 't4'], ['recruit', 'chat', 'evergreen', null, 't1'],
    ['amplify', 'facebook', 'evergreen', null, 't3'], ['search', 'google', 'dated', 'Search wave: how to request a mail ballot'], ['amplify', 'tiktok', 'rapid', 'Duet the nurse’s clinic video'],
    ['street', 'street', 'evergreen', null, 't6'], ['mirror', 'x', 'rapid', 'Mirror move: answer their tag with ours'], ['bubble', 'profile', 'dated', 'Banner hour: jerseys on'],
    ['amplify', 'youtube', 'dated', 'Watch the town hall to the end'], ['scout', 'chat', 'evergreen', null, 't7'], ['amplify', 'bluesky', 'rapid', 'Repost the volunteer thread']
  ];
  const quests = [], stats = {}, weeks = [];
  let members = 34;
  for (let k = 12; k >= 1; k--) {
    const ws = addDays(w0, -7 * k);
    const joined = 4 + Math.floor(r() * 9);
    members += joined;
    let weekDone = 0;
    for (let j = 0; j < 3; j++) {
      const p = plan[(12 - k) * 3 % plan.length + j] || plan[j];
      const [kind, platform, shelf, title, tid] = p;
      const tmpl = tid ? TEMPLATES.find(t => t.id === tid) : null;
      const day = [1, 3, 4][j], hour = [12, 19, 17][j];
      const start = shelf === 'evergreen' ? null : addDays(ws, day) + hour * HOUR;
      let rate = base[kind] + (plat[platform] || 0) + (hour >= 17 ? .05 : -.03) + (r() - .5) * .12;
      if (tid === 't3') rate -= (12 - k) * .022;                // gets stale with reuse
      if (tid === 't1') rate += (12 - k) * .006;
      rate = Math.max(.04, Math.min(.85, rate));
      const audience = members;
      const done = Math.round(audience * rate);
      const opens = Math.min(audience, done + Math.round(audience * (.12 + r() * .18)));
      const q = quest({ id: `h-${k}-${j}`, title: tmpl ? tmpl.title : title, flavor: tmpl ? tmpl.flavor : null, kind, platform, shelf,
        steps: tmpl ? tmpl.steps : ['open', 'like', 'share'], template_id: tid || null, guild_id: 'g-mn',
        week_of: shelf === 'evergreen' ? ymd(ws) : null, starts_at: start ? iso(start) : null, ends_at: start ? iso(start + HOUR) : null,
        source: 'https://example.org/source', announced_at: iso(start || ws), created_at: iso((start || ws) - 3 * DAY) });
      if (k === 9 && j === 0) q.correction = 'The canvass was Sunday, not Saturday. The original wording stays on the record.';
      const buckets = Array(12).fill(0);
      if (start) { let left = done; for (let b = 0; b < 12 && left > 0; b++) { const n = b === 11 ? left : Math.round(left * (.28 - b * .012)); buckets[b] = Math.min(left, Math.max(0, n)); left -= buckets[b]; } }
      stats[q.id] = { opens, completions: done, buckets, minutes_sum: done * (start ? 13 : 1900), after_second_call: 0 };
      quests.push(q);
      weekDone += done;
    }
    const active = Math.round(members * (.5 + r() * .12));
    weeks.push({ week: ymd(ws), active, returners: Math.round(active * (.6 + (12 - k) * .008 + r() * .05)), new_members: joined, completions: weekDone, members });
  }
  return { quests, stats, weeks, members };
}

function seed() {
  const now = Date.now(), w0 = localWeekStart(now), w0s = ymd(w0);
  const hist = buildHistory(w0);
  const live = quest({ id: 'q-live', kind: 'amplify', shelf: 'rapid', platform: 'instagram', guild_id: 'g-tc',
    title: 'Lift the Northside rally video', flavor: 'Phones up, no polish, real neighbors. Let’s carry it.',
    note: 'Hey, party. Quick one. Our Northside crew filmed last night’s rally on their phones. Watch it to the end, like it, save it, and share it to your story. If a troll shows up in the comments, scroll right past. Onward.',
    tr: { es: { title: 'Impulsa el video del mitin de Northside', flavor: 'Celulares en alto, sin filtros, vecinos de verdad. Llevémoslo lejos.',
      note: 'Hola, equipo. Algo rápido. Nuestro grupo de Northside grabó el mitin de anoche con sus celulares. Míralo hasta el final, dale me gusta, guárdalo y compártelo en tu historia. Si aparece un trol en los comentarios, sigue de largo. ¡Adelante!' } },
    steps: ['open', 'watch', 'like', 'save', 'share'], link: 'https://www.instagram.com/', source: 'https://example.org/northside-rally',
    starts_at: iso(now - 8 * MIN), ends_at: iso(now + 52 * MIN), announced_at: iso(now - 8 * MIN) });
  const cur = [
    live,
    quest({ id: 'q-banner', kind: 'bubble', shelf: 'dated', platform: 'profile', title: 'Banner hour: show your face',
      flavor: 'At 7:00 pm, everyone adds the Party Up frame to their profile photo at once.',
      tr: { es: { title: 'Hora del estandarte: da la cara', flavor: 'A las 7:00 pm, todos ponemos el marco de Party Up en la foto de perfil al mismo tiempo.' } },
      steps: ['open'], link: 'https://example.org/frame', source: 'https://example.org/frame', confirmed: false,
      starts_at: iso(atLocal(1, 19)), ends_at: iso(atLocal(1, 20)), stale_at: iso(atLocal(2, 19)) }),
    quest({ id: 'q-chat', kind: 'bubble', shelf: 'evergreen', platform: 'chat', week_of: w0s, template_id: 't4',
      title: 'Drop the paid leave explainer in a family chat', flavor: 'Bubbles break in group chats. Pick one that isn’t already on our side.',
      caption: 'This 2-minute video explains how Minnesota’s paid leave program works and who can apply.',
      tr: { es: { title: 'Comparte el explicador de licencia pagada en un chat familiar', flavor: 'Las burbujas se rompen en los chats de grupo. Elige uno que todavía no esté de nuestro lado.',
        caption: 'Este video de 2 minutos explica cómo funciona la licencia pagada de Minnesota y quién puede solicitarla.' } },
      steps: ['sendchat', 'comment'], link: 'https://example.org/paid-leave-explainer', source: 'https://example.org/paid-leave-source', announced_at: iso(w0) }),
    quest({ id: 'q-recruit', kind: 'recruit', shelf: 'evergreen', platform: 'chat', week_of: w0s, template_id: 't1', guild_id: 'g-nat',
      title: TEMPLATES[0].title, flavor: TEMPLATES[0].flavor, steps: ['invite'],
      tr: { es: { title: 'Invita a alguien a quien no le interese la política', flavor: 'No tu amistad más política. La más divertida.' } }, announced_at: iso(w0) }),
    quest({ id: 'q-flyer', kind: 'street', shelf: 'evergreen', platform: 'street', week_of: w0s, template_id: 't6', guild_id: 'g-tc',
      title: 'Pin a QR flyer on a community board', flavor: 'Library, laundromat, coffee shop. Ask first.', steps: ['open'], link: 'https://example.org/flyer', announced_at: iso(w0) }),
    quest({ id: 'q-town', kind: 'amplify', shelf: 'dated', platform: 'facebook', claim: true, confirmed: false,
      title: 'Share the town hall clip', flavor: 'Two minutes of our state rep answering a nurse’s question.', steps: ['open', 'watch', 'share'],
      link: 'https://www.facebook.com/', source: 'https://example.org/townhall', starts_at: iso(addDays(w0, 8) + 18.5 * HOUR), ends_at: iso(addDays(w0, 8) + 19.5 * HOUR) }),
    quest({ id: 'q-search', kind: 'search', shelf: 'dated', platform: 'google',
      title: 'Search wave: Minnesota paid leave', flavor: 'At noon, search it, open an official result, and read for a minute.',
      tr: { es: { title: 'Ola de búsqueda: licencia pagada en Minnesota', flavor: 'Al mediodía, búscalo, abre un resultado oficial y lee un minuto.' } },
      steps: ['open'], link: 'https://www.google.com/search?q=minnesota+paid+leave+how+to+apply', source: 'https://example.org/paid-leave-source',
      starts_at: iso(addDays(w0, 10) + 12 * HOUR), ends_at: iso(addDays(w0, 10) + 13 * HOUR) })
  ];
  const stats = Object.assign({}, hist.stats, {
    'q-live': { opens: 61, completions: 27, buckets: [9, 11, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0], minutes_sum: 27 * 6, after_second_call: 0 },
    'q-chat': { opens: 44, completions: 19, buckets: Array(12).fill(0), minutes_sum: 19 * 1500, after_second_call: 0 },
    'q-recruit': { opens: 30, completions: 11, buckets: Array(12).fill(0), minutes_sum: 11 * 1800, after_second_call: 0 },
    'q-flyer': { opens: 22, completions: 6, buckets: Array(12).fill(0), minutes_sum: 6 * 2100, after_second_call: 0 }
  });
  const weeks = hist.weeks.concat([{ week: w0s, active: 58, returners: 41, new_members: 9, completions: 63, members: hist.members + 9 }]);
  return {
    week: w0s, members: hist.members + 9,
    me: { id: 'u-me', handle: 'Ari', guild_id: 'g-tc', role: 'guildmaster', lang: 'en', max_per_week: 5, quiet_hours: true,
      xp_total: 2610, xp_week: 140, week_done: 1, week_start: w0s, last_active_week: w0s, streak: 6, shields: 1,
      class_xp: { paladin: 920, bard: 740, cleric: 380, druid: 220, wizard: 160, monk: 120, rogue: 40, ranger: 30 },
      vow_week: null, buddy_code: 'K7X2QP', recruits: 3, invite_code: 'ARI7Q3', created_at: iso(addDays(w0, -60)) },
    buddy: { handle: 'Maya', week_done: 2, streak: 4 },
    account: { email: '', pending: '', anonymous: true },
    quests: hist.quests.concat(cur), stats, weeks, done: [],
    templates: TEMPLATES.slice(),
    guilds: GUILDS.slice(),
    invites: [
      { code: 'FOUNDER', guild_id: 'g-tc', created_by: null, max_uses: 5, uses: 2, note: 'First organizers', created_at: iso(addDays(w0, -60)) },
      { code: 'DISCORD1', guild_id: 'g-mn', created_by: null, max_uses: 200, uses: 87, note: 'First Discord testers', created_at: iso(addDays(w0, -50)) },
      { code: 'ARI7Q3', guild_id: 'g-tc', created_by: 'u-me', max_uses: 25, uses: 3, note: 'personal', created_at: iso(addDays(w0, -60)) }
    ],
    settings: { id: 1, tz: 'America/Chicago', autopilot: true, min_per_week: 3, app_url: '', discord_url: 'https://discord.com/' },
    crew: [
      { handle: 'Ari', role: 'guildmaster', guild: 'Twin Cities', joined: iso(addDays(w0, -60)), recruits: 3 },
      { handle: 'Jordan', role: 'captain', guild: 'Duluth', joined: iso(addDays(w0, -45)), recruits: 6 },
      { handle: 'Maya', role: 'member', guild: 'Twin Cities', joined: iso(addDays(w0, -40)), recruits: 2 },
      { handle: 'Dev', role: 'member', guild: 'St. Cloud', joined: iso(addDays(w0, -20)), recruits: 0 }
    ],
    board: [{ handle: 'Maya', xp: 210 }, { handle: 'Dev', xp: 185 }, { handle: 'Aunt Linda', xp: 160 }, { handle: 'Sam K.', xp: 120 }, { handle: 'Priya', xp: 95 }, { handle: 'Grandpa Joe', xp: 80 }, { handle: 'Chris', xp: 45 }],
    turnout: [{ name: 'Duluth', rate: 81, members: 22 }, { name: 'Twin Cities', rate: 74, members: 96, is_mine: true }, { name: 'Iron Range', rate: 70, members: 10 }, { name: 'Rochester', rate: 63, members: 19 }, { name: 'St. Cloud', rate: 58, members: 12 }]
  };
}

export function createApi() {
  let db;
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
  if (!db || db.week !== ymd(localWeekStart())) db = seed();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or blocked */ } };
  // Keep the sample wave alive so the demo always has something to do.
  const live = db.quests.find(q => q.id === 'q-live');
  if (live && new Date(live.ends_at).getTime() < Date.now()) {
    live.starts_at = iso(Date.now() - 8 * MIN); live.ends_at = iso(Date.now() + 52 * MIN);
    db.done = db.done.filter(id => id !== 'q-live');
  }
  save();

  const now = () => Date.now();
  const startOf = q => q.starts_at ? new Date(q.starts_at).getTime() : dayTs(q.week_of);
  const meOut = () => Object.assign({}, db.me, { cur_week: db.week, guild_name: (db.guilds.find(g => g.id === db.me.guild_id) || {}).name, discord_url: db.settings.discord_url });
  function visibleToMember(q) {
    if (q.shelved || (q.claim && !q.signed_by)) return false;
    if (q.shelf === 'evergreen') return q.week_of === db.week;
    const s = new Date(q.starts_at).getTime(), e = new Date(q.ends_at).getTime();
    return q.confirmed && e > now() && s < now() + 8 * DAY;
  }
  function award(cls, xp) {
    const roll = 1 + Math.floor(Math.random() * 20), gain = xp + (roll === 20 ? 10 : 0);
    db.me.xp_total += gain; db.me.xp_week += gain;
    db.me.class_xp[cls] = (db.me.class_xp[cls] || 0) + gain;
    return { roll, gain, cls };
  }

  return {
    mode: 'demo',
    init: () => wait(meOut()),
    join: () => wait(meOut()),
    me: () => wait(meOut()),
    updateMe(p) {
      if (!p.handle || p.handle.length > 24) return fail('Pick a name between 1 and 24 characters.');
      Object.assign(db.me, { handle: p.handle, lang: p.lang, max_per_week: p.max_per_week, quiet_hours: p.quiet_hours }); save(); return wait(meOut());
    },
    memberQuests: () => wait(db.quests.filter(visibleToMember)),
    myCompletions: () => wait(db.done),
    complete(id) {
      const q = db.quests.find(x => x.id === id);
      if (!q || !visibleToMember(q)) return fail('This quest isn’t open to you.');
      if (q.shelf !== 'evergreen' && new Date(q.starts_at).getTime() > now()) return fail('This wave hasn’t started yet.');
      if (db.done.includes(id)) return fail('Already done. Nice work.');
      db.done.push(id);
      const first = db.me.week_done === 0;
      db.me.week_done += 1;
      if (first) db.me.streak += 1;
      const res = award(q.cls, q.xp);
      const st = db.stats[id] || (db.stats[id] = { opens: 0, completions: 0, buckets: Array(12).fill(0), minutes_sum: 0, after_second_call: 0 });
      const mins = Math.max(0, Math.floor((now() - startOf(q)) / MIN));
      st.completions += 1; st.minutes_sum += mins;
      if (q.shelf !== 'evergreen' && mins < 60) st.buckets[Math.floor(mins / 5)] += 1;
      save(); return wait(res);
    },
    keepVow() {
      if (db.me.vow_week === db.week) return fail('Already kept this week.');
      db.me.vow_week = db.week; const res = award('monk', 15); save(); return wait(res);
    },
    opened(id) { const st = db.stats[id] || (db.stats[id] = { opens: 0, completions: 0, buckets: Array(12).fill(0), minutes_sum: 0, after_second_call: 0 }); st.opens += 1; save(); return wait(null); },
    board: () => wait(db.board.concat([{ handle: db.me.handle, xp: db.me.xp_week, is_me: true }]).sort((a, b) => b.xp - a.xp)),
    turnout: () => wait(db.turnout),
    buddy: () => wait(db.buddy),
    linkBuddy(code) { if (!code) return fail('No one has that buddy code.'); db.buddy = { handle: 'Sam K.', week_done: 1, streak: 2 }; save(); return wait('Sam K.'); },
    unlinkBuddy() { db.buddy = null; save(); return wait(null); },
    account: () => wait(db.account),
    linkEmail(email) { db.account = { email: '', pending: email, anonymous: true }; save(); return wait(null); },
    signInEmail: () => wait(null),
    signOut() { localStorage.removeItem(KEY); return wait(null); },

    currentWeek: () => wait(db.week),
    gmQuests() {
      const from = dayTs(db.week), to = addDays(from, 14);
      return wait(db.quests.filter(q => { const s = startOf(q); return s >= from && s < to; }).sort((a, b) => startOf(a) - startOf(b)));
    },
    saveQuest(row) {
      const q = quest(Object.assign({}, row, { id: newId(), created_by: 'u-me', created_at: iso(now()) }));
      if (q.shelf !== 'evergreen' && new Date(q.starts_at).getTime() <= now() + 48 * HOUR) q.confirmed = true;
      if (q.shelf === 'evergreen') q.confirmed = true;
      q.signed_by = null; db.quests.push(q); save(); return wait(q);
    },
    updateQuest(id, patch) {
      const q = db.quests.find(x => x.id === id); if (!q) return fail('Quest not found.');
      Object.assign(q, patch);
      if (patch.kind) Object.assign(q, { cls: KINDS[patch.kind].cls, xp: KINDS[patch.kind].xp });
      save(); return wait(q);
    },
    secondCall(id) { const q = db.quests.find(x => x.id === id); if (q) { q.second_call_requested = true; q.second_call_at = iso(now()); } save(); return wait(null); },
    templates: () => wait(db.templates.slice().sort((a, b) => a.sort - b.sort)),
    saveTemplate(row) { const t = Object.assign({ id: newId('t'), sort: 100, active: true }, row); db.templates.push(t); save(); return wait(t); },
    updateTemplate(id, patch) { const t = db.templates.find(x => x.id === id); Object.assign(t, patch); save(); return wait(t); },
    archive: () => wait(db.quests.slice().sort((a, b) => b.created_at.localeCompare(a.created_at))),
    reportQuests(days) {
      const since = now() - days * DAY;
      const rows = db.quests.filter(q => !(q.claim && !q.signed_by)).map(q => {
        const s = startOf(q), st = db.stats[q.id] || { opens: 0, completions: 0, buckets: Array(12).fill(0), minutes_sum: 0, after_second_call: 0 };
        const hist = db.weeks.find(w => w.week === ymd(localWeekStart(s)));
        return { id: q.id, title: q.title, kind: q.kind, cls: q.cls, shelf: q.shelf, platform: q.platform,
          guild: (db.guilds.find(g => g.id === q.guild_id) || {}).name || null, run_at: iso(s), template_id: q.template_id, shelved: q.shelved,
          corrected: !!q.correction, audience: hist ? hist.members : db.members, opens: st.opens, completions: st.completions,
          buckets: st.buckets, minutes_sum: st.minutes_sum, second_call: !!q.second_call_at, after_second_call: st.after_second_call,
          ends_at: q.ends_at || iso(addDays(s, 7)) };
      }).filter(r => { const t = new Date(r.run_at).getTime(); return t >= since && t <= now(); });
      return wait(rows.sort((a, b) => b.run_at.localeCompare(a.run_at)));
    },
    reportWeeks: (n) => wait(db.weeks.slice(-n - 1)),
    crew: () => wait(db.crew),
    setRole(handle, role) { const c = db.crew.find(x => x.handle.toLowerCase() === String(handle).toLowerCase()); if (!c) return fail('No one goes by that name.'); c.role = role; save(); return wait(null); },
    invites: () => wait(db.invites),
    createInvite(guildId, max, note) { const code = Math.random().toString(36).slice(2, 8).toUpperCase(); db.invites.unshift({ code, guild_id: guildId, created_by: 'u-me', max_uses: max, uses: 0, note, created_at: iso(now()) }); save(); return wait(code); },
    guilds: () => wait(db.guilds),
    addGuild(name, parentId) { const g = { id: newId('g'), name, parent_id: parentId || null }; db.guilds.push(g); save(); return wait(g); },
    settings: () => wait(db.settings),
    saveSettings(s) { Object.assign(db.settings, s); save(); return wait(null); }
  };
}
