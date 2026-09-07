import { ReactFlowProvider } from '@xyflow/react'
import { TopBar } from '@/components/layout/top-bar'
import { ConnectionOfflineCard } from '@/components/layout/connection-badge'
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable'
import { LibraryPanel } from '@/features/library/library-panel'
import { BoardCanvas } from './canvas'
import { CommandPalette } from './command-palette'
import { InspectorPanel } from './inspector/inspector-panel'
import { useActiveBoard } from './store'

export function BoardPage() {
  const board = useActiveBoard()

  return (
    <ReactFlowProvider>
      <div className="flex h-dvh flex-col overflow-hidden">
        {board && <TopBar board={board} />}
        <div className="min-h-0 flex-1">
          <ResizablePanelGroup orientation="horizontal">
            <ResizablePanel id="library" defaultSize="22%" minSize="16%" maxSize="35%" className="flex flex-col border-r">
              <ConnectionOfflineCard />
              <LibraryPanel />
            </ResizablePanel>
            <ResizableHandle className="w-1.5" />
            <ResizablePanel id="canvas" className="relative">
              <BoardCanvas />
              <CommandPalette />
            </ResizablePanel>
            <ResizableHandle className="w-1.5" />
            <ResizablePanel id="inspector" defaultSize="18%" minSize="14%" maxSize="35%" className="border-l">
              <InspectorPanel />
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </div>
    </ReactFlowProvider>
  )
}
