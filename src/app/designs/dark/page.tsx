import Link from "next/link";

export default function DarkDesign() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0B0F14", color: "#E6EDF3" }}>
      {/* Dark top bar */}
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: "rgba(11,15,20,0.7)", borderColor: "#1F2733", backdropFilter: "blur(8px)" as any }}>
        <div className="h-16 px-4 lg:px-6 flex items-center justify-between">
          <Link href="/" className="text-lg font-bold" style={{ color: "#E6EDF3" }}>Attendry</Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm rounded-lg" style={{ backgroundColor: "#3A77FF", color: "#FFFFFF" }}>Sign in</Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Action dock on the right */}
        <main className="flex-1 p-6 lg:p-8">
          <h1 className="text-xl font-semibold mb-2" style={{ color: "#E6EDF3" }}>Action Dock (Dark Mode)</h1>
          <p className="mb-6 max-w-2xl" style={{ color: "#A9B4C0" }}>Comfortable dark palette with low-contrast dividers and soft shadows. Primary action emphasis via saturated blue.</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...Array(9)].map((_, i) => (
              <article key={i} className="rounded-xl overflow-hidden" style={{ backgroundColor: "#121821", border: "1px solid #1F2733" }}>
                <div style={{ height: "9rem", backgroundColor: "#0E141C" }} />
                <div className="p-4">
                  <div className="h-3 w-2/3 rounded mb-2" style={{ backgroundColor: "#1F2733" }} />
                  <div className="h-3 w-1/2 rounded mb-4" style={{ backgroundColor: "#1F2733" }} />
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#8CA0B3" }}>Thu • 7:30 PM</span>
                    <button className="text-xs px-2 py-1 rounded-md" style={{ backgroundColor: "#3A77FF", color: "#FFFFFF" }}>Save</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </main>

        <aside className="hidden xl:block w-16 pr-6">
          <div className="sticky top-24 flex flex-col items-center gap-3">
            {["+","⭐","⚙️"].map((x, i) => (
              <button key={i} className="w-12 h-12 rounded-full" style={{ backgroundColor: "#121821", border: "1px solid #1F2733", color: "#E6EDF3" }}>{x}</button>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}


