import type { NodeTypes } from '@xyflow/react'
import { CollectionNodeView, CreatorNodeView, TagNodeView } from './chip-nodes'
import { FrameNodeView } from './frame-node'
import { ImageNodeView } from './image-node'
import { ItemNodeView } from './item-node'
import { ClaimNodeView } from './claim-node'
import { NoteNodeView } from './note-node'
import { QuestionNodeView } from './question-node'
import { RichTextNodeView } from './rich-text-node'
import { TimelineNodeView } from './timeline-node'

/** Defined once at module scope — recreating this object remounts every node. */
export const nodeTypes = {
  zoteroItem: ItemNodeView,
  note: NoteNodeView,
  tag: TagNodeView,
  creator: CreatorNodeView,
  collection: CollectionNodeView,
  frame: FrameNodeView,
  image: ImageNodeView,
  richText: RichTextNodeView,
  timeline: TimelineNodeView,
  claim: ClaimNodeView,
  question: QuestionNodeView,
} satisfies NodeTypes
