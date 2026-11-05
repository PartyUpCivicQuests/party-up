-- =====================================================================
-- Party Up, step 2 of 3: starter data.
-- Run once after 01_schema.sql. Edit the guild names and invite codes
-- below first if you like; you can also add guilds later in the app.
-- =====================================================================

insert into public.app_settings (id) values (1) on conflict (id) do nothing;

-- Guild tree: National > Minnesota > local guilds.
insert into public.guilds (name) values ('National') on conflict (name) do nothing;

insert into public.guilds (name, parent_id)
select 'Minnesota', g.id from public.guilds g where g.name = 'National'
on conflict (name) do nothing;

insert into public.guilds (name, parent_id)
select v.n, g.id
  from (values ('Twin Cities'), ('Duluth'), ('Rochester'), ('St. Cloud'), ('Iron Range')) as v(n)
  cross join public.guilds g
 where g.name = 'Minnesota'
on conflict (name) do nothing;

-- Invite codes. FOUNDER is for you and your first co-organizers.
-- DISCORD1 is for your first Discord testers. Change them if you like.
insert into public.invites (code, guild_id, max_uses, note)
select 'FOUNDER', g.id, 5, 'First organizers' from public.guilds g where g.name = 'Twin Cities'
on conflict (code) do nothing;

insert into public.invites (code, guild_id, max_uses, note)
select 'DISCORD1', g.id, 200, 'First Discord testers' from public.guilds g where g.name = 'Minnesota'
on conflict (code) do nothing;

-- Evergreen library. Autopilot pulls from here, least recently used first.
insert into public.templates (title, flavor, kind, platform, steps, sort)
select * from (values
  ('Invite one person who isn''t into politics', 'Not your most political friend. Your most fun one.', 'recruit', 'chat', array['invite'], 10),
  ('Follow train: follow five people in your guild', 'More of us following each other means more of us seen.', 'amplify', 'instagram', array['open'], 20),
  ('Boost the week''s three picks', 'Watch, like, save, share. Three posts, ten minutes.', 'amplify', 'facebook', array['open','watch','like','save','share'], 30),
  ('Share this week''s explainer in a group chat', 'Pick a chat that isn''t already on our side.', 'bubble', 'chat', array['sendchat'], 40),
  ('Banner or profile frame for a day', 'Show your face. It changes who feels safe to agree.', 'bubble', 'profile', array['open'], 50),
  ('Flyer or QR drop', 'Library, laundromat, coffee shop. Ask first.', 'street', 'street', array['open'], 60),
  ('Scout report: what''s spreading near you?', 'Tell your captain what your feeds are full of. Don''t engage it.', 'scout', 'chat', array['comment'], 70)
) as t(title, flavor, kind, platform, steps, sort)
where not exists (select 1 from public.templates);

-- ---------------------------------------------------------------------
-- AFTER you join the app with the FOUNDER code, make yourself the
-- first Guildmaster. Replace YOUR_NAME with the name you picked:
--
--   update public.profiles set role = 'guildmaster' where handle = 'YOUR_NAME';
--
-- And tell Party Up where it lives (used in Discord posts and invite links):
--
--   update public.app_settings
--      set app_url = 'https://YOUR-GITHUB-NAME.github.io/party-up/'
--    where id = 1;
-- ---------------------------------------------------------------------
