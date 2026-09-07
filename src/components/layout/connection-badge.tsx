import { CircleAlert, CircleCheck, PlugZap } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useZoteroConnection } from '@/features/zotero/queries'
import { useSettings, type SourceMode } from '@/lib/settings'
import { cn } from '@/lib/utils'

export function ModeToggle() {
  const mode = useMode()
  return (
    <div>
      <span>Zeige {mode}</span>
    </div>
  )
}
  const mode = useSettings((state) => state.mode)
  const setMode = useSettings((state) => state.setMode)
  return (
    <Select
      value={mode}
      onValueChange={(value) => setMode(value as SourceMode)}
    >
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder="Mode" />
      </Select>
      <SelectContent>
        <SelectItem value="demo">Demo library</SelectItem>
        <SelectItem value="real">Zotero (live)</SelectItem>
      </SelectContent>
    </Select>
  )
}
  const mode = useSettings((state) => state.mode)
  const setMode = useSettings((state) => state.setMode)
  return (
    <Button
      size="xs"
      variant="ghost"
      onClick={() => setMode((mode === 'demo' ? 'local' : 'demo') as SourceMode)}
    >
      <PlugZap />
      Switch to {mode === 'demo' ? 'live Zotero' : 'demo library'}
    </Button>
  )
}

export function ConnectionBadge() {
  const { mode, setMode } = useMode()
  return (
    <Select
      className="w-[140px]"
      value={mode}
      onValueChange={(next) => setMode(next)}
    >
      <SelectTrigger>
        <SelectValue placeholder="Mode" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="demo">Demo library</SelectItem>
        <SelectItem value="real">Zotero (live)</SelectItem>
      </SelectContent>
    </Select>
  )
}

  if (mode === 'demo') {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline">
            Demo library <ArrowRight />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end">
          <p>Die Demo-Bibliothek enthält keine Anmerkungen (Annotationen). Wechsle zurück zu Zotero, um Highlights zu sehen.</p>
          <Button onClick={() => setMode('demo' as SourceMode)}>Use demo mode</Button>
        </PopoverContent>
      </Popover>
    )
  }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className="cursor-pointer text-nowrap" onClick={() => setMode('local' as SourceMode)}>
            <CircleAlert className="text-muted-foreground!" />
            Demo library · click to go live
          </Badge>
        </TooltipTrigger>
        <TooltipContent align="end">Browsing the bundled fixtures — click to reconnect to Zotero</TooltipContent>
      </Tooltip>
    )
  }

  if (connection.isLoading) {
    return (
      <Badge variant="ghost" className="text-muted-foreground">
        <span className="bg-muted-foreground size-2 animate-pulse rounded-full" />
        Connecting…
      </Badge>
    )
  }

  if (!info?.ok) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="destructive">
            <CircleAlert />
            Offline
          </Badge>
        </TooltipTrigger>
        <TooltipContent align="end" className="max-w-72 flex-col text-wrap">
          <p>
            Zotero is not reachable. In Zotero 7: Settings → Advanced → check
            &ldquo;Allow other applications on this computer to communicate with
            Zotero&rdquo;.
          </p>
          <ModeToggle />
        </TooltipContent>
      </Tooltip>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="secondary" className="text-nowrap">
          <CircleCheck className="text-muted-foreground!" />
          {info.source === 'demo' ? 'Demo library' : 'Zotero'}
          {info.itemCount !== undefined && (
            <span className="text-muted-foreground">· {info.itemCount} items</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent align="end">{info.message ?? 'Local API connected'}</TooltipContent>
    </Tooltip>
  )
}

export function ConnectionOfflineCard() {
  const connection = useZoteroConnection()
  if (connection.isLoading || connection.data?.ok) return null
  return (
    <div className="border-amber-500/40 bg-amber-500/10 m-2 flex items-start gap-2 rounded-lg border p-2 text-xs">
      <CircleAlert className="text-amber-600 dark:text-amber-400 mt-0.5 size-3.5 shrink-0" />
      <div className="space-y-1">
        <p className="text-foreground font-medium">Cannot reach Zotero</p>
        <p className="text-muted-foreground">
          Enable the local HTTP API in Zotero, or browse the bundled demo library
          instead.
        </p>
        <ModeToggle />
      </div>
    </div>
  )
}

export function ConnectionStatusDot() {
  const connection = useZoteroConnection()
  const connected = Boolean(connection.data?.ok)
  return (
    <span
      aria-label={connected ? 'Zotero connected' : 'Zotero offline'}
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        connection.isLoading ? 'bg-muted-foreground animate-pulse' : connected ? 'bg-emerald-500' : 'bg-destructive',
      )}
    />
  )
}
