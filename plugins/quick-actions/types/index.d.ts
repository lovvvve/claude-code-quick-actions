// quick-actions 的类型契约：动作的形状，以及它放在 $.state 里的值。
// plugin.json 的 "types" 指向这里，claude plugin validate 拿它核对模块用到的每个 $.state 键。

export type QuickAction = {
  /** 空输入框下按这个键触发：一个数字或一个小写字母 */
  hotkey: string
  /** 画在按钮上的文字 */
  label: string
  /** 触发后做什么 */
  kind: "prompt" | "command" | "fill"
  /** command 写命令名（不带 /），prompt / fill 写正文 */
  text: string
}

/** 从外部 JSON 读进来的一份配置；label 没写就沿用插件默认 */
export type QuickActionsConfig = {
  actions: QuickAction[]
  label?: string
}

declare module "claude-code" {
  interface PluginState {
    "quick-actions": {
      /** 当前生效的外部配置；null 表示没有配置文件，用 actions.ts 里的内置默认 */
      config: QuickActionsConfig | null
    }
  }
}
