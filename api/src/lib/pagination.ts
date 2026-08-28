export const PAGE_SIZE = 20

export type PaginatedResult<T> = {
  items: T[]
  page: number
  totalPages: number
  total: number
}

export function parsePageParam(value: string | undefined): number {
  const page = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(page) && page > 0 ? page : 1
}

export function parseSearchParam(value: string | undefined): string {
  return (value ?? '').trim().slice(0, 100)
}

export function likePattern(term: string): string {
  const escaped = term.replace(/[%_\\]/g, (ch) => `\\${ch}`)
  return `%${escaped}%`
}

export async function paginateQuery<T>(
  db: D1Database,
  countSql: string,
  dataSql: string,
  page: number,
  binds: unknown[] = [],
): Promise<PaginatedResult<T>> {
  const countRow = await db.prepare(countSql).bind(...binds).first<{ c: number }>()
  const total = countRow?.c ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const offset = (safePage - 1) * PAGE_SIZE
  const { results } = await db
    .prepare(`${dataSql} LIMIT ? OFFSET ?`)
    .bind(...binds, PAGE_SIZE, offset)
    .all<T>()
  return {
    items: results ?? [],
    page: safePage,
    totalPages,
    total,
  }
}
