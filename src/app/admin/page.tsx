"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

type ChipProps = { text: string; onRemove?: () => void };
function Chip({ text, onRemove }: ChipProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-md text-xs">
      {text}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-1 text-gray-500 hover:text-gray-700"
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
  speakerPrompts: {
    extraction: string;
    normalization: string;
  };
  is_active?: boolean;
};

type IndustryTemplate = {
  name: string;
  description: string;
  baseQuery: string;
  excludeTerms: string;
  industryTerms: string[];
  icpTerms: string[];
  speakerPrompts: {
    extraction: string;
    normalization: string;
  };
};

export default function AdminPage() {
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
    icpTerms: [],
    speakerPrompts: {
      extraction: "",
      normalization: ""
    }
  });
  const [industryTemplates, setIndustryTemplates] = useState<Record<string, IndustryTemplate>>({});
  const [newTerm, setNewTerm] = useState("");
  const [newIcpTerm, setNewIcpTerm] = useState("");
  
  // Collection Management State
  const [collectionStatus, setCollectionStatus] = useState<any>(null);
  const [collectionHistory, setCollectionHistory] = useState<any[]>([]);
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
    } catch (e: any) {
      setMsg(e.message);
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
          speakerPrompts: json.config.speaker_prompts || {
            extraction: "",
            normalization: ""
          },
          is_active: json.config.is_active
        });
      }
      if (json.templates) {
        setIndustryTemplates(json.templates);
      }
    } catch (e: any) {
      setMsg(e.message);
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
    } catch (e: any) {
      setMsg(e.message);
    } finally { 
      setBusy(false); 
    }
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
    } catch (e: any) { 
      setMsg(e.message); 
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
        icpTerms: [...template.icpTerms],
        speakerPrompts: { ...template.speakerPrompts }
      });
      setMsg(`Applied ${template.name} template`);
      setSaveStatus("idle"); // Reset save status when making changes
    }
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
          speakerPrompts: searchConfig.speakerPrompts,
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
    } catch (e: any) {
      setMsg(e.message);
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
    } catch (e: any) {
      console.error("Failed to load collection status:", e);
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
    } catch (e: any) {
      setMsg(e.message);
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
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
        
        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8 bg-white rounded-lg p-1 shadow-sm">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === "profile"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            User Profile
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === "search"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Search Configuration
          </button>
          <button
            onClick={() => setActiveTab("collection")}
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
              activeTab === "collection"
                ? "bg-blue-600 text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
            }`}
          >
            Data Collection
          </button>
        </div>

        {/* User Profile Tab */}
        {activeTab === "profile" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-slate-900">User Profile Management</h2>
        
            <div className="bg-white border rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                <input 
                  className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  value={fullName} 
                  onChange={e=>setFullName(e.target.value)} 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company</label>
                <input 
                  className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent" 
                  value={company} 
                  onChange={e=>setCompany(e.target.value)} 
                />
              </div>
              
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <span className="text-sm text-slate-600">Use this profile to narrow the Basic Search</span>
                <label className="flex items-center gap-2 text-sm">
                  <input 
                    type="checkbox" 
                    checked={useBasic} 
                    onChange={e=>setUseBasic(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  /> Enable
                </label>
              </div>
              
              <div className="flex gap-3">
                <button 
                  onClick={generate} 
                  disabled={busy} 
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
                >
                  {busy?"Working…":"Generate terms"}
                </button>
                <button 
                  onClick={save} 
                  disabled={busy} 
                  className="px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Save profile
                </button>
              </div>
              
              {msg && <p className="text-sm text-slate-600 p-3 bg-blue-50 border border-blue-200 rounded-lg">{msg}</p>}
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              <div className="bg-white border rounded-2xl p-6">
                <h3 className="font-semibold mb-3 text-slate-900">Competitors</h3>
                <div className="flex flex-wrap gap-2">
                  {competitors.map((c,i)=>(<Chip key={i} text={c}/>))}
                </div>
              </div>
              
              <div className="bg-white border rounded-2xl p-6">
                <h3 className="font-semibold mb-3 text-slate-900">ICP Terms</h3>
                <div className="flex flex-wrap gap-2">
                  {icpTerms.map((c,i)=>(<Chip key={i} text={c}/>))}
                </div>
              </div>
              
              <div className="bg-white border rounded-2xl p-6">
                <h3 className="font-semibold mb-3 text-slate-900">Industry Terms</h3>
                <div className="flex flex-wrap gap-2">
                  {industryTerms.map((c,i)=>(<Chip key={i} text={c}/>))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Configuration Tab */}
        {activeTab === "search" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-slate-900">Search Configuration Management</h2>
            
            {/* Industry Templates */}
            <div className="bg-white border rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">Industry Templates</h3>
              <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.entries(industryTemplates).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => applyTemplate(key)}
                    className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors text-left"
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
                    className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Legal & Compliance Config"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Industry</label>
                  <input
                    type="text"
                    value={searchConfig.industry}
                    onChange={(e) => setSearchConfig({...searchConfig, industry: e.target.value})}
                    className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., legal-compliance"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Base Search Query</label>
                <textarea
                  value={searchConfig.baseQuery}
                  onChange={(e) => setSearchConfig({...searchConfig, baseQuery: e.target.value})}
                  className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="e.g., (legal OR compliance OR investigation OR ediscovery)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Exclude Terms</label>
                <input
                  type="text"
                  value={searchConfig.excludeTerms}
                  onChange={(e) => setSearchConfig({...searchConfig, excludeTerms: e.target.value})}
                  className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., reddit forum personal blog"
                />
              </div>

              {/* Industry Terms */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Industry Terms</label>
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
                    className="flex-1 rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add industry term..."
                  />
                  <button
                    onClick={addIndustryTerm}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* ICP Terms */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">ICP Terms (Buyer Roles)</label>
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
                    className="flex-1 rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add ICP term..."
                  />
                  <button
                    onClick={addIcpTerm}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>

              {/* Speaker Prompts */}
              <div className="space-y-4">
                <h4 className="font-medium text-slate-900">Speaker Extraction Prompts</h4>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Extraction Prompt</label>
                  <textarea
                    value={searchConfig.speakerPrompts.extraction}
                    onChange={(e) => setSearchConfig({
                      ...searchConfig,
                      speakerPrompts: {...searchConfig.speakerPrompts, extraction: e.target.value}
                    })}
                    className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={4}
                    placeholder="Prompt for extracting speakers from event pages..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Normalization Prompt</label>
                  <textarea
                    value={searchConfig.speakerPrompts.normalization}
                    onChange={(e) => setSearchConfig({
                      ...searchConfig,
                      speakerPrompts: {...searchConfig.speakerPrompts, normalization: e.target.value}
                    })}
                    className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Prompt for normalizing and deduplicating speakers..."
                  />
                </div>
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
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
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
          <div className="space-y-6">
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
                <div className="text-gray-500">Loading collection status...</div>
              )}
            </div>

            {/* Collection Controls */}
            <div className="bg-white border rounded-2xl p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900">Collection Controls</h3>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-3 text-slate-900">Quick Collection</h4>
                  <p className="text-sm text-gray-600 mb-4">Collect events for Legal & Compliance in Germany</p>
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
                  <p className="text-sm text-gray-600 mb-4">Collect events for all industries and countries</p>
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
                    className="w-full rounded-lg border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              <div className="text-gray-500 text-sm">
                Collection history will be displayed here once collections are run.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
