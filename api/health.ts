// API route: GET /api/health -> { ok: true, app: 'seo-hub' }
// Setup check that the api/ folder runs (Vercel functions in production, apiDevPlugin in `npm run dev`).
export function GET() {
  return Response.json({ ok: true, app: 'seo-hub' })
}
