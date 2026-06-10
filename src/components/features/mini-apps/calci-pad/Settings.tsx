import React, { useState } from 'react'
import type { Currency } from './types'

interface Props {
  precision: number
  currencies: Currency[]
  autoComment: boolean
  onAutoCommentChange: (value: boolean) => void
  onPrecisionChange: (precision: number) => void
  onCurrencyAdd: (currency: Currency) => void
  onCurrencyDelete: (id: string) => void
  onClose: () => void
}

export function Settings({
  precision,
  currencies,
  autoComment,
  onAutoCommentChange,
  onPrecisionChange,
  onCurrencyAdd,
  onCurrencyDelete,
  onClose,
}: Props) {
  const [precisionStr, setPrecisionStr] = useState(precision > 0 ? String(precision) : '')
  const [showAdd, setShowAdd] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [newSymbol, setNewSymbol] = useState('')
  const [newRate, setNewRate] = useState('')

  function handlePrecisionChange(val: string) {
    const digits = val.replace(/[^0-9]/g, '')
    if (digits.length >= 2) {
      setPrecisionStr('')
      onPrecisionChange(0)
      return
    }
    setPrecisionStr(digits)
    const n = parseInt(digits, 10)
    onPrecisionChange(!digits || n === 0 ? 0 : n)
  }

  function handleAdd() {
    const rate = parseFloat(newRate)
    if (!newCode.trim() || !newSymbol.trim() || isNaN(rate)) return
    onCurrencyAdd({
      id: crypto.randomUUID(),
      code: newCode.trim().toUpperCase(),
      symbol: newSymbol.trim(),
      rate,
    })
    setNewCode('')
    setNewSymbol('')
    setNewRate('')
    setShowAdd(false)
  }

  const canAdd = newCode.trim() && newSymbol.trim() && !isNaN(parseFloat(newRate))

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Settings</span>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>

        <div style={styles.body}>
          <Section label="Calculation">
            <div style={styles.row}>
              <span style={styles.label}>Precision (decimal places)</span>
              <input
                value={precisionStr}
                onChange={e => handlePrecisionChange(e.target.value)}
                placeholder="auto"
                style={styles.smallInput}
              />
            </div>
            <div style={styles.hint}>Empty = full precision. 1–9 = fixed decimal places.</div>
          </Section>

          <Section label="Editor">
            <div style={styles.row}>
              <span style={styles.label}>Insert “//” on text keyboard</span>
              <button
                onClick={() => onAutoCommentChange(!autoComment)}
                style={{
                  ...styles.toggle,
                  ...(autoComment ? styles.toggleOn : styles.toggleOff),
                }}
                aria-pressed={autoComment}
              >
                <span
                  style={{
                    ...styles.toggleKnob,
                    transform: autoComment ? 'translateX(16px)' : 'translateX(0)',
                  }}
                />
              </button>
            </div>
            <div style={styles.hint}>
              Drops a “//” comment marker at the caret when you switch to the full keyboard.
            </div>
          </Section>

          <Section label="Currencies (base: USD)">
            {currencies.map(c => (
              <div key={c.id} style={styles.row}>
                <span style={styles.label}>
                  {c.code} <span style={{ color: 'rgba(255,255,255,0.3)' }}>({c.symbol})</span>
                </span>
                <span style={styles.rate}>
                  {c.code === 'USD' ? '1.0' : c.rate.toFixed(4)}
                </span>
                {c.code !== 'USD' && (
                  <button onClick={() => onCurrencyDelete(c.id)} style={styles.deleteBtn}>
                    Delete
                  </button>
                )}
              </div>
            ))}

            {showAdd ? (
              <div style={styles.addForm}>
                <input
                  placeholder="Code (e.g. JPY)"
                  value={newCode}
                  onChange={e => setNewCode(e.target.value)}
                  style={styles.input}
                />
                <input
                  placeholder="Symbol (e.g. ¥)"
                  value={newSymbol}
                  onChange={e => setNewSymbol(e.target.value)}
                  style={styles.input}
                />
                <input
                  placeholder="Rate vs USD (e.g. 145.0)"
                  value={newRate}
                  onChange={e => setNewRate(e.target.value)}
                  style={styles.input}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                  <button onClick={() => setShowAdd(false)} style={styles.cancelBtn}>Cancel</button>
                  <button onClick={handleAdd} disabled={!canAdd} style={styles.confirmBtn}>
                    Add
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAdd(true)} style={styles.addBtn}>
                + Add Currency
              </button>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={sectionTitleStyle}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: 700,
  color: '#6ee7b7',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  marginBottom: 10,
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.7)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 20,
    borderRadius: 24,
  },
  modal: {
    background: '#1a1a1a',
    borderRadius: 16,
    width: 340,
    maxHeight: '85%',
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid rgba(255,255,255,0.1)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  title: { fontSize: 13, fontWeight: 600, color: '#e5e5e5' },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 20,
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
  },
  body: { overflowY: 'auto', padding: 16 },
  row: { display: 'flex', alignItems: 'center', gap: 8, minHeight: 28 },
  label: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.65)' },
  rate: { fontSize: 12, color: 'rgba(255,255,255,0.3)', minWidth: 55, textAlign: 'right' },
  hint: { fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 },
  smallInput: {
    width: 54,
    padding: '3px 6px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    color: '#e5e5e5',
    fontSize: 12,
    textAlign: 'right',
    outline: 'none',
  },
  input: {
    padding: '5px 8px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    color: '#e5e5e5',
    fontSize: 12,
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  addForm: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 },
  addBtn: {
    padding: '5px 10px',
    marginTop: 6,
    background: 'transparent',
    border: '1px dashed rgba(110,231,183,0.3)',
    borderRadius: 6,
    color: '#6ee7b7',
    cursor: 'pointer',
    fontSize: 12,
    textAlign: 'left',
  },
  cancelBtn: {
    padding: '4px 12px',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6,
    color: 'rgba(255,255,255,0.5)',
    cursor: 'pointer',
    fontSize: 12,
  },
  confirmBtn: {
    padding: '4px 12px',
    background: 'rgba(110,231,183,0.1)',
    border: '1px solid rgba(110,231,183,0.3)',
    borderRadius: 6,
    color: '#6ee7b7',
    cursor: 'pointer',
    fontSize: 12,
  },
  deleteBtn: {
    padding: '2px 8px',
    background: 'none',
    border: '1px solid rgba(244,63,94,0.3)',
    borderRadius: 5,
    color: '#fda4af',
    cursor: 'pointer',
    fontSize: 11,
  },
  toggle: {
    position: 'relative',
    width: 36,
    height: 20,
    borderRadius: 999,
    border: 'none',
    cursor: 'pointer',
    padding: 2,
    flexShrink: 0,
    transition: 'background 0.15s ease',
  },
  toggleOn: { background: 'rgba(110,231,183,0.45)' },
  toggleOff: { background: 'rgba(255,255,255,0.12)' },
  toggleKnob: {
    display: 'block',
    width: 16,
    height: 16,
    borderRadius: '50%',
    background: '#fff',
    transition: 'transform 0.15s ease',
  },
}
