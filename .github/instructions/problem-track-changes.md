# Problem Title

Tiptap: Track Changes / Suggest Edits with Accept/Reject

## Problem Brief

Add a first-class Track Changes (Suggest Edits) feature to Tiptap. When enabled, typing is captured as reviewable suggestions: insertions render as additions and deletions remain visible. Each suggestion carries a stable ID, author, and timestamp, maps across later edits, and can be accepted/rejected individually or in bulk. The system must be deterministic over complex content (marks, lists, tables, code blocks) and lossless between JSON and HTML. It should work standalone and be collaboration-ready (Yjs-compatible), without UI dependencies. Deliver as a self-contained extension, framework-agnostic.

## Agent Instructions

- Provide a Tiptap extension to toggle Suggest Edits and capture insertions/deletions as suggestions with stable ID, author, timestamp, and ranges; suggestions must map across later edits.
- Render insertions (`<ins>`) and deletions (`<del>`-style) while preserving marks/structure.
- Commands: `startSuggesting({ userId; userName? })`, `stopSuggesting()`, `acceptChange(id)`, `rejectChange(id)`, `acceptAll()`, `rejectAll()`; include a range query.
- Deterministic JSON/HTML: use `<ins>/<del>` with `data-change-id`, `data-author`, `data-ts`; round-trips must be lossless.
- Handle overlaps and complex nodes (marks, lists, tables, code blocks) predictably.
- Collaboration-ready: preserve authorship/IDs with Yjs; no UI required, only events/getters for a review panel.

## Test Assumptions (optional)

- New package file: `packages/extension-track-changes/src/track-changes.ts` exporting default `TrackChanges`.
- Editor commands available with the exact names above.
- Getter exposed as an Editor instance method (not a command): `editor.getChanges(params?: { from?: number; to?: number }): Array<{ id: string } & Record<string, unknown>>`.
  - Range filtering semantics: positions use TipTap/ProseMirror document positions. Filtering applies over a half‑open interval [from, to): start is inclusive, end is exclusive. A change is included if any part of its current mapped range intersects [from, to). If `from`/`to` are omitted, all suggestions are returned. Example: `[from=1, to=docEnd)` selects the whole document.
  - Package wiring and import path: tests import `@tiptap/extension-track-changes`. Implement a workspace package named `@tiptap/extension-track-changes` under `packages/extension-track-changes/` with:
    - `src/track-changes.ts` exporting default `TrackChanges` (implementation).
    - `index.ts` re-exporting default from `./src/track-changes` (package entry).
    - `package.json` (name `@tiptap/extension-track-changes`) wired for your build setup so consumers can `import TrackChanges from '@tiptap/extension-track-changes'`.
