import z from "@deepseek-ai/schemastery";
import { credentialRef, isCredentialRefName } from "@deepseek-ai/dsh-credentials";
import { launchEnvironmentOf } from "@deepseek-ai/dsh-launch-environment";
import { WebError } from "@deepseek-ai/dsh-web";
import { isIP } from "node:net";

// ============================================================================
// 常量
// ============================================================================

/** 搜索 provider 在 ctx.web 注册表中的 id。 */
const SEARCH_PROVIDER_ID = "9router";
/** 抓取 provider 在 ctx.web 注册表中的 id。 */
const FETCH_PROVIDER_ID = "9router-fetch";
/** `web` 能力接缝在 profile 里的 entry id（base bundle 的固定行 id）。 */
const WEB_ENTRY_ID = "web";

const DEFAULT_BASE_URL = "http://localhost:20128";
const DEFAULT_SEARCH_MODEL = "search-combo";
const DEFAULT_FETCH_MODEL = "fetch-combo";
const DEFAULT_SEARCH_TYPE = "web";
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_API_KEY_ENV = "NINEROUTER_API_KEY";
const DEFAULT_MAX_RESULTS = 5;

/** 归属 header，随包版本更新。 */
const USER_AGENT = "deepseek-harness-9router/1.1.0";

// ---- 内置回退：DeepSeek 原生搜索（Anthropic 兼容 Messages）----

const BUILTIN_SEARCH_ENDPOINT = "https://api.deepseek.com/anthropic/v1/messages";
const BUILTIN_SEARCH_MODEL = "deepseek-v4-flash";
const BUILTIN_SEARCH_API_VERSION = "2023-06-01";
const BUILTIN_SEARCH_MAX_TOKENS = 4096;
const BUILTIN_SEARCH_MAX_USES = 5;
const BUILTIN_SEARCH_API_KEY_ENV = "DEEPSEEK_API_KEY";

// ---- 内置回退：匿名 HTTP(S) 抓取 ----

const BUILTIN_FETCH_USER_AGENT = "deepseek-harness/0.0.1 (+https://github.com/deepseek-ai)";
const BUILTIN_FETCH_MAX_BYTES = 5000000;
const BUILTIN_FETCH_MAX_CHARS = 100000;

// ============================================================================
// 配置
// ============================================================================
// 字段名是跨端契约：Client 半（lib/client.js）按同一组名字读写这些字段。
// 每个字段标记 volatile，使 settings 服务把它识别为可热改字段（0.2.0-rc.2 起，
// 0.2.1 沿用），配置变更后下一轮搜索/抓取即可读到新值，无需重启。

export const Config = z.object({
    enabled: z.boolean().default(true).volatile(),
    baseUrl: z.string().default(DEFAULT_BASE_URL).volatile(),
    apiKey: z.string().role("secret").volatile(),
    apiKeyEnv: z.string().role("credential-ref").default(DEFAULT_API_KEY_ENV).volatile(),
    searchModel: z.string().default(DEFAULT_SEARCH_MODEL).volatile(),
    fetchModel: z.string().default(DEFAULT_FETCH_MODEL).volatile(),
    searchType: z.string().default(DEFAULT_SEARCH_TYPE).volatile(),
    timeoutMs: z.number().step(1).min(1).default(DEFAULT_TIMEOUT_MS).volatile(),
    fallbackToBuiltin: z.boolean().default(true).volatile()
});

// ============================================================================
// 纯函数：上游响应 -> 接缝词汇
// ============================================================================

/**
 * 把 9router `/v1/search` 的响应映射成 ctx.web 的搜索结果。
 * `answer` 为 null/空时省略 `content`；跳过 url 为空的条目；按 url 去重。
 * `maxResults` 的截断由接缝自己完成，所以这里 `truncated` 恒为 false。
 */
