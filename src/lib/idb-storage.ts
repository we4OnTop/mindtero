import { del, get, set } from 'idb-keyval'
import type { StateStorage } from 'zustand/middleware'

/**
 * Boards hold whole graphs, which outgrow localStorage's ~5 MB quota quickly.
 * IndexedDB also keeps the (potentially large) write off the main thread.
 */
export const idbStorage: StateStorage = {
  getItem: async (name) => (await get<string>(name)) ?? null,
  setItem: async (name, value) => {
    await set(name, value)
  },
  removeItem: async (name) => {
    await del(name)
  },
}
