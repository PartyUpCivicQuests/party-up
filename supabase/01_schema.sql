-- =====================================================================
-- Party Up, step 1 of 3: tables, security rules, and server functions.
-- Paste this whole file into Supabase: SQL Editor > New query > Run.
-- Safe to run again after edits; it replaces functions and policies.
-- =====================================================================

-- ---------- Tables ----------------------------------------------------

create table if not exists public.app_settings (
  id           int primary key default 1 check (id = 1),
  tz           text not null default 'America/Chicago',
  autopilot    boolean not null default true,
  min_per_week int not null default 3 check (min_per_week between 1 and 10),
  app_url      text not null default '',
  discord_url  text not null default '',
  updated_at   timestamptz not null default now()
);

create table if not exists public.guilds (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  parent_id  uuid references public.guilds(id),
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  handle           text not null check (char_length(handle) between 1 and 24),
  guild_id         uuid references public.guilds(id),
  role             text not null default 'member' check (role in ('member','captain','guildmaster')),
  lang             text not null default 'en',
  max_per_week     int not null default 5 check (max_per_week between 1 and 14),
  quiet_hours      boolean not null default true,
  xp_total         int not null default 0,
  xp_week          int not null default 0,
  week_done        int not null default 0,
  week_start       date,
  last_active_week date,
  streak           int not null default 0,
  shields          int not null default 0 check (shields between 0 and 2),
  class_xp         jsonb not null default '{}'::jsonb,
  vow_week         date,
  buddy_id         uuid references public.profiles(id) on delete set null,
  buddy_code       text unique,
  invited_by       uuid references public.profiles(id) on delete set null,
  recruits         int not null default 0,
  created_at       timestamptz not null default now()
);
create unique index if not exists profiles_handle_lower on public.profiles (lower(handle));

create table if not exists public.invites (
  code       text primary key,
  guild_id   uuid references public.guilds(id),
  created_by uuid references public.profiles(id) on delete set null,
  max_uses   int not null default 25,
  uses       int not null default 0,
  note       text,
  created_at timestamptz not null default now()
);

create table if not exists public.templates (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  flavor     text,
  kind       text not null,
  platform   text not null,
  steps      text[] not null default '{}',
  caption    text,
  note       text,
  note_audio text,
  link       text,
  source     text,
  sort       int not null default 100,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.quests (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (char_length(title) between 1 and 120),
  flavor                text,
  kind                  text not null default 'amplify',
  cls                   text not null default 'paladin',
  xp                    int not null default 20 check (xp between 0 and 100),
  shelf                 text not null default 'dated' check (shelf in ('evergreen','dated','rapid')),
  platform              text not null default 'instagram',
  link                  text,
  steps                 text[] not null default '{}',
  caption               text,
  note                  text,
  note_audio            text,                                   -- public URL of the organizer's recording
  source                text check (source is null or source ~* '^https?://'),
  tr                    jsonb not null default '{}'::jsonb,   -- {"es": {"title": "...", "flavor": "...", "caption": "...", "note": "..."}}
  claim                 boolean not null default false,
  signed_by             uuid references public.profiles(id),
  guild_id              uuid references public.guilds(id),
  starts_at             timestamptz,
  ends_at               timestamptz,
  stale_at              timestamptz,
  week_of               date,
  confirmed             boolean not null default false,
  shelved               boolean not null default false,
  correction            text,
  template_id           uuid references public.templates(id) on delete set null,
  replaces              uuid references public.quests(id),
  announced_at          timestamptz,
  second_call_requested boolean not null default false,
  second_call_at        timestamptz,
  created_by            uuid references public.profiles(id),
  created_at            timestamptz not null default now(),
  check ((shelf = 'evergreen' and week_of is not null)
      or (shelf <> 'evergreen' and starts_at is not null and ends_at > starts_at))
);

-- Who finished which quest. Kept only while a quest can still be finished,
-- then deleted by the daily cleanup job (see 03_jobs.sql). Reports use the
-- anonymous totals in quest_stats and weekly_stats instead.
create table if not exists public.completions (
  quest_id     uuid references public.quests(id) on delete cascade,
  user_id      uuid references public.profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (quest_id, user_id)
);

-- Anonymous totals per quest. No user ids in here.
create table if not exists public.quest_stats (
  quest_id          uuid primary key references public.quests(id) on delete cascade,
  opens             int not null default 0,
  completions       int not null default 0,
  buckets           int[] not null default array_fill(0, array[12]),  -- completions per 5 minutes, first hour of a timed wave
  minutes_sum       bigint not null default 0,
  after_second_call int not null default 0
);

-- Anonymous totals per week.
create table if not exists public.weekly_stats (
  week        date primary key,
  active      int not null default 0,   -- members who finished at least one quest
  returners   int not null default 0,   -- of those, members who were also active the week before
  new_members int not null default 0,
  completions int not null default 0
);

-- ---------- Helper functions -----------------------------------------

create or replace function public.app_tz() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select tz from public.app_settings where id = 1), 'America/Chicago')
$$;

