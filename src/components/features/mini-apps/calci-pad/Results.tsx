import React, { useState } from 'react'

interface Props {
  results: string[]
  /** Per-line flag: this line already produced a transaction. Aligned to
   *  `results` by index. */
  created?: boolean[]
}

const SUM_INDEX = -1

function formatSum(value: number): string {
  return new Intl.NumberFormat('en-US', {
    useGrouping: false,
    minimumFractionDigits: 0,
    maximumFractionDigits: 8,
  }).format(value)
}

export function Results({ results, created }: Props) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  // Sum every result that is a plain number (skips empty lines, currency,
  // dates, units and anything else that doesn't parse as a number).
  const summable = results.filter(r => r !== '' && Number.isFinite(Number(r)))
  const sum = summable.reduce((acc, r) => acc + Number(r), 0)
  const sumText = formatSum(sum)

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
        {results.map((result, i) => {
          const isCreated = created?.[i] ?? false
          return (
            <div
              key={i}
              style={{
                ...styles.row,
                ...(isCreated ? styles.createdRow : {}),
                ...(hoveredIndex === i && result ? styles.hovered : {}),
              }}
              onClick={() => handleClick(result, i)}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
              title={
                isCreated
                  ? 'Transaction created from this line'
                  : result
                    ? 'Click to copy'
                    : undefined
              }
            >
              {isCreated && <span style={styles.createdMark}>✓</span>}
              <span
                style={{
                  ...styles.result,
                  ...(isCreated ? styles.createdResult : {}),
                }}
              >
                {copiedIndex === i ? '✓' : result}
              </span>
            </div>
          )
        })}
      </div>

      {summable.length > 0 && (
        <div
          style={{
            ...styles.sumRow,
            ...(hoveredIndex === SUM_INDEX ? styles.hovered : {}),
          }}
          onClick={() => handleClick(sumText, SUM_INDEX)}
          onMouseEnter={() => setHoveredIndex(SUM_INDEX)}
          onMouseLeave={() => setHoveredIndex(null)}
          title="Click to copy sum"
        >
          <span style={styles.sumLabel}>Σ</span>
          <span style={styles.result}>
            {copiedIndex === SUM_INDEX ? '✓' : sumText}
          </span>
        </div>
      )}
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
    gap: 4,
    paddingRight: 12,
    borderRadius: 3,
    cursor: 'default',
    transition: 'background 0.1s',
  },
  hovered: {
    background: 'rgba(110,231,183,0.08)',
    cursor: 'pointer',
  },
  createdRow: {
    background: 'rgba(52,211,153,0.12)',
    borderLeft: '2px solid rgba(52,211,153,0.7)',
  },
  createdMark: {
    fontSize: 10,
    color: 'rgba(52,211,153,0.9)',
    lineHeight: '25px',
  },
  createdResult: {
    color: 'rgba(52,211,153,0.75)',
  },
  sumRow: {
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 12,
    paddingLeft: 12,
    marginTop: 4,
    borderTop: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 3,
    cursor: 'default',
    transition: 'background 0.1s',
  },
  sumLabel: {
    fontFamily: '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace',
    fontSize: 12,
    color: 'rgba(255,255,255,0.4)',
  },
  result: {
    fontFamily: '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace',
    fontSize: 13,
    lineHeight: '25px',
    color: '#6ee7b7',
    paddingInline: 4,
  },
}
