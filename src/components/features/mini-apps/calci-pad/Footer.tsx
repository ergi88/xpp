import React from 'react'
import type { Currency } from './types'

interface Props {
  currencies: Currency[]
  onInsert: (text: string) => void
}

const OPERATORS = ['+', '-', '*', '/', '(', ')']
const DIRECT_OPS = ['%', '.', '00']
const KEYWORDS = ['in', 'today', 'now', 'days', 'weeks', 'months', 'years', 'd', 'w', 'mo', 'y']
const UNITS = ['m', 'cm', 'mm', 'in', 'ft', 'km', 'mi']
const SUFFIXES = ['M', 'k']
const COMMENTS = ['#', '//']

export function Footer({ currencies, onInsert }: Props) {
  return (
    <div style={styles.container}>
      {OPERATORS.map(op => (
        <Chip key={op} text={op} color="rgba(255,255,255,0.55)" onClick={() => onInsert(` ${op} `)} />
      ))}
      {DIRECT_OPS.map(op => (
        <Chip key={op} text={op} color="rgba(255,255,255,0.55)" onClick={() => onInsert(op)} />
      ))}
      <Divider />
      {KEYWORDS.map(kw => (
        <Chip key={kw} text={kw} color="#93c5fd" onClick={() => onInsert(` ${kw} `)} />
      ))}
      <Divider />
      {UNITS.map(u => (
        <Chip key={u} text={u} color="#fcd34d" onClick={() => onInsert(` ${u}`)} />
      ))}
      <Divider />
      {SUFFIXES.map(s => (
        <Chip key={s} text={s} color="#c4b5fd" onClick={() => onInsert(s)} />
      ))}
      <Divider />
      {COMMENTS.map(c => (
        <Chip key={c} text={c} color="rgba(255,255,255,0.35)" onClick={() => onInsert(` ${c} `)} />
      ))}
      <Divider />
      {currencies.map(c => (
        <Chip key={c.id} text={c.symbol} color="#6ee7b7" onClick={() => onInsert(` ${c.symbol}`)} />
      ))}
    </div>
  )
}

function Chip({ text, color, onClick }: { text: string; color: string; onClick: () => void }) {
  return (
    <button
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      style={{
        padding: '2px 7px',
        border: 'none',
        borderRadius: 5,
        cursor: 'pointer',
        fontFamily: '"SF Mono", "Fira Code", monospace',
        fontSize: 11,
        flexShrink: 0,
        background: color + '20',
        color,
        transition: 'opacity 0.1s',
      }}
    >
      {text}
    </button>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    height: 40,
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    paddingInline: 10,
    overflowX: 'auto',
    background: 'rgba(0,0,0,0.15)',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    flexShrink: 0,
  },
}
