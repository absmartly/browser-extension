#!/usr/bin/env node

const fs = require("fs")
const path = require("path")
const os = require("os")

const HOST_NAME = "com.absmartly.claude_native_host"
const MANIFEST_TEMPLATE = path.join(__dirname, "manifest.json.template")
const HOST_SCRIPT = path.join(__dirname, "host.js")

function getManifestDir() {
  const platform = os.platform()
  const homeDir = os.homedir()

  switch (platform) {
    case "darwin":
      return path.join(homeDir, "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts")
    case "linux":
      return path.join(homeDir, ".config", "google-chrome", "NativeMessagingHosts")
    case "win32":
      return null
    default:
      throw new Error(`Unsupported platform: ${platform}`)
  }
}

function getManifestPath() {
  if (os.platform() === "win32") {
    return null
  }
  return path.join(getManifestDir(), `${HOST_NAME}.json`)
}

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    console.log(`Created directory: ${dir}`)
  }
}

function makeExecutable(filePath) {
  if (os.platform() !== "win32") {
    fs.chmodSync(filePath, "755")
    console.log(`Made executable: ${filePath}`)
  }
}

function createManifest(extensionId) {
  const templateContent = fs.readFileSync(MANIFEST_TEMPLATE, "utf-8")
  const manifestContent = templateContent
    .replace("{{HOST_PATH}}", HOST_SCRIPT)
    .replace("{{EXTENSION_ID}}", extensionId)

  return JSON.parse(manifestContent)
}

function install(extensionId) {
  console.log("Installing native messaging host...")
  console.log(`Extension ID: ${extensionId}`)

  if (os.platform() === "win32") {
    console.error("Windows installation requires manual registry setup.")
    console.error("Please refer to the documentation: native-host/README.md")
    process.exit(1)
  }

  const manifestDir = getManifestDir()
  const manifestPath = getManifestPath()

  ensureDirectoryExists(manifestDir)
  makeExecutable(HOST_SCRIPT)

  const manifest = createManifest(extensionId)
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

  console.log(`Manifest written to: ${manifestPath}`)
  console.log("Native host installed successfully!")
  console.log("\nNext steps:")
  console.log("1. Reload your Chrome extension")
  console.log("2. The extension will now use native messaging to communicate with Claude CLI")
  console.log("\nTo debug: DEBUG_NATIVE_HOST=1 in your environment")
}

function uninstall() {
  console.log("Uninstalling native messaging host...")

  if (os.platform() === "win32") {
    console.error("Windows uninstallation requires manual registry cleanup.")
    console.error("Please refer to the documentation: native-host/README.md")
    process.exit(1)
  }

  const manifestPath = getManifestPath()

  if (fs.existsSync(manifestPath)) {
    fs.unlinkSync(manifestPath)
    console.log(`Removed manifest: ${manifestPath}`)
  } else {
    console.log("Native host was not installed.")
  }

  console.log("Uninstall complete!")
}

function main() {
  const args = process.argv.slice(2)

  if (args.includes("--uninstall")) {
    uninstall()
    return
  }

  const extensionId = args[0] || process.env.EXTENSION_ID

  if (!extensionId) {
    console.error("Error: Extension ID is required")
    console.error("\nUsage:")
    console.error("  node install.js <extension-id>")
    console.error("  node install.js --uninstall")
    console.error("\nOr set EXTENSION_ID environment variable:")
    console.error("  EXTENSION_ID=your-extension-id node install.js")
    process.exit(1)
  }

  install(extensionId)
}

main()
