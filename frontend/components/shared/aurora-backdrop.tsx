/**
 * Very restrained orange→gold aurora wash behind hero content. Purely
 * decorative; absolutely positioned and pointer-events-none. Pass `soft` for an
 * even quieter variant. Defined in globals.css (`.aurora`).
 */
export function AuroraBackdrop({ soft = false }: { soft?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className={soft ? 'aurora aurora-soft' : 'aurora'} />
      <div className="absolute inset-0 bg-[radial-gradient(120%_60%_at_50%_-20%,transparent_45%,hsl(var(--background))_88%)]" />
    </div>
  )
}
