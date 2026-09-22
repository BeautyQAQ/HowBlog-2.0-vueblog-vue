# HowBlog 2.0 - 前端工程 (vueblog_vue)

HowBlog 2.0 博客系统的前端工程，基于 Vue 2 全家桶与 Element-UI 搭建，采用响应式布局与模块化设计，提供文章浏览、分类检索、文章管理、评论互动以及 WebSocket 即时通讯等功能。

本项目对应后端工程为开源项目：[BeautyQAQ/HowBlog-2.0-Java](https://github.com/BeautyQAQ/HowBlog-2.0-Java)。前端接口实现与联调规范严格遵循后端微服务接口契约。

---

## 技术栈

- **前端框架**：Vue 2.6.11
- **脚手架**：Vue CLI 4.5.0
- **路由管理**：Vue Router 3.2.0 (History 模式)
- **状态管理**：Vuex 3.4.0 (含 LocalStorage 持久化)
- **UI 组件库**：Element-UI 2.15.6
- **网络请求**：Axios 0.23.0 + qs 6.10.1
- **即时通讯**：原生 WebSocket 客户端对接后端 Spring WebSocket 服务

---

## 关联后端架构与服务端口

后端采用 Spring Boot 2.7 (JDK 21) 多模块微服务架构，主要服务及开发环境默认地址如下：

| 服务模块 | 默认 Base URL | 默认端口 | 职责与主要功能 |
| :--- | :--- | :---: | :--- |
| **基础服务** (`how_base`) | `http://localhost:9001` | 9001 | 标签（Label）增删改查与推荐管理 |
| **文章服务** (`how_article`) | `http://localhost:9004` | 9004 | 文章管理、条件分页检索、文章评论与点赞 |
| **用户服务** (`how_user`) | `http://localhost:9008` | 9008 | 用户认证登录、轻量级 WebSocket 即时通讯 |

---

## 前后端接口约定与代理规则

当前已对齐后端契约 **4.0.0 / revision 6**，同步状态见 [backend-api-sync.json](backend-api-sync.json)。后续先读取同级后端工程 `docs/frontend-api-status.json`，再核对 changelog 和当前契约。该版本以当前契约为准，旧版项目指南中的 `X-User-Id` 和 `/im?user=` 已失效。

登录仅提交 `mobile`、`password`；保存响应中的 `token` 和 `expiresIn`，后续请求使用 `Authorization: Bearer <token>`。旧版无 token 缓存、到期会话及 HTTP 401 会清理登录态，受保护页面返回登录页。HTTP 200 的业务码 `20003` 仅提示权限不足，不清理会话。当前没有刷新或服务端退出登录接口，退出只清理本地会话。

标签管理页面、文章写入、评论写入和点赞、聊天室需要登录。标签写操作额外要求数据库 `ADMIN` 角色，登录成功不代表有管理权限；登录响应不提供角色，前端不猜测权限、不提交角色字段，HTTP 403 仅展示权限错误且保留会话。管理员授权及认证表迁移由运维完成，没有默认管理员。文章和评论的身份由 token 确定；评论仅作者本人可删除。WebSocket 使用 `/im?token=<编码后的令牌>`，消息身份与私聊目标均为用户 ID。部署时应使用 HTTPS/WSS，并避免代理日志记录含 token 的查询参数。

统一错误处理展示 HTTP 400/404/500 返回的业务消息；文章标题/正文、标签名和评论正文不允许纯空白。服务端分页 API 限制页码为正整数、每页 1 到 100 条；首页保留本地分页和关键词筛选，不将其误映射为后端精确匹配搜索。

1. **统一返回体格式** (`Result`)：
   ```json
   {
     "flag": true,
     "code": 20000,
     "message": "操作成功",
     "data": {}
   }
   ```
   - 前端优先通过 `flag === true` 判断业务操作成功，配合 `code` 及 `message` 进行弹窗提示或逻辑分流。
   - 常用状态码：`20000`（成功）、`20001`（通用失败）、`20002`（手机号或密码错误）、`20003`（未认证或权限不足）、`20004`（远程调用失败 / 重复点赞）、`20005`（重复操作）。

2. **核心业务路径与代理映射** (`vue.config.js`)：
   - `/api/label` -> 转发至 `http://localhost:9001/label`
   - `/api/article` -> 转发至 `http://localhost:9004/article`
   - `/api/comment` -> 转发至 `http://localhost:9004/comment`
   - `/api/user` -> 转发至 `http://localhost:9008/user`
   - `/im` -> 转发至 `ws://localhost:9008/im` (WebSocket 即时通讯)

---

## 目录结构

```text
HowBlog-2.0-vueblog-vue/
├── public/                    # 静态资源与 HTML 模板
├── src/
│   ├── api/                   # API 请求模块封装
│   │   ├── article.js         # 文章相关接口
│   │   ├── comment.js         # 评论与点赞接口
│   │   ├── label.js           # 标签相关接口
│   │   └── user.js            # 用户登录接口
│   ├── assets/                # 静态图片与全局样式
│   ├── components/            # 公共通用组件
│   │   └── Header.vue         # 顶部导航栏 (Logo、搜索、写文章、用户信息)
│   ├── router/                # 路由配置与权限守卫 (Vue Router)
│   │   └── index.js
│   ├── store/                 # 状态管理 (Vuex 用户会话与持久化)
│   │   └── index.js
│   ├── utils/                 # 工具函数与网络层封装
│   │   └── request.js         # Axios 实例、请求拦截与统一错误响应
│   ├── views/                 # 核心页面视图
│   │   ├── Home.vue           # 首页：文章列表、标签筛选、搜索与分页
│   │   ├── ArticleDetail.vue  # 文章详情：全文排版、评论列表、发表与点赞
│   │   ├── ArticleEdit.vue    # 文章发布与编辑页面
│   │   ├── LabelManage.vue    # 标签库管理页面
│   │   ├── Login.vue          # 用户登录页面 (含测试账号快捷填入)
│   │   └── Chat.vue           # WebSocket 在线即时通讯聊天室
│   ├── App.vue                # 根组件与主布局
│   └── main.js                # 入口文件
├── vue.config.js              # 开发服务器代理与 Webpack 配置
├── package.json               # 项目依赖与运行脚本
├── README.md                  # 项目说明文档
└── AGENTS.md                  # 协作 Agent 与开发者指引
```

---

## 本地开发与运行

### 1. 安装依赖

```bash
npm install --registry=https://registry.npmmirror.com --legacy-peer-deps
```

### 2. 启动开发服务器

```bash
npm run serve
```

启动后在浏览器访问：`http://localhost:8080/`。

### 3. 生产打包构建

```bash
npm run build
```

打包产物位于 `dist/` 目录。

### 4. 契约回归检查

```bash
npm test
```

检查 JWT 会话、错误响应（含 403 保留登录态）、分页边界、表单空白校验、评论权限及 WebSocket URL/身份。该检查使用隔离依赖，不替代真实后端 MySQL/Redis 联调。

2026-09-22 验收：后端 `git pull --ff-only` 确认为最新代码，Maven/JDK 21 全模块构建通过（93 项测试，0 失败，0 错误，1 跳过）。9001/9004/9008 已启动，通过前端代理完成 8 项真实 REST 检查：标签/文章/文章评论查询、文章不存在 404、非法分页 400、匿名文章/标签写入 401、登录缺参 20002；浏览器首页展示真实数据，匿名 WebSocket 握手被拒绝。

用户确认该环境为可写测试库后，已完成真实写入与浏览器验收：

- 两个测试账号登录成功；文章/评论创建、查询、编辑、删除及非作者拒绝通过，请求中的伪造作者字段不会改变服务端身份。
- MySQL/Redis 点赞通过：首次点赞、同一用户重复拒绝、另一用户独立点赞均符合契约。
- 使用随机临时账号验证普通用户 403、数据库 ADMIN 授权后标签增删改、空白/负数校验、缺失标签 404；撤销角色后同一 token 立即返回 403，没有给现有账号提权。
- 双用户 WebSocket 身份、心跳、房间消息和私聊通过；浏览器登录进入聊天页、发送消息及本人样式回显通过。
- 浏览器文章发布/编辑/删除、评论提交/点赞/重复点赞提示/删除通过；纯空白表单不发送请求，普通用户标签写入提示权限不足且保留登录态。
- 本次创建的文章、评论、标签、临时账号和角色已清理，三个测试点赞去重键已精确删除；未执行数据库迁移或批量修改。测试账号成功登录可能按后端既定逻辑将存量明文密码升级为 BCrypt。

验收发现后端删除评论不会自动清理对应 Redis 点赞去重键，本轮已单独清理测试键；未扩大范围修改后端业务逻辑。本次服务使用仅进程内的临时共同 JWT 密钥，并关闭自动建表和 SQL 初始化；重启需重新配置共同密钥。
