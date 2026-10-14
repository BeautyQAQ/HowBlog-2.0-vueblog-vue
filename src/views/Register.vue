<template>
  <div class="register-container">
    <el-card class="register-card" shadow="hover">
      <div class="register-header">
        <div class="brand">
          <i class="el-icon-reading brand-icon"></i>
          <span class="brand-title">HowBlog</span>
          <span class="brand-badge">2.0</span>
        </div>
        <p class="subtitle">注册 HowBlog 账号</p>
      </div>

      <el-form ref="form" :model="form" :rules="rules" class="register-form">
        <el-form-item prop="mobile">
          <el-input
            v-model.trim="form.mobile"
            placeholder="手机号（11 位，以 1 开头）"
            prefix-icon="el-icon-mobile-phone"
            maxlength="11"
            clearable
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="密码（8~64 个字符）"
            prefix-icon="el-icon-lock"
            show-password
          />
        </el-form-item>

        <el-form-item prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            placeholder="确认密码"
            prefix-icon="el-icon-lock"
            show-password
            @keyup.enter.native="handleRegister"
          />
        </el-form-item>

        <el-form-item prop="nickname">
          <el-input
            v-model="form.nickname"
            placeholder="昵称（可选，最长 100 字）"
            prefix-icon="el-icon-user"
            maxlength="100"
            clearable
          />
        </el-form-item>

        <el-alert
          v-if="duplicateMobile"
          class="duplicate-alert"
          type="warning"
          :closable="false"
          show-icon
          title="该手机号已注册"
        >
          <div class="duplicate-actions">
            <el-button type="text" @click="$router.push('/login')">直接登录</el-button>
            <el-button type="text" @click="duplicateMobile = false">换个手机号</el-button>
          </div>
        </el-alert>

        <el-button
          type="primary"
          class="submit-btn"
          :loading="loading"
          @click="handleRegister"
        >
          注 册
        </el-button>

        <div class="login-link">
          已有账号？
          <router-link to="/login">立即登录</router-link>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { register } from '@/api/user'

export default {
  name: 'Register',
  data() {
    return {
      loading: false,
      duplicateMobile: false,
      form: {
        mobile: '',
        password: '',
        confirmPassword: '',
        nickname: ''
      },
      rules: {
        mobile: [
          { required: true, whitespace: true, message: '请输入手机号', trigger: 'blur' },
          { pattern: /^1\d{10}$/, message: '手机号须为 11 位数字且以 1 开头', trigger: 'blur' }
        ],
        password: [
          { required: true, message: '请输入密码', trigger: 'blur' },
          { min: 8, max: 64, message: '密码长度须为 8 到 64 个字符', trigger: 'blur' },
          {
            validator: (rule, value, callback) => {
              if (value && !String(value).trim()) {
                callback(new Error('密码不能为纯空白'))
                return
              }
              callback()
            },
            trigger: 'blur'
          }
        ],
        confirmPassword: [
          { required: true, message: '请再次输入密码', trigger: 'blur' },
          {
            validator: (rule, value, callback) => {
              if (value !== this.form.password) {
                callback(new Error('两次输入的密码不一致'))
                return
              }
              callback()
            },
            trigger: 'blur'
          }
        ],
        nickname: [
          { max: 100, message: '昵称最长 100 个字符', trigger: 'blur' }
        ]
      }
    }
  },
  watch: {
    'form.mobile'() {
      this.duplicateMobile = false
    }
  },
  methods: {
    handleRegister() {
      return this.$refs.form.validate(async valid => {
        if (!valid) return

        this.loading = true
        this.duplicateMobile = false
        try {
          const res = await register(this.form)
          if (res && res.flag) {
            this.$message.success('注册成功，正在为你登录')
            try {
              const user = await this.$store.dispatch('login', {
                mobile: this.form.mobile,
                password: this.form.password
              })
              if (user) {
                this.$router.push(this.$route.query.redirect || '/').catch(() => {})
                return
              }
            } catch (e) {
              console.error(e)
            }
            this.$router.push({ path: '/login', query: { mobile: this.form.mobile } }).catch(() => {})
          }
        } catch (e) {
          if (e && e.code === 20005) {
            this.duplicateMobile = true
          }
        } finally {
          this.loading = false
        }
      })
    }
  }
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: calc(100vh - 160px);
  padding: 40px 20px;
}

.register-card {
  width: 100%;
  max-width: 420px;
  border-radius: 12px;
  padding: 20px;
}

.register-header {
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

.duplicate-alert {
  margin-bottom: 18px;
}

.duplicate-actions {
  margin-top: 4px;
}

.submit-btn {
  width: 100%;
  font-size: 15px;
  letter-spacing: 2px;
  margin-top: 10px;
}

.login-link {
  margin-top: 14px;
  text-align: center;
  font-size: 13px;
  color: #909399;
}

.login-link a {
  color: #409eff;
  text-decoration: none;
  font-weight: 500;
}
</style>
