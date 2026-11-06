# Personal CRM

A private CRM for the people you meet at networking events, on LinkedIn, at meetups and on WhatsApp.
It reminds you when to get back in touch, so contacts stop slipping away.

**What it does**

- **Follow-ups home screen**: who's overdue, who's coming up, and one-tap WhatsApp / LinkedIn buttons that log the check-in for you.
- **Contacts**: search plus filters by role (Founder, C-suite, Investor…), how you met, event, company and tag. You can also group the list by any of those.
- **Fast entry at events**: create the event first, then use *Add someone I met here* → **Save & add another**. Source, event and date stay filled in between people.
- **Role detection**: types "Co-founder & CMO" and it files them under Founder automatically. You can override it.
- **Duplicate check**: warns you if the phone, email or LinkedIn is already saved, even when the number is written differently.
- **Contact page**: call, WhatsApp, LinkedIn, email, **Save to phone contacts** (.vcf), notes and a history of every check-in.
- **LinkedIn import**: upload LinkedIn's `Connections.csv` (or any CSV with a Name column). Already-saved people are skipped.
- **Export**: download everything as a CSV backup at any time (Contacts → Export CSV).
- **Works like an app on your phone**: add it to your home screen (see below).

---

## 1. Put it online (one-time setup, about 20 minutes)

You need three free accounts: **GitHub** (to hold the code), **Supabase** (the database) and **Vercel** (the hosting).

### Step 1: Create the database on Supabase

1. Go to <https://supabase.com>, sign up, and click **New project**.
2. Name it `personal-crm`, set a **database password** (save it somewhere safe), and pick the region closest to you.
3. When the project is ready, click **Connect** (top of the dashboard).
4. Under **Connection string**, choose **Transaction pooler** (port **6543**) and copy the URI. It looks like:
   `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-xx-xxxx-1.pooler.supabase.com:6543/postgres`
5. Replace `[YOUR-PASSWORD]` with the database password from step 2. This full string is your `DATABASE_URL`.

You don't need to create any tables. The app creates them itself on first launch.

### Step 2: Put the code on GitHub

1. Create a **private** repository on <https://github.com/new> called `personal-crm`.
2. In this folder, run:

```bash
git add -A
```

```bash
git commit -m "Personal CRM"
```

```bash
git branch -M main
```

```bash
git remote add origin https://github.com/YOUR-USERNAME/personal-crm.git
```

```bash
git push -u origin main
```

### Step 3: Deploy on Vercel

1. Go to <https://vercel.com>, sign up with GitHub, click **Add New → Project** and import `personal-crm`.
2. Before clicking Deploy, open **Environment Variables** and add these three:

| Name | Value |
|---|---|
| `DATABASE_URL` | the Supabase string from Step 1 |
| `APP_PASSWORD` | the password you'll type to sign in. Make it long, since this app holds people's phone numbers. |
| `SESSION_SECRET` | a long random string. Generate one with the command below. |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Click **Deploy**. After about a minute you get a link like `https://personal-crm-yourname.vercel.app`.

### Step 4: Add it to your phone's home screen

Open your Vercel link on your phone and sign in once (you stay signed in for 90 days).

- **iPhone (Safari)**: Share button → **Add to Home Screen**.
- **Android (Chrome)**: ⋮ menu → **Add to Home screen** / **Install app**.

It opens full-screen like a normal app.

---

## 2. Everyday use

- **Before an event**: Events → New event.
- **At the event**: open the event → *Add someone I met here* → **Save & add another** after each person.
- **After meeting someone**: tap **Save to phone** on their page to add them to your phone's contacts too.
- **Weekly**: open Follow-ups and message whoever is overdue. The WhatsApp/LinkedIn buttons log it for you, and ✓ just marks it done.
- **Reminder intervals**: each contact has one (every 2 weeks up to once a year, or off). Star your key people.
- **Reconnecting with old LinkedIn contacts**: download your connections (Import page explains how) and import them. People you connected with long ago show up as overdue, which is your list of people to reconnect with. For a very large network, choose *No reminders* when importing and turn reminders on per person instead.

**Phone numbers**: include the country code (e.g. `+971…`, `+92…`) so the WhatsApp button opens the right chat.

---

## 3. Running it on your computer (optional)

Needs Node.js 20+. Locally the app uses a built-in database stored in `.data/`, so no Supabase is needed.

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000>. The local password is in `.env.local` (`APP_PASSWORD`).
The very first page load takes ~30 seconds while the local database sets itself up.

To point local development at Supabase instead, add `DATABASE_URL=...` to `.env.local`.

---

## Tech notes

- Next.js 16 (App Router, server actions), TypeScript, Tailwind CSS v4, shadcn/ui (Base UI)
- Drizzle ORM → Supabase Postgres via `postgres` (transaction pooler, `prepare: false`); PGlite locally
- Tables are created automatically (`src/db/schema.ts` → `SCHEMA_SQL`), with row-level security enabled so Supabase's public API can't read them
- Single-user password login: HMAC-signed cookie checked in `src/proxy.ts` and again in every server action
- Key folders: `src/app/(app)` pages · `src/app/actions.ts` all writes · `src/lib/server/data.ts` all reads · `src/lib/crm.ts` shared rules (sources, roles, reminders)

## License

MIT. See [LICENSE](LICENSE).
