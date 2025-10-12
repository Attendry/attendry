/**
 * CompanyCard Component
 * 
 * A component for displaying company and sponsor information in event cards.
 * Shows company name, sponsorship tier, logo, and website link.
 * 
 * Features:
 * - Company name display
 * - Sponsorship tier badges with text abbreviations (PLAT, GOLD, SILV, etc.)
 * - Logo placeholder
 * - Website link
 * - Consistent styling with other card components
 * 
 * @author Attendry Team
 * @version 1.0
 */

"use client";
import React from "react";
import { SponsorData } from "@/lib/types/core";

/**
 * Company card component props
 */
interface CompanyCardProps {
  company: SponsorData | string;  // Can be SponsorData object or string name
  isSponsor?: boolean;            // Whether this is a sponsor (vs participating organization)
}

/**
 * Main CompanyCard component
 * 
 * @param company - Company data (object or string)
 * @param isSponsor - Whether this is a sponsor
 * @returns JSX element representing the company card
 */
export default function CompanyCard({ company, isSponsor = false }: CompanyCardProps) {
  // ============================================================================
  // DATA NORMALIZATION
  // ============================================================================
  
  // Handle both string and object formats
  const companyData = typeof company === 'string' 
    ? { name: company, level: null, logo_url: null, website_url: null, description: null }
    : company;

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  
  /**
   * Get tier badge styling based on sponsorship level
   */
  const getTierBadgeStyle = (level: string | null | undefined) => {
    if (!level) return "bg-gray-100 text-gray-800";
    
    const tier = level.toLowerCase();
    if (tier.includes('platinum')) return "bg-purple-100 text-purple-800";
    if (tier.includes('gold')) return "bg-yellow-100 text-yellow-800";
    if (tier.includes('silver')) return "bg-gray-100 text-gray-800";
    if (tier.includes('bronze')) return "bg-orange-100 text-orange-800";
    if (tier.includes('diamond')) return "bg-blue-100 text-blue-800";
    if (tier.includes('premium')) return "bg-indigo-100 text-indigo-800";
    return "bg-slate-100 text-slate-800";
  };

  /**
   * Get tier abbreviation for display
   */
  const getTierAbbreviation = (level: string | null | undefined) => {
    if (!level) return null;
    
    const tier = level.toLowerCase();
    if (tier.includes('platinum')) return "PLAT";
    if (tier.includes('diamond')) return "DIAM";
    if (tier.includes('gold')) return "GOLD";
    if (tier.includes('silver')) return "SILV";
    if (tier.includes('bronze')) return "BRON";
    if (tier.includes('premium')) return "PREM";
    return level.toUpperCase().slice(0, 4);
  };

  // ============================================================================
  // RENDER
  // ============================================================================
  
  return (
    <div className="rounded-lg border border-slate-200 p-3 bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Company Logo Placeholder */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center flex-shrink-0">
              {companyData.logo_url ? (
                <img 
                  src={companyData.logo_url} 
                  alt={`${companyData.name} logo`}
                  className="w-6 h-6 object-contain"
                  onError={(e) => {
                    // Fallback to text if image fails to load
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.innerHTML = `<span class="text-xs font-semibold text-slate-600">${companyData.name.charAt(0).toUpperCase()}</span>`;
                    }
                  }}
                />
              ) : (
                <span className="text-xs font-semibold text-slate-600">
                  {companyData.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            
            {/* Company Name */}
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-slate-900 truncate">
                {companyData.name}
              </h4>
              {companyData.description && (
                <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                  {companyData.description}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Tier Badge (for sponsors only) */}
        {isSponsor && companyData.level && (
          <div className="flex flex-col items-end gap-1">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${getTierBadgeStyle(companyData.level)}`}>
              {getTierAbbreviation(companyData.level)}
            </span>
          </div>
        )}
      </div>

      {/* Website Link */}
      {companyData.website_url && (
        <div className="mt-3 pt-2 border-t border-slate-100">
          <a 
            href={companyData.website_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Visit Website
          </a>
        </div>
      )}
    </div>
  );
}
