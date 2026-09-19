create table if not exists public.admin_code_proposals (
  id uuid primary key default gen_random_uuid(),
  created_date timestamptz not null default now(),
  updated_date timestamptz not null default now(),
  created_by_id text not null,
  created_by_email text not null,
  instruction text not null,
  model_key text not null,
  repository text not null,
  base_branch text not null,
  base_commit_sha text not null,
  summary text not null,
  warnings jsonb not null default '[]'::jsonb,
  files jsonb not null default '[]'::jsonb,
  status text not null default 'proposed'
    check (status in ('proposed', 'submitted', 'closed')),
  branch_name text,
  pull_request_url text,
  pull_request_number integer,
  submitted_at timestamptz,
  submitted_by_id text
);

create index if not exists admin_code_proposals_recent_idx
  on public.admin_code_proposals (created_date desc);
create index if not exists admin_code_proposals_pending_idx
  on public.admin_code_proposals (status, created_date desc)
  where status = 'proposed';

alter table public.admin_code_proposals enable row level security;
revoke all on public.admin_code_proposals from public, anon, authenticated;
grant all on public.admin_code_proposals to service_role;
