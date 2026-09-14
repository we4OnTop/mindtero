import { NodeResizeControl, ResizeControlVariant } from '@xyflow/react'

/**
 * Side grips that change only a card's width. Height is left to the content, so
 * a card grows with its text instead of clipping it — and the bottom connection
 * handle stays on the actual bottom edge.
 */
export function WidthResizer({
  visible,
  minWidth,
  maxWidth = 1400,
  onResizeStart,
}: {
  visible: boolean
  minWidth: number
  maxWidth?: number
  onResizeStart?: () => void
}) {
  if (!visible) return null
  return (
    <>
      {(['left', 'right'] as const).map((position) => (
        <NodeResizeControl
          key={position}
          position={position}
          variant={ResizeControlVariant.Line}
          resizeDirection="horizontal"
          minWidth={minWidth}
          maxWidth={maxWidth}
          onResizeStart={onResizeStart}
          className="mindtero-width-grip"
        />
      ))}
    </>
  )
}
