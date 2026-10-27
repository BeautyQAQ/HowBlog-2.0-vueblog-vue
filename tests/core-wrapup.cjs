const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const Vue = require('vue')
const compiler = require('vue-template-compiler')

function load(file, context = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8')
  const script = file.endsWith('.vue') ? source.match(/<script>([\s\S]*?)<\/script>/)[1] : source
  vm.runInNewContext(script.replace(/^import .*$/gm, '')
    .replace('export default', 'globalThis.result =').replace(/export function/g, 'function'), context)
  return context
}

function detailHarness(overrides = {}) {
  const calls = { status: 0, follow: 0, unfollow: 0 }
  let following = true
  const view = load('src/views/ArticleDetail.vue', {
    mapGetters: () => ({}),
    getFollowStatus: async () => { calls.status++; return { flag: true, data: { following } } },
    followUser: async () => { calls.follow++; following = true; return { flag: true } },
    unfollowUser: async () => { calls.unfollow++; following = false; return { flag: true } },
    ...overrides
  }).result
  const state = {
    ...view.data.call({ $route: { params: { id: 'article-1' } } }),
    article: { id: 'article-1', userid: 'author', state: '1' },
    userId: 'reader', isLoggedIn: true,
    $message: { success() {}, warning() {} }
  }
  for (const [name, method] of Object.entries(view.methods)) state[name] = method.bind(state)
  return { state, calls }
}

async function run() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src/views/ArticleDetail.vue'), 'utf8')
  const body = source.match(/<div class="article-body"[^>]*>[\s\S]*?<\/div>/)[0]
  const compiled = compiler.compileToFunctions(body)
  const attack = '<img src=x onerror="window.compromised=true">\n<script>alert(1)</script>'
  const component = new Vue({ data: () => ({ article: { content: attack } }), ...compiled })
  const rendered = component._render()
  assert.strictEqual(rendered.children.length, 1)
  assert.strictEqual(rendered.children[0].text, attack)
  assert.strictEqual(rendered.children[0].tag, undefined)
  assert.strictEqual(rendered.data && rendered.data.domProps && rendered.data.domProps.innerHTML, undefined)
  component.$destroy()

  const first = detailHarness()
  await first.state.fetchFollowStatus()
  assert.strictEqual(first.state.followingAuthor, true)
  await first.state.toggleFollowAuthor()
  assert.strictEqual(first.calls.unfollow, 1)
  assert.strictEqual(first.calls.follow, 0)
  assert.strictEqual(first.state.followingAuthor, false)
  await first.state.fetchFollowStatus()
  assert.strictEqual(first.state.followingAuthor, false)
  await first.state.toggleFollowAuthor()
  assert.strictEqual(first.calls.follow, 1)

  const failure = detailHarness({ getFollowStatus: async () => { throw new Error('offline') } })
  await failure.state.fetchFollowStatus()
  await failure.state.toggleFollowAuthor()
  assert.strictEqual(failure.state.followStatusLoaded, false)
  assert.strictEqual(failure.state.followLoading, false)
  assert.strictEqual(failure.calls.follow + failure.calls.unfollow, 0)

  let resolveStatus
  const stale = detailHarness({ getFollowStatus: () => new Promise(resolve => { resolveStatus = resolve }) })
  const pending = stale.state.fetchFollowStatus()
  stale.state.loadVersion++
  stale.state.followVersion++
  stale.state.userId = 'another-reader'
  resolveStatus({ flag: true, data: { following: true } })
  await pending
  assert.strictEqual(stale.state.followingAuthor, false)
  assert.strictEqual(stale.state.followStatusLoaded, false)

  const requests = []
  const api = load('src/api/user.js', { request: async request => { requests.push(request) } })
  await api.getFollowStatus('author')
  assert.strictEqual(requests[0].method, 'get')
  assert.strictEqual(requests[0].url, '/user/follow/author')

  const home = load('src/views/Home.vue', { mapGetters: () => ({}) }).result
  const serverOrder = [{ id: 'new', createtime: '2020-01-01' }, { id: 'old', createtime: '2026-01-01' }]
  const displayed = home.computed.filteredArticles.call({ articles: serverOrder })
  assert.deepStrictEqual(Array.from(displayed, article => article.id), serverOrder.map(article => article.id))
  console.log('PASS: escaped article text, restored follow state, retry/stale response handling and server pagination order')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
