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
   - 常用状态码：`20000`（成功）、`20001`（通用失败）、`20002`（用户名密码错误）、`20004`（远程调用失败 / 重复点赞）、`20005`（重复操作）。

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
