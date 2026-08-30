import { escapeHtml } from '../lib/admin-context'
import { listUrl, mergeListParams, type ListParams, type SortDir, type SortSpec } from '../lib/sort'

export function CommitteeSelect({
  committees,
  allowedSlugs,
  selectedSlug,
  required = true,
}: {
  committees: Array<{ slug: string; name: string }>
  allowedSlugs: string[] | null
  selectedSlug?: string | null
  required?: boolean
}) {
  const options = allowedSlugs
    ? committees.filter((c) => allowedSlugs.includes(String(c.slug)))
    : committees

  const noneSelected = !selectedSlug
  const selectAttrs = required ? { name: 'committee_slug' as const, required: true } : { name: 'committee_slug' as const }

  return (
    <label>
      Committee
      <select {...selectAttrs}>
        {allowedSlugs === null ? (
          <option value="" selected={noneSelected}>
            None / site-wide
          </option>
        ) : null}
        {options.map((c) => (
          <option value={String(c.slug)} selected={selectedSlug === c.slug}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  )
}

export function ListSearch({
  action,
  query,
  placeholder = 'Search…',
  params,
}: {
  action: string
  query?: string
  placeholder?: string
  params?: ListParams
}) {
  const hidden = Object.entries(params ?? {}).filter(([key, value]) => key !== 'q' && value)
  return (
    <form method="get" action={action} class="admin-list-search">
      {hidden.map(([name, value]) => (
        <input type="hidden" name={name} value={escapeHtml(value ?? '')} />
      ))}
      <input
        type="search"
        name="q"
        value={escapeHtml(query ?? '')}
        placeholder={placeholder}
        aria-label="Search"
      />
      <button class="btn btn-secondary" type="submit">
        Search
      </button>
      {query ? (
        <a class="btn btn-secondary" href={listUrl(action, params ?? {})}>
          Clear
        </a>
      ) : null}
    </form>
  )
}

export type SortableColumn = {
  key?: string
  label: string
  defaultDir?: SortDir
}

export function SortableHead({
  columns,
  current,
  basePath,
  search,
  params,
}: {
  columns: SortableColumn[]
  current: SortSpec | null
  basePath: string
  search?: string
  params?: ListParams
}) {
  return (
    <thead>
      <tr>
        {columns.map((col) =>
          col.key ? (
            <SortableTh
              label={col.label}
              column={col.key}
              current={current}
              basePath={basePath}
              search={search}
              params={params}
              defaultDir={col.defaultDir}
            />
          ) : (
            <th>{col.label}</th>
          ),
        )}
      </tr>
    </thead>
  )
}

export function SortableTh({
  label,
  column,
  current,
  basePath,
  search,
  params,
  defaultDir = 'asc',
}: {
  label: string
  column: string
  current: SortSpec | null
  basePath: string
  search?: string
  params?: ListParams
  defaultDir?: SortDir
}) {
  const active = current?.column === column
  const nextDir: SortDir = active ? (current.dir === 'asc' ? 'desc' : 'asc') : defaultDir
  const href = listUrl(
    basePath,
    mergeListParams(params, search?.trim() ? { q: search.trim() } : undefined, {
      sort: column,
      dir: nextDir,
    }),
  )
  const ariaSort = active ? (current.dir === 'desc' ? 'descending' : 'ascending') : 'none'
  return (
    <th aria-sort={ariaSort}>
      <a class={`admin-sort${active ? ' is-active' : ''}`} href={href}>
        {label}
        <span class="admin-sort-ind" aria-hidden="true">
          {active ? (current.dir === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </a>
    </th>
  )
}

export function AssetUrlField({
  label,
  name,
  value,
  placeholder,
  r2Name,
  r2Value,
}: {
  label: string
  name: string
  value?: string | null
  placeholder?: string
  r2Name?: string
  r2Value?: string | null
}) {
  return (
    <div class="asset-url-field" data-asset-url-field>
      <label>{label}</label>
      <div class="asset-url-row">
        <input
          name={name}
          value={String(value ?? '')}
          placeholder={placeholder}
          data-asset-url-input
        />
        <button type="button" class="btn btn-secondary" data-asset-pick>
          Choose from assets
        </button>
      </div>
      {r2Name ? <input type="hidden" name={r2Name} value={String(r2Value ?? '')} data-asset-r2-input /> : null}
    </div>
  )
}

export function Pagination({
  page,
  totalPages,
  total,
  basePath,
  search,
  params,
}: {
  page: number
  totalPages: number
  total: number
  basePath: string
  search?: string
  params?: ListParams
}) {
  const PAGE_SIZE = 20
  if (total <= PAGE_SIZE && !search?.trim()) return null

  const merged = mergeListParams(params, search?.trim() ? { q: search.trim() } : undefined)
  const pageUrl = (targetPage: number) => listUrl(basePath, merged, targetPage)

  const prev = page > 1 ? pageUrl(page - 1) : null
  const next = page < totalPages ? pageUrl(page + 1) : null

  return (
    <nav class="admin-pagination" aria-label="Pagination">
      <span class="admin-pagination-info">
        Showing page {page} of {totalPages} · {total} total
      </span>
      <div class="admin-pagination-links">
        {prev ? (
          <a class="btn btn-secondary" href={prev}>
            Previous
          </a>
        ) : (
          <span class="btn btn-secondary disabled">Previous</span>
        )}
        {next ? (
          <a class="btn btn-secondary" href={next}>
            Next
          </a>
        ) : (
          <span class="btn btn-secondary disabled">Next</span>
        )}
      </div>
    </nav>
  )
}
