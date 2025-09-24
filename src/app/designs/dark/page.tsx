import Link from "next/link";

export default function DarkDesign() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0B0F14", color: "#E6EDF3" }}>
      {/* Dark top bar with golden accents */}
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: "rgba(11,15,20,0.8)", borderColor: "#1F2733", backdropFilter: "blur(12px)" as any }}>
        <div className="h-16 px-4 lg:px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-lg font-bold transition-colors duration-300 hover:text-yellow-400" style={{ color: "#E6EDF3" }}>Attendry</Link>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <Link href="/designs/dark" className="transition-colors duration-300 hover:text-yellow-400" style={{ color: "#E6EDF3" }}>Home</Link>
              <Link href="/designs/dark/events" className="transition-colors duration-300 hover:text-yellow-400" style={{ color: "#A9B4C0" }}>Events</Link>
              <Link href="/designs/dark/watchlist" className="transition-colors duration-300 hover:text-yellow-400" style={{ color: "#A9B4C0" }}>Watchlist</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20" style={{ backgroundColor: "#3A77FF", color: "#FFFFFF" }}>Sign in</Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Action dock on the left with golden hover effects */}
        <aside className="hidden xl:block w-16 pl-6">
          <div className="sticky top-24 flex flex-col items-center gap-3">
            {[
              { icon: "+", label: "Add Event", href: "/designs/dark/events" },
              { icon: "⭐", label: "Watchlist", href: "/designs/dark/watchlist" },
              { icon: "⚙️", label: "Settings", href: "/admin" }
            ].map((item, i) => (
              <Link key={i} href={item.href} title={item.label} className="group">
                <button className="w-12 h-12 rounded-full transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-yellow-500/30" style={{ backgroundColor: "#121821", border: "1px solid #1F2733", color: "#E6EDF3" }}>
                  <span className="group-hover:text-yellow-400 transition-colors duration-300">{item.icon}</span>
                </button>
              </Link>
            ))}
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">Action Dock (Dark Mode)</h1>
            <p className="text-lg max-w-2xl" style={{ color: "#A9B4C0" }}>Comfortable dark palette with golden accents and dynamic interactions. Premium feel with subtle animations.</p>
          </div>
          
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(9)].map((_, i) => (
              <article key={i} className="group rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/20" style={{ backgroundColor: "#121821", border: "1px solid #1F2733" }}>
                <div className="relative overflow-hidden" style={{ height: "9rem", backgroundColor: "#0E141C" }}>
                  <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <div className="p-4">
                  <div className="h-3 w-2/3 rounded mb-2 group-hover:bg-yellow-400/20 transition-colors duration-300" style={{ backgroundColor: "#1F2733" }} />
                  <div className="h-3 w-1/2 rounded mb-4 group-hover:bg-yellow-400/20 transition-colors duration-300" style={{ backgroundColor: "#1F2733" }} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs group-hover:text-yellow-400 transition-colors duration-300" style={{ color: "#8CA0B3" }}>Thu • 7:30 PM</span>
                    <button className="text-xs px-3 py-1.5 rounded-md transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/30 hover:scale-105" style={{ backgroundColor: "#3A77FF", color: "#FFFFFF" }}>Save</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}


