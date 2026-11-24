"use client"

import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { useBackground } from "@/hooks/use-background"
import { BACKGROUNDS, isBackgroundId } from "@/lib/backgrounds"

export function BackgroundPicker() {
  const [background, setBackground] = useBackground()
  return (
    <ToggleGroup
      aria-label="Фон страницы"
      variant="outline"
      size="sm"
      spacing={0}
      value={[background]}
      onValueChange={(value) => {
        const next = value[0]
        if (isBackgroundId(next)) setBackground(next)
      }}
      className="bg-card"
    >
      {BACKGROUNDS.map((bg) => (
        <ToggleGroupItem key={bg.id} value={bg.id} className="px-2.5">
          {bg.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
