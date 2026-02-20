import { createServer } from 'http'
import { createReadStream } from 'fs'
import { join, extname } from 'path'
import { stat } from 'fs/promises'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
}

export class TestServer {
  private server: any
  private port: number
  private rootDir: string
  private actualPort: number = 0

  constructor(rootDir: string, port: number = 0) {
    this.rootDir = rootDir
    this.port = port // 0 means auto-select available port
  }

  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = createServer(async (req, res) => {
        try {
          // Handle CORS
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

          if (req.method === 'OPTIONS') {
            res.writeHead(200)
            res.end()
            return
          }

          let filePath = join(this.rootDir, req.url || '/')

          // Check if file exists
          try {
            const stats = await stat(filePath)
            if (stats.isDirectory()) {
              filePath = join(filePath, 'index.html')
            }
          } catch {
            // File not found
            res.writeHead(404)
            res.end('Not found')
            return
          }

          // Get MIME type
          const ext = extname(filePath)
          const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

          // Serve the file
          res.writeHead(200, { 'Content-Type': mimeType })
          createReadStream(filePath).pipe(res)
        } catch (error) {
          console.error('Server error:', error)
          res.writeHead(500)
          res.end('Internal server error')
        }
      })

      this.server.listen(this.port, () => {
        const address = this.server.address()
        this.actualPort = address.port
        console.log(`✅ Test server started on http://localhost:${this.actualPort}`)
        resolve(this.actualPort)
      })

      this.server.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE' && this.port !== 0) {
          console.log(`Port ${this.port} is in use, trying random port...`)
          this.server.listen(0, () => {
            const address = this.server.address()
            this.actualPort = address.port
            console.log(`✅ Test server started on http://localhost:${this.actualPort}`)
            resolve(this.actualPort)
          })
        } else {
          reject(err)
        }
      })
    })
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('✅ Test server stopped')
          resolve()
        })
      } else {
        resolve()
      }
    })
  }

  getUrl(path: string = ''): string {
    return `http://localhost:${this.actualPort}${path}`
  }

  getPort(): number {
    return this.actualPort
  }
}