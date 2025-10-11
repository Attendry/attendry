"use client";
import Link from "next/link";
import { useState } from "react";

export default function DarkEventsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("");
  const [timeRange, setTimeRange] = useState("next");
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<any[]>([]);

  const countries = [
    { code: "", name: "All Europe" },
    { code: "de", name: "Germany" },
    { code: "fr", name: "France" },
    { code: "nl", name: "Netherlands" },
    { code: "gb", name: "United Kingdom" },
    { code: "es", name: "Spain" },
    { code: "it", name: "Italy" },
    { code: "se", name: "Sweden" },
    { code: "pl", name: "Poland" },
    { code: "be", name: "Belgium" },
    { code: "ch", name: "Switzerland" },
  ];

  const mockEvents = [
    {
      id: 1,
      title: "AI & Machine Learning Summit 2024",
      date: "Mar 15-17, 2024",
      location: "Berlin, Germany",
      type: "Conference",
      saved: false
    },
    {
      id: 2,
      title: "Tech Startup Networking Event",
      date: "Mar 22, 2024",
      location: "Amsterdam, Netherlands",
      type: "Meetup",
      saved: true
    },
    {
      id: 3,
      title: "Digital Transformation Workshop",
      date: "Mar 28, 2024",
      location: "London, UK",
      type: "Workshop",
      saved: false
    },
    {
      id: 4,
      title: "Blockchain & Crypto Conference",
      date: "Apr 5-6, 2024",
      location: "Zurich, Switzerland",
      type: "Conference",
      saved: false
    },
    {
      id: 5,
      title: "Women in Tech Leadership",
      date: "Apr 12, 2024",
      location: "Stockholm, Sweden",
      type: "Meetup",
      saved: true
    },
    {
      id: 6,
      title: "Cloud Computing Masterclass",
      date: "Apr 18, 2024",
      location: "Paris, France",
      type: "Workshop",
      saved: false
    }
  ];

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setEvents(mockEvents);
      setLoading(false);
    }, 1000);
  };

  const toggleSave = (eventId: number) => {
    setEvents(events.map(event => 
      event.id === eventId ? { ...event, saved: !event.saved } : event
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
              <Link href="/designs/dark/events" className="relative text-slate-100 hover:text-amber-400 transition-colors duration-300 after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-gradient-to-r after:from-amber-400 after:to-yellow-500 after:scale-x-100 after:origin-left after:transition-transform after:duration-300">
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
              { icon: "🎯", label: "Add Event", href: "/designs/dark/events", active: true },
              { icon: "⭐", label: "Watchlist", href: "/designs/dark/watchlist" },
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
              Event Discovery
            </div>
            <h1 className="text-4xl lg:text-5xl font-bold mb-4 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-600 bg-clip-text text-transparent leading-tight">
              Discover Events
            </h1>
            <p className="text-xl text-slate-300 max-w-3xl leading-relaxed">
              Find conferences, meetups, and networking opportunities with our intelligent search engine.
            </p>
          </div>

          {/* Modern Search Form */}
          <form onSubmit={handleSearch} className="mb-12">
            <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-800/80 to-slate-900/80 backdrop-blur-sm border border-slate-700/50">
              <div className="p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-yellow-500/20 border border-amber-500/30 flex items-center justify-center">
                    <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-100">Smart Event Search</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-slate-200">Location</label>
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="w-full px-4 py-4 rounded-xl bg-slate-800/60 border border-slate-600/50 text-slate-100 transition-all duration-300 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 focus:bg-slate-700/60 hover:border-slate-500/50"
                    >
                      {countries.map((c) => (
                        <option key={c.code || "all"} value={c.code} className="bg-slate-800 text-slate-100">
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-3 text-slate-200">Time Range</label>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setTimeRange("next")}
                          className={`px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                            timeRange === "next" 
                              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25" 
                              : "bg-slate-800/60 border border-slate-600/50 text-slate-300 hover:bg-slate-700/60 hover:border-amber-500/50"
                          }`}
                        >
                          Next {days} days
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimeRange("past")}
                          className={`px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                            timeRange === "past" 
                              ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-500/25" 
                              : "bg-slate-800/60 border border-slate-600/50 text-slate-300 hover:bg-slate-700/60 hover:border-amber-500/50"
                          }`}
                        >
                          Past {days} days
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-3">
                        {[7, 14, 30].map((day) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setDays(day as 7 | 14 | 30)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                              days === day 
                                ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-white shadow-lg shadow-amber-500/25" 
                                : "bg-slate-800/60 border border-slate-600/50 text-slate-300 hover:bg-slate-700/60 hover:border-amber-500/50"
                            }`}
                          >
                            {day} days
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <label className="block text-sm font-semibold mb-3 text-slate-200">Keywords</label>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. AI, blockchain, networking, startup"
                    className="w-full px-4 py-4 rounded-xl bg-slate-800/60 border border-slate-600/50 text-slate-100 placeholder-slate-400 transition-all duration-300 focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500/50 focus:bg-slate-700/60 hover:border-slate-500/50"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/25 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-blue-700 text-white"
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-3">
                      <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Searching Events...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-3">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <span>Search Events</span>
                    </div>
                  )}
                </button>
              </div>
            </div>
          </form>

          {/* Results */}
          {events.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold" style={{ color: "#E6EDF3" }}>Found {events.length} Events</h2>
                <div className="flex items-center gap-2 text-sm" style={{ color: "#8CA0B3" }}>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Last updated: {new Date().toLocaleTimeString()}</span>
                </div>
              </div>
              
              <div className="grid gap-6">
                {events.map((event) => (
                  <article key={event.id} className="group rounded-xl overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-500/20" style={{ backgroundColor: "#121821", border: "1px solid #1F2733" }}>
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl font-semibold mb-2 group-hover:text-yellow-400 transition-colors duration-300" style={{ color: "#E6EDF3" }}>
                            {event.title}
                          </h3>
                          <div className="flex items-center gap-4 text-sm" style={{ color: "#8CA0B3" }}>
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              <span>{event.date}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              <span>{event.location}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2">
                          <span className="text-xs px-2 py-1 rounded-full" style={{ backgroundColor: "#1F2733", color: "#8CA0B3" }}>
                            {event.type}
                          </span>
                          <button
                            onClick={() => toggleSave(event.id)}
                            className={`text-xs px-3 py-1.5 rounded-md transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/30 hover:scale-105 ${
                              event.saved 
                                ? "text-white shadow-lg shadow-yellow-500/30" 
                                : "hover:bg-yellow-400/10"
                            }`}
                            style={{ 
                              backgroundColor: event.saved ? "#3A77FF" : "#1F2733",
                              border: "1px solid #2A3441",
                              color: event.saved ? "#FFFFFF" : "#A9B4C0"
                            }}
                          >
                            {event.saved ? "Saved" : "Save"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {!loading && events.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#1F2733" }}>
                <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium mb-2" style={{ color: "#E6EDF3" }}>Ready to discover events?</h3>
              <p className="mb-6" style={{ color: "#A9B4C0" }}>Use the search controls above to find conferences, meetups, and networking opportunities.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
