import type { PaginatedResult } from './pagination'
import { PAGE_SIZE } from './pagination'
import type { SortColumnSql, SortSpec } from './sort'

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

export const ASSET_SORT_COLUMNS: SortColumnSql = {
  filename: 'filename',
  size: 'size',
  uploaded: 'uploaded',
  url: 'url',
}

export type ListR2AssetsOptions = {
  prefix?: string
  sort?: string
  dir?: 'asc' | 'desc'
  pageSize?: number
  imagesOnly?: boolean
}

function resolveAssetSort(options: ListR2AssetsOptions): SortSpec {
  const sort = options.sort
  if (sort === 'name' || sort === 'filename') {
    return { column: 'filename', dir: options.dir === 'desc' ? 'desc' : 'asc' }
  }
  if (sort === 'size') {
    return { column: 'size', dir: options.dir === 'desc' ? 'desc' : 'asc' }
  }
  if (sort === 'url') {
    return { column: 'url', dir: options.dir === 'desc' ? 'desc' : 'asc' }
  }
  if (sort === 'uploaded') {
    return { column: 'uploaded', dir: options.dir === 'asc' ? 'asc' : 'desc' }
  }
  return { column: 'uploaded', dir: options.dir === 'asc' ? 'asc' : 'desc' }
}

function isImageAsset(row: Pick<R2AssetRow, 'filename' | 'mime_type'>): boolean {
  const mime = (row.mime_type || '').toLowerCase()
  if (mime.startsWith('image/') && !mime.includes('svg')) return true
  return /\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(row.filename)
}

type SniffResult = { mime: string; kind: 'jpeg' | 'png' | 'gif' | 'webp' | 'pdf' | null }

function sniffFileType(bytes: Uint8Array): SniffResult {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mime: 'image/jpeg', kind: 'jpeg' }
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return { mime: 'image/png', kind: 'png' }
  }
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) {
    return { mime: 'image/gif', kind: 'gif' }
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mime: 'image/webp', kind: 'webp' }
  }
  if (bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) {
    return { mime: 'application/pdf', kind: 'pdf' }
  }
  return { mime: 'application/octet-stream', kind: null }
}

export function isAllowedAssetUpload(file: File): { ok: true } | { ok: false; error: string } {
  const name = file.name || 'file'
  if (/\.svg$/i.test(name)) {
    return { ok: false, error: `${name}: SVG uploads are not allowed` }
  }
  const isPdf = /\.pdf$/i.test(name)
  const isImage = /\.(jpe?g|png|gif|webp|avif|bmp)$/i.test(name)

  if (!isPdf && !isImage) {
    return { ok: false, error: `${name}: only JPEG, PNG, GIF, WebP, and PDFs are allowed` }
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
  const { column, dir } = resolveAssetSort(options)
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
    let cmp = 0
    if (column === 'filename') {
      cmp = a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' })
    } else if (column === 'size') {
      cmp = a.size - b.size
    } else if (column === 'url') {
      cmp = a.key.localeCompare(b.key, undefined, { sensitivity: 'base' })
    } else {
      const aTime = a.uploaded ? Date.parse(a.uploaded) : 0
      const bTime = b.uploaded ? Date.parse(b.uploaded) : 0
      cmp = aTime - bTime
    }
    return dir === 'desc' ? -cmp : cmp
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

  const buffer = await file.arrayBuffer()
  const sniffed = sniffFileType(new Uint8Array(buffer))
  if (!sniffed.kind) throw new Error(`${file.name}: file content does not match an allowed image or PDF type`)
  if (sniffed.kind === 'pdf' && !/\.pdf$/i.test(file.name)) {
    throw new Error(`${file.name}: PDF content must use a .pdf extension`)
  }
  if (sniffed.kind !== 'pdf' && /\.pdf$/i.test(file.name)) {
    throw new Error(`${file.name}: file content is not a valid PDF`)
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'file'
  const key = `uploads/${Date.now()}-${safeName}`
  const id = crypto.randomUUID()
  await r2.put(key, buffer, {
    httpMetadata: { contentType: sniffed.mime },
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
    .bind(id, key, file.name, sniffed.mime, uploadedBy)
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
