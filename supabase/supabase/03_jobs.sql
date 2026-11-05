-- =====================================================================
-- Party Up, step 3 of 3: background jobs.
--   * Posts each quest to Discord (and Telegram, if you set it up) when it goes live
--   * Autopilot fills quiet weeks from the evergreen library every Monday
--   * Deletes "who did which quest" records a day after each quest closes
-- Run after 02_seed.sql.
-- =====================================================================

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- Secrets. Run these once, separately, with your real values.
-- They're stored encrypted in Supabase Vault, never in this repo.
--
--   select vault.create_secret('https://discord.com/api/webhooks/XXXX/YYYY', 'discord_webhook');
--
-- Optional Telegram channel:
--   select vault.create_secret('123456:ABC-your-bot-token', 'telegram_bot_token');
--   select vault.create_secret('@your_channel_name', 'telegram_chat_id');
--
-- To change one later:
--   select vault.update_secret((select id from vault.secrets where name = 'discord_webhook'), 'NEW_URL');
-- ---------------------------------------------------------------------

create or replace function public.platform_label(p text) returns text
language sql immutable as $$
  select case p
    when 'instagram' then 'Instagram' when 'facebook' then 'Facebook' when 'youtube' then 'YouTube'
    when 'tiktok' then 'TikTok' when 'x' then 'X' when 'threads' then 'Threads' when 'bluesky' then 'Bluesky'
    when 'google' then 'Google search' when 'chat' then 'Group chat' when 'profile' then 'Your profiles'
    when 'street' then 'In person' else initcap(p) end
$$;

create or replace function public.announce_due() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_q      record;
  v_hook   text;
  v_tg     text;
  v_chat   text;
  v_app    text;
  v_label  text;
  v_n      int := 0;
begin
  select decrypted_secret into v_hook from vault.decrypted_secrets where name = 'discord_webhook' limit 1;
  select decrypted_secret into v_tg   from vault.decrypted_secrets where name = 'telegram_bot_token' limit 1;
  select decrypted_secret into v_chat from vault.decrypted_secrets where name = 'telegram_chat_id' limit 1;
  select app_url into v_app from public.app_settings where id = 1;

  for v_q in
    select * from public.quests q
     where not q.shelved
       and (not q.claim or q.signed_by is not null)
       and (
         (q.announced_at is null and (
            (q.shelf = 'evergreen' and q.week_of = public.pu_week(now()))
         or (q.shelf <> 'evergreen' and q.confirmed and q.starts_at <= now() and q.ends_at > now())))
         or
         (q.announced_at is not null and q.second_call_requested and q.second_call_at is null
          and (q.shelf = 'evergreen' or q.ends_at > now()))
       )
     order by coalesce(q.starts_at, q.created_at)
     limit 10
  loop
    v_label := case when v_q.announced_at is null then 'New quest: ' else 'Second call: ' end;

    if coalesce(v_hook, '') <> '' then
      perform net.http_post(
        url := v_hook,
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'username', 'Party Up',
          'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb),
          'embeds', jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
            'title', left(v_label || v_q.title, 250),
            'description', left(coalesce(v_q.flavor, 'Open Party Up for the steps.'), 1000),
            'url', nullif(v_app, ''),
            'color', 15774761,
            'fields', jsonb_build_array(
              jsonb_build_object('name', 'Where', 'value', public.platform_label(v_q.platform), 'inline', true),
              jsonb_build_object('name', 'Worth', 'value', v_q.xp || ' XP', 'inline', true),
              jsonb_build_object('name', 'Wave', 'value',
                case when v_q.shelf = 'evergreen' then 'Open all week'
                     else 'Ends <t:' || extract(epoch from v_q.ends_at)::bigint || ':R>' end, 'inline', true)
            )
          )))
        )
      );
    end if;

    if coalesce(v_tg, '') <> '' and coalesce(v_chat, '') <> '' then
      perform net.http_post(
        url := 'https://api.telegram.org/bot' || v_tg || '/sendMessage',
        headers := jsonb_build_object('Content-Type', 'application/json'),
        body := jsonb_build_object(
          'chat_id', v_chat,
          'text', v_label || v_q.title
                  || coalesce(E'\n' || v_q.flavor, '')
                  || case when coalesce(v_app, '') <> '' then E'\n' || v_app else '' end,
          'disable_web_page_preview', true)
      );
    end if;

    if v_q.announced_at is null then
      update public.quests set announced_at = now() where id = v_q.id;
    else
      update public.quests set second_call_at = now(), second_call_requested = false where id = v_q.id;
    end if;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Keep at least min_per_week quests on each week's board, using the
-- evergreen library, least recently used first. Never adds a timed wave.
create or replace function public.autopilot_fill() returns int
language plpgsql security definer set search_path = public as $$
declare
  v_s     public.app_settings;
  v_cur   date := public.pu_week(now());
  v_have  int;
  v_added int := 0;
  v_nat   uuid;
  v_t     record;
begin
  select * into v_s from public.app_settings where id = 1;
  if not found or not v_s.autopilot then return 0; end if;

  select count(*) into v_have from public.quests q
   where not q.shelved
     and ((q.shelf = 'evergreen' and q.week_of = v_cur)
       or (q.shelf <> 'evergreen' and public.pu_week(q.starts_at) = v_cur));

  select g.id into v_nat from public.guilds g where g.parent_id is null order by g.created_at limit 1;

  for v_t in
    select t.* from public.templates t
     where t.active
       and not exists (select 1 from public.quests q where q.template_id = t.id and q.week_of = v_cur)
     order by (select max(q2.week_of) from public.quests q2 where q2.template_id = t.id) asc nulls first, t.sort
  loop
    exit when v_have + v_added >= v_s.min_per_week;
    insert into public.quests (title, flavor, kind, shelf, platform, link, steps, caption, note, source,
                               guild_id, week_of, confirmed, template_id)
    values (v_t.title, v_t.flavor, v_t.kind, 'evergreen', v_t.platform, v_t.link, v_t.steps, v_t.caption,
            v_t.note, v_t.source, v_nat, v_cur, true, v_t.id);
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;

-- Delete "who did which quest" a day after each quest closes.
-- XP, streaks, and the anonymous totals in quest_stats and weekly_stats stay.
create or replace function public.purge_completions() returns int
language sql security definer set search_path = public as $$
  with gone as (
    delete from public.completions c
     using public.quests q
     where q.id = c.quest_id
       and ((q.shelf = 'evergreen' and q.week_of < public.pu_week(now()))
         or (q.shelf <> 'evergreen' and q.ends_at < now() - interval '1 day'))
    returning 1
  )
  select count(*)::int from gone
$$;

-- These run on a schedule only; members and organizers can't call them.
revoke execute on function public.announce_due()      from public, anon, authenticated;
revoke execute on function public.autopilot_fill()    from public, anon, authenticated;
revoke execute on function public.purge_completions() from public, anon, authenticated;

-- Schedules (UTC). Re-running this file updates them in place.
select cron.schedule('partyup-announce',  '* * * * *',  $$ select public.announce_due(); $$);
select cron.schedule('partyup-autopilot', '5 11 * * 1', $$ select public.autopilot_fill(); $$);  -- Mondays, about 6 am Central
select cron.schedule('partyup-purge',     '20 9 * * *', $$ select public.purge_completions(); $$);

-- Fill this week's board right away instead of waiting for Monday.
select public.autopilot_fill();
