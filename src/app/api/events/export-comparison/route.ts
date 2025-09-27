/**
 * Export Event Comparison API
 * 
 * This endpoint exports event comparison data in various formats
 * including PDF and JSON.
 */

import { NextRequest, NextResponse } from 'next/server';
import { EventData } from '@/lib/types/core';

/**
 * Export comparison request
 */
interface ExportComparisonRequest {
  events: EventData[];
  metrics: any;
  format: 'pdf' | 'json';
}

/**
 * POST /api/events/export-comparison
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const { events, metrics, format }: ExportComparisonRequest = await req.json();

    if (!events || events.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 events are required for comparison' },
        { status: 400 }
      );
    }

    if (format === 'json') {
      const exportData = {
        events,
        metrics,
        exportedAt: new Date().toISOString(),
        version: '1.0',
      };

      return new NextResponse(JSON.stringify(exportData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="event-comparison-${Date.now()}.json"`,
        },
      });
    }

    if (format === 'pdf') {
      // For PDF generation, we'll return a simple HTML representation
      // In a production environment, you might want to use a library like puppeteer
      // or a service like PDFKit to generate proper PDFs
      
      const html = generateComparisonHTML(events, metrics);
      
      return new NextResponse(html, {
        headers: {
          'Content-Type': 'text/html',
          'Content-Disposition': `attachment; filename="event-comparison-${Date.now()}.html"`,
        },
      });
    }

    return NextResponse.json(
      { error: 'Unsupported export format' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Export comparison error:', error);
    return NextResponse.json(
      { error: 'Failed to export comparison' },
      { status: 500 }
    );
  }
}

/**
 * Generate HTML for comparison export
 */
function generateComparisonHTML(events: EventData[], metrics: any): string {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (hours: number) => {
    if (hours < 24) {
      return `${Math.round(hours)} hours`;
    } else {
      return `${Math.round(hours / 24)} days`;
    }
  };

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Event Comparison Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #e5e7eb;
            padding-bottom: 20px;
        }
        .header h1 {
            color: #1f2937;
            margin: 0;
        }
        .header p {
            color: #6b7280;
            margin: 5px 0 0 0;
        }
        .events-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 30px;
            margin-bottom: 30px;
        }
        .event-card {
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 20px;
            background: #f9fafb;
        }
        .event-card h3 {
            color: #1f2937;
            margin: 0 0 15px 0;
            font-size: 1.2em;
        }
        .event-detail {
            margin-bottom: 10px;
            display: flex;
            align-items: center;
        }
        .event-detail svg {
            width: 16px;
            height: 16px;
            margin-right: 8px;
            color: #6b7280;
        }
        .event-detail span {
            color: #6b7280;
            font-size: 0.9em;
        }
        .metrics-section {
            margin-top: 30px;
        }
        .metrics-section h2 {
            color: #1f2937;
            margin-bottom: 20px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }
        .metric-card {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 15px;
        }
        .metric-card h4 {
            color: #1f2937;
            margin: 0 0 10px 0;
            font-size: 1em;
        }
        .metric-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
        }
        .metric-row:last-child {
            margin-bottom: 0;
        }
        .metric-label {
            color: #6b7280;
            font-size: 0.9em;
        }
        .metric-value {
            color: #1f2937;
            font-weight: 500;
            font-size: 0.9em;
        }
        .progress-bar {
            width: 100%;
            height: 8px;
            background: #e5e7eb;
            border-radius: 4px;
            overflow: hidden;
            margin-top: 5px;
        }
        .progress-fill {
            height: 100%;
            background: #3b82f6;
            transition: width 0.3s ease;
        }
        .footer {
            margin-top: 40px;
            text-align: center;
            color: #6b7280;
            font-size: 0.9em;
            border-top: 1px solid #e5e7eb;
            padding-top: 20px;
        }
        @media print {
            body { margin: 0; padding: 15px; }
            .header { page-break-after: avoid; }
            .events-grid { page-break-inside: avoid; }
            .metrics-section { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Event Comparison Report</h1>
        <p>Generated on ${new Date().toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })}</p>
    </div>

    <div class="events-grid">
        ${events.map(event => `
            <div class="event-card">
                <h3>${event.title}</h3>
                ${event.starts_at ? `
                    <div class="event-detail">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
                        </svg>
                        <span>${formatDate(event.starts_at)}${event.ends_at ? ` - ${formatDate(event.ends_at)}` : ''}</span>
                    </div>
                ` : ''}
                ${(event.city || event.country) ? `
                    <div class="event-detail">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                        </svg>
                        <span>${[event.city, event.country].filter(Boolean).join(', ')}</span>
                    </div>
                ` : ''}
                ${event.organizer ? `
                    <div class="event-detail">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                        </svg>
                        <span>${event.organizer}</span>
                    </div>
                ` : ''}
                ${event.description ? `
                    <div class="event-detail">
                        <span>${event.description}</span>
                    </div>
                ` : ''}
            </div>
        `).join('')}
    </div>

    ${metrics ? `
        <div class="metrics-section">
            <h2>Comparison Analysis</h2>
            <div class="metrics-grid">
                ${metrics.dateComparison ? `
                    <div class="metric-card">
                        <h4>Date Comparison</h4>
                        <div class="metric-row">
                            <span class="metric-label">Earlier:</span>
                            <span class="metric-value">${metrics.dateComparison.earlier}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Later:</span>
                            <span class="metric-value">${metrics.dateComparison.later}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Days apart:</span>
                            <span class="metric-value">${metrics.dateComparison.daysDifference}</span>
                        </div>
                    </div>
                ` : ''}
                
                ${metrics.locationComparison ? `
                    <div class="metric-card">
                        <h4>Location Comparison</h4>
                        <div class="metric-row">
                            <span class="metric-label">Same country:</span>
                            <span class="metric-value">${metrics.locationComparison.sameCountry ? 'Yes' : 'No'}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Same city:</span>
                            <span class="metric-value">${metrics.locationComparison.sameCity ? 'Yes' : 'No'}</span>
                        </div>
                    </div>
                ` : ''}
                
                ${metrics.topicSimilarity ? `
                    <div class="metric-card">
                        <h4>Topic Similarity</h4>
                        <div class="metric-row">
                            <span class="metric-label">Similarity:</span>
                            <span class="metric-value">${metrics.topicSimilarity}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${metrics.topicSimilarity}%"></div>
                        </div>
                    </div>
                ` : ''}
                
                ${metrics.durationComparison ? `
                    <div class="metric-card">
                        <h4>Duration Comparison</h4>
                        <div class="metric-row">
                            <span class="metric-label">Shorter:</span>
                            <span class="metric-value">${metrics.durationComparison.shorter}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Longer:</span>
                            <span class="metric-value">${metrics.durationComparison.longer}</span>
                        </div>
                        <div class="metric-row">
                            <span class="metric-label">Difference:</span>
                            <span class="metric-value">${formatDuration(metrics.durationComparison.durationDifference)}</span>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    ` : ''}

    <div class="footer">
        <p>This report was generated by Attendry Event Comparison Tool</p>
    </div>
</body>
</html>
  `;
}
