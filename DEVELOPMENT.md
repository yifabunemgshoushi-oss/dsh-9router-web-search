# 9router-web-search 开发与实现说明

面向维护者。安装、配置与常见问题见 [README.md](README.md)。

## 源码与开发环境

- 源码目录：`D:\other\dsh-plugins\dsh-9router-web-search`
- 包名：`9router-web-search`。目录上的 `dsh-` 前缀只是本地存放约定，不参与解析；profile 按依赖键建软链，所以依赖键必须写包名。
- 本地开发可在 profile 的 `package.json` 里加一条 link 依赖，再跑 `pnpm install` 生成软链：

  ```json
  "9router-web-search": "link:D:/other/dsh-plugins/dsh-9router-web-search"
  ```

- 改完源码需要重启 dsh。HMR 不会监听 `node_modules` 里的实体副本。
- 桌面 profile 目前用 git 依赖，`profiles/desktop/node_modules/9router-web-search` 是安装出来的实体副本；`pnpm install` 或插件页更新会覆盖本地同步的改动。长期开发建议改 `link:`，并清掉 git 安装时期留下的 profile 手写条目，否则同一 id 会有两份定义。

## 依赖

- 直接 import 的 4 个包，`package.json` 同时声明 peer 与 dev：
  - `@deepseek-ai/dsh-credentials`
  - `@deepseek-ai/dsh-launch-environment`
  - `@deepseek-ai/dsh-web`
  - `@deepseek-ai/schemastery`
- peer 让 profile 解析器使用运行中 dsh 安装里的那一份，即使插件目录下没有物理 `node_modules` 也成立。
- **必须共用同一实例**：`lib/index.js` 用 `error instanceof WebError` 判定错误，两侧各自复制一份会让该判定静默失效。
- 其余传递依赖（`cordis`、`cosmokit`、`dsh-brand`、`dsh-llm`、`zod` 等）由宿主安装闭包提供。
- `node_modules/` 与 `temp-dsh/` 已加入 `.gitignore`。

升级 dsh 后若出现模块缺失或 API 不存在，核对两个不变量：① peer 声明的每个包名仍在宿主安装闭包中；② 插件直接 import 的每个包名都已声明 peer。

## 设计

### Provider 替换与常驻注册

`apply` 注册两个 provider（`9router` / `9router-fetch`），`cordis.patch.yml` 把 `web` 接缝的 provider 指向它们。只替换 `ctx.web` 的 provider 层，工具的 JSON schema、系统提示词、结果卡片与会话 UI 全部不变。

为什么用“常驻注册 + `enabled` 开关”而不是“卸载即回退”：`ctx.web` 的选择策略是“显式配置的 id 优先”。插件卸载后 provider 不再注册，`web` 若仍指向 `9router` 会报 `WEB_PROVIDER_CONFIGURED_MISSING`，而不是回退。因此两个 provider 常驻注册，由 `enabled` 在**执行路径**上切换，开关可热回退，无需重启。

### 内置回退：抓取

匿名 HTTP(S) GET，按 `content-type` 判定 `html` / `text`；非 2xx 作为正常结果返回而不是抛错。

安全限制：拒绝本机与私有网段的字面量主机名（含 `169.254.0.0/16` 元数据地址）。只覆盖字面量主机名，dsh 内置的 `dsh-web-fetch-http` 还会做 DNS 解析后固定地址；本回退未实现该层，因此 DNS rebinding 仍不可防。

响应体上限为 5 MB，正文上限为 100k 字符，超出截断。

### 内置回退：搜索

等价的 DeepSeek 原生搜索：Anthropic 兼容 Messages + `web_search_20250305`，显式发送 `thinking: { type: 'disabled' }`（与 0.2.1 内置搜索一致）。需要 `DEEPSEEK_API_KEY`；取不到时如实报 `WEB_PROVIDER_CREDENTIAL_MISSING`。

