# Mindtero — Architecture & Build Plan

Visual thinking layer on top of a local Zotero library. Zotero stays the database
and single source of truth for bibliography; Mindtero owns the *graph overlay* —
boards, spatial layout, typed relations and free-form notes.

---

## 1. Core design decision: who owns what

| Concern | Owner | Why |
| --- | --- | --- |
| Items, collections, tags, notes, attachments, metadata | **Zotero** (local API) | It is already the database. We never duplicate it. |
| Boards, node positions, typed edges, free notes, colors, frames | **Mindtero** (IndexedDB) | The local API is **read-only**; and layout is not Zotero's model anyway. |
| Rendering / interaction | **Mindtero** (React Flow) | — |

Item nodes store only a `itemKey` + a small **snapshot** (title, creators, year,
type) so a board still renders when Zotero is closed. Live data is re-fetched and
re-hydrated whenever the API is reachable.

### The read-only constraint
Zotero 7's local API (`http://localhost:23119/api`) mirrors the Zotero Web API v3
but supports **GET only**. Write-back paths, in order of preference for later:

1. **Web API** (`api.zotero.org`) with a user API key — full read/write, requires the
   library to be synced. Best route for pushing `dc:relation` links and tags back.
2. **Zotero connector endpoints** (`/connector/saveItems`) — undocumented, fragile.
3. **A Zotero plugin** exposing custom endpoints — most power, most work.

v1 writes nothing back. The store is designed so a `WriteAdapter` can be dropped in
later without touching the UI.

### CORS
The local API sends no `Access-Control-Allow-Origin`, so the browser cannot call it
directly. Solved with a **Vite dev/preview proxy**: `/zotero-api/*` → `127.0.0.1:23119/*`.
For a shipped app the same trick is done by an Electron/Tauri shell or a tiny local
proxy binary. All app code targets the relative path, so nothing changes.

---

## 2. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Build | **Vite 8** + React 19 + TypeScript (strict) | |
| Styling | **Tailwind CSS v4** (`@tailwindcss/vite`) | CSS-first config, oklch tokens |
| Components | **shadcn/ui** (radix base, `nova` preset) | owned source in `components/ui` |
| Icons | **lucide-react** | |
| Canvas | **@xyflow/react (React Flow 12)** | custom nodes/edges, `ConnectionMode.Loose` |
| Auto-layout | **@dagrejs/dagre** | layered layouts; ELK can be added for radial/force |
| Server state | **TanStack Query v5** | caching, dedupe, retries for the Zotero API |
| Client state | **Zustand 5** + `persist` on **IndexedDB** (`idb-keyval`) | boards, undo/redo |
| Routing | **React Router 7** | `/boards`, `/boards/:id` |
| Validation | **Zod 4** | parses API payloads at the boundary |
| Toasts | **sonner** · Palette: **cmdk** · Panels: **react-resizable-panels** |
| Export | **html-to-image** (PNG), JSON, CSL bibliography via `include=bib` |
| Test | **Vitest** + Testing Library + jsdom | |

---

## 3. Module map

```
src/
├─ app/            providers, router, theme
├─ components/
│  ├─ ui/          shadcn primitives
│  ├─ layout/      app shell, top bar, connection badge
│  └─ common/      empty states, item-type icons
├─ features/
│  ├─ zotero/      ── the API boundary ──
│  │   types.ts    Zotero Web API v3 shapes
│  │   source.ts   ZoteroSource interface  ← the seam
│  │   local-api.ts  local HTTP API implementation
│  │   demo.ts     offline fixture library (works with Zotero closed)
│  │   queries.ts  TanStack Query hooks
│  │   format.ts   creators→string, year, zotero:// deep links, relation URI parsing
│  ├─ library/     collection tree, item list, search, drag sources
│  ├─ graph/       canvas, nodes, edges, layout, expansion, export, inspector
│  └─ boards/      board gallery + CRUD
└─ lib/            utils, idb storage adapter, settings store
```

`ZoteroSource` is the only thing that knows about HTTP. Swapping in the Web API,
a mock, or a plugin backend is one file.

---

## 4. Data model (graph overlay)

```ts
Board  { id, name, nodes: MindNode[], edges: MindEdge[], viewport, createdAt, updatedAt }

MindNode =
  | 'zoteroItem'  { itemKey, snapshot, accent, collapsed }   id: `item:<KEY>`
  | 'note'        { text, color }                            id: `note:<nanoid>`
  | 'tag'         { tag }                                    id: `tag:<name>`
  | 'creator'     { name }                                   id: `creator:<name>`
  | 'collection'  { collectionKey, name }                    id: `collection:<KEY>`
  | 'frame'       { label, color }        resizable grouping frame

MindEdge  { type:'relation', data: { kind: RelationKind, label?, note? } }
RelationKind = related | supports | contradicts | extends | cites | method | context | custom
```

Deterministic node ids (`item:ABCD1234`) give free deduplication when the same item
is added or expanded twice.

**Undo/redo**: snapshot stack per board (nodes+edges are immutable, so snapshots are
cheap structural copies), committed on discrete actions and on drag start. Not persisted.

---

## 5. Key workflows

1. **Connect** — probe `/api/users/0/collections?limit=1`. On failure show a setup card
   with the exact Zotero setting to enable, plus a one-click *Demo library* fallback.
2. **Browse** — collection tree + tag filter + search (`q`, `qmode=titleCreatorYear`),
   paginated with `Total-Results` / `start`.
3. **Compose** — drag items from the library onto the canvas, or ⌘K → search → Enter.
4. **Relate** — drag between node handles; pick a relation kind; colour/dash encodes it.
5. **Expand** — from any item node, pull in: Zotero *related* items (`dc:relation`),
   authors, tags, parent collections, child notes, or siblings sharing a tag.
   This is what turns a flat library into a graph.
6. **Arrange** — dagre auto-layout (↓ / →), fit view, frames for clustering.
7. **Inspect** — right panel: live item metadata, abstract, tags, child notes,
   "Open in Zotero" (`zotero://select/...`).
8. **Export** — board → PNG, board → JSON, selection → formatted bibliography.

---

## 6. Roadmap after this base

- Write-back adapter (Web API key) for `dc:relation`, tags, and notes.
- Saved searches + advanced query builder.
- PDF annotation nodes (`/items/<key>/children` → annotations) and quote cards.
- Similarity/co-citation suggestions ("papers you should connect").
- ELK radial + force layouts, clustering by collection/tag.
- Multi-library and group library support (already modelled in `ZoteroLibraryRef`).
- Board templates (literature review, systematic map, argument map).
- Offline-first sync of the snapshot cache; conflict handling on item deletion.
