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
    <div className="min-h-screen" style={{ backgroundColor: "#0B0F14", color: "#E6EDF3" }}>
      {/* Dark top bar with golden accents */}
      <header className="sticky top-0 z-50 border-b" style={{ backgroundColor: "rgba(11,15,20,0.8)", borderColor: "#1F2733", backdropFilter: "blur(12px)" as any }}>
        <div className="h-16 px-4 lg:px-6 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-lg font-bold transition-colors duration-300 hover:text-yellow-400" style={{ color: "#E6EDF3" }}>Attendry</Link>
            <nav className="hidden md:flex items-center gap-6 text-sm">
              <Link href="/designs/dark" className="transition-colors duration-300 hover:text-yellow-400" style={{ color: "#A9B4C0" }}>Home</Link>
              <Link href="/designs/dark/events" className="transition-colors duration-300 hover:text-yellow-400" style={{ color: "#E6EDF3" }}>Events</Link>
              <Link href="/designs/dark/watchlist" className="transition-colors duration-300 hover:text-yellow-400" style={{ color: "#A9B4C0" }}>Watchlist</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login" className="px-3 py-2 text-sm rounded-lg transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/20" style={{ backgroundColor: "#3A77FF", color: "#FFFFFF" }}>Sign in</Link>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Action dock on the left */}
        <aside className="hidden xl:block w-16 pl-6">
          <div className="sticky top-24 flex flex-col items-center gap-3">
            {[
              { icon: "+", label: "Add Event", href: "/designs/dark/events", active: true },
              { icon: "⭐", label: "Watchlist", href: "/designs/dark/watchlist" },
              { icon: "⚙️", label: "Settings", href: "/admin" }
            ].map((item, i) => (
              <Link key={i} href={item.href} title={item.label} className="group">
                <button className={`w-12 h-12 rounded-full transition-all duration-300 hover:scale-110 hover:shadow-lg hover:shadow-yellow-500/30 ${item.active ? 'ring-2 ring-yellow-400' : ''}`} style={{ backgroundColor: "#121821", border: "1px solid #1F2733", color: "#E6EDF3" }}>
                  <span className="group-hover:text-yellow-400 transition-colors duration-300">{item.icon}</span>
                </button>
              </Link>
            ))}
          </div>
        </aside>

        <main className="flex-1 p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-yellow-400 to-yellow-600 bg-clip-text text-transparent">Discover Events</h1>
            <p className="text-lg max-w-2xl" style={{ color: "#A9B4C0" }}>Find conferences, meetups, and networking opportunities with our enhanced search.</p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="mb-8">
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "#121821", border: "1px solid #1F2733" }}>
              <div className="p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: "#1F2733" }}>
                    <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold" style={{ color: "#E6EDF3" }}>Search Events</h2>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "#E6EDF3" }}>Location</label>
                    <select
                      value={selectedCountry}
                      onChange={(e) => setSelectedCountry(e.target.value)}
                      className="w-full px-4 py-3 rounded-lg transition-all duration-300 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                      style={{ backgroundColor: "#1F2733", border: "1px solid #2A3441", color: "#E6EDF3" }}
                    >
                      {countries.map((c) => (
                        <option key={c.code || "all"} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "#E6EDF3" }}>Time Range</label>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setTimeRange("next")}
                          className={`px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 ${
                            timeRange === "next" 
                              ? "text-white shadow-lg shadow-yellow-500/30" 
                              : "hover:bg-yellow-400/10"
                          }`}
                          style={{ 
                            backgroundColor: timeRange === "next" ? "#3A77FF" : "#1F2733",
                            border: "1px solid #2A3441",
                            color: timeRange === "next" ? "#FFFFFF" : "#A9B4C0"
                          }}
                        >
                          Next {days} days
                        </button>
                        <button
                          type="button"
                          onClick={() => setTimeRange("past")}
                          className={`px-4 py-3 text-sm font-medium rounded-lg transition-all duration-300 ${
                            timeRange === "past" 
                              ? "text-white shadow-lg shadow-yellow-500/30" 
                              : "hover:bg-yellow-400/10"
                          }`}
                          style={{ 
                            backgroundColor: timeRange === "past" ? "#3A77FF" : "#1F2733",
                            border: "1px solid #2A3441",
                            color: timeRange === "past" ? "#FFFFFF" : "#A9B4C0"
                          }}
                        >
                          Past {days} days
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        {[7, 14, 30].map((day) => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setDays(day as 7 | 14 | 30)}
                            className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                              days === day 
                                ? "text-white shadow-lg shadow-yellow-500/30" 
                                : "hover:bg-yellow-400/10"
                            }`}
                            style={{ 
                              backgroundColor: days === day ? "#3A77FF" : "#1F2733",
                              border: "1px solid #2A3441",
                              color: days === day ? "#FFFFFF" : "#A9B4C0"
                            }}
                          >
                            {day} days
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2" style={{ color: "#E6EDF3" }}>Keywords</label>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="e.g. AI, blockchain, networking, startup"
                    className="w-full px-4 py-3 rounded-lg transition-all duration-300 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                    style={{ backgroundColor: "#1F2733", border: "1px solid #2A3441", color: "#E6EDF3" }}
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full px-6 py-3 rounded-lg font-medium transition-all duration-300 hover:shadow-lg hover:shadow-yellow-500/30 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: "#3A77FF", color: "#FFFFFF" }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Searching...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Search Events
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
