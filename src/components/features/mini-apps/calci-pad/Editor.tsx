import React, { forwardRef } from 'react'

interface Props {
  value: string
  onChange: (value: string) => void
  onSelectionChange?: () => void
  inputMode?: React.HTMLAttributes<HTMLTextAreaElement>['inputMode']
}

export const Editor = forwardRef<HTMLTextAreaElement, Props>(
  function Editor({ value, onChange, onSelectionChange, inputMode = 'decimal' }, ref) {
    return (
      <textarea
        ref={ref}
        value={value}
        onChange={e => { onChange(e.target.value); onSelectionChange?.() }}
        onSelect={onSelectionChange}
        onKeyUp={onSelectionChange}
        onClick={onSelectionChange}
        onFocus={onSelectionChange}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        inputMode={inputMode}
        style={styles.textarea}
        placeholder="Type expressions, one per line…"
      />
    )
  }
)

const styles: Record<string, React.CSSProperties> = {
  textarea: {
    flex: 1,
    width: '100%',
    resize: 'none',
    fontFamily: '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", monospace',
    fontSize: 13,
    lineHeight: '25px',
    padding: '10px 12px',
    background: 'rgba(0,0,0,0.3)',
    color: '#e5e5e5',
    border: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    caretColor: '#6ee7b7',
  },
}
