<template>
  <div v-loading="loading" class="review-container">
    <el-card shadow="never" class="review-card">
      <div slot="header" class="card-header">
        <span class="title"><i class="el-icon-s-check"></i> 审核中心</span>
        <el-button size="small" icon="el-icon-refresh" @click="fetchArticles">刷新</el-button>
      </div>

      <el-empty v-if="articles.length === 0 && !loading" description="暂无待审核文章" />
      <div v-else class="review-list">
        <article v-for="article in articles" :key="article.id" class="review-item">
          <div class="review-content">
            <div class="review-meta">
              <span>作者 {{ article.userid || '未知' }}</span>
              <span>{{ formatDate(article.updatetime || article.createtime) }}</span>
            </div>
            <h2>{{ article.title }}</h2>
            <p>{{ summary(article.content) }}</p>
            <div class="review-labels">
              <el-tag
                v-for="labelId in article.labelIds || []"
                :key="`${article.id}-${labelId}`"
                size="mini"
                effect="plain"
              >
                {{ labelName(labelId) }}
              </el-tag>
            </div>
          </div>
          <div class="review-actions">
            <el-button size="small" @click="$router.push(`/article/${article.id}`)">
              查看
            </el-button>
            <el-button
              type="success"
              size="small"
              :loading="processingId === article.id"
              @click="reviewArticle(article, 'approve')"
            >
              通过
            </el-button>
            <el-button
              type="danger"
              size="small"
              :loading="processingId === article.id"
              @click="reviewArticle(article, 'reject')"
            >
              驳回
            </el-button>
          </div>
        </article>
      </div>
    </el-card>
  </div>
</template>

<script>
import { searchArticle, approveArticle, rejectArticle } from '@/api/article'
import { getLabelList } from '@/api/label'

export default {
  name: 'ArticleReview',
  data() {
    return {
      articles: [],
      labels: [],
      loading: false,
      processingId: null
    }
  },
  created() {
    this.fetchArticles()
    this.fetchLabels()
  },
  methods: {
    async fetchArticles() {
      this.loading = true
      try {
        const res = await searchArticle(1, 100, { state: '2' })
        if (res && res.flag && res.data) {
          this.articles = Array.isArray(res.data.rows) ? res.data.rows : []
        }
      } catch (error) {
        console.error(error)
      } finally {
        this.loading = false
      }
    },
    async fetchLabels() {
      try {
        const res = await getLabelList()
        if (res && res.flag && Array.isArray(res.data)) this.labels = res.data
      } catch (error) {
        console.error(error)
      }
    },
    async reviewArticle(article, action) {
      if (this.processingId) return
      this.processingId = article.id
      try {
        const review = action === 'approve' ? approveArticle : rejectArticle
        const res = await review(article.id)
        if (res && res.flag) {
          this.$message.success(res.message || '审核完成')
          this.articles = this.articles.filter(item => item.id !== article.id)
        }
      } catch (error) {
        console.error(error)
      } finally {
        this.processingId = null
      }
    },
    labelName(id) {
      const label = this.labels.find(item => item.id === id)
      return label ? label.labelname : id
    },
    summary(content) {
      const plain = String(content || '').replace(/<[^>]+>/g, '').trim()
      return plain.length > 180 ? `${plain.slice(0, 180)}...` : plain
    },
    formatDate(value) {
      if (!value) return ''
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return String(value)
      const pad = number => String(number).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
    }
  }
}
</script>

<style scoped>
.review-container {
  max-width: 960px;
  margin: 0 auto;
}

.review-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.title {
  color: #303133;
  font-size: 18px;
  font-weight: 600;
}

.review-item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  padding: 18px 0;
  border-bottom: 1px solid #ebeef5;
}

.review-item:last-child {
  border-bottom: 0;
}

.review-content {
  min-width: 0;
  flex: 1;
}

.review-meta {
  display: flex;
  gap: 16px;
  color: #909399;
  font-size: 12px;
}

.review-content h2 {
  margin: 10px 0 8px;
  color: #303133;
  font-size: 18px;
}

.review-content p {
  margin: 0;
  color: #606266;
  line-height: 1.7;
}

.review-labels {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.review-actions {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

@media (max-width: 680px) {
  .review-item {
    flex-direction: column;
  }

  .review-actions {
    width: 100%;
  }
}
</style>