<template>
  <div class="article-detail-container" v-loading="loading">
    <div v-if="article" class="detail-layout">
      <div class="detail-main">
        <article class="article-content-card">
          <!-- 面包屑导航 -->
          <el-breadcrumb separator="/" class="breadcrumb">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item v-if="article.columnid">
              {{ labelName }}
            </el-breadcrumb-item>
            <el-breadcrumb-item>正文</el-breadcrumb-item>
          </el-breadcrumb>

          <!-- 标题 -->
          <h1 class="title">{{ article.title }}</h1>

          <!-- 文章作者与时间元数据 -->
          <div class="meta-bar">
            <div class="author-info">
              <el-avatar
                :size="40"
                src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png"
              />
              <div class="author-details">
                <span class="author-name">{{ article.userid || '匿名作者' }}</span>
                <span class="post-time">发布于 {{ formatDate(article.createtime) }}</span>
              </div>
            </div>

            <div class="action-stats">
              <span class="stat-badge"><i class="el-icon-view"></i> {{ article.visits || 0 }} 阅读</span>
              <el-button
                type="text"
                size="mini"
                class="stat-badge thumbup-article-btn"
                :disabled="articleLiked || !canInteract"
                @click="handleArticleThumbup"
              >
                <i class="el-icon-thumb"></i> {{ article.thumbup || 0 }} 点赞
              </el-button>
              <span class="stat-badge"><i class="el-icon-chat-round"></i> {{ article.comment || 0 }} 评论</span>

              <template v-if="isAuthor">
                <el-button
                  type="primary"
                  size="mini"
                  plain
                  icon="el-icon-edit"
                  @click="editArticle"
                >
                  编辑
                </el-button>
                <el-button
                  type="danger"
                  size="mini"
                  plain
                  icon="el-icon-delete"
                  @click="confirmDelete"
                >
                  删除
                </el-button>
                <el-button
                  v-if="articleState === '0'"
                  type="success"
                  size="mini"
                  plain
                  :loading="transitioning"
                  @click="transitionArticle('publish')"
                >
                  发布
                </el-button>
                <el-button
                  v-if="articleState === '0'"
                  type="warning"
                  size="mini"
                  plain
                  :loading="transitioning"
                  @click="transitionArticle('submit')"
                >
                  提交审核
                </el-button>
                <el-button
                  v-if="articleState === '1'"
                  type="warning"
                  size="mini"
                  plain
                  :loading="transitioning"
                  @click="transitionArticle('unpublish')"
                >
                  下架
                </el-button>
              </template>
            </div>
          </div>

          <div class="article-tags">
            <el-tag v-if="article.ispublic === '0'" size="small" type="info">私密</el-tag>
            <el-tag v-if="articleState !== '1'" size="small" type="warning">
              {{ stateText }}
            </el-tag>
            <el-tag
              v-for="labelId in article.labelIds || []"
              :key="`detail-label-${labelId}`"
              size="small"
              effect="plain"
            >
              {{ getLabelName(labelId) }}
            </el-tag>
          </div>

          <!-- 封面大图 -->
          <div v-if="article.image" class="article-cover">
            <el-image
              :src="article.image"
              :alt="article.title"
              fit="cover"
              class="cover-image"
            >
              <div slot="placeholder" class="image-slot">
                <i class="el-icon-loading"></i> 图片加载中...
              </div>
              <div slot="error" class="image-slot">
                <i class="el-icon-picture-outline"></i> 图片加载失败
              </div>
            </el-image>
          </div>

          <!-- 文章正文 -->
          <div class="article-body">{{ article.content }}</div>
        </article>

        <!-- 评论互动区域 -->
        <section class="comments-card">
          <h3 class="section-title">
            评论 <span>({{ comments.length }})</span>
          </h3>

          <el-alert
            v-if="!canInteract"
            class="comment-notice"
            type="info"
            :closable="false"
            show-icon
            :title="articleState !== '1' ? '文章未发布，暂不能发表评论或点赞' : '评论暂不可用，请刷新文章后重试'"
          />

          <!-- 发表评论框 -->
          <div v-else class="comment-input-box">
            <div v-if="replyTo" class="reply-target">
              <div class="reply-target-header">
                <span>回复 {{ replyTo.userid }}</span>
                <el-button type="text" size="mini" @click="replyTo = null">取消回复</el-button>
              </div>
              <div class="reply-preview">{{ replyTo.content }}</div>
            </div>
            <el-input
              ref="commentInput"
              type="textarea"
              :rows="3"
              placeholder="写下你的评论，支持善意的交流与讨论..."
              v-model="newCommentContent"
              maxlength="500"
              show-word-limit
            />
            <div class="comment-input-footer">
              <span class="tip" v-if="!isLoggedIn">
                请先登录
              </span>
              <span class="tip" v-else>
                以 <strong>{{ nickname }}</strong> 身份发表
              </span>
              <el-button
                type="primary"
                size="small"
                :loading="submittingComment"
                @click="submitComment"
              >
                {{ isLoggedIn ? (replyTo ? '发表回复' : '发表评论') : '登录' }}
              </el-button>
            </div>
          </div>

          <div v-if="commentsError" class="comment-notice" role="alert">
            <el-alert :title="commentsError" type="warning" :closable="false" show-icon />
            <el-button type="text" @click="fetchData(false)">重新加载文章与评论</el-button>
          </div>

          <!-- 评论列表 -->
          <div class="comment-list" v-if="comments.length > 0">
            <div
              v-for="c in comments"
              :key="c.id || c._id"
              class="comment-item"
            >
              <el-avatar
                :size="36"
                src="https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png"
                class="comment-avatar"
              />
              <div class="comment-body">
                <div class="comment-header">
                  <span class="comment-user">{{ c.userid || '匿名用户' }}</span>
                  <span class="comment-time">{{ formatDate(c.publishdate) }}</span>
                </div>
                <div v-if="c.parentid" class="reply-reference">
                  回复 {{ getParentAuthor(c.parentid) }}
                </div>
                <div class="comment-text">{{ c.content }}</div>
                <div class="comment-footer">
                  <el-button
                    type="text"
                    size="mini"
                    class="thumbup-btn"
                    icon="el-icon-thumb"
                    :disabled="!canInteract"
                    @click="handleThumbup(c)"
                  >
                    赞 {{ c.thumbup || 0 }}
                  </el-button>
                  <el-button
                    v-if="canInteract"
                    type="text"
                    size="mini"
                    icon="el-icon-chat-line-round"
                    @click="replyToComment(c)"
                  >
                    回复
                  </el-button>
                  <el-button
                    v-if="canDeleteComment(c)"
                    type="text"
                    size="mini"
                    class="delete-btn"
                    icon="el-icon-delete"
                    @click="handleDeleteComment(c.id || c._id)"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <el-empty
            v-else-if="!commentsError"
            description="暂无评论，快来抢沙发吧~"
            :image-size="80"
          />
        </section>
      </div>

      <!-- 右侧悬浮目录/作者信息 -->
      <aside class="detail-sidebar">
        <div class="sidebar-card">
          <div class="sidebar-author">
            <el-avatar
              :size="56"
              src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png"
            />
            <div class="author-title">{{ article.userid || '作者' }}</div>
            <p class="author-bio">致力于分享技术见解与工程实践。</p>
            <el-button
              v-if="isLoggedIn && !isAuthor"
              size="small"
              :type="followingAuthor ? 'default' : 'primary'"
              :loading="followLoading || followUpdating"
              plain
              @click="toggleFollowAuthor"
            >
              {{ isLoggedIn && !followStatusLoaded ? '重试关注状态' : followingAuthor ? '取消关注' : '关注作者' }}
            </el-button>
          </div>
        </div>

        <div class="sidebar-card">
          <div class="sidebar-header"><i class="el-icon-link"></i> 快速操作</div>
          <el-button
            type="primary"
            class="full-btn"
            icon="el-icon-edit"
            @click="$router.push('/article/create')"
          >
            发表新文章
          </el-button>
          <el-button
            class="full-btn"
            icon="el-icon-back"
            @click="$router.push('/')"
          >
            返回文章列表
          </el-button>
        </div>
      </aside>
    </div>

    <el-empty v-else-if="!loading" :description="articleError || '文章不存在或暂无访问权限'">
      <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
      <el-button @click="fetchData()">重新加载</el-button>
    </el-empty>
  </div>
