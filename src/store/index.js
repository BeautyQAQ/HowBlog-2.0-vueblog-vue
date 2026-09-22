import Vue from 'vue'
import Vuex from 'vuex'
import { login as loginApi } from '@/api/user'

Vue.use(Vuex)

let storedUser = null
try {
  const item = localStorage.getItem('howblog_user')
  if (item) {
    storedUser = JSON.parse(item)
  }
} catch (e) {
  console.error('Failed to parse stored user:', e)
}

if (!storedUser || !storedUser.id || !storedUser.token || !(storedUser.expiresAt > Date.now())) {
  storedUser = null
  localStorage.removeItem('howblog_user')
}

export default new Vuex.Store({
  plugins: [store => {
    let expiryTimer
    const scheduleExpiry = () => {
      clearTimeout(expiryTimer)
      const user = store.state.user
      if (!user) return
      const remaining = user.expiresAt - Date.now()
      if (!(remaining > 0)) {
        store.commit('LOGOUT')
        return
      }
      expiryTimer = setTimeout(scheduleExpiry, Math.min(remaining, 2147483647))
    }
    store.subscribe(scheduleExpiry)
    scheduleExpiry()
  }],
  state: {
    user: storedUser
  },
  getters: {
    isLoggedIn: state => !!(state.user && state.user.id && state.user.token && state.user.expiresAt > Date.now()),
    token: state => (state.user && state.user.expiresAt > Date.now() ? state.user.token : ''),
    user: state => state.user,
    userId: state => (state.user ? state.user.id : ''),
    nickname: state => (state.user ? (state.user.nickname || state.user.mobile) : ''),
    avatar: state => (state.user && state.user.avatar ? state.user.avatar : 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png')
  },
  mutations: {
    SET_USER(state, user) {
      state.user = user
      if (user) {
        localStorage.setItem('howblog_user', JSON.stringify(user))
      } else {
        localStorage.removeItem('howblog_user')
      }
    },
    LOGOUT(state) {
      state.user = null
      localStorage.removeItem('howblog_user')
    }
  },
  actions: {
    async login({ commit }, userInfo) {
      const res = await loginApi(userInfo)
      if (res.flag && res.data && res.data.id && res.data.token && res.data.expiresIn > 0) {
        const user = { ...res.data, expiresAt: Date.now() + res.data.expiresIn * 1000 }
        commit('SET_USER', user)
        return user
      }
      throw new Error('登录响应缺少有效的访问令牌')
    },
    logout({ commit }) {
      commit('LOGOUT')
    }
  }
})
