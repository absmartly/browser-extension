#!/usr/bin/env node

const { spawn } = require("child_process")
const { PassThrough } = require("stream")

const DEBUG = process.env.DEBUG_NATIVE_HOST === "1"

function log(...args) {
  if (DEBUG) {
    const message = args.map((a) => (typeof a === "object" ? JSON.stringify(a) : a)).join(" ")
    require("fs").appendFileSync("/tmp/native-host-debug.log", `${new Date().toISOString()} ${message}\n`)
  }
}

function createMessageReader(stream, callback) {
  let buffer = Buffer.alloc(0)
  let messageLength = null

  stream.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk])

    while (true) {
      if (messageLength === null && buffer.length >= 4) {
        messageLength = buffer.readUInt32LE(0)
        buffer = buffer.slice(4)
      }

      if (messageLength !== null && buffer.length >= messageLength) {
        const messageBuffer = buffer.slice(0, messageLength)
        buffer = buffer.slice(messageLength)
        messageLength = null

        try {
          const message = JSON.parse(messageBuffer.toString("utf-8"))
          callback(null, message)
        } catch (err) {
          callback(err)
        }
      } else {
        break
      }
    }
  })

  stream.on("end", () => {
    log("Chrome input stream ended")
    process.exit(0)
  })

  stream.on("error", (err) => {
    log("Chrome input stream error:", err)
    process.exit(1)
  })
}

function writeMessage(stream, message) {
  const messageStr = JSON.stringify(message)
  const messageBuffer = Buffer.from(messageStr, "utf-8")
  const lengthBuffer = Buffer.alloc(4)
  lengthBuffer.writeUInt32LE(messageBuffer.length, 0)

  stream.write(lengthBuffer)
  stream.write(messageBuffer)
}

function startClaudeCLI() {
  log("Starting Claude Code CLI via npx...")

  const claude = spawn("npx", ["@anthropic-ai/claude-code", "--json"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...process.env,
      NODE_ENV: "production",
    },
  })

  claude.on("error", (err) => {
    log("Failed to start Claude CLI:", err)
    writeMessage(process.stdout, {
      type: "error",
      error: "Failed to start Claude Code CLI: " + err.message,
    })
    process.exit(1)
  })

  claude.stderr.on("data", (data) => {
    log("Claude CLI stderr:", data.toString())
  })

  claude.on("exit", (code, signal) => {
    log(`Claude CLI exited with code ${code}, signal ${signal}`)
    process.exit(code || 0)
  })

  return claude
}

function main() {
  log("Native host starting...")

  const claude = startClaudeCLI()

  createMessageReader(process.stdin, (err, message) => {
    if (err) {
      log("Error reading message from Chrome:", err)
      writeMessage(process.stdout, {
        type: "error",
        error: "Failed to parse message from Chrome",
      })
      return
    }

    log("Received message from Chrome:", message)

    if (message.type === "stdin") {
      log("Forwarding stdin to Claude CLI:", message.data)
      claude.stdin.write(JSON.stringify(message.data) + "\n")
    } else if (message.type === "ping") {
      log("Responding to ping")
      writeMessage(process.stdout, {
        type: "pong",
        timestamp: Date.now(),
      })
    } else if (message.type === "close") {
      log("Received close message, shutting down")
      claude.kill()
      process.exit(0)
    }
  })

  const outputBuffer = new PassThrough()
  let currentLine = ""

  claude.stdout.on("data", (chunk) => {
    const text = chunk.toString()
    currentLine += text

    const lines = currentLine.split("\n")
    currentLine = lines.pop() || ""

    for (const line of lines) {
      if (line.trim()) {
        try {
          const data = JSON.parse(line)
          log("Forwarding Claude CLI output to Chrome:", data)
          writeMessage(process.stdout, {
            type: "stdout",
            data: data,
          })
        } catch (err) {
          log("Failed to parse Claude CLI output line:", line, err)
        }
      }
    }
  })

  claude.stdout.on("end", () => {
    log("Claude CLI stdout ended")
    writeMessage(process.stdout, {
      type: "end",
    })
  })

  process.on("SIGTERM", () => {
    log("Received SIGTERM, shutting down...")
    claude.kill()
    process.exit(0)
  })

  process.on("SIGINT", () => {
    log("Received SIGINT, shutting down...")
    claude.kill()
    process.exit(0)
  })
}

main()
