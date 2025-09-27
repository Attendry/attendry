/**
 * Search Performance Tests
 * 
 * This file contains performance tests for the search functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Search Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load search page within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    const loadTime = Date.now() - startTime;
    
    // Performance budget: 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });

  test('should perform search within performance budget', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    const startTime = Date.now();
    
    // Enter search query
    await page.fill('input[placeholder*="search"]', 'legal conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    const searchTime = Date.now() - startTime;
    
    // Performance budget: 5 seconds
    expect(searchTime).toBeLessThan(5000);
  });

  test('should handle multiple concurrent searches', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    const startTime = Date.now();
    
    // Perform multiple searches
    const searches = [
      'legal conference',
      'tech conference',
      'business conference',
      'marketing conference',
      'finance conference'
    ];

    for (const query of searches) {
      await page.fill('input[placeholder*="search"]', query);
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });
    }

    const totalTime = Date.now() - startTime;
    
    // Performance budget: 25 seconds for 5 searches
    expect(totalTime).toBeLessThan(25000);
  });

  test('should handle large search results efficiently', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    const startTime = Date.now();
    
    // Enter search query that returns many results
    await page.fill('input[placeholder*="search"]', 'conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    const searchTime = Date.now() - startTime;
    
    // Performance budget: 8 seconds for large results
    expect(searchTime).toBeLessThan(8000);
  });

  test('should handle search with filters efficiently', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    const startTime = Date.now();
    
    // Toggle advanced search
    await page.click('button[data-testid="toggle-advanced-search"]');

    // Fill advanced search form
    await page.fill('input[name="query"]', 'legal conference');
    await page.fill('input[name="location"]', 'Munich');
    await page.fill('input[name="date"]', '2024-12-01');
    await page.selectOption('select[name="category"]', 'legal');
    await page.fill('input[name="priceMin"]', '0');
    await page.fill('input[name="priceMax"]', '1000');

    // Submit search
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    const searchTime = Date.now() - startTime;
    
    // Performance budget: 6 seconds for filtered search
    expect(searchTime).toBeLessThan(6000);
  });

  test('should handle real-time search efficiently', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    const startTime = Date.now();
    
    // Toggle advanced search
    await page.click('button[data-testid="toggle-advanced-search"]');

    // Type in search input
    await page.fill('input[name="query"]', 'legal');

    // Wait for suggestions
    await page.waitForSelector('[data-testid="search-suggestions"]', { timeout: 5000 });

    const suggestionTime = Date.now() - startTime;
    
    // Performance budget: 1 second for suggestions
    expect(suggestionTime).toBeLessThan(1000);
  });

  test('should handle search pagination efficiently', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter search query
    await page.fill('input[placeholder*="search"]', 'conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Check if pagination is available
    const pagination = await page.locator('[data-testid="pagination"]');
    if (await pagination.isVisible()) {
      const startTime = Date.now();
      
      // Click next page
      await page.click('button[data-testid="next-page"]');

      // Wait for new results
      await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

      const paginationTime = Date.now() - startTime;
      
      // Performance budget: 2 seconds for pagination
      expect(paginationTime).toBeLessThan(2000);
    }
  });

  test('should handle search history efficiently', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    const startTime = Date.now();
    
    // Perform multiple searches to build history
    const searches = ['legal', 'tech', 'business'];
    for (const query of searches) {
      await page.fill('input[placeholder*="search"]', query);
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });
    }

    // Check search history
    const historyItems = await page.locator('[data-testid="search-history-item"]');
    await expect(historyItems).toHaveCount.greaterThan(0);

    const historyTime = Date.now() - startTime;
    
    // Performance budget: 15 seconds for building history
    expect(historyTime).toBeLessThan(15000);
  });

  test('should handle search with special characters efficiently', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    const startTime = Date.now();
    
    // Enter search query with special characters
    await page.fill('input[placeholder*="search"]', 'legal & compliance conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    const searchTime = Date.now() - startTime;
    
    // Performance budget: 5 seconds for special characters
    expect(searchTime).toBeLessThan(5000);
  });

  test('should handle search with long query efficiently', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    const startTime = Date.now();
    
    // Enter long search query
    const longQuery = 'legal compliance conference munich germany 2024 professional development';
    await page.fill('input[placeholder*="search"]', longQuery);
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    const searchTime = Date.now() - startTime;
    
    // Performance budget: 6 seconds for long query
    expect(searchTime).toBeLessThan(6000);
  });

  test('should handle search with no results efficiently', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    const startTime = Date.now();
    
    // Enter search query with no results
    await page.fill('input[placeholder*="search"]', 'nonexistent event xyz123');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for no results message
    await page.waitForSelector('[data-testid="no-results"]', { timeout: 10000 });

    const searchTime = Date.now() - startTime;
    
    // Performance budget: 3 seconds for no results
    expect(searchTime).toBeLessThan(3000);
  });

  test('should handle search with network latency', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Simulate network latency
    await page.route('**/api/events/search', route => {
      setTimeout(() => route.continue(), 1000);
    });

    const startTime = Date.now();
    
    // Enter search query
    await page.fill('input[placeholder*="search"]', 'legal conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    const searchTime = Date.now() - startTime;
    
    // Performance budget: 6 seconds with network latency
    expect(searchTime).toBeLessThan(6000);
  });

  test('should handle search with memory constraints', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    const startTime = Date.now();
    
    // Perform multiple searches to test memory usage
    const searches = Array.from({ length: 10 }, (_, i) => `search ${i}`);
    
    for (const query of searches) {
      await page.fill('input[placeholder*="search"]', query);
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });
    }

    const totalTime = Date.now() - startTime;
    
    // Performance budget: 50 seconds for 10 searches
    expect(totalTime).toBeLessThan(50000);
  });
});