export function mapSearchResponse(json) {
    const results = Array.isArray(json?.results) ? json.results : [];
    const seen = new Set();
    const sources = [];
    for (const item of results) {
        const url = typeof item?.url === "string" ? item.url : "";
        if (url.length === 0 || seen.has(url)) continue;
        seen.add(url);
        const title = typeof item.title === "string" && item.title.length > 0 ? item.title : undefined;
        const snippet = typeof item.snippet === "string" && item.snippet.length > 0 ? item.snippet : undefined;
        const publishedAt = typeof item.published_at === "string" && item.published_at.length > 0 ? item.published_at : undefined;
        sources.push({
            url,
            ...title === undefined ? {} : { title },
            ...snippet === undefined ? {} : { snippet },
            ...publishedAt === undefined ? {} : { publishedAt }
        });
    }
    const answer = typeof json?.answer === "string" && json.answer.length > 0 ? json.answer : undefined;
    return {
        ...answer === undefined ? {} : { content: answer },
        sources,
        truncated: false
    };
}

/**
 * 把 9router `/v1/web/fetch` 的响应映射成 ctx.web 的抓取结果。
 * 上游已经是 markdown 正文，因此 `kind` 恒为 'text'；`statusCode` 为 200。
 * 响应缺少 `content.text` 视为上游返回不可用正文，显式抛错而不是静默返回空串。
 */
export function mapFetchResponse(json, requestUrl) {
    const text = json?.content?.text;
    if (typeof text !== "string") {
        throw new WebError("9router fetch response has no content.text; the upstream body is not usable", "WEB_PROVIDER_ERROR");
    }
    const url = typeof json?.url === "string" && json.url.length > 0 ? json.url : requestUrl;
    return {
        url,
        statusCode: 200,
        body: { kind: "text", content: text },
        truncated: false
    };
}

/**
 * 把 DeepSeek Anthropic Messages 响应映射成搜索结果（内置回退路径）。
 * `web_search_result` 条目通常没有内联 snippet，摘要位于 text 块的
 * `citations[].cited_text`，按 url 关联（首次出现优先）。
 */
export function mapBuiltinSearchResponse(response) {
    const blocks = Array.isArray(response?.content) ? response.content : [];
    const resultBlocks = blocks.filter((block) => block?.type === "web_search_tool_result");
    if (resultBlocks.length === 0) {
        throw new WebError("DeepSeek returned no web_search_tool_result blocks; the request may not have triggered native web search", "WEB_PROVIDER_ERROR");
    }
    const snippets = citationSnippets(blocks);
    const seen = new Set();
    const sources = [];
    for (const block of resultBlocks) {
        for (const item of block.content ?? []) {
            if (item?.type !== "web_search_result") continue;
            const url = typeof item.url === "string" ? item.url : "";
            if (url.length === 0 || seen.has(url)) continue;
            seen.add(url);
            const title = typeof item.title === "string" && item.title.length > 0 ? item.title : undefined;
            const snippet = snippets.get(url);
            const publishedAt = typeof item.page_age === "string" && item.page_age.length > 0 ? item.page_age : undefined;
            sources.push({
                url,
                ...title === undefined ? {} : { title },
                ...snippet === undefined ? {} : { snippet },
                ...publishedAt === undefined ? {} : { publishedAt }
            });
        }
    }
    return { sources, truncated: false };
}

/** 收集每个 text 块 citations 里的 url -> cited_text 映射（首次出现优先）。 */
function citationSnippets(blocks) {
    const map = new Map();
    for (const block of blocks) {
        if (block?.type !== "text") continue;
        for (const cite of block.citations ?? []) {
            if (typeof cite?.url !== "string" || cite.url.length === 0) continue;
            if (typeof cite.cited_text !== "string" || cite.cited_text.length === 0) continue;
            if (!map.has(cite.url)) map.set(cite.url, cite.cited_text);
        }
    }
    return map;
}

// ============================================================================
// 通用工具：取消、超时、HTTP
// ============================================================================

