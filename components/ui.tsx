/** Assessment-sheet rating bar: 10 segments, colour by band. */
export function RatingBar({ value, label }: { value: number; label?: string }) {
  const color = value >= 7 ? "bg-pass" : value >= 4 ? "bg-amber" : "bg-pen";
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`${label ?? "score"} ${value} out of 10`}>
      {label && <span className="label w-32 shrink-0">{label.replace("_", " ")}</span>}
      <div className="flex flex-1 gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`h-2.5 flex-1 rounded-[2px] ${i < Math.round(value) ? color : "bg-line"}`} />
        ))}
      </div>
      <span className="w-6 text-right font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <header className="rise mb-8">
      <p className="label mb-2">{eyebrow}</p>
      <h2 className="font-display text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl">{title}</h2>
      {children && <p className="mt-3 max-w-xl text-muted">{children}</p>}
    </header>
  );
}

export function Empty({ text, action }: { text: string; action?: React.ReactNode }) {
  return (
    <div className="card rise flex flex-col items-start gap-3 p-8">
      <p className="text-muted">{text}</p>
      {action}
    </div>
  );
}
