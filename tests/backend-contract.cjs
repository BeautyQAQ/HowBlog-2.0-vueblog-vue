const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')

function load(relativePath, context = {}) {
  const text = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
  const script = relativePath.endsWith('.vue') ? text.match(/<script>([\s\S]*?)<\/script>/)[1] : text
  vm.runInNewContext(script.replace(/^import .*$/gm, '')
    .replace('export default', 'globalThis.result =').replace(/export function/g, 'function'), context)
  return context
}

function sessionHarness(shared, overrides = {}) {
  let saved = JSON.stringify({ id: 'legacy-user' })
  const storage = shared || {
    getItem: () => saved,
    setItem: (key, value) => { saved = value },
    removeItem: () => { saved = null }
  }
  let now = 1000
  let timer
  let storageListener
  let rotation = 0
  let refreshCalls = 0
  let logoutCalls = 0
  let queue = Promise.resolve()
  const data = () => ({ id: '42', token: `access-${rotation}`, expiresIn: 1800,
    refreshToken: String(rotation + 1).padStart(64, '0'), refreshExpiresIn: 604800 })
  const browserNavigator = overrides.navigator || { locks: {
    request(name, callback) {
      const pending = queue.then(callback)
      queue = pending.catch(() => {})
      return pending
    }
  } }
  const options = load('src/store/index.js', {
    Vue: { use() {} }, Vuex: { Store: function (value) { return value } },
    localStorage: storage, navigator: browserNavigator,
    crypto: { randomUUID: () => `session-${Math.random()}` },
    window: { addEventListener(name, callback) { storageListener = callback } },
    Date: { now: () => now },
    setTimeout(callback) { timer = callback }, clearTimeout() {},
    loginApi: async () => ({ flag: true, data: data() }),
    refreshApi: async token => {
      refreshCalls++
      if (overrides.refreshApi) return overrides.refreshApi(token)
      rotation++
      return { flag: true, data: data() }
    },
    logoutApi: async token => {
      logoutCalls++
      if (overrides.logoutApi) return overrides.logoutApi(token)
      return { flag: true }
    }
  }).result
  const subscribers = []
  const store = {
    state: options.state, getters: {},
    subscribe(callback) { subscribers.push(callback) },
    commit(name, value) {
      options.mutations[name](this.state, value)
      subscribers.forEach(callback => callback())
    },
    dispatch(name, value) {
      return options.actions[name]({ state: this.state, commit: this.commit.bind(this),
        dispatch: this.dispatch.bind(this) }, value)
    }
  }
  for (const name of Object.keys(options.getters)) {
    Object.defineProperty(store.getters, name, { get: () => options.getters[name](store.state) })
  }
  options.plugins.forEach(plugin => plugin(store))
  return { store, storage, navigator: browserNavigator,
    setNow(value) { now = value }, tick: () => timer(), sync: () => storageListener({ key: 'howblog_user' }),
    refreshCalls: () => refreshCalls, logoutCalls: () => logoutCalls }
}

