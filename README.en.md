# Claude Code Quick Actions

A row of quick actions pinned directly above the Claude Code composer. With an empty composer, press a digit to send a frequent prompt, run a slash command, or drop a draft into the input.

```
快捷 1: 看改动 2: 跑测试 3: 提交 4: 状态 5: 上下文                              [-]
────────────────────────────────────────────────────────────────────────────────
❯
```

[中文](README.md) · Sibling project: [dsh-quick-actions](https://github.com/lovvvve/dsh-quick-actions) (quick actions for the DSH message composer)

## Prerequisite

This plugin uses Claude Code's **function hooks plugin API**, which is early access and gated off by default. Turn it on in `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_FUNCTION_HOOKS": "1"
  }
}
```

Without that line the plugin is skipped silently — no buttons, no error. `claude --debug` logs the reason (`tengu_plugin_hooks_modules` is off).

Requires Claude Code 2.1.278 or newer.

## Install

```
/plugin marketplace add lovvvve/claude-code-quick-actions
/plugin install quick-actions@claude-code-quick-actions
```

Start a new session and the band appears above the composer.

## Configure

The action list lives in `plugins/quick-actions/hooks/actions.ts`:

```ts
export const ACTIONS: QuickAction[] = [
  { hotkey: "1", label: "Diff",   kind: "fill",    text: "Summarise the current git working tree changes and their blast radius." },
  { hotkey: "3", label: "Commit", kind: "command", text: "commit" },
  { hotkey: "9", label: "Wrap up", kind: "prompt", text: "Turn today's changes into one commit and push it." },
]
```

| Field | Meaning |
|---|---|
| `hotkey` | One digit (`0`-`9`) or one lowercase letter. Pressed while the composer is empty |
| `label` | The text drawn on the button |
| `kind` | `command` / `prompt` / `fill`, see below |
| `text` | Command name without `/` for `command`; the body for `prompt` and `fill` |

The three kinds:

| kind | What it does | Good for |
|---|---|---|
| `command` | Runs a slash command, `"commit"` → `/commit` | Reusing slash commands and skills you already have |
| `prompt` | Submits to the model straight away | Fixed one-liners that need no editing |
| `fill` | Only fills the composer; you finish and hit Enter | Templates that need details, e.g. "take a look at ___" |

`BAND_LABEL` sets the hint drawn to the left of the buttons; set it to `""` to drop it.

### Making edits take effect

Depends how you installed it:

| Install method | After editing `actions.ts` |
|---|---|
| `/plugin marketplace add` (above) | **Restart the session.** `/reload-plugins` does not reload function hooks modules — the `0 hooks` it reports excludes them |
| `claude --plugin-dir <dir>` | Takes effect on save; the directory is watched |
| Cloned into `~/.claude/skills/quick-actions/` | Takes effect on save; that location auto-loads and is watched |

Use one of the latter two while iterating. A marketplace install is also overwritten by `/plugin update`, so fork the repo or use the `~/.claude/skills/` route to keep your own list.

## Keys

| Action | Key |
|---|---|
| Fire an action | Its `hotkey`, while the composer is empty |
| Collapse / expand the band | `ctrl+x ctrl+a`, or click the `[-]` |
| Focus the band | `ctrl+x tab`, or click it |
| Walk the buttons while focused | `Tab` / `←` `→`, `Enter` to press, `Esc` back to the composer |

While the composer has text in it, digits are just characters — no misfires.

## How it works

A Claude Code function hooks plugin can take over sites in the interface through the `ui.render` event. This plugin takes over exactly one: `AbovePrompt`, the band directly above the composer, where the engine draws nothing of its own.

```
hooks/hooks.json          points at the module below
hooks/quick-actions.tsx   register(on) registers the ui.render hook, draws a Button per action
hooks/actions.ts          your action list
```

Each button's `onPress` stays in the plugin's own environment and calls `$.command.run` / `$.prompt.submit` / `$.prompt.fill`.

`claude plugin validate <dir>` reads a plugin the way the engine will and reports what it registers, what it calls, and anything the engine would refuse — before any session loads it.

## Known limits

- **The API is early access.** A Claude Code release may change it. The failure mode is the band not drawing; nothing else breaks.
- A `kind: "prompt"` message reaches the model wrapped in a note saying the plugin sent it, plus a sentence of explanation. That wrapper **cannot be removed**: a prompt a plugin submits does not run through that same plugin's own `prompt.submit` hook (the engine guards against re-entry — `skipped: re-entry` in the debug log), so there is no way to drop the `origin` from inside the plugin. In practice the model reads it correctly as something you said; it just costs a few lines of context. Use `fill` if that bothers you — at the cost of one extra Enter.
- The band is drawn on the `terminal` surface only.
- Digit hotkeys require an empty composer. That is the engine's rule, not the plugin's.

## License

MIT
