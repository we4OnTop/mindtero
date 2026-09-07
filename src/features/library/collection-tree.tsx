import { ChevronRight, Folder, FolderOpen, Library } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { useCollections } from '@/features/zotero/queries'
import type { ZoteroCollection } from '@/features/zotero/types'
import { cn } from '@/lib/utils'
import { useLibraryState } from './library-state'

interface TreeNode {
  collection: ZoteroCollection
  children: TreeNode[]
}

/** Zotero returns a flat list with `parentCollection` pointers. */
function buildTree(collections: ZoteroCollection[]): TreeNode[] {
  const nodes = new Map<string, TreeNode>()
  for (const collection of collections) nodes.set(collection.key, { collection, children: [] })

  const roots: TreeNode[] = []
  for (const node of nodes.values()) {
    const parentKey = node.collection.data.parentCollection
    const parent = parentKey ? nodes.get(parentKey) : undefined
    if (parent) parent.children.push(node)
    else roots.push(node)
  }

  const sortTree = (list: TreeNode[]) => {
    list.sort((a, b) => a.collection.data.name.localeCompare(b.collection.data.name))
    for (const node of list) sortTree(node.children)
  }
  sortTree(roots)
  return roots
}

function CollectionRow({ node, depth }: { node: TreeNode; depth: number }) {
  const [open, setOpen] = useState(depth === 0)
  const selected = useLibraryState((state) => state.collectionKey === node.collection.key)
  const setCollection = useLibraryState((state) => state.setCollection)
  const hasChildren = node.children.length > 0

  return (
    <li>
      <div
        className={cn(
          'group flex items-center gap-1 rounded-md pr-2 text-sm',
          selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60',
        )}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className={cn('shrink-0 p-1', !hasChildren && 'invisible')}
          aria-label={open ? 'Collapse' : 'Expand'}
          aria-expanded={open}
        >
          <ChevronRight
            className={cn('text-muted-foreground size-3.5 transition-transform', open && 'rotate-90')}
          />
        </button>
        <button
          type="button"
          onClick={() => setCollection(selected ? null : node.collection.key)}
          className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left"
        >
          {open && hasChildren ? (
            <FolderOpen className="text-muted-foreground size-3.5 shrink-0" />
          ) : (
            <Folder className="text-muted-foreground size-3.5 shrink-0" />
          )}
          <span className="truncate">{node.collection.data.name}</span>
          <span className="text-muted-foreground ml-auto shrink-0 text-[11px] tabular-nums">
            {node.collection.meta.numItems}
          </span>
        </button>
      </div>
      {open && hasChildren && (
        <ul>
          {node.children.map((child) => (
            <CollectionRow key={child.collection.key} node={child} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function CollectionTree() {
  const { data, isLoading } = useCollections()
  const tree = useMemo(() => buildTree(data ?? []), [data])
  const collectionKey = useLibraryState((state) => state.collectionKey)
  const setCollection = useLibraryState((state) => state.setCollection)

  if (isLoading) {
    return (
      <div className="space-y-1.5 px-2 py-1">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-6 w-full" />
        ))}
      </div>
    )
  }

  return (
    <ul className="space-y-px px-1 py-1">
      <li>
        <button
          type="button"
          onClick={() => setCollection(null)}
          className={cn(
            'flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-sm',
            collectionKey === null ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/60',
          )}
        >
          <Library className="text-muted-foreground size-3.5 shrink-0" />
          <span>All items</span>
        </button>
      </li>
      {tree.map((node) => (
        <CollectionRow key={node.collection.key} node={node} depth={0} />
      ))}
    </ul>
  )
}
