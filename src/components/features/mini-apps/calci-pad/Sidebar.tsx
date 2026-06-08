import React, { useState } from 'react'
import type { Page } from './types'

interface Props {
  pages: Page[]
  activePageId: string
  onAdd: () => void
  onSelect: (id: string) => void
  onRename: (id: string, title: string) => void
  onDelete: (id: string) => void
}

export function Sidebar({ pages, activePageId, onAdd, onSelect, onRename, onDelete }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  function startRename(page: Page) {
    setRenamingId(page.id)
    setRenameValue(page.title)
  }

  function commitRename(id: string) {
    if (renameValue.trim()) onRename(id, renameValue.trim())
    setRenamingId(null)
  }

  return (
    <div style={styles.sidebar}>
      <button onClick={onAdd} style={styles.addButton}>+ New</button>
      {pages.map(page => (
        <div
          key={page.id}
          style={{ ...styles.pageItem, ...(page.id === activePageId ? styles.active : {}) }}
        >
          {renamingId === page.id ? (
            <input
              autoFocus
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={() => commitRename(page.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') commitRename(page.id)
                if (e.key === 'Escape') setRenamingId(null)
              }}
              style={styles.renameInput}
            />
          ) : (
            <span
              onClick={() => onSelect(page.id)}
              onDoubleClick={() => startRename(page)}
              style={styles.pageTitle}
              title={page.title}
            >
              {page.title}
            </span>
          )}
          <button
            onClick={() => onDelete(page.id)}
            style={styles.deleteButton}
            title="Delete page"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 110,
    minWidth: 110,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: 8,
    borderRight: '1px solid rgba(255,255,255,0.06)',
    overflowY: 'auto',
    background: 'rgba(0,0,0,0.2)',
  },
  addButton: {
    padding: '5px 8px',
    marginBottom: 6,
    cursor: 'pointer',
    background: 'rgba(255,255,255,0.05)',
    color: 'rgba(255,255,255,0.5)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 6,
    textAlign: 'left',
    fontSize: 11,
  },
  pageItem: {
    display: 'flex',
    alignItems: 'center',
    borderRadius: 6,
    padding: '3px 4px',
    gap: 2,
  },
  active: {
    background: 'rgba(110,231,183,0.1)',
    border: '1px solid rgba(110,231,183,0.2)',
  },
  pageTitle: {
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: 12,
    color: 'rgba(255,255,255,0.65)',
    userSelect: 'none',
    cursor: 'pointer',
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.25)',
    cursor: 'pointer',
    fontSize: 14,
    lineHeight: 1,
    padding: '0 2px',
    flexShrink: 0,
  },
  renameInput: {
    flex: 1,
    fontSize: 11,
    background: 'rgba(255,255,255,0.05)',
    color: '#e5e5e5',
    border: '1px solid rgba(110,231,183,0.4)',
    borderRadius: 4,
    padding: '1px 4px',
    outline: 'none',
  },
}