</template>

<script>
import { getArticleById, deleteArticle, thumbupArticle, publishArticle, unpublishArticle, submitArticle } from '@/api/article'
import { getCommentsByArticleId, saveComment, deleteComment, thumbupComment } from '@/api/comment'
import { getLabelList } from '@/api/label'
import { followUser, unfollowUser, getFollowStatus } from '@/api/user'
import { mapGetters } from 'vuex'

export default {
  name: 'ArticleDetail',
  data() {
    return {
      articleId: this.$route.params.id,
      article: null,
      comments: [],
      labels: [],
      loading: false,
      loadVersion: 0,
      articleError: '',
      commentsError: '',
      commentsUnavailable: false,
      replyTo: null,
      newCommentContent: '',
      submittingComment: false,
      articleLiked: false,
      followingAuthor: false,
      followStatusLoaded: false,
      followLoading: false,
      followUpdating: false,
      followVersion: 0,
      transitioning: false
    }
  },
  computed: {
    ...mapGetters(['userId', 'nickname', 'isLoggedIn']),
    isAuthor() {
      return this.isLoggedIn && this.article && this.article.userid === this.userId
    },
    articleState() {
      return String(this.article && this.article.state != null ? this.article.state : '1')
    },
    canInteract() {
      return !!this.article && this.articleState === '1' && !this.commentsUnavailable
    },
    stateText() {
      return {
        '0': '草稿',
        '1': '已发布',
        '2': '待审核'
      }[this.articleState] || '未知状态'
    },
    labelName() {
      if (!this.article || !this.article.columnid) return ''
      const found = this.labels.find(l => l.id === this.article.columnid)
      return found ? found.labelname : this.article.columnid
    }
  },
  created() {
    this.fetchData()
  },
  beforeDestroy() {
    this.loadVersion++
  },
  watch: {
    userId() {
      this.article = null
      this.comments = []
      this.replyTo = null
      this.articleLiked = false
      this.followingAuthor = false
      this.followStatusLoaded = false
      this.followLoading = false
      this.followUpdating = false
      this.followVersion++
      this.fetchData(false)
    }
  },
  methods: {
    async fetchData(includeLabels = true) {
      const version = ++this.loadVersion
      this.loading = true
      try {
        await Promise.all([
          this.fetchArticle(version),
          includeLabels ? this.fetchLabels(version) : Promise.resolve()
        ])
        if (version === this.loadVersion && this.article) {
          await Promise.all([this.fetchComments(version), this.fetchFollowStatus(version)])
        }
      } finally {
        if (version === this.loadVersion) this.loading = false
      }
    },
    async fetchArticle(version = this.loadVersion) {
      try {
        const res = await getArticleById(this.articleId)
        if (version !== this.loadVersion) return false
        if (res && res.flag && res.data) {
          this.article = res.data
          this.articleError = ''
          return true
        }
      } catch (error) {
        if (version !== this.loadVersion) return false
        const missing = error.response && error.response.status === 404
        this.articleError = missing ? '文章不存在、已被删除或暂无访问权限' : '文章加载失败，请稍后重试'
        if (missing) {
          this.article = null
          this.comments = []
          this.replyTo = null
        }
      }
      return false
    },
    async fetchLabels(version = this.loadVersion) {
      try {
        const res = await getLabelList()
        if (version === this.loadVersion && res && res.flag && Array.isArray(res.data)) {
          this.labels = res.data
        }
      } catch {
        // 标签服务暂不可用时仍展示文章正文。
      }
    },
    async fetchComments(version = this.loadVersion) {
      try {
        const res = await getCommentsByArticleId(this.articleId)
        if (version !== this.loadVersion) return
        if (res && res.flag && Array.isArray(res.data)) {
          this.comments = res.data
          this.commentsError = ''
          this.commentsUnavailable = false
          if (this.replyTo && !this.comments.some(comment =>
            (comment._id || comment.id) === (this.replyTo._id || this.replyTo.id))) {
            this.replyTo = null
            this.$message.warning('回复的评论已不存在，已取消回复，请确认后重新提交')
          }
        }
      } catch (error) {
        if (version !== this.loadVersion) return
        this.commentsUnavailable = !!(error.response && error.response.status === 404)
        this.commentsError = this.commentsUnavailable
          ? '文章不存在或暂无访问权限，无法加载评论'
          : '评论加载失败，请稍后重试'
        if (this.commentsUnavailable) {
          this.comments = []
          this.replyTo = null
        }
      }
    },
    async submitComment() {
      if (!this.requireLogin() || this.submittingComment) return
      if (!this.canInteract) {
        this.$message.warning('文章未发布或评论暂不可用，无法发表评论')
        return
      }
      const content = this.newCommentContent.trim()
      if (!content || !String(this.articleId || '').trim()) {
        this.$message.warning('评论内容不能为空')
        return
      }

      this.submittingComment = true
      try {
        const payload = {
          articleid: this.articleId,
          content: content
        }
        if (this.replyTo) payload.parentid = this.replyTo._id || this.replyTo.id
        const res = await saveComment(payload)
        if (res && res.flag) {
          this.$message.success('评论发表成功')
          this.newCommentContent = ''
          this.replyTo = null
          await this.fetchData(false)
        }
      } catch (error) {
        await this.refreshAfterCommentError(error)
      } finally {
        this.submittingComment = false
      }
    },
    async handleArticleThumbup() {
      if (!this.requireLogin() || !this.canInteract || this.articleLiked) return
      try {
        const res = await thumbupArticle(this.articleId)
        if (res && res.flag) {
          this.articleLiked = true
          this.article.thumbup = (this.article.thumbup || 0) + 1
          this.$message.success('点赞成功')
        }
      } catch (error) {
        await this.refreshAfterCommentError(error)
      }
    },
    async transitionArticle(action) {
      if (!this.isAuthor || this.transitioning) return
      this.transitioning = true
      try {
        const transitions = {
          publish: publishArticle,
          unpublish: unpublishArticle,
          submit: submitArticle
        }
        const res = await transitions[action](this.articleId)
        if (res && res.flag) {
          this.$message.success(res.message || '文章状态已更新')
          await this.fetchData(false)
        }
      } catch (e) {
        console.error(e)
      } finally {
        this.transitioning = false
      }
    },
    async fetchFollowStatus(version = this.loadVersion) {
      if (this.followUpdating) return
      const requestId = ++this.followVersion
      const authorId = this.article && this.article.userid
      if (!this.isLoggedIn || !authorId || authorId === this.userId) {
        this.followingAuthor = false
        this.followStatusLoaded = true
        this.followLoading = false
        return
      }
      this.followLoading = true
      this.followStatusLoaded = false
      try {
        const res = await getFollowStatus(authorId)
        if (version !== this.loadVersion || requestId !== this.followVersion) return
        if (res && res.flag && res.data && typeof res.data.following === 'boolean') {
          this.followingAuthor = res.data.following
          this.followStatusLoaded = true
        }
      } catch {
        // 状态未知时只允许重试查询，避免误发关注或取关。
      } finally {
        if (version === this.loadVersion && requestId === this.followVersion) this.followLoading = false
      }
    },
    async toggleFollowAuthor() {
      if (!this.requireLogin() || !this.article || !this.article.userid || this.followLoading || this.followUpdating) return
      if (!this.followStatusLoaded) {
        await this.fetchFollowStatus()
        return
      }
      const viewerId = this.userId
      const authorId = this.article.userid
      const wasFollowing = this.followingAuthor
      this.followUpdating = true
      try {
        const res = wasFollowing ? await unfollowUser(authorId) : await followUser(authorId)
        if (viewerId !== this.userId || !this.article || authorId !== this.article.userid) return
        if (res && res.flag) {
          this.followingAuthor = !wasFollowing
          this.$message.success(this.followingAuthor ? '关注成功' : '已取消关注')
        } else {
          this.followStatusLoaded = false
        }
      } catch {
        if (viewerId === this.userId) this.followStatusLoaded = false
      } finally {
        if (viewerId === this.userId) this.followUpdating = false
      }
      if (viewerId === this.userId && !this.followStatusLoaded) {
        await this.fetchFollowStatus()
      }
    },
    async handleThumbup(comment) {
      if (!this.requireLogin() || !this.canInteract) return
      const commentId = comment.id || comment._id
      try {
        const res = await thumbupComment(commentId)
        if (res && res.flag) {
          this.$message.success('点赞成功')
          comment.thumbup = (comment.thumbup || 0) + 1
        }
      } catch (error) {
        await this.refreshAfterCommentError(error)
      }
    },
    async refreshAfterCommentError(error) {
      const status = error.response && error.response.status
      if (status === 404) await this.fetchData(false)
      else if (status === 400) await this.fetchComments()
    },
    replyToComment(comment) {
      if (!this.requireLogin() || !this.canInteract) return
      this.replyTo = comment
      this.$nextTick(() => this.$refs.commentInput.focus())
    },
    getParentAuthor(parentId) {
      const parent = this.comments.find(comment => (comment._id || comment.id) === parentId)
      return parent ? parent.userid : parentId
    },
    canDeleteComment(comment) {
      if (!this.isLoggedIn) return false
      return comment.userid === this.userId
    },
    getLabelName(id) {
      const found = this.labels.find(label => label.id === id)
      return found ? found.labelname : id
    },
    requireLogin() {
      if (this.isLoggedIn) return true
      this.$router.push({ path: '/login', query: { redirect: this.$route.fullPath } })
      return false
    },
    async handleDeleteComment(commentId) {
      if (!this.requireLogin()) return
      try {
        await this.$confirm('确定删除该评论及其全部后代回复吗？包含其他用户的回复，删除后无法恢复。', '删除评论', {
          type: 'warning',
          confirmButtonText: '删除评论及回复',
          cancelButtonText: '取消'
        })
      } catch {
        return
      }
      try {
        const res = await deleteComment(commentId)
        if (res && res.flag) {
          this.$message.success('评论及其回复已删除')
          await this.fetchData(false)
        }
      } catch (error) {
        await this.refreshAfterCommentError(error)
      }
    },
    editArticle() {
      this.$router.push(`/article/edit/${this.articleId}`)
    },
    confirmDelete() {
      this.$confirm('确定删除此文章及其全部评论和回复吗？删除后将无法恢复。', '警告', {
        type: 'warning',
        confirmButtonText: '确定删除',
        cancelButtonText: '取消'
      }).then(async () => {
        try {
          const res = await deleteArticle(this.articleId)
          if (res && res.flag) {
            this.$message.success('文章已删除')
            this.$router.push('/')
          }
        } catch (e) {
          console.error(e)
        }
      }).catch(() => {})
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      const hour = String(d.getHours()).padStart(2, '0')
      const minute = String(d.getMinutes()).padStart(2, '0')
      return `${year}-${month}-${day} ${hour}:${minute}`
    }
  }
}
</script>

