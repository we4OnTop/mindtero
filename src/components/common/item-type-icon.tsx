import {
  Award,
  Book,
  BookOpen,
  ClipboardList,
  Code,
  Database,
  FileText,
  Globe,
  GraduationCap,
  Image,
  Mail,
  Map,
  Mic,
  Music,
  Newspaper,
  Paperclip,
  Presentation,
  Rss,
  Scale,
  ScrollText,
  StickyNote,
  Video,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  artwork: Image,
  audioRecording: Music,
  attachment: Paperclip,
  bill: Scale,
  blogPost: Rss,
  book: Book,
  bookSection: BookOpen,
  case: Scale,
  computerProgram: Code,
  conferencePaper: Presentation,
  dataset: Database,
  dictionaryEntry: BookOpen,
  document: FileText,
  email: Mail,
  encyclopediaArticle: BookOpen,
  film: Video,
  forumPost: Rss,
  hearing: Scale,
  instantMessage: Mail,
  interview: Mic,
  journalArticle: FileText,
  letter: Mail,
  magazineArticle: Newspaper,
  manuscript: ScrollText,
  map: Map,
  newspaperArticle: Newspaper,
  note: StickyNote,
  patent: Award,
  podcast: Music,
  preprint: FileText,
  presentation: Presentation,
  radioBroadcast: Music,
  report: ClipboardList,
  standard: ClipboardList,
  statute: Scale,
  thesis: GraduationCap,
  tvBroadcast: Video,
  videoRecording: Video,
  webpage: Globe,
}

export function itemTypeIcon(itemType: string): LucideIcon {
  return ICONS[itemType] ?? FileText
}

export function ItemTypeIcon({ itemType, className }: { itemType: string; className?: string }) {
  const Icon = itemTypeIcon(itemType)
  return <Icon className={cn('size-4 shrink-0', className)} aria-hidden />
}
