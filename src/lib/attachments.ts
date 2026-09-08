/**
 * One definition of what may be attached to a performance event.
 *
 * The storage bucket enforces the same list server-side; if these drift, a
 * file passes the picker and then fails on upload with a message the user
 * cannot act on. Keep them in step — see the attachments_allow_voice_notes
 * migration.
 */

export const BUCKET = 'employee-tracking-attachments'
export const MAX_BYTES = 10 * 1024 * 1024

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const DOC_TYPES = ['application/pdf']
export const AUDIO_TYPES = [
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
  'audio/aac',
]

export const ACCEPT = [...IMAGE_TYPES, ...DOC_TYPES, ...AUDIO_TYPES].join(',')

export const isAudio = (type: string, name = '') =>
  type.startsWith('audio/') || /\.(webm|ogg|m4a|mp3|mp4|wav|aac)$/i.test(name)

/** Human-readable size, so a rejection message says something useful. */
export const mb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`

/**
 * Storage path for one file.
 *
 * The first segment must be the event id — the storage policies read it with
 * storage.foldername(name)[1] to decide who may see the file, so the shape is
 * load-bearing, not cosmetic.
 */
export function attachmentPath(eventId: string, fileName: string) {
  const safe = fileName.replace(/[^\w.\- ]+/g, '_').slice(-80)
  return `${eventId}/${crypto.randomUUID()}-${safe}`
}

/** Why a file cannot be attached, or null if it can. */
export function rejectReason(file: File): string | null {
  if (file.size > MAX_BYTES) {
    return `${file.name} is ${mb(file.size)}. The limit is ${mb(MAX_BYTES)}.`
  }
  // A recorded clip arrives as audio/webm;codecs=opus — the parameters are
  // part of the MIME type but not part of what the bucket lists.
  const base = (file.type.split(';')[0] ?? '').trim()
  if (!ACCEPT.split(',').includes(base)) {
    return 'Only photos, PDFs and audio can be attached.'
  }
  return null
}
