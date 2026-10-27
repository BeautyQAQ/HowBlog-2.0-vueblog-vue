const assert = require('assert')
const fs = require('fs')
const path = require('path')
const vm = require('vm')
const Schema = require('async-validator')

function validate(schema, values) {
  return new Promise((resolve, reject) => {
    schema.validate(values, errors => errors ? reject(new Error(errors[0].message)) : resolve())
  })
}

function load(relativePath, values = {}) {
  const context = { Error, TextEncoder, ...values }
  const text = fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8')
  const script = relativePath.endsWith('.vue') ? text.match(/<script>([\s\S]*?)<\/script>/)[1] : text
  vm.runInNewContext(script.replace(/^import .*$/gm, '')
    .replace('export default', 'globalThis.result =').replace(/export function/g, 'function'), context)
  return context
}

const { validateNewPassword } = load('src/utils/password.js')
const copy = value => JSON.parse(JSON.stringify(value))
const httpError = status => Object.assign(new Error('请求格式或参数不正确'), {
  response: { status, data: { flag: false, code: 20001, message: '请求格式或参数不正确' } }
})

function detailHarness(overrides = {}) {
  const server = {
    article: { id: 'article-1', userid: '42', state: '1', comment: 3, visits: 5 },
    comments: [
      { _id: 'root', userid: '42', content: 'Root' },
      { _id: 'child', userid: '9', parentid: 'root', content: 'Reply' },
      { _id: 'sibling', userid: '9', content: 'Keep this branch' }
    ]
  }
  const calls = { article: 0, comments: 0, save: [], delete: [], likes: 0 }
  const api = {
    getArticleById: async () => {
      calls.article++
      return { flag: true, data: copy(server.article) }
    },
    getCommentsByArticleId: async () => {
      calls.comments++
      return { flag: true, data: copy(server.comments) }
    },
    getLabelList: async () => ({ flag: true, data: [{ id: 'label-1', labelname: 'Java' }] }),
    saveComment: async payload => {
      calls.save.push(copy(payload))
      server.comments.push({ ...copy(payload), _id: 'new-comment', userid: '42' })
      server.article.comment++
      return { flag: true }
    },
    deleteComment: async id => {
      calls.delete.push(id)
      // 模拟服务端已提交的整条分支删除结果。
      server.comments = [server.comments.find(comment => comment._id === 'sibling')]
      server.article.comment = 1
      return { flag: true }
    },
    thumbupComment: async () => { calls.likes++; return { flag: true } },
    thumbupArticle: async () => { calls.likes++; return { flag: true } },
    publishArticle: async () => { server.article.state = '1'; return { flag: true } },
    unpublishArticle: async () => { server.article.state = '0'; return { flag: true } },
    submitArticle: async () => { server.article.state = '2'; return { flag: true } },
    mapGetters: () => ({}),
    ...overrides
  }
  const view = load('src/views/ArticleDetail.vue', api).result
  const messages = []
  const confirmations = []
  const state = {
    ...view.data.call({ $route: { params: { id: 'article-1' } } }),
    isLoggedIn: true,
    userId: '42',
    nickname: 'Alice',
    $message: Object.fromEntries(['success', 'warning', 'error'].map(type =>
      [type, message => messages.push({ type, message })])),
    $confirm: async message => { confirmations.push(message) },
    $nextTick: callback => callback(),
    $refs: { commentInput: { focus() {} } }
  }
  for (const [name, method] of Object.entries(view.methods)) state[name] = method.bind(state)
  for (const [name, getter] of Object.entries(view.computed)) {
    Object.defineProperty(state, name, { get: () => getter.call(state) })
  }
  return { state, server, calls, view, messages, confirmations }
}

