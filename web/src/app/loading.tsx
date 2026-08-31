export default function Loading() {
  return (
    <main className="page-shell" aria-busy="true" aria-label="Loading page">
      <span className="sr-only">Loading…</span>
      <div className="surface-card space-y-4 p-6 sm:p-8">
        <div className="skeleton h-3 w-28 rounded-full" />
        <div className="skeleton h-9 w-2/3 max-w-md rounded-xl" />
        <div className="skeleton h-4 w-full max-w-xl rounded-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((item) => (
          <div key={item} className="surface-card overflow-hidden">
            <div className="skeleton h-36" />
            <div className="space-y-3 p-4">
              <div className="skeleton h-5 w-3/4 rounded-lg" />
              <div className="skeleton h-3 w-full rounded-full" />
              <div className="skeleton h-3 w-2/3 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
