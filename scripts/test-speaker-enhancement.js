/**
 * Test script for speaker enhancement API
 * 
 * This script tests the new speaker enhancement functionality
 * to ensure it properly enriches basic speaker data with additional
 * professional information using LLM + web search.
 */

const testSpeakerEnhancement = async () => {
  const testSpeaker = {
    name: "John Smith",
    org: "Microsoft",
    title: "Senior Software Engineer",
    speech_title: "AI in Enterprise Applications",
    session: "Technology Track",
    bio: "Experienced software engineer with expertise in AI and machine learning."
  };

  console.log('🧪 Testing Speaker Enhancement API...');
  console.log('📝 Input speaker data:', JSON.stringify(testSpeaker, null, 2));

  try {
    const response = await fetch('http://localhost:3000/api/speakers/enhance', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ speaker: testSpeaker }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(`API Error: ${result.error || 'Unknown error'}`);
    }

    console.log('✅ Enhancement successful!');
    console.log('📊 Enhanced speaker data:', JSON.stringify(result.enhanced, null, 2));

    // Check if enhancement added new fields
    const enhancedFields = [
      'education', 'publications', 'career_history', 'expertise_areas',
      'achievements', 'industry_connections', 'recent_news', 'social_links'
    ];

    const addedFields = enhancedFields.filter(field => 
      result.enhanced[field] && result.enhanced[field].length > 0
    );

    console.log(`🎯 Enhanced fields: ${addedFields.join(', ')}`);
    console.log(`📈 Confidence score: ${(result.enhanced.confidence * 100).toFixed(0)}%`);

  } catch (error) {
    console.error('❌ Enhancement failed:', error.message);
  }
};

// Run the test
testSpeakerEnhancement();
