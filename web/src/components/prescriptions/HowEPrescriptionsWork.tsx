const STEPS = [
  {
    title: 'See a verified doctor',
    body: 'Every doctor here has a Medical Council licence LIBERIA360 has checked.',
  },
  {
    title: 'Get your prescription on your phone',
    body: 'It arrives in the app with a QR code. No paper to lose, and nobody can copy it.',
  },
  {
    title: 'Collect or get it delivered',
    body: 'The clinic pharmacy packs it while you walk over, or order from any pharmacy and pay by mobile money.',
  },
];

export function HowEPrescriptionsWork() {
  return (
    <ol className="grid gap-3 sm:grid-cols-3">
      {STEPS.map((s, i) => (
        <li key={s.title} className="rounded-3xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-sm font-black text-white">
            {i + 1}
          </span>
          <h3 className="mt-3 font-bold text-slate-950 dark:text-slate-50">{s.title}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{s.body}</p>
        </li>
      ))}
    </ol>
  );
}
