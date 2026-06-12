import { createContext, useContext } from 'react'

/**
 * Lets group nodes ask the surrounding flow to drill into their nested tree.
 * Null outside a provider, so group nodes degrade to a plain name display.
 */
export const GroupNavContext = createContext<{
  openGroup: (treeId: string) => void
} | null>(null)

export function useGroupNav() {
  return useContext(GroupNavContext)
}
