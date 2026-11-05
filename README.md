# Party Up

Civic quests that take a few minutes. Organizers post a quest ("watch this video to the end, like it, share it to your story"), members do it by hand on their own accounts, tap **I did it**, and roll a d20 for XP. Weekly streaks, buddy goals, guild turnout, and a reports dashboard keep it going for years at a sustainable pace.

Party Up is built on the principles in the *Mini-Manual of Informational Insurgency*, adapted for the US and for the long haul. The ground rules are in [docs/PRINCIPLES.md](docs/PRINCIPLES.md). The short version: **real people, real accounts, by hand.** Party Up never posts, likes, or clicks for anyone.

## Try it in two minutes

Open `index.html` through any web server (or turn on GitHub Pages) with `js/config.js` left blank. Party Up runs in **demo mode**: sample quests, sample reports, everything stored on your device. Switch between **Adventurer** and **Guildmaster** at the top.

## Go live

Follow [docs/SETUP.md](docs/SETUP.md). It takes about an hour, no coding, and costs nothing on free tiers:

1. Create a free Supabase project and paste in the three files from `supabase/`.
2. Put this repo on GitHub and turn on GitHub Pages.
3. Paste two values into `js/config.js`.
4. Add a Discord webhook so quests post to your #quests channel.

## What's inside

| Part | What it is |
|---|---|
| `index.html`, `css/`, `js/` | The app. Plain JavaScript modules, no build step. Works on phones, tablets, and laptops, and installs to the home screen. |
| `supabase/01_schema.sql` | Tables, security rules, and server functions (XP, streaks, reports). |
| `supabase/02_seed.sql` | Minnesota guilds, starter invite codes, and the evergreen library. |
| `supabase/03_jobs.sql` | Posts quests to Discord (and Telegram) when they go live, runs autopilot every Monday, and deletes "who did which quest" records a day after each quest closes. |
| `docs/` | Setup, principles, how to read the reports, and the roadmap. |

**Languages:** JavaScript, HTML, and CSS in the browser; SQL (PostgreSQL) on the server. Nothing to compile, so anyone can edit a file on GitHub and see the change after Pages redeploys.

## For contributors

- Member-facing text lives in `js/i18n.js` (English and Spanish). Adding a language means copying one block.
- Game content (classes, platforms, quest kinds) lives in `js/content.js`. XP per kind is also enforced in `supabase/01_schema.sql`.
- `js/backend-demo.js` and `js/backend-supabase.js` expose the same functions, so you can build features in demo mode without a database.
- Reddit is deliberately not a quest platform. See the principles doc for why.

## License

Pick one before you invite contributors: on GitHub, choose **Add file > Create new file**, name it `LICENSE`, and click **Choose a license template**. AGPL-3.0 keeps any hosted fork open source; MIT is the simplest and most permissive.
