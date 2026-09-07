import { NodeResizer, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { RefreshCw as RefreshCwIcon, Trash2 } from 'lucide-react'
import { memo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'
import { useBoards } from '../store'
import type { ImageNode } from '../types'
import { EdgeZones } from './handles'

const MAX_INLINE_BYTES = 4 * 1024 * 1024

/** Detects a text-free rectangular region click (placeholder for future crop UI). */
function isImageDataUrl(src: string): boolean {
  return src.startsWith('data:image/')
}

function ImageNodeComponent({ id, data, selected }: NodeProps<ImageNode>) {
  const updateNodeData = useBoards((state) => state.updateNodeData)
  const removeNodes = useBoards((state) => state.removeNodes)
  const viewOnly = useSettings((state) => state.viewOnly)
  const inputRef = useRef<HTMLInputElement>(null)
  const [zoomSrc, setZoomSrc] = useState<string | null>(null)

  const replace = (file: File) => {
    if (file.size > MAX_INLINE_BYTES) {
      toast.error('Image too large', { description: 'Keep images under 4 MB' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => updateNodeData(id, { src: String(reader.result) })
    reader.readAsDataURL(file)
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={120}
        minHeight={90}
        lineClassName="!border-primary/40"
        handleClassName="!size-2 !rounded-sm !bg-primary !border-none"
      />

      <NodeToolbar isVisible={selected} position={Position.Top} offset={8}>
        <div className="bg-popover flex items-center gap-0.5 rounded-lg border p-1 shadow-md">
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={viewOnly}
            onClick={() => inputRef.current?.click()}
            aria-label="Replace image"
          >
            <RefreshCwIcon />
          </Button>
          <Button
            size="icon-xs"
            variant="ghost"
            disabled={viewOnly}
            onClick={() => removeNodes([id])}
            aria-label="Delete image"
          >
            <Trash2 />
          </Button>
        </div>
      </NodeToolbar>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) replace(file)
        }}
      />

      <figure
        className={cn(
          'group bg-card flex h-full w-full flex-col overflow-hidden rounded-xl border shadow-sm',
          selected && 'ring-primary/60 ring-2',
        )}
      >
        <button
          type="button"
          onClick={() => setZoomSrc(data.src)}
          className="nodrag nowheel relative min-h-0 flex-1 cursor-zoom-in"
          aria-label='Enlarge image'
        >
          <img
            src={data.src}
            alt={data.caption ?? 'Board image'}
            draggable={false}
            className="pointer-events-none size-full rounded-t-xl object-cover"
          />
        </button>
        <figcaption className="w-full">
          <input
            value={data.caption ?? ''}
            onChange={(event) => updateNodeData(id, { caption: event.target.value })}
            placeholder="Caption…"
            className="text-muted-foreground nodrag h-7 w-full truncate border-t bg-transparent px-2 text-[11px] outline-none"
          />
        </figcaption>
      </figure>

      {zoomSrc && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-100 grid place-items-center bg-black/70 p-8 backdrop-blur-sm"
          onClick={() => setZoomSrc(null)}
        >
          <img
            src={zoomSrc}
            alt={data.caption ?? 'Board image'}
            className="max-h-full max-w-full rounded-lg shadow-2xl"
          />
        </div>
      )}

      <EdgeZones />
    </>
  )
}

export const ImageNodeView = memo(ImageNodeComponent)
export { isImageDataUrl }
