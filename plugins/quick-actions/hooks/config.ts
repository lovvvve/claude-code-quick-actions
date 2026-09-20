// 外部配置文件的解析与校验。
// 这一层是纯函数，碰不到引擎（$），所以单独成文件，也好单独推敲。

import type { QuickAction } from "./actions"

export type ParsedConfig = {
  actions: QuickAction[]
  bandLabel: string | undefined
}

export type ParseResult =
  | { ok: true; config: ParsedConfig }
  | { ok: false; reason: string }

const KINDS = ["prompt", "command", "fill"]

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

/** hotkey 必须是单个数字或单个小写字母，引擎的规则，这里先拦一道好报错 */
const isHotkey = (v: unknown): v is string =>
  typeof v === "string" && /^[0-9a-z]$/.test(v)

function parseAction(raw: unknown, at: string): { action: QuickAction } | { reason: string } {
  if (!isRecord(raw)) return { reason: `${at} 不是一个对象` }

  const { hotkey, label, kind, text } = raw
  if (!isHotkey(hotkey)) return { reason: `${at}.hotkey 要是单个数字或单个小写字母，收到 ${JSON.stringify(hotkey)}` }
  if (typeof label !== "string" || label === "") return { reason: `${at}.label 要是非空字符串` }
  if (typeof kind !== "string" || !KINDS.includes(kind)) return { reason: `${at}.kind 要是 prompt / command / fill 之一，收到 ${JSON.stringify(kind)}` }
  if (typeof text !== "string" || text === "") return { reason: `${at}.text 要是非空字符串` }

  return { action: { hotkey, label, kind: kind as QuickAction["kind"], text } }
}

/**
 * 接受两种写法：
 *   [ {...}, {...} ]                     —— 直接一个动作数组
 *   { label?: "快捷", actions: [ ... ] } —— 带上按钮排左边的提示词
 */
export function parseConfig(text: string): ParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch (err) {
    return { ok: false, reason: `不是合法 JSON：${err instanceof Error ? err.message : String(err)}` }
  }

  let list: unknown
  let bandLabel: string | undefined

  if (Array.isArray(raw)) {
    list = raw
  } else if (isRecord(raw)) {
    list = raw.actions
    if (raw.label !== undefined) {
      if (typeof raw.label !== "string") return { ok: false, reason: "label 要是字符串" }
      bandLabel = raw.label
    }
  } else {
    return { ok: false, reason: "顶层要是一个数组，或者带 actions 字段的对象" }
  }

  if (!Array.isArray(list)) return { ok: false, reason: "actions 要是一个数组" }

  const actions: QuickAction[] = []
  const seen: string[] = []
  for (let i = 0; i < list.length; i++) {
    const parsed = parseAction(list[i], `actions[${i}]`)
    if ("reason" in parsed) return { ok: false, reason: parsed.reason }
    if (seen.includes(parsed.action.hotkey)) return { ok: false, reason: `hotkey "${parsed.action.hotkey}" 重复了` }
    seen.push(parsed.action.hotkey)
    actions.push(parsed.action)
  }

  return { ok: true, config: { actions, bandLabel } }
}
