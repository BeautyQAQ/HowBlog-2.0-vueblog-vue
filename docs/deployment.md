# 前端发布与回滚

本目录的配置用于构建前端静态资源，并通过同一 Nginx 入口提供页面、REST API 和 WebSocket。它不创建数据库、不执行迁移、不启动后端服务。本轮只准备可发布配置；尚无正式服务器，未执行正式部署。

## 构建与启动

目标主机需提供 Docker Engine 和 Compose 插件，以及已经完成配置和目标库核对的三个后端服务。先在前端仓库根目录复制配置：

```bash
cp .env.example .env.local
```

Windows PowerShell 可使用 `Copy-Item .env.example .env.local`。`.env.local` 已被 Git 和镜像构建忽略。按目标环境填写：

| 变量 | 用途 |
| --- | --- |
| `HOW_WEB_IMAGE` | 本次镜像标签，发布时使用唯一版本，例如 `howblog-web:release-20261029`；保留上一版本镜像 |
| `HOW_WEB_BIND_ADDRESS` | 默认 `127.0.0.1`，供同主机可信 HTTPS 入口访问 |
| `HOW_WEB_PORT` | 宿主机前端端口，默认 `8080` |
| `HOW_BASE_UPSTREAM` | 标签服务 origin，默认 `http://host.docker.internal:9001` |
| `HOW_ARTICLE_UPSTREAM` | 文章/评论服务 origin，默认 `http://host.docker.internal:9004` |
| `HOW_USER_UPSTREAM` | 用户及 WebSocket 服务 origin，默认 `http://host.docker.internal:9008` |

上游仅支持可信私网内的 `http://` origin，不能含账号密码、路径、查询参数或末尾 `/`；入口脚本会拒绝不符合格式的值。默认值连接 Docker 宿主机上已发布的后端端口；后端位于其他私有主机时按实际修改。配置中不需要数据库密码或 JWT 密钥。不要把开发服务器的 `vue.config.js` 代理当作正式入口。

```bash
docker compose --env-file .env.local config --quiet
docker compose --env-file .env.local build
docker compose --env-file .env.local up -d --no-build
docker compose --env-file .env.local ps
```

构建阶段执行锁定依赖安装、`npm test` 和 `npm run build`；运行镜像只包含 Nginx 和静态资源。容器通过 `/healthz` 检测入口是否存活，该端点不代表后端或数据库健康。

如果前后端位于同一 Docker 主机，也可以接入后端现有网络，避免经过宿主机发布端口。在 `.env.local` 填入实际存在的 `HOW_BACKEND_NETWORK`，然后使用以下命令。此模式使用后端 Compose 的 `how-base`、`how-article`、`how-user` 服务名；外部网络必须已存在。

```bash
docker compose --env-file .env.local -f docker-compose.yml -f docker/compose.backend-network.yml config --quiet
docker compose --env-file .env.local -f docker-compose.yml -f docker/compose.backend-network.yml up -d --build
```

之后的查看、更新和回滚命令也要保留相同的两个 `-f` 参数。该配置不会创建或重启后端、MySQL、Redis。

## 正式入口与验证

对外服务需在可信入口配置域名、有效证书及 HTTPS/WSS。当前 Nginx 容器监听 HTTP 8080，适合放在该入口之后；若入口位于另一个容器网络，需要调整绑定/网络访问方式，限制非可信来源直连。入口应保留 `Host`、转发 `/im` 的 Upgrade/Connection 头，并禁止记录含 token 的查询参数。前端与入口同源，REST 使用 `/api`，聊天自动按页面协议选择 WSS。

容器覆盖外部转发来源头；后端默认按连接来源限流。在可信代理来源解析单独配置并验证前，代理后的用户可能共享来源 IP 额度。后端端口应限制在私有网络内；三个服务的共同 JWT 密钥、Redis 和迁移状态仍按后端运维文档核对。

访问日志省略查询参数；`/im` 的错误上下文日志也被关闭，避免失败握手泄露 URL 中的 token。其他路径仍保留错误日志。外层入口同样需要处理查询参数日志，不能仅依赖容器中的设置。

发布前后至少验证：

1. `/healthz` 返回 `200`；直接打开并刷新 `/login`、`/article/<真实ID>` 等路由能加载页面，未知 `/api/...` 返回 `404`，不存在的 JS/CSS 返回 `404`。
2. 经正式入口读取标签、文章、评论；登录、刷新、退出，以及作者/普通用户写入权限符合 revision 23。手机号、密码、令牌不进入代理日志。
3. 总数超过一页时首页能翻页；“我的文章”退出或切换用户后立即清除上一身份的草稿/私密摘要，延迟请求不能恢复旧内容。
4. `/im` 能通过正式域名建立 WSS 连接；令牌轮换、退出和重连符合后端契约。

前端仓库未包含后端数据库升级动作；已有目标库是否完成迁移须独立核对，不能用新库初始化脚本代替升级。本轮前端修改不改变 API 契约，revision 保持 `23`。

## 回滚

发布前记录当前镜像标签及上游配置，保留上一版镜像。需要回滚时将 `.env.local` 的 `HOW_WEB_IMAGE` 改回已有旧标签，再运行：

```bash
docker compose --env-file .env.local up -d --no-build --pull never
docker compose --env-file .env.local ps
```

随后重跑页面、API 和 WSS 烟测。回滚只替换前端；后端版本必须继续满足该前端的契约。不要清理数据库卷或回滚密码验证器，也不要在前端发布流程中执行数据库 DDL。

## 可重复的本机入口验收

`npm test` 覆盖组件和接口回归；真实 Nginx 路由测试单独启用。安装或解压官方 Nginx 到仓库外，指定其可执行文件后运行：

```bash
HOW_NGINX_BIN=/path/to/nginx npm run test:production
```

PowerShell：

```powershell
$env:HOW_NGINX_BIN = 'C:\path\to\nginx.exe'
npm run test:production
```

该验收只启动本机回环地址的临时 Nginx 和模拟上游，不访问真实 MySQL/Redis，结束后关闭进程。它验证 URI/查询参数/认证头、写入响应、History 回退、静态资源、WebSocket 和日志中的 token 保护；不能替代目标服务器的容器构建、证书和真实后端验收。CI 另执行 Compose 校验、镜像构建和容器内 `nginx -t`。
