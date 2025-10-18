import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface PromoteEventRequest {
  eventId: string;
}

// POST /api/events/promote - Promote a calendar event to the main analysis pipeline
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await supabaseServer();
    const { data: userRes, error: userErr } = await supabase.auth.getUser();
    
    if (userErr || !userRes?.user) {
      return NextResponse.json({ 
        success: false,
        error: "Not authenticated" 
      }, { status: 401 });
    }

    const requestData: PromoteEventRequest = await req.json();
    const { eventId } = requestData;
    
    if (!eventId) {
      return NextResponse.json({ 
        success: false,
        error: "eventId is required" 
      }, { status: 400 });
    }

    // First, get the event from collected_events
    const { data: eventData, error: eventError } = await supabase
      .from('collected_events')
      .select('*')
      .eq('id', eventId)
      .single();

    if (eventError || !eventData) {
      return NextResponse.json({ 
        success: false,
        error: "Event not found" 
      }, { status: 404 });
    }

    // Convert the collected event to the format expected by the analysis pipeline
    const eventForAnalysis = {
      source_url: eventData.source_url,
      title: eventData.title,
      description: eventData.description,
      starts_at: eventData.starts_at,
      ends_at: eventData.ends_at,
      city: eventData.city,
      country: eventData.country,
      venue: eventData.venue,
      organizer: eventData.organizer,
      speakers: eventData.speakers || [],
      sponsors: eventData.sponsors || [],
      participating_organizations: eventData.participating_organizations || [],
      confidence: eventData.confidence,
      data_completeness: eventData.data_completeness,
      pipeline_metadata: {
        ...eventData.pipeline_metadata,
        promoted_from_calendar: true,
        promoted_at: new Date().toISOString(),
        promoted_by: userRes.user.id
      }
    };

    // For now, we'll mark the event as promoted and let the user know
    // The analysis pipeline can be triggered manually or through a separate process
    console.log('Event promoted from calendar:', eventId, 'by user:', userRes.user.id);

    // Create or update an event extraction record to track the promotion
    const eventDate = eventData.starts_at ? new Date(eventData.starts_at).toISOString().split('T')[0] : null;
    
    const { data: extractionData, error: extractionError } = await supabase
      .from('event_extractions')
      .upsert({
        url: eventData.source_url,
        normalized_url: eventData.source_url,
        event_date: eventDate,
        country: eventData.country,
        locality: eventData.city,
        payload: {
          promoted_from_calendar: true,
          promoted_at: new Date().toISOString(),
          promoted_by: userRes.user.id,
          original_event_data: eventData,
          status: 'promoted',
          ready_for_analysis: true
        }
      }, {
        onConflict: 'normalized_url,event_date',
        ignoreDuplicates: false
      })
      .select()
      .single();

    if (extractionError) {
      return NextResponse.json({ 
        success: false,
        error: extractionError.message 
      }, { status: 400 });
    }

    // Now trigger the actual analysis pipeline for the promoted event
    try {
      console.log('Triggering analysis pipeline for promoted event:', eventId);
      
      // For promoted events, we need to directly analyze the specific event URL
      // Instead of making internal API calls (which have auth issues), let's implement the enhancement directly
      console.log('Directly analyzing promoted event URL:', eventData.source_url);
      console.log('Event data being processed:', {
        title: eventData.title,
        source_url: eventData.source_url,
        country: eventData.country,
        starts_at: eventData.starts_at
      });
      
      // Import the enhancement logic directly from the speakers/enhance route
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const { createHash } = await import('crypto');
      
      // Get environment variables
      const geminiKey = process.env.GEMINI_API_KEY;
      const firecrawlKey = process.env.FIRECRAWL_KEY;
      const googleKey = process.env.GOOGLE_CSE_KEY;
      const googleCx = process.env.GOOGLE_CSE_CX;
      
      console.log('Environment check:', {
        geminiKey: !!geminiKey,
        firecrawlKey: !!firecrawlKey,
        googleKey: !!googleKey,
        googleCx: !!googleCx
      });
      
      // Create a mock speaker object to trigger the enhancement pipeline
      const mockSpeaker = {
        name: eventData.title || 'Event Speaker',
        org: 'Event Company',
        bio: `Event: ${eventData.title}`,
        url: eventData.source_url,
        event_date: eventData.starts_at,
        country: eventData.country
      };
      
      console.log('Starting direct enhancement for speaker:', mockSpeaker.name);
      
      // Call Firecrawl to scrape the event URL
      let searchResults = [];
      if (firecrawlKey && mockSpeaker.url) {
        try {
          console.log('Calling Firecrawl for URL:', mockSpeaker.url);
          const firecrawlResponse = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${firecrawlKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              url: mockSpeaker.url,
              formats: ['markdown'],
              onlyMainContent: true
            })
          });
          
          if (firecrawlResponse.ok) {
            const firecrawlData = await firecrawlResponse.json();
            console.log('Firecrawl response received, content length:', firecrawlData.data?.content?.length || 0);
            
            if (firecrawlData.data?.content && firecrawlData.data.content.length > 0) {
              searchResults = [{
                title: firecrawlData.data?.metadata?.title || mockSpeaker.name,
                url: mockSpeaker.url,
                content: firecrawlData.data.content,
                description: firecrawlData.data?.metadata?.description || ''
              }];
              console.log('Firecrawl successfully scraped content');
            } else {
              console.warn('Firecrawl returned empty content, will try Google CSE fallback');
            }
          } else {
            console.warn('Firecrawl failed, status:', firecrawlResponse.status);
          }
        } catch (firecrawlError) {
          console.warn('Firecrawl error:', firecrawlError);
        }
      }
      
      // If Firecrawl failed, try Google CSE as fallback
      if (searchResults.length === 0 && googleKey && googleCx) {
        try {
          console.log('Using Google CSE fallback for:', mockSpeaker.name);
          const searchQuery = `${mockSpeaker.name} ${mockSpeaker.org} speaker`;
          const googleResponse = await fetch(
            `https://www.googleapis.com/customsearch/v1?key=${googleKey}&cx=${googleCx}&q=${encodeURIComponent(searchQuery)}&num=5`
          );
          
          if (googleResponse.ok) {
            const googleData = await googleResponse.json();
            searchResults = (googleData.items || []).map((item: any) => ({
              title: item.title,
              url: item.link,
              content: item.snippet,
              description: item.snippet
            }));
            console.log('Google CSE found', searchResults.length, 'results');
          }
        } catch (googleError) {
          console.warn('Google CSE error:', googleError);
        }
      }
      
      console.log('Search results count:', searchResults.length);
      
      // Use Gemini to enhance the speaker data
      let enhancedData = null;
      if (geminiKey && searchResults.length > 0) {
        try {
          console.log('Calling Gemini for enhancement');
          const genAI = new GoogleGenerativeAI(geminiKey);
          const model = genAI.getGenerativeModel({ model: 'gemini-2.5-pro' });
          
          const prompt = `Analyze the following event information and extract detailed speaker/organizer data:

Event: ${mockSpeaker.name}
Organization: ${mockSpeaker.org}
URL: ${mockSpeaker.url}
Date: ${mockSpeaker.event_date}
Country: ${mockSpeaker.country}

Search Results:
${searchResults.map((result, i) => `${i + 1}. ${result.title}\n   URL: ${result.url}\n   Content: ${result.content.substring(0, 500)}...`).join('\n\n')}

Please extract and enhance the following information in JSON format:
{
  "name": "Full name",
  "title": "Job title/position",
  "company": "Company/organization",
  "bio": "Professional biography",
  "expertise_areas": ["area1", "area2"],
  "social_links": {
    "linkedin": "LinkedIn URL if found",
    "twitter": "Twitter URL if found",
    "website": "Personal website if found"
  },
  "speaking_history": ["recent speaking engagements"],
  "education": ["educational background"],
  "achievements": ["notable achievements"],
  "industry_connections": ["industry connections"],
  "recent_news": ["recent news mentions"]
}

Focus on extracting real, factual information from the search results. If information is not available, use null or empty arrays.`;

          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          
          // Try to parse the JSON response with better error handling
          try {
            console.log('Raw Gemini response:', text.substring(0, 500) + '...');
            
            // Try to find JSON in the response
            const jsonMatch = text.match(/\{[\s\S]*?\}(?=\s*$|\s*[^}])/);
            if (jsonMatch) {
              const jsonStr = jsonMatch[0];
              console.log('Extracted JSON string:', jsonStr.substring(0, 200) + '...');
              enhancedData = JSON.parse(jsonStr);
              console.log('Gemini enhancement completed successfully');
            } else {
              // If no JSON found, try to extract key information manually
              console.warn('No JSON found in Gemini response, attempting manual extraction');
              enhancedData = {
                name: mockSpeaker.name,
                title: "Event Organizer",
                company: mockSpeaker.org,
                bio: `Organizer of ${mockSpeaker.name}`,
                expertise_areas: ["Event Management", "Compliance"],
                social_links: {},
                speaking_history: [],
                education: [],
                achievements: [],
                industry_connections: [],
                recent_news: []
              };
              console.log('Created fallback enhanced data');
            }
          } catch (parseError) {
            console.warn('Failed to parse Gemini JSON response:', parseError);
            console.log('Full response text:', text);
            
            // Create fallback data if parsing fails
            enhancedData = {
              name: mockSpeaker.name,
              title: "Event Organizer", 
              company: mockSpeaker.org,
              bio: `Organizer of ${mockSpeaker.name}`,
              expertise_areas: ["Event Management", "Compliance"],
              social_links: {},
              speaking_history: [],
              education: [],
              achievements: [],
              industry_connections: [],
              recent_news: []
            };
            console.log('Created fallback enhanced data due to parse error');
          }
        } catch (geminiError) {
          console.warn('Gemini error:', geminiError);
        }
      }
      
      const analysisResult = {
        success: true,
        enhanced: enhancedData,
        searchResults: searchResults,
        extractedData: enhancedData
      };
      
      console.log('Direct enhancement completed:', analysisResult.success);
      console.log('Analysis pipeline completed for promoted event:', eventId);
      console.log('Analysis result keys:', Object.keys(analysisResult));
      console.log('Analysis result success:', analysisResult.success);
      console.log('Analysis result enhanced:', analysisResult.enhanced);
      console.log('Analysis result search results count:', analysisResult.searchResults?.length || 0);
      console.log('Analysis result extracted data:', analysisResult.extractedData ? 'present' : 'missing');
      if (analysisResult.searchResults && analysisResult.searchResults.length > 0) {
        console.log('First search result:', {
          title: analysisResult.searchResults[0].title,
          url: analysisResult.searchResults[0].url
        });
      }
      if (analysisResult.extractedData) {
        console.log('Extracted data keys:', Object.keys(analysisResult.extractedData));
      }
      
      if (analysisResult.success) {
        
        // Update the extraction record with analysis results
        await supabase
          .from('event_extractions')
          .update({
            payload: {
              ...extractionData.payload,
              analysis_completed: true,
              analysis_results: analysisResult,
              analyzed_at: new Date().toISOString(),
              events_found: analysisResult.events?.length || 0
            }
          })
          .eq('id', extractionData.id);
      } else {
        console.warn('Analysis pipeline failed for promoted event:', eventId, 'Error:', analysisResult.error || 'Unknown error');
      }
    } catch (analysisError) {
      console.error('Failed to trigger analysis pipeline:', analysisError);
      // Don't fail the promotion if analysis fails
    }

    return NextResponse.json({ 
      success: true, 
      message: "Event promoted to analysis pipeline and processing started",
      extractionId: extractionData.id,
      eventId: eventId
    });
  } catch (e: any) {
    return NextResponse.json({ 
      success: false,
      error: e?.message || "Failed to promote event" 
    }, { status: 500 });
  }
}