/** 调用方已取消时立刻抛出稳定的 WEB_ABORTED。 */
function throwIfAborted(label, signal) {
    if (signal?.aborted === true) throw abortedError(label, signal);
}

/** 构造稳定的取消错误，保留调用方给出的 reason。 */
function abortedError(label, signal, cause) {
    return new WebError(`${label} aborted`, "WEB_ABORTED", {
        cause: signal?.aborted === true ? signal.reason : cause
    });
}

/** 组合调用方 signal 与本插件超时；把「谁触发的取消」分开记录。 */
function withTimeout(signal, timeoutMs) {
    const timer = AbortSignal.timeout(timeoutMs);
    return {
        signal: signal === undefined ? timer : AbortSignal.any([signal, timer]),
        timedOut: () => timer.aborted && signal?.aborted !== true,
        ms: timeoutMs
    };
}

/** 把 transport 阶段（请求/读体）的异常翻译成 WebError。 */
function transportError(error, signal, timeout, label) {
    if (signal?.aborted === true) return abortedError(label, signal, error);
    if (timeout.timedOut()) return new WebError(`${label} timed out after ${String(timeout.ms)}ms`, "WEB_PROVIDER_ERROR", { cause: error });
    if (error instanceof WebError) return error;
    return new WebError(`${label} failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
}

/** 尽力解析 JSON；失败返回 undefined，由调用方决定如何归类错误。 */
function parseJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        return undefined;
    }
}

/** 组装非 2xx 的错误消息：HTTP 状态码 + 上游 errors 数组/error/message + 正文兜底。 */
function httpFailureMessage(label, status, parsed, text) {
    const details = [];
    if (Array.isArray(parsed?.errors)) {
        for (const entry of parsed.errors) {
            const detail = typeof entry === "string" ? entry : JSON.stringify(entry);
            if (detail.length > 0) details.push(detail);
        }
    }
    const direct = typeof parsed?.error === "string" ? parsed.error
        : typeof parsed?.error?.message === "string" ? parsed.error.message
            : typeof parsed?.message === "string" ? parsed.message
                : undefined;
    if (direct !== undefined && direct.length > 0) details.push(direct);
    if (details.length === 0 && text.trim().length > 0) details.push(text.trim().slice(0, 500));
    return details.length === 0
        ? `${label} failed (HTTP ${status})`
        : `${label} failed (HTTP ${status}): ${details.join("; ")}`;
}

/**
 * 发一次 JSON POST 并返回解析后的响应体。
 * 非 2xx 抛 WEB_PROVIDER_ERROR（消息含状态码与上游错误）；传输异常保留 cause。
 */
async function dispatchJson({ url, headers, body, signal, label, timeoutMs, fetchImpl }) {
    const timeout = withTimeout(signal, timeoutMs);
    let response;
    try {
        response = await fetchImpl(url, {
            method: "POST",
            redirect: "error",
            headers: {
                ...headers,
                "content-type": "application/json",
                "accept": "application/json",
                "user-agent": USER_AGENT
            },
            body: JSON.stringify(body),
            signal: timeout.signal
        });
    } catch (error) {
        throw transportError(error, signal, timeout, label);
    }
    let text;
    try {
        text = await response.text();
    } catch (error) {
        throw transportError(error, signal, timeout, label);
    }
    const parsed = parseJson(text);
    if (!response.ok) throw new WebError(httpFailureMessage(label, response.status, parsed, text), "WEB_PROVIDER_ERROR");
    if (parsed === undefined) throw new WebError(`${label} returned an unprocessable response body`, "WEB_PROVIDER_ERROR");
    return parsed;
}

// ============================================================================
// 凭据解析
// ============================================================================

/**
 * 按优先级解析 API key：字面量 config.apiKey -> credentials 服务 -> 启动环境变量。
 * 启动环境快照包含 process 层，等价于读取 process.env，并额外覆盖 project/user 的 .env。
 */
async function resolveApiKey({ options, signal, envName, literal, label, missingMessage }) {
    throwIfAborted(label, signal);
    if (typeof literal === "string" && literal.length > 0) return literal;
    const ref = isCredentialRefName(envName) ? credentialRef(envName) : undefined;
    throwIfAborted(label, signal);
    if (ref !== undefined && options.credentials !== undefined) {
        let resolved;
        try {
            resolved = await options.credentials.resolve(ref);
        } catch (error) {
            if (signal?.aborted === true) throw abortedError(label, signal, error);
            throw new WebError(`${label} credential resolution failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
        }
        if (typeof resolved?.value === "string" && resolved.value.length > 0) return resolved.value;
    }
    const ambient = options.launchEnvironment.get(envName)?.value;
    if (typeof ambient === "string" && ambient.length > 0) return ambient;
    throw new WebError(missingMessage, "WEB_PROVIDER_CREDENTIAL_MISSING");
}

