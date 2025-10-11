import Link from "next/link";

export default function DarkDesign() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      {/* Modern glassmorphism header */}
      <header className="sticky top-0 z-50 border-b border-slate-800/50 bg-slate-900/80 backdrop-blur-xl">
        <div className="h-16 px-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent hover:from-amber-300 hover:to-yellow-400 transition-all duration-500">
              Attendry
            </Link>
            <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
              <Link href="/designs/dark" className="relative text-slate-100 hover:text-amber-400 transition-colors duration-300 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-yellow-500 after:scale-x-100 after:origin-left after:transition-transform after:duration-300">
                Home
              </Link>
              <Link href="/designs/dark/events" className="relative text-slate-400 hover:text-amber-400 transition-colors duration-300 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-yellow-500 after:scale-x-0 hover:after:scale-x-100 after:origin-left after:transition-transform after:duration-300">
                Events
              </Link>
              <Link href="/designs/dark/watchlist" className="relative text-slate-400 hover:text-amber-400 transition-colors duration-300 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-yellow-500 after:scale-x-0 hover:after:scale-x-100 after:origin-left after:transition-transform after:duration-300">
                Watchlist
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm font-medium rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-500 hover:to-blue-600 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/25 hover:scale-105">
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Modern floating action dock */}
        <aside className="hidden xl:block w-20 pl-8">
          <div className="sticky top-28 flex flex-col items-center gap-4">
            {[
              { icon: "🎯", label: "Add Event", href: "/designs/dark/events" },
              { icon: "⭐", label: "Watchlist", href: "/designs/dark/watchlist" },
              { icon: "⚙️", label: "Settings", href: "/admin" }
            ].map((item, i) => (
              <Link key={i} href={item.href} title={item.label} className="group">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 flex items-center justify-center transition-all duration-500 hover:scale-110 hover:bg-slate-700/60 hover:border-amber-500/50 hover:shadow-xl hover:shadow-amber-500/20 group-hover:rotate-3">
                    <span className="text-lg group-hover:text-amber-400 transition-colors duration-300">{item.icon}</span>
                  </div>
                  <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-amber-400 to-yellow-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                </div>
              </Link>
            ))}
          </div>
        </aside>

        <main className="flex-1 p-8 lg:p-12">
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-medium mb-4">
              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></div>
              Premium Dark Theme
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent leading-tight">
              Modern Event Discovery
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl leading-relaxed">
              Experience the future of event management with our sophisticated dark interface. 
              Sleek design meets powerful functionality.
            </p>
          </div>
          
          <div className="grid gap-8 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(9)].map((_, i) => (
              <article key={i} className="group relative rounded-2xl overflow-hidden transition-all duration-500 hover:scale-105 hover:shadow-2xl hover:shadow-amber-500/10">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-2xl"></div>
                <div className="relative p-6">
                  <div className="relative overflow-hidden rounded-xl mb-4 h-32 bg-gradient-to-br from-slate-700 to-slate-800">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                    <div className="absolute top-4 right-4 w-3 h-3 rounded-full bg-amber-400 opacity-0 group-hover:opacity-100 transition-all duration-300 animate-pulse" />
                    <div className="absolute bottom-4 left-4 w-8 h-8 rounded-lg bg-slate-600/50 backdrop-blur-sm flex items-center justify-center">
                      <span className="text-amber-400 text-lg">🎯</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="h-4 w-3/4 rounded-lg bg-slate-600/50 group-hover:bg-amber-500/20 transition-colors duration-300" />
                    <div className="h-3 w-1/2 rounded-lg bg-slate-600/30 group-hover:bg-amber-500/10 transition-colors duration-300" />
                  </div>
                  
                  <div className="flex items-center justify-between mt-6">
                    <div className="flex items-center gap-2 text-sm text-slate-400 group-hover:text-amber-400 transition-colors duration-300">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Thu • 7:30 PM</span>
                    </div>
                    <button className="px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium transition-all duration-300 hover:from-blue-500 hover:to-blue-600 hover:shadow-lg hover:shadow-blue-500/25 hover:scale-105">
                      Save
                    </button>
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


