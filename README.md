# 9router-web-search

把 dsh 的网页搜索与页面抓取改走本机 **9router** 服务。模型看到的工具、参数与结果格式保持不变。

- 包名 / 入口 id / 设置命名空间：`9router-web-search`
- Provider id：`9router`（搜索）、`9router-fetch`（抓取）
- 当前版本：`1.1.1`
- 适用：dsh `0.2.0-rc.2` 及以上；已在 `0.2.1-rc.2` / `0.2.1-rc.3` 验证

## 功能

- `web_search` → 9router `POST /v1/search`
- `web_fetch` → 9router `POST /v1/web/fetch`
- 只替换 dsh 的网页搜索/抓取 provider；工具的 JSON schema、系统提示词、结果卡片与会话 UI 全部不变
- 设置页可热切换：开启走 9router，关闭走插件内置的等价回退（回退开关关闭时则直接报错）；修改配置无需重启
- 支持失败自动回退：抓取用匿名 HTTP，搜索用 DeepSeek Messages 原生搜索

## 安装

### 从 git 安装（推荐）

```bash
dsh plugin add github:yifabunemgshoushi-oss/dsh-9router-web-search
```

插件自带 `dsh.bundle.patch`，安装时 dsh 会自动：

1. 把插件插入 Loader；
2. 把 `web` 的 `searchProvider` / `fetchProvider` 指向 `9router` / `9router-fetch`。

不需要手动改 profile。安装后**重启一次 dsh**，插件设置页才会出现（设置面板在启动时加载）。

### 更新

0.2.1 起，对已安装包再次安装会返回 `already-installed`。更新步骤：

1. 在插件页移除旧版；
2. 重新执行 `dsh plugin add ...`；
3. 重启 dsh。

### 卸载

在插件页移除即可。本插件的 bundle 与补丁层会一起清理，`web` 回落到 dsh 默认 provider。

> 如果之前手动在 profile 用户层里写过 `web` 的 `searchProvider: 9router`，卸载后请一并删除；否则 `web` 会指向未注册的 provider，搜索/抓取时报 `WEB_PROVIDER_CONFIGURED_MISSING`。

## 快速开始

1. 启动 9router（默认 `http://localhost:20128`），确认搜索/抓取 combo 可用。
2. 打开 **插件 → 9Router 网页搜索**。
3. 填写 API Key，或提前设置 `NINEROUTER_API_KEY` 环境变量。
4. 确认「接口地址」为 9router 的根地址（默认 `http://localhost:20128`，不要带 `/v1`）。
5. 打开「启用 9router 提供方」，保存。
6. 发一次需要联网搜索的请求，或在 9router 日志里确认 `/v1/search`、`/v1/web/fetch` 被调用。

## 配置

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 是否调用 9router。关闭后不再请求 9router，改走插件内置回退（需 `fallbackToBuiltin` 也为开） |
| `baseUrl` | `http://localhost:20128` | 9router 根地址。**不要带 `/v1`**，插件自己拼 `/v1/search`、`/v1/web/fetch` |
| `apiKey` | 空 | 9router API Key。在设置页填写时存入 credentials 域，不写入设置文件 |
| `apiKeyEnv` | `NINEROUTER_API_KEY` | 密钥引用名；`apiKey` 为空时按此名去 credentials / 启动环境变量解析 |
| `searchModel` | `search-combo` | 搜索使用的 9router 模型/路由 |
| `fetchModel` | `fetch-combo` | 抓取使用的 9router 模型/路由 |
| `searchType` | `web` | 传给 `/v1/search` 的 `search_type`：`web` 或 `news` |
| `timeoutMs` | `60000` | 单次搜索或抓取的最长等待时间（毫秒） |
| `fallbackToBuiltin` | `true` | 9router 调用失败时，是否改用内置回退重试 |

### 密钥怎么给

按以下优先级解析，任选一种：

1. **设置页填写 API Key（推荐）**：写入 dsh 的凭据存储（`<DSH_HOME>/.credentials.yaml` 的 `refs`），不落设置文件。
2. **环境变量**：设置 `NINEROUTER_API_KEY`，或把 `apiKeyEnv` 改成你实际使用的变量名。
3. **profile 覆盖 `apiKey`**：高级用法；`config` 是整段替换，必须重述其它字段。

### search_type

- `web`：通用网页索引，默认值。
- `news`：新闻/时效优先。

9router 的搜索接口还支持 `country`、`language`、`time_range`、`offset` 等参数，但 dsh 的 web 接缝只向下传 `query` 与 `maxResults`，因此本插件未暴露这些字段。填入不支持的值不会报错，9router 会静默退回默认。

