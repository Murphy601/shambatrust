export function AdvocateAttestationBadge({
  advocateName,
  lskNumber,
  stampRef,
  stampedAt,
  statusLabel,
}: {
  advocateName: string;
  lskNumber: string;
  stampRef?: string | null;
  stampedAt?: string | null;
  statusLabel: string;
}) {
  const lsk = lskNumber.trim() || "—";
  return (
    <div className="inline-flex max-w-full items-start gap-3 rounded-[0.45rem] border-2 border-[#C5A028] bg-[#fffdf6] px-3 py-2">
      <span
        aria-hidden
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-4 border-[#1E5631] text-[10px] font-bold uppercase leading-tight text-[#1E5631]"
      >
        LSK
        <br />
        stamp
      </span>
      <div className="min-w-0">
        <p className="text-sm font-bold uppercase tracking-wide text-[#C5A028]">
          {statusLabel}
        </p>
        <p className="truncate text-base font-semibold text-forest-deep">
          {advocateName || "LSK advocate"}
        </p>
        <p className="text-sm text-ink">LSK {lsk}</p>
        {stampRef ? <p className="text-xs text-muted">{stampRef}</p> : null}
        {stampedAt ? (
          <p className="text-xs text-muted">
            {new Date(stampedAt).toLocaleDateString("en-KE")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