结果映射：取 `web_search_tool_result` 块里的 `web_search_result`，摘要从 text 块的 `citations[].cited_text` 按 url 关联；没有结果块时抛 `WEB_PROVIDER_ERROR`。

回退自身也失败时，错误消息同时保留主路径（9router）的失败原因。

### 客户端设置面板

`lib/client.js` 只 require `react` 与 `react/jsx-runtime`。设置页用到的控件（开关、取值字段、密钥字段、表单外壳、`SettingsFormModel` 表单内核）都在文件内的 `#region lib/client/ui-port.js` 里自带实现，样式经 `mountStyles()` 注入。

- **为什么不用 `@deepseek-ai/dsh-client-ui-primitives`**：官方实践禁止客户端插件 require 任何 Harness Client 包。该包 API 不受 semver 约束、手写 JS 也无类型检查；一旦不兼容，失败形态是整个 slot 条目空白，而不是可降级的错误。自带实现后只依赖 `react` 与 `--dsw-*` token。
- **类名与样式**：统一 `dsh-9rws-` 前缀，避免与宿主样式冲突；颜色只用 `--dsw-*` 主题 token；原 CSS Modules 已内联为 `CSS_TEXT`。
- **`SettingsFormModel` 的差异**：原实现依赖 `@deepseek-ai/dsh-client-store` 的 `createSnapshotStore`；自带版用等价的小实现替代，保留暂存编辑、保存、修订栅栏、`base`/`user` 分层与 overridden 判定。

### Provider 选择守卫（1.1.1）

0.2.1 起，内置「网页搜索」页会把 `web.searchProvider` / `web.fetchProvider` 写入 profile 用户层，优先级高于插件 bundle 层。`enabled = true` 时，`installWebSelectionGuard` 订阅 `settings/document-updated`，用 `settings.describe()` 读生效值，不是 `9router` 就用 `settings.update('web', …)` 写回。写回值与 bundle 层一致时，settings 会删除用户层覆盖，所以内置开关保存后会弹回 OFF。

**HMR 事务问题**：`settings/document-updated` 是在 `configEditor.edit()` 的 `hmr.runExclusive()` 事务内派发的。`runExclusive` 用 `AsyncLocalStorage` 标记事务，该标记会沿 `queueMicrotask` / `setTimeout` / `await` 传播。直接在事件回调（或微任务/延时重试）里调 `settings.update()` 会得到 `HMR transactions cannot be nested`，写回被静默拒绝，内置开关看起来不生效。

修复：在模块首次加载（宿主启动阶段，事务之外）创建常驻 `MessagePort`，把写回任务 post 过去；端口回调在创建时的空上下文里运行，`settings.update()` 于是重新进入 `hmr.runExclusive()` 的排队逻辑，而不是被判为嵌套。写入用 `writing` / `dirty` 串行化并合并事件；锁超时、重载中等瞬时失败按 50 ms 起指数退避，最多 8 次；成功后复查。

边界：

- `web` 行被 home patch 或命令行 overlay 覆盖时，`configEditor.edit` 会拒绝写入，守卫只能记录警告。
- 若插件代码经 HMR 在事务内重新导入，新端口会继承事务标记；日志会记录无法写回，重启 dsh 即可恢复。

## 兼容性核对

已对照 dsh `0.2.1-rc.2` 与 `0.2.1-rc.3`。本轮涉及的宿主包（`dsh-web`、`dsh-settings`、`dsh-config-editor`、`dsh-client-ui-settings-web-search`）在 rc.2 → rc.3 之间只有版本号变化：

