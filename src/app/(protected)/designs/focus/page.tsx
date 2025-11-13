import Link from "next/link";

export default function FocusDesign() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Collapsible minimal top nav */}
      <header className="sticky top-0 z-50 backdrop-blur bg-white/80 border-b border-slate-200">
        <div className="h-14 px-4 lg:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <Link href="/" className="text-slate-900 font-semibold">Attendry</Link>
            <span>/</span>
            <span>Events</span>
          </div>
          <Link href="/login" className="px-2.5 py-1.5 text-xs rounded-md bg-slate-900 text-white">Sign in</Link>
        </div>
      </header>

      <main className="p-6 lg:p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold text-slate-900">Focus Mode</h1>
          <button className="text-sm text-slate-700 hover:text-slate-900">⋮</button>
        </div>
        <p className="text-slate-600 mb-6">Content-centric layout with minimal chrome. Secondary actions tucked into a single menu per section.</p>

        <section className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <article key={i} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 pr-4">
                  <div className="h-4 w-1/2 bg-slate-100 rounded mb-2" />
                  <div className="h-3 w-2/3 bg-slate-100 rounded" />
                </div>
                <button className="text-slate-500 hover:text-slate-700">⋮</button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}


