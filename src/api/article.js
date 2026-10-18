import request from '@/utils/request'

/**
 * 查询所有文章
 */
export function getArticleList() {
  return request({
    url: '/article',
    method: 'get'
  })
}

/**
 * 根据 ID 查询文章
 */
export function getArticleById(id) {
  return request({
    url: `/article/${id}`,
    method: 'get'
  })
}

/**
 * 新增文章
 */
export function addArticle(data) {
  return request({
    url: '/article',
    method: 'post',
    data
  })
}

/**
 * 更新文章
 */
export function updateArticle(id, data) {
  return request({
    url: `/article/${id}`,
    method: 'put',
    data
  })
}

/**
 * 发布文章
 */
export function publishArticle(id) {
  return request({
    url: `/article/${id}/publish`,
    method: 'put'
  })
}

/**
 * 下架文章
 */
export function unpublishArticle(id) {
  return request({
    url: `/article/${id}/unpublish`,
    method: 'put'
  })
}

/**
 * 提交文章审核
 */
export function submitArticle(id) {
  return request({
    url: `/article/${id}/submit`,
    method: 'put'
  })
}

/**
 * 审核通过文章
 */
export function approveArticle(id) {
  return request({
    url: `/article/${id}/approve`,
    method: 'put'
  })
}

/**
 * 驳回文章审核
 */
export function rejectArticle(id) {
  return request({
    url: `/article/${id}/reject`,
    method: 'put'
  })
}

/**
 * 文章点赞
 */
export function thumbupArticle(id) {
  return request({
    url: `/article/thumbup/${id}`,
    method: 'put'
  })
}

/**
 * 删除文章
 */
export function deleteArticle(id) {
  return request({
    url: `/article/${id}`,
    method: 'delete'
  })
}

/**
 * 条件分页查询文章
 * @param {number} page 页码（1 开始）
 * @param {number} size 每页大小
 * @param {object} conditions 查询条件
 */
export function searchArticle(page, size, conditions = {}) {
  if (!Number.isInteger(page) || page < 1 || page > 2147483647 ||
      !Number.isInteger(size) || size < 1 || size > 100) {
    return Promise.reject(new RangeError('页码必须为正整数，每页数量必须在 1 到 100 之间'))
  }
  return request({
    url: `/article/search/${page}/${size}`,
    method: 'post',
    data: conditions
  })
}