/** 解析 9router 的 key。 */
function resolve9routerKey(options, signal, label) {
    return resolveApiKey({
        options,
        signal,
        envName: options.apiKeyEnv,
        literal: options.apiKey,
        label,
        missingMessage: `9router has no API key for "${options.apiKeyEnv}"; set it in Settings > Plugins > 9router-web-search, store it through the credentials service, or export ${options.apiKeyEnv} before launching`
    });
}

/** 解析内置搜索回退所需的 DEEPSEEK_API_KEY。 */
function resolveBuiltinSearchKey(options, signal, label) {
    return resolveApiKey({
        options,
        signal,
        envName: BUILTIN_SEARCH_API_KEY_ENV,
        literal: options.deepseekApiKey,
        label,
        missingMessage: `the builtin DeepSeek search fallback needs ${BUILTIN_SEARCH_API_KEY_ENV}; store it through the credentials service or export it before launching`
    });
}

// ============================================================================
// 内置回退：搜索
// ============================================================================

/** 等价的 DeepSeek 原生搜索（Anthropic 兼容 Messages + web_search 服务端工具）。 */
async function builtinSearch(options, request, signal, fetchImpl) {
    const label = "builtin DeepSeek search";
    const apiKey = await resolveBuiltinSearchKey(options, signal, label);
    throwIfAborted(label, signal);
    const json = await dispatchJson({
        url: BUILTIN_SEARCH_ENDPOINT,
        headers: {
            "x-api-key": apiKey,
            "authorization": `Bearer ${apiKey}`,
            "anthropic-version": BUILTIN_SEARCH_API_VERSION
        },
        body: {
            model: BUILTIN_SEARCH_MODEL,
            max_tokens: BUILTIN_SEARCH_MAX_TOKENS,
            messages: [{
                role: "user",
                content: [{ type: "text", text: `Perform a web search for the query: ${request.query}` }]
            }],
            tools: [{
                type: "web_search_20250305",
                name: "web_search",
                max_uses: BUILTIN_SEARCH_MAX_USES
            }],
            // dsh 0.2.1 的内置搜索显式关闭思考：辅助请求生成的正文会被丢弃，
            // 思考 token 没有消费者。回退路径与宿主保持一致。
            thinking: { type: "disabled" }
        },
        signal,
        label,
        timeoutMs: options.timeoutMs,
        fetchImpl
    });
    return mapBuiltinSearchResponse(json);
}

// ============================================================================
// 内置回退：抓取
// ============================================================================

/** 按 content-type 判定可解码正文的种类；非文本类型返回 undefined。 */
function classifyContentType(contentType) {
    const mime = (contentType ?? "").replace(/;.*$/su, "").trim().toLowerCase();
    if (mime === "text/html" || mime === "application/xhtml+xml") return "html";
    if (mime.startsWith("text/")) return "text";
    if (mime === "application/json" || mime === "application/xml" || mime.endsWith("+json") || mime.endsWith("+xml")) return "text";
    return undefined;
}

/** 丢弃响应体，避免连接泄漏；任何失败都无关紧要。 */
async function discardBody(response) {
    if (response.body === null) return;
    await response.body.cancel().catch(() => {});
}

