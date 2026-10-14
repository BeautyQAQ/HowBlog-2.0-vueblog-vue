<template>
  <div v-loading="loading" class="profile-container">
    <el-card shadow="never" class="profile-card">
      <div slot="header" class="card-header">
        <span class="title"><i class="el-icon-user"></i> 个人中心</span>
      </div>

      <el-tabs v-model="activeTab">
        <el-tab-pane label="基本资料" name="profile">
          <div class="readonly-grid">
            <div class="readonly-item">
              <span class="readonly-label">用户 ID</span>
              <span class="readonly-value">{{ profile.id || '-' }}</span>
            </div>
            <div class="readonly-item">
              <span class="readonly-label">手机号</span>
              <span class="readonly-value">{{ profile.mobile || '-' }}</span>
            </div>
            <div class="readonly-item">
              <span class="readonly-label">注册时间</span>
              <span class="readonly-value">{{ formatDate(profile.regdate) }}</span>
            </div>
            <div class="readonly-item">
              <span class="readonly-label">粉丝 / 关注</span>
              <span class="readonly-value">{{ profile.fanscount || 0 }} / {{ profile.followcount || 0 }}</span>
            </div>
          </div>

          <el-form
            ref="profileForm"
            :model="form"
            :rules="profileRules"
            label-position="top"
            class="profile-form"
          >
            <div class="form-row">
              <el-form-item label="昵称" prop="nickname" class="flex-1">
                <el-input
                  v-model="form.nickname"
                  maxlength="100"
                  show-word-limit
                  placeholder="最长 100 个字符"
                />
              </el-form-item>
              <el-form-item label="性别" prop="sex" class="flex-1">
                <el-select v-model="form.sex" placeholder="未设置" style="width: 100%">
                  <el-option label="男" value="男" />
                  <el-option label="女" value="女" />
                  <el-option label="保密" value="保密" />
                </el-select>
              </el-form-item>
            </div>

            <div class="form-row">
              <el-form-item label="生日" prop="birthday" class="flex-1">
                <el-date-picker
                  v-model="form.birthday"
                  type="date"
                  value-format="timestamp"
                  placeholder="选择生日"
                  style="width: 100%"
                />
              </el-form-item>
              <el-form-item label="邮箱" prop="email" class="flex-1">
                <el-input
                  v-model="form.email"
                  maxlength="255"
                  placeholder="example@howblog.com"
                />
              </el-form-item>
            </div>

            <el-form-item label="头像地址" prop="avatar">
              <el-input
                v-model="form.avatar"
                maxlength="500"
                placeholder="请输入图片 URL"
                clearable
              />
            </el-form-item>

            <div v-if="form.avatar" class="avatar-preview">
              <span class="preview-label">头像预览：</span>
              <el-image :src="form.avatar" fit="cover" class="preview-image">
                <div slot="error" class="image-fallback"><i class="el-icon-picture-outline"></i></div>
                <div slot="placeholder" class="image-fallback">加载中…</div>
              </el-image>
            </div>

            <el-form-item label="兴趣" prop="interest">
              <el-input
                v-model="form.interest"
                maxlength="500"
                show-word-limit
                placeholder="如：技术写作, 架构设计"
              />
            </el-form-item>

            <el-form-item label="个性签名" prop="personality">
              <el-input
                v-model="form.personality"
                type="textarea"
                :rows="3"
                maxlength="500"
                show-word-limit
                placeholder="介绍一下自己…"
              />
            </el-form-item>

            <div class="form-actions">
              <el-button type="primary" :loading="saving" @click="handleSaveProfile">
                保存修改
              </el-button>
              <el-button :disabled="saving" @click="loadProfile">重置</el-button>
            </div>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="修改密码" name="password">
          <el-alert
            class="password-hint"
            type="info"
            :closable="false"
            show-icon
            title="修改成功后，其他设备上的登录会话将立即失效并需要重新登录；当前设备无需重新登录。"
          />
          <el-form
            ref="passwordForm"
            :model="passwordForm"
            :rules="passwordRules"
            label-position="top"
            class="password-form"
          >
            <el-form-item label="旧密码" prop="oldPassword">
              <el-input
                v-model="passwordForm.oldPassword"
                type="password"
                show-password
                placeholder="请输入当前密码"
              />
            </el-form-item>
            <el-form-item label="新密码" prop="newPassword">
              <el-input
                v-model="passwordForm.newPassword"
                type="password"
                show-password
                placeholder="8~64 个字符"
              />
            </el-form-item>
            <el-form-item label="确认新密码" prop="confirmPassword">
              <el-input
                v-model="passwordForm.confirmPassword"
                type="password"
                show-password
                placeholder="再次输入新密码"
                @keyup.enter.native="handleChangePassword"
              />
            </el-form-item>
            <div class="form-actions">
              <el-button type="primary" :loading="changingPassword" @click="handleChangePassword">
                修改密码
              </el-button>
            </div>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script>
import { getProfile, updateProfile, changePassword } from '@/api/user'

const fieldLabels = {
  nickname: '昵称',
  avatar: '头像地址',
  sex: '性别',
  email: '邮箱',
  interest: '兴趣',
  personality: '个性签名',
  birthday: '生日'
}

function notBlank(rule, value, callback) {
  if (typeof value === 'string' && value.length > 0 && !value.trim()) {
    callback(new Error('不能为纯空白'))
    return
  }
  callback()
}

