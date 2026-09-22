import axios from 'axios'
import { Message } from 'element-ui'
import store from '@/store'

const service = axios.create({
  baseURL: '/api',
  timeout: 10000
})

service.interceptors.request.use(
  config => {
    if (store.state.user && !(store.state.user.expiresAt > Date.now())) {
      store.commit('LOGOUT')
    }
    if (store.getters.token && config.url !== '/user/login') {
      config.headers.Authorization = `Bearer ${store.getters.token}`
    }
    return config
  },
  error => {
    console.error('Request error:', error)
    return Promise.reject(error)
  }
)

service.interceptors.response.use(
  response => {
    const res = response.data
    if (res && typeof res.flag === 'boolean') {
      if (res.flag) {
        return res
      } else {
        Message({
          message: res.message || '操作失败',
          type: 'error',
          duration: 3000
        })
        const error = new Error(res.message || '操作失败')
        error.code = res.code
        error.response = response
        return Promise.reject(error)
      }
    }
    return response
  },
  error => {
    const response = error.response
    const result = response && response.data
    if (response && response.status === 401) {
      const authorization = error.config && error.config.headers && error.config.headers.Authorization
      if (!authorization || authorization === `Bearer ${store.getters.token}`) {
        store.commit('LOGOUT')
      }
    }
    if (result && typeof result.flag === 'boolean') {
      error.code = result.code
      error.message = result.message || error.message
    }
    Message({
      message: error.message || '网络连接异常，请稍后重试',
      type: 'error',
      duration: 3000
    })
    return Promise.reject(error)
  }
)

export default service
