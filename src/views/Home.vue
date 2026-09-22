<template>
  <div class="home-container">
    <div class="home-layout">
      <!-- 左侧主要文章列表 -->
      <div class="article-list-section">
        <!-- 顶部筛选与搜索状态 -->
        <div class="filter-header" v-if="selectedLabel || searchKeyword">
          <div class="current-filter">
            <span v-if="selectedLabel" class="filter-tag">
              标签: <strong>{{ getLabelName(selectedLabel) }}</strong>
              <i class="el-icon-close" @click="clearLabelFilter"></i>
            </span>
            <span v-if="searchKeyword" class="filter-tag">
              关键词: <strong>{{ searchKeyword }}</strong>
              <i class="el-icon-close" @click="clearSearchFilter"></i>
            </span>
          </div>
          <el-button type="text" size="small" @click="resetAllFilters">清除全部筛选</el-button>
        </div>

        <!-- 加载状态 -->
        <div v-if="loading" class="loading-box">
          <i class="el-icon-loading"></i>
          <span>加载文章中...</span>
        </div>

        <!-- 空数据状态 -->
        <el-empty
          v-else-if="filteredArticles.length === 0"
          description="暂无相关文章"
          :image-size="120"
        >
          <el-button type="primary" size="small" @click="$router.push('/article/create')">
            去写第一篇
          </el-button>
        </el-empty>

        <!-- 文章列表 -->
        <div v-else class="article-cards">
          <article
            v-for="article in paginatedArticles"
            :key="article.id"
            class="article-card"
            @click="goToDetail(article.id)"
          >
            <div class="card-body">
              <div class="card-meta">
                <span v-if="article.istop === '1'" class="badge-top">置顶</span>
                <span class="meta-item">
                  <i class="el-icon-user"></i>
                  {{ article.userid || '匿名作者' }}
                </span>
                <span class="meta-dot">·</span>
                <span class="meta-item">
                  <i class="el-icon-time"></i>
                  {{ formatDate(article.createtime) }}
                </span>
                <span v-if="article.columnid" class="meta-label">
                  {{ getLabelName(article.columnid) }}
                </span>
              </div>

              <h2 class="article-title">{{ article.title }}</h2>

              <p class="article-summary">
                {{ getSummary(article.content) }}
              </p>

              <div class="card-footer">
                <div class="stats">
                  <span class="stat-item">
                    <i class="el-icon-view"></i> {{ article.visits || 0 }} 浏览
                  </span>
                  <span class="stat-item">
                    <i class="el-icon-thumb"></i> {{ article.thumbup || 0 }} 点赞
                  </span>
                  <span class="stat-item">
                    <i class="el-icon-chat-round"></i> {{ article.comment || 0 }} 评论
                  </span>
                </div>

                <div v-if="isAuthor(article)" class="author-actions" @click.stop>
                  <el-button
                    type="text"
                    size="mini"
                    icon="el-icon-edit"
                    @click="editArticle(article.id)"
                  >
                    编辑
                  </el-button>
                  <el-button
                    type="text"
                    size="mini"
                    icon="el-icon-delete"
                    class="btn-delete"
                    @click="confirmDelete(article.id)"
                  >
                    删除
                  </el-button>
                </div>
              </div>
            </div>

            <div v-if="article.image" class="card-cover">
              <el-image
                :src="article.image"
                :alt="article.title"
                fit="cover"
                class="card-cover-img"
              >
                <div slot="error" class="image-slot">
                  <i class="el-icon-picture-outline"></i>
                </div>
              </el-image>
            </div>
          </article>
        </div>

        <!-- 分页组件 -->
        <div v-if="filteredArticles.length > pageSize" class="pagination-wrapper">
          <el-pagination
            background
            layout="prev, pager, next, total"
            :current-page.sync="currentPage"
            :page-size="pageSize"
            :total="filteredArticles.length"
          />
        </div>
      </div>

      <!-- 右侧边栏：标签与统计 -->
      <aside class="home-sidebar">
        <div class="sidebar-card">
          <div class="card-header">
            <span class="title"><i class="el-icon-collection-tag"></i> 热门标签</span>
            <router-link to="/labels" class="more-link">全部</router-link>
          </div>
          <div class="tags-cloud">
            <span
              class="tag-pill"
              :class="{ active: selectedLabel === '' }"
              @click="selectLabel('')"
            >
              全部
            </span>
            <span
              v-for="lbl in labels"
              :key="lbl.id"
              class="tag-pill"
              :class="{ active: selectedLabel === lbl.id }"
              @click="selectLabel(lbl.id)"
            >
              {{ lbl.labelname }}
              <span class="tag-count" v-if="lbl.count">({{ lbl.count }})</span>
            </span>
          </div>
        </div>

        <div class="sidebar-card intro-card">
          <div class="card-header">
            <span class="title"><i class="el-icon-info"></i> 关于 HowBlog 2.0</span>
          </div>
          <p class="intro-desc">
            基于 Spring Boot 微服务架构与 Vue 2 + Element UI 构建的技术博客与即时通讯系统。
          </p>
          <div class="quick-links">
            <router-link to="/chat" class="quick-link">
              <i class="el-icon-chat-dot-round"></i>
              <span>进入在线即时聊天室</span>
            </router-link>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script>
