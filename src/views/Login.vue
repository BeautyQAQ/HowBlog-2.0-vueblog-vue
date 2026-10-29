<template>
  <div class="login-container">
    <el-card class="login-card" shadow="hover">
      <div class="login-header">
        <div class="brand">
          <i class="el-icon-reading brand-icon"></i>
          <span class="brand-title">HowBlog</span>
          <span class="brand-badge">2.0</span>
        </div>
        <p class="subtitle">欢迎登录微服务技术博客平台</p>
      </div>

      <el-form ref="form" :model="form" :rules="rules" class="login-form">
        <el-form-item prop="mobile">
          <el-input
            v-model.trim="form.mobile"
            placeholder="手机号"
            prefix-icon="el-icon-mobile-phone"
            clearable
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码"
            prefix-icon="el-icon-lock"
            show-password
            @keyup.enter.native="handleLogin"
          />
        </el-form-item>

        <el-button
          type="primary"
          class="submit-btn"
          :loading="loading"
          @click="handleLogin"
        >
          登 录
        </el-button>

        <div class="register-link">
          还没有账号？
          <router-link to="/register">立即注册</router-link>
        </div>

      </el-form>
    </el-card>
  </div>
</template>

<script>
export default {
  name: 'Login',
  data() {
    return {
      loading: false,
      form: {
        mobile: '',
        password: ''
      },
      rules: {
        mobile: [
          { required: true, whitespace: true, message: '请输入手机号', trigger: 'blur' }
        ],
        password: [
          { required: true, message: '请输入登录密码', trigger: 'blur' }
        ]
      }
    }
  },
  created() {
    const mobile = this.$route && this.$route.query ? this.$route.query.mobile : ''
    if (typeof mobile === 'string' && /^1\d{10}$/.test(mobile)) {
      this.form.mobile = mobile
    }
  },
  methods: {
    handleLogin() {
      this.$refs.form.validate(async valid => {
        if (!valid) return

        this.loading = true
        try {
          const user = await this.$store.dispatch('login', this.form)
          if (user) {
            this.$message.success(`欢迎回来，${user.nickname || user.mobile}！`)
            const redirect = this.$route.query.redirect || '/'
            this.$router.push(redirect)
          }
        } catch (e) {
          console.error(e)
        } finally {
          this.loading = false
        }
      })
    }
  }
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 160px);
  padding: 40px 20px;
}

.login-card {
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  padding: 20px;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.brand {
  display: inline-flex;
  align-items: center;
  font-size: 24px;
  font-weight: 700;
  color: #303133;
}

.brand-icon {
  font-size: 30px;
  color: #409eff;
  margin-right: 8px;
}

.brand-badge {
  font-size: 11px;
  font-weight: 600;
  color: #ffffff;
  background: #409eff;
  padding: 2px 6px;
  border-radius: 10px;
  margin-left: 6px;
}

.subtitle {
  font-size: 13px;
  color: #909399;
  margin-top: 8px;
}

.submit-btn {
  width: 100%;
  font-size: 15px;
  letter-spacing: 2px;
  margin-top: 10px;
}

.register-link {
  margin-top: 14px;
  text-align: center;
  font-size: 13px;
  color: #909399;
}

.register-link a {
  color: #409eff;
  text-decoration: none;
  font-weight: 500;
}
</style>
