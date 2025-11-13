import Link from "next/link";

export default function CardsDesign() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top-only nav */}
      <header className="sticky top-0 z-50 backdrop-blur bg-white/80 border-b border-slate-200">
        <div className="h-16 px-4 lg:px-6 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold text-slate-900">Attendry</Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">Sign in</Link>
          </div>
        </div>
        {/* Secondary pill filters */}
        <div className="px-4 lg:px-6 py-3 border-t border-slate-100">
          <div className="flex flex-wrap gap-2">
            {['All','This week','Online','Nearby','Saved'].map((f) => (
              <button key={f} className="px-3 py-1.5 text-sm rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-slate-50">{f}</button>
            ))}
          </div>
        </div>
      </header>

      <main className="p-6 lg:p-8">
        <h1 className="text-xl font-semibold text-slate-900 mb-2">Card Canvas</h1>
        <p className="text-slate-600 mb-6 max-w-2xl">No sidebar; content-forward grid with pill filters below the top navigation.</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[...Array(9)].map((_, i) => (
            <article key={i} className="group rounded-xl border border-slate-200 bg-white overflow-hidden hover:shadow-sm transition-shadow">
              <div className="h-36 bg-slate-100" />
              <div className="p-4">
                <div className="h-3 w-2/3 bg-slate-100 rounded mb-2" />
                <div className="h-3 w-1/2 bg-slate-100 rounded mb-4" />
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Wed • 6:00 PM</span>
                  <button className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white">Save</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}


