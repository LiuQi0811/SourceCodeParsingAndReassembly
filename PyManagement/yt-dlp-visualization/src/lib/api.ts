import { supabase } from '@/db/supabase'
import type { Preset, BatchTask, YtDlpConfig, VideoMeta } from '@/lib/yt-dlp/types'

const emptyToNull = (v: string) => (v && v.trim() !== '' ? v : null)

// ============ 预设 ============
export async function fetchPresets(): Promise<Preset[]> {
  const { data, error } = await supabase
    .from('presets')
    .select('id,name,description,category,config,created_at,updated_at')
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) {
    console.error('fetchPresets error:', error.message)
    return []
  }
  return Array.isArray(data) ? (data as Preset[]) : []
}

export async function createPreset(input: {
  name: string
  description: string
  category: string
  config: Partial<YtDlpConfig>
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('presets').insert({
    name: input.name.trim(),
    description: input.description.trim(),
    category: input.category || 'custom',
    config: input.config,
  })
  return { error: error ? error.message : null }
}

export async function updatePreset(
  id: string,
  input: { name: string; description: string; category: string; config: Partial<YtDlpConfig> },
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('presets')
    .update({
      name: input.name.trim(),
      description: input.description.trim(),
      category: input.category || 'custom',
      config: input.config,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
  return { error: error ? error.message : null }
}

export async function deletePreset(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('presets').delete().eq('id', id)
  return { error: error ? error.message : null }
}

// ============ 批量任务 ============
export async function fetchBatchTasks(): Promise<BatchTask[]> {
  const { data, error } = await supabase
    .from('batch_tasks')
    .select('id,url,title,preset_name,config,status,created_at')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) {
    console.error('fetchBatchTasks error:', error.message)
    return []
  }
  return Array.isArray(data) ? (data as BatchTask[]) : []
}

export async function addBatchTask(input: {
  url: string
  title: string
  preset_name: string
  config: Partial<YtDlpConfig>
}): Promise<{ error: string | null }> {
  const { error } = await supabase.from('batch_tasks').insert({
    url: input.url.trim(),
    title: emptyToNull(input.title) ?? '',
    preset_name: emptyToNull(input.preset_name) ?? '',
    config: input.config,
    status: 'pending',
  })
  return { error: error ? error.message : null }
}

export async function updateBatchTaskStatus(
  id: string,
  status: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from('batch_tasks').update({ status }).eq('id', id)
  return { error: error ? error.message : null }
}

export async function deleteBatchTask(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase.from('batch_tasks').delete().eq('id', id)
  return { error: error ? error.message : null }
}

export async function clearBatchTasks(): Promise<{ error: string | null }> {
  const { error } = await supabase.from('batch_tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  return { error: error ? error.message : null }
}

// ============ 视频元数据解析（Edge Function）============
export async function resolveVideoMeta(url: string): Promise<{
  data: VideoMeta | null
  error: string | null
}> {
  const { data, error } = await supabase.functions.invoke('metadata-resolver', {
    body: { url },
    method: 'POST',
  })
  if (error) {
    let msg = error.message
    try {
      const text = await error.context?.text()
      if (text) {
        const parsed = JSON.parse(text)
        msg = parsed.error || msg
      }
    } catch (_e) {
      // ignore
    }
    return { data: null, error: msg }
  }
  return { data: data?.data ?? null, error: data?.error ?? null }
}