/** IPv4 字面量是否落在不可公网到达的网段（含云元数据地址段 169.254/16）。 */
function isNonPublicIpv4(host) {
    const octets = host.split(".").map((part) => Number(part));
    if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return true;
    const [a, b] = octets;
    return a === 0
        || a === 10
        || a === 127
        || (a === 100 && b >= 64 && b <= 127)
        || (a === 169 && b === 254)
        || (a === 172 && b >= 16 && b <= 31)
        || (a === 192 && (b === 0 || b === 168))
        || (a === 198 && (b === 18 || b === 19))
        || a >= 224;
}

/** IPv6 字面量是否落在不可公网到达的网段（按前缀保守判定）。 */
function isNonPublicIpv6(host) {
    if (host === "::" || host === "::1") return true;
    if (host.startsWith("::ffff:")) return true;
    return host.startsWith("fc") || host.startsWith("fd")
        || host.startsWith("fe8") || host.startsWith("fe9") || host.startsWith("fea") || host.startsWith("feb")
        || host.startsWith("ff");
}

/**
 * 内置回退是匿名抓取，必须拒绝本机与私有网段的目的地，否则回退路径会成为 SSRF 跳板
 * （例如云环境的 169.254.169.254 元数据服务）。这里只覆盖字面量主机名；
 * dsh-web-fetch-http 还额外做 DNS 解析后固定地址，本回退未实现该层，故 DNS rebinding 仍不可防。
 */
function isNonPublicHostname(hostname) {
    const host = (hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname).toLowerCase();
    if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
    const family = isIP(host);
    if (family === 4) return isNonPublicIpv4(host);
    if (family === 6) return isNonPublicIpv6(host);
    return false;
}

/** 读取响应流并在体积上限处截断。 */
async function readCapped(response, timeout, signal) {
    if (response.body === null) return { bytes: new Uint8Array(0), truncatedByBytes: false };
    const chunks = [];
    let total = 0;
    let truncatedByBytes = false;
    const reader = response.body.getReader();
    try {
        for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            const remaining = BUILTIN_FETCH_MAX_BYTES - total;
            if (value.byteLength > remaining) {
                chunks.push(value.subarray(0, remaining));
                total += remaining;
                truncatedByBytes = true;
                break;
            }
            chunks.push(value);
            total += value.byteLength;
        }
    } catch (error) {
        throw transportError(error, signal, timeout, "builtin fetch");
    } finally {
        await reader.cancel().catch(() => {});
    }
    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return { bytes, truncatedByBytes };
}

/**
 * 合并主路径与回退路径的失败：回退自身也失败时，把主路径的失败一并写进消息，
 * 避免「9router 缺 key」被「内置也缺 key」掩盖。取消仍按 WEB_ABORTED 原样上抛。
 */
function combinedFallbackError(label, primaryError, fallbackError) {
    if (fallbackError instanceof WebError && fallbackError.code === "WEB_ABORTED") return fallbackError;
    const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
    const primaryMessage = primaryError instanceof Error ? primaryError.message : String(primaryError);
    return new WebError(
        `${fallbackMessage}\n\nThe ${label} attempt made before the builtin fallback also failed: ${primaryMessage}`,
        fallbackError instanceof WebError ? fallbackError.code : "WEB_PROVIDER_ERROR",
        { cause: fallbackError }
    );
}

/** 执行搜索的内置回退，并在回退也失败时保留主路径的失败信息。 */
async function searchFallback(label, primaryError, options, request, signal, fetchImpl) {
    try {
        return await builtinSearch(options, request, signal, fetchImpl);
    } catch (error) {
        throw combinedFallbackError(label, primaryError, error);
    }
}

/** 执行抓取的内置回退，并在回退也失败时保留主路径的失败信息。 */
async function fetchFallback(label, primaryError, options, request, signal, fetchImpl) {
    try {
        return await builtinFetch(request.url, signal, options.timeoutMs, fetchImpl);
    } catch (error) {
        throw combinedFallbackError(label, primaryError, error);
    }
}

