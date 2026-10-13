import { defineConfig, loadEnv } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Serves api/*.ts locally during `npm run dev`, mirroring Vercel Functions,
 * so the AI audit works without the Vercel CLI. Production uses Vercel directly.
 */
function localApi(): Plugin {
  return {
    name: 'melior-local-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/api', async (req, res, next) => {
        const name = (req.url ?? '').split('?')[0].replace(/^\//, '')
        if (!/^[a-z-]+$/.test(name)) return next()
        try {
          const mod = (await server.ssrLoadModule(`/api/${name}.ts`)) as Record<
            string,
            (r: Request) => Promise<Response> | Response
          >
          const handler = mod[req.method ?? 'GET']
          if (!handler) {
            res.statusCode = 405
            res.end()
            return
          }
          const chunks: Buffer[] = []
          for await (const c of req) chunks.push(c as Buffer)
          const headers = new Headers()
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v)
          const request = new Request(`http://localhost/api/${name}`, {
            method: req.method,
            headers,
            body: req.method === 'GET' || req.method === 'HEAD' ? undefined : Buffer.concat(chunks),
          })
          const response = await handler(request)
          res.statusCode = response.status
          response.headers.forEach((v, k) => res.setHeader(k, v))
          res.end(Buffer.from(await response.arrayBuffer()))
        } catch (err) {
          server.config.logger.error(String(err))
          res.statusCode = 500
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ error: 'dev_api_failed' }))
        }
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  // server-only secrets (no VITE_ prefix) for the local API handler — never bundled into the client
  const env = loadEnv(mode, process.cwd(), '')
  for (const k of ['GEMINI_API_KEY', 'GEMINI_MODEL']) {
    if (env[k] && !process.env[k]) process.env[k] = env[k]
  }
  return {
    plugins: [react(), localApi()],
    build: {
      target: 'es2020',
      chunkSizeWarningLimit: 1000,
    },
  }
})
