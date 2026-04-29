#!/usr/bin/env node
// Static file server for e2e tests. Replaces `npx http-server` because that
// package crashes on certain malformed requests under parallel load — and a
// dead server fails 20+ tests with ERR_CONNECTION_REFUSED in a way that's
// indistinguishable from a real bug. This one logs every error instead of
// exiting and sets keep-alive timeouts to bounded values.
//
// Usage: node tests/test-server.js [--port 3456] [--root tests/test-pages]

const http = require('node:http')
const fs = require('node:fs')
const path = require('node:path')
const { URL } = require('node:url')

const args = process.argv.slice(2)
const getArg = (flag, fallback) => {
  const i = args.indexOf(flag)
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback
}

const port = Number(getArg('-p', getArg('--port', '3456')))
const root = path.resolve(getArg('--root', 'tests/test-pages'))

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
}

const server = http.createServer((req, res) => {
  let pathname
  try {
    pathname = decodeURIComponent(new URL(req.url, `http://localhost:${port}`).pathname)
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' })
    return res.end('Bad Request')
  }

  const safeRel = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '')
  const filePath = path.join(root, safeRel)

  if (!filePath.startsWith(root)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' })
    return res.end('Forbidden')
  }

  fs.stat(filePath, (err, stat) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      return res.end('Not Found')
    }

    const target = stat.isDirectory() ? path.join(filePath, 'index.html') : filePath
    const ext = path.extname(target).toLowerCase()
    const stream = fs.createReadStream(target)

    // Defer writeHead until the stream actually opens. fs.createReadStream
    // returns synchronously but opens the fd asynchronously, so emitting a
    // 200 first means a mid-flight unlink (or perms change between stat and
    // open) sends headers we then can't take back. Wait for 'open', then
    // commit to 200 and pipe.
    stream.once('open', () => {
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        // Tests expect resources fresh; staleness here masks build issues.
        'Cache-Control': 'no-store',
        // Allow inlined extension iframes to fetch test fixtures cross-origin.
        'Access-Control-Allow-Origin': '*'
      })
      stream.pipe(res)
    })

    stream.once('error', () => {
      if (!res.headersSent) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Not Found')
      } else {
        res.destroy()
      }
    })
  })
})

// http-server v14 crashes on the first ECONNRESET / parse error; ours just
// logs and keeps serving. Each socket-level miscue should not take the whole
// server down.
server.on('clientError', (err, socket) => {
  console.error('[test-server] clientError:', err.code || err.message)
  if (socket.writable) {
    socket.end('HTTP/1.1 400 Bad Request\r\n\r\n')
  } else {
    socket.destroy()
  }
})

server.on('error', (err) => {
  console.error('[test-server] server error:', err)
})

process.on('uncaughtException', (err) => {
  console.error('[test-server] uncaughtException:', err)
})

// Node defaults (keepAlive 5s, headers 60s, request 5m) are well-tested for
// keep-alive lifecycle; overriding them with shorter values here killed
// reload requests in long-running tests with ERR_HTTP_REQUEST_TIMEOUT.
server.keepAliveTimeout = 30_000

server.listen(port, () => {
  console.log(`[test-server] serving ${root} on http://localhost:${port}`)
})

const shutdown = () => {
  console.log('[test-server] shutting down')
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 2000).unref()
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
