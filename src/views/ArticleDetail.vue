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
              <span class="stat-badge"><i class="el-icon-thumb"></i> {{ article.thumbup || 0 }} 点赞</span>
              <span class="stat-badge"><i class="el-icon-chat-round"></i> {{ comments.length }} 评论</span>

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
              </template>
            </div>
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
          <div class="article-body" v-html="article.content"></div>
        </article>

        <!-- 评论互动区域 -->
        <section class="comments-card">
          <h3 class="section-title">
            评论 <span>({{ comments.length }})</span>
          </h3>

          <!-- 发表评论框 -->
          <div class="comment-input-box">
            <el-input
              type="textarea"
              :rows="3"
              placeholder="写下你的评论，支持善意的交流与讨论..."
              v-model="newCommentContent"
              maxlength="500"
              show-word-limit
            />
            <div class="comment-input-footer">
              <span class="tip" v-if="!isLoggedIn">
                当前为未登录状态，将以 <strong>游客</strong> 身份发表
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
                发表评论
              </el-button>
            </div>
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
                <div class="comment-text">{{ c.content }}</div>
                <div class="comment-footer">
                  <el-button
                    type="text"
                    size="mini"
                    class="thumbup-btn"
                    icon="el-icon-thumb"
                    @click="handleThumbup(c)"
                  >
                    赞 {{ c.thumbup || 0 }}
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
            v-else
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

    <el-empty v-else-if="!loading" description="文章不存在或已被删除">
      <el-button type="primary" @click="$router.push('/')">返回首页</el-button>
    </el-empty>
  </div>
</template>

<script>
import { getArticleById, deleteArticle } from '@/api/article'
import { getCommentsByArticleId, saveComment, deleteComment, thumbupComment } from '@/api/comment'
import { getLabelList } from '@/api/label'
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
      newCommentContent: '',
      submittingComment: false
    }
  },
  computed: {
    ...mapGetters(['userId', 'nickname', 'isLoggedIn']),
    isAuthor() {
      return this.isLoggedIn && this.article && this.article.userid === this.userId
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
  methods: {
    async fetchData() {
      this.loading = true
      try {
        const [articleRes, commentRes, labelRes] = await Promise.all([
          getArticleById(this.articleId),
          getCommentsByArticleId(this.articleId),
          getLabelList()
        ])
        if (articleRes && articleRes.flag) {
          this.article = articleRes.data
        }
        if (commentRes && commentRes.flag && Array.isArray(commentRes.data)) {
          this.comments = commentRes.data
        }
        if (labelRes && labelRes.flag && Array.isArray(labelRes.data)) {
          this.labels = labelRes.data
        }
      } catch (e) {
        console.error('Failed to load article detail:', e)
      } finally {
        this.loading = false
      }
    },
    async fetchComments() {
      try {
        const res = await getCommentsByArticleId(this.articleId)
        if (res && res.flag && Array.isArray(res.data)) {
          this.comments = res.data
        }
      } catch (e) {
        console.error(e)
      }
    },
    async submitComment() {
      const content = this.newCommentContent.trim()
      if (!content) {
        this.$message.warning('评论内容不能为空')
        return
      }

      this.submittingComment = true
      try {
        const payload = {
          articleid: this.articleId,
          content: content,
          userid: this.isLoggedIn ? (this.nickname || this.userId) : '游客',
          publishdate: new Date()
        }
        const res = await saveComment(payload)
        if (res && res.flag) {
          this.$message.success('评论发表成功')
          this.newCommentContent = ''
          this.fetchComments()
        }
      } catch (e) {
        console.error(e)
      } finally {
        this.submittingComment = false
      }
    },
    async handleThumbup(comment) {
      const commentId = comment.id || comment._id
      try {
        const res = await thumbupComment(commentId)
        if (res && res.flag) {
          this.$message.success('点赞成功')
          comment.thumbup = (comment.thumbup || 0) + 1
        }
      } catch (e) {
        console.error(e)
      }
    },
    canDeleteComment(comment) {
      if (!this.isLoggedIn) return false
      return comment.userid === this.userId || comment.userid === this.nickname || this.isAuthor
    },
    handleDeleteComment(commentId) {
      this.$confirm('确定删除该评论吗？', '提示', {
        type: 'warning'
      }).then(async () => {
        try {
          const res = await deleteComment(commentId)
          if (res && res.flag) {
            this.$message.success('评论已删除')
            this.fetchComments()
          }
        } catch (e) {
          console.error(e)
        }
      }).catch(() => {})
    },
    editArticle() {
      this.$router.push(`/article/edit/${this.articleId}`)
    },
    confirmDelete() {
      this.$confirm('确定删除此文章吗？删除后将无法恢复。', '警告', {
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
}

.article-body >>> p {
  margin-bottom: 16px;
}

.article-body >>> ul,
.article-body >>> ol {
  margin-bottom: 16px;
  padding-left: 24px;
}

.article-body >>> li {
  margin-bottom: 6px;
}

.article-body >>> code {
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 4px;
  color: #e6a23c;
  font-family: monospace;
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
