-- =====================================================================
-- Party Up update: Guildmaster voice notes.
-- Run once in SQL Editor > New query. Safe to run again.
--   * adds a place to store each quest's recording
--   * creates a public "voice-notes" storage bucket (3 MB per file, audio only)
--   * lets organizers (captains and guildmasters) upload to it
--   * makes autopilot copy recordings from library templates
-- =====================================================================

alter table public.quests    add column if not exists note_audio text;
alter table public.templates add column if not exists note_audio text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('voice-notes', 'voice-notes', true, 3145728, array['audio/*'])
on conflict (id) do update
  set public = true, file_size_limit = 3145728, allowed_mime_types = array['audio/*'];

-- Anyone can listen (the bucket is public). Only organizers can upload.
drop policy if exists "voice notes: organizers upload" on storage.objects;
create policy "voice notes: organizers upload" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'voice-notes' and public.is_staff());

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
    insert into public.quests (title, flavor, kind, shelf, platform, link, steps, caption, note, note_audio, source,
                               guild_id, week_of, confirmed, template_id)
    values (v_t.title, v_t.flavor, v_t.kind, 'evergreen', v_t.platform, v_t.link, v_t.steps, v_t.caption,
            v_t.note, v_t.note_audio, v_t.source, v_nat, v_cur, true, v_t.id);
    v_added := v_added + 1;
  end loop;
  return v_added;
end $$;
