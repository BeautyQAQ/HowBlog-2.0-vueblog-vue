<template>
  <header class="app-header">
    <div class="header-container">
      <div class="header-left">
        <router-link to="/" class="logo">
          <i class="el-icon-reading logo-icon"></i>
          <span class="logo-title">HowBlog</span>
          <span class="logo-badge">2.0</span>
        </router-link>
        <nav class="nav-links">
          <router-link to="/" exact class="nav-item">首页</router-link>
          <router-link to="/labels" class="nav-item">标签库</router-link>
          <router-link to="/chat" class="nav-item">
            <i class="el-icon-chat-dot-round"></i> 在线聊天
          </router-link>
        </nav>
      </div>

      <div class="header-right">
        <el-input
          v-model="keyword"
          placeholder="搜索文章..."
          prefix-icon="el-icon-search"
          size="small"
          class="search-input"
          @keyup.enter.native="handleSearch"
          clearable
        />

        <el-button
          type="primary"
          size="small"
          icon="el-icon-edit"
          round
          class="write-btn"
          @click="handleWrite"
        >
          写文章
        </el-button>

        <template v-if="isLoggedIn">
          <el-dropdown trigger="click" @command="handleCommand">
            <div class="user-profile">
              <el-avatar :size="32" :src="avatar" class="user-avatar" />
              <span class="user-name">{{ nickname }}</span>
              <i class="el-icon-arrow-down"></i>
            </div>
            <el-dropdown-menu slot="dropdown">
              <el-dropdown-item disabled>
                <div class="dropdown-user-info">
                  <span class="info-label">用户 ID:</span> {{ userId }}
                </div>
              </el-dropdown-item>
              <el-dropdown-item divided command="logout" icon="el-icon-switch-button">
                退出登录
              </el-dropdown-item>
            </el-dropdown-menu>
          </el-dropdown>
        </template>
        <template v-else>
          <el-button size="small" type="text" @click="$router.push('/login')">
            登录
          </el-button>
        </template>
      </div>
    </div>
  </header>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'AppHeader',
  data() {
    return {
      keyword: ''
    }
  },
  computed: {
    ...mapGetters(['isLoggedIn', 'userId', 'nickname', 'avatar'])
  },
  methods: {
    handleSearch() {
      const q = this.keyword.trim()
      this.$router.push({ path: '/', query: { search: q } }).catch(() => {})
    },
    handleWrite() {
      if (!this.isLoggedIn) {
        this.$message.warning('请先登录后再发表文章')
        this.$router.push({ path: '/login', query: { redirect: '/article/create' } })
        return
      }
      this.$router.push('/article/create')
    },
    handleCommand(cmd) {
      if (cmd === 'logout') {
        this.$store.dispatch('logout')
        this.$message.success('已退出登录')
        if (this.$route.meta.requiresAuth) {
          this.$router.push('/')
        }
      }
    }
  }
}
</script>

<style scoped>
.app-header {
  background: #ffffff;
  border-bottom: 1px solid #ebeef5;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.header-container {
  max-width: 1200px;
  margin: 0 auto;
  height: 60px;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 30px;
}

.logo {
  display: flex;
  align-items: center;
  text-decoration: none;
  color: #303133;
  font-weight: 700;
  font-size: 20px;
}

.logo-icon {
  font-size: 24px;
  color: #409eff;
  margin-right: 8px;
}

.logo-title {
  letter-spacing: -0.5px;
}

.logo-badge {
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  background: #409eff;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 6px;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 16px;
}

.nav-item {
  color: #606266;
  text-decoration: none;
  font-size: 15px;
  font-weight: 500;
  padding: 6px 12px;
  border-radius: 4px;
  transition: all 0.2s;
}

.nav-item:hover {
  color: #409eff;
  background: #f0f7ff;
}

.nav-item.router-link-exact-active {
  color: #409eff;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.search-input {
  width: 200px;
}

.write-btn {
  font-weight: 500;
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 20px;
  transition: background 0.2s;
}

.user-profile:hover {
  background: #f5f7fa;
}

.user-name {
  font-size: 14px;
  color: #303133;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dropdown-user-info {
  font-size: 12px;
  color: #909399;
}

.info-label {
  font-weight: 600;
}
</style>
