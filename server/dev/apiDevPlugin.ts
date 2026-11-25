// DEV ONLY: lets `npm run dev` answer /api/* with the files in api/,
// the same way Vercel does in production (one file per route, `[name].ts` for
// dynamic parts, exported GET/POST/... functions that take a Request and return a Response).
// Not used in production builds.
import fs from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import { loadEnv, type Plugin } from 'vite'

export function apiDevPlugin(): Plugin {
  return {
    name: 'vv-api-dev',
    apply: 'serve',
    configureServer(server) {
      // Give the api code every var from .env / .env.local (Vite only exposes VITE_* to the browser).
      // Edits to .env.local need a dev server restart.
      const env = loadEnv(server.config.mode, server.config.root, '')
      for (const [key, value] of Object.entries(env)) process.env[key] ??= value

      const apiDir = path.join(server.config.root, 'api')

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`)
        try {
          // Same rewrites as vercel.json (/api/health → /api/auth/health)
          const routePath = url.pathname === '/api/health' ? 'auth/health' : url.pathname.slice('/api/'.length)
          const file = findRoute(apiDir, routePath)
          if (!file) return send(res, Response.json({ error: 'Not found' }, { status: 404 }))

          const mod = await server.ssrLoadModule(file)
          const handler = mod[req.method ?? 'GET']
          if (typeof handler !== 'function') {
            return send(res, Response.json({ error: 'Method not allowed' }, { status: 405 }))
          }
          await send(res, await handler(await toRequest(req, url)))
        } catch (err) {
          if (err instanceof Error) server.ssrFixStacktrace(err)
          server.config.logger.error(`[api] ${req.method} ${url.pathname} failed:\n${String((err as Error)?.stack ?? err)}`)
          await send(res, Response.json({ error: 'Server error' }, { status: 500 }))
        }
      })
    },
  }
}

// "auth/login" -> api/auth/login.ts, or api/auth/[action].ts
function findRoute(apiDir: string, routePath: string): string | null {
  const parts = routePath.split('/').filter(Boolean)
  if (!parts.length || parts.some((p) => !/^[\w-]+$/.test(p))) return null

  let dir = apiDir
  for (let i = 0; i < parts.length; i++) {
    const last = i === parts.length - 1
    const entries = fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []
    const dynamic = (isDir: boolean) =>
      entries.find((e) => e.isDirectory() === isDir && /^\[\w+\](\.ts)?$/.test(e.name) && (isDir || e.name.endsWith('.ts')))

    if (last) {
      const exact = entries.find((e) => e.isFile() && e.name === `${parts[i]}.ts`)
      const match = exact ?? dynamic(false)
      return match ? path.join(dir, match.name) : null
    }
    const exactDir = entries.find((e) => e.isDirectory() && e.name === parts[i])
    const next = exactDir ?? dynamic(true)
    if (!next) return null
    dir = path.join(dir, next.name)
  }
  return null
}

async function toRequest(req: IncomingMessage, url: URL): Promise<Request> {
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
  }
  const method = req.method ?? 'GET'
  let body: Uint8Array<ArrayBuffer> | undefined
  if (method !== 'GET' && method !== 'HEAD') {
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(chunk as Buffer)
    body = new Uint8Array(Buffer.concat(chunks))
  }
  return new Request(url, { method, headers, body })
}

async function send(res: ServerResponse, response: Response) {
  res.statusCode = response.status
  response.headers.forEach((value, key) => {
    if (key !== 'set-cookie') res.setHeader(key, value)
  })
  const cookies = response.headers.getSetCookie()
  if (cookies.length) res.setHeader('set-cookie', cookies)
  res.end(Buffer.from(await response.arrayBuffer()))
}
