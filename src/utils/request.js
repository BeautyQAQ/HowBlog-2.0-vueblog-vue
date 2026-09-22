import axios from 'axios'
import { Message } from 'element-ui'
import store from '@/store'

const service = axios.create({
  baseURL: '/api',
  timeout: 10000
})

service.interceptors.request.use(
  config => {
    if (store.getters.userId) {
      config.headers['X-User-Id'] = store.getters.userId
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
        return Promise.reject(new Error(res.message || 'Error'))
      }
    }
    return response
  },
  error => {
    Message({
      message: error.message || '网络连接异常，请稍后重试',
      type: 'error',
      duration: 3000
    })
    return Promise.reject(error)
  }
)

export default service
