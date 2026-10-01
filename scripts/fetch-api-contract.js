#!/usr/bin/env node
// Fetch the published Web Console contract used by the deterministic E2E API.
// The bundle is not vendored (the package is UNLICENSED); it is pinned by the
// registry's sha512 integrity and the extracted file's sha256, and cached.
const { createHash } = require('crypto')
const { execFileSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const PACKAGE = '@absmartly/api-mocks'
const VERSION = '1.0.9'
const GIT_HEAD = '9fad02a96bf032ef04f56b86b1c877982652a14b'
const TARBALL = `https://registry.npmjs.org/${PACKAGE}/-/api-mocks-${VERSION}.tgz`
const INTEGRITY = 'sha512-y9U9eqDuQinssHLPGliw5WhhPeQ2OShr0Geh0eFGVUof8+D0kz6ibpXANkCaCEEogOIkQvXivRofFhdpioHziQ=='
const BUNDLE_SHA256 = 'f123f2376aaa81785f5b223a6b20bec5f3c263b9c91677637463c8e7f4dea413'

const root = path.join(__dirname, '..')
const dir = process.env.API_CONTRACT_DIR || path.join(root, 'node_modules', '.cache', 'api-contract', `api-mocks-${VERSION}`)
const bundle = path.join(dir, 'openapi.bundle.yaml')

const sha256 = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

async function main() {
  if (fs.existsSync(bundle) && sha256(bundle) === BUNDLE_SHA256) {
    console.log(`API contract ${PACKAGE}@${VERSION} cached at ${bundle}`)
    return
  }
  if (process.env.API_CONTRACT_OFFLINE === '1') {
    throw new Error(`API contract missing at ${bundle} and API_CONTRACT_OFFLINE=1`)
  }
  fs.mkdirSync(dir, { recursive: true })
  const response = await fetch(TARBALL)
  if (!response.ok) throw new Error(`Contract download failed: HTTP ${response.status}`)
  const tgz = Buffer.from(await response.arrayBuffer())
  const integrity = 'sha512-' + createHash('sha512').update(tgz).digest('base64')
  if (integrity !== INTEGRITY) throw new Error(`Contract tarball integrity mismatch: ${integrity}`)
  const archive = path.join(dir, 'package.tgz')
  fs.writeFileSync(archive, tgz)
  execFileSync('tar', ['-xzf', archive, '-C', dir, '--strip-components=2', 'package/openapi/openapi.bundle.yaml'])
  fs.rmSync(archive)
  if (sha256(bundle) !== BUNDLE_SHA256) throw new Error('Extracted contract bundle sha256 mismatch')
  fs.writeFileSync(path.join(dir, 'provenance.json'), JSON.stringify({ package: PACKAGE, version: VERSION, gitHead: GIT_HEAD, tarball: TARBALL, integrity: INTEGRITY, bundleSha256: BUNDLE_SHA256 }, null, 2))
  console.log(`API contract ${PACKAGE}@${VERSION} (${GIT_HEAD.slice(0, 8)}) verified at ${bundle}`)
}

module.exports = { bundle, PACKAGE, VERSION, GIT_HEAD, BUNDLE_SHA256 }
if (require.main === module) main().catch(error => { console.error(error.message); process.exit(1) })
