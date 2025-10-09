"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Search,
  Lightbulb,
  Scale,
  TrendingUp,
  BarChart3,
  Activity,
} from "lucide-react";

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
      icon: Search,
      title: "Smart Search",
      description: "Advanced search with natural language processing, filters, and intelligent suggestions.",
      action: "Try Smart Search",
      href: "/search"
    },
    {
      icon: Lightbulb,
      title: "AI Recommendations", 
      description: "Get personalized event recommendations based on your interests and behavior.",
      action: "View Recommendations",
      href: "/recommendations"
    },
    {
      icon: Scale,
      title: "Event Comparison",
      description: "Compare events side-by-side to make informed decisions about which to attend.",
      action: "Compare Events",
      href: "/compare"
    },
    {
      icon: TrendingUp,
      title: "Trending Events",
      description: "Discover what's popular and trending in your industry and interests.",
      action: "See Trending",
      href: "/trending"
    },
    {
      icon: BarChart3,
      title: "Event Predictions",
      description: "AI-powered predictions for upcoming events based on historical data and trends.",
      action: "View Predictions",
      href: "/predictions"
    },
    {
      icon: Activity,
      title: "Activity Tracking",
      description: "Track your event discovery journey and see insights about your preferences.",
      action: "View Activity",
      href: "/activity"
    }
  ];

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-neutral-50 border-b border-neutral-200 rounded-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6">
              AI-Powered Event<br />
              <span className="text-blue-600">Discovery Platform</span>
            </h1>
            <p className="text-xl sm:text-2xl text-slate-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Discover, compare, and track events with advanced AI features. 
              Get personalized recommendations, smart search, and intelligent insights.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/search" 
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 text-center"
              >
                Try Smart Search
              </Link>
              <Link 
                href="/recommendations" 
                className="w-full sm:w-auto px-8 py-4 bg-white text-slate-900 font-semibold rounded-lg border border-slate-300 hover:border-blue-600 hover:text-blue-600 transition-colors duration-200 text-center"
              >
                Get Recommendations
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-white rounded-lg border border-slate-200 p-8 hover:border-blue-300 transition-colors duration-200 cursor-pointer"
                onMouseEnter={() => setHoveredFeature(index)}
                onMouseLeave={() => setHoveredFeature(null)}
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.location.href = feature.href;
                  }
                }}
              >
                <div className={`w-16 h-16 rounded-lg flex items-center justify-center mb-6 transition-colors duration-200 ${
                  hoveredFeature === index 
                    ? 'bg-blue-100' 
                    : 'bg-slate-100 group-hover:bg-blue-50'
                }`}>
                  <feature.icon className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
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
      <section className="py-16 sm:py-24 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Experience AI-Powered Event Discovery?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join professionals who use Attendry's advanced features to discover, compare, and track the perfect events.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/search" 
              className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors duration-200"
            >
              Try Smart Search
            </Link>
            <Link 
              href="/compare" 
              className="inline-flex items-center justify-center w-full sm:w-auto px-8 py-4 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-400 transition-colors duration-200"
            >
              Compare Events
            </Link>
          </div>
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