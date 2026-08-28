export type SortDir = 'asc' | 'desc'

export type SortSpec = {
  column: string
  dir: SortDir
}

export type ListParams = Record<string, string | undefined>

/** Whitelisted UI column key → SQL expression. Never interpolate user input into SQL. */
export type SortColumnSql = Record<string, string>

export function parseSortParam(
  sort: string | undefined,
  dir: string | undefined,
  columns: SortColumnSql,
): SortSpec | null {
  if (!sort || !columns[sort]) return null
  if (dir === 'desc') return { column: sort, dir: 'desc' }
  return { column: sort, dir: 'asc' }
}

export function sqlOrderBy(
  sort: SortSpec | null | undefined,
  columns: SortColumnSql,
  fallbackSql: string,
): string {
  if (!sort) return fallbackSql
  const expr = columns[sort.column]
  if (!expr) return fallbackSql
  const dir = sort.dir === 'desc' ? 'DESC' : 'ASC'
  return `ORDER BY ${expr} ${dir}`
}

export function sortParams(sort: SortSpec | null | undefined): ListParams {
  if (!sort) return {}
  return { sort: sort.column, dir: sort.dir }
}

export function mergeListParams(...bags: Array<ListParams | undefined>): ListParams {
  const out: ListParams = {}
  for (const bag of bags) {
    if (!bag) continue
    for (const [key, value] of Object.entries(bag)) {
      if (value) out[key] = value
    }
  }
  return out
}

export function listQueryString(params: ListParams, page?: number): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value)
  }
  if (page && page > 1) search.set('page', String(page))
  return search.toString()
}

export function listUrl(basePath: string, params: ListParams, page?: number): string {
  const qs = listQueryString(params, page)
  return qs ? `${basePath}?${qs}` : basePath
}
