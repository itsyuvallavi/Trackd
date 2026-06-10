import { createClient } from '@supabase/supabase-js'

export const RESUME_BUCKET = 'resume'
export const SIGNED_STORAGE_URL_TTL_SECONDS = 5 * 60

export class PrivateStorageError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message)
    this.name = 'PrivateStorageError'
  }
}

export function getSupabaseStorageAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!url || !key) {
    throw new PrivateStorageError('Storage is not configured.', 503)
  }

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function storageObjectPath(value: string, bucket = RESUME_BUCKET): string | null {
  const raw = value?.trim()
  if (!raw) return null
  if (!/^https?:\/\//i.test(raw)) return raw.replace(/^\/+/, '')

  try {
    const pathname = new URL(raw).pathname
    const markers = [
      `/object/public/${bucket}/`,
      `/object/sign/${bucket}/`,
      `/object/authenticated/${bucket}/`,
    ] as const

    for (const marker of markers) {
      const index = pathname.indexOf(marker)
      if (index !== -1) {
        const segment = pathname.slice(index + marker.length)
        return decodeStoragePathSegment(segment)
      }
    }

    const parts = pathname.split(`/${bucket}/`)
    if (parts.length > 1) {
      return decodeStoragePathSegment(parts[parts.length - 1]!)
    }
  } catch {
    return null
  }

  return null
}

export async function createSignedStorageUrl(objectPath: string, downloadName?: string) {
  const supabase = getSupabaseStorageAdmin()
  const { data, error } = await supabase.storage
    .from(RESUME_BUCKET)
    .createSignedUrl(objectPath, SIGNED_STORAGE_URL_TTL_SECONDS, downloadName ? { download: downloadName } : undefined)

  if (error || !data?.signedUrl) {
    throw new PrivateStorageError('Could not create a signed file URL.', 502)
  }

  return data.signedUrl
}

export async function downloadStorageObject(objectPath: string): Promise<Buffer> {
  const supabase = getSupabaseStorageAdmin()
  const { data, error } = await supabase.storage.from(RESUME_BUCKET).download(objectPath)
  if (error || !data) {
    throw new PrivateStorageError('Could not download the stored file.', 502)
  }
  return Buffer.from(await data.arrayBuffer())
}

function decodeStoragePathSegment(segment: string) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}
