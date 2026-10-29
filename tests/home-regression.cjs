const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const Vue = require('vue')
const compiler = require('vue-template-compiler')

const source = fs.readFileSync(path.join(__dirname, '..', 'src/views/Home.vue'), 'utf8')
const component = compiler.parseComponent(source)
const template = compiler.compileToFunctions(component.template.content)

function harness({ query = {}, userId = '', loggedIn = !!userId } = {}) {
  const session = Vue.observable({ userId, isLoggedIn: loggedIn })
  const route = Vue.observable({ query })
  const requests = []
  const errors = []
  const request = (type, page, size, conditions) => new Promise((resolve, reject) => {
    requests.push({ type, page, size, conditions, resolve, reject })
  })
  const context = {
    mapGetters: names => Object.fromEntries(names.map(name => [name, () => session[name]])),
    searchArticle: (page, size, conditions) => request('search', page, size, conditions),
    getArticleList: () => request('all'),
    getLabelList: async () => ({ flag: true, data: [] }),
    console: { error: (...args) => errors.push(args) }
  }
  vm.runInNewContext(component.script.content.replace(/^import .*$/gm, '')
    .replace('export default', 'globalThis.options ='), context)
  const view = new Vue({
    ...context.options,
    ...template,
    beforeCreate() {
      this.$route = route
    }
  })
  return { view, session, route, requests, errors }
}

async function flush() {
  await Promise.resolve()
  await Vue.nextTick()
  await Promise.resolve()
}

async function respond(request, rows, total = rows.length) {
  request.resolve({ flag: true, data: request.type === 'all' ? rows : { rows, total } })
  await flush()
}

function article(id, fields = {}) {
  return { id: String(id), title: `Article ${id}`, content: 'Searchable body', state: '1', ...fields }
}

function ids(rows) {
  return Array.from(rows, row => row.id)
}

function findNode(node, predicate) {
  if (predicate(node)) return node
  for (const child of node.children || []) {
    const found = findNode(child, predicate)
    if (found) return found
  }
}

function pagination(view) {
  return findNode(view._render(), node => node.tag === 'el-pagination')
}

async function serverPagination() {
  for (const filter of ['public', 'label', 'mine']) {
    const h = harness(filter === 'mine' ? { query: { mine: '1' }, userId: 'author-a' } : {})
    if (filter === 'label') h.view.selectLabel('java')
    const firstPage = Array.from({ length: 10 }, (_, i) => article(i, { labelIds: ['java'] }))
    await respond(h.requests[h.requests.length - 1], firstPage, 25)
    const pager = pagination(h.view)
    assert(pager, `${filter}: server total must show pagination when this page has only 10 rows`)
    assert.strictEqual(pager.data.attrs.total, 25)
    assert.strictEqual(pager.data.attrs['current-page'], 1)
    assert.deepStrictEqual(ids(h.view.paginatedArticles), ids(firstPage))

    pager.data.on['current-change'](2)
    const next = h.requests[h.requests.length - 1]
    assert.strictEqual(next.page, 2)
    assert.strictEqual(next.size, 10)
    assert.strictEqual(next.conditions.userid, filter === 'mine' ? 'author-a' : undefined)
    assert.strictEqual(next.conditions.labelIds && next.conditions.labelIds[0], filter === 'label' ? 'java' : undefined)
    await respond(next, [article('second-page', { labelIds: ['java'] })], 25)
    assert.deepStrictEqual(ids(h.view.paginatedArticles), ['second-page'])
    assert.strictEqual(pagination(h.view).data.attrs['current-page'], 2)
    if (filter === 'label') {
      await respond(h.requests[0], firstPage, 25)
      assert.deepStrictEqual(ids(h.view.articles), ['second-page'], 'the request before selecting a label is stale')
    }
    h.view.$destroy()
  }

  const single = harness()
  await respond(single.requests[0], [article('only')], 1)
  assert.strictEqual(pagination(single.view), undefined, 'a single page does not need controls')
  single.view.$destroy()
}

