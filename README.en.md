# Claude Code Quick Actions

A row of quick actions pinned directly above the Claude Code composer. With an empty composer, press a digit to send a frequent prompt, run a slash command, or drop a draft into the input.

```
快捷 1: 看改动 2: 跑测试 3: 提交 4: 状态 5: 上下文                              [-]
────────────────────────────────────────────────────────────────────────────────
❯
```

[中文](README.md) · Sibling project: [dsh-quick-actions](https://github.com/lovvvve/dsh-quick-actions) (quick actions for the DSH message composer)

## Prerequisite

This plugin is a Claude Code **mod**: a plugin built on the function hooks plugin API. That API is early access and gated off by default. Turn it on in `~/.claude/settings.json`:

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

At the Claude Code prompt:

```
/plugin install quick-actions --marketplace lovvvve/claude-code-quick-actions
```

Answer `y` to add the marketplace, then pick a scope (user is the default). Or from a shell:

```
claude plugin install quick-actions --marketplace lovvvve/claude-code-quick-actions
```

Once installed, the band appears above the composer; if it does not, start a new session.

On older versions without `--marketplace`, use two steps:

```
/plugin marketplace add lovvvve/claude-code-quick-actions
/plugin install quick-actions@claude-code-quick-actions
```

## Configure

Three layers, nearest wins, all optional:

| Priority | Location | Good for |
|---|---|---|
| 1 | `<project>/.claude/quick-actions.json` | Actions for this project only |
| 2 | `~/.claude/quick-actions.json` | The few you want everywhere |
| 3 | `plugins/quick-actions/hooks/actions.ts` | The plugin's own defaults, used when neither file exists |

**Editing the JSON needs no restart and no reload** — the plugin checks the file's mtime every 2 seconds and swaps the list when it changes. Creating, editing, deleting and switching between projects are all live.

Two shapes, a bare array or an object with a `label`:

```json
[
  { "hotkey": "1", "label": "Confirm", "kind": "prompt", "text": "Confirmed" },
  { "hotkey": "2", "label": "Continue", "kind": "prompt", "text": "Continue" }
]
```

```json
{
  "label": "Quick",
  "actions": [
    { "hotkey": "1", "label": "Commit & push", "kind": "command", "text": "gcmp" },
    { "hotkey": "q", "label": "Diff",          "kind": "fill",    "text": "Summarise the current working tree changes and their blast radius." }
  ]
}
```

| Field | Meaning |
|---|---|
| `hotkey` | One digit (`0`-`9`) or one lowercase letter. Pressed while the composer is empty |
| `label` | The text drawn on the button |
| `kind` | `command` / `prompt` / `fill`, see below |
| `text` | Command name without `/` for `command`; the body for `prompt` and `fill` |

The top-level `label` sets the hint to the left of the buttons; `""` drops it, and leaving it out keeps the plugin's own.

The three kinds:

| kind | What it does | Good for |
|---|---|---|
| `command` | Runs a slash command, `"commit"` → `/commit` | Reusing slash commands and skills you already have |
| `prompt` | Submits to the model straight away | Fixed one-liners that need no editing |
| `fill` | Only fills the composer; you finish and hit Enter | Templates that need details, e.g. "take a look at ___" |

Broken JSON does not make the buttons vanish: the plugin keeps the last good list and says once in the transcript which file failed and why.

### Changing the plugin's own defaults

`actions.ts` is the fallback when neither JSON file exists. How an edit to it takes effect depends on the install:

| Install method | After editing `actions.ts` |
|---|---|
| Installed from GitHub (above) | **Restart the session.** `/reload-plugins` does not reload function hooks modules — the `0 hooks` it reports excludes them |
| Cloned, then `claude plugin marketplace add <clone dir>` and install | The plugin is read straight from the clone (`claude plugin list` shows `Read from: <dir>`), not from a copy made at install. Per the 2.1.306 docs, `/reload-plugins` re-reads it after an edit; restart the session if it does not |
| `claude --plugin-dir <dir>` | Takes effect on save; the directory is watched |
| Cloned into `~/.claude/skills/quick-actions/` | Takes effect on save; that location auto-loads and is watched |

For day-to-day tweaks use the JSON: that path is live under every install method, and `/plugin update` never overwrites it.

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
hooks/quick-actions.tsx   register(on): session.start locates the config and starts the poll, ui.render draws the buttons
hooks/config.ts           parsing and validation of the JSON; pure functions, no engine access
hooks/actions.ts          the plugin's own default list
types/index.d.ts          the type contract: an action's shape, and the value the plugin keeps in $.state
tests/                    cases run by claude plugin test
```

Each button's `onPress` stays in the plugin's own environment and calls `$.command.run` / `$.prompt.submit` / `$.prompt.fill`.

The config is watched by a `$.clock.every(2000)` started in `session.start`: `$.fs.stat` compares the mtime and `$.fs.read` re-reads only on a change. That is why it does not depend on Claude Code watching the plugin directory, and stays live under every install method.

A successful parse is written to `$.state` (`quick-actions` → `config`, declared in `types/index.d.ts`). The band reads it while drawing, so a write repaints it. `$.state` survives hot reloads. With no config file it holds `null`; the built-in defaults never go into state, so an edit to `actions.ts` shows up as soon as the plugin reloads.

## Development

```
claude plugin validate plugins/quick-actions   # checks the manifest, the contract and any call the engine would refuse
claude plugin test plugins/quick-actions       # runs the cases under tests/
```

Type-checking uses the plugin's `tsconfig.json`, which needs the declarations the engine lays in `.claude-plugin/types/` (kept out of git). One interactive session started with `claude --plugin-dir plugins/quick-actions` lays them; after that:

```
npx -p typescript@5 tsc -p plugins/quick-actions
```

## Known limits

- **The API is early access.** A Claude Code release may change it. The failure mode is the band not drawing; nothing else breaks.
- A `kind: "prompt"` message reaches the model wrapped in a note saying the plugin sent it, plus a sentence of explanation. That wrapper **cannot be removed**: a prompt a plugin submits does not run through that same plugin's own `prompt.submit` hook (the engine guards against re-entry — `skipped: re-entry` in the debug log), so there is no way to drop the `origin` from inside the plugin. In practice the model reads it correctly as something you said; it just costs a few lines of context. Use `fill` if that bothers you — at the cost of one extra Enter.
- The band is drawn on the `terminal` surface only.
- Digit hotkeys require an empty composer. That is the engine's rule, not the plugin's.

## License

MIT
