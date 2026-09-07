import type { DragEvent } from 'react'
import type { ZoteroItem } from '@/features/zotero/types'

export const ITEM_MIME = 'application/x-mindtero-items'

/** Library rows put whole Zotero items on the drag payload so the drop can build snapshots offline. */
export function setDragItems(event: DragEvent, items: ZoteroItem[]): void {
  event.dataTransfer.setData(ITEM_MIME, JSON.stringify(items))
  event.dataTransfer.effectAllowed = 'copy'
}

export function getDragItems(event: DragEvent): ZoteroItem[] {
  const raw = event.dataTransfer.getData(ITEM_MIME)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as ZoteroItem[]) : []
  } catch {
    return []
  }
}

export function hasDragItems(event: DragEvent): boolean {
  return event.dataTransfer.types.includes(ITEM_MIME)
}
