<template>
  <div class="article-edit-container" v-loading="loading">
    <el-card class="edit-card" shadow="never">
      <div slot="header" class="card-header">
        <span class="title">
          <i :class="isEdit ? 'el-icon-edit-outline' : 'el-icon-document-add'"></i>
          {{ isEdit ? '编辑文章' : '写文章' }}
        </span>
        <el-button size="small" icon="el-icon-back" @click="$router.back()">返回</el-button>
      </div>

      <el-form
        ref="form"
        :model="form"
        :rules="rules"
        label-position="top"
        class="article-form"
      >
        <el-form-item label="文章标题" prop="title">
          <el-input
            v-model="form.title"
            placeholder="请输入标题（2~100字）"
            maxlength="100"
            show-word-limit
          />
        </el-form-item>

        <div class="form-row">
          <el-form-item label="所属专栏 ID" prop="columnid" class="flex-1">
            <el-input
              v-model="form.columnid"
              placeholder="可选"
              clearable
            />
          </el-form-item>

          <el-form-item label="文章标签" prop="labelIds" class="flex-2">
            <el-select
              v-model="form.labelIds"
              placeholder="可选择多个标签"
              style="width: 100%"
              filterable
              multiple
              collapse-tags
            >
              <el-option
                v-for="l in labels"
                :key="l.id"
                :label="l.labelname"
                :value="l.id"
              />
            </el-select>
          </el-form-item>
        </div>

        <el-form-item label="封面图片地址" prop="image">
          <el-input
            v-model="form.image"
            placeholder="请输入图片 URL（如 https://...）"
            clearable
          />
        </el-form-item>

        <div v-if="form.image" class="cover-preview">
          <span class="preview-label">封面预览：</span>
          <img :src="form.image" alt="封面预览" />
        </div>

        <el-form-item label="文章正文" prop="content">
          <el-input
            type="textarea"
            :rows="14"
            v-model="form.content"
            placeholder="请输入文章正文，支持换行；HTML 标签会按文字显示"
          />
        </el-form-item>

        <div class="form-switches">
          <el-form-item label="是否公开" prop="ispublic">
            <el-radio-group v-model="form.ispublic">
              <el-radio label="1">公开</el-radio>
              <el-radio label="0">私密</el-radio>
            </el-radio-group>
          </el-form-item>

        </div>

        <div class="form-actions">
          <el-button type="primary" size="medium" :loading="submitting" @click="submitForm">
            {{ isEdit ? '保存修改' : '保存草稿' }}
          </el-button>
          <el-button size="medium" @click="$router.push('/')">取消</el-button>
        </div>

        <div v-if="isEdit" class="lifecycle-actions">
          <span class="state-hint">当前状态：{{ stateText }}</span>
          <el-button
            v-if="articleState === '0'"
            type="success"
            size="small"
            :loading="submitting"
            @click="transitionArticle('publish')"
          >
            直接发布
          </el-button>
          <el-button
            v-if="articleState === '0'"
            type="warning"
            size="small"
            :loading="submitting"
            @click="transitionArticle('submit')"
          >
            提交审核
          </el-button>
          <el-button
            v-if="articleState === '1'"
            type="warning"
            size="small"
            :loading="submitting"
            @click="transitionArticle('unpublish')"
          >
            下架
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { getArticleById, addArticle, updateArticle, publishArticle, unpublishArticle, submitArticle } from '@/api/article'
import { getLabelList } from '@/api/label'

export default {
  name: 'ArticleEdit',
  data() {
    return {
      articleId: this.$route.params.id,
      labels: [],
      loading: false,
      submitting: false,
      articleState: null,
      form: {
        title: '',
        columnid: '',
        labelIds: [],
        image: '',
        content: '',
        ispublic: '1'
      },
      rules: {
        title: [
          { required: true, whitespace: true, message: '请输入文章标题', trigger: 'blur' },
          { min: 2, max: 100, message: '标题长度在 2 到 100 个字符', trigger: 'blur' }
        ],
        content: [
          { required: true, whitespace: true, message: '请输入文章正文内容', trigger: 'blur' }
        ]
      }
    }
  },
  computed: {
    isEdit() {
      return Boolean(this.articleId)
    },
    stateText() {
      return {
        '0': '草稿',
        '1': '已发布',
        '2': '待审核'
      }[this.articleState] || '未知'
    }
  },
  created() {
    this.fetchLabels()
    if (this.isEdit) {
      this.fetchArticle()
    }
  },
  methods: {
    async fetchLabels() {
      try {
        const res = await getLabelList()
        if (res && res.flag && Array.isArray(res.data)) {
          this.labels = res.data
        }
      } catch (e) {
        console.error(e)
      }
    },
    async fetchArticle() {
      this.loading = true
      try {
        const res = await getArticleById(this.articleId)
        if (res && res.flag && res.data) {
          const a = res.data
          this.form = {
            title: a.title || '',
            columnid: a.columnid || '',
            labelIds: Array.isArray(a.labelIds) ? [...a.labelIds] : [],
            image: a.image || '',
            content: a.content || '',
            ispublic: a.ispublic || '1'
          }
          this.articleState = String(a.state == null ? '0' : a.state)
        }
      } catch (e) {
        console.error(e)
      } finally {
        this.loading = false
      }
    },
    validateForm() {
      return new Promise(resolve => {
        this.$refs.form.validate(valid => resolve(valid))
      })
    },
    async submitForm() {
      if (!await this.validateForm()) return

      this.submitting = true
      try {
        const res = this.isEdit
          ? await updateArticle(this.articleId, { ...this.form })
          : await addArticle({ ...this.form })
        if (res && res.flag) {
          this.$message.success(this.isEdit ? '文章修改成功' : '草稿已保存')
          if (this.isEdit) {
            this.$router.push(`/article/${this.articleId}`)
          } else {
            this.$router.push({ path: '/', query: { mine: '1' } })
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        this.submitting = false
      }
    },
    async transitionArticle(action) {
      if (!this.isEdit || !await this.validateForm()) return

      this.submitting = true
      try {
        const saved = await updateArticle(this.articleId, { ...this.form })
        if (!saved || !saved.flag) return

        const transitions = {
          publish: publishArticle,
          unpublish: unpublishArticle,
          submit: submitArticle
        }
        const res = await transitions[action](this.articleId)
        if (res && res.flag) {
          this.articleState = action === 'publish' ? '1' : action === 'submit' ? '2' : '0'
          this.$message.success(res.message || '文章状态已更新')
        }
      } catch (e) {
        console.error(e)
      } finally {
        this.submitting = false
      }
    }
  }
}
</script>

<style scoped>
.article-edit-container {
  max-width: 960px;
  margin: 0 auto;
}

.edit-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header .title {
  font-size: 18px;
  font-weight: 600;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 8px;
}

.form-row {
  display: flex;
  gap: 20px;
}

.flex-1 {
  flex: 1;
}

.flex-2 {
  flex: 2;
}

.cover-preview {
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.preview-label {
  font-size: 13px;
  color: #909399;
}

.cover-preview img {
  height: 80px;
  border-radius: 6px;
  border: 1px solid #ebeef5;
  object-fit: cover;
}

.form-switches {
  display: flex;
  gap: 40px;
  margin-bottom: 10px;
}

.form-actions {
  display: flex;
  gap: 16px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.lifecycle-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.state-hint {
  color: #606266;
  font-size: 13px;
  margin-right: auto;
}
</style>