- `ctx.web` 的 provider 接口、`registerSearchProvider` / `registerFetchProvider`、`WebError` 与错误码、`WebSearchResult` / `WebFetchResult` 形状未变。
- `@deepseek-ai/dsh-credentials` 的 `credentialRef` / `isCredentialRefName` / `resolve()`、`@deepseek-ai/dsh-launch-environment` 的 `launchEnvironmentOf()` 未变；0.2.1 把凭据优先级改为“存储优先于环境”，与本插件“字面量 → credentials → 启动环境”的顺序一致。
- 客户端 `dsh.client` 清单、`window.__ModuleLoader__.load` 协议、`plugins.item` 槽位、`ctx.configForms` 的 `getSnapshot` / `subscribe` / `mutate` 未变。
- `web` 行的 `searchProvider` / `fetchProvider` 在 0.2.1 为 volatile（每次搜索/抓取时读取）。
- peer 范围 `^0.2.0-rc.2` 在 0.2.1 的兼容性判定（`includePrerelease: true`）下仍满足。

## 测试与验证

```bash
node --check lib/index.js
node --check lib/client.js
node temp-dsh/guard.test.mjs
node temp-dsh/guard.cordis.test.mjs
node temp-dsh/verify-client.cjs   # 42 通过 / 0 失败
node temp-dsh/verify-css.cjs
node temp-dsh/verify-peers.cjs
```

`guard.test.mjs` 覆盖：已固定、被改走、插件关闭、事务内事件、永久失败、瞬时写锁失败。

`verify-patch.cjs` / `verify-config.cjs` / `verify-versions.cjs` 依赖已删除的 PiDeck runtime 或旧 asar 偏移算法，当前环境不可用，与插件逻辑无关。

**真实 host 验证**：复制 desktop profile 为独立 profile（例如 `testdesk`），用 rc.3 的 `dsh` 启动 `web --no-open --port <port>`，在浏览器里检查：

- 插件开 + 内置开关 ON 保存 → `web` 用户层覆盖被删除，开关回到 OFF；
- 插件关 + 内置开关 ON 保存 → 保留 `deepseek-search-api`；
- 插件开关 on/off 保存均成功，无“本部署没有接受这些值”。

## Profile 保存失败的技术原因

保存时宿主报：

```text
Configuration for "9router-web-search" is overridden by a home patch or command-line overlay
```

实际原因可能是 profile 用户层有**两份同 id 定义**：`insert:` 行 + 顶层 `- id:` 行。`configEditor.edit()` 写完顶层行后，用 `composeEntries([patches])` 的第一条同 id 行做生效值校验；第一条是 `insert` 行时，配置与写入不一致，于是误报 overridden。客户端只显示通用的“本部署没有接受这些值”。

处理：删除 `insert:` 行，保留顶层行。插件管理器按 `dsh.bundle.patch` 安装时只写 bundle 层，不会写用户层 `insert:` 行。

若想改进客户端体验，可在 `SettingsFormModel.save()` 里把 `scope.mutate` 的失败原因暴露出来，而不是只给通用文案。

## 维护

- **命名空间即 entry id**：settings 命名空间等于 profile entry id。改名需同步 `cordis.patch.yml` 的 `id`、`lib/index.js` 的 `name`、`lib/client.js` 的 bundle `id` 与 `ROUTER_NS`；旧命名空间的用户层配置会变成孤儿。
- **分发**：`dsh plugin add github:<用户>/dsh-9router-web-search`；`lib/` 必须提交，安装前会预检 `exports` 指向的文件存在。
- **更新**：0.2.1 起已安装包再安装返回 `already-installed`；先移除再安装，重启 dsh。
- **卸载清理**：bundle 与补丁层自动清理；若用户层残留 `web` 的 9router 选择，需要手动删除，否则 `WEB_PROVIDER_CONFIGURED_MISSING`。
- **安装副本覆盖**：`pnpm install` 或插件页更新会覆盖 `node_modules/9router-web-search` 里的本地改动；长期开发用 `link:`。

## 变更记录

- **1.1.1**（2026-10-26）：修复 provider 选择守卫在 HMR 事务内写回被拒的问题（MessagePort 事务外执行 + 退避重试）；README 增加 profile 重复定义排查。
- **1.1.0**：新增 provider 选择守卫，插件开启时强制 `web` 使用 9router。
- **1.0.0**：首个版本，注册 9router 搜索/抓取 provider 与内置回退。
