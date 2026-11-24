"use client"

import Image from "next/image"
import { ChevronDownIcon, PaletteIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useBackground } from "@/hooks/use-background"
import { BACKGROUNDS, isBackgroundId } from "@/lib/backgrounds"

function Preview({ id }: { id: string }) {
  const bg = BACKGROUNDS.find((b) => b.id === id)
  if (!bg || !("piece" in bg)) {
    // The plain theme: a swatch of the page and panel colours.
    return <span aria-hidden className="h-9 w-16 shrink-0 rounded-md border bg-[#f4f6f9]" />
  }
  return (
    <Image
      src={`/backgrounds/${bg.piece}.png`}
      alt=""
      width={64}
      height={36}
      className="h-9 w-16 shrink-0 rounded-md border object-cover"
    />
  )
}

export function BackgroundPicker() {
  const [background, setBackground] = useBackground()
  const current = BACKGROUNDS.find((bg) => bg.id === background) ?? BACKGROUNDS[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="outline" size="sm" className="bg-card" aria-label={`Тема: ${current.label}`} />}
      >
        <PaletteIcon data-icon="inline-start" aria-hidden />
        {current.label}
        <ChevronDownIcon data-icon="inline-end" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Тема</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={background}
            onValueChange={(value) => {
              if (isBackgroundId(value)) setBackground(value)
            }}
          >
            {BACKGROUNDS.map((bg) => (
              <DropdownMenuRadioItem key={bg.id} value={bg.id} closeOnClick className="gap-3 py-1.5">
                <Preview id={bg.id} />
                <span className="flex min-w-0 flex-col">
                  <span className="font-medium">{bg.label}</span>
                  <span className="text-xs text-muted-foreground">{bg.note}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
