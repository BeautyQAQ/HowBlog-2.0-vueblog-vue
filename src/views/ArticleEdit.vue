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
          <el-form-item label="所属标签 / 专栏" prop="columnid" class="flex-1">
            <el-select
              v-model="form.columnid"
              placeholder="请选择标签"
              style="width: 100%"
              filterable
            >
              <el-option
                v-for="l in labels"
                :key="l.id"
                :label="l.labelname"
                :value="l.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="封面图片地址" prop="image" class="flex-2">
            <el-input
              v-model="form.image"
              placeholder="请输入图片 URL（如 https://...）"
              clearable
            />
          </el-form-item>
        </div>

        <div v-if="form.image" class="cover-preview">
          <span class="preview-label">封面预览：</span>
          <img :src="form.image" alt="封面预览" />
        </div>

        <el-form-item label="文章正文" prop="content">
          <el-input
            type="textarea"
            :rows="14"
            v-model="form.content"
            placeholder="请输入文章正文内容，支持 HTML 或纯文本..."
          />
        </el-form-item>

        <div class="form-switches">
          <el-form-item label="是否公开" prop="ispublic">
            <el-radio-group v-model="form.ispublic">
              <el-radio label="1">公开</el-radio>
              <el-radio label="0">私密</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="是否置顶" prop="istop">
            <el-radio-group v-model="form.istop">
              <el-radio label="1">置顶</el-radio>
              <el-radio label="0">普通</el-radio>
            </el-radio-group>
          </el-form-item>
        </div>

        <div class="form-actions">
          <el-button type="primary" size="medium" :loading="submitting" @click="submitForm">
            {{ isEdit ? '保存修改' : '立即发布' }}
          </el-button>
          <el-button size="medium" @click="$router.push('/')">取消</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script>
import { getArticleById, addArticle, updateArticle } from '@/api/article'
import { getLabelList } from '@/api/label'
import { mapGetters } from 'vuex'

export default {
  name: 'ArticleEdit',
  data() {
    return {
      articleId: this.$route.params.id,
      labels: [],
      loading: false,
      submitting: false,
      form: {
        title: '',
        columnid: '',
        image: '',
        content: '',
        ispublic: '1',
        istop: '0'
      },
      rules: {
        title: [
          { required: true, message: '请输入文章标题', trigger: 'blur' },
          { min: 2, max: 100, message: '标题长度在 2 到 100 个字符', trigger: 'blur' }
        ],
        content: [
          { required: true, message: '请输入文章正文内容', trigger: 'blur' }
        ]
      }
    }
  },
  computed: {
    ...mapGetters(['userId']),
    isEdit() {
      return Boolean(this.articleId)
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
            image: a.image || '',
            content: a.content || '',
            ispublic: a.ispublic || '1',
            istop: a.istop || '0'
          }
        }
      } catch (e) {
        console.error(e)
      } finally {
        this.loading = false
      }
    },
    submitForm() {
      this.$refs.form.validate(async valid => {
        if (!valid) return

        this.submitting = true
        try {
          if (this.isEdit) {
            const res = await updateArticle(this.articleId, {
              ...this.form,
              updatetime: new Date()
            })
            if (res && res.flag) {
              this.$message.success('文章修改成功')
              this.$router.push(`/article/${this.articleId}`)
            }
          } else {
            const res = await addArticle({
              ...this.form,
              userid: this.userId || '10001',
              createtime: new Date(),
              updatetime: new Date(),
              visits: 0,
              thumbup: 0,
              comment: 0,
              state: '1'
            })
            if (res && res.flag) {
              this.$message.success('文章发布成功')
              this.$router.push('/')
            }
          }
        } catch (e) {
          console.error(e)
        } finally {
          this.submitting = false
        }
      })
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
</style>
