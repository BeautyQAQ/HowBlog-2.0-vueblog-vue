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

/**
 * 用户注册（公开接口，成功后需再调用登录接口获取凭据）
 * @param {object} data { mobile, password, nickname? }
 */
export function register(data) {
  const payload = { mobile: data.mobile, password: data.password }
  const nickname = data.nickname == null ? '' : String(data.nickname).trim()
  if (nickname) {
    payload.nickname = nickname
  }
  return request({
    url: '/user/register',
    method: 'post',
    data: payload
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

/**
 * 查询当前登录用户资料
 */
export function getProfile() {
  return request({
    url: '/user/profile',
    method: 'get'
  })
}

/**
 * 修改当前登录用户资料（部分更新，仅发送需要变更的字段）
 */
export function updateProfile(data) {
  return request({
    url: '/user/profile',
    method: 'put',
    data
  })
}

/**
 * 修改当前登录用户密码（成功后其他设备会话被撤销，当前设备保持有效）
 * @param {object} data { oldPassword, newPassword }
 */
export function changePassword(data) {
  return request({
    url: '/user/password',
    method: 'post',
    data: { oldPassword: data.oldPassword, newPassword: data.newPassword }
  })
}
