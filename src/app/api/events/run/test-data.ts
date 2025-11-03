// Mock event data for testing when external APIs are not configured
export const mockEvents = [
  {
    id: "mock-1",
    title: "Legal Tech Conference 2025",
    source_url: "https://example.com/legal-tech-conference-2025",
    starts_at: "2025-11-15T09:00:00Z",
    ends_at: "2025-11-17T18:00:00Z",
    city: "Berlin",
    country: "DE",
    location: "Berlin Convention Center, Messedamm 22, 14055 Berlin",
    venue: "Hall 1",
    organizer: "Legal Tech Association Germany",
    description: "Join us for the premier legal technology conference in Europe. Explore the latest innovations in legal tech, AI-powered legal research, contract automation, and digital transformation in law firms.",
    confidence: 0.95,
    confidence_reason: "Mock data for testing",
    speakers: [
      {
        name: "Dr. Jane Smith",
        title: "Partner & Head of Innovation",
        org: "Smith & Associates LLP",
        bio: "Leading expert in legal technology with 15+ years of experience in digital transformation of law firms.",
        confidence: 0.9
      },
      {
        name: "Michael Chen",
        title: "CTO",
        org: "LegalAI Solutions",
        bio: "Pioneer in AI-powered legal research and contract analysis tools.",
        confidence: 0.88
      }
    ],
    sponsors: [],
    sessions: [],
    pipeline_metadata: {
      source: "mock",
      test_data: true
    }
  },
  {
    id: "mock-2",
    title: "Digital Law Summit Germany",
    source_url: "https://example.com/digital-law-summit-germany",
    starts_at: "2025-12-01T10:00:00Z",
    ends_at: "2025-12-03T17:00:00Z",
    city: "Munich",
    country: "DE",
    location: "Munich Conference Hall, Karlsplatz 8, 80335 München",
    venue: "Main Auditorium",
    organizer: "German Bar Association",
    description: "The Digital Law Summit brings together legal professionals to discuss digital transformation, cybersecurity law, data protection, and the future of legal services in Germany.",
    confidence: 0.92,
    confidence_reason: "Mock data for testing",
    speakers: [
      {
        name: "Prof. Dr. Anna Weber",
        title: "Professor of Digital Law",
        org: "Ludwig Maximilian University",
        bio: "Renowned expert in digital law, data protection, and GDPR compliance.",
        confidence: 0.95
      }
    ],
    sponsors: [],
    sessions: [],
    pipeline_metadata: {
      source: "mock",
      test_data: true
    }
  },
  {
    id: "mock-3",
    title: "European Compliance & RegTech Forum",
    source_url: "https://example.com/compliance-regtech-forum",
    starts_at: "2025-11-20T08:30:00Z",
    ends_at: "2025-11-21T19:00:00Z",
    city: "Frankfurt",
    country: "DE",
    location: "Frankfurt Messe, Ludwig-Erhard-Anlage 1, 60327 Frankfurt",
    venue: "Congress Center",
    organizer: "RegTech Europe",
    description: "Europe's leading regulatory technology and compliance conference. Discuss AML, KYC, risk management, and compliance automation with industry leaders.",
    confidence: 0.89,
    confidence_reason: "Mock data for testing",
    speakers: [
      {
        name: "Robert Johnson",
        title: "Chief Compliance Officer",
        org: "Deutsche Financial Services",
        bio: "Over 20 years of experience in regulatory compliance and risk management.",
        confidence: 0.87
      },
      {
        name: "Sarah Martinez",
        title: "CEO",
        org: "ComplianceTech Solutions",
        bio: "Leading innovator in automated compliance and regulatory reporting.",
        confidence: 0.91
      }
    ],
    sponsors: [],
    sessions: [],
    pipeline_metadata: {
      source: "mock",
      test_data: true
    }
  },
  {
    id: "mock-4",
    title: "AI in Legal Practice Symposium",
    source_url: "https://example.com/ai-legal-practice-symposium",
    starts_at: "2025-12-10T09:00:00Z",
    ends_at: "2025-12-11T17:00:00Z",
    city: "Hamburg",
    country: "DE",
    location: "Hamburg Congress Center, Marseiller Str. 2, 20355 Hamburg",
    venue: "Conference Hall A",
    organizer: "German Legal Tech Institute",
    description: "Explore the transformative impact of artificial intelligence on legal practice. Topics include AI ethics, automated document review, predictive analytics, and the future of legal services.",
    confidence: 0.94,
    confidence_reason: "Mock data for testing",
    speakers: [
      {
        name: "Dr. Thomas Schneider",
        title: "Director of AI Research",
        org: "Max Planck Institute for Innovation",
        bio: "Leading researcher in AI applications for legal decision-making.",
        confidence: 0.93
      }
    ],
    sponsors: [],
    sessions: [],
    pipeline_metadata: {
      source: "mock",
      test_data: true
    }
  },
  {
    id: "mock-5",
    title: "Corporate Governance & Legal Affairs Conference",
    source_url: "https://example.com/corporate-governance-conference",
    starts_at: "2025-11-25T09:30:00Z",
    ends_at: "2025-11-26T18:00:00Z",
    city: "Düsseldorf",
    country: "DE",
    location: "Düsseldorf Congress Center, Stockumer Kirchstraße 61, 40474 Düsseldorf",
    venue: "Main Conference Room",
    organizer: "Corporate Law Association",
    description: "Annual conference on corporate governance, legal compliance, board responsibilities, and shareholder relations. Essential for corporate counsel and board members.",
    confidence: 0.88,
    confidence_reason: "Mock data for testing",
    speakers: [
      {
        name: "Dr. Klaus Meyer",
        title: "General Counsel",
        org: "German Automotive Group",
        bio: "Expert in corporate governance with extensive experience in DAX companies.",
        confidence: 0.86
      }
    ],
    sponsors: [],
    sessions: [],
    pipeline_metadata: {
      source: "mock",
      test_data: true
    }
  }
];

export function getMockEvents(options?: {
  userText?: string;
  country?: string;
  limit?: number;
}): typeof mockEvents {
  let filtered = [...mockEvents];

  // Simple filtering based on search terms
  if (options?.userText) {
    const searchTerms = options.userText.toLowerCase().split(' ');
    filtered = filtered.filter(event => {
      const searchableText = `${event.title} ${event.description} ${event.city}`.toLowerCase();
      return searchTerms.some(term => searchableText.includes(term));
    });
  }

  // Filter by country
  if (options?.country && options.country !== 'EU') {
    filtered = filtered.filter(event => event.country === options.country);
  }

  // Apply limit
  if (options?.limit) {
    filtered = filtered.slice(0, options.limit);
  }

  return filtered;
}

