'use client'

import { Presentation } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { usePresenter } from '@/components/shared/presenter-provider'

/** Toggle presenter mode (larger type + spacing for a projector at the viva). */
export function PresenterToggle() {
  const { presenter, toggle } = usePresenter()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={presenter ? 'gold' : 'ghost'}
          size="icon"
          aria-pressed={presenter}
          aria-label="Toggle presenter mode"
          onClick={toggle}
        >
          <Presentation className="h-[1.1rem] w-[1.1rem]" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Presenter mode {presenter ? 'on' : 'off'}
      </TooltipContent>
    </Tooltip>
  )
}
