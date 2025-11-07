/** @jsxImportSource @tiptap/core */
import type { Editor } from '@tiptap/core'
import { Extension, Mark, mergeAttributes } from '@tiptap/core'
import type { Transaction } from '@tiptap/pm/state'

type Range = { from: number; to: number }

const uuidv4 = () => {
  const tpl = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
  const out: string[] = []
  for (let i = 0; i < tpl.length; i += 1) {
    const c = tpl[i]
    if (c === 'x') {
      out.push(Math.floor(Math.random() * 16).toString(16))
    } else if (c === 'y') {
      // rfc4122 variant 1: 8..b
      out.push((8 + Math.floor(Math.random() * 4)).toString(16))
    } else if (c === '4') {
      out.push('4')
    } else {
      out.push(c)
    }
  }
  return out.join('')
}

const nowTs = () => Date.now()

const INS_NAME = 'trackIns'
const DEL_NAME = 'trackDel'

const commonAttrs = {
  changeId: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-change-id'),
    renderHTML: (attrs: any) => ({ 'data-change-id': attrs.changeId }),
  },
  author: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-author'),
    renderHTML: (attrs: any) => (attrs.author ? { 'data-author': attrs.author } : {}),
  },
  ts: {
    default: null,
    parseHTML: (el: HTMLElement) => {
      const v = el.getAttribute('data-ts')
      return v ? Number(v) : null
    },
    renderHTML: (attrs: any) => ({ 'data-ts': attrs.ts }),
  },
  userId: {
    default: null,
    parseHTML: (el: HTMLElement) => el.getAttribute('data-user-id'),
    renderHTML: (attrs: any) => (attrs.userId ? { 'data-user-id': attrs.userId } : {}),
  },
}

