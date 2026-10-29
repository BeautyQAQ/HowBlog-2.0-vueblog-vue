// Explicit integration check: HOW_NGINX_BIN=/path/to/nginx node tests/production-routing.cjs
// Starts only loopback mock services. No database, Docker, or installed global package is required.
const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const http = require('http')
const net = require('net')
const os = require('os')
const path = require('path')
const { spawn, spawnSync } = require('child_process')

const nginxBin = process.env.HOW_NGINX_BIN
if (!nginxBin || !fs.existsSync(nginxBin)) {
  console.error('Set HOW_NGINX_BIN to an existing nginx executable before running this integration check.')
  process.exit(1)
}

const repo = path.resolve(__dirname, '..')
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'howblog-routing-'))
const nginxPath = file => file.replace(/\\/g, '/')
const quote = file => `"${nginxPath(file)}"`
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
const mockServers = []
let nginxProcess
let nginxExited = false
let nginxOutput = ''

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  return server.address().port
}

async function mockService(name) {
  const upgrades = []
  const sockets = new Set()
  const server = http.createServer(async (request, response) => {
    let body = ''
    for await (const chunk of request) body += chunk
    const result = {
      upstream: name, url: request.url, method: request.method,
      authorization: request.headers.authorization,
      forwardedFor: request.headers['x-forwarded-for'], body
    }
    response.writeHead(Number(request.headers['x-mock-status']) || 200, {
      'Content-Type': 'application/json', 'X-Mock-Upstream': name
    })
    response.end(JSON.stringify(result))
  })
  server.on('connection', socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  server.on('upgrade', (request, socket) => {
    upgrades.push({ url: request.url, headers: request.headers })
    if (request.headers['x-mock-fail-upgrade']) {
      socket.destroy()
      return
    }
    const accept = crypto.createHash('sha1')
      .update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
      .digest('base64')
    socket.write('HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\nConnection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\nX-Mock-Upstream: ${name}\r\n\r\n`)
  })
  const port = await listen(server)
  mockServers.push({ server, sockets })
  return { origin: `http://127.0.0.1:${port}`, upgrades }
}

function request(port, pathname, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1', port, path: pathname,
      method: options.method || 'GET', headers: options.headers || {}
    }, response => {
      let body = ''
      response.setEncoding('utf8')
      response.on('data', chunk => { body += chunk })
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }))
    })
    request.on('error', reject)
    request.setTimeout(5000, () => request.destroy(new Error('HTTP check timed out')))
    request.end(options.body)
  })
}

function upgrade(port, token, fail = false) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1', port, path: `/im?token=${token}`,
      headers: {
        Connection: 'Upgrade', Upgrade: 'websocket',
        'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64'),
        'Sec-WebSocket-Version': '13',
        ...(fail ? { 'X-Mock-Fail-Upgrade': '1' } : {})
      }
    })
    request.on('upgrade', (response, socket) => {
      socket.destroy()
      resolve({ status: response.statusCode, headers: response.headers })
    })
    request.on('response', response => {
      response.resume()
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers }))
    })
    request.on('error', reject)
    request.setTimeout(5000, () => request.destroy(new Error('WebSocket check timed out')))
    request.end()
  })
}

