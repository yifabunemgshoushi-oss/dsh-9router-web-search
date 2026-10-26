# 9router-web-search

让 dsh 的 `web_search` / `web_fetch` 改走本机 **9router** 服务的搜索与抓取接口，替换内置 provider；关掉开关即可回退到 dsh 内置实现。

- 包名 / entry id / settings 命名空间：`9router-web-search`
- provider id：`9router`（搜索）、`9router-fetch`（抓取）
- 只替换 `ctx.web` 接缝的 **provider 层**：工具的 JSON schema、系统提示词、结果卡片与 UI 全部不变，模型无感

## 安装

### 推荐：从 git 安装（自带补丁，卸载干净）

```
dsh plugin add github:yifabunemgshoushi-oss/dsh-9router-web-search
```

插件通过 `package.json` 的 `dsh.bundle.patch` 声明自带的 `cordis.patch.yml`，安装时 dsh 会自动处理两件事，**不需要手改 profile**：

1. 把插件插入 Loader 行；
2. 把 `web` 接缝的 provider 指向它。

**卸载也会自动清理**：`app-boot/src/profile-plugins.ts` 的 `reconcileProfilePlugins` 会在包失去 `dsh.bundle.patch` 声明（或依赖被移除）时，自动把本 bundle 从 profile 的 `bundles` 列表剔除，补丁层随之消失，`web` 行回落到 base 的默认 provider（`deepseek-official` / `http`），**不留悬空引用**。

> 这一点很关键。若插件**没有**自带补丁、而是在 profile 里手写 entry，卸载器不知道那些手写条目的存在，会残留一条指向已卸载插件的行——插件页会继续显示它，且 `web` 行留下悬空 provider id（可能触发 `WEB_PROVIDER_CONFIGURED_MISSING`）。

### 密钥怎么给

补丁里**不写明文密钥**，只声明凭据引用：

```yaml
apiKeyEnv: NINEROUTER_API_KEY
```

插件按 `字面量 apiKey` → `credentials 域` → `启动环境变量` 的顺序解析（`lib/index.js` 的 `resolveApiKey`）。三种给法任选：

- **凭据域（推荐）**：`dsh` 的「设置 → 插件 → 9Router 网页搜索」里填 API Key，写入 `<DSH_HOME>/.credentials.yaml` 的 `refs`；
- **环境变量**：设 `NINEROUTER_API_KEY`（注意要用 `apiKeyEnv` 指向的那个名字）；
- **profile 局部覆盖**：在 profile 的 `cordis.patch.yml` 里覆盖本行 config 补 `apiKey`。注意 `config` 是**整段替换**，须重述其余字段。

### 本地开发（`link:` 挂载）

源码目录：`D:\other\dsh-plugins\dsh-9router-web-search`（与 `dsh-mcp-manager`、`dsh-settings-extras` 同级）。

**目录名 ≠ 包名**：插件对外身份是包名 `9router-web-search`（`package.json` 的 `name`），目录上的 `dsh-` 前缀只是本地存放约定，不参与解析。profile 按**依赖键**建软链，所以依赖键必须写包名。

在 profile 的 `package.json` 里加一条 link 依赖，再跑 `pnpm install` 生成软链：

```json
"9router-web-search": "link:D:/other/dsh-plugins/dsh-9router-web-search"
```

改用（或改用回）link 挂载时，**记得把 git 安装时期留下的 profile 手写条目一并清掉**，否则同一 `id` 会有两份定义（后者静默覆盖前者，不报错）。

## 配置字段

