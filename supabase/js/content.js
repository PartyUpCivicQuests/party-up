// Game content. Edit here to rename classes, add platforms, or tune XP.
// Note: XP per kind is also set in supabase/01_schema.sql (quests_guard) so it can't be edited from the browser.

export const CLASSES = {
  paladin: { name: { en: 'Paladin', es: 'Paladín' },   does: { en: 'Boosts allies', es: 'Impulsa aliados' } },
  bard:    { name: { en: 'Bard', es: 'Bardo' },        does: { en: 'Breaks bubbles', es: 'Rompe burbujas' } },
  rogue:   { name: { en: 'Rogue', es: 'Pícaro' },      does: { en: 'Mirror moves', es: 'Jugadas espejo' } },
  ranger:  { name: { en: 'Ranger', es: 'Explorador' }, does: { en: 'Scouts the field', es: 'Explora el terreno' } },
  cleric:  { name: { en: 'Cleric', es: 'Clérigo' },    does: { en: 'Recruits and welcomes', es: 'Recluta y recibe' } },
  druid:   { name: { en: 'Druid', es: 'Druida' },      does: { en: 'Works the streets', es: 'Trabaja en la calle' } },
  wizard:  { name: { en: 'Wizard', es: 'Mago' },       does: { en: 'Search waves', es: 'Olas de búsqueda' } },
  monk:    { name: { en: 'Monk', es: 'Monje' },        does: { en: 'Ignores the trolls', es: 'Ignora a los trols' } }
};
export const CLASS_ORDER = ['paladin', 'bard', 'rogue', 'ranger', 'cleric', 'druid', 'wizard', 'monk'];

// Reddit is left out on purpose: organized voting or commenting on a specific
// thread is brigading under Reddit's rules. See docs/PRINCIPLES.md.
export const PLATFORMS = {
  instagram: { en: 'Instagram' }, facebook: { en: 'Facebook' }, youtube: { en: 'YouTube' }, tiktok: { en: 'TikTok' },
  x: { en: 'X' }, threads: { en: 'Threads' }, bluesky: { en: 'Bluesky' }, google: { en: 'Google search', es: 'Búsqueda en Google' },
  chat: { en: 'Group chat', es: 'Chat de grupo' }, profile: { en: 'Your profiles', es: 'Tus perfiles' }, street: { en: 'In person', es: 'En persona' }
};
export const PLATFORM_ORDER = ['instagram', 'facebook', 'youtube', 'tiktok', 'x', 'threads', 'bluesky', 'google', 'chat', 'profile', 'street'];

export const KINDS = {
  amplify: { cls: 'paladin', xp: 30, label: 'Amplify a post' },
  bubble:  { cls: 'bard',    xp: 20, label: 'Share beyond the bubble' },
  mirror:  { cls: 'rogue',   xp: 25, label: 'Mirror move' },
  scout:   { cls: 'ranger',  xp: 15, label: 'Scout report' },
  recruit: { cls: 'cleric',  xp: 20, label: 'Recruit' },
  street:  { cls: 'druid',   xp: 35, label: 'In person' },
  search:  { cls: 'wizard',  xp: 15, label: 'Search wave' }
};
export const KIND_ORDER = ['amplify', 'bubble', 'mirror', 'scout', 'recruit', 'street', 'search'];

export const STEPS = {
  open:     { en: 'Open it on {p}', es: 'Ábrelo en {p}' },
  search:   { en: 'Search it now', es: 'Búscalo ahora' },
  openlink: { en: 'Open the link', es: 'Abre el enlace' },
  watch:    { en: 'Watch to the end', es: 'Míralo hasta el final' },
  like:     { en: 'Like it', es: 'Dale me gusta' },
  save:     { en: 'Save it', es: 'Guárdalo' },
  share:    { en: 'Share it', es: 'Compártelo' },
  comment:  { en: 'Comment in your own words', es: 'Comenta con tus propias palabras' },
  sendchat: { en: 'Share to a group chat', es: 'Compártelo en un chat de grupo' },
  invite:   { en: 'Send your invite link', es: 'Envía tu enlace de invitación' }
};
export const STEP_OPTIONS = [
  ['open', 'Open the post'], ['watch', 'Watch to the end'], ['like', 'Like it'], ['save', 'Save it'],
  ['share', 'Share it'], ['comment', 'Comment in your own words'], ['sendchat', 'Share to a group chat'], ['invite', 'Send invite link']
];

// Level n starts at 60 * (n-1) * n XP.
export function levelOf(xp) {
  let n = 1; while (60 * n * (n + 1) <= xp) n++;
  const lo = 60 * (n - 1) * n, hi = 60 * n * (n + 1);
  return { n, pct: Math.round((xp - lo) / (hi - lo) * 100), left: hi - xp };
}
export function classLevel(xp) { return Math.floor(Math.sqrt((xp || 0) / 20)) + 1; }
export function topClass(classXp = {}) {
  let best = 'paladin';
  for (const c of CLASS_ORDER) if ((classXp[c] || 0) > (classXp[best] || 0)) best = c;
  return best;
}

// Campaign-button badges, earned from totals the app already has.
export const BADGES = [
  { id: 'first',  t: { en: 'First quest', es: 'Primera misión' },      style: '',   earned: me => me.xp_total > 0 },
  { id: 'streak4', t: { en: '4-week streak', es: 'Racha de 4 semanas' }, style: 's',  earned: me => me.streak >= 4 },
  { id: 'recruit', t: { en: 'Recruiter', es: 'Reclutador' },          style: 'i2', earned: me => me.recruits >= 1 },
  { id: 'bard',   t: { en: 'Bubble breaker', es: 'Rompe­burbujas' },     style: '',   earned: me => (me.class_xp?.bard || 0) >= 100 },
  { id: 'streak10', t: { en: '10-week streak', es: 'Racha de 10 semanas' }, style: 's', earned: me => me.streak >= 10 },
  { id: 'rogue',  t: { en: 'Mirror master', es: 'Maestro del espejo' }, style: 'i2', earned: me => (me.class_xp?.rogue || 0) >= 100 },
  { id: 'druid',  t: { en: 'Street team', es: 'Equipo de calle' },      style: '',   earned: me => (me.class_xp?.druid || 0) >= 100 },
  { id: 'monk',   t: { en: 'Unbothered', es: 'Imperturbable' },         style: 's',  earned: me => (me.class_xp?.monk || 0) >= 60 }
];
