import { describe, it, expect } from 'vitest'
import { fabReducer } from '@/lib/fab-context'
import type { FABAction, FABState, FABMsg } from '@/lib/fab-context'
import { Calculator } from 'lucide-react'

const mockAction: FABAction = {
  id: 'test',
  label: 'Test',
  icon: Calculator,
  onClick: () => {},
}

describe('fabReducer', () => {
  const empty: FABState = { actions: [] }

  it('SET replaces actions', () => {
    const next = fabReducer(empty, { type: 'SET', actions: [mockAction] })
    expect(next.actions).toHaveLength(1)
    expect(next.actions[0].id).toBe('test')
  })

  it('CLEAR empties actions', () => {
    const withActions: FABState = { actions: [mockAction] }
    const next = fabReducer(withActions, { type: 'CLEAR' })
    expect(next.actions).toHaveLength(0)
  })

  it('SET with empty array clears actions', () => {
    const withActions: FABState = { actions: [mockAction] }
    const next = fabReducer(withActions, { type: 'SET', actions: [] })
    expect(next.actions).toHaveLength(0)
  })

  it('FABAction with children is accepted by SET', () => {
    const parent: FABAction = {
      id: 'parent',
      label: 'Parent',
      icon: Calculator,
      children: [mockAction],
    }
    const next = fabReducer(empty, { type: 'SET', actions: [parent] })
    expect(next.actions[0].children).toHaveLength(1)
    expect(next.actions[0].children![0].id).toBe('test')
  })
})
