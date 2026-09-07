import type { NodeTypes } from '@xyflow/react'
import { CollectionNodeView, CreatorNodeView, TagNodeView } from './chip-nodes'
import { FrameNodeView } from './frame-node'
import { ImageNodeView } from './image-node'
import { ItemNodeView } from './item-node'
import { NoteNodeView } from './note-node'

/** Defined once at module scope — recreating this object remounts every node. */
export const nodeTypes = {
  zoteroItem: ItemNodeView,
  note: NoteNodeView,
  tag: TagNodeView,
  creator: CreatorNodeView,
  collection: CollectionNodeView,
  frame: FrameNodeView,
  image: ImageNodeView,
} satisfies NodeTypes
