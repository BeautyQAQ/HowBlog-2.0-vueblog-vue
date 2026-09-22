import request from '@/utils/request'

/**
 * 根据文章 ID 查询评论列表
 */
export function getCommentsByArticleId(articleId) {
  return request({
    url: `/comment/article/${articleId}`,
    method: 'get'
  })
}

/**
 * 发表评论
 */
export function saveComment(data) {
  return request({
    url: '/comment',
    method: 'post',
    data
  })
}

/**
 * 根据 ID 删除评论
 */
export function deleteComment(id) {
  return request({
    url: `/comment/${id}`,
    method: 'delete'
  })
}

/**
 * 评论点赞
 */
export function thumbupComment(id) {
  return request({
    url: `/comment/thumbup/${id}`,
    method: 'put'
  })
}
