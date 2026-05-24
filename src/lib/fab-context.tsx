import { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export interface FABAction {
  id: string
  label: string
  icon: LucideIcon
  onClick?: () => void
  children?: FABAction[]
}

export interface FABState {
  actions: FABAction[]
}

export type FABMsg =
  | { type: 'SET'; actions: FABAction[] }
  | { type: 'CLEAR' }

export function fabReducer(state: FABState, msg: FABMsg): FABState {
  switch (msg.type) {
    case 'SET':   return { actions: msg.actions }
    case 'CLEAR': return { actions: [] }
  }
}

interface FABContextValue {
  actions: FABAction[]
  dispatch: React.Dispatch<FABMsg>
}

const FABContext = createContext<FABContextValue | null>(null)

export function FABProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(fabReducer, { actions: [] })
  return (
    <FABContext.Provider value={{ actions: state.actions, dispatch }}>
      {children}
    </FABContext.Provider>
  )
}

function useFABContext(): FABContextValue {
  const ctx = useContext(FABContext)
  if (!ctx) throw new Error('useFABContext must be used inside FABProvider')
  return ctx
}

export function useFABActions(actions: FABAction[], deps: unknown[]): void {
  const { dispatch } = useFABContext()
  useEffect(() => {
    dispatch({ type: 'SET', actions })
    return () => dispatch({ type: 'CLEAR' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}

export function useFABState(): FABAction[] {
  return useFABContext().actions
}
