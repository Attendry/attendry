import Link from "next/link";

export default function SplitDesign() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Global top nav */}
      <header className="sticky top-0 z-50 backdrop-blur bg-white/80 border-b border-gray-200">
        <div className="h-16 px-4 lg:px-6 flex items-center justify-between">
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/" className="text-lg font-bold text-gray-900">Attendry</Link>
            <Link href="/" className="text-gray-600 hover:text-gray-900">Home</Link>
            <Link href="/events" className="text-gray-900 font-medium">Events</Link>
            <Link href="/watchlist" className="text-gray-600 hover:text-gray-900">Watchlist</Link>
          </nav>
          <Link href="/login" className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">Sign in</Link>
        </div>
      </header>

      <div className="flex">
        {/* Left filter rail for section-level controls */}
        <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)] p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Filters</h2>
          <div className="space-y-4">
            <div>
              <div className="text-xs text-gray-500 mb-1">Date</div>
              <div className="flex flex-wrap gap-2">
                {["Today","This Week","This Month"].map(x => (
                  <button key={x} className="px-2.5 py-1 text-xs rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">{x}</button>
                ))}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Type</div>
              <div className="flex flex-col gap-2">
                {["Conference","Meetup","Webinar","Workshop"].map(x => (
                  <label key={x} className="inline-flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox" className="rounded border-gray-300" /> {x}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Split Navigation</h1>
          <p className="text-gray-600 mb-6 max-w-2xl">Global navigation on top, contextual filters/actions on the left. Great for browsing and narrowing large lists.</p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="h-16 bg-gray-100 rounded mb-3" />
                <div className="h-3 w-1/2 bg-gray-100 rounded mb-2" />
                <div className="h-3 w-2/3 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}