/**
 * 匿名 HTTP(S) GET，作为 dsh 内置抓取的等价实现。
 * 非 2xx 是正常结果（返回 statusCode），不是异常。
 */
async function builtinFetch(url, signal, timeoutMs, fetchImpl) {
    const label = "builtin fetch";
    let target;
    try {
        target = new URL(url);
    } catch (error) {
        throw new WebError(`invalid URL: ${url}`, "WEB_INVALID_URL", { cause: error });
    }
    if (target.protocol !== "http:" && target.protocol !== "https:") {
        throw new WebError(`unsupported URL scheme "${target.protocol}" (only http and https are allowed)`, "WEB_INVALID_URL");
    }
    if (target.username.length > 0 || target.password.length > 0) {
        throw new WebError("credentials in URLs are not allowed", "WEB_BLOCKED_URL");
    }
    if (isNonPublicHostname(target.hostname)) {
        throw new WebError(`URL hostname "${target.hostname}" is a local or private destination, which the builtin fetch fallback refuses`, "WEB_BLOCKED_URL");
    }
    throwIfAborted(label, signal);
    const timeout = withTimeout(signal, timeoutMs);
    let response;
    try {
        response = await fetchImpl(url, {
            method: "GET",
            redirect: "follow",
            headers: {
                "user-agent": BUILTIN_FETCH_USER_AGENT,
                "accept": "text/html,application/xhtml+xml,text/*;q=0.9,application/json;q=0.8"
            },
            signal: timeout.signal
        });
    } catch (error) {
        throw transportError(error, signal, timeout, label);
    }
    const kind = classifyContentType(response.headers.get("content-type"));
    if (kind === undefined) {
        await discardBody(response);
        throw new WebError(`unsupported content type "${response.headers.get("content-type") ?? "unknown"}"`, "WEB_UNSUPPORTED_CONTENT_TYPE");
    }
    const { bytes, truncatedByBytes } = await readCapped(response, timeout, signal);
    const decoded = new TextDecoder("utf-8").decode(bytes);
    const truncatedByChars = decoded.length > BUILTIN_FETCH_MAX_CHARS;
    return {
        url: response.url.length > 0 ? response.url : url,
        statusCode: response.status,
        body: { kind, content: truncatedByChars ? decoded.slice(0, BUILTIN_FETCH_MAX_CHARS) : decoded },
        truncated: truncatedByBytes || truncatedByChars
    };
}

// ============================================================================
// Provider
// ============================================================================

/** 9router 搜索 provider：主路径走 9router，失败或关闭开关时回退内置搜索。 */
export class RouterSearchProvider {
    id = SEARCH_PROVIDER_ID;
    /**
     * @param resolveOptions 每次调用入口读取一次的 live 选项 thunk（设置可热改，故不在构造期快照）
     * @param fetchImpl 注入的 fetch，便于自测替换
     */
    constructor(resolveOptions, fetchImpl = globalThis.fetch) {
        this.resolveOptions = resolveOptions;
        this.fetchImpl = fetchImpl;
    }

    /** 纯本地检查，绝不发网络请求。 */
    available() {
        return URL.canParse(this.resolveOptions().baseUrl);
    }

    async search(request, signal) {
        const options = this.resolveOptions();
        const label = "9router search";
        throwIfAborted(label, signal);
        if (!options.enabled) {
            if (!options.fallbackToBuiltin) {
                throw new WebError("9router search is disabled and the builtin fallback is turned off; enable one of them in Settings > Plugins > 9router-web-search", "WEB_PROVIDER_ERROR");
            }
            return await builtinSearch(options, request, signal, this.fetchImpl);
        }
        try {
            return await this.searchVia9router(options, request, signal);
        } catch (error) {
            if (signal?.aborted === true) throw abortedError(label, signal, error);
            if (error instanceof WebError && error.code === "WEB_ABORTED") throw error;
            if (!options.fallbackToBuiltin) throw error;
            options.warn(`9router-web-search: 9router search failed, falling back to the builtin DeepSeek search: ${String(error)}`, error);
            return await searchFallback(label, error, options, request, signal, this.fetchImpl);
        }
    }