async function main() {
  const base = await mockService('base')
  const article = await mockService('article')
  const user = await mockService('user')
  const reservation = net.createServer()
  const port = await listen(reservation)
  await new Promise(resolve => reservation.close(resolve))
  const staticRoot = path.join(temporaryRoot, 'html')
  fs.mkdirSync(staticRoot)
  fs.mkdirSync(path.join(staticRoot, 'js'))
  fs.mkdirSync(path.join(temporaryRoot, 'logs'))
  fs.mkdirSync(path.join(temporaryRoot, 'temp'))
  const index = '<!doctype html><title>HowBlog routing acceptance</title>'
  const asset = 'window.howblogRoutingCheck = true;'
  fs.writeFileSync(path.join(staticRoot, 'index.html'), index)
  fs.writeFileSync(path.join(staticRoot, 'js', 'app.abcd1234.js'), asset)
  fs.copyFileSync(path.join(repo, 'docker', 'proxy-common.conf'), path.join(temporaryRoot, 'proxy-common.conf'))

  let template = fs.readFileSync(path.join(repo, 'docker', 'default.conf.template'), 'utf8')
  const origins = { HOW_BASE_UPSTREAM: base.origin, HOW_ARTICLE_UPSTREAM: article.origin, HOW_USER_UPSTREAM: user.origin }
  template = template.replace(/\$\{(HOW_[A-Z_]+)\}/g, (_, key) => {
    assert(origins[key], `Unknown nginx template variable ${key}`)
    return origins[key]
  })
    .replace(/listen 8080;/, `listen 127.0.0.1:${port};`)
    .replace('root /usr/share/nginx/html;', `root ${quote(staticRoot)};`)
    .replaceAll('/etc/nginx/snippets/proxy-common.conf', quote(path.join(temporaryRoot, 'proxy-common.conf')))
    .replace('/var/log/nginx/access.log', quote(path.join(temporaryRoot, 'access.log')))
  // Preserve the production null-device behavior when running the template on Windows.
  if (process.platform === 'win32') template = template.replaceAll('error_log /dev/null;', 'error_log NUL;')
  assert(!template.includes('${HOW_'), 'All service origins must be substituted')
  const configuration = 'worker_processes 1;\ndaemon off;\n' +
    `error_log ${quote(path.join(temporaryRoot, 'error.log'))} notice;\n` +
    `pid ${quote(path.join(temporaryRoot, 'nginx.pid'))};\n` +
    'events { worker_connections 64; }\nhttp {\n' +
    'types { text/html html; application/javascript js; text/css css; }\n' + template + '\n}\n'
  const configurationPath = path.join(temporaryRoot, 'nginx.conf')
  fs.writeFileSync(configurationPath, configuration)
  const commandArguments = ['-p', nginxPath(temporaryRoot) + '/', '-c', configurationPath]
  const syntax = spawnSync(nginxBin, [...commandArguments, '-t'], { encoding: 'utf8', windowsHide: true })
  assert.strictEqual(syntax.status, 0, syntax.stderr || syntax.stdout || String(syntax.error))
  console.log('PASS: actual nginx configuration syntax')
  nginxProcess = spawn(nginxBin, commandArguments, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
  nginxProcess.on('exit', () => { nginxExited = true })
  nginxProcess.on('error', error => { nginxOutput += error.message })
  nginxProcess.stdout.on('data', chunk => { nginxOutput += chunk })
  nginxProcess.stderr.on('data', chunk => { nginxOutput += chunk })
  let ready = false
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      ready = (await request(port, '/healthz')).status === 200
      if (ready) break
    } catch (_) {}
    if (nginxExited) break
    await delay(100)
  }
  assert(ready, `nginx did not become ready: ${nginxOutput}`)
  assert.strictEqual((await request(port, '/healthz')).body, 'ok\n')
  assert.strictEqual((await request(port, '/')).body, index)
  const history = await request(port, '/article/example-id?source=reload')
  assert.strictEqual(history.status, 200)
  assert.strictEqual(history.body, index)
  assert.strictEqual(history.headers['cache-control'], 'no-store')
  assert.strictEqual((await request(port, '/js/app.abcd1234.js')).body, asset)
  assert.strictEqual((await request(port, '/js/missing.js')).status, 404)
  assert.strictEqual((await request(port, '/assets/missing.svg')).status, 404)
  console.log('PASS: health, SPA history refresh, no-store HTML, static assets and missing-asset 404')

  for (const [family, expectedService] of [['label', 'base'], ['article', 'article'], ['comment', 'article'], ['user', 'user']]) {
    for (const suffix of ['', '/item.js?term=hello%20world&page=2']) {
      const result = await request(port, `/api/${family}${suffix}`, {
        headers: { Authorization: 'Bearer routing-fixture', 'X-Forwarded-For': '198.51.100.99' }
      })
      assert.strictEqual(result.status, 200)
      const echo = JSON.parse(result.body)
      assert.strictEqual(echo.upstream, expectedService)
      assert.strictEqual(echo.url, `/${family}${suffix}`)
      assert.strictEqual(echo.authorization, 'Bearer routing-fixture')
      assert.strictEqual(echo.forwardedFor, '127.0.0.1')
    }
  }
  const body = JSON.stringify({ title: 'routing acceptance', content: 'body is preserved' })
  const posted = await request(port, '/api/article?draft=1', {
    method: 'POST', body, headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), 'X-Mock-Status': '201' }
  })
  assert.strictEqual(posted.status, 201)
  assert.strictEqual(JSON.parse(posted.body).body, body)
  assert.strictEqual(JSON.parse(posted.body).method, 'POST')
  for (const method of ['PUT', 'DELETE']) {
    const result = await request(port, '/api/comment/example', { method })
    assert.strictEqual(JSON.parse(result.body).method, method)
  }
  const forbidden = await request(port, '/api/user/profile', { headers: { 'X-Mock-Status': '403' } })
  assert.strictEqual(forbidden.status, 403)
  assert.strictEqual(JSON.parse(forbidden.body).upstream, 'user')
  for (const pathname of ['/api', '/api/missing', '/api/user2', '/api/label-extra', '/api/missing.js']) {
    const result = await request(port, pathname)
    assert.strictEqual(result.status, 404, pathname)
    assert.notStrictEqual(result.body, index, pathname)
  }
  console.log('PASS: exact API families, URI/query/header/body/method/status forwarding and unknown-API 404')

  const token = 'routing-fixture-' + crypto.randomUUID()
  const connected = await upgrade(port, token)
  assert.strictEqual(connected.status, 101)
  assert.strictEqual(connected.headers['x-mock-upstream'], 'user')
  assert.strictEqual(user.upgrades[0].url, `/im?token=${token}`)
  assert.strictEqual(user.upgrades[0].headers.upgrade.toLowerCase(), 'websocket')
  assert.strictEqual(user.upgrades[0].headers.connection.toLowerCase(), 'upgrade')
  const failedToken = token + '-upstream-failure'
  const failure = await upgrade(port, failedToken, true)
  assert.strictEqual(failure.status, 502)
  assert.strictEqual(user.upgrades[1].url, `/im?token=${failedToken}`)
  await delay(200)
  const accessLog = fs.readFileSync(path.join(temporaryRoot, 'access.log'), 'utf8')
  assert(accessLog.includes('GET /im HTTP/1.1'), 'WebSocket requests should still have a query-free access record')
  const errorLog = fs.readFileSync(path.join(temporaryRoot, 'error.log'), 'utf8')
  assert(!accessLog.includes(token), 'Access log exposed a WebSocket credential')
  assert(!errorLog.includes(token), 'Error log exposed a WebSocket credential')
  console.log('PASS: WebSocket upgrade, upstream failure and query-token exclusion from access/error logs')
}

main().catch(error => {
  console.error(error.stack || error.message)
  console.error(`Integration artifacts: ${temporaryRoot}`)
  process.exitCode = 1
}).finally(async () => {
  if (nginxProcess && !nginxExited) {
    spawnSync(nginxBin, ['-p', nginxPath(temporaryRoot) + '/', '-c', path.join(temporaryRoot, 'nginx.conf'), '-s', 'quit'], { windowsHide: true })
    for (let attempt = 0; attempt < 30 && !nginxExited; attempt++) await delay(100)
    if (!nginxExited) {
      if (process.platform === 'win32') {
        spawnSync('taskkill', ['/PID', String(nginxProcess.pid), '/T', '/F'], { windowsHide: true })
      } else nginxProcess.kill('SIGTERM')
    }
  }
  for (const { server, sockets } of mockServers) {
    for (const socket of sockets) socket.destroy()
    await new Promise(resolve => server.close(resolve))
  }
})
