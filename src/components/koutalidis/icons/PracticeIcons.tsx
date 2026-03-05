'use client'

import {
  Landmark,
  Briefcase,
  Zap,
  Gavel,
  Monitor,
  Calculator,
  Building2,
  FileCheck,
  File,
  Languages,
  MessageSquare,
  Layers,
  FileText,
  LayoutList,
  ArrowLeftRight,
  FilePlus,
  FolderOpen,
  BookOpen,
  type LucideProps,
} from 'lucide-react'

const ICON_MAP: Record<string, React.FC<LucideProps>> = {
  bank: Landmark,
  briefcase: Briefcase,
  bolt: Zap,
  gavel: Gavel,
  monitor: Monitor,
  calculator: Calculator,
  building: Building2,
  fileCheck: FileCheck,
  file: File,
  languages: Languages,
  messageText: MessageSquare,
  layer: Layers,
  documentText: FileText,
  menuBoard: LayoutList,
  convertShape: ArrowLeftRight,
  noteAdd: FilePlus,
  folderOpen: FolderOpen,
  book: BookOpen,
}

interface PracticeIconProps extends LucideProps {
  iconName: string
}

export function PracticeIcon({ iconName, ...props }: PracticeIconProps) {
  const IconComponent = ICON_MAP[iconName] || File
  return <IconComponent {...props} />
}

export function getPracticeAreaIcon(iconName: string): React.FC<LucideProps> {
  return ICON_MAP[iconName] || File
}
