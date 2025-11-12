/**
 * URL utilities for sub-page resolution
 * Handles absolute URL conversion, language segments, and base href
 */

/**
 * Convert a candidate href to an absolute URL
 * Honors <base href>, preserves language segments, rejects invalid hrefs
 * 
 * @param candidateHref - The href to resolve (can be relative or absolute)
 * @param baseUrl - The base URL of the document
 * @param documentBaseHref - Optional <base href> from the document
 * @returns Absolute URL or null if invalid
 */
export function toAbsoluteUrl(
  candidateHref: string | null | undefined,
  baseUrl: string,
  documentBaseHref?: string | null
): string | null {
  // Reject invalid inputs
  if (!candidateHref || typeof candidateHref !== 'string') {
    return null;
  }
  
  const href = candidateHref.trim();
  
  // Reject invalid protocols and empty
  if (!href || 
      href === '#' || 
      href.startsWith('#') ||
      href.startsWith('javascript:') ||
      href.startsWith('mailto:') ||
      href.startsWith('tel:') ||
      href.startsWith('data:')) {
    return null;
  }
  
  try {
    // If already absolute, validate and return
    if (href.startsWith('http://') || href.startsWith('https://')) {
      const url = new URL(href);
      return url.href;
    }
    
    // Determine effective base URL
    let effectiveBase = baseUrl;
    
    // Honor <base href> if present
    if (documentBaseHref) {
      try {
        const baseHrefUrl = new URL(documentBaseHref, baseUrl);
        effectiveBase = baseHrefUrl.href;
      } catch {
        // Invalid base href, fall back to baseUrl
      }
    }
    
    // Parse base URL to preserve language segments
    const baseUrlObj = new URL(effectiveBase);
    
    // Handle protocol-relative URLs
    if (href.startsWith('//')) {
      return `${baseUrlObj.protocol}${href}`;
    }
    
    // Handle absolute paths (starting with /)
    if (href.startsWith('/')) {
      // Preserve language segments in path if present
      const basePath = baseUrlObj.pathname;
      const langMatch = basePath.match(/^\/(de|en|fr|es|it|nl|pl|pt)(?:\/|$)/i);
      
      if (langMatch && !href.startsWith(`/${langMatch[1]}`)) {
        // Prepend language segment if not already present
        return `${baseUrlObj.origin}/${langMatch[1]}${href}`;
      }
      
      return `${baseUrlObj.origin}${href}`;
    }
    
    // Handle relative paths
    // Build from the directory of the current page, not the page itself
    let basePath = baseUrlObj.pathname;
    
    // If basePath doesn't end with /, treat it as a file and get directory
    if (!basePath.endsWith('/')) {
      basePath = basePath.substring(0, basePath.lastIndexOf('/') + 1);
    }
    
    // Resolve relative path segments (../, ./)
    const resolvedPath = resolveRelativePath(basePath, href);
    
    return `${baseUrlObj.origin}${resolvedPath}`;
    
  } catch (error) {
    console.warn(`[url-utils] Failed to resolve URL: "${href}" with base "${baseUrl}"`, error);
    return null;
  }
}

/**
 * Resolve relative path segments like ../ and ./
 */
function resolveRelativePath(basePath: string, relativePath: string): string {
  // Split base path into segments
  const baseSegments = basePath.split('/').filter(Boolean);
  
  // Split relative path into segments
  const relativeSegments = relativePath.split('/').filter(Boolean);
  
  // Process each segment
  for (const segment of relativeSegments) {
    if (segment === '..') {
      // Go up one directory
      baseSegments.pop();
    } else if (segment !== '.') {
      // Add segment (skip '.' which means current directory)
      baseSegments.push(segment);
    }
  }
  
  // Rebuild path
  return '/' + baseSegments.join('/');
}

/**
 * Extract <base href> from HTML content if present
 */
export function extractBaseHref(htmlContent: string): string | null {
  const baseMatch = htmlContent.match(/<base\s+[^>]*href=["']([^"']+)["'][^>]*>/i);
  return baseMatch ? baseMatch[1] : null;
}

/**
 * Normalize URL for comparison (removes trailing slash, sorts query params)
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Remove trailing slash from pathname
    let pathname = urlObj.pathname;
    if (pathname.endsWith('/') && pathname.length > 1) {
      pathname = pathname.slice(0, -1);
    }
    
    // Sort query parameters
    const params = Array.from(urlObj.searchParams.entries()).sort();
    const sortedSearch = params.length > 0 
      ? '?' + params.map(([k, v]) => `${k}=${v}`).join('&')
      : '';
    
    return `${urlObj.origin}${pathname}${sortedSearch}${urlObj.hash}`;
  } catch {
    return url;
  }
}

/**
 * Extract all sub-page URLs from content with proper resolution
 */
export function extractSubPageUrls(
  baseUrl: string,
  content: string,
  patterns: RegExp[] = []
): string[] {
  const urls = new Set<string>();
  
  // Extract <base href> if present
  const documentBaseHref = extractBaseHref(content);
  
  // Default sub-page patterns (i18n aware)
  const defaultPatterns = [
    /href=["']([^"']*(?:programm|programmübersicht|program|programme|agenda|schedule)[^"']*)["']/gi,
    /href=["']([^"']*(?:sprecher|referenten|speakers?|presenters?|faculty)[^"']*)["']/gi,
    /href=["']([^"']*(?:keynote|sessions?|workshops?)[^"']*)["']/gi,
  ];
  
  const allPatterns = patterns.length > 0 ? patterns : defaultPatterns;
  
  for (const pattern of allPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const href = match[1];
      const absoluteUrl = toAbsoluteUrl(href, baseUrl, documentBaseHref);
      
      if (absoluteUrl) {
        urls.add(normalizeUrl(absoluteUrl));
      }
    }
  }
  
  return Array.from(urls);
}