| 字段 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 开启时强制 9router，并把 `web` 的 provider 选择写回 9router；关闭后不再调用 9router，直接走内置实现 |
| `baseUrl` | `http://localhost:20128` | 9router 服务地址。**不要带 `/v1`**，插件自己拼 `/v1/search`、`/v1/web/fetch` |
| `apiKey` | 空 | 9router 的 API Key。走 credentials 域存储，不写入设置文件 |
| `apiKeyEnv` | `NINEROUTER_API_KEY` | 密钥引用名；`apiKey` 为空时按此名去 credentials / 环境变量解析 |
| `searchModel` | `search-combo` | 搜索走 9router 的哪个模型/路由 |
| `fetchModel` | `fetch-combo` | 抓取走 9router 的哪个模型/路由 |
| `searchType` | `web` | 传给 `/v1/search` 的 `search_type`，详见下节 |
| `timeoutMs` | `60000` | 单次搜索或抓取的最长等待时间（毫秒） |
| `fallbackToBuiltin` | `true` | 9router 调用失败时，是否自动改用内置实现重试 |

## search_type（搜索类型）

### 可选值

**`web` 与 `news` 两个**。这是 9router 自己配置表单给出的选项（`...\9router\app\.next-cli-build\server\app\(dashboard)\dashboard\media-providers\[kind]\[id]\page.js`）：

```js
{ key: "search_type", label: "Type", type: "select", default: "web", options: ["web", "news"] }
```

严格说，取值由 9router 当前那条 combo 里**每个上游 provider 的 `searchTypes` 数组**决定。`/api/v1/search` 的取值逻辑是：

```js
searchType: c.search_type || provider.searchTypes?.[0] || "web"
```

即：你没填 → 用该 provider 的第一个 → 再兜底 `"web"`。

### 有什么用

1. 选择**搜索索引类型**：`web` = 通用网页索引；`news` = 新闻/时效优先。
2. 副作用是**会影响 9router 选择哪条上游 provider**。
3. 填了不支持的值**不报错**，上游会忽略它并退回默认，试错成本低。

### 实测对比

用 `search-combo`、同一 query 实测（2026-10）：

| search_type | 实际命中的上游 | 结果特征 |
|---|---|---|
| `web` | tavily | 通用网页结果 |
| `news` | searchapi | 明显偏时事新闻 |
| `images`（非法值，用于验证） | tavily | 静默退回默认，无报错 |

### 建议

- 平时保持 `web`。
- 想要时效性强的新闻结果时切 `news`。
- 面板里清空该字段会回到插件默认值 `web`，与 9router 自身的缺省行为一致。

### 未暴露的其它 9router 参数

9router 的搜索接口还接受 `country`、`language`、`time_range`、`offset`、`domain_filter`、`content_options`、`provider_options`，但 dsh 的 web 接缝只向下传 `query` + `maxResults`，因此本插件未在面板中暴露这些字段。

## 回退语义

触发条件：`enabled = false`，或 9router 调用失败且 `fallbackToBuiltin = true`。另外，`enabled = true` 时插件会把 `web` 的 provider 选择强制写回 9router，避免内置开关把执行路径切走（见「0.2.1 适配说明」）。

| 能力 | 回退实现 |
|---|---|
| 抓取 | 匿名 HTTP GET（等价 dsh 内置的 `dsh-web-fetch-http`），按 content-type 判定 `html` / `text`；非 2xx 作为**正常结果**返回而非抛错 |
| 搜索 | 等价的 DeepSeek 原生搜索（Anthropic 兼容 Messages + `web_search_20250305`，并显式发送 `thinking: { type: 'disabled' }`）。**需要 `DEEPSEEK_API_KEY`**，取不到时如实报 `WEB_PROVIDER_CREDENTIAL_MISSING`，不会编造结果 |

**为什么用常驻注册 + 开关，而不是"卸载即回退"**：`ctx.web` 的 provider 选择策略是"显式配置的 id 优先"，若插件卸载，接缝会报 `WEB_PROVIDER_CONFIGURED_MISSING` 而不是回退。所以两个 provider 常驻注册，由 `enabled` 在**执行路径**上切换，这样一拨开关就能热回退，无需重启。

## 设置面板

位置：**插件 → 9Router 网页搜索**（0.2.0 时代写作「设置 → 插件」，0.2.1 起插件配置统一收在插件页）。

