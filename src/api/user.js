import request from '@/utils/request'

/**
 * 用户登录
 * @param {object} data { mobile, password } 或 { nickname, password }
 */
export function login(data) {
  return request({
    url: '/user/login',
    method: 'post',
    data
  })
}