import { getArticleList, deleteArticle } from '@/api/article'
import { getLabelList } from '@/api/label'
import { mapGetters } from 'vuex'

export default {
  name: 'Home',
  data() {
    return {
      articles: [],
      labels: [],
      loading: false,
      selectedLabel: '',
      searchKeyword: '',
      currentPage: 1,
      pageSize: 10
    }
  },
  computed: {
    ...mapGetters(['userId', 'isLoggedIn']),
    filteredArticles() {
      let list = [...this.articles]

      // 标签过滤
      if (this.selectedLabel) {
        list = list.filter(a => a.columnid === this.selectedLabel || a.channelid === this.selectedLabel)
      }

      // 关键词过滤
      if (this.searchKeyword) {
        const kw = this.searchKeyword.toLowerCase()
        list = list.filter(a =>
          (a.title && a.title.toLowerCase().includes(kw)) ||
          (a.content && a.content.toLowerCase().includes(kw))
        )
      }

      // 置顶文章排在前面
      list.sort((a, b) => {
        if (a.istop === '1' && b.istop !== '1') return -1
        if (a.istop !== '1' && b.istop === '1') return 1
        const dateA = a.createtime ? new Date(a.createtime).getTime() : 0
        const dateB = b.createtime ? new Date(b.createtime).getTime() : 0
        return dateB - dateA
      })

      return list
    },
    paginatedArticles() {
      const start = (this.currentPage - 1) * this.pageSize
      return this.filteredArticles.slice(start, start + this.pageSize)
    }
  },
  watch: {
    '$route.query.search': {
      immediate: true,
      handler(val) {
        this.searchKeyword = val || ''
        this.currentPage = 1
      }
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
        const res = await getArticleList()
        if (res && res.flag && Array.isArray(res.data)) {
          this.articles = res.data
        }
      } catch (e) {
        console.error('Failed to fetch articles:', e)
      } finally {
        this.loading = false
      }
    },
    async fetchLabels() {
      try {
        const res = await getLabelList()
        if (res && res.flag && Array.isArray(res.data)) {
          this.labels = res.data
        }
      } catch (e) {
        console.error('Failed to fetch labels:', e)
      }
    },
    selectLabel(labelId) {
      this.selectedLabel = labelId
      this.currentPage = 1
    },
    clearLabelFilter() {
      this.selectedLabel = ''
    },
    clearSearchFilter() {
      this.searchKeyword = ''
      this.$router.replace({ path: '/' }).catch(() => {})
    },
    resetAllFilters() {
      this.selectedLabel = ''
      this.searchKeyword = ''
      this.$router.replace({ path: '/' }).catch(() => {})
    },
    getLabelName(id) {
      const found = this.labels.find(l => l.id === id)
      return found ? found.labelname : id
    },
    getSummary(content) {
      if (!content) return '暂无内容摘要'
      const plain = content.replace(/<[^>]+>/g, '').trim()
      return plain.length > 120 ? plain.slice(0, 120) + '...' : plain
    },
    formatDate(dateStr) {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return dateStr
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    },
    isAuthor(article) {
      return this.isLoggedIn && this.userId && article.userid === this.userId
    },
    goToDetail(id) {
      this.$router.push(`/article/${id}`)
    },
    editArticle(id) {
      this.$router.push(`/article/edit/${id}`)
    },
    confirmDelete(id) {
      this.$confirm('确定要删除这篇文章吗？', '提示', {
        type: 'warning',
        confirmButtonText: '确定删除',
        cancelButtonText: '取消'
      }).then(async () => {
        try {
          const res = await deleteArticle(id)
          if (res.flag) {
            this.$message.success('文章已删除')
            this.fetchArticles()
          }
        } catch (e) {
          console.error(e)
        }
      }).catch(() => {})
    }
  }
}
</script>

