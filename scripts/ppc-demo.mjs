#!/usr/bin/env node
/**
 * One command for the video demo: `pnpm build` → `vite preview` :3000 → `cdn-simulator` :8080
 * Stops both servers on SIGINT / SIGTERM.
 */
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import http from 'node:http'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * Wait until the preview server accepts HTTP on this port.
 * We probe with real HTTP requests to both 127.0.0.1 and ::1. Raw TCP to 127.0.0.1
 * can fail (ECONNREFUSED) when the app only binds IPv6, while Vite still prints
 * "Local: http://localhost:3000/".
 *
 * @param {number} port
 * @param {number} timeoutMs
 */
function httpProbe(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume()
      res.on('end', () => resolve(true))
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

function waitForPortOpen(port, timeoutMs = 60_000) {
  const urls = [
    `http://127.0.0.1:${port}/`,
    `http://[::1]:${port}/`,
  ]
  return new Promise((resolve, reject) => {
    const start = Date.now()

    const tryRound = () => {
      if (Date.now() - start > timeoutMs) {
        reject(
          new Error(
            `Port ${port} did not become reachable via HTTP within ${timeoutMs}ms (tried ${urls.join(' and ')})`,
          ),
        )
        return
      }

      Promise.all(urls.map((u) => httpProbe(u))).then((ok) => {
        if (ok.some(Boolean)) {
          resolve()
        } else {
          setTimeout(tryRound, 200)
        }
      })
    }

    tryRound()
  })
}

console.log('→ pnpm build\n')
execFileSync('pnpm', ['build'], { cwd: root, stdio: 'inherit' })

const preview = spawn('pnpm', ['run', 'preview'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, FORCE_COLOR: '1' },
})
/** @type {import('node:child_process').ChildProcess[]} */
const children = [preview]
let stopping = false

const shutdown = (reason, exitCode = 0) => {
  if (stopping) return
  stopping = true
  console.log(`\n→ stopping${reason ? ` (${reason})` : ''}…`)
  for (const c of children) {
    if (c.exitCode == null) c.kill('SIGTERM')
  }
  setTimeout(() => process.exit(exitCode), 500)
}
process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))

preview.on('error', (err) => {
  console.error('preview failed to start', err)
  shutdown('preview error', 1)
})

void (async () => {
  try {
    await waitForPortOpen(3000)
  } catch (e) {
    console.error(e)
    preview.kill('SIGTERM')
    process.exit(1)
  }

  const proxy = spawn('node', ['cdn-simulator.mjs'], {
    cwd: root,
    stdio: 'inherit',
  })
  children.push(proxy)

  proxy.on('error', (err) => {
    console.error('proxy failed to start', err)
    shutdown('proxy error', 1)
  })

  const onOneExit = (name, code, signal) => {
    if (stopping) return
    if (signal) {
      if (code && code !== 0) {
        console.error(`${name} ${signal} (code ${code})`)
      }
    } else if (code !== 0) {
      console.error(`${name} exited with code ${code}`)
    }
    const exitCode = typeof code === 'number' ? code : 0
    shutdown(`${name} stopped`, exitCode)
  }
  preview.on('exit', (code, signal) => onOneExit('preview', code, signal))
  proxy.on('exit', (code, signal) => onOneExit('proxy', code, signal))

  console.log(
    '\n→ App   http://localhost:8080/  (PPC home, proxy → :3000 preview)\n' +
      '→ Cache http://localhost:8080/__cache/view\n' +
      '→ Ctrl+C to stop\n',
  )
})()
