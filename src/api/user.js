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