可以改：启用开关、接口地址、API Key、密钥引用名、搜索模型、抓取模型、搜索类型、超时、失败回退开关。改完即热生效，无需重启。

> 首次安装后，Host 半会热加载生效；但**客户端面板需要重启一次 dsh** 才会出现（`dsh-client-modules` 在启动时扫描并生成 boot graph）。

### 客户端控件是自带的，不依赖 Harness Client 包

`lib/client.js` **只 require `react` 与 `react/jsx-runtime`**，设置页用到的控件（开关、取值字段、密钥字段、表单外壳、`SettingsFormModel` 表单内核）都在文件内的 `#region lib/client/ui-port.js` 里自带实现，样式经 `mountStyles()` 注入。

- **为什么不用 `@deepseek-ai/dsh-client-ui-primitives`**：官方 `references/practices.md:35` 明确禁止客户端插件 require 任何 Harness Client 包。该包虽是平台种子模块（`packages/client/web/src/seed.ts` 把它注入冻结模块表，**当前可用**），但其 API 不受 semver 约束、手写 JS 也无类型检查；一旦不兼容，失败形态是**整个 slot 条目变空白**（控制台 `slot entry crashed in '<slot>'`），而不是一个可降级的错误。自带实现后只依赖 `react` 与 `--dsw-*` token，DSH 升级最多让外观降级。
- **类名与样式**：统一加 `dsh-9rws-` 前缀以避免与宿主样式冲突；颜色只用 `--dsw-*` 主题 token。原包的 CSS Modules 已内联为 `CSS_TEXT` 常量。
- **移植范围**：只移植本插件用到的能力。原包中 `SettingsValueField` 的 `help` 信息按钮、`numeric` / `placeholder` 透传，以及各控件的 `className` / `title` 透传均未移植（本插件不需要），因此没有无测试覆盖的死代码。
- **`SettingsFormModel` 的差异**：原实现依赖 `@deepseek-ai/dsh-client-store` 的 `createSnapshotStore`；自带版改为等价的极小实现（`subscribe` / `getSnapshot` / `set`），以彻底断开该依赖。语义（暂存编辑、保存、修订栅栏、`base`/`user` 分层、overridden 判定）完全保留。

## 0.2.1 适配说明（2026-10-21 核对，2026-10-26 修复守卫）

已对照 dsh 源码 `0.2.1-rc.2` 与桌面版 `0.2.1-rc.3` 核对。本轮修改涉及的宿主包（`dsh-web`、`dsh-settings`、`dsh-config-editor`、`dsh-client-ui-settings-web-search`）在 rc.2 → rc.3 之间只有版本号变化，契约未变：

- `ctx.web` 的 provider 接口、`registerSearchProvider` / `registerFetchProvider`、`WebError` 与错误码、`WebSearchResult` / `WebFetchResult` 形状均未变。
- `@deepseek-ai/dsh-credentials` 的 `credentialRef` / `isCredentialRefName` / `resolve()`、`@deepseek-ai/dsh-launch-environment` 的 `launchEnvironmentOf()` 均未变；0.2.1 把凭据优先级改为「存储优先于环境」，与本插件「字面量 → credentials → 启动环境」的解析顺序一致。
- 客户端 `dsh.client` 清单、`window.__ModuleLoader__.load` 协议、`plugins.item` 槽位、`ctx.configForms` 的 `getSnapshot` / `subscribe` / `mutate` 均未变（仅删除了本插件未使用的 `mode` 字段）；`react` 与 `react/jsx-runtime` 仍是平台种子模块。
- `web` 行的 `searchProvider` / `fetchProvider` 在 0.2.1 变为 volatile（每次搜索/抓取时读取），本插件补丁的写法无需调整。
- peer 范围 `^0.2.0-rc.2` 在 0.2.1 的兼容性判定（`includePrerelease: true`）下仍满足 `0.2.1-rc.2`，不会被判为不兼容。

两处行为变化：