async function run() {
  const harness = sessionHarness()
  const { store } = harness
  const login = () => store.dispatch('login', {})
  assert.strictEqual(store.state.user, null)
  assert.strictEqual(harness.storage.getItem(), null)
  await login()
  assert.strictEqual(store.getters.token, 'access-0')
  assert(store.getters.isLoggedIn)
  assert(JSON.parse(harness.storage.getItem()).refreshExpiresAt > 1000)
  harness.setNow(store.state.user.expiresAt - 1000)
  await Promise.all(Array.from({ length: 8 }, () => store.dispatch('ensureSession')))
  assert.strictEqual(harness.refreshCalls(), 1)
  assert.strictEqual(store.getters.token, 'access-1')
  assert.strictEqual(JSON.parse(harness.storage.getItem()).refreshToken, '2'.padStart(64, '0'))

  const otherTab = sessionHarness(harness.storage, { navigator: harness.navigator })
  const failedToken = store.getters.token
  await Promise.all([store, otherTab.store].map(tab =>
    tab.dispatch('ensureSession', { force: true, token: failedToken })))
  assert.strictEqual(harness.refreshCalls() + otherTab.refreshCalls(), 2)
  otherTab.sync()
  assert.strictEqual(otherTab.store.getters.token, store.getters.token)

  const uncertain = sessionHarness(null, { refreshApi: async () => { throw new Error('timeout') } })
  await uncertain.store.dispatch('login', {})
  await assert.rejects(uncertain.store.dispatch('ensureSession', { force: true }))
  assert.strictEqual(uncertain.store.state.user, null)
  await uncertain.store.dispatch('ensureSession')
  assert.strictEqual(uncertain.refreshCalls(), 1)
  const crashed = sessionHarness()
  await crashed.store.dispatch('login', {})
  crashed.store.commit('SET_USER', { ...crashed.store.state.user, refreshing: true })
  await assert.rejects(crashed.store.dispatch('ensureSession'))
  assert.strictEqual(crashed.refreshCalls(), 0)
  assert.strictEqual(crashed.store.state.user, null)
  const unsupported = sessionHarness(null, { navigator: {} })
  await unsupported.store.dispatch('login', {})
  await assert.rejects(unsupported.store.dispatch('ensureSession', { force: true }))
  assert.strictEqual(unsupported.refreshCalls(), 0)
  assert.strictEqual(unsupported.store.state.user, null)

  const ending = sessionHarness()
  await ending.store.dispatch('login', {})
  ending.store.commit('SET_USER', { ...ending.store.state.user, expiresAt: 2000, refreshExpiresAt: 2000 })
  assert(await ending.store.dispatch('ensureSession'))
  assert.strictEqual(ending.refreshCalls(), 0)
  ending.setNow(2000)
  await ending.store.dispatch('ensureSession')
  assert.strictEqual(ending.store.state.user, null)

  const logoutFailure = sessionHarness(null, { logoutApi: async () => { throw new Error('HTTP 500') } })
  await logoutFailure.store.dispatch('login', {})
  await assert.rejects(logoutFailure.store.dispatch('logout'))
  assert(logoutFailure.store.getters.isLoggedIn)
  await otherTab.store.dispatch('logout')
  harness.sync()
  assert.strictEqual(store.state.user, null)
  assert.strictEqual(otherTab.logoutCalls(), 1)
  await login()

  let requestHandler, responseHandler, errorHandler
  let replayCount = 0
  const service = async config => { replayCount++; return config }
  service.interceptors = {
    request: { use(handler) { requestHandler = handler } },
    response: { use(success, failure) { responseHandler = success; errorHandler = failure } }
  }
  load('src/utils/request.js', {
    axios: { create: () => service }, store, Message() {}
  })
  const activeToken = store.getters.token
  assert.strictEqual((await requestHandler({ url: '/article', headers: {} })).headers.Authorization, `Bearer ${activeToken}`)
  await assert.rejects(requestHandler({ url: '/article', sessionKey: 'previous-login', headers: {} }))
  for (const endpoint of ['login', 'refresh', 'logout']) {
    assert.strictEqual((await requestHandler({ url: `/user/${endpoint}`,
      headers: { Authorization: 'stale' } })).headers.Authorization, undefined)
  }
  const result = { flag: true, code: 20000, data: [] }
  assert.strictEqual(responseHandler({ data: result }), result)
  await assert.rejects(responseHandler({ data: { flag: false, code: 20003, message: 'Forbidden' } }),
    error => error.code === 20003)
  assert(store.getters.isLoggedIn)
  for (const status of [400, 404, 500]) {
    await assert.rejects(errorHandler({ response: { status, data: { flag: false, code: 20001, message: 'Server message' } } }),
      error => error.code === 20001 && error.message === 'Server message')
  }
  await assert.rejects(errorHandler({ response: { status: 403,
    data: { flag: false, code: 20003, message: 'Forbidden' } } }),
  error => error.code === 20003 && error.message === 'Forbidden')
  assert(store.getters.isLoggedIn)
  await assert.rejects(errorHandler({ config: { url: '/article', sessionKey: 'other-login', headers: { Authorization: 'Bearer old-token' } },
    response: { status: 401, data: { flag: false, code: 20003 } } }))
  assert(store.getters.isLoggedIn)
  const failedConfig = await requestHandler({ url: '/article', headers: {} })
  await errorHandler({ config: failedConfig, response: { status: 401, data: { flag: false, code: 20003 } } })
  assert.strictEqual(replayCount, 1)
  assert.strictEqual(failedConfig.sessionRetry, true)
  await assert.rejects(errorHandler({ config: { ...failedConfig, headers: { Authorization: `Bearer ${store.getters.token}` } },
    response: { status: 401, data: { flag: false, code: 20003 } } }))
  assert.strictEqual(store.state.user, null)
  await login()
  harness.setNow(store.state.user.refreshExpiresAt + 1)
  await store.dispatch('ensureSession')
  assert.strictEqual(store.state.user, null)
  await login()
  harness.setNow(store.state.user.expiresAt + 1)
  assert((await requestHandler({ url: '/article', headers: {} })).headers.Authorization)
  assert(store.getters.isLoggedIn)
  const now = 1000

  let refreshAttempts = 0
  const rateLimited = sessionHarness(null, {
    refreshApi: async () => {
      refreshAttempts++
      if (refreshAttempts > 1) {
        return { flag: true, data: { id: '42', token: 'access-rate-limited', expiresIn: 1800,
          refreshToken: '3'.padStart(64, '0'), refreshExpiresIn: 604800 } }
      }
      const error = new Error('Too many requests')
      error.response = { status: 429, headers: { 'retry-after': '0' } }
      throw error
    }
  })
  await rateLimited.store.dispatch('login', {})
  rateLimited.store.commit('SET_USER', { ...rateLimited.store.state.user, expiresAt: 1000 })
  assert.strictEqual(await rateLimited.store.dispatch('ensureSession'), 'access-rate-limited')
  assert.strictEqual(rateLimited.store.getters.isLoggedIn, true)

  const stillLimited = sessionHarness(null, {
    refreshApi: async () => {
      const error = new Error('Too many requests')
      error.response = { status: 503, headers: { 'retry-after': '0' } }
      throw error
    }
  })
  await stillLimited.store.dispatch('login', {})
  stillLimited.store.commit('SET_USER', { ...stillLimited.store.state.user, expiresAt: 1000 })
  await assert.rejects(stillLimited.store.dispatch('ensureSession'), error => error.response.status === 503)
  assert.strictEqual(stillLimited.store.getters.isLoggedIn, true)

  const calls = []
  const apiContext = { request: config => { calls.push(config); return Promise.resolve(config) } }
  load('src/api/article.js', apiContext)
  for (const [page, size] of [[0, 10], [1, 0], [1, 101], [1.5, 10], [2147483648, 10]]) {
    await assert.rejects(apiContext.searchArticle(page, size))
  }
  assert.strictEqual(calls.length, 0)
  await apiContext.searchArticle(1, 100)
  assert.strictEqual(calls[0].url, '/article/search/1/100')
  load('src/api/user.js', apiContext)
  await apiContext.login({ mobile: 'test', password: 'test', nickname: 'ignored' })
  assert.deepStrictEqual(Object.keys(calls[1].data), ['mobile', 'password'])
  load('src/api/comment.js', apiContext)
  await apiContext.getCommentsByArticleId('42')
  assert.strictEqual(calls[2].url, '/comment/article/42')
  await apiContext.refresh('refresh-credential')
  await apiContext.logout('refresh-credential')
  for (const [index, endpoint] of [[3, 'refresh'], [4, 'logout']]) {
    assert.strictEqual(calls[index].url, `/user/${endpoint}`)
    assert.strictEqual(calls[index].method, 'post')
    assert.deepStrictEqual(Object.keys(calls[index].data), ['refreshToken'])
    assert.strictEqual(calls[index].data.refreshToken, 'refresh-credential')
  }

  const component = name => load(`src/views/${name}.vue`, { mapGetters: () => ({}) }).result
  const detail = component('ArticleDetail')
  assert.strictEqual(detail.methods.canDeleteComment.call({ isLoggedIn: true, userId: '42', nickname: '9', isAuthor: true }, { userid: '9' }), false)
  assert.strictEqual(detail.methods.canDeleteComment.call({ isLoggedIn: true, userId: '42' }, { userid: '42' }), true)
  for (const [name, fields] of [['ArticleEdit', ['title', 'content']], ['LabelManage', ['labelname']]]) {
    const data = component(name).data.call({ $route: { params: {} } })
    for (const field of fields) assert(data.rules[field].some(rule => rule.required && rule.whitespace))
  }

  let socketUrl
  const chat = load('src/views/Chat.vue', {
    mapGetters: () => ({}),
    window: { location: { protocol: 'https:', host: 'localhost:8080' } },
    WebSocket: function (url) { socketUrl = url; this.close = () => {} },
    Date: { now: () => now },
    setTimeout() {}, clearTimeout() {}, clearInterval() {}, setInterval() {}
  }).result
  const chatState = {
    ...chat.data(), ...chat.methods,
    $store: { state: { user: { token: 'token+/=', expiresAt: now + 10000 } }, dispatch: async () => {} }
  }
  await chatState.connectWebSocket()
  assert.strictEqual(socketUrl, 'wss://localhost:8080/im?token=token%2B%2F%3D')
  chatState.handleIncomingMessage({ type: 'ready', user: '42' })
  assert.strictEqual(chat.computed.currentUsername.call(chatState), '42')
  const messages = [{ from: '42', to: '9' }, { from: '9', to: '42' }, { from: 'nickname', to: '9' }]
  assert.strictEqual(chat.computed.currentMessages.call({ currentTarget: '9', currentUsername: '42', messages }).length, 2)
  await chatState.ws.onclose({ code: 1000 })
  assert(chatState.connectionStatus.includes('其他页面'))
  let verified = false
  chatState.$store.dispatch = async (name, value) => { verified = value.force && value.token === 'token+/=' }
  await chatState.ws.onclose({ code: 1008 })
  assert(verified)
  chatState.$store.dispatch = async () => {}
  chatState.closeWebSocket()
  chatState.$store.state.user = null
  await chatState.connectWebSocket()
  assert.strictEqual(chatState.ws, null)

  const header = load('src/components/Header.vue', { mapGetters: () => ({}) }).result
  let successShown = false
  let failureShown = false
  const headerState = { ...header.data(), $store: logoutFailure.store,
    $message: { success() { successShown = true }, error() { failureShown = true } } }
  await header.methods.handleCommand.call(headerState, 'logout')
  assert(!successShown && failureShown)
  assert.strictEqual(headerState.loggingOut, false)
  console.log('PASS: revision 8 session rotation, rate-limit retry, cross-tab locking, logout, HTTP, validation and WebSocket contracts')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})