    /** 主路径：POST {baseUrl}/v1/search。 */
    async searchVia9router(options, request, signal) {
        const label = "9router search";
        throwIfAborted(label, signal);
        const apiKey = await resolve9routerKey(options, signal, label);
        throwIfAborted(label, signal);
        const json = await dispatchJson({
            url: `${options.baseUrl}/v1/search`,
            headers: { authorization: `Bearer ${apiKey}` },
            body: {
                model: options.searchModel,
                query: request.query,
                search_type: options.searchType,
                max_results: request.maxResults ?? DEFAULT_MAX_RESULTS
            },
            signal,
            label,
            timeoutMs: options.timeoutMs,
            fetchImpl: this.fetchImpl
        });
        return mapSearchResponse(json);
    }
}

/** 9router 抓取 provider：主路径走 9router，失败或关闭开关时回退内置抓取。 */
export class RouterFetchProvider {
    id = FETCH_PROVIDER_ID;
    constructor(resolveOptions, fetchImpl = globalThis.fetch) {
        this.resolveOptions = resolveOptions;
        this.fetchImpl = fetchImpl;
    }

    /** 纯本地检查，绝不发网络请求。 */
    available() {
        return URL.canParse(this.resolveOptions().baseUrl);
    }

    async fetch(request, signal) {
        const options = this.resolveOptions();
        const label = "9router fetch";
        throwIfAborted(label, signal);
        if (!options.enabled) {
            if (!options.fallbackToBuiltin) {
                throw new WebError("9router fetch is disabled and the builtin fallback is turned off; enable one of them in Settings > Plugins > 9router-web-search", "WEB_PROVIDER_ERROR");
            }
            return await builtinFetch(request.url, signal, options.timeoutMs, this.fetchImpl);
        }
        try {
            return await this.fetchVia9router(options, request, signal);
        } catch (error) {
            if (signal?.aborted === true) throw abortedError(label, signal, error);
            if (error instanceof WebError && error.code === "WEB_ABORTED") throw error;
            if (!options.fallbackToBuiltin) throw error;
            options.warn(`9router-web-search: 9router fetch failed, falling back to the builtin HTTP fetch: ${String(error)}`, error);
            return await fetchFallback(label, error, options, request, signal, this.fetchImpl);
        }
    }

    /** 主路径：POST {baseUrl}/v1/web/fetch。 */
    async fetchVia9router(options, request, signal) {
        const label = "9router fetch";
        throwIfAborted(label, signal);
        const apiKey = await resolve9routerKey(options, signal, label);
        throwIfAborted(label, signal);
        const json = await dispatchJson({
            url: `${options.baseUrl}/v1/web/fetch`,
            headers: { authorization: `Bearer ${apiKey}` },
            body: {
                model: options.fetchModel,
                url: request.url,
                format: "markdown"
            },
            signal,
            label,
            timeoutMs: options.timeoutMs,
            fetchImpl: this.fetchImpl
        });
        return mapFetchResponse(json, request.url);
    }
}

// ============================================================================
// 插件入口
// ============================================================================

/** Cordis loader 诊断用的插件名，同时是建议的 profile entry id（即设置命名空间）。 */
export const name = "9router-web-search";
/** 本 provider 注册进的能力接缝。 */
export const inject = ["web"];

/** 去掉结尾斜杠，容忍用户把 baseUrl 写成含结尾 `/` 的形式。 */
function normalizeBaseUrl(value) {
    return typeof value === "string" ? value.replace(/\/+$/u, "") : value;
}

