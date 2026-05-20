# Smart Daily Standup Bot

React frontend with Supabase email/password authentication, protected routes, and persistent sessions.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com).
2. Open **Authentication → Providers** and ensure **Email** is enabled.
3. Under **Authentication → URL Configuration**, set **Site URL** to `http://localhost:5173` for local dev.
4. Copy your **Project URL** and **anon public** key from **Project Settings → API**.

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in all values in `.env.example`. The shared client lives in `src/lib/supabaseClient.js`.

Server-only keys (`GEMINI_API_KEY`, `GITHUB_TOKEN`, `GITHUB_USERNAME`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`) must **not** use the `VITE_` prefix.

### 3. Run the app

```bash
npm install
npm run dev
```

`npm run dev` starts Vite with the standup API built in (no separate terminal needed). Optional: `npm run dev:server` runs the API alone on port 3001.

Visit `http://localhost:5173`. Unauthenticated users are redirected to `/login`. After sign-in, they land on `/dashboard`.

### Standup generation

On **Generate Standup**, the dashboard sends notes + the GitHub toggle to `POST /api/standup/generate`:

| GitHub toggle | User text mentions github / commits / git activity | GitHub fetched? |
| ------------- | ---------------------------------------------------- | --------------- |
| ON            | —                                                    | Yes             |
| OFF           | Yes                                                  | Yes             |
| OFF           | No                                                   | No              |

The API merges notes + commits, calls **Gemini** (or **OpenAI** if `OPENAI_API_KEY` is set), and returns **Yesterday / Today / Blockers**. Results are saved to Supabase and shown in the history strip (top-left).

## Auth features

- Email + password sign up and sign in
- Session stored in `localStorage` (Supabase client `persistSession`)
- Auto token refresh via `onAuthStateChange`
- Protected `/dashboard` route
- Public `/login` and `/signup` (redirect to dashboard when already signed in)
- Log out from the dashboard header

## Routes

| Path         | Access    |
| ------------ | --------- |
| `/`          | Redirects to `/dashboard` |
| `/login`     | Public    |
| `/signup`    | Public    |
| `/dashboard` | Protected |

## Database (standups + RLS)

Migrations live in `supabase/migrations/`. Apply them in order in the **Supabase SQL Editor** (or with the [Supabase CLI](https://supabase.com/docs/guides/cli)):

1. `20260517110000_create_standups_if_missing.sql` — only if you do **not** already have a `standups` table
2. `20260517120000_standups_user_rls.sql` — adds `user_id`, enables RLS, and creates policies
3. `20260517130000_standups_raw_notes.sql` — stores original notes on each standup

### Schema changes

| Column / rule | Purpose |
| ------------- | ------- |
| `user_id` | `uuid` FK → `auth.users(id)`, `ON DELETE CASCADE` |
| RLS enabled | Rows are hidden unless a policy allows access |
| `standups_select_own` | `SELECT` where `auth.uid() = user_id` |
| `standups_insert_own` | `INSERT` only when `user_id` matches the signed-in user |

When inserting from the app, set `user_id` to the current user’s id (e.g. `user.id` from `useAuth()`). Example:

```ts
await supabase.from('standups').insert({
  user_id: user.id,
  yesterday: '…',
  today: '…',
  blockers: '…',
})
```
