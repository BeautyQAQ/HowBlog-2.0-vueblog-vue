import request from '@/utils/request'

/**
 * 查询所有标签
 */
export function getLabelList() {
  return request({
    url: '/label',
    method: 'get'
  })
}

/**
 * 根据 ID 查询标签
 */
export function getLabelById(id) {
  return request({
    url: `/label/${id}`,
    method: 'get'
  })
}

/**
 * 添加标签
 */
export function addLabel(data) {
  return request({
    url: '/label',
    method: 'post',
    data
  })
}

/**
 * 编辑标签
 */
export function updateLabel(id, data) {
  return request({
    url: `/label/${id}`,
    method: 'put',
    data
  })
}

/**
 * 删除标签
 */
export function deleteLabel(id) {
  return request({
    url: `/label/${id}`,
    method: 'delete'
  })
}