/**
 * 把当前 live 配置投影成一次操作使用的选项。
 * 每次调用都重新读取（不缓存快照），因此设置面板的改动无需重启即可生效。
 */
function resolveOptions(ctx, config) {
    return {
        enabled: config.enabled.get(),
        baseUrl: normalizeBaseUrl(config.baseUrl.get()),
        apiKey: config.apiKey.get(),
        apiKeyEnv: config.apiKeyEnv.get(),
        searchModel: config.searchModel.get(),
        fetchModel: config.fetchModel.get(),
        searchType: config.searchType.get(),
        timeoutMs: config.timeoutMs.get(),
        fallbackToBuiltin: config.fallbackToBuiltin.get(),
        credentials: ctx.get("credentials"),
        launchEnvironment: launchEnvironmentOf(ctx),
        warn: (message, error) => {
            ctx.logger.warn(message);
            if (error !== undefined) ctx.logger.warn(error);
        }
    };
}

/**
 * 插件启用时把 `web` 的 provider 选择强制写回 9router。
 *
 * 为什么需要：0.2.1 起内置「网页搜索」页的开关会改写 `web.searchProvider` /
 * `web.fetchProvider`，且用户层补丁优先级高于本插件的 bundle 层。一旦被改走，
 * seam 就不再调用本插件，`enabled` 与 `fallbackToBuiltin` 都会失效。
 *
 * 只用公开服务：`settings.describe()` 读取生效值，`settings.update()` 写回。
 * 写入放在微任务里，避免在 `settings/document-updated` 的同步派发中重入
 * `describe()`；写回值与 bundle 层一致时，settings 会直接删除用户层覆盖。
 * 关闭插件开关后本守卫不再写入，把 provider 选择权交还内置页面。
 */
function installWebSelectionGuard(ctx, config) {
    let disposed = false;
    let scheduled = false;
    const pin = () => {
        if (disposed || !config.enabled.get()) return;
        const settings = ctx.get("settings");
        if (settings === undefined) return;
        let row;
        try {
            row = settings.describe().find((entry) => entry.ns === WEB_ENTRY_ID);
        } catch (error) {
            ctx.logger.warn(`9router-web-search: cannot read the web provider selection: ${String(error)}`);
            return;
        }
        // `web` 行尚未激活（或 schema 允许的 null 配置）时不要写，等下一次设置事件。
        const value = row?.value;
        if (value === undefined || value === null) return;
        if (value.searchProvider === SEARCH_PROVIDER_ID && value.fetchProvider === FETCH_PROVIDER_ID) return;
        ctx.logger.warn("9router-web-search: the plugin is enabled, restoring web.searchProvider/fetchProvider to 9router");
        settings.update(WEB_ENTRY_ID, {
            searchProvider: SEARCH_PROVIDER_ID,
            fetchProvider: FETCH_PROVIDER_ID
        }).then(() => {
            // 写回成功后再复查一次：内置页面若在本次写入之后又落一笔，那里会再次被纠正。
            schedule();
        }, (error) => {
            ctx.logger.warn(`9router-web-search: cannot restore the web provider selection: ${String(error)}`);
        });
    };
    const schedule = () => {
        if (disposed || scheduled) return;
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            pin();
        });
    };
    ctx.effect(() => () => {
        disposed = true;
    }, "9router-web-search: selection guard");
    // settings 由 base 的 settings 行提供；headless 等未挂载它的组合里守卫保持惰性。
    ctx.inject(["settings"], (scope) => {
        scope.on("settings/document-updated", schedule);
        // 启动时用户层可能已经保存了别的选择。
        schedule();
    });
}

/** 把 9router 的搜索与抓取 provider 注册进 ctx.web。 */
export function apply(ctx, config) {
    const resolve = () => resolveOptions(ctx, config);
    ctx.web.registerSearchProvider(new RouterSearchProvider(resolve));
    ctx.web.registerFetchProvider(new RouterFetchProvider(resolve));
    installWebSelectionGuard(ctx, config);
}
