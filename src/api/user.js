import request from '@/utils/request'

/**
 * 用户登录
 * @param {object} data { mobile, password }
 */
export function login(data) {
  return request({
    url: '/user/login',
    method: 'post',
    data: { mobile: data.mobile, password: data.password }
  })
}

export function refresh(refreshToken) {
  return request({
    url: '/user/refresh',
    method: 'post',
    data: { refreshToken }
  })
}

export function logout(refreshToken) {
  return request({
    url: '/user/logout',
    method: 'post',
    data: { refreshToken }
  })
}
