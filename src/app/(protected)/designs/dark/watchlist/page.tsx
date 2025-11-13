"use client";
import Link from "next/link";
import { useState } from "react";

export default function DarkWatchlistPage() {
  const [newItem, setNewItem] = useState("");
  const [items, setItems] = useState([
    {
      id: 1,
      label: "AI & Machine Learning Conferences",
      type: "event",
      date: "2024-03-15",
      status: "active"
    },
    {
      id: 2,
      label: "Tech Startup Founders",
      type: "attendee",
      date: "2024-03-10",
      status: "active"
    },
    {
      id: 3,
      label: "Blockchain & Crypto Events",
      type: "event",
      date: "2024-03-08",
      status: "active"
    },
    {
      id: 4,
      label: "Women in Tech Speakers",
      type: "attendee",
      date: "2024-03-05",
      status: "active"
    },
    {
      id: 5,
      label: "Cloud Computing Workshops",
      type: "event",
      date: "2024-03-01",
      status: "completed"
    }
  ]);

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.trim()) return;
    
    const newWatchItem = {
      id: Date.now(),
      label: newItem,
      type: "event" as const,
      date: new Date().toISOString().split('T')[0],
      status: "active" as const
    };
    
    setItems([newWatchItem, ...items]);
    setNewItem("");
  };

  const removeItem = (id: number) => {
    setItems(items.filter(item => item.id !== id));
  };

  const toggleStatus = (id: number) => {
    setItems(items.map(item => 
      item.id === id 
        ? { ...item, status: item.status === "active" ? "completed" : "active" }
        : item
    ));
  };

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
              <Link href="/designs/dark" className="relative text-slate-400 hover:text-amber-400 transition-colors duration-300 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-yellow-500 after:scale-x-0 hover:after:scale-x-100 after:origin-left after:transition-transform after:duration-300">
                Home
              </Link>
              <Link href="/designs/dark/events" className="relative text-slate-400 hover:text-amber-400 transition-colors duration-300 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-yellow-500 after:scale-x-0 hover:after:scale-x-100 after:origin-left after:transition-transform after:duration-300">
                Events
              </Link>
              <Link href="/designs/dark/watchlist" className="relative text-slate-100 hover:text-amber-400 transition-colors duration-300 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-yellow-500 after:scale-x-100 after:origin-left after:transition-transform after:duration-300">
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
              { icon: "⭐", label: "Watchlist", href: "/designs/dark/watchlist", active: true },
              { icon: "⚙️", label: "Settings", href: "/admin" }
            ].map((item, i) => (
              <Link key={i} href={item.href} title={item.label} className="group">
                <div className="relative">
                  <div className={`w-14 h-14 rounded-2xl backdrop-blur-sm border flex items-center justify-center transition-all duration-500 hover:scale-110 hover:shadow-xl hover:shadow-amber-500/20 group-hover:rotate-3 ${
                    item.active 
                      ? 'bg-amber-500/20 border-amber-500/50 shadow-lg shadow-amber-500/20' 
                      : 'bg-slate-800/60 border-slate-700/50 hover:bg-slate-700/60 hover:border-amber-500/50'
                  }`}>
                    <span className={`text-lg transition-colors duration-300 ${
                      item.active ? 'text-amber-400' : 'group-hover:text-amber-400'
                    }`}>{item.icon}</span>
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
              Personal Watchlist
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent leading-tight">
              My Watchlist
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl leading-relaxed">
              Keep track of events and people you're interested in. Never miss an opportunity to connect and learn.
            </p>
          </div>

          {/* Add Item Form */}
          <div className="mb-8">
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#121821", border: "1px solid #1F2733" }}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1F2733" }}>
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold" style={{ color: "#E6EDF3" }}>Add to Watchlist</h2>
                </div>
                
                <form onSubmit={addItem} className="flex gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={newItem}
                      onChange={(e) => setNewItem(e.target.value)}
                      placeholder="e.g., AI conferences, keynote speakers, networking events"
                      className="w-full px-4 py-3 rounded-lg transition-all duration-300 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      style={{ backgroundColor: "#1F2733", border: "1px solid #2A3441", color: "#E6EDF3" }}
                    />
                  </div>
                  <button 
                    type="submit"
                    className="px-6 py-3 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/30 hover:scale-105"
                    style={{ backgroundColor: "#3A77FF", color: "#FFFFFF" }}
                  >
                    Add Item
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Watchlist Items */}
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold" style={{ color: "#E6EDF3" }}>Your Items ({items.length})</h2>
              <div className="flex items-center gap-2 text-sm" style={{ color: "#8CA0B3" }}>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-400"></div>
                  <span>{items.filter(i => i.status === "active").length} Active</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                  <span>{items.filter(i => i.status === "completed").length} Completed</span>
                </div>
              </div>
            </div>

            {items.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#1F2733" }}>
                  <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium mb-2" style={{ color: "#E6EDF3" }}>No items yet</h3>
                <p style={{ color: "#A9B4C0" }}>Add your first item above to start building your watchlist</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {items.map((item) => (
                  <article key={item.id} className={`group rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/20 ${item.status === "completed" ? "opacity-60" : ""}`} style={{ backgroundColor: "#121821", border: "1px solid #1F2733" }}>
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold group-hover:text-yellow-400 transition-colors duration-300" style={{ color: "#E6EDF3" }}>
                              {item.label}
                            </h3>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              item.type === "event" 
                                ? "bg-blue-500/20 text-blue-400" 
                                : "bg-purple-500/20 text-purple-400"
                            }`}>
                              {item.type}
                            </span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              item.status === "active" 
                                ? "bg-green-500/20 text-green-400" 
                                : "bg-slate-500/20 text-slate-400"
                            }`}>
                              {item.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm" style={{ color: "#8CA0B3" }}>
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>Added {new Date(item.date).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => toggleStatus(item.id)}
                            className={`text-xs px-3 py-1.5 rounded-md transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/30 hover:scale-105 ${
                              item.status === "active" 
                                ? "text-white shadow-lg shadow-yellow-500/30" 
                                : "hover:bg-yellow-400/10"
                            }`}
                            style={{ 
                              backgroundColor: item.status === "active" ? "#3A77FF" : "#1F2733",
                              border: "1px solid #2A3441",
                              color: item.status === "active" ? "#FFFFFF" : "#A9B4C0"
                            }}
                          >
                            {item.status === "active" ? "Mark Complete" : "Reactivate"}
                          </button>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-xs px-3 py-1.5 rounded-md transition-all duration-300 hover:shadow-lg hover:shadow-red-500/30 hover:scale-105 hover:bg-red-500/10"
                            style={{ backgroundColor: "#1F2733", border: "1px solid #2A3441", color: "#A9B4C0" }}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