-- Monday of the week containing ts, in the app's time zone.
create or replace function public.pu_week(ts timestamptz) returns date
language sql stable security definer set search_path = public as $$
  select date_trunc('week', (ts at time zone public.app_tz()))::date
$$;

create or replace function public.week_start_ts(d date) returns timestamptz
language sql stable security definer set search_path = public as $$
  select (d::timestamp at time zone public.app_tz())
$$;

create or replace function public.current_week() returns date
language sql stable security definer set search_path = public as $$
  select public.pu_week(now())
$$;

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select role in ('captain','guildmaster') from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.my_guild() returns uuid
language sql stable security definer set search_path = public as $$
  select guild_id from public.profiles where id = auth.uid()
$$;

-- True when a quest aimed at q_guild should reach a member of m_guild.
-- A quest for "Minnesota" reaches Twin Cities, Duluth, and so on. Null means everyone.
create or replace function public.guild_in_scope(q_guild uuid, m_guild uuid) returns boolean
language sql stable security definer set search_path = public as $$
  with recursive up(id, parent_id) as (
    select g.id, g.parent_id from public.guilds g where g.id = m_guild
    union all
    select g.id, g.parent_id from public.guilds g join up on g.id = up.parent_id
  )
  select q_guild is null or exists (select 1 from up where up.id = q_guild)
$$;

create or replace function public.fresh_code(n int default 6) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_chars text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_out   text;
  i       int;
begin
  loop
    v_out := '';
    for i in 1..n loop
      v_out := v_out || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    end loop;
    exit when not exists (select 1 from public.invites where code = v_out)
          and not exists (select 1 from public.profiles where buddy_code = v_out);
  end loop;
  return v_out;
end $$;

-- ---------- Quest guard: who can sign off, and XP comes from the kind ---

create or replace function public.quests_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.created_by     := coalesce(auth.uid(), new.created_by);
    new.signed_by      := null;
    new.announced_at   := null;
    new.second_call_at := null;
    new.second_call_requested := false;
    -- A timed wave written within two days of its start is fresh by definition.
    if new.shelf <> 'evergreen' and new.starts_at <= now() + interval '48 hours' then
      new.confirmed := true;
    end if;
    if new.shelf = 'evergreen' then new.confirmed := true; end if;
  else
    new.created_by := old.created_by;
    if new.signed_by is distinct from old.signed_by and new.signed_by is not null then
      if auth.uid() is not null and new.signed_by <> auth.uid() then
        raise exception 'You can only sign off as yourself.';
      end if;
      if new.signed_by = new.created_by then
        raise exception 'A different organizer has to give the second sign-off.';
      end if;
    end if;
  end if;
  new.cls := case new.kind
    when 'amplify' then 'paladin' when 'bubble' then 'bard'   when 'mirror' then 'rogue'
    when 'scout'   then 'ranger'  when 'recruit' then 'cleric' when 'street' then 'druid'
    when 'search'  then 'wizard'  else 'paladin' end;
  new.xp := case new.kind
    when 'amplify' then 30 when 'bubble' then 20 when 'mirror' then 25 when 'scout' then 15
    when 'recruit' then 20 when 'street' then 35 when 'search' then 15 else 20 end;
  return new;
end $$;

drop trigger if exists quests_guard on public.quests;
create trigger quests_guard before insert or update on public.quests
  for each row execute function public.quests_guard();

