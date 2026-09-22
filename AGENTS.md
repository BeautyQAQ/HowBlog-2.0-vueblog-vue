# HowBlog 2.0 前端项目指南 (AGENTS.md)

本文档面向协作 AI Agent 与开发者，全面说明 HowBlog 2.0 前端工程（`HowBlog-2.0-vueblog-vue`）的架构、约定规范、后端微服务对接协议及常用开发工作流。

---

## 1. 项目定位与技术基线

- **定位**：HowBlog 2.0 博客系统的前端工程，对接 `HowBlog-2.0-Java` 微服务后端。
- **技术栈**：
  - 前端核心：`Vue 2.6.11` + `Vue CLI 4.5.0`
  - 路由与状态：`Vue Router 3.2.0` (HTML5 History 模式) + `Vuex 3.4.0` (LocalStorage 持久化)
  - UI 组件：`Element-UI 2.15.6`
  - 网络通信：`Axios 0.23.0` + 原生 WebSocket（用于即时通讯）

---

## 2. 后端服务拓扑与代理约定

后端为 Spring Boot 2.7 (JDK 21) 多模块微服务架构，包含 3 个核心服务。
前端通过 `vue.config.js` 的 `devServer.proxy` 统一派发请求：

| 服务模块 | 源码模块 | 默认端口 | 代理前缀 | 目标服务路径 | 功能职责 |
| :--- | :--- | :---: | :--- | :--- | :--- |
| **标签服务** | `how_base` | `9001` | `/api/label` | `/label` | 标签增删改查、推荐状态管理 |
| **文章服务** | `how_article` | `9004` | `/api/article` | `/article` | 文章增删改查、条件分页检索 |
| **评论服务** | `how_article` | `9004` | `/api/comment` | `/comment` | 评论增删改查、文章评论列表、点赞 |
| **用户服务** | `how_user` | `9008` | `/api/user` | `/user` | 用户登录认证（`/user/login`） |
| **即时通讯** | `how_user` | `9008` | `/im` | `/im` (WS) | WebSocket 聊天室与点对点私聊 |

### 代理规则定义 (`vue.config.js`)
```javascript
module.exports = {
  devServer: {
    port: 8080,
    open: false,
    proxy: {
      '/api/label': {
        target: 'http://localhost:9001',
        pathRewrite: { '^/api/label': '/label' },
        changeOrigin: true
      },
      '/api/article': {
        target: 'http://localhost:9004',
        pathRewrite: { '^/api/article': '/article' },
        changeOrigin: true
      },
      '/api/comment': {
        target: 'http://localhost:9004',
        pathRewrite: { '^/api/comment': '/comment' },
        changeOrigin: true
      },
      '/api/user': {
        target: 'http://localhost:9008',
        pathRewrite: { '^/api/user': '/user' },
        changeOrigin: true
      },
      '/im': {
        target: 'http://localhost:9008',
        ws: true,
        changeOrigin: true
      }
    }
  }
}
```

---

## 3. 目录组织与架构约定

```text
HowBlog-2.0-vueblog-vue/
├── public/                    # 静态模板资源
├── src/
│   ├── api/                   # API 模块划分 (article.js, comment.js, label.js, user.js)
│   ├── assets/                # 图片、通用样式与静态文件
│   ├── components/            # 全局复用组件 (Header.vue 等)
│   ├── router/                # 路由定义与全局导航守卫 (index.js)
│   ├── store/                 # Vuex 状态与用户会话持久化 (index.js)
│   ├── utils/                 # 通用工具函数与 Axios 拦截器封装 (request.js)
│   ├── views/                 # 页面视图组件
│   │   ├── Home.vue           # 首页：文章列表、标签筛选、搜索与分页
│   │   ├── ArticleDetail.vue  # 文章详情页：全文渲染、评论列表与点赞互动
│   │   ├── ArticleEdit.vue    # 文章发布与编辑页
│   │   ├── LabelManage.vue    # 标签库管理页
│   │   ├── Login.vue          # 用户登录页
│   │   └── Chat.vue           # WebSocket 在线即时通讯聊天室
│   ├── App.vue                # 根组件与主布局
│   └── main.js                # 前端入口文件
├── vue.config.js              # 开发服务器与多服务代理配置
├── package.json               # 项目依赖与 npm scripts
├── README.md                  # 项目说明
└── AGENTS.md                  # 本开发与协作指南
```

---

## 4. 关键接口与数据契约规范

### 4.1 统一返回体结构 (`Result`)
```typescript
interface Result<T = any> {
  flag: boolean;      // 业务操作成功与否
  code: number;       // 状态码：20000(成功), 20001(通用失败), 20002(登录失败), 20004(重复点赞/错误)
  message: string;    // 提示信息
  data: T;            // 业务承载数据
}
```

### 4.2 分页返回结构 (`PageResult`)
```typescript
interface PageResult<T = any> {
  total: number;      // 总条数
  rows: T[];          // 记录列表
}
```

### 4.3 Axios 封装与错误处理原则 (`src/utils/request.js`)
- `baseURL` 设置为 `/api`，自动由 DevServer 转发到对应后端端口。
- 请求拦截器：若用户已登录，注入 `X-User-Id` 请求头。
- 响应拦截器：
  - 判断 `res.flag === true`（或 `res.code === 20000`）时解包返回数据。
  - `res.flag === false` 时自动触发 Element UI 的 `Message.error(res.message)`，并返回 `Promise.reject`。
  - HTTP 网络层异常统一友好捕获，避免未捕获异常导致界面挂起。

### 4.4 WebSocket IM 通讯协议 (`src/views/Chat.vue`)
- 连接端点：`ws://<host>/im?user=<username>`
- 消息格式：JSON 字符串
  - **加入房间**：`{ type: "join", room: "lobby" }`
  - **心跳保活**：`{ type: "ping" }` -> 后端返回 `{ type: "pong" }`
  - **发送消息**：
    - 群聊：`{ type: "message", room: "lobby", content: "..." }`
    - 私聊：`{ type: "message", to: "targetUser", content: "..." }`
  - **接收事件**：
    - 上下线通知：`{ type: "presence", event: "online" | "offline", user: "..." }`
    - 消息到达：`{ type: "message", from: "...", to?: "...", room?: "...", content: "...", timestamp: "..." }`

---

## 5. 开发常用命令与操作指南

```bash
# 1. 安装项目依赖 (推荐使用 npmmirror)
npm install --registry=https://registry.npmmirror.com --legacy-peer-deps

# 2. 启动前端开发调试服务器 (运行于 http://localhost:8080)
npm run serve

# 3. 生产打包构建
npm run build
```

---

## 6. 后续扩展与编码准则

1. **接口修改**：新增接口请按服务模块归类至 `src/api/` 下对应文件，路径均以 `/label`、`/article`、`/comment`、`/user` 为前缀（Axios 会自动前置 `/api`）。
2. **图片容错**：所有涉及图片渲染的组件（如封面、头像）建议使用 `<el-image>` 并配置 `slot="error"` 和 `slot="placeholder"`，保证在弱网或外链失效时优雅降级。
3. **响应式设计**：确保页面在桌面端（>= 1200px）与移动端/小屏（<= 768px）下均能正常自适应展示。
4. **权限守卫**：需登录访问的路由务必在 `src/router/index.js` 中配置 `meta: { requiresAuth: true }`。
