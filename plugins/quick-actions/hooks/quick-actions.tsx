import type { Register } from "claude-code"
import { ACTIONS, BAND_LABEL } from "./actions"

export const register: Register = (on) => {
  on("ui.render", { surface: "terminal", component: "AbovePrompt" }, ($, e, next) => {
    // 问卷占用这条带时让位给它
    if (e.props.hasSurvey) return next(e)

    const { Box, Text, Button } = $.ui.resolve(e)

    return (
      <Box gap={1}>
        {BAND_LABEL ? <Text dimColor>{BAND_LABEL}</Text> : null}
        {ACTIONS.map((a) => (
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