async function run() {
  const register = load('src/views/Register.vue', { validateNewPassword }).result
  const profile = load('src/views/Profile.vue', { validateNewPassword }).result
  const registration = register.data.call({ form: {} })
  const profileData = profile.data.call({ $route: { query: {} }, passwordForm: {} })
  const valid = ['abcdefgh', 'a'.repeat(64), '中'.repeat(24), '中'.repeat(23) + 'abc',
    '😀'.repeat(18), '😀'.repeat(4), 'ä'.repeat(36), '  secret  ']
  const invalid = ['', 'a'.repeat(7), 'a'.repeat(65), ' '.repeat(8), '中'.repeat(25),
    '中'.repeat(24) + 'a', '😀'.repeat(19)]
  for (const rules of [registration.rules.password, profileData.passwordRules.newPassword]) {
    const schema = new Schema({ password: rules })
    for (const password of valid) await validate(schema, { password })
    for (const password of invalid) await assert.rejects(validate(schema, { password }))
  }
  const legacyPassword = '中'.repeat(40) + ' trailing suffix '
  const login = load('src/views/Login.vue').result
  await validate(new Schema({ password: login.data().rules.password }), { password: legacyPassword })
  await validate(new Schema({ oldPassword: profileData.passwordRules.oldPassword }), { oldPassword: legacyPassword })
  const requests = []
  const userApi = load('src/api/user.js', { request: async config => { requests.push(config) } })
  await userApi.login({ mobile: '13800000000', password: legacyPassword })
  await userApi.changePassword({ oldPassword: legacyPassword, newPassword: '  secret  ' })
  await userApi.register({ mobile: '13800000000', password: '  secret  ' })
  assert.strictEqual(requests[0].data.password, legacyPassword)
  assert.strictEqual(requests[1].data.oldPassword, legacyPassword)
  assert.strictEqual(requests[1].data.newPassword, '  secret  ')
  assert.strictEqual(requests[2].data.password, '  secret  ')

  let handleError, shownMessage
  const service = { interceptors: {
    request: { use() {} },
    response: { use(success, failure) { handleError = failure } }
  } }
  load('src/utils/request.js', {
    axios: { create: () => service }, store: {}, Message: value => { shownMessage = value.message }
  })
  const commentApi = load('src/api/comment.js', { request: async config => config })
  const commentConfig = await commentApi.saveComment({ articleid: 'article-1', content: 'Reply', parentid: 'root' })
  for (const [status, expected] of [[400, '回复对象'], [404, '尚未发布']]) {
    const error = Object.assign(httpError(status), { config: commentConfig })
    await assert.rejects(handleError(error), result => result.code === 20001 && result.message.includes(expected))
    assert(shownMessage.includes(expected))
  }

  const deletion = detailHarness()
  await deletion.state.fetchData()
  deletion.state.replyTo = deletion.state.comments[1]
  await deletion.state.handleDeleteComment('root')
  assert(deletion.confirmations[0].includes('全部后代回复'))
  assert(deletion.confirmations[0].includes('其他用户'))
  assert.deepStrictEqual(deletion.calls.delete, ['root'])
  assert.deepStrictEqual(deletion.state.comments.map(comment => comment._id), ['sibling'])
  assert.strictEqual(deletion.state.article.comment, 1)
  assert.strictEqual(deletion.state.replyTo, null)
  assert.strictEqual(deletion.calls.article, 2)
  assert.strictEqual(deletion.calls.comments, 2)
  deletion.state.$confirm = async () => { throw new Error('cancel') }
  await deletion.state.handleDeleteComment('sibling')
  assert.strictEqual(deletion.calls.delete.length, 1)

  const reply = detailHarness()
  await reply.state.fetchData()
  reply.state.replyToComment(reply.state.comments[0])
  reply.state.newCommentContent = '  A reply  '
  await reply.state.submitComment()
  assert.deepStrictEqual(reply.calls.save[0], { articleid: 'article-1', content: 'A reply', parentid: 'root' })
  assert.strictEqual(reply.state.article.comment, 4)
  assert.strictEqual(reply.state.comments.length, 4)
  assert.strictEqual(reply.state.replyTo, null)
  assert.strictEqual(reply.state.newCommentContent, '')
  reply.state.newCommentContent = 'A root comment'
  await reply.state.submitComment()
  assert.strictEqual(reply.calls.save[1].parentid, undefined)
  assert.strictEqual(reply.state.article.comment, 5)

  for (const state of ['0', '2']) {
    const unpublished = detailHarness()
    unpublished.server.article.state = state
    await unpublished.state.fetchData()
    unpublished.state.newCommentContent = 'Should not submit'
    assert.strictEqual(unpublished.state.canInteract, false)
    await unpublished.state.submitComment()
    await unpublished.state.handleThumbup(unpublished.state.comments[0])
    await unpublished.state.handleArticleThumbup()
    assert.strictEqual(unpublished.calls.save.length, 0)
    assert.strictEqual(unpublished.calls.likes, 0)
    assert.strictEqual(unpublished.state.canDeleteComment({ userid: '42' }), true)
    assert.strictEqual(unpublished.state.canDeleteComment({ userid: '9' }), false)
  }

  const readFailure = detailHarness({ getCommentsByArticleId: async () => { throw httpError(404) } })
  await readFailure.state.fetchData()
  assert.strictEqual(readFailure.state.article.id, 'article-1')
  assert(readFailure.state.commentsError.includes('暂无访问权限'))
  assert.strictEqual(readFailure.state.canInteract, false)
  const transientFailure = detailHarness({ getCommentsByArticleId: async () => { throw httpError(500) } })
  await transientFailure.state.fetchData()
  assert.strictEqual(transientFailure.state.article.id, 'article-1')
  assert(transientFailure.state.commentsError.includes('加载失败'))
  const labelFailure = detailHarness({ getLabelList: async () => { throw httpError(503) } })
  await labelFailure.state.fetchData()
  assert.strictEqual(labelFailure.state.article.id, 'article-1')
  assert.strictEqual(labelFailure.state.comments.length, 3)

  const missing = detailHarness({ getArticleById: async () => { throw httpError(404) } })
  missing.state.comments = [{ _id: 'stale-private-comment' }]
  await missing.state.fetchData()
  assert.strictEqual(missing.state.article, null)
  assert.strictEqual(missing.state.comments.length, 0)
  assert.strictEqual(missing.calls.comments, 0)
  assert(missing.state.articleError.includes('暂无访问权限'))

  const invalidParent = detailHarness({ saveComment: async () => { throw httpError(400) } })
  await invalidParent.state.fetchData()
  invalidParent.state.replyTo = invalidParent.state.comments[0]
  invalidParent.state.newCommentContent = 'Keep this text'
  invalidParent.server.comments = []
  await invalidParent.state.submitComment()
  assert.strictEqual(invalidParent.state.replyTo, null)
  assert.strictEqual(invalidParent.state.newCommentContent, 'Keep this text')
  assert.strictEqual(invalidParent.calls.comments, 2)
  assert.strictEqual(invalidParent.calls.article, 1)

  const withdrawn = detailHarness({ saveComment: async () => { throw httpError(404) } })
  await withdrawn.state.fetchData()
  withdrawn.server.article.state = '0'
  withdrawn.state.newCommentContent = 'Keep after withdrawal'
  await withdrawn.state.submitComment()
  assert.strictEqual(withdrawn.state.articleState, '0')
  assert.strictEqual(withdrawn.state.canInteract, false)
  assert.strictEqual(withdrawn.state.newCommentContent, 'Keep after withdrawal')
  assert.strictEqual(withdrawn.calls.article, 2)

  const lifecycle = detailHarness()
  await lifecycle.state.fetchData()
  await lifecycle.state.transitionArticle('unpublish')
  assert.strictEqual(lifecycle.state.articleState, '0')
  assert.strictEqual(lifecycle.state.canInteract, false)
  await lifecycle.state.transitionArticle('publish')
  assert.strictEqual(lifecycle.state.canInteract, true)

  let finishOldRead
  const stale = detailHarness({ getCommentsByArticleId: () => new Promise(resolve => { finishOldRead = resolve }) })
  const pending = stale.state.fetchComments()
  stale.view.beforeDestroy.call(stale.state)
  finishOldRead({ flag: true, data: [{ _id: 'old-private-comment' }] })
  await pending
  assert.strictEqual(stale.state.comments.length, 0)

  const projectRoot = path.join(__dirname, '..')
  const sync = JSON.parse(fs.readFileSync(path.join(projectRoot, 'backend-api-sync.json'), 'utf8'))
  const status = JSON.parse(fs.readFileSync(path.join(projectRoot, sync.publishedStatus), 'utf8'))
  assert.strictEqual(sync.backendApiRevision, status.revision)
  assert.strictEqual(sync.contractVersion, status.contractVersion)
  assert.strictEqual(sync.latestChangeId, status.latestChangeId)
  assert.strictEqual(sync.publishedContract, status.contractFile)
  assert.strictEqual(sync.publishedChangelog, status.changelogFile)
  const contract = fs.readFileSync(path.join(projectRoot, sync.publishedContract), 'utf8')
  const changelog = fs.readFileSync(path.join(projectRoot, sync.publishedChangelog), 'utf8')
  assert(contract.includes('`' + sync.contractVersion + '`'))
  assert(contract.includes('`' + sync.backendApiRevision + '`'))
  assert(changelog.includes(`## Revision ${sync.backendApiRevision} - ${sync.latestChangeId}`))

  console.log('PASS: revision 22 UTF-8/UTF-16 password boundaries, legacy credentials, comment replies, visibility, branch deletion, statistics and error recovery')
}

run().catch(error => {
  console.error(error)
  process.exitCode = 1
})
