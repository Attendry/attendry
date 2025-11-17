import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase-server";
import Link from "next/link";
import { Search, Users, Target, TrendingUp, Building2, Zap, ArrowRight } from "lucide-react";

// Force dynamic rendering since we use cookies for auth
export const dynamic = 'force-dynamic';

export default async function LandingPage() {
  // Check if user is authenticated
  try {
    const supabase = await supabaseServer();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session?.user) {
      // Redirect authenticated users to the main dashboard
      redirect("/dashboard");
    }
  } catch (error) {
    // If there's an error checking auth, continue to show landing page
    console.error("Auth check error:", error);
  }

  const features = [
    {
      icon: Search,
      title: "Find Events Where Your Targets Attend",
      description: "Discover conferences and events where your target accounts, decision-makers, and prospects will be. Search by industry, location, and date to find the perfect prospecting opportunities.",
    },
    {
      icon: Users,
      title: "See Speakers, Sponsors & Attendees",
      description: "Get full attendee intelligence - see who's speaking, sponsoring, and attending. These are your warm prospects, ready for outreach.",
    },
    {
      icon: Target,
      title: "Warm Outreach Made Easy",
      description: "Save speakers and companies to your watchlist, track outreach status, and turn event attendees into qualified opportunities.",
    },
    {
      icon: Building2,
      title: "Track Your Sales Pipeline",
      description: "Organize events by opportunity stage. Move prospects through your pipeline from initial interest to closed deals.",
    },
    {
      icon: TrendingUp,
      title: "Competitive Intelligence",
      description: "See which events your competitors are attending and sponsoring. Identify gaps and opportunities in your market presence.",
    },
    {
      icon: Zap,
      title: "AI-Powered Recommendations",
      description: "Get personalized event suggestions based on your industry, ICP, and target accounts. Never miss a high-value opportunity.",
    }
  ];

  const workflowSteps = [
    {
      step: 1,
      title: "Find Events",
      description: "Search for conferences where your target accounts will be",
      example: "Compliance Conference in Germany"
    },
    {
      step: 2,
      title: "See Attendees",
      description: "View speakers, sponsors, and participating companies",
      example: "50+ target accounts attending"
    },
    {
      step: 3,
      title: "Save for Outreach",
      description: "Add speakers and companies to your watchlist",
      example: "Save decision-makers for warm outreach"
    },
    {
      step: 4,
      title: "Track & Convert",
      description: "Manage outreach status and move opportunities through your pipeline",
      example: "Track in your sales pipeline"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-slate-900 mb-6">
              Turn Events Into Your<br />
              <span className="text-blue-600">Sales Pipeline</span>
            </h1>
            <p className="text-xl sm:text-2xl text-slate-600 mb-8 max-w-3xl mx-auto leading-relaxed">
              Find events where your target accounts will be. See speakers, sponsors, and attendees - 
              your warm prospects ready for outreach. Track opportunities and generate ROI.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link 
                href="/login" 
                className="w-full sm:w-auto px-8 py-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors duration-200 text-center shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                Start Prospecting
                <ArrowRight className="w-5 h-5" />
              </Link>
              <div className="text-sm text-slate-500">
                Join sales teams using events for warm outreach
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Value Chain / Workflow */}
      <section className="py-16 sm:py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              From Event Discovery to Closed Deals
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              See how sales teams use Attendry to find events, identify prospects, and generate opportunities
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            {workflowSteps.map((step, index) => (
              <div
                key={step.step}
                className="relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-6 hover:shadow-lg transition-shadow duration-200"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg">
                    {step.step}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-sm text-slate-600 mb-3">
                      {step.description}
                    </p>
                    <div className="text-xs text-blue-600 font-medium bg-blue-100 rounded px-2 py-1 inline-block">
                      {step.example}
                    </div>
                  </div>
                </div>
                {index < workflowSteps.length - 1 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 transform -translate-y-1/2">
                    <ArrowRight className="w-6 h-6 text-blue-300" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Example Use Case */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-8 text-white">
            <div className="max-w-3xl mx-auto text-center">
              <h3 className="text-2xl font-bold mb-4">Real Example: Compliance Conference</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-3xl font-bold mb-1">1 Event</div>
                  <div className="text-blue-100">Found</div>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-1">50+</div>
                  <div className="text-blue-100">Target Accounts</div>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-1">25+</div>
                  <div className="text-blue-100">Decision Makers</div>
                </div>
                <div>
                  <div className="text-3xl font-bold mb-1">$500K+</div>
                  <div className="text-blue-100">Pipeline Value</div>
                </div>
              </div>
              <p className="mt-6 text-blue-100">
                One event → Multiple warm prospects → Tracked outreach → Generated opportunities
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Preview */}
      <section className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Everything You Need for Event-Based Prospecting
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Powerful sales intelligence tools designed to help you find, evaluate, and convert event attendees into opportunities
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="group bg-white rounded-lg border border-slate-200 p-8 hover:border-blue-300 transition-colors duration-200 shadow-sm hover:shadow-md"
              >
                <div className="w-16 h-16 rounded-lg flex items-center justify-center mb-6 bg-blue-50 group-hover:bg-blue-100 transition-colors duration-200">
                  <feature.icon className="h-8 w-8 text-blue-600" strokeWidth={1.5} />
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

      {/* Value Proposition / ROI */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-6">
            Stop Missing High-Value Opportunities
          </h2>
          <p className="text-xl text-slate-600 mb-8 max-w-2xl mx-auto">
            Your target accounts are attending events right now. Don't miss the chance to connect with them in a warm, contextual way.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">10x</div>
              <div className="text-slate-600">Faster than manual research</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">85%</div>
              <div className="text-slate-600">Higher response rates with warm outreach</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-600 mb-2">24/7</div>
              <div className="text-slate-600">Automated event monitoring</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-24 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-6">
            Ready to Turn Events Into Your Sales Pipeline?
          </h2>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            Join sales teams who use Attendry to find events, identify warm prospects, and generate opportunities from event-based prospecting.
          </p>
          <Link 
            href="/login" 
            className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg hover:bg-slate-50 transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            Start Prospecting Today
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
