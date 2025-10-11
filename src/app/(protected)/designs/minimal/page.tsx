import Link from "next/link";

export default function MinimalDesign() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="sticky top-0 z-50 backdrop-blur bg-white/80 border-b border-gray-200">
        <div className="h-16 px-4 lg:px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-lg font-bold text-gray-900">Attendry</Link>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <Link href="/" className="text-gray-600 hover:text-gray-900">Home</Link>
              <Link href="/events" className="text-gray-600 hover:text-gray-900">Events</Link>
              <Link href="/watchlist" className="text-gray-600 hover:text-gray-900">Watchlist</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700">Sign in</Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar (compact) */}
        <aside className="w-16 lg:w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-4rem)]">
          <div className="h-16 flex items-center justify-center lg:justify-start px-4 border-b border-gray-200">
            <span className="font-semibold text-gray-900 hidden lg:block">Navigation</span>
            <span className="lg:hidden">≡</span>
          </div>
          <nav className="p-2 lg:p-4 space-y-2">
            {[
              { href: "/", label: "Home" },
              { href: "/events", label: "Events" },
              { href: "/watchlist", label: "Watchlist" },
            ].map((item) => (
              <Link key={item.href} href={item.href} className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-50">
                <span className="hidden lg:inline">{item.label}</span>
                <span className="lg:hidden" aria-hidden>•</span>
              </Link>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 p-6 lg:p-8">
          <h1 className="text-xl font-semibold text-gray-900 mb-3">Minimal Sidebar + Top Bar</h1>
          <p className="text-gray-600 mb-6 max-w-2xl">
            Neutral, breathable layout with a compact left sidebar and a clean sticky top bar. Great default that emphasizes clarity and quick scanning.
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
                <div className="h-20 bg-gray-100 rounded mb-3" />
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


