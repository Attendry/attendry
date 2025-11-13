"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthHelper } from "@/components/AuthHelper";
import { WeightedTemplateSelector } from "@/components/WeightedTemplateSelector";
import { WeightedTemplate } from "@/lib/types/weighted-templates";
import { WEIGHTED_INDUSTRY_TEMPLATES } from "@/lib/data/weighted-templates";
import { ProfileManager } from "@/components/ProfileManager";
import { CustomProfileCreator } from "@/components/CustomProfileCreator";

type ChipProps = { text: string; onRemove?: () => void };
function Chip({ text, onRemove }: ChipProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded-md text-xs">
      {text}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 text-slate-500 hover:text-slate-700"
        >
          ×
        </button>
      )}
    </span>
  );
}

type SearchConfig = {
  id?: string;
  name: string;
  industry: string;
  baseQuery: string;
  excludeTerms: string;
  industryTerms: string[];
  icpTerms: string[];
  is_active?: boolean;
};

type IndustryTemplate = {
  name: string;
  description: string;
  baseQuery: string;
  excludeTerms: string;
  industryTerms: string[];
  icpTerms: string[];
};

function AdminContent() {
  const searchParams = useSearchParams();
  
  // User Profile State
  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");
  const [competitors, setCompetitors] = useState<string[]>([]);
  const [icpTerms, setIcpTerms] = useState<string[]>([]);
  const [industryTerms, setIndustryTerms] = useState<string[]>([]);
  const [useBasic, setUseBasic] = useState(true);
  
  // Search Configuration State
  const [activeTab, setActiveTab] = useState<"profile" | "search" | "collection">("profile");
  const [searchConfig, setSearchConfig] = useState<SearchConfig>({
    name: "",
    industry: "",
    baseQuery: "",
    excludeTerms: "",
    industryTerms: [],
    icpTerms: []
  });
  const [industryTemplates, setIndustryTemplates] = useState<Record<string, IndustryTemplate>>({});
  const [weightedTemplates, setWeightedTemplates] = useState<Record<string, WeightedTemplate>>(WEIGHTED_INDUSTRY_TEMPLATES);
  const [selectedWeightedTemplate, setSelectedWeightedTemplate] = useState<string | null>(null);
  
  // Profile Management State
  const [showProfileManager, setShowProfileManager] = useState(false);
  const [showCustomProfileCreator, setShowCustomProfileCreator] = useState(false);
  const [primaryProfile, setPrimaryProfile] = useState<any>(null);
  const [selectedCountry, setSelectedCountry] = useState('DE');
  const [newTerm, setNewTerm] = useState("");
  const [newIcpTerm, setNewIcpTerm] = useState("");
  
  // User Profile term management
  const [newCompetitor, setNewCompetitor] = useState("");
  const [newUserIcpTerm, setNewUserIcpTerm] = useState("");
  const [newUserIndustryTerm, setNewUserIndustryTerm] = useState("");
  
  // Collection Management State
  const [collectionStatus, setCollectionStatus] = useState<{
    eventCount?: number;
    coverage?: { coveredDays?: number };
    lastUpdated?: string;
  } | null>(null);
  const [collectionConfig, setCollectionConfig] = useState({
    industries: ['legal-compliance', 'fintech', 'healthcare'],
    countries: ['de', 'fr', 'uk', 'us'],
    monthsAhead: 6,
    autoRun: false
  });
  
  // Common State
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    loadProfile();
    loadSearchConfig();
    loadCollectionStatus();
    
    // Handle tab parameter from URL
    const tabParam = searchParams.get('tab');
    if (tabParam && ['profile', 'search', 'collection'].includes(tabParam)) {
      setActiveTab(tabParam as "profile" | "search" | "collection");
    }
  }, [searchParams]);

  async function loadProfile() {
    try {
      const r = await fetch("/api/profile/get");
      const json = await r.json();
      if (json.profile) {
        setFullName(json.profile.full_name || "");
        setCompany(json.profile.company || "");
        setCompetitors(json.profile.competitors || []);
        setIcpTerms(json.profile.icp_terms || []);
        setIndustryTerms(json.profile.industry_terms || []);
        setUseBasic(json.profile.use_in_basic_search ?? true);
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setMsg(error);
    }
  }

  async function loadSearchConfig() {
    try {
      const r = await fetch("/api/config/search");
      const json = await r.json();
      if (json.config) {
        setSearchConfig({
          id: json.config.id,
          name: json.config.name || "",
          industry: json.config.industry || "",
          baseQuery: json.config.base_query || "",
          excludeTerms: json.config.exclude_terms || "",
          industryTerms: json.config.industry_terms || [],
          icpTerms: json.config.icp_terms || [],
          is_active: json.config.is_active
        });
      }
      if (json.templates) {
        setIndustryTemplates(json.templates);
      }
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setMsg(error);
    }
  }

  async function generate() {
    if (!company.trim()) {
      setMsg("Please enter a company name first");
      return;
    }
    
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/profile/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, withWeb: true })
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed to generate");
      
      setCompetitors(json.competitors || []);
      setIcpTerms(json.icp_terms || []);
      setIndustryTerms(json.industry_terms || []);
      setMsg("Generated profile terms");
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setMsg(error);
    } finally { 
      setBusy(false); 
    }
  }

  // User Profile term management functions
  function addCompetitor() {
    if (newCompetitor.trim() && !competitors.includes(newCompetitor.trim())) {
      setCompetitors([...competitors, newCompetitor.trim()]);
      setNewCompetitor("");
    }
  }

  function removeCompetitor(competitor: string) {
    setCompetitors(competitors.filter(c => c !== competitor));
  }

  function addUserIcpTerm() {
    if (newUserIcpTerm.trim() && !icpTerms.includes(newUserIcpTerm.trim())) {
      setIcpTerms([...icpTerms, newUserIcpTerm.trim()]);
      setNewUserIcpTerm("");
    }
  }

  function removeUserIcpTerm(term: string) {
    setIcpTerms(icpTerms.filter(t => t !== term));
  }

  function addUserIndustryTerm() {
    if (newUserIndustryTerm.trim() && !industryTerms.includes(newUserIndustryTerm.trim())) {
      setIndustryTerms([...industryTerms, newUserIndustryTerm.trim()]);
      setNewUserIndustryTerm("");
    }
  }

  function removeUserIndustryTerm(term: string) {
    setIndustryTerms(industryTerms.filter(t => t !== term));
  }

  async function save() {
    setBusy(true); 
    setMsg("");
    try {
      const r = await fetch("/api/profile/save", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: fullName,
          company,
          competitors,
          icp_terms: icpTerms,
          industry_terms: industryTerms,
          use_in_basic_search: useBasic,
        })
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed to save");
      setMsg("Saved profile");
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setMsg(error);
    } finally { 
      setBusy(false); 
    }
  }

  // Search Configuration Functions
  function applyTemplate(templateKey: string) {
    const template = industryTemplates[templateKey];
    if (template) {
      setSearchConfig({
        ...searchConfig,
        name: template.name,
        industry: templateKey,
        baseQuery: template.baseQuery,
        excludeTerms: template.excludeTerms,
        industryTerms: [...template.industryTerms],
        icpTerms: [...template.icpTerms]
      });
      setMsg(`Applied ${template.name} template`);
      setSaveStatus("idle"); // Reset save status when making changes
    }
  }

  // Weighted Template Functions
  function applyWeightedTemplate(templateKey: string) {
    const template = weightedTemplates[templateKey];
    if (template) {
      setSearchConfig({
        ...searchConfig,
        name: template.name,
        industry: templateKey,
        baseQuery: template.baseQuery,
        excludeTerms: template.excludeTerms,
        industryTerms: [...template.industryTerms],
        icpTerms: [...template.icpTerms]
      });
      setSelectedWeightedTemplate(templateKey);
      setMsg(`Applied ${template.name} weighted template`);
      setSaveStatus("idle");
    }
  }

  function updateWeightedTemplate(template: WeightedTemplate) {
    setWeightedTemplates(prev => ({
      ...prev,
      [template.id]: template
    }));
    setMsg(`Updated ${template.name} template weights`);
    setSaveStatus("idle");
  }

  // Profile Management Functions
  function handleProfileSelect(profile: any) {
    setPrimaryProfile(profile);
    setShowProfileManager(false);
    setMsg(`Primary profile set to: ${profile.name}`);
    setSaveStatus("idle");
  }

  function handleCustomProfileCreate() {
    setShowCustomProfileCreator(true);
    setShowProfileManager(false);
  }

  function handleCustomProfileCreated(profile: any) {
    setPrimaryProfile(profile);
    setShowCustomProfileCreator(false);
    setMsg(`Custom profile created and set as primary: ${profile.name}`);
    setSaveStatus("idle");
  }

  function handleCancelCustomProfile() {
    setShowCustomProfileCreator(false);
    setShowProfileManager(true);
  }

  function addIndustryTerm() {
    if (newTerm.trim() && !searchConfig.industryTerms.includes(newTerm.trim())) {
      setSearchConfig({
        ...searchConfig,
        industryTerms: [...searchConfig.industryTerms, newTerm.trim()]
      });
      setNewTerm("");
      setSaveStatus("idle"); // Reset save status when making changes
    }
  }

  function removeIndustryTerm(term: string) {
    setSearchConfig({
      ...searchConfig,
      industryTerms: searchConfig.industryTerms.filter(t => t !== term)
    });
    setSaveStatus("idle"); // Reset save status when making changes
  }

  function addIcpTerm() {
    if (newIcpTerm.trim() && !searchConfig.icpTerms.includes(newIcpTerm.trim())) {
      setSearchConfig({
        ...searchConfig,
        icpTerms: [...searchConfig.icpTerms, newIcpTerm.trim()]
      });
      setNewIcpTerm("");
      setSaveStatus("idle"); // Reset save status when making changes
    }
  }

  function removeIcpTerm(term: string) {
    setSearchConfig({
      ...searchConfig,
      icpTerms: searchConfig.icpTerms.filter(t => t !== term)
    });
    setSaveStatus("idle"); // Reset save status when making changes
  }

  async function saveSearchConfig() {
    if (!searchConfig.name.trim() || !searchConfig.industry.trim()) {
      setMsg("Name and industry are required");
      setSaveStatus("error");
      return;
    }

    // Validate character limits
    if (searchConfig.baseQuery.length > 500) {
      setMsg("Base Search Query must be 500 characters or less");
      setSaveStatus("error");
      return;
    }

    if (searchConfig.industryTerms.length > 3) {
      setMsg("Maximum of 3 industry terms allowed");
      setSaveStatus("error");
      return;
    }

    if (searchConfig.icpTerms.length > 2) {
      setMsg("Maximum of 2 ICP terms allowed");
      setSaveStatus("error");
      return;
    }

    setBusy(true);
    setMsg("");
    setSaveStatus("saving");
    try {
      const r = await fetch("/api/config/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: searchConfig.name,
          industry: searchConfig.industry,
          baseQuery: searchConfig.baseQuery,
          excludeTerms: searchConfig.excludeTerms,
          industryTerms: searchConfig.industryTerms,
          icpTerms: searchConfig.icpTerms,
          isActive: true
        })
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed to save configuration");
      setMsg("Search configuration saved successfully");
      setSaveStatus("saved");
      await loadSearchConfig(); // Reload to get the updated config
      
      // Clear the saved status after 3 seconds
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setMsg(error);
      setSaveStatus("error");
    } finally {
      setBusy(false);
    }
  }

  // Collection Management Functions
  async function loadCollectionStatus() {
    try {
      const r = await fetch("/api/events/collect?industry=legal-compliance&country=de");
      const json = await r.json();
      setCollectionStatus(json);
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      console.error("Failed to load collection status:", error);
    }
  }

  async function startCollection() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/events/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: "legal-compliance",
          country: "de",
          monthsAhead: collectionConfig.monthsAhead,
          forceRefresh: true
        })
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed to start collection");
      
      setMsg(`Collection started: ${json.eventsFound} events found, ${json.eventsStored} stored`);
      await loadCollectionStatus(); // Refresh status
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setMsg(error);
    } finally {
      setBusy(false);
    }
  }

  async function startFullCollection() {
    setBusy(true);
    setMsg("");
    try {
      const r = await fetch("/api/cron/collect-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed to start full collection");
      
      setMsg(`Full collection started: ${json.summary.totalEventsCollected} total events collected`);
      await loadCollectionStatus(); // Refresh status
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : 'Unknown error';
      setMsg(error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <AuthHelper />
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        
        {/* Tab Navigation */}
        <nav role="tablist" aria-label="Admin dashboard sections" className="mb-8">
          <div className="flex space-x-1 bg-white rounded-lg p-1 shadow-sm">
            <button
              role="tab"
              aria-selected={activeTab === "profile"}
              aria-controls="profile-panel"
              id="profile-tab"
              onClick={() => setActiveTab("profile")}
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                activeTab === "profile"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                User Profile
              </div>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "search"}
              aria-controls="search-panel"
              id="search-tab"
              onClick={() => setActiveTab("search")}
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                activeTab === "search"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                Search Configuration
              </div>
            </button>
            <button
              role="tab"
              aria-selected={activeTab === "collection"}
              aria-controls="collection-panel"
              id="collection-tab"
              onClick={() => setActiveTab("collection")}
              className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                activeTab === "collection"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <div className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" />
                </svg>
                Data Collection
              </div>
            </button>
          </div>
        </nav>

        {/* User Profile Tab */}
        {activeTab === "profile" && (
          <div role="tabpanel" id="profile-panel" aria-labelledby="profile-tab" className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">User Profile Management</h2>
                <p className="text-sm text-slate-600 mt-1">Configure your profile to personalize search results and recommendations</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowProfileManager(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  Manage Profiles
                </button>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <span>Profile data helps improve search relevance</span>
                </div>
              </div>
            </div>

            {/* Profile Manager */}
            {showProfileManager && (
              <ProfileManager
                onProfileSelect={handleProfileSelect}
                onCustomProfileCreate={handleCustomProfileCreate}
                currentProfile={primaryProfile}
              />
            )}

            {/* Custom Profile Creator */}
            {showCustomProfileCreator && (
              <CustomProfileCreator
                onProfileCreate={handleCustomProfileCreated}
                onCancel={handleCancelCustomProfile}
                selectedCountry={selectedCountry}
              />
            )}
        
            <div className="bg-white border rounded-2xl p-6 space-y-6">
              {/* Basic Information Section */}
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                  Basic Information
                </h3>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-medium text-slate-700 mb-2">
                      Full Name
                      <span className="text-red-500 ml-1" aria-label="required">*</span>
                    </label>
                    <input 
                      id="fullName"
                      type="text"
                      className="w-full rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                      value={fullName} 
                      onChange={e=>setFullName(e.target.value)}
                      placeholder="Enter your full name"
                      aria-describedby="fullName-help"
                    />
                    <p id="fullName-help" className="text-xs text-slate-500 mt-1">Used for personalized recommendations</p>
                  </div>
                  
                  <div>
                    <label htmlFor="company" className="block text-sm font-medium text-slate-700 mb-2">
                      Company
                      <span className="text-red-500 ml-1" aria-label="required">*</span>
                    </label>
                    <input 
                      id="company"
                      type="text"
                      className="w-full rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors" 
                      value={company} 
                      onChange={e=>setCompany(e.target.value)}
                      placeholder="Enter your company name"
                      aria-describedby="company-help"
                    />
                    <p id="company-help" className="text-xs text-slate-500 mt-1">Used to generate relevant industry terms</p>
                  </div>
                </div>
              </div>

              {/* Search Integration Section */}
              <div className="border-t pt-6">
                <div className="flex items-start justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-900 mb-1">Search Integration</h4>
                    <p className="text-sm text-blue-700 mb-2">Use your profile data to enhance search results and find more relevant events</p>
                    <div className="flex items-center gap-2 text-xs text-blue-600">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span>When enabled, your profile terms will be included in search queries</span>
                    </div>
                  </div>
                  <label className="flex items-center gap-3 text-sm cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={useBasic} 
                      onChange={e=>setUseBasic(e.target.checked)}
                      className="w-5 h-5 text-blue-600 border-slate-300 rounded focus:ring-blue-500 focus:ring-2"
                      aria-describedby="search-integration-help"
                    />
                    <span className="font-medium text-blue-900">Enable</span>
                  </label>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t">
                <button 
                  onClick={generate} 
                  disabled={busy || !company.trim()}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors font-medium"
                  aria-describedby="generate-help"
                >
                  {busy ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
                      </svg>
                      Generate Terms
                    </>
                  )}
                </button>
                <button 
                  onClick={save} 
                  disabled={busy}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z" />
                  </svg>
                  Save Profile
                </button>
              </div>
              
              <p id="generate-help" className="text-xs text-slate-500">
                Generate terms automatically based on your company name. Requires company name to be filled.
              </p>
              
              {/* Status Messages */}
              {msg && (
                <div className={`p-4 rounded-lg border flex items-start gap-3 ${
                  msg.includes('error') || msg.includes('Error') || msg.includes('Failed')
                    ? 'bg-red-50 border-red-200 text-red-800'
                    : 'bg-green-50 border-green-200 text-green-800'
                }`}>
                  <svg className={`w-5 h-5 mt-0.5 flex-shrink-0 ${
                    msg.includes('error') || msg.includes('Error') || msg.includes('Failed')
                      ? 'text-red-500'
                      : 'text-green-500'
                  }`} fill="currentColor" viewBox="0 0 20 20">
                    {msg.includes('error') || msg.includes('Error') || msg.includes('Failed') ? (
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    ) : (
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    )}
                  </svg>
                  <div>
                    <p className="font-medium">{msg}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Terms Management Section */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                  </svg>
                  Profile Terms
                </h3>
                <div className="text-sm text-slate-500">
                  {competitors.length + icpTerms.length + industryTerms.length} total terms
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Competitors */}
                <div className="bg-white border rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-slate-900 flex items-center gap-2">
                      <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                      </svg>
                      Competitors
                    </h4>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                      {competitors.length}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 min-h-[2rem]">
                      {competitors.length > 0 ? (
                        competitors.map((c,i)=>(<Chip key={i} text={c} onRemove={() => removeCompetitor(c)}/>))
                      ) : (
                        <p className="text-sm text-slate-400 italic">No competitors added yet</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCompetitor}
                        onChange={(e) => setNewCompetitor(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addCompetitor()}
                        className="flex-1 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                        placeholder="Add competitor..."
                        aria-label="Add competitor"
                      />
                      <button
                        onClick={addCompetitor}
                        disabled={!newCompetitor.trim()}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm font-medium"
                        aria-label="Add competitor"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* ICP Terms */}
                <div className="bg-white border rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-slate-900 flex items-center gap-2">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      ICP Terms
                    </h4>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                      {icpTerms.length}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 min-h-[2rem]">
                      {icpTerms.length > 0 ? (
                        icpTerms.map((c,i)=>(<Chip key={i} text={c} onRemove={() => removeUserIcpTerm(c)}/>))
                      ) : (
                        <p className="text-sm text-slate-400 italic">No ICP terms added yet</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newUserIcpTerm}
                        onChange={(e) => setNewUserIcpTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addUserIcpTerm()}
                        className="flex-1 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                        placeholder="Add ICP term..."
                        aria-label="Add ICP term"
                      />
                      <button
                        onClick={addUserIcpTerm}
                        disabled={!newUserIcpTerm.trim()}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm font-medium"
                        aria-label="Add ICP term"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
                
                {/* Industry Terms */}
                <div className="bg-white border rounded-2xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-medium text-slate-900 flex items-center gap-2">
                      <svg className="w-4 h-4 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                      </svg>
                      Industry Terms
                    </h4>
                    <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                      {industryTerms.length}
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-2 min-h-[2rem]">
                      {industryTerms.length > 0 ? (
                        industryTerms.map((c,i)=>(<Chip key={i} text={c} onRemove={() => removeUserIndustryTerm(c)}/>))
                      ) : (
                        <p className="text-sm text-slate-400 italic">No industry terms added yet</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newUserIndustryTerm}
                        onChange={(e) => setNewUserIndustryTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addUserIndustryTerm()}
                        className="flex-1 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-sm"
                        placeholder="Add industry term..."
                        aria-label="Add industry term"
                      />
                      <button
                        onClick={addUserIndustryTerm}
                        disabled={!newUserIndustryTerm.trim()}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm font-medium"
                        aria-label="Add industry term"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Configuration Tab */}
        {activeTab === "search" && (
          <div role="tabpanel" id="search-panel" aria-labelledby="search-tab" className="space-y-6">
            <h2 className="text-2xl font-semibold text-slate-900">Search Configuration Management</h2>
            
            {/* Enhanced Weighted Templates */}
            <div className="bg-white border rounded-2xl p-6">
              <WeightedTemplateSelector
                templates={weightedTemplates}
                selectedTemplate={selectedWeightedTemplate}
                onSelectTemplate={applyWeightedTemplate}
                onUpdateTemplate={updateWeightedTemplate}
              />
            </div>

            {/* Legacy Industry Templates */}
            <div className="bg-white border rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">Legacy Industry Templates</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(industryTemplates).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => applyTemplate(key)}
                    className="p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
                  >
                    <h4 className="font-medium text-slate-900 mb-1">{template.name}</h4>
                    <p className="text-sm text-slate-600">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Current Configuration */}
            <div className="bg-white border rounded-2xl p-6 space-y-6">
              <h3 className="text-lg font-semibold text-slate-900">Current Configuration</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Configuration Name</label>
                  <input
                    type="text"
                    value={searchConfig.name}
                    onChange={(e) => setSearchConfig({...searchConfig, name: e.target.value})}
                    className="w-full rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Legal & Compliance Config"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Industry</label>
                  <input
                    type="text"
                    value={searchConfig.industry}
                    onChange={(e) => setSearchConfig({...searchConfig, industry: e.target.value})}
                    className="w-full rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., legal-compliance"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Base Search Query
                  <span className="text-xs text-slate-500 ml-2">
                    ({searchConfig.baseQuery.length}/500 characters)
                  </span>
                </label>
                <textarea
                  value={searchConfig.baseQuery}
                  onChange={(e) => {
                    if (e.target.value.length <= 500) {
                      setSearchConfig({...searchConfig, baseQuery: e.target.value});
                    }
                  }}
                  className={`w-full rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    searchConfig.baseQuery.length > 500 ? 'border-red-300 bg-red-50' : ''
                  }`}
                  rows={3}
                  placeholder="e.g., (legal OR compliance OR investigation OR ediscovery)"
                  maxLength={500}
                />
                {searchConfig.baseQuery.length > 450 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Warning: Query is getting long. Keep it under 500 characters for best results.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Exclude Terms</label>
                <input
                  type="text"
                  value={searchConfig.excludeTerms}
                  onChange={(e) => setSearchConfig({...searchConfig, excludeTerms: e.target.value})}
                  className="w-full rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., reddit forum personal blog"
                />
              </div>

              {/* Industry Terms */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Industry Terms
                  <span className="text-xs text-slate-500 ml-2">
                    ({searchConfig.industryTerms.length}/3 terms, max 200 chars total)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {searchConfig.industryTerms.map((term, i) => (
                    <Chip key={i} text={term} onRemove={() => removeIndustryTerm(term)} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTerm}
                    onChange={(e) => setNewTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addIndustryTerm()}
                    className={`flex-1 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      searchConfig.industryTerms.length >= 3 ? 'border-red-300 bg-red-50' : ''
                    }`}
                    placeholder="Add industry term..."
                    disabled={searchConfig.industryTerms.length >= 3}
                  />
                  <button
                    onClick={addIndustryTerm}
                    disabled={searchConfig.industryTerms.length >= 3 || !newTerm.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                {searchConfig.industryTerms.length >= 3 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Maximum of 3 industry terms allowed. Remove a term to add a new one.
                  </p>
                )}
              </div>

              {/* ICP Terms */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  ICP Terms (Buyer Roles)
                  <span className="text-xs text-slate-500 ml-2">
                    ({searchConfig.icpTerms.length}/2 terms, max 150 chars total)
                  </span>
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {searchConfig.icpTerms.map((term, i) => (
                    <Chip key={i} text={term} onRemove={() => removeIcpTerm(term)} />
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newIcpTerm}
                    onChange={(e) => setNewIcpTerm(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addIcpTerm()}
                    className={`flex-1 rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      searchConfig.icpTerms.length >= 2 ? 'border-red-300 bg-red-50' : ''
                    }`}
                    placeholder="Add ICP term..."
                    disabled={searchConfig.icpTerms.length >= 2}
                  />
                  <button
                    onClick={addIcpTerm}
                    disabled={searchConfig.icpTerms.length >= 2 || !newIcpTerm.trim()}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
                  >
                    Add
                  </button>
                </div>
                {searchConfig.icpTerms.length >= 2 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Maximum of 2 ICP terms allowed. Remove a term to add a new one.
                  </p>
                )}
              </div>


              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={saveSearchConfig}
                  disabled={busy}
                  className={`px-6 py-2 text-white rounded-lg transition-colors flex items-center gap-2 ${
                    saveStatus === "saved" 
                      ? "bg-green-500 hover:bg-green-600" 
                      : saveStatus === "error"
                      ? "bg-red-600 hover:bg-red-700"
                      : "bg-green-600 hover:bg-green-700 disabled:bg-green-400"
                  }`}
                >
                  {saveStatus === "saved" ? (
                    <>
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Saved!
                    </>
                  ) : busy ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : (
                    "Save Configuration"
                  )}
                </button>
                <button
                  onClick={loadSearchConfig}
                  disabled={busy}
                  className="px-6 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Reload
                </button>
              </div>
              
              {/* Save Status Indicator */}
              {saveStatus !== "idle" && (
                <div className={`mt-3 p-3 rounded-lg border flex items-center gap-2 ${
                  saveStatus === "saved" 
                    ? "bg-green-50 border-green-200 text-green-800"
                    : saveStatus === "error"
                    ? "bg-red-50 border-red-200 text-red-800"
                    : "bg-blue-50 border-blue-200 text-blue-800"
                }`}>
                  {saveStatus === "saved" ? (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">Configuration saved successfully!</span>
                      <span className="text-sm opacity-75">Your search settings are now active.</span>
                    </>
                  ) : saveStatus === "error" ? (
                    <>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium">Failed to save configuration</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="font-medium">Saving configuration...</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data Collection Tab */}
        {activeTab === "collection" && (
          <div role="tabpanel" id="collection-panel" aria-labelledby="collection-tab" className="space-y-6">
            <h2 className="text-2xl font-semibold text-slate-900">Data Collection Management</h2>
            
            {/* Collection Status */}
            <div className="bg-white border rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">Collection Status</h3>
              {collectionStatus ? (
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{collectionStatus.eventCount || 0}</div>
                    <div className="text-sm text-blue-800">Events Collected</div>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{collectionStatus.coverage?.coveredDays || 0}</div>
                    <div className="text-sm text-green-800">Days Covered</div>
                  </div>
                  <div className="p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">
                      {collectionStatus.lastUpdated ? new Date(collectionStatus.lastUpdated).toLocaleDateString() : 'Never'}
                    </div>
                    <div className="text-sm text-purple-800">Last Updated</div>
                  </div>
                </div>
              ) : (
                <div className="text-slate-500">Loading collection status...</div>
              )}
            </div>

            {/* Collection Controls */}
            <div className="bg-white border rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">Collection Controls</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3 text-slate-900">Quick Collection</h4>
                  <p className="text-sm text-slate-600 mb-4">Collect events for Legal & Compliance in Germany</p>
                  <button
                    onClick={startCollection}
                    disabled={busy}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                  >
                    {busy ? "Collecting..." : "Start Collection"}
                  </button>
                </div>
                
                <div>
                  <h4 className="font-medium mb-3 text-slate-900">Full Collection</h4>
                  <p className="text-sm text-slate-600 mb-4">Collect events for all industries and countries</p>
                  <button
                    onClick={startFullCollection}
                    disabled={busy}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-green-400 transition-colors"
                  >
                    {busy ? "Collecting..." : "Start Full Collection"}
                  </button>
                </div>
              </div>
            </div>

            {/* Collection Configuration */}
            <div className="bg-white border rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">Collection Configuration</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Months Ahead</label>
                  <select
                    value={collectionConfig.monthsAhead}
                    onChange={(e) => setCollectionConfig({...collectionConfig, monthsAhead: parseInt(e.target.value)})}
                    className="w-full rounded-lg border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value={3}>3 months</option>
                    <option value={6}>6 months</option>
                    <option value={12}>12 months</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Industries</label>
                  <div className="flex flex-wrap gap-2">
                    {collectionConfig.industries.map((industry) => (
                      <Chip key={industry} text={industry} />
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="mt-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">Countries</label>
                <div className="flex flex-wrap gap-2">
                  {collectionConfig.countries.map((country) => (
                    <Chip key={country} text={country.toUpperCase()} />
                  ))}
                </div>
              </div>
            </div>

            {/* Collection History */}
            <div className="bg-white border rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">Recent Collections</h3>
              <div className="text-slate-500 text-sm">
                Collection history will be displayed here once collections are run.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-slate-600">Loading admin dashboard...</p>
      </div>
    </div>}>
      <AdminContent />
    </Suspense>
  );
}