<style scoped>
.detail-layout {
  display: flex;
  gap: 24px;
}

.detail-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.article-content-card,
.comments-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 30px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.breadcrumb {
  margin-bottom: 20px;
  font-size: 13px;
}

.title {
  font-size: 26px;
  font-weight: 700;
  color: #303133;
  margin-bottom: 16px;
  line-height: 1.4;
}

.meta-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 20px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 24px;
}

.author-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.author-details {
  display: flex;
  flex-direction: column;
}

.author-name {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
}

.post-time {
  font-size: 12px;
  color: #909399;
}

.action-stats {
  display: flex;
  align-items: center;
  gap: 14px;
}

.thumbup-article-btn {
  padding: 0;
}

.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: -8px 0 24px;
}

.stat-badge {
  font-size: 13px;
  color: #909399;
}

.article-cover {
  margin-bottom: 24px;
  border-radius: 8px;
  overflow: hidden;
  max-height: 380px;
  background: #f5f7fa;
}

.cover-image {
  width: 100%;
  height: 320px;
  display: block;
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  color: #909399;
  font-size: 14px;
  gap: 8px;
}

.article-body {
  font-size: 16px;
  line-height: 1.8;
  color: #2c3e50;
  word-break: break-word;
  white-space: pre-wrap;
}

