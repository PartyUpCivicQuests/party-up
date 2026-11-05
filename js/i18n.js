// Member-facing words in English and Spanish. To add a language, copy the
// `es` block, translate it, and add the code to LANGS. Organizer screens are
// English-only for now. Quest text is translated per quest in the composer.

export const LANGS = { en: 'English', es: 'Español' };

const T = {
  en: {
    tabQuests: 'Quests', tabParty: 'Party', tabSheet: 'Sheet', modePlay: 'Adventurer', modeLead: 'Guildmaster',
    loading: 'Loading…', retry: 'Try again', errorBox: 'Something went wrong.',
    waveNow: 'Wave now', alsoLive: 'Also live', endsIn: 'Ends in', startsIn: 'Starts in',
    upNext: 'Up next', anytime: 'Open anytime', anytimeNote: 'No timer. Do them when it suits you.',
    noWave: 'No wave right now.', nextWave: w => `Next one: ${w}.`, nothingYet: 'No quests this week yet. Check back soon.',
    vow: 'This week’s vow', vowTitle: 'Vow of Silence', iKept: 'I kept the vow', vowDone: 'Vow kept this week',
    vowText: 'This week: no replies, no quote-posts, no hate-watching their stuff. Scroll past and the algorithm learns.',
    iDidIt: 'I did it', doneLabel: x => `Done. +${x} XP`, doneShort: 'Done', notYet: 'Opens when the wave starts',
    play: 'Play the Guildmaster’s note', stop: 'Stop the note', readIt: 'Read it instead',
    copy: 'Copy caption', copied: 'Copied', source: 'Source', correction: 'Correction',
    trolls: 'See a troll? Scroll past. Any reply feeds them.',
    streak: 'Week streak', weekDone: 'Done this week', shieldsAria: n => `${n} of 2 streak shields`,
    lvTitle: (lv, c) => `Level ${lv} ${c}`, xpLeft: (x, lv) => `${x} XP to level ${lv}`,
    partyQuest: 'Party quest', partyGoal: b => `You and ${b}: five quests together this week.`,
    youKey: 'You', buddy: 'Buddy streak', weeksWord: 'weeks',
    buddyTxt: (b, n) => `You and ${b} have both shown up ${n} weeks running.`,
    pairUp: 'Pair up with a buddy', pairNote: 'Trade buddy codes with one friend. You’ll share a weekly goal.',
    yourCode: 'Your buddy code', theirCode: 'Their buddy code', pair: 'Pair up', unpair: 'Unpair',
    paired: b => `Paired with ${b}.`,
    board: 'This week in your guild', boardNote: 'Points come from quests finished, not likes.', you: 'You',
    guilds: 'Guild turnout this week', guildsNote: 'Ranked by the share of members who answered a call, so small guilds can win.',
    invite: 'Bring someone in', inviteNote: 'Share your link or let them scan this. Nobody’s contacts get uploaded.',
    copyLink: 'Copy link', share: 'Share', linkCopied: 'Link copied',
    inviteText: 'Come do civic quests with me on Party Up. A few minutes a week:',
    sheet: 'Character sheet', handle: 'Name on the board', handleNote: 'Other members in your guild can see this name.',
    save: 'Save', saved: 'Saved', totalXp: x => `${x.toLocaleString('en-US')} XP all time`,
    classes: 'Classes', classesNote: 'Every quest feeds a class. Your title is your strongest one. Nothing is locked.',
    buttons: 'Buttons earned', settings: 'Settings', language: 'Language',
    budget: 'Most quests I want per week', quiet: 'Quiet hours, 9 pm to 8 am',
    alerts: 'Quest alerts', alertsNote: 'New quests are posted in our Discord. Phone notifications come later.', joinDiscord: 'Open our Discord',
    privacy: 'Party Up keeps your XP, buttons, and streak. The record of which quests you did is deleted a day after each quest closes. Organizers only ever see anonymous totals.',
    devices: 'Use Party Up on another device', devicesNote: 'Add an email so you can sign in elsewhere. We use it for sign-in links only.',
    email: 'Email', addEmail: 'Send confirmation link', emailSent: 'Check your email for the link.',
    signedInAs: e => `Signed in as ${e}.`, signOut: 'Sign out', signOutWarn: 'You haven’t added an email, so signing out loses this character. Sign out anyway?',
    nat20: 'Natural 20! Bonus 10 XP.', toClass: c => `to ${c}`, back: 'Back to quests',
    joinTitle: 'Join the party', joinNote: 'Civic quests that take a few minutes. Real people, real accounts, no bots.',
    code: 'Invite code', pickName: 'Name on the board', pickNameNote: 'First name, nickname, anything. Your guild sees it.',
    join: 'Join', returning: 'Already joined on another device?', getLink: 'Email me a sign-in link',
    shareCopied: 'Copied. Paste it into your chat.', shareFail: 'Copy this:',
    trDone: 'Volunteer translation', trPending: 'Translation pending',
    demoBanner: 'Demo mode: sample data stored on this device. Connect Supabase in js/config.js to go live.',
    footer: 'Real people, real accounts, by hand. Party Up never posts or clicks for you.'
  },
  es: {
    tabQuests: 'Misiones', tabParty: 'Grupo', tabSheet: 'Ficha', modePlay: 'Aventura', modeLead: 'Gremio',
    loading: 'Cargando…', retry: 'Reintentar', errorBox: 'Algo salió mal.',
    waveNow: 'Ola en curso', alsoLive: 'También en curso', endsIn: 'Termina en', startsIn: 'Empieza en',
    upNext: 'Lo que sigue', anytime: 'Cuando quieras', anytimeNote: 'Sin reloj. Hazlas cuando te convenga.',
    noWave: 'No hay ninguna ola en este momento.', nextWave: w => `La próxima: ${w}.`, nothingYet: 'Todavía no hay misiones esta semana. Vuelve pronto.',
    vow: 'El voto de esta semana', vowTitle: 'Voto de silencio', iKept: 'Cumplí el voto', vowDone: 'Voto cumplido esta semana',
    vowText: 'Esta semana: nada de responder, citar ni mirar su contenido por odio. Sigue de largo y el algoritmo aprende.',
    iDidIt: 'Listo, lo hice', doneLabel: x => `Hecho. +${x} XP`, doneShort: 'Hecho', notYet: 'Se abre cuando empiece la ola',
    play: 'Escuchar la nota del gremio', stop: 'Detener la nota', readIt: 'Prefiero leerla',
    copy: 'Copiar texto', copied: 'Copiado', source: 'Fuente', correction: 'Corrección',
    trolls: '¿Ves un trol? Sigue de largo. Responder lo alimenta.',
    streak: 'Racha semanal', weekDone: 'Hechas esta semana', shieldsAria: n => `${n} de 2 escudos de racha`,
    lvTitle: (lv, c) => `${c} de nivel ${lv}`, xpLeft: (x, lv) => `Faltan ${x} XP para el nivel ${lv}`,
    partyQuest: 'Misión de grupo', partyGoal: b => `Tú y ${b}: cinco misiones juntos esta semana.`,
    youKey: 'Tú', buddy: 'Racha en pareja', weeksWord: 'semanas',
    buddyTxt: (b, n) => `Tú y ${b} han participado ${n} semanas seguidas.`,
    pairUp: 'Forma pareja', pairNote: 'Intercambia códigos con una amistad. Compartirán una meta semanal.',
    yourCode: 'Tu código de pareja', theirCode: 'Su código', pair: 'Formar pareja', unpair: 'Deshacer pareja',
    paired: b => `Ahora haces pareja con ${b}.`,
    board: 'Esta semana en tu gremio', boardNote: 'Los puntos vienen de misiones terminadas, no de likes.', you: 'Tú',
    guilds: 'Participación de los gremios', guildsNote: 'Ordenados por la proporción de miembros que respondieron, así que los gremios pequeños pueden ganar.',
    invite: 'Invita a alguien', inviteNote: 'Comparte tu enlace o deja que escaneen esto. No se suben los contactos de nadie.',
    copyLink: 'Copiar enlace', share: 'Compartir', linkCopied: 'Enlace copiado',
    inviteText: 'Ven a hacer misiones cívicas conmigo en Party Up. Unos minutos por semana:',
    sheet: 'Ficha de personaje', handle: 'Nombre en el tablero', handleNote: 'Los miembros de tu gremio pueden ver este nombre.',
    save: 'Guardar', saved: 'Guardado', totalXp: x => `${x.toLocaleString('es-US')} XP en total`,
    classes: 'Clases', classesNote: 'Cada misión alimenta una clase. Tu título es la más fuerte. Nada está bloqueado.',
    buttons: 'Botones ganados', settings: 'Ajustes', language: 'Idioma',
    budget: 'Máximo de misiones por semana', quiet: 'Horas de silencio, de 9 pm a 8 am',
    alerts: 'Avisos de misiones', alertsNote: 'Las misiones nuevas se publican en nuestro Discord. Las notificaciones en el teléfono vendrán después.', joinDiscord: 'Abrir nuestro Discord',
    privacy: 'Party Up guarda tu XP, tus botones y tu racha. El registro de qué misiones hiciste se borra un día después de que cierra cada misión. Los organizadores solo ven totales anónimos.',
    devices: 'Usa Party Up en otro dispositivo', devicesNote: 'Agrega un correo para entrar desde otro lugar. Solo lo usamos para enlaces de acceso.',
    email: 'Correo', addEmail: 'Enviar enlace de confirmación', emailSent: 'Revisa tu correo para ver el enlace.',
    signedInAs: e => `Sesión iniciada como ${e}.`, signOut: 'Cerrar sesión', signOutWarn: 'No has agregado un correo, así que al cerrar sesión pierdes este personaje. ¿Cerrar sesión de todos modos?',
    nat20: '¡20 natural! 10 XP extra.', toClass: c => `para ${c}`, back: 'Volver a las misiones',
    joinTitle: 'Únete al grupo', joinNote: 'Misiones cívicas de pocos minutos. Personas reales, cuentas reales, sin bots.',
    code: 'Código de invitación', pickName: 'Nombre en el tablero', pickNameNote: 'Nombre, apodo, lo que quieras. Tu gremio lo ve.',
    join: 'Unirme', returning: '¿Ya te uniste en otro dispositivo?', getLink: 'Envíame un enlace de acceso',
    shareCopied: 'Copiado. Pégalo en tu chat.', shareFail: 'Copia esto:',
    trDone: 'Traducción voluntaria', trPending: 'Traducción pendiente',
    demoBanner: 'Modo demo: datos de muestra guardados en este dispositivo.',
    footer: 'Personas reales, cuentas reales, a mano. Party Up nunca publica ni hace clic por ti.'
  }
};

let lang = 'en';
export function setLang(l) { lang = T[l] ? l : 'en'; document.documentElement.lang = lang; }
export function getLang() { return lang; }
export function locale() { return lang === 'es' ? 'es-US' : 'en-US'; }
export function t(k, ...a) { const v = (T[lang] && T[lang][k] !== undefined) ? T[lang][k] : T.en[k]; return typeof v === 'function' ? v(...a) : (v ?? k); }
export function tx(o) { if (!o) return ''; if (typeof o === 'string') return o; return o[lang] || o.en || ''; }

// Quest text with its volunteer translation, if there is one.
export function qtx(q, field) {
  if (lang !== 'en' && q.tr && q.tr[lang] && q.tr[lang][field]) return q.tr[lang][field];
  return q[field] || '';
}
export function hasTr(q) { return lang === 'en' || !!(q.tr && q.tr[lang] && q.tr[lang].title); }