1. **内置搜索回退已同步**：0.2.1 的内置 Messages 搜索显式发送 `thinking: { type: 'disabled' }`，避免正文被丢弃的辅助请求白跑思考 token；本插件回退路径已同步。
2. **内置开关会被本插件接管**：0.2.1 新增 `web-deepseek-api`（`deepseek-search-api` / `deepseek-fetch-api`），内置「网页搜索」页的 **Use the new Web Search API** 开关会把 `web.searchProvider` / `web.fetchProvider` 写进 profile 的用户层。它与本插件的 `enabled` 开关**不是一回事**：

   | 状态 | 实际执行 |
   |---|---|
   | 本插件开 | 强制 9router；守卫发现 `web` 选择被改走时写回 `9router` / `9router-fetch` |
   | 本插件关 | seam 保持当前选择；若仍是 9router，则走插件内部的内置等价实现；内置开关可正常切换 |

   `enabled` 为 `true` 时，`installWebSelectionGuard` 订阅 `settings/document-updated`，用 `settings.describe()` 读取 `web` 的生效值，发现不是 9router 就用 `settings.update('web', …)` 写回。写回值与 bundle 层一致时，settings 会直接删除用户层覆盖，所以内置开关保存后会自己弹回 OFF，日志会记录一条 `restoring web.searchProvider/fetchProvider to 9router`。`enabled` 为 `false` 时守卫不写入，把选择权交还内置页面。

   **写回为什么要绕到事务外**（2026-10-26 修复）：`settings/document-updated` 是在宿主配置重载的 HMR 事务内派发的（`SettingsForms.describe()` 在 `configEditor.edit()` 的 `runExclusive` 里被调用），而 `runExclusive` 用 `AsyncLocalStorage` 标记事务，该标记会沿 `queueMicrotask` / `setTimeout` / `await` 传播。直接在事件回调或“微任务 + 延时重试”里调 `settings.update()`，只会得到 `HMR transactions cannot be nested`，写回被静默拒绝；表现就是内置开关保存后一直停在新选择上，看起来像开关坏了。现在守卫在模块首次加载时（宿主启动阶段，事务之外）创建一个常驻 `MessagePort`，把写回任务 post 过去，端口回调在创建时的空上下文里运行，`settings.update()` 于是重新进入 `hmr.runExclusive()` 的排队逻辑而不是被判为嵌套；写入按 `writing` 串行化，重载/写锁的瞬时失败按 50ms 起指数退避重试，最多 8 次。若插件代码经 HMR 在事务内重新导入，新端口会继承事务标记，日志会记录无法写回，重启 dsh 即可恢复。

   这不是 rc.3 才引入的问题：rc.2 的 `configEditor.edit()` 同样包在 `hmr.runExclusive()` 里，之前的守卫只在 stub 和裸 Cordis 上下文里验证过，没有在真实 GUI 的保存事务里跑过。验证方式：插件开启时把内置开关拨到开并保存，`web` 用户层覆盖应被删除（`cordis.patch.yml` 里不再有 `web` 的 `searchProvider: deepseek-search-api`），页面上的开关会回到 OFF，日志出现 `restoring web.searchProvider/fetchProvider to 9router`。桌面版是 git 安装的实体副本，改完 `lib/index.js` 后需同步到 `profiles/desktop/node_modules/9router-web-search` 并重启 dsh。

   因此，开启插件时不会出现“拨一下内置开关就绕过插件、没 DeepSeek 凭据导致搜索全挂”的情况。例外是 `web` 行被 home patch 或命令行 overlay 覆盖：`configEditor.edit` 会拒绝写入，守卫只能记录警告，无法强制——这是宿主规定的覆盖优先级。

   此时内置「网页搜索」页会显示 Messages 模式，但实际执行的是 9router；在该页改 Messages 的 baseURL / maxUses 不会影响 9router，只有 `DEEPSEEK_API_KEY` 会被插件的内部回退使用。

   > 仍不建议给 `web-deepseek-api` 加 `disabled: true` 来藏开关：守卫只在插件启用时生效；插件关闭时，如果用户层已经保存过 `searchProvider: deepseek-search-api`，禁用该行会让 `web` 指向未注册的 provider，触发 `WEB_PROVIDER_CONFIGURED_MISSING`。

