import type { PaginatedResult } from './pagination'
import { PAGE_SIZE } from './pagination'

export const ASSET_UPLOAD_MAX_FILES = 10
export const ASSET_PHOTO_MAX_BYTES = 5 * 1024 * 1024
export const ASSET_PDF_MAX_BYTES = 25 * 1024 * 1024
export const ASSET_PICKER_PAGE_SIZE = 25

export type R2AssetRow = {
  key: string
  filename: string
  size: number
  uploaded: string | null
  mime_type: string | null
}

export type ListR2AssetsOptions = {
  prefix?: string
  sort?: 'date' | 'name'
  pageSize?: number
  imagesOnly?: boolean
}

function isImageAsset(row: Pick<R2AssetRow, 'filename' | 'mime_type'>): boolean {
  const mime = (row.mime_type || '').toLowerCase()
  if (mime.startsWith('image/')) return true
  return /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i.test(row.filename)
}

export function isAllowedAssetUpload(file: File): { ok: true } | { ok: false; error: string } {
  const type = (file.type || '').toLowerCase()
  const name = file.name || 'file'
  const isPdf = type === 'application/pdf' || /\.pdf$/i.test(name)
  const isImage = type.startsWith('image/') || /\.(jpe?g|png|gif|webp|svg|avif|bmp)$/i.test(name)

  if (!isPdf && !isImage) {
    return { ok: false, error: `${name}: only images and PDFs are allowed` }
  }
  if (isPdf && file.size > ASSET_PDF_MAX_BYTES) {
    return { ok: false, error: `${name}: PDFs must be ${formatBytes(ASSET_PDF_MAX_BYTES)} or smaller` }
  }
  if (isImage && file.size > ASSET_PHOTO_MAX_BYTES) {
    return { ok: false, error: `${name}: photos must be ${formatBytes(ASSET_PHOTO_MAX_BYTES)} or smaller` }
  }
  return { ok: true }
}

export async function listR2Assets(
  r2: R2Bucket,
  db: D1Database,
  page: number,
  options: ListR2AssetsOptions = {},
): Promise<PaginatedResult<R2AssetRow>> {
  const prefix = options.prefix ?? 'uploads/'
  const sort = options.sort === 'name' ? 'name' : 'date'
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : PAGE_SIZE
  const listed = await r2.list({ prefix, limit: 1000 })
  const objects = [...listed.objects]

  const keys = objects.map((o) => o.key)
  const indexMap = new Map<string, { filename: string; mime_type: string | null; created_at: string }>()
  if (keys.length) {
    const placeholders = keys.map(() => '?').join(', ')
    const { results } = await db
      .prepare(`SELECT r2_key, filename, mime_type, created_at FROM assets_index WHERE r2_key IN (${placeholders})`)
      .bind(...keys)
      .all<{ r2_key: string; filename: string; mime_type: string | null; created_at: string }>()
    for (const row of results ?? []) indexMap.set(row.r2_key, row)
  }

  let rows: R2AssetRow[] = objects.map((obj) => {
    const meta = indexMap.get(obj.key)
    const filename = meta?.filename ?? obj.key.split('/').pop() ?? obj.key
    return {
      key: obj.key,
      filename,
      size: obj.size,
      uploaded: meta?.created_at ?? obj.uploaded.toISOString(),
      mime_type: meta?.mime_type ?? obj.httpMetadata?.contentType ?? null,
    }
  })

  if (options.imagesOnly) {
    rows = rows.filter(isImageAsset)
  }

  rows.sort((a, b) => {
    if (sort === 'name') {
      return a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' })
    }
    const aTime = a.uploaded ? Date.parse(a.uploaded) : 0
    const bTime = b.uploaded ? Date.parse(b.uploaded) : 0
    return bTime - aTime
  })

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * pageSize

  return {
    items: rows.slice(offset, offset + pageSize),
    page: safePage,
    totalPages,
    total,
  }
}

export async function uploadR2Asset(
  r2: R2Bucket,
  db: D1Database,
  file: File,
  uploadedBy: string,
): Promise<{ key: string; filename: string }> {
  const check = isAllowedAssetUpload(file)
  if (!check.ok) throw new Error(check.error)

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file'
  const key = `uploads/${Date.now()}-${safeName}`
  const id = crypto.randomUUID()
  await r2.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: file.type || 'application/octet-stream' },
  })
  await db
    .prepare(
      `INSERT INTO assets_index (id, r2_key, filename, mime_type, uploaded_by)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(r2_key) DO UPDATE SET
         filename = excluded.filename,
         mime_type = excluded.mime_type,
         uploaded_by = excluded.uploaded_by`,
    )
    .bind(id, key, file.name, file.type || null, uploadedBy)
    .run()
  return { key, filename: file.name }
}

export async function getR2Object(r2: R2Bucket, key: string): Promise<R2ObjectBody | null> {
  if (!key.startsWith('uploads/')) return null
  return r2.get(key)
}

export async function deleteR2Asset(r2: R2Bucket, db: D1Database, key: string): Promise<void> {
  if (!key.startsWith('uploads/')) return
  await r2.delete(key)
  await db.prepare('DELETE FROM assets_index WHERE r2_key = ?').bind(key).run()
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function mediaUrlForKey(key: string): string {
  return `/api/v1/media/${key}`
}