-- ---------- Row-level security ----------------------------------------
-- Members never read tables directly; they go through the functions below.
-- Organizers (captains and guildmasters) can read and write quests and templates.
-- Nobody can delete a quest through the app. Mistakes get a visible correction.

alter table public.app_settings enable row level security;
alter table public.guilds       enable row level security;
alter table public.profiles     enable row level security;
alter table public.invites      enable row level security;
alter table public.templates    enable row level security;
alter table public.quests       enable row level security;
alter table public.completions  enable row level security;
alter table public.quest_stats  enable row level security;
alter table public.weekly_stats enable row level security;

drop policy if exists settings_staff_read on public.app_settings;
create policy settings_staff_read on public.app_settings for select to authenticated using (public.is_staff());

drop policy if exists guilds_read on public.guilds;
create policy guilds_read on public.guilds for select to authenticated using (true);
drop policy if exists guilds_gm_insert on public.guilds;
create policy guilds_gm_insert on public.guilds for insert to authenticated with check (public.my_role() = 'guildmaster');
drop policy if exists guilds_gm_update on public.guilds;
create policy guilds_gm_update on public.guilds for update to authenticated using (public.my_role() = 'guildmaster');

drop policy if exists profiles_self_or_staff on public.profiles;
create policy profiles_self_or_staff on public.profiles for select to authenticated using (id = auth.uid() or public.is_staff());

drop policy if exists invites_own_or_staff on public.invites;
create policy invites_own_or_staff on public.invites for select to authenticated using (created_by = auth.uid() or public.is_staff());

drop policy if exists templates_staff_read on public.templates;
create policy templates_staff_read on public.templates for select to authenticated using (public.is_staff());
drop policy if exists templates_staff_insert on public.templates;
create policy templates_staff_insert on public.templates for insert to authenticated with check (public.is_staff());
drop policy if exists templates_staff_update on public.templates;
create policy templates_staff_update on public.templates for update to authenticated using (public.is_staff());

drop policy if exists quests_staff_read on public.quests;
create policy quests_staff_read on public.quests for select to authenticated using (public.is_staff());
drop policy if exists quests_staff_insert on public.quests;
create policy quests_staff_insert on public.quests for insert to authenticated with check (public.is_staff());
drop policy if exists quests_staff_update on public.quests;
create policy quests_staff_update on public.quests for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists stats_staff_read on public.quest_stats;
create policy stats_staff_read on public.quest_stats for select to authenticated using (public.is_staff());
drop policy if exists weekly_staff_read on public.weekly_stats;
create policy weekly_staff_read on public.weekly_stats for select to authenticated using (public.is_staff());
-- completions: no policies on purpose. Only the functions below touch it.

-- ---------- Member functions -------------------------------------------

-- Returns the caller's profile, rolling weekly counters and streaks forward first.
create or replace function public.my_profile() returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  v_me  public.profiles;
  v_cur date := public.pu_week(now());
begin
  select * into v_me from public.profiles where id = auth.uid() for update;
  if not found then return null; end if;
  if v_me.week_start is distinct from v_cur then
    if v_me.last_active_week is not null and v_me.last_active_week < v_cur - 7 then
      if v_me.last_active_week = v_cur - 14 and v_me.shields > 0 then
        v_me.shields := v_me.shields - 1;          -- a shield covers the one missed week
        v_me.last_active_week := v_cur - 7;
      else
        v_me.streak := 0;
      end if;
    end if;
    update public.profiles
       set week_start = v_cur, xp_week = 0, week_done = 0,
           streak = v_me.streak, shields = v_me.shields, last_active_week = v_me.last_active_week
     where id = v_me.id
     returning * into v_me;
  end if;
  return v_me;
end $$;

create or replace function public.me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_p     public.profiles;
  v_guild text;
  v_code  text;
  v_disc  text;
begin
  v_p := public.my_profile();
  if v_p.id is null then return null; end if;
  select g.name into v_guild from public.guilds g where g.id = v_p.guild_id;
  select i.code into v_code from public.invites i where i.created_by = v_p.id and i.note = 'personal' order by i.created_at limit 1;
  select s.discord_url into v_disc from public.app_settings s where s.id = 1;
  return to_jsonb(v_p) || jsonb_build_object(
    'cur_week', public.pu_week(now()), 'guild_name', v_guild, 'invite_code', v_code, 'discord_url', coalesce(v_disc, ''));
