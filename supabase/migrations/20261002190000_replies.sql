-- Reply tracking. Run in the Supabase SQL editor.

alter table public.applications
  add column if not exists conversation_id text,
  add column if not exists reply_from text,
  add column if not exists reply_preview text,
  add column if not exists reply_received_at timestamptz;