> 升级安装提示：0.2.1 起 HMR 模式下对已安装包再次安装会返回 `already-installed`；更新本插件需先在插件页移除，再重新安装。

## 维护提示

- **源码目录与挂载方式**：源码在 `D:\other\dsh-plugins\dsh-9router-web-search`。桌面 profile 目前用 git 依赖（`github:yifabunemgshoushi-oss/dsh-9router-web-search`），`profiles/desktop/node_modules/9router-web-search` 是安装出来的实体副本；本地改完源码后，要么把该依赖临时改成 `link:D:/other/dsh-plugins/dsh-9router-web-search` 再 `pnpm install`，要么推送后走插件页更新。两种方式改完都需重启 dsh 才生效。
- **依赖由宿主供给，仓库不携带 `node_modules`**：`package.json` 把插件**直接 import 的 4 个包**声明为 `peerDependencies` 与 `devDependencies` 各一份——`@deepseek-ai/dsh-credentials`、`@deepseek-ai/dsh-launch-environment`、`@deepseek-ai/dsh-web`、`@deepseek-ai/schemastery`。
  - peer 让 profile 解析器用**运行中 dsh 安装里的那一份**占据该包名，**即使插件目录下没有物理 `node_modules` 也成立**（见 `packages/boot/app-boot/src/profile-resolution/resolver.ts` 的 `routeLinked`：读 importer 祖先链上每层 manifest 的 `peerDependencies` 来判定拦截）。dev 副本供编译器/独立测试使用，运行时不会被加载。
  - **必须共用同一实例**：`lib/index.js` 用 `error instanceof WebError` 判定错误，两侧各自复制一份会让该判定静默失效。
  - 其余传递依赖（`cosmokit`、`cordis`、`dsh-brand`、`dsh-llm`、`zod` 等）由宿主**安装闭包**提供（`app.asar` 内共 289 个 `@deepseek-ai/*` 包），无需声明。
  - `node_modules/` 与 `temp-dsh/` 已加入 `.gitignore`。本地若仍留有旧的实体副本，声明 peer 后运行时已优先走宿主那一份，副本只是冗余（可删）。
  - **升级 dsh 后**若出现模块缺失或 API 不存在，核对两个不变量：① `package.json` 里 peer 声明的每个包名，都仍出现在 dsh 安装闭包中（`app.asar` 内 `dsh/node_modules/@deepseek-ai/*`，本次核对时共 289 个）；② 插件直接 import 的每个包名都已声明 peer。历史上 `profiles/node_modules` 曾是指向 **npm 版 dsh** `0.1.0-rc.7` 的 junction 农场，那套缺 `schemastery.volatile()` 与 `dsh-credentials.isCredentialRefName`，加载会崩；该农场已于 2026-10-13 清理。
- **分发方式**：本地开发用 profile 的 `link:` 依赖（见上）。要装到别的机器，走 git 源（`dsh plugin add github:<用户>/dsh-9router-web-search`），由插件管理器在 profile 内跑 pnpm 安装依赖。**`lib/` 必须提交**：安装前会预检 `exports` 指向的文件真实存在，缺构建产物会直接判为失败。
- **命名空间即 entry id**：settings 命名空间等于 profile 里的 entry id。若要改名，`cordis.patch.yml` 的 `id`、`lib/index.js` 的 `name`、`lib/client.js` 的 bundle `id` 与 `ROUTER_NS` 必须一起改；旧命名空间下面板写入的用户层配置会变成孤儿。
- **桌面版契约**：本插件按 dsh **0.2.0-rc.2** 的接口编写，并已核对 **0.2.1-rc.2 / 0.2.1-rc.3** 仍然兼容（见上节「0.2.1 适配说明」）。用于更早的 npm 版 dsh 需要按旧 API 改写。
