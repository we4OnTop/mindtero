import { z } from 'zod'
import type { ZoteroCollection, ZoteroItem, ZoteroTag } from './types'

/**
 * Deliberately loose: Zotero ships dozens of item types with open-ended fields, so
 * we validate only the envelope. The goal is to fail loudly when the proxy returns
 * HTML or an error page instead of an item array — not to police Zotero's schema.
 */
const itemSchema = z.looseObject({
  key: z.string(),
  version: z.number(),
  data: z.looseObject({
    key: z.string(),
    itemType: z.string(),
  }),
})

const collectionSchema = z.looseObject({
  key: z.string(),
  version: z.number(),
  data: z.looseObject({
    key: z.string(),
    name: z.string(),
  }),
})

const tagSchema = z.looseObject({
  tag: z.string(),
})

function parseList<T>(schema: z.ZodType, payload: unknown, what: string): T[] {
  if (!Array.isArray(payload)) {
    throw new TypeError(`Expected a list of ${what} from Zotero, got ${typeof payload}`)
  }
  const result = z.array(schema).safeParse(payload)
  if (!result.success) {
    throw new TypeError(`Malformed ${what} payload from Zotero: ${result.error.issues[0]?.message}`)
  }
  return result.data as T[]
}

export const parseItems = (payload: unknown) => parseList<ZoteroItem>(itemSchema, payload, 'items')
export const parseCollections = (payload: unknown) =>
  parseList<ZoteroCollection>(collectionSchema, payload, 'collections')
export const parseTags = (payload: unknown) => parseList<ZoteroTag>(tagSchema, payload, 'tags')

export function parseItem(payload: unknown): ZoteroItem {
  const result = itemSchema.safeParse(payload)
  if (!result.success) {
    throw new TypeError(`Malformed item payload from Zotero: ${result.error.issues[0]?.message}`)
  }
  return result.data as unknown as ZoteroItem
}
