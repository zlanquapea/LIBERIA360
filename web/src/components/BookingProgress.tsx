export function BookingProgress({ status, tracksCompletion = false }: { status: string; tracksCompletion?: boolean }) {
  const ended = status === "declined" || status === "cancelled" || status === "rejected";
  const steps = tracksCompletion ? ["Requested", "Confirmed", "Completed"] : ["Requested", "Confirmed"];
  const current = status === "completed" ? 2 : status === "confirmed" ? 1 : 0;
  return <section aria-label="Booking progress" className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-800/50">
    {ended ? <p className="text-sm font-semibold capitalize">Booking {status}</p> : <ol className="flex gap-2">
      {steps.map((label, index) => <li key={label} aria-current={current === index ? "step" : undefined} className="min-w-0 flex-1">
        <div className={`mb-2 h-1.5 rounded-full ${index <= current ? "bg-emerald-600 dark:bg-emerald-300" : "bg-slate-200 dark:bg-slate-700"}`} />
        <span className={`text-xs ${index === current ? "font-bold" : "text-slate-500 dark:text-slate-400"}`}>{label}</span>
      </li>)}
    </ol>}
    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
      {ended ? "This booking is no longer active." : status === "completed" ? "Your experience is complete. You can leave a review." : status === "confirmed" ? "Your request is confirmed. Use Messages to agree on arrival details." : "Waiting for the provider to confirm your request. You do not have a confirmed reservation yet."}
    </p>
  </section>;
}
