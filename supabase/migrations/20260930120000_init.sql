-- Job Application Agent. Server uses the service role. No anon policies.

create extension if not exists pgcrypto;

create table public.candidate_profiles (
  id uuid primary key default gen_random_uuid(),
  is_active boolean not null default true,
  personal_info jsonb not null,
  headline text not null,
  summary text not null default '',
  education jsonb not null default '[]'::jsonb,
  experiences jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  languages jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create unique index candidate_profiles_one_active
  on public.candidate_profiles (is_active)
  where is_active;

create table public.resumes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.candidate_profiles (id) on delete cascade,
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 3145728),
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  company text not null,
  position text not null,
  job_source text not null check (job_source in ('text', 'screenshot', 'url')),
  job_description text,
  job_analysis jsonb not null,
  recruiter_name text,
  recruiter_email text,
  email_subject text not null,
  email_body text not null,
  status text not null check (status in ('draft', 'ready', 'sent', 'failed')),
  sent_at timestamptz,
  error_message text,
  send_started_at timestamptz
);

create index applications_created_at_idx on public.applications (created_at desc);

create table public.microsoft_connections (
  id integer primary key default 1 check (id = 1),
  account_email text,
  encrypted_cache text not null,
  updated_at timestamptz not null default now()
);

alter table public.candidate_profiles enable row level security;
alter table public.resumes enable row level security;
alter table public.applications enable row level security;
alter table public.microsoft_connections enable row level security;

insert into storage.buckets (id, name, public)
values ('resumes', 'resumes', false)
on conflict (id) do update set public = false;
