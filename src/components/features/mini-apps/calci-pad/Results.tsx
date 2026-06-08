import React, { useState } from 'react'

interface Props {
  results: string[]
}

export function Results({ results }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  function handleClick(result: string, index: number) {
    if (!result) return
    navigator.clipboard.writeText(result).then(() => {
      setCopiedIndex(index)
      setTimeout(() => setCopiedIndex(null), 800)
    })
  }

  return (
    <div style={styles.container}>
      <div style={styles.inner}>
        {results.map((result, i) => (
          <div
            key={i}
            style={{
              ...styles.row,
              ...(hoveredIndex === i && result ? styles.hovered : {}),
            }}
            onClick={() => handleClick(result, i)}
            onMouseEnter={() => setHoveredIndex(i)}
            onMouseLeave={() => setHoveredIndex(null)}
            title={result ? 'Click to copy' : undefined}
          >
            <span style={styles.result}>
              {copiedIndex === i ? '✓' : result}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: 130,
    minWidth: 100,
    overflowY: 'auto',
    background: 'rgba(0,0,0,0.2)',
    borderLeft: '1px solid rgba(255,255,255,0.06)',
  },
  inner: {
    paddingTop: 10,
  },
  row: {
    height: 25,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingRight: 12,
    borderRadius: 3,
    cursor: 'default',
    transition: 'background 0.1s',
  },
  hovered: {
    background: 'rgba(110,231,183,0.08)',
    cursor: 'pointer',
  },
  result: {
    fontFamily: '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace',
    fontSize: 13,
    lineHeight: '25px',
    color: '#6ee7b7',
    paddingInline: 4,
  },
}
