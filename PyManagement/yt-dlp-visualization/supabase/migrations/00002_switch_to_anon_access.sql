-- 改为无登录的工具型应用：anon 角色全量读写，移除对 auth.uid() 的依赖
alter table public.presets alter column owner_id drop not null;
alter table public.presets alter column owner_id drop default;
alter table public.batch_tasks alter column owner_id drop not null;
alter table public.batch_tasks alter column owner_id drop default;

-- 清理旧的 authenticated owner 策略
drop policy "presets_select_own" on public.presets;
drop policy "presets_insert_own" on public.presets;
drop policy "presets_update_own" on public.presets;
drop policy "presets_delete_own" on public.presets;
drop policy "tasks_select_own" on public.batch_tasks;
drop policy "tasks_insert_own" on public.batch_tasks;
drop policy "tasks_update_own" on public.batch_tasks;
drop policy "tasks_delete_own" on public.batch_tasks;

-- anon + authenticated 全量读写（工具型应用，预设为公开模板）
create policy "presets_select_all" on public.presets for select to anon, authenticated using (true);
create policy "presets_insert_all" on public.presets for insert to anon, authenticated with check (true);
create policy "presets_update_all" on public.presets for update to anon, authenticated using (true) with check (true);
create policy "presets_delete_all" on public.presets for delete to anon, authenticated using (true);

create policy "tasks_select_all" on public.batch_tasks for select to anon, authenticated using (true);
create policy "tasks_insert_all" on public.batch_tasks for insert to anon, authenticated with check (true);
create policy "tasks_update_all" on public.batch_tasks for update to anon, authenticated using (true) with check (true);
create policy "tasks_delete_all" on public.batch_tasks for delete to anon, authenticated using (true);