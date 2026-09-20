# Claude Code Quick Actions

在 Claude Code 输入框正上方常驻一排快捷动作。输入框为空时按对应数字键，直接发送常用 prompt、运行斜杠命令，或把草稿填进输入框。

```
快捷 1: 看改动 2: 跑测试 3: 提交 4: 状态 5: 上下文                              [-]
────────────────────────────────────────────────────────────────────────────────
❯
```

[English](README.en.md) · 同系列：[dsh-quick-actions](https://github.com/lovvvve/dsh-quick-actions)（DSH 消息编辑器的快捷动作）

## 前置条件

这个插件用的是 Claude Code 的 **function hooks 插件 API**，目前是 early access，默认被一个 rollout flag 关着。在 `~/.claude/settings.json` 里打开它：

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"
  }
}
```

没开这一行，插件会被静默跳过——按钮不出现，也不报错。`claude --debug` 的日志里会写明原因（`tengu_plugin_hooks_modules` is off）。

需要 Claude Code 2.1.278 或更新。

## 安装

```
/plugin marketplace add lovvvve/claude-code-quick-actions
/plugin install quick-actions@claude-code-quick-actions
```

重开一个会话，按钮带就在输入框上方了。

## 配置

三层，就近优先，都可以不存在：

| 优先级 | 位置 | 适合 |
|---|---|---|
| 1 | `<项目>/.claude/quick-actions.json` | 这个项目专用的动作 |
| 2 | `~/.claude/quick-actions.json` | 你到哪都想要的那几个 |
| 3 | `plugins/quick-actions/hooks/actions.ts` | 插件自带的默认，前两个都没有时用 |

**改 JSON 不用重启，也不用重载**——插件每 2 秒看一眼文件的 mtime，变了就换上。新建、修改、删除、在项目间切换都是热的。

写法两种，数组或带 `label` 的对象：

```json
[
  { "hotkey": "1", "label": "确认", "kind": "prompt", "text": "确认" },
  { "hotkey": "2", "label": "继续", "kind": "prompt", "text": "继续" }
]
```

```json
{
  "label": "快捷",
  "actions": [
    { "hotkey": "1", "label": "提交并推送", "kind": "command", "text": "gcmp" },
    { "hotkey": "q", "label": "看改动",   "kind": "fill",    "text": "说明当前 git 工作区的改动和影响范围。" }
  ]
}
```

| 字段 | 说明 |
|---|---|
| `hotkey` | 一个数字（`0`-`9`）或一个小写字母。输入框为空时按下即触发 |
| `label` | 画在按钮上的文字 |
| `kind` | `command` / `prompt` / `fill`，见下表 |
| `text` | `command` 填命令名（不带 `/`）；`prompt` 和 `fill` 填正文 |

顶层的 `label` 改按钮左边那个提示词，设成 `""` 就不画；不写则沿用插件默认。

三种 `kind`：

| kind | 行为 | 适合 |
|---|---|---|
| `command` | 运行斜杠命令，`"commit"` → `/commit` | 复用你已有的 slash command 和 skill |
| `prompt` | 直接提交给模型，不用回车 | 一句话就能说清、不需要改的固定指令 |
| `fill` | 只填进输入框，你补完再回车 | 需要补细节的模板，比如「帮我看下 ___」 |

JSON 写坏了不会让按钮消失：插件留着上一份能用的，并在 transcript 里说一句哪个文件、错在哪，同一个错只说一次。

### 改插件自带的默认

`actions.ts` 是前两层都没有时的兜底。改它要看你是怎么装的：

| 安装方式 | 改 `actions.ts` 后 |
|---|---|
| `/plugin marketplace add`（上面那条） | **要重启会话**。`/reload-plugins` 不重载 function hooks 模块，它报的 `0 hooks` 不含这类插件 |
| `claude --plugin-dir <目录>` | 存盘即生效，目录被 watch |
| clone 到 `~/.claude/skills/quick-actions/` | 存盘即生效，这个位置会自动加载并被 watch |

日常调整走 JSON 就行，那条路在哪种安装方式下都是热的，也不会被 `/plugin update` 冲掉。

## 键位

| 操作 | 键 |
|---|---|
| 触发某个动作 | 输入框为空时直接按它的 `hotkey` |
| 折叠 / 展开按钮带 | `ctrl+x ctrl+a`，或点右边的 `[-]` |
| 把焦点移进按钮带 | `ctrl+x tab`，或鼠标点击 |
| 焦点在带里时走按钮 | `Tab` / `←` `→`，`Enter` 按下，`Esc` 回输入框 |

输入框里已经有内容时，数字键就是普通字符，不会误触。

## 原理

Claude Code 的 function hooks 插件可以在 `ui.render` 事件里接管界面上的各个位置。这个插件只接管一处：`AbovePrompt`——输入框正上方那条带，引擎自己不在那儿画任何东西。

```
hooks/hooks.json          modules 指向下面的模块
hooks/quick-actions.tsx   register(on)：session.start 找配置并起轮询，ui.render 画一排 Button
hooks/config.ts           JSON 的解析与校验，纯函数，碰不到引擎
hooks/actions.ts          插件自带的默认清单
```

按钮的 `onPress` 留在插件自己的环境里，按下时调 `$.command.run` / `$.prompt.submit` / `$.prompt.fill`。

配置走的是 `session.start` 里起的一个 `$.clock.every(2000)`：`$.fs.stat` 比对 mtime，变了才 `$.fs.read` 重读，解析成功就换上清单并 `$.ui.invalidate("ui.render")` 请求重画。所以它不依赖 Claude Code 对插件目录的 watch，哪种安装方式下都是热的。

`claude plugin validate <dir>` 可以在开会话之前，按引擎的读法检查插件会注册什么、调用什么、有没有会被拒绝的地方。

## 已知限制

- **API 是 early access**，Claude Code 版本升级可能改接口。真出问题的表现是按钮不画，不影响正常使用。
- `kind: "prompt"` 发出去的消息，模型那边会看到一层「The quick-actions plugin sent a message: …」外加一句解释。这层包装**去不掉**：插件自己提交的 prompt 不会走自己的 `prompt.submit` hook（引擎防再入，debug 日志里写作 `skipped: re-entry`），所以没法在插件内部把 `origin` 抹掉。实测模型能正确把它当成你说的话处理，只是多占几行上下文。介意的话改用 `fill`——代价是多按一次回车。
- 按钮带只在终端界面（`terminal` surface）上画。
- 数字键触发要求输入框为空，这是引擎的规则，不是插件能改的。

## License

MIT
