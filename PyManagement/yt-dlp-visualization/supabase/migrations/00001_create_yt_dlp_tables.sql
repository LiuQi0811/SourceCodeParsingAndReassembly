-- 预设表：保存用户自定义的 yt-dlp 参数组合
create table public.presets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  name text not null,
  description text not null default '',
  category text not null default 'custom',
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 批量任务表：保存批量下载任务
create table public.batch_tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid(),
  url text not null,
  title text not null default '',
  preset_name text not null default '',
  config jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index idx_presets_owner on public.presets (owner_id, created_at desc);
create index idx_batch_tasks_owner on public.batch_tasks (owner_id, created_at desc);

-- 启用 RLS
alter table public.presets enable row level security;
alter table public.batch_tasks enable row level security;

-- presets 策略：匿名登录后按 owner_id 隔离
create policy "presets_select_own" on public.presets
  for select to authenticated using (owner_id = auth.uid());
create policy "presets_insert_own" on public.presets
  for insert to authenticated with check (owner_id = auth.uid());
create policy "presets_update_own" on public.presets
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "presets_delete_own" on public.presets
  for delete to authenticated using (owner_id = auth.uid());

-- batch_tasks 策略
create policy "tasks_select_own" on public.batch_tasks
  for select to authenticated using (owner_id = auth.uid());
create policy "tasks_insert_own" on public.batch_tasks
  for insert to authenticated with check (owner_id = auth.uid());
create policy "tasks_update_own" on public.batch_tasks
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "tasks_delete_own" on public.batch_tasks
  for delete to authenticated using (owner_id = auth.uid());