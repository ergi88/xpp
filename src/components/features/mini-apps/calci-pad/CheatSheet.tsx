import React from 'react'

interface Props {
  onClose: () => void
}

const SECTIONS = [
  {
    title: 'Math',
    items: [
      { code: '2 + 2', desc: 'Basic arithmetic' },
      { code: '10 * 5', desc: 'Multiplication' },
      { code: '8 / (45 - 20%)', desc: 'Percentages' },
      { code: '2k + 3M', desc: 'Large numbers (k, M)' },
    ],
  },
  {
    title: 'Date Calculations',
    items: [
      { code: 'now + 2 days', desc: 'Basic date math' },
      { code: 'today + 5w - 3d', desc: 'Chaining operations' },
      { code: 'now + 1y', desc: 'Short names: d, w, mo, y' },
    ],
  },
  {
    title: 'Conversions',
    items: [
      { code: '5 inches in cm', desc: 'Length units' },
      { code: '$10 in €', desc: 'Currency symbols' },
      { code: '100 USD in EUR', desc: 'Currency codes' },
      { code: '3 * 50$', desc: 'Math with currency' },
    ],
  },
  {
    title: 'Comments',
    items: [
      { code: '2 + 2 // comment', desc: 'Inline comments' },
      { code: '# Title', desc: 'Headers / comments' },
    ],
  },
  {
    title: 'Transactions',
    items: [
      { code: '-3000 //food', desc: '− = expense, category' },
      { code: '5000 //salary', desc: '+ = income, category' },
      { code: '//word', desc: 'Bare word = category' },
      { code: '#tag', desc: 'Add a tag' },
      { code: '@cash', desc: 'Source account' },
      { code: '> Savings', desc: 'Transfer to account' },
    ],
  },
]

export function CheatSheet({ onClose }: Props) {
  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={e => e.stopPropagation()}>
        <div style={styles.header}>
          <span style={styles.title}>Cheat Sheet</span>
          <button onClick={onClose} style={styles.closeBtn}>×</button>
        </div>
        <div style={styles.body}>
          {SECTIONS.map(section => (
            <div key={section.title} style={{ marginBottom: 18 }}>
              <div style={styles.sectionTitle}>{section.title}</div>
              {section.items.map(item => (
                <div key={item.code} style={styles.row}>
                  <code style={styles.code}>{item.code}</code>
                  <span style={styles.desc}>{item.desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
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
  body: { overflowY: 'auto', padding: '16px' },
  sectionTitle: {
    fontWeight: 700,
    color: '#6ee7b7',
    marginBottom: 8,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 7,
    gap: 12,
  },
  code: {
    fontFamily: '"SF Mono", "Fira Code", monospace',
    fontSize: 12,
    background: 'rgba(255,255,255,0.06)',
    padding: '2px 7px',
    borderRadius: 4,
    color: '#e5e5e5',
    whiteSpace: 'nowrap',
  },
  desc: { fontSize: 11, color: 'rgba(255,255,255,0.4)', textAlign: 'right' },
}
