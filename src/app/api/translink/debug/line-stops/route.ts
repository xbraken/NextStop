import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

const BASE = 'https://opendata.translinkniplanner.co.uk/Ext_API'

// Diagnostic route. Usage:
//   /api/translink/debug/line-stops?stopId=700000015421&line=3B
// We first ask EFA which lines serve a stop — that gives us the internal
// line code EFA needs for stop-sequence lookups, then we probe the
// sequence endpoints with that code.
export async function GET(req: Request) {
  const token = process.env.TRANSLINK_API_KEY
  if (!token) return NextResponse.json({ error: 'no api key' }, { status: 500 })

  const url = new URL(req.url)
  const line = url.searchParams.get('line') ?? '3B'
  const stopId = url.searchParams.get('stopId') ?? ''

  const results: Array<Record<string, unknown>> = []

  // 1. Serving lines at a known stop (needs a real stopId)
  if (stopId) {
    results.push(await probe('XML_SERVINGLINES_REQUEST', {
      mode: 'line',
      type_sl: 'any',
      name_sl: stopId,
      lineReqType: '2',
      outputFormat: 'rapidJSON',
    }, token))
    results.push(await probe('XML_SERVINGLINES_REQUEST', {
      mode: 'odv',
      type_sl: 'stop',
      name_sl: stopId,
      outputFormat: 'rapidJSON',
    }, token))
  }

  // 2. Line list — try different param shapes
  results.push(await probe('XML_LINELIST_REQUEST', {
    lsShowTrainsExplicit: '1',
    line: line,
    outputFormat: 'rapidJSON',
  }, token))
  results.push(await probe('XML_LINELIST_REQUEST', {
    lineName: line,
    mergeDir: '1',
    outputFormat: 'rapidJSON',
  }, token))
  results.push(await probe('XML_LINELIST_REQUEST', {
    lineName: line,
    lsShowTrainsExplicit: '1',
    lineReqType: '1',
    outputFormat: 'rapidJSON',
  }, token))

  // 3. Pure alphanumeric stopseq — try with various "line" formats
  const candidates = [line, `ulb:${line}: :H`, `ulb:${line}: :R`, `ulb:00${line}: :H:j26`]
  for (const cand of candidates) {
    results.push(await probe('XML_STOPSEQCOORD_REQUEST', {
      line: cand,
      outputFormat: 'rapidJSON',
    }, token))
  }

  return NextResponse.json({ line, stopId, results })
}

async function probe(endpoint: string, params: Record<string, string>, token: string) {
  const qs = new URLSearchParams(params).toString()
  const fullUrl = `${BASE}/${endpoint}?${qs}`
  try {
    const res = await fetch(fullUrl, { headers: { 'X-API-TOKEN': token }, cache: 'no-store' })
    const text = await res.text()
    let body: unknown = text
    try { body = JSON.parse(text) } catch {}
    // Trim the body so the response stays readable
    return { endpoint, params, status: res.status, body: trim(body) }
  } catch (err) {
    return { endpoint, params, error: String(err) }
  }
}

function trim(v: unknown, depth = 0): unknown {
  if (depth > 4) return '…'
  if (Array.isArray(v)) return v.slice(0, 3).map((x) => trim(x, depth + 1))
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    let i = 0
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      if (i++ > 25) { out['…'] = 'truncated'; break }
      out[k] = trim(val, depth + 1)
    }
    return out
  }
  if (typeof v === 'string' && v.length > 300) return v.slice(0, 300) + '…'
  return v
}
