window.__ModuleLoader__.load({
	id: "9router-web-search",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const React = require("react");
		const { jsx, jsxs } = require("react/jsx-runtime");
		//#region lib/client/ui-port.js
		/**
		 * 从 `@deepseek-ai/dsh-client-ui-primitives` 移植的控件与表单内核。
		 *
		 * 为什么不用原包：官方 references/practices.md:35 禁止客户端插件 require 任何
		 * Harness Client 包。该包虽是平台种子模块（当前可用），但其 API 不受
		 * semver 约束、手写 JS 也无类型检查，一旦不兼容会让**整个 slot 条目变空白**
		 * （控制台 `slot entry crashed`）。移植后本插件只依赖 react 与主题 token，
		 * DSH 升级最多让外观降级，不会让插件崩掉。
		 *
		 * 移植保真度：保留「暂存编辑 + 保存按钮 + 修订栅栏」的完整语义；类名统一加
		 * `dsh-9rws-` 前缀以免与宿主样式冲突；颜色只用 `--dsw-*` token。
		 * 未移植原包中本插件用不到的可选能力（`help` 信息按钮、`numeric`/`placeholder`
		 * 透传、`className` 透传），因此没有对应的无测试覆盖的死代码。
		 * 依赖：`SettingsFormModel` 原实现使用 `@deepseek-ai/dsh-client-store` 的
		 * `createSnapshotStore`；此处改为等价的极小实现，以彻底断开该依赖。
		 */
		/** 移植控件的样式表内容。 */
		const CSS_TEXT = `
.dsh-9rws-switch { box-sizing: border-box; position: relative; flex: 0 0 auto; width: 36px; height: 20px; padding: 2px; border: 0; border-radius: 999px; corner-shape: round; background: var(--dsw-alias-border-l3); cursor: pointer; }
.dsh-9rws-switch[aria-checked='true'] { background: var(--dsw-alias-brand-primary); }
.dsh-9rws-switch:disabled { cursor: default; opacity: 0.5; }
.dsh-9rws-switch:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 2px; }
.dsh-9rws-switch-thumb { display: block; width: 16px; height: 16px; border-radius: 50%; corner-shape: round; background: var(--dsw-alias-label-primary-foreground); transition: transform 120ms ease; }
.dsh-9rws-switch[aria-checked='false'] .dsh-9rws-switch-thumb { background: var(--dsw-alias-switch-thumb); }
.dsh-9rws-switch[aria-checked='true'] .dsh-9rws-switch-thumb { transform: translateX(16px); }
.dsh-9rws-tag { display: inline-flex; align-items: center; border-radius: 999px; corner-shape: round; padding: 1px 8px; font-size: 11px; line-height: 17px; font-weight: 500; white-space: nowrap; }
.dsh-9rws-tag[data-tone='outline'] { border: 0.5px solid var(--dsw-alias-border-l4); color: var(--dsw-alias-label-tertiary); }
.dsh-9rws-tag[data-tone='neutral'] { background: var(--dsw-alias-bg-module-platform); color: var(--dsw-alias-label-secondary); }
.dsh-9rws-tag[data-tone='quiet'] { color: var(--dsw-alias-label-tertiary); }
.dsh-9rws-field { display: flex; flex-direction: column; gap: 6px; padding: 12px 0; }
.dsh-9rws-field + .dsh-9rws-field { border-top: 0.5px solid var(--dsw-alias-border-l2); }
.dsh-9rws-head { display: flex; align-items: center; gap: 8px; }
.dsh-9rws-label { flex: 1; min-width: 0; font-size: 13px; font-weight: 500; line-height: 1.5; color: var(--dsw-alias-label-primary); }
.dsh-9rws-badges { display: inline-flex; align-items: center; gap: 8px; }
.dsh-9rws-reset { border: none; background: none; padding: 0; font: inherit; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); cursor: pointer; }
.dsh-9rws-reset:hover:not(:disabled) { color: var(--dsw-alias-label-primary); }
.dsh-9rws-reset:disabled { cursor: default; }
.dsh-9rws-input { height: 34px; padding: 0 12px; border: 0.5px solid var(--dsw-alias-border-l4); border-radius: var(--dsw-radius-md); background: var(--dsw-alias-bg-layer-3); font: inherit; font-size: 13px; line-height: 1.5; color: var(--dsw-alias-label-primary); }
.dsh-9rws-input:focus-visible { outline: none; border-color: var(--dsw-alias-state-business-primary); }
.dsh-9rws-input:disabled { color: var(--dsw-alias-label-tertiary); cursor: default; }
.dsh-9rws-input[aria-invalid='true'] { border-color: var(--dsw-alias-state-error-primary); }
.dsh-9rws-invalid { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-state-error-primary); }
.dsh-9rws-hint { margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.dsh-9rws-form { display: flex; flex-direction: column; }
.dsh-9rws-readOnly, .dsh-9rws-unavailable { margin: 0 0 12px; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-tertiary); }
.dsh-9rws-footer { display: flex; align-items: center; gap: 8px; padding-top: 16px; }
.dsh-9rws-failed { flex: 1; min-width: 0; margin: 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-error); }
.dsh-9rws-save { appearance: none; border: 1px solid transparent; border-radius: var(--dsw-radius-md); padding: 5px 14px; font: inherit; font-size: 13px; line-height: 1.5; cursor: pointer; background: var(--dsw-alias-label-primary); color: var(--dsw-alias-bg-layer-3); }
.dsh-9rws-save:disabled { opacity: 0.4; cursor: default; }
.dsh-9rws-save:focus-visible { outline: var(--dsw-focus-ring-width) solid var(--dsw-focus-ring-color, var(--dsw-alias-state-business-primary)); outline-offset: 1px; }
`;
		/**
		 * 把移植控件的样式挂到文档上。
		 * 每次调用新建一个 style 元素并返回移除器：同一批规则重复存在无副作用，
		 * 而按 id 复用会在 HMR 重挂时让先卸载的那一份把仍在用的样式删掉。
		 * @returns 移除本元素并恢复文档的清理函数。
		 */
		function mountStyles() {
			const el = document.createElement("style");
			el.textContent = CSS_TEXT;
			document.head.appendChild(el);
			return () => {
				el.remove();
			};
		}
		/**
		 * 渲染一个只读胶囊徽标。
		 * @param props.tone - 配色档（默认 outline）。
		 * @param props.children - 由调用方提供的本地化文案。
		 * @returns 徽标元素。
		 */
		function Tag(props) {
			return jsx("span", {
				className: "dsh-9rws-tag",
				"data-tone": props.tone === undefined ? "outline" : props.tone,
				children: props.children
			});
		}
		/**
		 * 渲染两态开关。
		 * @param props.checked - 当前状态；控件完全受控。
		 * @param props.onChange - 点击请求切换到的状态。
		 * @param props.label - 本地化的无障碍名称，由渲染方提供。
		 * @param props.disabled - 是否拒绝输入。
		 * @returns 开关元素。
		 */
		function Switch(props) {
			return jsx("button", {
				type: "button",
				role: "switch",
				"aria-checked": props.checked,
				"aria-label": props.label,
				disabled: props.disabled,
				className: "dsh-9rws-switch",
				onClick: () => {
					props.onChange(!props.checked);
				},
				children: jsx("span", { className: "dsh-9rws-switch-thumb" })
			});
		}
		/**
		 * 一个暂存取值字段：标签、暂存文本、覆盖徽标与重置、说明或校验提示。
		 * 本控件不写入；它只报告用户输入，落盘由表单的保存统一发起。
		 * @param props - 字段文案、暂存文本与编辑动作。
		 * @returns 带标签的控件。
		 */
		function SettingsValueField(props) {
			const messageId = `${props.id}-message`;
			const hasMessage = props.invalid || Boolean(props.hint);
			return jsxs("div", {
				className: "dsh-9rws-field",
				children: [
					jsxs("div", {
						className: "dsh-9rws-head",
						children: [
							jsx("label", {
								className: "dsh-9rws-label",
								htmlFor: props.id,
								children: props.label
							}),
							props.overridden
								? jsxs("span", {
									className: "dsh-9rws-badges",
									children: [
										jsx(Tag, { tone: "neutral", children: props.overriddenLabel }),
										jsx("button", {
											type: "button",
											className: "dsh-9rws-reset",
											disabled: props.disabled,
											onClick: props.onReset,
											children: props.resetLabel
										})
									]
								})
								: null
						]
					}),
					jsx("input", {
						id: props.id,
						className: "dsh-9rws-input",
						type: "text",
						...props.invalid ? { "aria-invalid": true } : {},
						"aria-describedby": hasMessage ? messageId : undefined,
						value: props.text,
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					hasMessage
						? jsx("p", {
							id: messageId,
							className: props.invalid ? "dsh-9rws-invalid" : "dsh-9rws-hint",
							children: props.invalid ? props.invalidLabel : props.hint
						})
						: null
				]
			});
		}
		/**
		 * 一个只写凭据控件。字面量不会经过响应，因此控件只报告是否已配置并从空白
		 * 开始；空白草稿不写入任何内容，从而保留已存密钥而不是清除它。
		 * @param props - 字段文案、暂存文本与已配置状态。
		 * @returns 带标签的控件。
		 */
		function SettingsSecretField(props) {
			return jsxs("div", {
				className: "dsh-9rws-field",
				children: [
					jsxs("div", {
						className: "dsh-9rws-head",
						children: [
							jsx("label", {
								className: "dsh-9rws-label",
								htmlFor: props.id,
								children: props.label
							}),
							jsx("span", {
								className: "dsh-9rws-badges",
								children: jsx(Tag, {
									tone: props.configured ? "neutral" : "quiet",
									children: props.stateLabel
								})
							})
						]
					}),
					jsx("input", {
						id: props.id,
						className: "dsh-9rws-input",
						type: "password",
						autoComplete: "new-password",
						value: props.text,
						disabled: props.disabled,
						onChange: (event) => {
							props.onEdit(event.target.value);
						}
					}),
					jsx("p", { className: "dsh-9rws-hint", children: props.hint })
				]
			});
		}
		/**
		 * 渲染一个插件的设置表单：只读提示、控件，以及写入全部暂存编辑的保存。
		 * 只有保存会写入。离开页面时丢弃全部暂存编辑，故表单在卸载时丢弃、不设放弃控件。
		 * @param props - 表单文案与状态、控件，以及保存与放弃动作。
		 * @returns 表单；命名空间未被服务时返回不可用提示。
		 */
		function SettingsForm(props) {
			const { state, labels } = props;
			const discard = React.useRef(props.onDiscard);
			discard.current = props.onDiscard;
			React.useEffect(() => () => {
				discard.current();
			}, []);
			if (!state.available) return jsx("p", { className: "dsh-9rws-unavailable", role: "status", children: labels.unavailable });
			const blocked = !state.dirty || state.invalid || state.saving;
			return jsxs("div", {
				className: "dsh-9rws-form",
				children: [
					!state.writable ? jsx("p", { className: "dsh-9rws-readOnly", role: "status", children: labels.readOnly }) : null,
					props.children,
					jsxs("div", {
						className: "dsh-9rws-footer",
						children: [
							state.failed ? jsx("p", { className: "dsh-9rws-failed", role: "status", children: labels.saveFailed }) : null,
							jsx("button", {
								type: "button",
								className: "dsh-9rws-save",
								disabled: blocked,
								onClick: props.onSave,
								children: state.saving ? labels.saving : labels.save
							})
						]
					})
				]
			});
		}
		/**
		 * 极简快照存储，满足渲染层选择器所需的 subscribe/getSnapshot。
		 * getSnapshot 在未变更时返回同一引用，否则选择器会无限重渲染。
		 * @param initial - 初始状态。
		 * @returns 快照存储。
		 */
		function createSnapshotStore(initial) {
			let state = initial;
			const listeners = new Set();
			return {
				getSnapshot: () => state,
				subscribe: (listener) => {
					listeners.add(listener);
					return () => {
						listeners.delete(listener);
					};
				},
				set: (next) => {
					state = next;
					for (const listener of [...listeners]) listener();
				}
			};
		}
		/**
		 * 整数字段：空草稿清除该字段，其它非有限数的草稿阻止保存。
		 * @param field - 命名空间节内的字段名。
		 * @returns 该字段的转换规格。
		 */
		function settingsNumberField(field) {
			return {
				field,
				format: (value) => typeof value === "number" ? String(value) : "",
				parse: (text) => {
					const trimmed = text.trim();
					if (trimmed === "") return { kind: "clear" };
					const parsed = Number(trimmed);
					return Number.isFinite(parsed) ? { kind: "set", value: parsed } : undefined;
				}
			};
		}
		/**
		 * 自由文本字段：空草稿清除该字段，故清空控件再保存与重置是同一动作。
		 * @param field - 命名空间节内的字段名。
		 * @returns 该字段的转换规格。
		 */
		function settingsTextField(field) {
			return {
				field,
				format: (value) => typeof value === "string" ? value : "",
				parse: (text) => {
					const trimmed = text.trim();
					return trimmed === "" ? { kind: "clear" } : { kind: "set", value: trimmed };
				}
			};
		}
		/**
		 * 在一个设置命名空间上暂存一张卡片的编辑，并在保存时写入。
		 *
		 * 表单通过快照存储发布：槽位组件经选择器读快照，而作用域与本机草稿都会变化，
		 * 因此每次投影都由二者重新构造。
		 */
		var SettingsFormModel = class {
			/**
			 * @param scope - 本卡片命名空间的共享配置表单。
			 * @param specs - 本卡片编辑的节字段。
			 * @param secrets - 卡片的只写控件，写在节之外。
			 */
			constructor(scope, specs, secrets) {
				this.scope = scope;
				this.staged = new Map();
				this.listeners = new Set();
				this.baseline = undefined;
				this.saving = false;
				this.failed = false;
				this.specs = new Map(specs.map((spec) => [spec.field, spec]));
				this.secretSpecs = new Map((secrets === undefined ? [] : secrets).map((spec) => [spec.field, spec]));
				this.unsubscribe = scope.subscribe(() => {
					this.publish();
				});
			}
			/**
			 * 发布本表单的一个投影，作用域或草稿变化时重建。
			 * @param project - 由表单当前读数构造卡片状态。
			 * @returns 卡片组件经其绑定选择器读取的存储。
			 */
			bind(project) {
				const store = createSnapshotStore(project());
				this.listeners.add(() => {
					store.set(project());
				});
				return store;
			}
			/**
			 * 读取卡片级状态：宿主服务了什么，以及一次保存会做什么。
			 * @returns 每张卡片共享的表单状态。
			 */
			shell() {
				const snapshot = this.scope.getSnapshot();
				const plan = this.plan();
				return {
					available: snapshot.status === "ready",
					writable: snapshot.writable,
					dirty: plan.length > 0,
					invalid: plan.some((item) => item.run === undefined && item.op === undefined),
					saving: this.saving,
					failed: this.failed
				};
			}
			/**
			 * 读取一个控件的状态。
			 * @param field - 节字段或只写控件的字段名。
			 * @returns 草稿文本、一次保存是否会留下覆盖、以及是否非法。
			 */
			field(field) {
				const staged = this.staged.get(field);
				if (this.secretSpecs.has(field)) {
					return { text: staged === undefined ? "" : staged.text, overridden: false, invalid: false };
				}
				const spec = this.spec(field);
				if (staged === undefined) {
					return { text: spec.format(this.sectionValue(field)), overridden: this.stored(field), invalid: false };
				}
				const write = staged.clear ? { kind: "clear" } : spec.parse(staged.text);
				return {
					text: staged.text,
					overridden: write !== undefined && write.kind === "set",
					invalid: write === undefined
				};
			}
			/**
			 * 构造绑定到本表单的编辑、重置、保存与放弃动作。
			 * @returns 卡片槽位注册所注入的动作。
			 */
			actions() {
				return {
					edit: (field, text) => {
						this.stage(field, { text, clear: false });
					},
					resetField: (field) => {
						this.stage(field, { text: this.spec(field).format(this.baseValue(field)), clear: true });
					},
					save: () => {
						void this.save();
					},
					discard: () => {
						if (this.staged.size === 0 && !this.failed) return;
						this.staged.clear();
						this.baseline = undefined;
						this.failed = false;
						this.publish();
					}
				};
			}
			/**
			 * 写入全部暂存编辑，再从宿主接受的内容重新播种。
			 *
			 * 宿主是值是否被接受的唯一权威——它的校验器负责 schema 无法表达的约束——
			 * 因此结果从节里读回而不是在此预测。未落盘的保存保留草稿，供用户改正
			 * 而不是重新输入。
			 * @returns 全部写入与回读完成后的结算。
			 */
			async save() {
				const plan = this.plan();
				if (!plan.length || this.saving || !this.scope.getSnapshot().writable
					|| plan.some((item) => item.run === undefined && item.op === undefined)) return;
				this.saving = true;
				this.failed = false;
				this.publish();
				try {
					const ops = plan.flatMap((item) => item.op === undefined ? [] : [item.op]);
					let landed = !ops.length || await this.scope.mutate(ops, this.baseline === undefined ? undefined : this.baseline.revision);
					if (!landed) {
						this.failed = true;
						return;
					}
					for (const item of plan) if (item.run) landed = await item.run() && landed;
					if (landed) {
						this.staged.clear();
						this.baseline = undefined;
					}
					this.failed = !landed;
				} catch (_error) {
					this.failed = true;
				} finally {
					this.saving = false;
					this.publish();
				}
			}
			/** 释放表单对已接受值的订阅。 */
			dispose() {
				this.unsubscribe();
				this.listeners.clear();
			}
			/**
			 * 一次保存会写入的全部暂存编辑。草稿不是其字段可接受的值时该条不带写入：
			 * 表单仍是脏的，保存会拒绝而不是丢弃该编辑。
			 * @returns 计划写入项，按字段被暂存的顺序。
			 */
			plan() {
				const plan = [];
				for (const [field, staged] of this.staged) {
					const secret = this.secretSpecs.get(field);
					if (secret !== undefined) {
						const value = staged.text.trim();
						if (value !== "") plan.push({ field, run: () => secret.write(value) });
						continue;
					}
					const spec = this.spec(field);
					if (staged.clear) {
						if (this.stored(field)) plan.push({ field, op: { op: "unset", path: [field] } });
						continue;
					}
					if (staged.text === spec.format(this.sectionValue(field))) continue;
					const write = spec.parse(staged.text);
					if (write === undefined) plan.push({ field });
					else if (write.kind === "clear") plan.push({ field, op: { op: "unset", path: [field] } });
					else plan.push({ field, op: { op: "set", path: [field], value: write.value } });
				}
				return plan;
			}
			stage(field, edit) {
				if (this.baseline === undefined) this.baseline = this.scope.getSnapshot();
				this.staged.set(field, edit);
				this.failed = false;
				this.publish();
			}
			spec(field) {
				const spec = this.specs.get(field);
				// 每个调用点都命名了本卡片声明过的字段；缺失属接线错误，
				// 不能退化成静默失效的控件。
				if (spec === undefined) throw new Error(`plugin card has no field ${field}`);
				return spec;
			}
			snapshotOf() {
				return this.scope.getSnapshot();
			}
			sectionValue(field) {
				const value = this.snapshotOf().value;
				return value === undefined ? undefined : value[field];
			}
			baseValue(field) {
				const base = this.snapshotOf().base;
				return base === undefined ? undefined : base[field];
			}
			userLayer() {
				return this.snapshotOf().user;
			}
			stored(field) {
				const user = this.userLayer();
				return user !== undefined && Object.prototype.hasOwnProperty.call(user, field);
			}
			publish() {
				for (const listener of this.listeners) listener();
			}
		};
		/** 移植后的控件集合；键名与原包一致，故下方渲染代码逐字不变。 */
		const primitives = {
			Switch,
			SettingsValueField,
			SettingsSecretField,
			SettingsForm,
			SettingsFormModel,
			settingsTextField,
			settingsNumberField
		};
		//#endregion
		//#region lib/client/locales.js
		/** 9router 设置面板的双语文案。 */
		const en = {
			title: "9Router web search",
			description: "Route web search and page fetching through a local 9router instance.",
			enabled: "Enable the 9router provider",
			enabledHint: "When on, 9router is forced as the search and fetch provider; the provider switch on the built-in Web search page is restored to 9router. When off, dsh falls back to its built-in implementation.",
			baseUrl: "Endpoint",
			baseUrlHint: "Base address of the 9router service.",
			apiKey: "API key",
			apiKeyHint: "Stored outside the settings file. Leave blank to keep the current key.",
			apiKeySet: "A key is configured.",
			apiKeyUnset: "No key is configured; the key reference below is resolved instead.",
			apiKeyEnv: "Key reference",
			apiKeyEnvHint: "Environment variable or credential name the key is read from.",
			searchModel: "Search model",
			searchModelHint: "Model 9router uses for web search.",
			fetchModel: "Fetch model",
			fetchModelHint: "Model 9router uses for page fetching.",
			searchType: "Search type",
			searchTypeHint: "Search mode handed to 9router.",
			timeoutMs: "Timeout (ms)",
			timeoutMsHint: "How long one search or fetch may run before it is aborted.",
			fallbackToBuiltin: "Fall back to the built-in provider",
			fallbackToBuiltinHint: "When 9router fails, retry with dsh's built-in web provider.",
			overridden: "Overridden",
			reset: "Reset to default",
			readOnly: "This deployment stores settings read-only.",
			unavailable: "This plugin is not loaded, so it cannot be configured right now.",
			save: "Save",
			saving: "Saving…",
			saveFailed: "The deployment did not accept these values; they were left for you to correct.",
			invalidNumber: "Enter a number, or leave blank to use the default."
		};
		const zh = {
			title: "9Router 网页搜索",
			description: "通过本地 9router 服务进行网页搜索与页面抓取。",
			enabled: "启用 9router 提供方",
			enabledHint: "开启时强制使用 9router 作为搜索与抓取 provider，内置「网页搜索」页的 provider 选择会被改回 9router；关闭后回退到内置实现。",
			baseUrl: "接口地址",
			baseUrlHint: "9router 服务的基础地址。",
			apiKey: "API Key",
			apiKeyHint: "不写入设置文件。留空表示保持当前密钥。",
			apiKeySet: "已配置密钥。",
			apiKeyUnset: "未配置密钥；将改为解析下方的密钥引用。",
			apiKeyEnv: "密钥引用",
			apiKeyEnvHint: "读取密钥所用的环境变量或凭据名。",
			searchModel: "搜索模型",
			searchModelHint: "9router 用于网页搜索的模型。",
			fetchModel: "抓取模型",
			fetchModelHint: "9router 用于页面抓取的模型。",
			searchType: "搜索类型",
			searchTypeHint: "交给 9router 的搜索模式。",
			timeoutMs: "超时（毫秒）",
			timeoutMsHint: "单次搜索或抓取在中断前最长可以运行多久。",
			fallbackToBuiltin: "回退到内置提供方",
			fallbackToBuiltinHint: "9router 失败时，改用 dsh 内置的网页提供方重试。",
			overridden: "已覆盖",
			reset: "恢复默认",
			readOnly: "本部署的设置为只读。",
			unavailable: "该插件当前未加载，暂时无法配置。",
			save: "保存",
			saving: "保存中…",
			saveFailed: "本部署没有接受这些值，已保留供你修改。",
			invalidNumber: "请填数字；留空表示使用默认值。"
		};
		/**
		 * 共享设置表单外壳读取的文案。
		 * @param t - 本页字典的读取函数。
		 * @returns SettingsForm 需要的标签集合。
		 */
		function formLabels(t) {
			return {
				unavailable: t("unavailable"),
				readOnly: t("readOnly"),
				saveFailed: t("saveFailed"),
				save: t("save"),
				saving: t("saving")
			};
		}
		//#endregion
		//#region lib/client/fields.js
		/**
		 * 布尔字段的取值规格。
		 *
		 * primitives 只导出 settingsTextField / settingsNumberField；布尔字段沿用同一
		 * 约定自建规格（只做 format/parse 转换，不是控件），控件仍由 primitives 真实
		 * 导出的 Switch 渲染。
		 * @param field - 命名空间节内的字段名。
		 * @returns 该字段的转换规格。
		 */
		function settingsBooleanField(field) {
			return {
				field,
				format: (value) => value === false ? "false" : "true",
				parse: (text) => ({
					kind: "set",
					value: text === "true"
				})
			};
		}
		/**
		 * 一行开关（标签 + primitives 的 Switch + 说明）。
		 * @param props - 文案、当前状态与切换动作。
		 * @returns 该行元素。
		 */
		function BooleanRow(props) {
			return jsxs("div", {
				children: [
					jsx("span", { children: props.label }),
					jsx(primitives.Switch, {
						checked: props.checked,
						label: props.label,
						disabled: props.disabled,
						onChange: props.onChange
					}),
					jsx("p", { children: props.hint })
				]
			});
		}
		//#endregion
		//#region lib/client/RouterCard.js
		/**
		 * 按插件页面要求渲染一行摘要或整张设置表单。
		 * @param props - 视图种类、文案、表单快照与动作。
		 * @returns 摘要字符串，或设置表单。
		 */
		function RouterCard(props) {
			const { t } = props;
			const state = props.useRouterCard((snapshot) => snapshot);
			if (props.view === "summary") return t("description");
			const disabled = !state.writable;
			const valueField = (field, id, label, hint) => jsx(primitives.SettingsValueField, {
				id: `plugin-config-9router-web-search-${id}`,
				label: t(label),
				hint: t(hint),
				overriddenLabel: t("overridden"),
				resetLabel: t("reset"),
				invalidLabel: t("invalidNumber"),
				disabled,
				...state[field],
				onEdit: (text) => {
					props.edit(field, text);
				},
				onReset: () => {
					props.resetField(field);
				}
			});
			return jsxs(primitives.SettingsForm, {
				labels: formLabels(t),
				state,
				onSave: props.save,
				onDiscard: props.discard,
				children: [
					jsx(BooleanRow, {
						label: t("enabled"),
						hint: t("enabledHint"),
						checked: state.enabled.text === "true",
						disabled,
						onChange: (next) => {
							props.edit("enabled", next ? "true" : "false");
						}
					}),
					valueField("baseUrl", "base-url", "baseUrl", "baseUrlHint"),
					jsx(primitives.SettingsSecretField, {
						id: "plugin-config-9router-web-search-key",
						label: t("apiKey"),
						hint: t("apiKeyHint"),
						disabled: !state.apiKeyWritable || !state.writable,
						text: state.apiKey.text,
						configured: state.apiKeyConfigured,
						stateLabel: state.apiKeyConfigured ? t("apiKeySet") : t("apiKeyUnset"),
						onEdit: (text) => {
							props.edit("apiKey", text);
						}
					}),
					valueField("apiKeyEnv", "key-ref", "apiKeyEnv", "apiKeyEnvHint"),
					valueField("searchModel", "search-model", "searchModel", "searchModelHint"),
					valueField("fetchModel", "fetch-model", "fetchModel", "fetchModelHint"),
					valueField("searchType", "search-type", "searchType", "searchTypeHint"),
					valueField("timeoutMs", "timeout", "timeoutMs", "timeoutMsHint"),
					jsx(BooleanRow, {
						label: t("fallbackToBuiltin"),
						hint: t("fallbackToBuiltinHint"),
						checked: state.fallbackToBuiltin.text === "true",
						disabled,
						onChange: (next) => {
							props.edit("fallbackToBuiltin", next ? "true" : "false");
						}
					})
				]
			});
		}
		//#endregion
		//#region lib/client/card-controller.js
		/**
		 * 9router 面板在 `9router-web-search` 命名空间上的暂存表单。
		 *
		 * 密钥是唯一不落在设置节里的控件：它的字面量不会经过响应，因此页面只知道
		 * 是否已配置，并按下文引用经 credentials 域读写。它仍与其余字段一起暂存，
		 * 一次保存覆盖整页。
		 */
		/**
		 * 9router 的命名空间。此处手写而不 import：客户端包不得依赖 Host 包。
		 */
		const ROUTER_NS = "9router-web-search";
		/** 若设置节未指定引用，提供方解析的默认凭据引用。 */
		const DEFAULT_API_KEY_REF = "NINEROUTER_API_KEY";
		/** 凭据控件暂存所用的表单字段名。 */
		const API_KEY_FIELD = "apiKey";
		/** 把 `9router-web-search` 作用域与 credentials 域接到页面上。 */
		var RouterCardController = class {
			scope;
			ctx;
			form;
			store;
			unsubscribe;
			credential = {
				ref: "",
				configured: false,
				writable: true
			};
			/**
			 * @param scope - `9router-web-search` 命名空间已绑定的设置作用域。
			 * @param ctx - 页面插件的上下文，其 `remote.credentials` 命名空间负责该引用。
			 */
			constructor(scope, ctx) {
				this.scope = scope;
				this.ctx = ctx;
				this.form = new primitives.SettingsFormModel(scope, [
					settingsBooleanField("enabled"),
					primitives.settingsTextField("baseUrl"),
					primitives.settingsTextField("apiKeyEnv"),
					primitives.settingsTextField("searchModel"),
					primitives.settingsTextField("fetchModel"),
					primitives.settingsTextField("searchType"),
					primitives.settingsNumberField("timeoutMs"),
					settingsBooleanField("fallbackToBuiltin")
				], [{
					field: API_KEY_FIELD,
					write: (text) => this.writeKey(text)
				}]);
				this.store = this.form.bind(() => this.projection());
				this.unsubscribe = scope.subscribe(() => {
					this.readCredential();
				});
				this.readCredential();
			}
			projection() {
				return {
					...this.form.shell(),
					enabled: this.form.field("enabled"),
					baseUrl: this.form.field("baseUrl"),
					apiKeyEnv: this.form.field("apiKeyEnv"),
					searchModel: this.form.field("searchModel"),
					fetchModel: this.form.field("fetchModel"),
					searchType: this.form.field("searchType"),
					timeoutMs: this.form.field("timeoutMs"),
					fallbackToBuiltin: this.form.field("fallbackToBuiltin"),
					apiKey: this.form.field(API_KEY_FIELD),
					apiKeyConfigured: this.credential.configured,
					apiKeyWritable: this.credential.writable
				};
			}
			/**
			 * 询问 credentials 域当前设置节所指的引用。
			 *
			 * 答复与它描述的引用一起存放：apiKeyEnv 可能在请求与响应之间变化，两次读取
			 * 也可能乱序结算，因此只有仍然对应生效引用的响应才会被发布。
			 */
			async readCredential() {
				const ref = refOf(this.scope.getSnapshot());
				if (ref !== this.credential.ref) {
					this.credential = {
						ref,
						configured: false,
						writable: true
					};
					this.store.set(this.projection());
				}
				const response = await this.ctx.remote.credentials.describe([ref]);
				if (!response.ok || ref !== refOf(this.scope.getSnapshot())) return;
				const view = response.value[ref];
				const next = {
					ref,
					configured: view?.configured ?? false,
					writable: view?.writable ?? true
				};
				if (next.configured === this.credential.configured && next.writable === this.credential.writable) return;
				this.credential = next;
				this.store.set(this.projection());
			}
			/**
			 * Host 报告本页关注的引用发生变化后重新读取。
			 *
			 * 密钥可能被别处改写，而设置节不会随之变化；没有这一步，徽标会继续显示
			 * Host 已经替换掉的状态。
			 * @param ref - Host 报告发生变化的引用。
			 */
			refreshCredential(ref) {
				if (ref !== this.credential.ref) return;
				this.readCredential();
			}
			/**
			 * 构造页面槽位注册所注入的注入面。
			 * @returns 页面快照与表单动作。
			 */
			inject() {
				return {
					hooks: { routerCard: this.store },
					...this.form.actions()
				};
			}
			/**
			 * 写入暂存的密钥，然后重新读取 Host 现在是否持有。
			 * @param value - 暂存的凭据字面量。
			 * @returns 写入后 Host 是否报告已配置凭据。
			 */
			async writeKey(value) {
				await this.ctx.remote.credentials.set(refOf(this.scope.getSnapshot()), value);
				await this.readCredential();
				return this.credential.configured;
			}
			/** 释放配置订阅。 */
			dispose() {
				this.unsubscribe();
				this.form.dispose();
			}
		};
		/**
		 * 设置节所指的凭据引用，或提供方默认值。
		 * @param snapshot - 当前作用域快照。
		 * @returns 要寻址的引用。
		 */
		function refOf(snapshot) {
			const declared = snapshot.value?.apiKeyEnv;
			return declared !== void 0 && declared.length > 0 ? declared : DEFAULT_API_KEY_REF;
		}
		//#endregion
		//#region lib/client/index.js
		/**
		 * 9router 设置页的浏览器半：开关、接口地址、密钥、模型与超时都落在
		 * `9router-web-search` 命名空间上。本页只在 Host 提供该命名空间时注册进插件页的
		 * `plugins.item` 槽位，未组合该提供方的部署看不到任何痕迹。
		 */
		/** 本插件拥有的字典命名空间。 */
		const NS = "settings.9routerWebSearch";
		/** 必需服务（cordis fiber inject）。 */
		const inject = [
			"slots",
			"locale",
			"remote",
			"remote.credentials",
			"configForms"
		];
		/**
		 * 在 Host 提供该命名空间期间挂载 9router 设置页。
		 * @param ctx - 浏览器插件上下文。
		 */
		function apply(ctx) {
			const t = ctx.locale.bind(NS);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "9router-web-search: dictionaries");
			// 移植控件的样式随本插件生命周期挂载；没有其它样式途径（客户端包不参与
			// 构建流程，无法附带 CSS Modules）。
			ctx.effect(() => mountStyles(), "9router-web-search: ported control styles");
			const card = new RouterCardController(ctx.configForms.get(ROUTER_NS), ctx);
			ctx.effect(() => () => {
				card.dispose();
			}, "9router-web-search: form subscription");
			ctx.effect(() => ctx.remote.$on("credentials/reference-updated", (ref) => {
				card.refreshCredential(ref);
			}), "9router-web-search: credential invalidations");
			ctx.effect(() => ctx.configForms.whileServed([ROUTER_NS], () => ctx.slots.inject("plugins.item", () => ctx.slots.register({
				name: "plugins.item",
				id: "9router-web-search",
				order: 41,
				label: () => t("title"),
				locale: NS,
				inject: () => card.inject()
			}, RouterCard))), "9router-web-search: page");
		}
		//#endregion
		exports.NS = NS;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
