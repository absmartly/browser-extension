import { execSync } from 'child_process'
import path from 'path'
import fs from 'fs'

// This file ensures the extension is built before tests run

const buildDir = path.join(__dirname, '..', '..', 'build', 'chrome-mv3-dev')
const manifestPath = path.join(buildDir, 'manifest.json')

// Check if build exists and is recent
function shouldBuild(): boolean {
  if (!fs.existsSync(manifestPath)) {
    console.log('Extension not built, building...')
    return true
  }

  // Check if source files are newer than build
  const manifestStat = fs.statSync(manifestPath)
  const srcFiles = [
    path.join(__dirname, '..', '..', 'src'),
    path.join(__dirname, '..', '..', 'package.json'),
    path.join(__dirname, '..', '..', 'index.tsx'),
    path.join(__dirname, '..', '..', 'background.ts'),
    path.join(__dirname, '..', '..', 'content.tsx')
  ]

  for (const srcPath of srcFiles) {
    if (fs.existsSync(srcPath)) {
      const srcStat = fs.statSync(srcPath)
      if (srcStat.mtime > manifestStat.mtime) {
        console.log(`Source file ${srcPath} is newer than build, rebuilding...`)
        return true
      }
    }
  }

  return false
}

export function ensureExtensionBuilt() {
  if (shouldBuild()) {
    console.log('Building extension...')
    try {
      execSync('npm run build', {
        cwd: path.join(__dirname, '..', '..'),
        stdio: 'inherit'
      })
      console.log('Extension built successfully')
    } catch (error) {
      console.error('Failed to build extension:', error)
      throw new Error('Extension build failed. Please run "npm run build" manually.')
    }
  } else {
    console.log('Extension is up to date')
  }
}

// Run this when the module is imported
if (process.env.SKIP_BUILD !== 'true') {
  ensureExtensionBuilt()
}