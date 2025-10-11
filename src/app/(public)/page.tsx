import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import Link from "next/link";
import { Search, Lightbulb, Scale, TrendingUp, BarChart3, Activity } from "lucide-react";

export default async function LandingPage() {
  // Check if user is authenticated
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      // Redirect authenticated users to the main dashboard
      redirect("/events");
    }
  } catch (error) {
    // If there's an error checking auth, continue to show landing page
    console.error("Auth check error:", error);
  }

  const features = [
    {
      icon: Search,
      title: "Smart Search",
      description: "Find events with natural language queries and intelligent filtering.",
    },
    {
      icon: Lightbulb,
      title: "AI Recommendations", 
      description: "Get personalized event suggestions based on your interests.",
    },
    {
      icon: Scale,
      title: "Event Comparison",
      description: "Compare events side-by-side to make informed decisions.",
    },
    {
      icon: TrendingUp,
      title: "Trending Events",
      description: "Discover what's popular in your industry and interests.",
    },
    {
      icon: BarChart3,
      title: "Event Predictions",
      description: "AI-powered insights for upcoming events and trends.",
    },
    {
      icon: Activity,
      title: "Activity Tracking",
      description: "Track your event discovery journey and preferences.",
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6">
              Discover Events That<br />
              <span className="text-blue-600">Drive Your Growth</span>
            </h1>
            <p className="text-xl sm:text-2xl text-slate-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Connect with the right events, track your journey, and unlock opportunities 
              that matter to your professional development.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/login" 
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 text-center shadow-lg hover:shadow-xl"
              >
                Sign in to Continue
              </Link>
              <div className="text-sm text-slate-500">
                Join professionals discovering their next opportunity
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Everything You Need to Find Your Next Event
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Powerful tools designed to help you discover, evaluate, and track events that align with your goals
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-white rounded-lg border border-slate-200 p-8 hover:border-blue-300 transition-colors duration-200 shadow-sm hover:shadow-md"
              >
                <div className="w-16 h-16 rounded-lg flex items-center justify-center mb-6 bg-slate-100 group-hover:bg-blue-50 transition-colors duration-200">
                  <feature.icon className="h-8 w-8 text-slate-600" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-semibold text-slate-900 mb-4 group-hover:text-blue-600 transition-colors duration-200">
                  {feature.title}
                </h3>
                <p className="text-slate-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Proposition */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
            Stop Missing Out on Opportunities
          </h2>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            The right event can change your career trajectory. Our platform helps you find, 
            evaluate, and track events that matter to your professional growth.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">10x</div>
              <div className="text-slate-600">Faster event discovery</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">95%</div>
              <div className="text-slate-600">More relevant matches</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">24/7</div>
              <div className="text-slate-600">Automated tracking</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Transform Your Event Discovery?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join professionals who use our platform to discover, compare, and track the perfect events for their growth.
          </p>
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-gray-50 transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            Get Started Today
          </Link>
        </div>
      </section>
    </div>
  );
}