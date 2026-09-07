# TypeScript

- **Always use the `writing-clean-ts` skill** when writing any code in this project, unless explicitly instructed otherwise. Invoke it before writing or refactoring TS code.

# Vibe Cleanup

- We are cleaning up the vibecoded app. Whenever the user issues a prompt that requests a **change** (add, update, refactor, move, rename, delete, fix) to a file under `src/`, append that prompt **verbatim, exactly as it was given** (no rewording, no typo fixes) as a new `- ` line at the end of `resource/vibe-cleanup/cleanup-instructions.md` before starting the work.
- One allowed addition: if the change prompt does not name the file it targets (e.g. the target was established by a previous explain/research prompt), insert the file path into the recorded prompt where the file is referenced, so the entry is self-contained.
- When a new session starts (a fresh conversation, not a resumed/continued one), append a line reading `---` to the log before the first entry recorded in that session, so entries group by session. Skip the marker if the session logs nothing.
- Do NOT log: prompts that only research, explain, review, or ask questions about the code, or change requests for files outside `src/` (e.g. `CLAUDE.md`, `resource/`).