export const TrackIns = Mark.create({
  name: INS_NAME,
  inclusive: true,
  addAttributes() {
    return commonAttrs
  },
  parseHTML() {
    return [{ tag: 'ins' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['ins', mergeAttributes(HTMLAttributes), 0]
  },
})

export const TrackDel = Mark.create({
  name: DEL_NAME,
  inclusive: true,
  addAttributes() {
    return commonAttrs
  },
  parseHTML() {
    return [{ tag: 'del' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['del', mergeAttributes(HTMLAttributes), 0]
  },
})

type SuggestUser = { userId: string; userName?: string | null }

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    trackChanges: {
      startSuggesting: (user: SuggestUser) => ReturnType
      stopSuggesting: () => ReturnType
      acceptChange: (id: string) => ReturnType
      rejectChange: (id: string) => ReturnType
      acceptAll: (range?: Partial<Range>) => ReturnType
      rejectAll: (range?: Partial<Range>) => ReturnType
    }
  }
}

function withOrig<T extends any[]>(fn: ((...args: any[]) => any) | undefined, that: any, ...args: T) {
  if (typeof fn === 'function') {
    return (fn as any).apply(that, args)
  }
  return false
}

function forEachMarkRange(editor: Editor, markName: string, cb: (attrs: any, from: number, to: number) => void) {
  const type = editor.schema.marks[markName]
  if (!type) {
    return
  }
  const doc = editor.state.doc
  doc.descendants((node, pos) => {
    if (!node.isText || !node.marks?.length) {
      return
    }
    node.marks.forEach(m => {
      if (m.type === type) {
        const attrs = m.attrs || {}
        const from = pos
        const to = pos + node.nodeSize
        cb(attrs, from, to)
      }
    })
  })
}

// (unused helpers removed)

function applyMarkByIdAction(editor: Editor, markName: string, id: string, action: 'delete' | 'strip', range?: Range) {
  const { state, view } = editor
  const type = editor.schema.marks[markName]
  if (!type) {
    return false
  }
  let tr = state.tr
  forEachMarkRange(editor, markName, (attrs, from, to) => {
    const overlaps = !range || !(range.to <= from || range.from >= to)
    if (attrs.changeId === id && overlaps) {
      if (action === 'strip') {
        tr = tr.removeMark(from, to, type)
      } else if (action === 'delete') {
        tr = tr.delete(from, to)
      }
    }
  })
  if (tr.docChanged) {
    view.dispatch(tr)
    return true
  }
  return false
}

function listChanges(editor: Editor, query?: Partial<Range>) {
  const items: any[] = []
  const push = (markName: string, type: 'insertion' | 'deletion', attrs: any, from: number, to: number) => {
    const overlaps = !query || query.from == null || query.to == null ? true : !(query.to! <= from || query.from! >= to)
    if (!overlaps) {
      return
    }
    items.push({ id: String(attrs.changeId), type, ts: Number(attrs.ts), userId: String(attrs.userId), from, to })
  }
  forEachMarkRange(editor, INS_NAME, (attrs, from, to) => push(INS_NAME, 'insertion', attrs, from, to))
  forEachMarkRange(editor, DEL_NAME, (attrs, from, to) => push(DEL_NAME, 'deletion', attrs, from, to))
  return items
}

const TrackChanges = Extension.create({
  name: 'trackChanges',

  addExtensions() {
    return [TrackIns, TrackDel]
  },

  addStorage() {
    return {
      suggesting: false as boolean,
      user: null as SuggestUser | null,
      origInsertContent: undefined as any,
      origDeleteRange: undefined as any,
    }
  },

  onCreate() {
    // Expose getChanges on the editor instance (runtime only)
    ;(this.editor as any).getChanges = (opts?: Partial<Range>) => listChanges(this.editor, opts)

    // Monkey patch insertContent / deleteRange to wrap in <ins>/<del> while suggesting
    const anyEditor = this.editor as any
    const storage = this.storage as any
    storage.origInsertContent = anyEditor.commands.insertContent
    storage.origDeleteRange = anyEditor.commands.deleteRange

    anyEditor.commands.insertContent = (value: any, options?: any) => {
      if (!this.storage.suggesting) {
        return withOrig(storage.origInsertContent, anyEditor.commands, value, options)
      }
      const id = uuidv4()
      const ts = nowTs()
      const userId = this.storage.user?.userId ?? null
      const author = this.storage.user?.userName ?? null
      if (typeof value === 'string') {
        const open = `<ins data-change-id="${id}"${author ? ` data-author="${author}"` : ''} data-ts="${ts}"${userId ? ` data-user-id="${userId}"` : ''}>`
        const close = `</ins>`
        return withOrig(storage.origInsertContent, anyEditor.commands, `${open}${value}${close}`, options)
      }
      // Fallback: just call original for non-string content
      return withOrig(storage.origInsertContent, anyEditor.commands, value, options)
    }

    anyEditor.commands.deleteRange = (attrs: { from: number; to: number }) => {
      if (!this.storage.suggesting) {
        return withOrig(storage.origDeleteRange, anyEditor.commands, attrs)
      }
      const { from, to } = attrs || ({} as any)
      if (typeof from !== 'number' || typeof to !== 'number' || to <= from) {
        return false
      }
      const id = uuidv4()
      const ts = nowTs()
      const userId = this.storage.user?.userId ?? null
      const author = this.storage.user?.userName ?? null
      const { state, view } = this.editor
      const type = this.editor.schema.marks[DEL_NAME]
      if (!type) {
        return false
      }
      let tr: Transaction = state.tr
      tr = tr.addMark(from, to, type.create({ changeId: id, ts, userId, author }))
      view.dispatch(tr)
      return true
    }
  },

  addCommands() {
    return {
      startSuggesting: (user: SuggestUser) => () => {
        this.storage.suggesting = true
        this.storage.user = user || null
        return true
      },
      stopSuggesting: () => () => {
        this.storage.suggesting = false
        return true
      },
      acceptChange:
        (id: string) =>
        ({ editor }: { editor: any }) => {
          // Accept insertion: strip mark; Accept deletion: delete text
          const okIns = applyMarkByIdAction(editor, INS_NAME, id, 'strip')
          const okDel = applyMarkByIdAction(editor, DEL_NAME, id, 'delete')
          return okIns || okDel
        },
      rejectChange:
        (id: string) =>
        ({ editor }: { editor: any }) => {
          // Reject insertion: delete text; Reject deletion: strip mark
          const okIns = applyMarkByIdAction(editor, INS_NAME, id, 'delete')
          const okDel = applyMarkByIdAction(editor, DEL_NAME, id, 'strip')
          return okIns || okDel
        },
      acceptAll:
        (range?: Partial<Range>) =>
        ({ editor }: { editor: any }) => {
          const items = listChanges(editor, range)
          let changed = false
          items.forEach(it => {
            if (it.type === 'insertion') {
              changed = applyMarkByIdAction(editor, INS_NAME, it.id, 'strip', range as any) || changed
            } else {
              changed = applyMarkByIdAction(editor, DEL_NAME, it.id, 'delete', range as any) || changed
            }
          })
          return changed
        },
      rejectAll:
        (range?: Partial<Range>) =>
        ({ editor }: { editor: any }) => {
          const items = listChanges(editor, range)
          let changed = false
          items.forEach(it => {
            if (it.type === 'insertion') {
              changed = applyMarkByIdAction(editor, INS_NAME, it.id, 'delete', range as any) || changed
            } else {
              changed = applyMarkByIdAction(editor, DEL_NAME, it.id, 'strip', range as any) || changed
            }
          })
          return changed
        },
    }
  },
})

export default TrackChanges
