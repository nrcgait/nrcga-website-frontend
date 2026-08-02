import { escapeHtml } from '../lib/admin-context'

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

  return (
    <label>
      Committee
      <select name="committee_slug" required={required}>
        {allowedSlugs === null ? <option value="">None / site-wide</option> : null}
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
}: {
  action: string
  query?: string
  placeholder?: string
}) {
  return (
    <form method="get" action={action} class="admin-list-search">
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
        <a class="btn btn-secondary" href={action}>
          Clear
        </a>
      ) : null}
    </form>
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
}: {
  page: number
  totalPages: number
  total: number
  basePath: string
  search?: string
}) {
  const PAGE_SIZE = 20
  if (total <= PAGE_SIZE && !search?.trim()) return null

  const pageUrl = (targetPage: number) => {
    const params = new URLSearchParams()
    if (search?.trim()) params.set('q', search.trim())
    if (targetPage > 1) params.set('page', String(targetPage))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

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