async function searchPagination() {
  const h = harness({ query: { search: 'needle' } })
  const rows = Array.from({ length: 23 }, (_, i) => article(i, { content: 'needle' }))
  await respond(h.requests[0], [...rows, article('unmatched', { content: 'different text' })])
  assert.strictEqual(h.requests[0].type, 'all')
  assert.strictEqual(pagination(h.view).data.attrs.total, 23)
  pagination(h.view).data.on['current-change'](2)
  assert.strictEqual(h.requests.length, 1, 'keyword pagination slices the loaded results locally')
  assert.deepStrictEqual(ids(h.view.paginatedArticles), ids(rows.slice(10, 20)))
  h.view.$destroy()
}

async function identityChanges() {
  const h = harness({ query: { mine: '1' }, userId: 'author-a' })
  await respond(h.requests[0], [article('a-private-draft', { userid: 'author-a', ispublic: '0', state: '0' })], 21)
  h.view.currentPage = 3
  h.session.userId = ''
  h.session.isLoggedIn = false
  assert.deepStrictEqual(ids(h.view.filteredArticles), [], 'cached private rows disappear as soon as identity changes')
  assert.strictEqual(h.view.displayTotal, 0)
  await flush()
  assert.strictEqual(h.view.currentPage, 1)
  assert.strictEqual(h.view.articles.length, 0)
  assert.strictEqual(h.view.total, 0)
  assert.strictEqual(h.requests[1].conditions.userid, undefined)
  assert.strictEqual(h.view.loading, true)
  await respond(h.requests[1], [article('public')])
  assert.deepStrictEqual(ids(h.view.filteredArticles), ['public'])

  h.session.userId = 'author-b'
  h.session.isLoggedIn = true
  await flush()
  assert.strictEqual(h.requests[2].conditions.userid, 'author-b')
  await respond(h.requests[2], [article('b-draft', { userid: 'author-b', state: '0' })])
  h.session.userId = 'author-c'
  assert.deepStrictEqual(ids(h.view.filteredArticles), [])
  await flush()
  assert.strictEqual(h.requests[3].conditions.userid, 'author-c')
  h.requests[3].reject(new Error('offline'))
  await flush()
  assert.deepStrictEqual(ids(h.view.filteredArticles), [], 'failed reload cannot restore the preceding user cache')
  assert.strictEqual(h.view.loading, false)
  h.view.$destroy()
}

async function staleResponses() {
  const h = harness({ query: { mine: '1' }, userId: 'author-a' })
  h.session.userId = 'author-b'
  await flush()
  await respond(h.requests[0], [article('late-a-private', { ispublic: '0' })], 20)
  assert.strictEqual(h.view.articles.length, 0)
  assert.strictEqual(h.view.loading, true, 'stale response must not end the current loading state')
  await respond(h.requests[1], [article('b-current')])
  assert.deepStrictEqual(ids(h.view.articles), ['b-current'])

  h.view.handlePageChange(2)
  h.view.handlePageChange(3)
  await respond(h.requests[3], [article('page-three')], 25)
  await respond(h.requests[2], [article('late-page-two')], 25)
  assert.deepStrictEqual(ids(h.view.articles), ['page-three'], 'older page response must not replace the latest page')
  h.view.$destroy()

  const search = harness({ query: { mine: '1', search: 'needle' }, userId: 'author-a' })
  assert.strictEqual(search.requests[0].conditions.userid, 'author-a')
  search.session.userId = ''
  search.session.isLoggedIn = false
  await flush()
  assert.strictEqual(search.requests[1].type, 'all')
  await respond(search.requests[1], [article('public-needle', { content: 'needle' })])
  await respond(search.requests[0], [article('late-private-needle', { content: 'needle' })])
  assert.deepStrictEqual(ids(search.view.filteredArticles), ['public-needle'])
  search.view.$destroy()

  const destroyed = harness()
  destroyed.view.$destroy()
  await respond(destroyed.requests[0], [article('after-destroy')])
  assert.strictEqual(destroyed.view.articles.length, 0, 'unmounted views must ignore unfinished article requests')
}

async function run() {
  await serverPagination()
  await searchPagination()
  await identityChanges()
  await staleResponses()
  console.log('PASS: Home template pagination, logout/user switches, failed reloads, stale responses and teardown')
}

run().catch(error => { console.error(error); process.exitCode = 1 })
