# Problem Title

Tiptap: Track Changes / Suggest Edits with Accept/Reject

## Problem Brief

Add a first-class Track Changes (Suggest Edits) feature to Tiptap. When enabled, typing is recorded as reviewable suggestions: insertions render as additions and deletions remain visible as struck content. Each suggestion has a stable ID, author, and timestamp, persists across subsequent edits via transaction mapping, and can be accepted or rejected individually or in bulk. Behavior must be deterministic and lossless across complex content (marks, lists, tables, code blocks) and must serialize/deserialize consistently to JSON and HTML. The feature works standalone and remains collaboration-ready (Yjs-compatible) without hard dependencies. The outcome is an editor-native review workflow comparable to modern document editors, delivered as a self-contained extension and agnostic to React/Vue bindings.

## Agent Instructions

- Provide a Tiptap extension that toggles Suggest Edits on/off and captures insertions/deletions as suggestions with stable IDs, author, timestamp, and ranges; suggestions map correctly across later document changes.
- Render insertions with `<ins>`-style visuals and deletions as persistent decorations; preserve surrounding marks and structure.
- Expose commands: `startSuggesting({ userId: string; userName?: string })`, `stopSuggesting()`, `acceptChange(id: string)`, `rejectChange(id: string)`, `acceptAll()`, `rejectAll()`, plus a query for suggestions by range.
- Ensure deterministic JSON and HTML serialization; HTML uses `<ins>`/`<del>` with `data-change-id`, `data-author`, `data-ts`; deserialization round-trips without data loss.
- Handle overlapping edits, nested marks/nodes, and tables predictably; no crashes or silent drops.
- Collaboration-ready: preserve authorship and IDs under typical Yjs mapping; no UI components required - expose events/getters sufficient for a review panel.

## Test Assumptions (optional)

- New package file: `packages/extension-track-changes/src/track-changes.ts` exporting default `TrackChanges`.
- Editor commands available with the exact names above.
- Getter exposed as an Editor instance method (not a command): `editor.getChanges(params?: { from?: number; to?: number }): Array<{ id: string } & Record<string, unknown>>`.
  - Range filtering semantics: positions use TipTap/ProseMirror document positions. Filtering applies over a half‑open interval [from, to): start is inclusive, end is exclusive. A change is included if any part of its current mapped range intersects [from, to). If `from`/`to` are omitted, all suggestions are returned. Example: `[from=1, to=docEnd)` selects the whole document.
  - Package wiring and import path: tests import `@tiptap/extension-track-changes`. Implement a workspace package named `@tiptap/extension-track-changes` under `packages/extension-track-changes/` with:
    - `src/track-changes.ts` exporting default `TrackChanges` (implementation).
    - `index.ts` re-exporting default from `./src/track-changes` (package entry).
    - `package.json` (name `@tiptap/extension-track-changes`) wired for your build setup so consumers can `import TrackChanges from '@tiptap/extension-track-changes'`.
