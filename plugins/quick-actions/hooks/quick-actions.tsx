import type { EngineInterface, Register } from "claude-code"
import { ACTIONS, BAND_LABEL, type QuickAction } from "./actions"
import { parseConfig } from "./config"

/** 多久看一眼配置文件有没有变 */
const POLL_MS = 2000

/** 项目级优先，其次用户级；都没有就用 actions.ts 里的内置默认 */
const PROJECT_CONFIG = ".claude/quick-actions.json"
const USER_CONFIG_LEAF = "/.claude/quick-actions.json"

let actions: QuickAction[] = ACTIONS
let bandLabel: string = BAND_LABEL

/** 按优先级排好的候选路径，session.start 时算一次 */
let candidates: string[] = []
/** 当前生效的配置文件，以及它上次被读到时的 mtime；undefined 表示正在用内置默认 */
let activePath: string | undefined
let activeMtime = -1
/** 上一条抱怨，用来去重，免得轮询把同一条错误刷满屏 */
let lastComplaint = ""

export const register: Register = (on) => {
  on("session.start", async ($, e, next) => {
    await locateConfig($)
    await syncConfig($)
    $.clock.every(POLL_MS, () => {
      void syncConfig($)
    })
    return next(e)
  })

  on("ui.render", { surface: "terminal", component: "AbovePrompt" }, ($, e, next) => {
    // 问卷占用这条带时让位给它
    if (e.props.hasSurvey) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)

    return (
      <Box gap={1}>
        {bandLabel ? <Text dimColor>{bandLabel}</Text> : null}
        {actions.map((a) => (
          <Button
            key={a.hotkey}
            label={a.label}
            hotkey={a.hotkey}
            plain
            onPress={() => {
              if (a.kind === "command") void $.command.run({ command: a.text })
              else if (a.kind === "fill") void $.prompt.fill({ text: a.text, mode: "replace" })
              else void $.prompt.submit({ text: a.text })
            }}
          />
        ))}
      </Box>
    )
  })
}

/** 算出这个会话要看哪几个路径：项目级在前，用户级在后 */
async function locateConfig($: EngineInterface): Promise<void> {
  const found: string[] = [PROJECT_CONFIG]

  const configDir = await $.env.get("CLAUDE_CONFIG_DIR")
  if (typeof configDir === "string" && configDir !== "") {
    found.push(`${configDir}/quick-actions.json`)
  } else {
    const home = await $.env.get("HOME")
    if (typeof home === "string" && home !== "") found.push(`${home}${USER_CONFIG_LEAF}`)
  }

  candidates = found
}

/** 读一遍配置：没变就什么都不做，变了就换上，坏了就说一声并留着上一份能用的 */
async function syncConfig($: EngineInterface): Promise<void> {
  const path = await pickExisting($)

  if (path === undefined) {
    if (activePath !== undefined) {
      activePath = undefined
      activeMtime = -1
      actions = ACTIONS
      bandLabel = BAND_LABEL
      $.ui.invalidate("ui.render")
    }
    return
  }

  const stat = await $.fs.stat(path).catch(() => undefined)
  if (stat === undefined) return

  const mtimeMs = typeof stat.mtimeMs === "number" ? stat.mtimeMs : -1
  if (path === activePath && mtimeMs === activeMtime) return

  const text = await $.fs.read(path).catch(() => undefined)
  if (typeof text !== "string") return

  const parsed = parseConfig(text)
  if (!parsed.ok) {
    const complaint = `${path}: ${parsed.reason}`
    if (complaint !== lastComplaint) {
      lastComplaint = complaint
      $.ui.log(`配置没读进来，仍用上一份：${complaint}`)
    }
    // 记下 mtime，免得同一个坏文件每 2 秒抱怨一次
    activePath = path
    activeMtime = mtimeMs
    return
  }

  lastComplaint = ""
  activePath = path
  activeMtime = mtimeMs
  actions = parsed.config.actions
  bandLabel = parsed.config.bandLabel === undefined ? BAND_LABEL : parsed.config.bandLabel
  $.ui.invalidate("ui.render")
}

/** 候选里第一个真实存在的 */
async function pickExisting($: EngineInterface): Promise<string | undefined> {
  for (const path of candidates) {
    const exists = await $.fs.exists(path).catch(() => false)
    if (exists) return path
  }
  return undefined
}
