import Vue from 'vue'
import Vuex from 'vuex'
import { login as loginApi, refresh as refreshApi, logout as logoutApi } from '@/api/user'

Vue.use(Vuex)

const storageKey = 'howblog_user'
let refreshPromise = null

function readUser() {
  try {
    const user = JSON.parse(localStorage.getItem(storageKey))
    if (user && user.apiRevision === 7 && user.id && user.token && user.sessionKey &&
        /^[a-f0-9]{64}$/.test(user.refreshToken) && user.refreshExpiresAt > Date.now()) {
      return user
    }
  } catch (error) {
    localStorage.removeItem(storageKey)
  }
  localStorage.removeItem(storageKey)
  return null
}

function credentials(data, startedAt, previous) {
  if (!data || !data.id || !data.token || !/^[a-f0-9]{64}$/.test(data.refreshToken) ||
      !(data.expiresIn > 0) || !(data.refreshExpiresIn > 0)) {
    throw new Error('登录凭据无效，请重新登录')
  }
  return {
    ...data,
    apiRevision: 7,
    sessionKey: previous ? previous.sessionKey : crypto.randomUUID(),
    expiresAt: startedAt + data.expiresIn * 1000,
    refreshExpiresAt: Math.min(startedAt + data.refreshExpiresIn * 1000,
      previous ? previous.refreshExpiresAt : Infinity)
  }
}

function withSessionLock(callback, required = false) {
  if (navigator.locks) return navigator.locks.request('howblog-session', callback)
  if (required) return Promise.reject(new Error('当前浏览器无法安全刷新会话，请重新登录'))
  return Promise.resolve().then(callback)
}

function refreshAt(user) {
  return user.expiresAt - (user.refreshExpiresAt - user.expiresAt > 30000 ? 30000 : 0)
}

export default new Vuex.Store({
  plugins: [store => {
    let expiryTimer
    const scheduleExpiry = () => {
      clearTimeout(expiryTimer)
      const user = store.state.user
      if (!user || user.refreshing) return
      const remaining = Math.min(refreshAt(user), user.refreshExpiresAt) - Date.now()
      expiryTimer = setTimeout(() => {
        store.dispatch('ensureSession').catch(() => {})
      }, Math.max(0, Math.min(remaining, 2147483647)))
    }
    store.subscribe(scheduleExpiry)
    window.addEventListener('storage', event => {
      if (event.key === storageKey || event.key === null) store.commit('SYNC_USER', readUser())
    })
    scheduleExpiry()
  }],
  state: {
    user: readUser()
  },
  getters: {
    isLoggedIn: state => !!(state.user && state.user.refreshExpiresAt > Date.now()),
    token: state => (state.user ? state.user.token : ''),
    user: state => state.user,
    userId: state => (state.user ? state.user.id : ''),
    nickname: state => (state.user ? (state.user.nickname || state.user.mobile) : ''),
    avatar: state => (state.user && state.user.avatar ? state.user.avatar : 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png')
  },
  mutations: {
    SET_USER(state, user) {
      if (user) {
        localStorage.setItem(storageKey, JSON.stringify(user))
      } else {
        localStorage.removeItem(storageKey)
      }
      state.user = user
    },
    SYNC_USER(state, user) {
      if (JSON.stringify(state.user) !== JSON.stringify(user)) state.user = user
    },
    LOGOUT(state) {
      state.user = null
      localStorage.removeItem(storageKey)
    }
  },
  actions: {
    async login({ commit }, userInfo) {
      return withSessionLock(async () => {
        const startedAt = Date.now()
        const res = await loginApi(userInfo)
        const user = credentials(res.flag && res.data, startedAt)
        commit('SET_USER', user)
        return user
      })
    },
    async ensureSession({ commit }, { force = false, token } = {}) {
      const current = readUser()
      commit('SYNC_USER', current)
      if (!current) return ''
      if (!current.refreshing && refreshAt(current) > Date.now() &&
          (!force || (token && current.token !== token))) return current.token
      if (!refreshPromise) {
        refreshPromise = withSessionLock(async () => {
          const user = readUser()
          commit('SYNC_USER', user)
          if (!user) return ''
          if (!user.refreshing && refreshAt(user) > Date.now() &&
              (!force || (token && user.token !== token))) return user.token
          try {
            if (user.refreshExpiresAt - Date.now() < 1000) {
              commit('LOGOUT')
              return ''
            }
            if (user.refreshing) throw new Error('会话刷新结果未知，请重新登录')
            commit('SET_USER', { ...user, refreshing: true })
            const startedAt = Date.now()
            const res = await refreshApi(user.refreshToken)
            const next = credentials(res.flag && res.data, startedAt, user)
            commit('SET_USER', next)
            return next.token
          } catch (error) {
            commit('LOGOUT')
            throw error
          }
        }, true).catch(error => {
          if (!navigator.locks) commit('LOGOUT')
          throw error
        }).finally(() => { refreshPromise = null })
      }
      return refreshPromise
    },
    async logout({ commit }) {
      return withSessionLock(async () => {
        const user = readUser()
        if (!user) throw new Error('没有可撤销的本地会话，请重新登录')
        await logoutApi(user.refreshToken)
        commit('LOGOUT')
      })
    }
  }
})
