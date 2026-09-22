<template>
  <div class="chat-container">
    <div class="chat-layout">
      <!-- 左侧：在线用户与会话列表 -->
      <aside class="chat-sidebar">
        <div class="sidebar-header">
          <div class="my-status">
            <span class="status-indicator online"></span>
            <span class="my-name">{{ nickname || currentUsername }}</span>
            <span class="my-tag">我</span>
          </div>
        </div>

        <div class="conversation-tabs">
          <div
            class="tab-item"
            :class="{ active: currentTarget === null }"
            @click="selectTarget(null)"
          >
            <i class="el-icon-chat-line-round"></i>
            <span>公共大厅 (Lobby)</span>
          </div>
        </div>

        <div class="online-users-section">
          <div class="section-label">
            在线用户 ({{ onlineUsers.length }})
          </div>
          <div class="user-list">
            <div
              v-for="u in onlineUsers"
              :key="u"
              class="user-item"
              :class="{ active: currentTarget === u }"
              @click="selectTarget(u)"
            >
              <span class="status-dot"></span>
              <span class="user-item-name">{{ u }}</span>
            </div>
            <div v-if="onlineUsers.length === 0" class="no-users">
              暂无其他用户在线
            </div>
          </div>
        </div>
      </aside>

      <!-- 右侧：聊天主界面 -->
      <main class="chat-main">
        <!-- 聊天头部 -->
        <div class="chat-header">
          <div class="header-info">
            <h3 class="target-title">
              {{ currentTarget ? `与 ${currentTarget} 私聊` : '公共大厅聊天室' }}
            </h3>
            <span class="target-status">
              {{ wsConnected ? '已连接' : connectionStatus }}
            </span>
          </div>
        </div>

        <!-- 消息视窗 -->
        <div class="messages-viewport" ref="messageBox">
          <div
            v-for="(msg, idx) in currentMessages"
            :key="idx"
            class="message-row"
            :class="{ 'is-me': msg.from === currentUsername }"
          >
            <div class="message-avatar">
              <el-avatar
                :size="34"
                :src="msg.from === currentUsername ? avatar : 'https://cube.elemecdn.com/3/7c/3ea6beec64369c2642b92c6726f1epng.png'"
              />
            </div>
            <div class="message-content-wrapper">
              <div class="message-info">
                <span class="message-sender">{{ msg.from }}</span>
                <span class="message-time">{{ formatTime(msg.timestamp) }}</span>
              </div>
              <div class="message-bubble">
                {{ msg.content }}
              </div>
            </div>
          </div>

          <div v-if="currentMessages.length === 0" class="empty-messages">
            暂无消息，发送一条消息开启对话吧~
          </div>
        </div>

        <!-- 底部输入框 -->
        <div class="chat-input-area">
          <el-input
            type="textarea"
            :rows="3"
            v-model="inputContent"
            placeholder="输入消息，按 Enter 发送，Shift + Enter 换行..."
            @keydown.enter.exact.prevent="sendMessage"
          />
          <div class="input-actions">
            <span class="hint">Enter 发送 / Shift + Enter 换行</span>
            <el-button
              type="primary"
              size="small"
              icon="el-icon-s-promotion"
              :disabled="!wsConnected || !inputContent.trim()"
              @click="sendMessage"
            >
              发送
            </el-button>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'Chat',
  data() {
    return {
      ws: null,
      wsConnected: false,
      onlineUsers: [],
      messages: [],
      currentTarget: null, // null 表示大厅群聊，string 为私聊用户名
      inputContent: '',
      pingTimer: null,
      reconnectTimer: null,
      expiryTimer: null,
      connectionAttempt: 0,
      connectionStatus: '正在连接...',
      connectionUserId: ''
    }
  },
  computed: {
    ...mapGetters(['nickname', 'userId', 'isLoggedIn', 'avatar', 'token']),
    currentUsername() {
      return this.connectionUserId || this.userId
    },
    currentMessages() {
      if (this.currentTarget === null) {
        // 大厅消息（room === 'lobby' 或没有 to）
        return this.messages.filter(m => !m.to || m.room === 'lobby')
      }
      // 与 currentTarget 的私聊（from 或 to 包含 currentTarget）
      return this.messages.filter(m =>
        (m.from === this.currentTarget && m.to === this.currentUsername) ||
        (m.from === this.currentUsername && m.to === this.currentTarget)
      )
    }
  },
  watch: {
    token() {
      if (this.isLoggedIn) this.connectWebSocket()
      else this.closeWebSocket()
    }
  },
  mounted() {
    this.connectWebSocket()
  },
  beforeDestroy() {
    this.closeWebSocket()
  },
  methods: {
    async connectWebSocket() {
      this.closeWebSocket()
      const attempt = this.connectionAttempt
      this.connectionStatus = '正在连接...'
      try {
        await this.$store.dispatch('ensureSession')
      } catch (error) {
        this.connectionStatus = '登录已失效，请重新登录'
        return
      }
      if (attempt !== this.connectionAttempt) return
      const user = this.$store.state.user
      if (!user || !user.token || !(user.expiresAt > Date.now())) {
        this.connectionStatus = '登录已失效，请重新登录'
        return
      }
      this.onlineUsers = []
      this.connectionUserId = ''
      this.expiryTimer = setTimeout(() => {
        this.connectWebSocket()
      }, Math.min(user.expiresAt - Date.now(), 2147483647))
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const host = window.location.host
      const wsUrl = `${protocol}//${host}/im?token=${encodeURIComponent(user.token)}`

      this.ws = new WebSocket(wsUrl)

      this.ws.onopen = () => {
        this.wsConnected = true
        // 加入大厅
        this.sendRaw({ type: 'join', room: 'lobby' })
        // 开启心跳
        this.pingTimer = setInterval(() => {
          this.sendRaw({ type: 'ping' })
        }, 25000)
      }

      this.ws.onmessage = event => {
        try {
          const data = JSON.parse(event.data)
          this.handleIncomingMessage(data)
        } catch (e) {
          console.error('Failed to parse WS message:', e)
        }
      }

      this.ws.onclose = async event => {
        this.wsConnected = false
        clearInterval(this.pingTimer)
        clearTimeout(this.expiryTimer)
        if (event.code === 1000) {
          this.connectionStatus = '连接已关闭，可能已在其他页面连接'
          return
        }
        if (event.code === 1008) {
          this.connectionStatus = '正在验证会话...'
          try {
            await this.$store.dispatch('ensureSession', { force: true, token: user.token })
          } catch (error) {
            this.connectionStatus = '登录已失效，请重新登录'
            return
          }
          if (attempt === this.connectionAttempt) this.connectWebSocket()
          return
        }
        this.connectionStatus = event.code === 1011 ? '服务暂不可用，正在重连...' : '连接断开，正在重连...'
        this.reconnectTimer = setTimeout(() => {
          this.connectWebSocket()
        }, 5000)
      }

      this.ws.onerror = () => {
        this.wsConnected = false
      }
    },
    closeWebSocket() {
      this.connectionAttempt++
      clearInterval(this.pingTimer)
      clearTimeout(this.reconnectTimer)
      clearTimeout(this.expiryTimer)
      if (this.ws) {
        this.ws.onclose = null
        this.ws.onopen = null
        this.ws.onmessage = null
        this.ws.onerror = null
        this.ws.close()
        this.ws = null
      }
      this.wsConnected = false
    },
    sendRaw(payload) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(payload))
      }
    },
    handleIncomingMessage(data) {
      if (data.type === 'ready') {
        this.connectionUserId = data.user
      } else if (data.type === 'presence') {
        const { event, user } = data
        if (user && user !== this.currentUsername) {
          if (event === 'online') {
            if (!this.onlineUsers.includes(user)) {
              this.onlineUsers.push(user)
            }
          } else if (event === 'offline') {
            this.onlineUsers = this.onlineUsers.filter(u => u !== user)
            if (this.currentTarget === user) {
              this.currentTarget = null
            }
          }
        }
      } else if (data.type === 'message') {
        this.messages.push({
          from: data.from,
          to: data.to || null,
          room: data.room || null,
          content: data.content,
          timestamp: data.timestamp || new Date().toISOString()
        })
        this.scrollToBottom()
      } else if (data.type === 'error') {
        this.$message.error(data.message || '即时通讯服务异常')
      }
    },
    sendMessage() {
      if (!this.$store.state.user || !(this.$store.state.user.expiresAt > Date.now())) {
        this.connectWebSocket()
        return
      }
      if (!this.wsConnected) return
      const content = this.inputContent.trim()
      if (!content) return

      const payload = {
        type: 'message',
        content
      }

      if (this.currentTarget) {
        payload.to = this.currentTarget
      } else {
        payload.room = 'lobby'
      }

      this.sendRaw(payload)
      this.inputContent = ''
    },
    selectTarget(target) {
      this.currentTarget = target
      this.scrollToBottom()
    },
    scrollToBottom() {
      this.$nextTick(() => {
        const box = this.$refs.messageBox
        if (box) {
          box.scrollTop = box.scrollHeight
        }
      })
    },
    formatTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      if (isNaN(d.getTime())) return ''
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      return `${h}:${m}`
    }
  }
}
</script>

