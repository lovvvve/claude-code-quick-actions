// 你的快捷动作清单 —— 改完存盘即热重载，不用重启 Claude Code。
//
//   kind: "command" -> 运行斜杠命令（写名字，不带 /）
//   kind: "prompt"  -> 直接作为一条消息提交给模型
//   kind: "fill"    -> 只填进输入框，你继续编辑后自己回车
//
// hotkey: 一个数字(0-9)或一个小写字母。输入框为空时按该键直接触发；
//         输入框里已经有内容时该键就是普通字符，不会误触。

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

export const ACTIONS: QuickAction[] = [
  { hotkey: "1", label: "看改动", kind: "fill", text: "用中文说明当前 git 工作区的改动内容和影响范围。" },
  { hotkey: "2", label: "跑测试", kind: "fill", text: "跑一遍这个项目的测试，失败的话先定位根因再改。" },
  { hotkey: "3", label: "提交", kind: "command", text: "commit" },
  { hotkey: "4", label: "状态", kind: "command", text: "status" },
  { hotkey: "5", label: "上下文", kind: "command", text: "context" },
]

/** 按钮排左边的提示词；设为空字符串即不画 */
export const BAND_LABEL = "快捷"
