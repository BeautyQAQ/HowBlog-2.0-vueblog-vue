import request from '@/utils/request'

/**
 * 根据文章 ID 查询评论平铺列表，不存在或不可见的文章返回 404
 */
export function getCommentsByArticleId(articleId) {
  return request({
    url: `/comment/article/${articleId}`,
    method: 'get'
  })
}

/**
 * 发表评论或回复，parentid 如提供必须属于同一篇已发布文章
 */
export function saveComment(data) {
  return request({
    url: '/comment',
    method: 'post',
    data,
    errorMessages: {
      400: '评论内容或回复对象无效，请刷新评论后重试',
      404: '文章不存在或尚未发布，暂时无法发表评论'
    }
  })
}

/**
 * 根据 ID 删除本人评论及其全部后代回复，成功后需刷新评论和文章统计
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
    method: 'put',
    errorMessages: {
      404: '评论或文章已不存在，或文章尚未发布，暂时无法点赞'
    }
  })
}
