import type { On } from "claude-code"
import { expect, mock, test } from "claude-code/testing"
import type { Engine, Mounted } from "claude-code/testing"

const HOME = "/home/u"
const PROJECT = ".claude/quick-actions.json"
const USER = `${HOME}/.claude/quick-actions.json`

const PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 120,
  scroll: { offset: 0, bodyRows: 10 },
  view: {},
} as const

const BAND = { plugin: "quick-actions", component: "AbovePrompt", props: PROPS } as const

type Files = Map<string, { text: string; mtimeMs: number }>

/**
 * 相对路径到 fs hook 这里已经按会话工作目录解析成绝对路径；
 * 测试里那个目录是插件目录而不是 session.start 给的 cwd，所以项目级配置按后缀认。
 */
const keyOf = (path: string) => (path !== USER && path.endsWith(`/${PROJECT}`) ? PROJECT : path)

/** 插件底下的世界：内存里的文件、mock 的时钟和环境变量，外加把插件发出去的动作记下来 */
function world(on: On, files: Files) {
  const clock = mock.clock(on)
  mock.env(on, { HOME })

  on("fs.exists", (_, e) => ({ value: files.has(keyOf(e.path)) }))
  on("fs.stat", (_, e) => {
    const file = files.get(keyOf(e.path))
    if (file === undefined) return { deny: `ENOENT: ${e.path}` }
    return { value: { kind: "file", size: file.text.length, mtimeMs: file.mtimeMs, isLink: false } }
  })
  on("fs.read", (_, e) => {
    const file = files.get(keyOf(e.path))
    if (file === undefined) return { deny: `ENOENT: ${e.path}` }
    return { value: file.text }
  })

  const sent: string[] = []
  on("prompt.submit", (_, e) => {
    sent.push(`prompt:${e.text}`)
    return { text: e.text }
  })
  on("prompt.fill", (_, e) => {
    sent.push(`fill:${e.mode}:${e.text}`)
    return { isFilled: true }
  })
  on("command.run", (_, e) => {
    sent.push(`command:${e.command}`)
    return {}
  })

  const logs: string[] = []
  on("ui.log", (_, e) => {
    logs.push(e.text)
    return { value: undefined }
  })

  on("session.start", (_, e) => ({ cwd: e.cwd }))

  return { clock, sent, logs }
}

const start = ($: Engine) => $.session.start({ cwd: "/proj", surface: "terminal", isInteractive: true })

const labels = async (ui: Mounted<"terminal", "AbovePrompt">) => (await ui.findAll({ type: "Button" })).map((b) => b.props.label)

const json = (value: unknown) => JSON.stringify(value)

test("没有配置文件时画内置默认", async ($, on) => {
  world(on, new Map())
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: "terminal" })
  expect(await labels(ui)).toEqual(["确认", "继续", "全部按推荐"])
  expect((await ui.find({ type: "Text", text: "快捷" }))?.text).toBe("快捷")
  await ui.unmount()
})

test("按下按钮：三种 kind 各走各的路", async ($, on) => {
  const files: Files = new Map([
    [
      USER,
      {
        mtimeMs: 1,
        text: json([
          { hotkey: "1", label: "提交", kind: "command", text: "gcmp" },
          { hotkey: "2", label: "确认", kind: "prompt", text: "确认" },
          { hotkey: "q", label: "看改动", kind: "fill", text: "说明改动" },
        ]),
      },
    ],
  ])
  const { sent } = world(on, files)
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: "terminal" })
  await ui.press({ key: "1" })
  await ui.press({ key: "2" })
  await ui.press({ key: "q" })
  expect(sent).toEqual(["command:gcmp", "prompt:确认", "fill:replace:说明改动"])
  await ui.unmount()
})

test("项目级配置优先于用户级，顶层 label 换掉提示词", async ($, on) => {
  const files: Files = new Map([
    [USER, { mtimeMs: 1, text: json([{ hotkey: "1", label: "用户级", kind: "prompt", text: "u" }]) }],
    [PROJECT, { mtimeMs: 1, text: json({ label: "本项目", actions: [{ hotkey: "1", label: "项目级", kind: "prompt", text: "p" }] }) }],
  ])
  world(on, files)
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: "terminal" })
  expect(await labels(ui)).toEqual(["项目级"])
  expect(await ui.find({ type: "Text", text: "本项目" })).toBeDefined()
  expect(await ui.find({ type: "Text", text: "快捷" })).toBeUndefined()
  await ui.unmount()
})

test("改配置、删配置，轮询到了就热换上", async ($, on) => {
  const files: Files = new Map([[USER, { mtimeMs: 1, text: json([{ hotkey: "1", label: "旧", kind: "prompt", text: "x" }]) }]])
  const { clock } = world(on, files)
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: "terminal" })
  expect(await labels(ui)).toEqual(["旧"])

  files.set(USER, { mtimeMs: 2, text: json([{ hotkey: "1", label: "新", kind: "prompt", text: "x" }]) })
  await clock.advance(2000)
  expect(await labels(ui)).toEqual(["新"])

  files.delete(USER)
  await clock.advance(2000)
  expect(await labels(ui)).toEqual(["确认", "继续", "全部按推荐"])
  await ui.unmount()
})

test("配置写坏了：留着上一份能用的，同一个错只说一次", async ($, on) => {
  const files: Files = new Map([[USER, { mtimeMs: 1, text: json([{ hotkey: "1", label: "能用", kind: "prompt", text: "x" }]) }]])
  const { clock, logs } = world(on, files)
  await start($)

  const ui = await $.ui.mount({ ...BAND, surface: "terminal" })

  files.set(USER, { mtimeMs: 2, text: "{" })
  await clock.advance(2000)
  await clock.advance(2000)
  expect(await labels(ui)).toEqual(["能用"])
  expect(logs).toHaveLength(1)
  expect(logs[0]).toContain(USER)

  // 换了 mtime 但还是同一个错，也不再说
  files.set(USER, { mtimeMs: 3, text: "{" })
  await clock.advance(2000)
  expect(logs).toHaveLength(1)
  await ui.unmount()
})

test("问卷占着这条带、或不在终端上时，让给引擎画", async ($, on) => {
  world(on, new Map())
  on("ui.render", ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine</Text>
  })
  await start($)

  const cases = [
    { surface: "terminal", props: { ...PROPS, hasSurvey: true } },
    { surface: "desktop", props: PROPS },
  ] as const
  for (const c of cases) {
    const ui = await $.ui.mount({ ...BAND, ...c })
    expect(await ui.find({ type: "Text", text: "engine" })).toBeDefined()
    expect(await ui.findAll({ type: "Button" })).toHaveLength(0)
    await ui.unmount()
  }
})
