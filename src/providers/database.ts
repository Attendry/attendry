// Database fallback provider for when external APIs are unavailable
export async function search(params: { q: string; country?: string }) {
  try {
    console.log('[database] Fallback search with query:', params.q);
    
    // This is a placeholder for database-based search
    // In a real implementation, you would search your own database of events
    // For now, return some sample legal event URLs that are known to be relevant
    
    const sampleUrls = [
      'https://www.juve.de/termine/',
      'https://www.anwaltverein.de/veranstaltungen/',
      'https://www.dav.de/veranstaltungen/',
      'https://www.forum-institut.de/veranstaltungen/',
      'https://www.euroforum.de/veranstaltungen/',
      'https://www.beck-akademie.de/veranstaltungen/',
      'https://www.bitkom.org/veranstaltungen/',
      'https://www.handelsblatt.com/veranstaltungen/',
      'https://www.compliance-netzwerk.de/veranstaltungen/',
      'https://www.legal-operations.de/events/'
    ];
    
    // Filter based on query terms
    const queryLower = params.q.toLowerCase();
    const filteredUrls = sampleUrls.filter(url => {
      const urlLower = url.toLowerCase();
      return queryLower.includes('legal') || 
             queryLower.includes('compliance') || 
             queryLower.includes('conference') ||
             queryLower.includes('veranstaltung') ||
             queryLower.includes('konferenz') ||
             urlLower.includes('veranstaltung') ||
             urlLower.includes('termine') ||
             urlLower.includes('event');
    });
    
    console.log('[database] Returning', filteredUrls.length, 'fallback URLs');
    
    return { 
      items: filteredUrls, 
      debug: { 
        rawCount: filteredUrls.length, 
        source: 'database_fallback',
        note: 'Using fallback URLs when external providers fail'
      } 
    };
  } catch (error) {
    console.error('[database] Fallback search failed:', error);
    return { 
      items: [], 
      debug: { 
        error: error instanceof Error ? error.message : 'Unknown error', 
        rawCount: 0 
      } 
    };
  }
}
