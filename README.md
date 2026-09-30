# Job Application Agent

Mobile-first desk for turning a job screenshot or pasted description into a reviewed application email, then sending it from a personal Hotmail account through Microsoft Graph.

The model may only use facts stored in your candidate profile. Requirements that are not on the profile show up as gaps.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

The app listens on [http://127.0.0.1:43123](http://127.0.0.1:43123).

Sign in with `APP_PASSWORD`. Generate `SESSION_SECRET` and `TOKEN_ENCRYPTION_KEY` with `openssl rand -base64 32`.

## Supabase

Create a project, then run `supabase/migrations/20260930120000_init.sql` in the SQL editor. Put the project URL and service role key in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. The browser never receives the service role key. The first visit to Profile seeds Pedro Rique's profile from `src/lib/profile/seed.ts`.

Upload the resume PDF in Profile. It is stored in the private `resumes` bucket and is not committed to git.

## Microsoft / Hotmail

Register an app in the Microsoft identity platform for **personal Microsoft accounts**.

- Delegated permissions: `Mail.Send`, `User.Read`
- Redirect URI: the value of `MICROSOFT_REDIRECT_URI`, for example `http://127.0.0.1:43123/api/microsoft/callback`
- Create a client secret

Then set `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_REDIRECT_URI`, and `TOKEN_ENCRYPTION_KEY`. Connect Outlook from Profile. The refresh token stays inside an encrypted MSAL cache in `microsoft_connections`.

Sending uses `POST /me/sendMail` with the PDF attached. Nothing is marked sent unless Graph accepts the message.

## OpenAI

Set `OPENAI_API_KEY`. Optional `OPENAI_MODEL` defaults to `gpt-5.5`. Screenshots use the model's vision. The response is a Zod schema via Structured Outputs, then checked against the profile before it is saved.

## Checks

```bash
npm test
npm run lint
npx tsc --noEmit
npm run build
```