## 两个开关的区别

| 开关 | 位置 | 作用 |
|---|---|---|
| 「启用 9router 提供方」 | **插件 → 9Router 网页搜索** | 是否调用 9router；关闭后走插件内置回退（如果回退也开） |
| 「启用新版 Web 搜索 API」 | **插件 → 网页搜索**（dsh 内置页） | 切换 `web` 的 provider 到 DeepSeek 官方 Messages / Search API |

**开启本插件时**，插件会自动把 `web` 的 provider 写回 `9router` / `9router-fetch`。因此在内置「网页搜索」页拨动「启用新版 Web 搜索 API」并保存后，开关会自动弹回 OFF——这是预期行为，不是故障。要使用 DeepSeek 官方 Search/Fetch API，请先关闭本插件。

| 本插件开关 | `web` 当前选择 | 实际执行 |
|---|---|---|
| 开 | 任意（插件会自动写回 9router） | 9router；失败且回退开时使用插件内置回退 |
| 关 | `9router` | 插件内置回退（回退开）或直接报错（回退关），不请求 9router |
| 关 | dsh 内置 / 官方 API | 完全由 dsh 内置 provider 执行，插件不参与 |

例外：如果 profile 的其他补丁层强制覆盖了 `web` 行，插件无法改回；日志会提示。

## 回退语义

触发条件：

- `enabled = false` 且 `fallbackToBuiltin = true`；或
- 9router 调用失败且 `fallbackToBuiltin = true`。

| 能力 | 回退实现 |
|---|---|
| 抓取 | 匿名 HTTP GET，按 `content-type` 判定 `html` / `text`；非 2xx 作为正常结果返回 |
| 搜索 | DeepSeek Messages 原生搜索（`web_search_20250305`），需要 `DEEPSEEK_API_KEY`；没有 key 时报 `WEB_PROVIDER_CREDENTIAL_MISSING` |

`enabled = false` 且 `fallbackToBuiltin = false` 时，搜索/抓取直接报错，不会请求 9router。9router 与回退都失败时，错误信息会同时保留两边的失败原因。

## 常见问题

### 保存提示「本部署没有接受这些值，已保留供你修改」

通常是 profile 的 `cordis.patch.yml` 里 `9router-web-search` 出现了两次：一次在 `insert:` 列表，一次是顶层 `- id:` 行。宿主的配置校验会用第一条同 id 行做生效值判断，于是误报：

```text
Configuration for "9router-web-search" is overridden by a home patch or command-line overlay
```

处理：删除 `insert:` 里的那条，保留顶层行（`apiKey` / `enabled` 等实际配置），重启或让 profile 配置重载。不要手动给插件写 `insert:` 行，交给插件管理器。

### 内置「启用新版 Web 搜索 API」开关保存后自己弹回

插件开启时该开关会被自动改回 OFF，见上文「两个开关的区别」。要使用官方 API，先关闭 9router 插件。

### 报 `WEB_PROVIDER_CREDENTIAL_MISSING`

- 9router 搜索/抓取：没找到 9router API Key。检查设置页的 API Key，或 `NINEROUTER_API_KEY` / `apiKeyEnv` 指向的环境变量。
- 回退搜索：没找到 `DEEPSEEK_API_KEY`。

### 报 `WEB_PROVIDER_CONFIGURED_MISSING`

`web` 指向了未注册的 provider。常见原因：

- 插件未加载或已被移除，但 profile 用户层仍保留 `searchProvider: 9router`；
- 给 `web-deepseek-api` 加了 `disabled: true`，而用户层已保存 `searchProvider: deepseek-search-api`。

检查并删掉对应的用户层覆盖，或在插件页重新启用插件。

### 连接失败 / 超时

确认 9router 正在运行、`baseUrl` 端口正确、API Key 有效，并且 9router 的搜索/抓取 combo 本身可用。默认端口是 `20128`。

### 安装后看不到插件设置页

重启一次 dsh。安装时后端会热加载，但设置面板需要重启 dsh 后才会出现。

## 兼容性

- dsh `0.2.0-rc.2` 及以上；已在 `0.2.1-rc.2`、`0.2.1-rc.3` 验证。
- 插件复用 dsh 运行时提供的 `@deepseek-ai/*` 包，不需要自带 `node_modules`。
- 9router 端需提供 `/v1/search` 与 `/v1/web/fetch`。

## 开发

源码结构、link 挂载、实现细节与测试命令见 [DEVELOPMENT.md](DEVELOPMENT.md)。

## License

MIT
