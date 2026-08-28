const CLARK_COUNTY_GEOCODER =
  'https://maps.clarkcountynv.gov/arcgis/rest/services/Locators/Clark_County_Composite/GeocodeServer/findAddressCandidates'

const PHOTON_GEOCODER = 'https://photon.komoot.io/api/'
const NEVADA_BBOX = '-120.0,35.0,-114.0,42.0'
const MIN_CLARK_SCORE = 70
const SUGGEST_MAX = 8

export type GeocodeResult = {
  lat: number
  lng: number
  formatted: string
  score: number
  source: 'clark' | 'photon'
}

type ClarkCandidate = {
  address?: string
  score?: number
  location?: { x: number; y: number }
}

async function fetchClarkCountyCandidates(address: string, maxLocations: number): Promise<GeocodeResult[]> {
  const trimmed = address.trim()
  if (!trimmed) return []

  const url = new URL(CLARK_COUNTY_GEOCODER)
  url.searchParams.set('SingleLine', trimmed)
  url.searchParams.set('f', 'json')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('maxLocations', String(maxLocations))

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!response.ok) return []

  const data = (await response.json()) as { candidates?: ClarkCandidate[] }
  const results: GeocodeResult[] = []
  for (const candidate of data.candidates ?? []) {
    if (!candidate?.location || (candidate.score ?? 0) < MIN_CLARK_SCORE) continue
    results.push({
      lng: candidate.location.x,
      lat: candidate.location.y,
      formatted: candidate.address?.trim() || trimmed,
      score: candidate.score ?? 0,
      source: 'clark',
    })
  }
  return results
}

async function fetchPhotonCandidates(address: string, limit: number): Promise<GeocodeResult[]> {
  let query = address.trim()
  if (!query) return []
  if (!/nevada|\bnv\b/i.test(query)) query = `${query}, Nevada`

  const url = new URL(PHOTON_GEOCODER)
  url.searchParams.set('q', query)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('bbox', NEVADA_BBOX)

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } })
  if (!response.ok) return []

  const data = (await response.json()) as {
    features?: Array<{
      geometry?: { coordinates?: [number, number] }
      properties?: { name?: string; street?: string; city?: string; state?: string; postcode?: string }
    }>
  }

  const results: GeocodeResult[] = []
  for (const feature of data.features ?? []) {
    const coords = feature.geometry?.coordinates
    if (!coords) continue
    const [lng, lat] = coords
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const props = feature.properties ?? {}
    const formatted = [props.name || props.street, props.city, props.state || 'NV', props.postcode]
      .filter(Boolean)
      .join(', ')
    results.push({
      lat,
      lng,
      formatted: formatted || query,
      score: 80,
      source: 'photon',
    })
  }
  return results
}

function dedupeResults(results: GeocodeResult[]): GeocodeResult[] {
  const seen = new Set<string>()
  const out: GeocodeResult[] = []
  for (const result of results) {
    const key = `${result.lat.toFixed(5)},${result.lng.toFixed(5)}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(result)
  }
  return out
}

export async function geocodeNevadaAddressCandidates(
  address: string,
  maxLocations = SUGGEST_MAX,
): Promise<GeocodeResult[]> {
  const [clark, photon] = await Promise.all([
    fetchClarkCountyCandidates(address, maxLocations).catch(() => []),
    fetchPhotonCandidates(address, maxLocations).catch(() => []),
  ])
  return dedupeResults([...clark, ...photon]).slice(0, maxLocations)
}

export async function geocodeNevadaAddress(address: string): Promise<GeocodeResult | null> {
  const candidates = await geocodeNevadaAddressCandidates(address, 1)
  return candidates[0] ?? null
}

export function parseManualCoordinates(
  latitude: unknown,
  longitude: unknown,
): { latitude: number; longitude: number } | null {
  const lat = typeof latitude === 'string' ? Number(latitude) : typeof latitude === 'number' ? latitude : NaN
  const lng =
    typeof longitude === 'string' ? Number(longitude) : typeof longitude === 'number' ? longitude : NaN
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { latitude: lat, longitude: lng }
}

export type EventCoords = { latitude: number | null; longitude: number | null }

export async function resolveEventFormCoordinates(
  location: string | null,
  options?: {
    existing?: { location: string | null; latitude: number | null; longitude: number | null } | null
    manual?: { latitude: number; longitude: number } | null
    skipMap?: boolean
  },
): Promise<EventCoords> {
  if (options?.skipMap) return { latitude: null, longitude: null }

  const trimmed = location?.trim() ?? ''
  if (!trimmed) return { latitude: null, longitude: null }

  const existingLocation = options?.existing?.location?.trim() ?? ''
  const locationChanged = !!options?.existing && trimmed !== existingLocation

  if (options?.manual) {
    const sameAsExisting =
      options.existing != null &&
      options.existing.latitude === options.manual.latitude &&
      options.existing.longitude === options.manual.longitude
    if (!(locationChanged && sameAsExisting)) {
      return { latitude: options.manual.latitude, longitude: options.manual.longitude }
    }
  }

  if (
    options?.existing &&
    !locationChanged &&
    options.existing.latitude != null &&
    options.existing.longitude != null
  ) {
    return { latitude: options.existing.latitude, longitude: options.existing.longitude }
  }

  const geocoded = await geocodeNevadaAddress(trimmed).catch(() => null)
  if (!geocoded) return { latitude: null, longitude: null }
  return { latitude: geocoded.lat, longitude: geocoded.lng }
}
