import axios from 'axios'
import { Message } from 'element-ui'
import store from '@/store'

const service = axios.create({
  baseURL: '/api',
  timeout: 10000
})

const credentialEndpoints = ['/user/login', '/user/refresh', '/user/logout']

service.interceptors.request.use(
  async config => {
    config.headers = config.headers || {}
    delete config.headers.Authorization
    if (!credentialEndpoints.includes(config.url)) {
      const token = await store.dispatch('ensureSession')
      if (config.sessionKey && (!store.state.user || config.sessionKey !== store.state.user.sessionKey)) {
        throw new Error('登录会话已改变，请重新操作')
      }
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
        config.sessionKey = store.state.user.sessionKey
      }
    }
    return config
  },
  error => Promise.reject(error)
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
  async error => {
    const response = error.response
    const result = response && response.data
    const config = error.config
    if (response && response.status === 401 && config && !credentialEndpoints.includes(config.url)) {
      const user = store.state.user
      const authorization = config.headers && config.headers.Authorization
      if (user && config.sessionKey === user.sessionKey && authorization) {
        if (!config.sessionRetry) {
          const token = await store.dispatch('ensureSession', {
            force: true, token: authorization.slice(7)
          })
          if (token && store.state.user && store.state.user.sessionKey === config.sessionKey) {
            config.sessionRetry = true
            return service(config)
          }
        } else if (authorization === `Bearer ${store.getters.token}`) {
          store.commit('LOGOUT')
        }
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
