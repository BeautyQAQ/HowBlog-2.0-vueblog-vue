<template>
  <div class="label-manage-container" v-loading="loading">
    <el-card shadow="never" class="label-card">
      <div slot="header" class="card-header">
        <span class="title"><i class="el-icon-collection-tag"></i> 标签库管理</span>
        <el-button
          type="primary"
          size="small"
          icon="el-icon-plus"
          @click="openAddDialog"
        >
          添加标签
        </el-button>
      </div>

      <el-table :data="labels" stripe style="width: 100%">
        <el-table-column prop="id" label="ID" width="100" />
        <el-table-column prop="labelname" label="标签名称" min-width="150">
          <template slot-scope="{ row }">
            <el-tag size="small">{{ row.labelname }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="count" label="使用次数" width="120" sortable />
        <el-table-column prop="fans" label="关注人数" width="120" sortable />
        <el-table-column prop="recommend" label="是否推荐" width="120">
          <template slot-scope="{ row }">
            <el-tag
              :type="row.recommend === '1' ? 'success' : 'info'"
              size="mini"
            >
              {{ row.recommend === '1' ? '推荐' : '普通' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" align="center">
          <template slot-scope="{ row }">
            <el-button
              type="text"
              size="mini"
              icon="el-icon-edit"
              @click="openEditDialog(row)"
            >
              编辑
            </el-button>
            <el-button
              type="text"
              size="mini"
              icon="el-icon-delete"
              style="color: #f56c6c"
              @click="confirmDelete(row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 添加 / 编辑标签对话框 -->
    <el-dialog
      :title="isEdit ? '编辑标签' : '添加标签'"
      :visible.sync="dialogVisible"
      width="480px"
    >
      <el-form ref="form" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="标签名称" prop="labelname">
          <el-input v-model="form.labelname" placeholder="请输入标签名称" />
        </el-form-item>
        <el-form-item label="是否推荐" prop="recommend">
          <el-switch
            v-model="form.recommend"
            active-value="1"
            inactive-value="0"
            active-text="推荐"
            inactive-text="普通"
          />
        </el-form-item>
        <el-form-item label="状态" prop="state">
          <el-radio-group v-model="form.state">
            <el-radio label="1">正常</el-radio>
            <el-radio label="0">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <span slot="footer" class="dialog-footer">
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitDialog">确定</el-button>
      </span>
    </el-dialog>
  </div>
</template>

<script>
import { getLabelList, addLabel, updateLabel, deleteLabel } from '@/api/label'

export default {
  name: 'LabelManage',
  data() {
    return {
      labels: [],
      loading: false,
      dialogVisible: false,
      isEdit: false,
      submitting: false,
      currentId: null,
      form: {
        labelname: '',
        recommend: '1',
        state: '1'
      },
      rules: {
        labelname: [
          { required: true, whitespace: true, message: '请输入标签名称', trigger: 'blur' },
          { min: 1, max: 30, message: '长度在 1 到 30 个字符', trigger: 'blur' }
        ]
      }
    }
  },
  created() {
    this.fetchLabels()
  },
  methods: {
    async fetchLabels() {
      this.loading = true
      try {
        const res = await getLabelList()
        if (res && res.flag && Array.isArray(res.data)) {
          this.labels = res.data
        }
      } catch (e) {
        console.error(e)
      } finally {
        this.loading = false
      }
    },
    openAddDialog() {
      this.isEdit = false
      this.currentId = null
      this.form = {
        labelname: '',
        recommend: '1',
        state: '1'
      }
      this.dialogVisible = true
    },
    openEditDialog(row) {
      this.isEdit = true
      this.currentId = row.id
      this.form = {
        labelname: row.labelname || '',
        recommend: row.recommend || '0',
        state: row.state || '1'
      }
      this.dialogVisible = true
    },
    submitDialog() {
      this.$refs.form.validate(async valid => {
        if (!valid) return
        this.submitting = true
        try {
          if (this.isEdit) {
            const res = await updateLabel(this.currentId, this.form)
            if (res && res.flag) {
              this.$message.success('标签修改成功')
              this.dialogVisible = false
              this.fetchLabels()
            }
          } else {
            const res = await addLabel({
              ...this.form,
              count: 0,
              fans: 0
            })
            if (res && res.flag) {
              this.$message.success('标签添加成功')
              this.dialogVisible = false
              this.fetchLabels()
            }
          }
        } catch (e) {
          console.error(e)
        } finally {
          this.submitting = false
        }
      })
    },
    confirmDelete(id) {
      this.$confirm('确定要删除该标签吗？', '提示', {
        type: 'warning'
      }).then(async () => {
        try {
          const res = await deleteLabel(id)
          if (res && res.flag) {
            this.$message.success('标签已删除')
            this.fetchLabels()
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
.label-manage-container {
  max-width: 960px;
  margin: 0 auto;
}

.label-card {
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
</style>
