# Setting up Party Up

About an hour, start to finish. No coding. Everything here is free to start.

You'll create three accounts if you don't have them: **GitHub** (hosts the app), **Supabase** (the database), and you'll need to be an admin on your **Discord** server.

---

## 1. Put the app on GitHub

1. Sign in at github.com and click **New repository**. Name it `party-up`. Make it **Public** (GitHub Pages is free for public repos). Click **Create repository**.
2. On the empty repo page, click **uploading an existing file**. Drag in everything from the unzipped `party-up` folder (the files *inside* it, not the folder itself). Click **Commit changes**.
3. Go to **Settings > Pages**. Under **Build and deployment**, pick **Deploy from a branch**, branch **main**, folder **/ (root)**, and save.
4. After a minute or two, your app is live at `https://YOUR-GITHUB-NAME.github.io/party-up/`. It runs in demo mode until step 3.

## 2. Create the database

1. Sign in at supabase.com and create a **New project**. Pick a strong database password and save it somewhere safe. Choose a US region.
2. When it's ready, open **SQL Editor > New query**. Open `supabase/01_schema.sql` from the repo, copy all of it, paste it in, and click **Run**. You should see "Success."
3. Do the same with `supabase/02_seed.sql`, then `supabase/03_jobs.sql`, then `supabase/04_voice_notes.sql` (storage for the Guildmaster's recorded voice notes).
4. Turn on sign-ins: **Authentication > Sign In / Providers**. Turn on **Allow anonymous sign-ins** (so members can join with just an invite code), and make sure **Email** is on (so they can add an email to use other devices).
5. Tell Supabase where the app lives: **Authentication > URL Configuration**. Set **Site URL** to your GitHub Pages address from step 1, and add the same address under **Redirect URLs**.

Free Supabase projects pause after about a week with no activity. With members using it weekly that rarely happens, and you can restore a paused project from the dashboard.

## 3. Connect the app to the database

1. In Supabase, open **Project Settings > API Keys** (on some screens it's **Settings > API**). Copy the **Project URL** and the **publishable** key (older projects call it the **anon** key). Both are safe to publish. Never copy the **secret** or **service_role** key anywhere.
2. In your GitHub repo, open `js/config.js`, click the pencil icon, and paste the two values between the quotes:
   ```js
   SUPABASE_URL: 'https://abcdefgh.supabase.co',
   SUPABASE_KEY: 'sb_publishable_...'
   ```
   Click **Commit changes**. Pages redeploys in a minute or two.

**Updating later:** when you get new versions of Party Up's files, never replace `js/config.js`. It's the one file that holds your settings, and a fresh copy is blank, which quietly switches the whole site back to demo mode.

## 4. Make yourself the Guildmaster

1. Open `https://YOUR-GITHUB-NAME.github.io/party-up/?invite=FOUNDER`. Pick your name on the board and join.
2. Back in Supabase's SQL Editor, run this with your name:
   ```sql
   update public.profiles set role = 'guildmaster' where handle = 'YOUR_NAME';
   update public.app_settings set app_url = 'https://YOUR-GITHUB-NAME.github.io/party-up/' where id = 1;
   ```
3. Reload the app. A **Guildmaster** switch appears at the top. Under **Crew**, you can add your Discord invite link, make new invite codes, and promote captains from now on, without SQL.

### Recording voice notes

In **New quest**, tap **Record** under the Guildmaster's voice note, allow the microphone, and talk for up to 30 seconds. You can also upload a file. Add a short transcript too. With no recording, the Cheery Bard (an original babble voice, like a game character chattering) "speaks" the transcript while the words type out. Every quest with a transcript also gets a **Read transcript aloud** button that uses the best voice on the member's device, in Spanish when you've written a Spanish version. Chrome, Edge, and Safari record in a format every phone plays; Firefox's recordings may not play on some older iPhones.

## 5. Post quests to Discord

1. In Discord, open **Server Settings > Integrations > Webhooks > New Webhook**. Name it Party Up, pick your `#quests` channel, and click **Copy Webhook URL**.
2. In Supabase's SQL Editor, run (with your URL):
   ```sql
   select vault.create_secret('https://discord.com/api/webhooks/...', 'discord_webhook');
   ```
   It's stored encrypted. Each quest now posts to `#quests` within a minute of going live, and **Second call** reposts it once.
3. Optional Telegram channel: create a bot with @BotFather, add it to your channel as an admin, then run:
   ```sql
   select vault.create_secret('YOUR_BOT_TOKEN', 'telegram_bot_token');
   select vault.create_secret('@your_channel', 'telegram_chat_id');
   ```

WhatsApp Channels have no posting connection, so use the **Copy text** button in the quest composer and paste it in by hand.

## 6. Invite your first testers

- Share `https://YOUR-GITHUB-NAME.github.io/party-up/?invite=DISCORD1` in your Discord. That code puts people in the Minnesota guild and works 200 times. Make more codes under **Crew**.
- New members see a **Save your character** box at the top of their quests until they add an email. Without one, their character lives only in the browser where they joined, so a private window or a new phone means starting over. Encourage everyone to add it.
- On iPhone, tell people to tap **Share > Add to Home Screen** so it opens like an app.
- Every member gets a personal invite link on their **Party** tab. Recruits give the inviter Cleric XP.

## Before you open it to the public

- **Email limits:** Supabase's built-in email sender is meant for testing and allows only a small number of emails per hour. Before hundreds of people add emails, set up your own sender under **Authentication > Emails > SMTP Settings** (services like Resend or Postmark have free tiers).
- **Bots at the door:** consider turning on CAPTCHA under **Authentication > Attack Protection** once the invite codes circulate widely.
- **Legal check:** spend an hour with an election lawyer on who "publishes" Party Up and what changes once money is involved. Bolder Advocacy (Alliance for Justice) offers free technical help to nonprofits at 866-NP-LOBBY.

## If something breaks

- **"Party Up couldn't start":** double-check the two values in `js/config.js` and that all three SQL files ran.
- **Quests don't post to Discord:** in the SQL Editor run `select * from net._http_response order by created desc limit 5;` to see Discord's replies, and check the secret's name is exactly `discord_webhook`.
- **Joining says the code doesn't work:** check **Table Editor > invites**. Codes aren't case-sensitive, but they must exist and have uses left.