end $$;

create or replace function public.join_with_code(p_code text, p_handle text, p_lang text default 'en')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_inv   public.invites;
  v_clean text := btrim(coalesce(p_handle, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then return public.me(); end if;
  select * into v_inv from public.invites where upper(code) = upper(btrim(coalesce(p_code, ''))) for update;
  if not found then raise exception 'That invite code doesn''t work. Check it with whoever sent it.'; end if;
  if v_inv.uses >= v_inv.max_uses then raise exception 'That invite code is used up. Ask for a fresh one.'; end if;
  if char_length(v_clean) < 1 or char_length(v_clean) > 24 then raise exception 'Pick a name between 1 and 24 characters.'; end if;
  if exists (select 1 from public.profiles where lower(handle) = lower(v_clean)) then raise exception 'That name is taken. Try another.'; end if;

  insert into public.profiles (id, handle, guild_id, lang, invited_by, buddy_code)
  values (auth.uid(), v_clean, v_inv.guild_id, case when p_lang in ('en','es') then p_lang else 'en' end,
          v_inv.created_by, public.fresh_code(6));
  update public.invites set uses = uses + 1 where code = v_inv.code;
  insert into public.invites (code, guild_id, created_by, max_uses, note)
  values (public.fresh_code(6), v_inv.guild_id, auth.uid(), 25, 'personal');
  if v_inv.created_by is not null then
    update public.profiles
       set recruits = recruits + 1, xp_total = xp_total + 20,
           class_xp = jsonb_set(class_xp, '{cleric}', to_jsonb(coalesce((class_xp->>'cleric')::int, 0) + 20))
     where id = v_inv.created_by;
  end if;
  insert into public.weekly_stats as w (week, new_members) values (public.pu_week(now()), 1)
  on conflict (week) do update set new_members = w.new_members + 1;
  return public.me();
end $$;

create or replace function public.update_me(p_handle text, p_lang text, p_max int, p_quiet boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_clean text := btrim(coalesce(p_handle, ''));
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if char_length(v_clean) < 1 or char_length(v_clean) > 24 then raise exception 'Pick a name between 1 and 24 characters.'; end if;
  if exists (select 1 from public.profiles where lower(handle) = lower(v_clean) and id <> auth.uid()) then
    raise exception 'That name is taken. Try another.';
  end if;
  update public.profiles
     set handle = v_clean,
         lang = case when p_lang in ('en','es') then p_lang else lang end,
         max_per_week = greatest(1, least(14, coalesce(p_max, max_per_week))),
         quiet_hours = coalesce(p_quiet, quiet_hours)
   where id = auth.uid();
end $$;

-- Quests a member can see right now: this week's evergreen board, live waves,
-- and confirmed waves starting in the next eight days.
create or replace function public.member_quests() returns setof public.quests
language sql stable security definer set search_path = public as $$
  select q.* from public.quests q
   where auth.uid() is not null
     and not q.shelved
     and (not q.claim or q.signed_by is not null)
     and ((q.shelf = 'evergreen' and q.week_of = public.pu_week(now()))
       or (q.shelf <> 'evergreen' and q.confirmed and q.ends_at > now() and q.starts_at < now() + interval '8 days'))
     and public.guild_in_scope(q.guild_id, public.my_guild())
   order by coalesce(q.starts_at, q.created_at)
$$;

create or replace function public.my_completions() returns setof uuid
language sql stable security definer set search_path = public as $$
  select c.quest_id from public.completions c where c.user_id = auth.uid()
$$;

create or replace function public.quest_opened(p_quest uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if not exists (select 1 from public.quests where id = p_quest) then return; end if;
  insert into public.quest_stats as s (quest_id, opens) values (p_quest, 1)
  on conflict (quest_id) do update set opens = s.opens + 1;
end $$;

create or replace function public.complete_quest(p_quest uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_q     public.quests;
  v_me    public.profiles;
  v_cur   date := public.pu_week(now());
  v_roll  int := 1 + floor(random() * 20)::int;
  v_gain  int;
  v_start timestamptz;
  v_mins  int;
  v_b     int;
  v_first boolean;
begin
  v_me := public.my_profile();
  if v_me.id is null then raise exception 'Join first.'; end if;
  select * into v_q from public.quests where id = p_quest;
  if not found then raise exception 'Quest not found.'; end if;
  if v_q.shelved or (v_q.claim and v_q.signed_by is null)
     or not public.guild_in_scope(v_q.guild_id, v_me.guild_id) then
    raise exception 'This quest isn''t open to you.';
  end if;
  if v_q.shelf = 'evergreen' then
    if v_q.week_of <> v_cur then raise exception 'This quest has closed.'; end if;
    v_start := public.week_start_ts(v_q.week_of);
  else
    if not v_q.confirmed or now() < v_q.starts_at then raise exception 'This wave hasn''t started yet.'; end if;
    if now() >= v_q.ends_at then raise exception 'This wave has ended.'; end if;
    v_start := v_q.starts_at;
  end if;

  insert into public.completions (quest_id, user_id) values (v_q.id, v_me.id) on conflict do nothing;
  if not found then raise exception 'Already done. Nice work.'; end if;

  v_gain  := v_q.xp + case when v_roll = 20 then 10 else 0 end;
  v_first := v_me.week_done = 0;
  if v_first then
    if v_me.last_active_week = v_cur - 7 then v_me.streak := v_me.streak + 1;
    elsif v_me.last_active_week = v_cur then null;
    else v_me.streak := 1;
    end if;
    if v_me.streak > 0 and v_me.streak % 4 = 0 and v_me.shields < 2 then
      v_me.shields := v_me.shields + 1;   -- earn a streak shield every four weeks
    end if;
  end if;

  update public.profiles
     set xp_total = xp_total + v_gain, xp_week = xp_week + v_gain, week_done = week_done + 1,
         last_active_week = v_cur, streak = v_me.streak, shields = v_me.shields,
         class_xp = jsonb_set(class_xp, array[v_q.cls], to_jsonb(coalesce((class_xp->>v_q.cls)::int, 0) + v_gain))
   where id = v_me.id;

  -- Anonymous totals for reports.
  v_mins := greatest(0, floor(extract(epoch from (now() - v_start)) / 60))::int;
  v_b    := case when v_q.shelf <> 'evergreen' and v_mins < 60 then v_mins / 5 else null end;
  insert into public.quest_stats (quest_id) values (v_q.id) on conflict do nothing;
  update public.quest_stats
     set completions = completions + 1,
         minutes_sum = minutes_sum + v_mins,
         after_second_call = after_second_call
           + case when v_q.second_call_at is not null and now() >= v_q.second_call_at then 1 else 0 end
   where quest_id = v_q.id;
  if v_b is not null then
    update public.quest_stats set buckets[v_b + 1] = buckets[v_b + 1] + 1 where quest_id = v_q.id;
  end if;

  insert into public.weekly_stats as w (week, active, returners, completions)
  values (v_cur, case when v_first then 1 else 0 end, case when v_first and v_me.streak > 1 then 1 else 0 end, 1)
  on conflict (week) do update
    set active      = w.active + excluded.active,
        returners   = w.returners + excluded.returners,
        completions = w.completions + 1;

  return jsonb_build_object('roll', v_roll, 'gain', v_gain, 'cls', v_q.cls);
end $$;

create or replace function public.keep_vow() returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_me   public.profiles;
  v_cur  date := public.pu_week(now());
  v_roll int := 1 + floor(random() * 20)::int;
  v_gain int;
begin
  v_me := public.my_profile();
  if v_me.id is null then raise exception 'Join first.'; end if;
  if v_me.vow_week = v_cur then raise exception 'Already kept this week.'; end if;
  v_gain := 15 + case when v_roll = 20 then 10 else 0 end;
  update public.profiles
     set vow_week = v_cur, xp_total = xp_total + v_gain, xp_week = xp_week + v_gain,
         class_xp = jsonb_set(class_xp, '{monk}', to_jsonb(coalesce((class_xp->>'monk')::int, 0) + v_gain))
   where id = v_me.id;
  return jsonb_build_object('roll', v_roll, 'gain', v_gain, 'cls', 'monk');
end $$;

-- This week's top members in the caller's guild. Only names and weekly XP.
create or replace function public.guild_board() returns table (handle text, xp int, is_me boolean)
language sql stable security definer set search_path = public as $$
  select p.handle,
         case when p.week_start = public.pu_week(now()) then p.xp_week else 0 end,
         p.id = auth.uid()
    from public.profiles p
   where auth.uid() is not null and p.guild_id = public.my_guild()
   order by 2 desc, p.handle
   limit 30
$$;

-- Share of members in each sibling guild who finished a quest this week.
create or replace function public.guild_turnout() returns table (name text, rate int, members int, is_mine boolean)
language sql stable security definer set search_path = public as $$
  with mine as (select g.id, g.parent_id from public.guilds g where g.id = public.my_guild())
  select g.name,
         round(100.0 * count(p.id) filter (where p.week_start = public.pu_week(now()) and p.week_done > 0)
               / nullif(count(p.id), 0))::int,
         count(p.id)::int,
         g.id = (select m.id from mine m)
    from public.guilds g
    join public.profiles p on p.guild_id = g.id
   where auth.uid() is not null
     and g.parent_id is not distinct from (select m.parent_id from mine m)
   group by g.id, g.name
   order by 2 desc nulls last
$$;

create or replace function public.link_buddy(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare v_other public.profiles;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  select * into v_other from public.profiles where upper(buddy_code) = upper(btrim(coalesce(p_code, '')));
  if not found then raise exception 'No one has that buddy code.'; end if;
  if v_other.id = auth.uid() then raise exception 'That''s your own code.'; end if;
  if v_other.buddy_id is not null and v_other.buddy_id <> auth.uid() then raise exception 'They already have a buddy.'; end if;
  if (select buddy_id from public.profiles where id = auth.uid()) is not null then raise exception 'Unpair from your current buddy first.'; end if;
  update public.profiles set buddy_id = v_other.id where id = auth.uid();
  update public.profiles set buddy_id = auth.uid() where id = v_other.id;
  return v_other.handle;
end $$;

create or replace function public.unlink_buddy() returns void
language plpgsql security definer set search_path = public as $$
declare v_b uuid;
begin
  select buddy_id into v_b from public.profiles where id = auth.uid();
  update public.profiles set buddy_id = null where id = auth.uid();
  if v_b is not null then update public.profiles set buddy_id = null where id = v_b and buddy_id = auth.uid(); end if;
end $$;

create or replace function public.my_buddy() returns table (handle text, week_done int, streak int)
language sql stable security definer set search_path = public as $$
  select b.handle,
         case when b.week_start = public.pu_week(now()) then b.week_done else 0 end,
         case when b.last_active_week >= public.pu_week(now()) - 7 then b.streak else 0 end
    from public.profiles me join public.profiles b on b.id = me.buddy_id
   where me.id = auth.uid()
$$;

-- ---------- Organizer functions -----------------------------------------

create or replace function public.gm_quests(p_weeks int default 2) returns setof public.quests
language sql stable security definer set search_path = public as $$
  select q.* from public.quests q
   where public.is_staff()
     and ((q.shelf <> 'evergreen'
           and q.starts_at >= public.week_start_ts(public.pu_week(now()))
           and q.starts_at <  public.week_start_ts(public.pu_week(now()) + 7 * p_weeks))
       or (q.shelf = 'evergreen'
           and q.week_of >= public.pu_week(now())
           and q.week_of <  public.pu_week(now()) + 7 * p_weeks))
   order by coalesce(q.starts_at, public.week_start_ts(q.week_of))
$$;

create or replace function public.request_second_call(p_quest uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'Organizers only.'; end if;
  update public.quests set second_call_requested = true where id = p_quest and second_call_at is null;
end $$;

-- One row per quest that has started, with anonymous totals. Feeds the Reports tab.
create or replace function public.report_quests(p_since timestamptz default now() - interval '90 days')
returns table (
  id uuid, title text, kind text, cls text, shelf text, platform text, guild text,
  run_at timestamptz, template_id uuid, shelved boolean, corrected boolean,
  audience int, opens int, completions int, buckets int[], minutes_sum bigint,
  second_call boolean, after_second_call int, ends_at timestamptz
)
language sql stable security definer set search_path = public as $$
  select q.id, q.title, q.kind, q.cls, q.shelf, q.platform, g.name,
         coalesce(q.starts_at, public.week_start_ts(q.week_of)),
         q.template_id, q.shelved, q.correction is not null,
         (select count(*) from public.profiles p
           where p.created_at <= coalesce(q.ends_at, public.week_start_ts(q.week_of) + interval '7 days')
             and public.guild_in_scope(q.guild_id, p.guild_id))::int,
         coalesce(s.opens, 0), coalesce(s.completions, 0),
         coalesce(s.buckets, array_fill(0, array[12])), coalesce(s.minutes_sum, 0),
         q.second_call_at is not null, coalesce(s.after_second_call, 0),
         coalesce(q.ends_at, public.week_start_ts(q.week_of) + interval '7 days')
    from public.quests q
    left join public.quest_stats s on s.quest_id = q.id
    left join public.guilds g on g.id = q.guild_id
   where public.is_staff()
     and coalesce(q.starts_at, public.week_start_ts(q.week_of)) >= p_since
     and coalesce(q.starts_at, public.week_start_ts(q.week_of)) <= now()
     and (not q.claim or q.signed_by is not null)
   order by 8 desc
$$;

create or replace function public.report_weeks(p_weeks int default 12)
returns table (week date, active int, returners int, new_members int, completions int, members int)
language sql stable security definer set search_path = public as $$
  select w.week, w.active, w.returners, w.new_members, w.completions,
         (select count(*) from public.profiles p where p.created_at < public.week_start_ts(w.week + 7))::int
    from public.weekly_stats w
   where public.is_staff() and w.week >= public.pu_week(now()) - 7 * p_weeks
   order by w.week
$$;

create or replace function public.crew_list()
returns table (handle text, role text, guild text, joined timestamptz, recruits int)
language sql stable security definer set search_path = public as $$
  select p.handle, p.role, g.name, p.created_at, p.recruits
    from public.profiles p left join public.guilds g on g.id = p.guild_id
   where public.is_staff()
   order by case p.role when 'guildmaster' then 0 when 'captain' then 1 else 2 end, p.created_at
$$;

create or replace function public.set_role(p_handle text, p_role text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'guildmaster' then raise exception 'Only a guildmaster can change roles.'; end if;
  if p_role not in ('member','captain','guildmaster') then raise exception 'Unknown role.'; end if;
  update public.profiles set role = p_role where lower(handle) = lower(btrim(p_handle));
  if not found then raise exception 'No one goes by that name.'; end if;
  if (select count(*) from public.profiles where role = 'guildmaster') = 0 then
    raise exception 'Keep at least one guildmaster.';
  end if;
end $$;

create or replace function public.create_invite(p_guild uuid, p_max int default 50, p_note text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  if not public.is_staff() then raise exception 'Organizers only.'; end if;
  v_code := public.fresh_code(6);
  insert into public.invites (code, guild_id, created_by, max_uses, note)
  values (v_code, p_guild, auth.uid(), greatest(1, least(coalesce(p_max, 50), 5000)), nullif(btrim(coalesce(p_note, '')), ''));
  return v_code;
end $$;

create or replace function public.save_settings(p_autopilot boolean, p_min int, p_app_url text, p_discord_url text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if public.my_role() is distinct from 'guildmaster' then raise exception 'Only a guildmaster can change settings.'; end if;
  insert into public.app_settings (id) values (1) on conflict do nothing;
  update public.app_settings
     set autopilot = coalesce(p_autopilot, autopilot),
         min_per_week = greatest(1, least(10, coalesce(p_min, min_per_week))),
         app_url = coalesce(btrim(p_app_url), app_url),
         discord_url = coalesce(btrim(p_discord_url), discord_url),
         updated_at = now()
   where id = 1;
end $$;

-- ---------- Permissions --------------------------------------------------
-- Signed-out visitors can't call anything. Signed-in members (including
-- anonymous sign-ins) can call the functions above; each one checks roles itself.
revoke execute on all functions in schema public from public, anon;
grant  execute on all functions in schema public to authenticated;