<style scoped>
.chat-container {
  height: calc(100vh - 120px);
  max-width: 1100px;
  margin: 0 auto;
}

.chat-layout {
  height: 100%;
  display: flex;
  background: #ffffff;
  border-radius: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  overflow: hidden;
}

.chat-sidebar {
  width: 260px;
  border-right: 1px solid #ebeef5;
  background: #fafafa;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #ebeef5;
}

.my-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #67c23a;
}

.my-name {
  font-weight: 600;
  font-size: 14px;
  color: #303133;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.my-tag {
  font-size: 11px;
  color: #409eff;
  background: #ecf5ff;
  padding: 1px 5px;
  border-radius: 4px;
}

.conversation-tabs {
  padding: 12px;
  border-bottom: 1px solid #ebeef5;
}

.tab-item {
  padding: 10px 14px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-item:hover {
  background: #f0f2f5;
}

.tab-item.active {
  background: #409eff;
  color: #ffffff;
}

.online-users-section {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.section-label {
  font-size: 12px;
  color: #909399;
  font-weight: 600;
  margin-bottom: 8px;
  padding-left: 6px;
}

.user-item {
  padding: 8px 12px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  margin-bottom: 4px;
  transition: all 0.2s;
}

.user-item:hover {
  background: #f0f2f5;
}

.user-item.active {
  background: #e6f1fc;
  color: #409eff;
  font-weight: 600;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #67c23a;
}

.no-users {
  font-size: 12px;
  color: #c0c4cc;
  padding: 12px;
  text-align: center;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.chat-header {
  padding: 16px 20px;
  border-bottom: 1px solid #ebeef5;
}

.target-title {
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.target-status {
  font-size: 12px;
  color: #67c23a;
}

.messages-viewport {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.message-row {
  display: flex;
  gap: 10px;
  max-width: 75%;
}

.message-row.is-me {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-content-wrapper {
  display: flex;
  flex-direction: column;
}

.message-row.is-me .message-content-wrapper {
  align-items: flex-end;
}

.message-info {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
  color: #909399;
}

.message-bubble {
  background: #f4f4f5;
  color: #303133;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  word-break: break-word;
}

.message-row.is-me .message-bubble {
  background: #409eff;
  color: #ffffff;
}

.empty-messages {
  margin: auto;
  color: #909399;
  font-size: 13px;
}

.chat-input-area {
  padding: 16px 20px;
  border-top: 1px solid #ebeef5;
  background: #ffffff;
}

.input-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
}

.hint {
  font-size: 12px;
  color: #c0c4cc;
}
</style>
