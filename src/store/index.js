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

export default new Vuex.Store({
  state: {
    user: storedUser
  },
  getters: {
    isLoggedIn: state => !!(state.user && state.user.id),
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
      if (res.flag && res.data) {
        commit('SET_USER', res.data)
        return res.data
      }
      return null
    },
    logout({ commit }) {
      commit('LOGOUT')
    }
  }
})
