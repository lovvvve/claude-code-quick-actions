import { describe, expect, test } from "claude-code/testing"

import { parseConfig } from "../hooks/config"

const ok = (text: string) => {
  const parsed = parseConfig(text)
  if (!parsed.ok) throw new Error(`应当解析成功，却失败了：${parsed.reason}`)
  return parsed.config
}

const reason = (text: string) => {
  const parsed = parseConfig(text)
  if (parsed.ok) throw new Error("应当解析失败，却成功了")
  return parsed.reason
}

describe("parseConfig", () => {
  test("数组写法：不带 label", () => {
    expect(ok('[{ "hotkey": "1", "label": "确认", "kind": "prompt", "text": "确认" }]')).toStrictEqual({
      actions: [{ hotkey: "1", label: "确认", kind: "prompt", text: "确认" }],
    })
  })

  test("对象写法：带 label，空字符串也算", () => {
    const config = ok('{ "label": "", "actions": [{ "hotkey": "q", "label": "看改动", "kind": "fill", "text": "说明改动" }] }')
    expect(config.label).toBe("")
    expect(config.actions).toHaveLength(1)
  })

  test("对象写法：不写 label 就不带", () => {
    expect("label" in ok('{ "actions": [] }')).toBe(false)
  })

  test("不是 JSON", () => {
    expect(reason("{")).toContain("不是合法 JSON")
  })

  test("顶层既不是数组也不是对象", () => {
    expect(reason('"x"')).toContain("顶层")
  })

  test("actions 不是数组", () => {
    expect(reason('{ "actions": {} }')).toContain("actions 要是一个数组")
  })

  test("label 不是字符串", () => {
    expect(reason('{ "label": 1, "actions": [] }')).toContain("label 要是字符串")
  })

  test("hotkey 只收单个数字或小写字母", () => {
    for (const hotkey of ["10", "A", "", "-"]) {
      expect(reason(JSON.stringify([{ hotkey, label: "x", kind: "prompt", text: "x" }]))).toContain("actions[0].hotkey")
    }
  })

  test("kind 只收三种", () => {
    expect(reason('[{ "hotkey": "1", "label": "x", "kind": "run", "text": "x" }]')).toContain("actions[0].kind")
  })

  test("label 和 text 不能为空", () => {
    expect(reason('[{ "hotkey": "1", "label": "", "kind": "prompt", "text": "x" }]')).toContain("actions[0].label")
    expect(reason('[{ "hotkey": "1", "label": "x", "kind": "prompt", "text": "" }]')).toContain("actions[0].text")
  })

  test("hotkey 重复", () => {
    const dup = [
      { hotkey: "1", label: "a", kind: "prompt", text: "a" },
      { hotkey: "1", label: "b", kind: "prompt", text: "b" },
    ]
    expect(reason(JSON.stringify(dup))).toContain('hotkey "1" 重复了')
  })
})