export default {
  name: 'Profile',
  data() {
    return {
      loading: false,
      saving: false,
      changingPassword: false,
      activeTab: this.$route.query.tab === 'password' ? 'password' : 'profile',
      profile: {},
      form: {
        nickname: '',
        sex: '',
        birthday: null,
        email: '',
        avatar: '',
        interest: '',
        personality: ''
      },
      passwordForm: {
        oldPassword: '',
        newPassword: '',
        confirmPassword: ''
      },
      profileRules: {
        nickname: [{ max: 100, message: '昵称最长 100 个字符', trigger: 'blur' }],
        email: [{ type: 'email', message: '请输入正确的邮箱地址', trigger: ['blur', 'change'] }],
        avatar: [{ max: 500, message: '头像地址最长 500 个字符', trigger: 'blur' }],
        interest: [{ max: 500, message: '兴趣最长 500 个字符', trigger: 'blur' }],
        personality: [{ max: 500, message: '个性签名最长 500 个字符', trigger: 'blur' }]
      },
      passwordRules: {
        oldPassword: [{ required: true, message: '请输入当前密码', trigger: 'blur' }],
        newPassword: [
          { required: true, message: '请输入新密码', trigger: 'blur' },
          { min: 8, max: 64, message: '新密码长度须为 8 到 64 个字符', trigger: 'blur' },
          { validator: notBlank, trigger: 'blur' }
        ],
        confirmPassword: [
          { required: true, message: '请再次输入新密码', trigger: 'blur' },
          {
            validator: (rule, value, callback) => {
              if (value !== this.passwordForm.newPassword) {
                callback(new Error('两次输入的新密码不一致'))
                return
              }
              callback()
            },
            trigger: 'blur'
          }
        ]
      }
    }
  },
  created() {
    this.loadProfile()
  },
  methods: {
    applyProfile(data) {
      this.profile = data
      this.form = {
        nickname: data.nickname || '',
        sex: data.sex || '',
        birthday: data.birthday ? new Date(data.birthday).getTime() : null,
        email: data.email || '',
        avatar: data.avatar || '',
        interest: data.interest || '',
        personality: data.personality || ''
      }
    },
    async loadProfile() {
      this.loading = true
      try {
        const res = await getProfile()
        if (res && res.flag && res.data) {
          this.applyProfile(res.data)
        }
      } catch (e) {
        console.error(e)
      } finally {
        this.loading = false
      }
    },
    buildPayload() {
      const payload = {}
      for (const field of ['nickname', 'avatar', 'sex', 'email', 'interest', 'personality']) {
        const value = String(this.form[field] == null ? '' : this.form[field]).trim()
        const original = String(this.profile[field] == null ? '' : this.profile[field]).trim()
        if (value === original) continue
        if (!value) {
          return { error: `「${fieldLabels[field]}」不支持清空，请填写新值或恢复原内容` }
        }
        payload[field] = value
      }
      const birthday = this.form.birthday ? new Date(this.form.birthday).getTime() : null
      const originalBirthday = this.profile.birthday ? new Date(this.profile.birthday).getTime() : null
      if (birthday !== originalBirthday) {
        if (!birthday) {
          return { error: '「生日」不支持清空，请重新选择日期' }
        }
        payload.birthday = birthday
      }
      return { payload }
    },
    handleSaveProfile() {
      return this.$refs.profileForm.validate(async valid => {
        if (!valid) return

        const { payload, error } = this.buildPayload()
        if (error) {
          this.$message.warning(error)
          return
        }
        if (!Object.keys(payload).length) {
          this.$message.info('没有需要保存的修改')
          return
        }

        this.saving = true
        try {
          const res = await updateProfile(payload)
          if (res && res.flag && res.data) {
            this.applyProfile(res.data)
            this.$store.commit('PATCH_USER', {
              nickname: res.data.nickname || '',
              avatar: res.data.avatar || ''
            })
            this.$message.success('资料修改成功')
          }
        } catch (e) {
          console.error(e)
        } finally {
          this.saving = false
        }
      })
    },
    handleChangePassword() {
      return this.$refs.passwordForm.validate(async valid => {
        if (!valid) return

        this.changingPassword = true
        try {
          const res = await changePassword(this.passwordForm)
          if (res && res.flag) {
            this.$message.success('密码修改成功，其他设备需要重新登录')
            this.passwordForm.oldPassword = ''
            this.passwordForm.newPassword = ''
            this.passwordForm.confirmPassword = ''
            this.$refs.passwordForm.clearValidate()
          }
        } catch (e) {
          console.error(e)
        } finally {
          this.changingPassword = false
        }
      })
    },
    formatDate(value) {
      if (!value) return '-'
      const date = new Date(value)
      if (Number.isNaN(date.getTime())) return '-'
      const pad = number => String(number).padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }
  }
}
</script>

<style scoped>
.profile-container {
  max-width: 960px;
  margin: 0 auto;
}

.profile-card {
  border-radius: 8px;
}

.card-header .title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.readonly-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.readonly-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.readonly-label {
  font-size: 12px;
  color: #909399;
}

.readonly-value {
  font-size: 14px;
  color: #303133;
  font-weight: 500;
}

.form-row {
  display: flex;
  gap: 20px;
}

.flex-1 {
  flex: 1;
}

.avatar-preview {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-label {
  font-size: 13px;
  color: #909399;
}

.preview-image {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 1px solid #ebeef5;
  overflow: hidden;
}

.image-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c0c4cc;
  font-size: 12px;
  background: #f5f7fa;
}

.form-actions {
  display: flex;
  gap: 16px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.password-hint {
  margin-bottom: 20px;
}

.password-form {
  max-width: 480px;
}
</style>