.section-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.section-title span {
  font-size: 14px;
  color: #909399;
  font-weight: normal;
}

.comment-input-box {
  margin-bottom: 24px;
}

.comment-notice {
  margin-bottom: 20px;
}

.reply-target {
  padding: 10px 12px;
  margin-bottom: 12px;
  background: #f5f7fa;
  border-left: 3px solid #409eff;
  border-radius: 4px;
}

.reply-target-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.reply-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #909399;
  font-size: 13px;
}

.reply-reference {
  margin-bottom: 6px;
  color: #909399;
  font-size: 12px;
}

.comment-input-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 10px;
}

.comment-input-footer .tip {
  font-size: 13px;
  color: #909399;
}

.comment-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.comment-item {
  display: flex;
  gap: 12px;
  padding-bottom: 16px;
  border-bottom: 1px solid #f2f6fc;
}

.comment-body {
  flex: 1;
  min-width: 0;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}

.comment-user {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.comment-time {
  font-size: 12px;
  color: #909399;
}

.comment-text {
  font-size: 14px;
  line-height: 1.6;
  color: #606266;
  margin-bottom: 8px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.comment-footer {
  display: flex;
  gap: 16px;
}

.thumbup-btn {
  color: #909399;
}

.thumbup-btn:hover {
  color: #409eff;
}

.delete-btn {
  color: #f56c6c;
}

.detail-sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.sidebar-author {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.author-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin: 12px 0 6px;
}

.author-bio {
  font-size: 13px;
  color: #909399;
  line-height: 1.5;
}

.sidebar-header {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.full-btn {
  width: 100%;
  margin-bottom: 10px;
  margin-left: 0 !important;
}

@media (max-width: 768px) {
  .detail-layout {
    flex-direction: column;
  }

  .detail-sidebar {
    width: 100%;
  }

  .meta-bar {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }

  .action-stats {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .cover-image {
    height: 200px;
  }
}
</style>
