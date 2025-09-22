"use client";
import { useState } from "react";
import Link from "next/link";

export default function Home() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string>("");
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null);

  async function send() {
    setOutput("Thinking…");
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userText: input || "Ping" }),
    });
    const data = await res.json();
    setOutput(data.text ?? data.error ?? "No response");
  }

  const features = [
    {
      icon: "🔍",
      title: "Smart Discovery",
      description: "AI-powered search finds the most relevant events based on your interests and professional goals.",
      action: "Explore Events",
      href: "/events"
    },
    {
      icon: "👥",
      title: "Network Building", 
      description: "Connect with speakers, attendees, and industry professionals at events that matter to you.",
      action: "View Speakers",
      href: "/events"
    },
    {
      icon: "📅",
      title: "Stay Updated",
      description: "Never miss important events with personalized recommendations and smart notifications.",
      action: "Set Alerts",
      href: "/watchlist"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-50 to-white border-b border-slate-200 rounded-2xl">
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6">
              Discover Events,<br />
              <span className="text-blue-600">Connect with People</span>
            </h1>
            <p className="text-xl sm:text-2xl text-slate-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              AI-powered event discovery and networking platform for professionals. 
              Find conferences, meetups, and connect with like-minded individuals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/events" 
                className="group relative w-full sm:w-auto px-8 py-4 bg-blue-600 text-white font-semibold rounded-xl shadow-lg hover:bg-blue-700 transition-all duration-200 hover:shadow-xl hover:scale-105 text-center"
              >
                <span className="relative z-10">Explore Events</span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
              </Link>
              <Link 
                href="/login" 
                className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 font-semibold rounded-xl border-2 border-slate-300 hover:border-blue-600 hover:text-blue-600 transition-all duration-200 hover:shadow-lg text-center"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Why Choose Attendry?
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Powerful features designed to help you discover, connect, and grow professionally
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group relative bg-white rounded-2xl border border-slate-200 p-8 hover:border-blue-300 hover:shadow-xl transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
                onClick={() => window.location.href = feature.href}
              >
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-6 transition-all duration-300 ${
                  hoveredFeature === index 
                    ? 'bg-blue-100 scale-110' 
                    : 'bg-slate-100 group-hover:bg-blue-50'
                }`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-4 group-hover:text-blue-600 transition-colors duration-200">
                  {feature.title}
                </h3>
                <p className="text-slate-600 mb-6 leading-relaxed">
                  {feature.description}
                </p>
                <div className={`inline-flex items-center text-sm font-medium transition-all duration-200 ${
                  hoveredFeature === index 
                    ? 'text-blue-600' 
                    : 'text-slate-500 group-hover:text-blue-500'
                }`}>
                  {feature.action}
                  <svg 
                    className={`ml-2 w-4 h-4 transition-transform duration-200 ${
                      hoveredFeature === index ? 'translate-x-1' : ''
                    }`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div className="group">
              <div className="text-4xl sm:text-5xl font-bold text-blue-600 mb-2 group-hover:scale-110 transition-transform duration-200">
                500+
              </div>
              <div className="text-lg text-slate-600">Events Discovered</div>
            </div>
            <div className="group">
              <div className="text-4xl sm:text-5xl font-bold text-blue-600 mb-2 group-hover:scale-110 transition-transform duration-200">
                50+
              </div>
              <div className="text-lg text-slate-600">Industries Covered</div>
            </div>
            <div className="group">
              <div className="text-4xl sm:text-5xl font-bold text-blue-600 mb-2 group-hover:scale-110 transition-transform duration-200">
                24/7
              </div>
              <div className="text-lg text-slate-600">AI-Powered Search</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-gradient-to-r from-blue-600 to-blue-700">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Discover Your Next Event?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who trust Attendry to find their next networking opportunity.
          </p>
          <Link 
            href="/events" 
            className="group inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 bg-white text-blue-600 font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          >
            Start Exploring Now
            <svg className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Test Section - Hidden by default, can be toggled */}
      <section className="py-8 border-t border-slate-200 bg-slate-50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <details className="group">
            <summary className="cursor-pointer text-lg font-medium text-slate-700 hover:text-blue-600 transition-colors duration-200">
              Test Chat Interface
            </summary>
            <div className="mt-4 p-6 bg-white rounded-xl border border-slate-200">
              <div className="flex gap-2 mb-4">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  onKeyPress={(e) => e.key === 'Enter' && send()}
                />
                <button
                  onClick={send}
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Send
                </button>
              </div>
              {output && (
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                  <pre className="whitespace-pre-wrap text-sm text-slate-700">{output}</pre>
                </div>
              )}
            </div>
          </details>
        </div>
      </section>
    </div>
  );
}