<style scoped>
.home-layout {
  display: flex;
  gap: 24px;
}

.article-list-section {
  flex: 1;
  min-width: 0;
}

.filter-header {
  background: #ffffff;
  padding: 12px 16px;
  border-radius: 8px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.current-filter {
  display: flex;
  gap: 8px;
  align-items: center;
}

.filter-tag {
  background: #ecf5ff;
  color: #409eff;
  border: 1px solid #d9ecff;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.filter-tag i {
  cursor: pointer;
}

.loading-box {
  background: #ffffff;
  padding: 40px;
  border-radius: 8px;
  text-align: center;
  color: #909399;
  font-size: 15px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.loading-box i {
  font-size: 28px;
}

.article-cards {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.article-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: space-between;
  gap: 20px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.article-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.card-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.badge-top {
  background: #f56c6c;
  color: #ffffff;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.meta-dot {
  color: #dcdfe6;
}

.meta-label {
  background: #f0f2f5;
  color: #606266;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 12px;
}

.article-title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 8px;
  line-height: 1.4;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.article-card:hover .article-title {
  color: #409eff;
}

.article-summary {
  font-size: 14px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-footer {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #909399;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.author-actions {
  display: flex;
  gap: 8px;
}

.btn-delete {
  color: #f56c6c;
}

.card-cover {
  width: 140px;
  height: 95px;
  flex-shrink: 0;
  border-radius: 6px;
  overflow: hidden;
  background: #f5f7fa;
}

.card-cover-img {
  width: 100%;
  height: 100%;
  display: block;
}

.image-slot {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 100%;
  height: 100%;
  background: #f5f7fa;
  color: #c0c4cc;
  font-size: 20px;
}

.pagination-wrapper {
  margin-top: 24px;
  display: flex;
  justify-content: center;
}

.home-sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.sidebar-card {
  background: #ffffff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.sidebar-card .card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid #ebeef5;
}

.sidebar-card .title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 6px;
}

.more-link {
  font-size: 13px;
  color: #409eff;
  text-decoration: none;
}

.tags-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag-pill {
  background: #f5f7fa;
  color: #606266;
  font-size: 13px;
  padding: 4px 10px;
  border-radius: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.tag-pill:hover {
  background: #e4e7ed;
  color: #303133;
}

.tag-pill.active {
  background: #409eff;
  color: #ffffff;
}

.tag-count {
  font-size: 11px;
  opacity: 0.8;
}

.intro-desc {
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
  margin-bottom: 12px;
}

.quick-links {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.quick-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f0f7ff;
  color: #409eff;
  border-radius: 6px;
  font-size: 13px;
  text-decoration: none;
  font-weight: 500;
  transition: background 0.2s;
}

.quick-link:hover {
  background: #d9ecff;
}

@media (max-width: 768px) {
  .home-layout {
    flex-direction: column;
  }

  .home-sidebar {
    width: 100%;
  }

  .article-card {
    flex-direction: column;
  }

  .card-cover {
    width: 100%;
    height: 160px;
  }
}
</style>
