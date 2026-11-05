// Live backend: Supabase (Postgres + auth). All writes go through database
// functions or security rules defined in supabase/01_schema.sql.
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.43.1/+esm';

export function createApi(cfg) {
  const sb = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const here = () => location.origin + location.pathname;
  async function rpc(fn, args = {}) {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data;
  }
  async function run(p) {
    const { data, error } = await p;
    if (error) throw new Error(error.message);
    return data;
  }

  return {
    mode: 'live',

    // ---------- members ----------
    async init() {
      const { data } = await sb.auth.getSession();
      if (!data.session) return null;
      return rpc('me');
    },
    async join(code, handle, lang) {
      const { data } = await sb.auth.getSession();
      if (!data.session) {
        const { error } = await sb.auth.signInAnonymously();
        if (error) throw new Error(error.message);
      }
      await rpc('join_with_code', { p_code: code, p_handle: handle, p_lang: lang });
      return rpc('me');
    },
    me: () => rpc('me'),
    async updateMe(p) {
      await rpc('update_me', { p_handle: p.handle, p_lang: p.lang, p_max: p.max_per_week, p_quiet: p.quiet_hours });
      return rpc('me');
    },
    memberQuests: () => rpc('member_quests'),
    myCompletions: () => rpc('my_completions'),
    complete: id => rpc('complete_quest', { p_quest: id }),
    keepVow: () => rpc('keep_vow'),
    opened: id => rpc('quest_opened', { p_quest: id }).catch(() => {}),
    board: () => rpc('guild_board'),
    turnout: () => rpc('guild_turnout'),
    buddy: async () => { const r = await rpc('my_buddy'); return r && r.length ? r[0] : null; },
    linkBuddy: code => rpc('link_buddy', { p_code: code }),
    unlinkBuddy: () => rpc('unlink_buddy'),
    async account() {
      const { data } = await sb.auth.getUser();
      const u = data && data.user;
      return { email: u && u.email ? u.email : '', pending: u && u.new_email ? u.new_email : '', anonymous: !!(u && u.is_anonymous) };
    },
    async linkEmail(email) {
      const { error } = await sb.auth.updateUser({ email }, { emailRedirectTo: here() });
      if (error) throw new Error(error.message);
    },
    async signInEmail(email) {
      const { error } = await sb.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: here() } });
      if (error) throw new Error(error.message);
    },
    async signOut() { await sb.auth.signOut(); },

    // ---------- organizers ----------
    currentWeek: () => rpc('current_week'),
    gmQuests: () => rpc('gm_quests', { p_weeks: 2 }),
    saveQuest: row => run(sb.from('quests').insert(row).select().single()),
    updateQuest: (id, patch) => run(sb.from('quests').update(patch).eq('id', id).select().single()),
    secondCall: id => rpc('request_second_call', { p_quest: id }),
    async uploadVoice(blob) {
      const type = (blob.type || 'audio/webm').split(';')[0];
      const ext = { 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/x-wav': 'wav' }[type] || 'audio';
      const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}.${ext}`;
      const { error } = await sb.storage.from('voice-notes').upload(path, blob, { contentType: type, upsert: false });
      if (error) throw new Error(`Couldn’t upload the voice note: ${error.message}`);
      return sb.storage.from('voice-notes').getPublicUrl(path).data.publicUrl;
    },
    templates: () => run(sb.from('templates').select('*').order('sort')),
    saveTemplate: row => run(sb.from('templates').insert(row).select().single()),
    updateTemplate: (id, patch) => run(sb.from('templates').update(patch).eq('id', id).select().single()),
    archive: () => run(sb.from('quests').select('*').order('created_at', { ascending: false }).limit(200)),
    reportQuests: days => rpc('report_quests', { p_since: new Date(Date.now() - days * 864e5).toISOString() }),
    reportWeeks: weeks => rpc('report_weeks', { p_weeks: weeks }),
    crew: () => rpc('crew_list'),
    setRole: (handle, role) => rpc('set_role', { p_handle: handle, p_role: role }),
    invites: () => run(sb.from('invites').select('*').order('created_at', { ascending: false }).limit(100)),
    createInvite: (guildId, max, note) => rpc('create_invite', { p_guild: guildId, p_max: max, p_note: note }),
    guilds: () => run(sb.from('guilds').select('*').order('name')),
    addGuild: (name, parentId) => run(sb.from('guilds').insert({ name, parent_id: parentId || null }).select().single()),
    settings: () => run(sb.from('app_settings').select('*').eq('id', 1).single()),
    saveSettings: s => rpc('save_settings', { p_autopilot: s.autopilot, p_min: s.min_per_week, p_app_url: s.app_url, p_discord_url: s.discord_url })
  };
}
