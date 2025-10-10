import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { PlusCircledIcon } from '@radix-ui/react-icons'
import { useTranslations } from 'use-intl'
import { AttachCircle } from 'iconsax-react'

interface UploadMenuProps {
  onUploadClick: () => void
}

const UploadMenu = ({ onUploadClick }: UploadMenuProps) => {
  const t = useTranslations('vault')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          className="h-8 w-8 p-0 bg-transparent hover:bg-transparent shadow-none"
        >
          <AttachCircle
            color="#555555"
            className="h-6 w-6"
          />
          <span className="sr-only">Open upload menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-50 cursor-pointer"
      >
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={onUploadClick}
        >
          {t('uploadFileAthena')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default UploadMenu
