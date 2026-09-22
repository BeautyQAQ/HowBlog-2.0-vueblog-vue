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

async function run() {
  let saved = JSON.stringify({ id: 'legacy-user' })
  let now = 1000
  let expiryCallback
  const context = load('src/store/index.js', {
    Vue: { use() {} },
    Vuex: { Store: function (options) { return options } },
    localStorage: {
      getItem: () => saved,
      setItem: (key, value) => { saved = value },
      removeItem: () => { saved = null }
    },
    Date: { now: () => now },
    setTimeout: callback => { expiryCallback = callback },
    clearTimeout() {},
    loginApi: async () => ({ flag: true, data: { id: '42', token: 'test-token', expiresIn: 1800 } })
  })
  const options = context.result
  const store = {
    state: options.state,
    getters: {},
    subscribe() {},
    commit(name, value) { options.mutations[name](this.state, value) }
  }
  for (const name of Object.keys(options.getters)) {
    Object.defineProperty(store.getters, name, { get: () => options.getters[name](store.state) })
  }
  const login = () => options.actions.login({ commit: store.commit.bind(store) }, {})
  assert.strictEqual(store.state.user, null)
  assert.strictEqual(saved, null)
  await login()
  assert.strictEqual(store.getters.token, 'test-token')
  assert(store.getters.isLoggedIn)
  assert(JSON.parse(saved).expiresAt > now)

  let requestHandler, responseHandler, errorHandler
  const service = { interceptors: {
    request: { use(handler) { requestHandler = handler } },
    response: { use(success, failure) { responseHandler = success; errorHandler = failure } }
  } }
  load('src/utils/request.js', {
    axios: { create: () => service }, store, Message() {}, Date: { now: () => now }
  })
  assert.strictEqual(requestHandler({ url: '/article', headers: {} }).headers.Authorization, 'Bearer test-token')
  assert.strictEqual(requestHandler({ url: '/user/login', headers: {} }).headers.Authorization, undefined)
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
  await assert.rejects(errorHandler({ config: { headers: { Authorization: 'Bearer old-token' } },
    response: { status: 401, data: { flag: false, code: 20003 } } }))
  assert(store.getters.isLoggedIn)
  await assert.rejects(errorHandler({ config: { headers: { Authorization: 'Bearer test-token' } },
    response: { status: 401, data: { flag: false, code: 20003 } } }))
  assert.strictEqual(store.state.user, null)
  await login()
  options.plugins[0](store)
  now = store.state.user.expiresAt + 1
  expiryCallback()
  assert.strictEqual(store.state.user, null)
  await login()
  now = store.state.user.expiresAt + 1
  assert.strictEqual(requestHandler({ url: '/article', headers: {} }).headers.Authorization, undefined)
  assert.strictEqual(store.state.user, null)

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
    WebSocket: function (url) { socketUrl = url },
    Date: { now: () => now },
    setTimeout() {}, clearTimeout() {}, clearInterval() {}, setInterval() {}
  }).result
  const chatState = {
    ...chat.data(), ...chat.methods,
    $store: { state: { user: { token: 'token+/=', expiresAt: now + 10000 } } }
  }
  chatState.connectWebSocket()
  assert.strictEqual(socketUrl, 'wss://localhost:8080/im?token=token%2B%2F%3D')
  chatState.handleIncomingMessage({ type: 'ready', user: '42' })
  assert.strictEqual(chat.computed.currentUsername.call(chatState), '42')
  const messages = [{ from: '42', to: '9' }, { from: '9', to: '42' }, { from: 'nickname', to: '9' }]
  assert.strictEqual(chat.computed.currentMessages.call({ currentTarget: '9', currentUsername: '42', messages }).length, 2)
  chatState.closeWebSocket = () => {}
  chatState.$store.state.user = null
  let loggedOut = false
  chatState.$store.commit = () => { loggedOut = true }
  chatState.connectWebSocket()
  assert(loggedOut)
  console.log('PASS: revision 6 authentication, HTTP errors, pagination, validation, permissions and WebSocket contracts')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})