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

动作清单在 `plugins/quick-actions/hooks/actions.ts`，**改完存盘即热重载**，不用重启 Claude Code：

```ts
export const ACTIONS: QuickAction[] = [
  { hotkey: "1", label: "看改动", kind: "fill",    text: "用中文说明当前 git 工作区的改动内容和影响范围。" },
  { hotkey: "3", label: "提交",   kind: "command", text: "commit" },
  { hotkey: "9", label: "收工",   kind: "prompt",  text: "把今天的改动整理成一条提交并推送。" },
]
```

| 字段 | 说明 |
|---|---|
| `hotkey` | 一个数字（`0`-`9`）或一个小写字母。输入框为空时按下即触发 |
| `label` | 画在按钮上的文字 |
| `kind` | `command` / `prompt` / `fill`，见下表 |
| `text` | `command` 填命令名（不带 `/`）；`prompt` 和 `fill` 填正文 |

三种 `kind`：

| kind | 行为 | 适合 |
|---|---|---|
| `command` | 运行斜杠命令，`"commit"` → `/commit` | 复用你已有的 slash command 和 skill |
| `prompt` | 直接提交给模型，不用回车 | 一句话就能说清、不需要改的固定指令 |
| `fill` | 只填进输入框，你补完再回车 | 需要补细节的模板，比如「帮我看下 ___」 |

`BAND_LABEL` 改按钮左边那个提示词，设成 `""` 就不画。

装在 marketplace 下的插件会随 `/plugin update` 覆盖，想让自己的配置不被冲掉，fork 一份这个仓库改，或者把插件目录 clone 到 `~/.claude/skills/quick-actions/`（那个位置会自动加载，也一样热重载）。

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
hooks/quick-actions.tsx   register(on) 注册 ui.render hook，按 ACTIONS 画一排 Button
hooks/actions.ts          你的动作清单
```

按钮的 `onPress` 留在插件自己的环境里，按下时调 `$.command.run` / `$.prompt.submit` / `$.prompt.fill`。

`claude plugin validate <dir>` 可以在开会话之前，按引擎的读法检查插件会注册什么、调用什么、有没有会被拒绝的地方。

## 已知限制

- **API 是 early access**，Claude Code 版本升级可能改接口。真出问题的表现是按钮不画，不影响正常使用。
- `kind: "prompt"` 发出去的消息，模型那边会看到一层「The quick-actions plugin sent a message: …」的包装说明。介意的话用 `command` 或 `fill`。
- 按钮带只在终端界面（`terminal` surface）上画。
- 数字键触发要求输入框为空，这是引擎的规则，不是插件能改的。

## License

MIT
