/**
 * Search End-to-End Tests
 * 
 * This file contains end-to-end tests for the search functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Search End-to-End', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should perform basic search', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter search query
    await page.fill('input[placeholder*="search"]', 'legal conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Verify results are displayed
    const results = await page.locator('[data-testid="event-card"]');
    await expect(results).toHaveCount.greaterThan(0);
  });

  test('should perform advanced search', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

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

    // Verify results are displayed
    const results = await page.locator('[data-testid="event-card"]');
    await expect(results).toHaveCount.greaterThan(0);
  });

  test('should handle search with no results', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter search query with no results
    await page.fill('input[placeholder*="search"]', 'nonexistent event xyz123');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for no results message
    await page.waitForSelector('[data-testid="no-results"]', { timeout: 10000 });

    // Verify no results message is displayed
    await expect(page.locator('[data-testid="no-results"]')).toBeVisible();
  });

  test('should handle search errors gracefully', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter search query
    await page.fill('input[placeholder*="search"]', 'legal conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results or error message
    await page.waitForSelector('[data-testid="search-results"], [data-testid="error-message"]', { timeout: 10000 });

    // Verify either results or error message is displayed
    const results = await page.locator('[data-testid="search-results"]');
    const error = await page.locator('[data-testid="error-message"]');
    
    await expect(results.or(error)).toBeVisible();
  });

  test('should perform real-time search', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Toggle advanced search
    await page.click('button[data-testid="toggle-advanced-search"]');

    // Type in search input
    await page.fill('input[name="query"]', 'legal');

    // Wait for suggestions
    await page.waitForSelector('[data-testid="search-suggestions"]', { timeout: 5000 });

    // Verify suggestions are displayed
    const suggestions = await page.locator('[data-testid="search-suggestion"]');
    await expect(suggestions).toHaveCount.greaterThan(0);

    // Click on a suggestion
    await suggestions.first().click();

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Verify results are displayed
    const results = await page.locator('[data-testid="event-card"]');
    await expect(results).toHaveCount.greaterThan(0);
  });

  test('should save search to history', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter search query
    await page.fill('input[placeholder*="search"]', 'legal conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Check search history
    const historyItems = await page.locator('[data-testid="search-history-item"]');
    await expect(historyItems).toHaveCount.greaterThan(0);
  });

  test('should load search from history', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Click on search history item
    await page.click('[data-testid="search-history-item"]:first-child');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Verify results are displayed
    const results = await page.locator('[data-testid="event-card"]');
    await expect(results).toHaveCount.greaterThan(0);
  });

  test('should clear search history', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Click clear history button
    await page.click('button[data-testid="clear-search-history"]');

    // Verify history is cleared
    const historyItems = await page.locator('[data-testid="search-history-item"]');
    await expect(historyItems).toHaveCount(0);
  });

  test('should handle search pagination', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter search query
    await page.fill('input[placeholder*="search"]', 'legal conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Check if pagination is available
    const pagination = await page.locator('[data-testid="pagination"]');
    if (await pagination.isVisible()) {
      // Click next page
      await page.click('button[data-testid="next-page"]');

      // Wait for new results
      await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

      // Verify results are displayed
      const results = await page.locator('[data-testid="event-card"]');
      await expect(results).toHaveCount.greaterThan(0);
    }
  });

  test('should handle search filters', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Toggle advanced search
    await page.click('button[data-testid="toggle-advanced-search"]');

    // Fill search form
    await page.fill('input[name="query"]', 'legal conference');
    await page.fill('input[name="location"]', 'Munich');
    await page.fill('input[name="date"]', '2024-12-01');

    // Submit search
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Verify results are displayed
    const results = await page.locator('[data-testid="event-card"]');
    await expect(results).toHaveCount.greaterThan(0);

    // Verify filters are applied
    const locationFilter = await page.locator('[data-testid="location-filter"]');
    const dateFilter = await page.locator('[data-testid="date-filter"]');
    
    await expect(locationFilter).toContainText('Munich');
    await expect(dateFilter).toContainText('2024-12-01');
  });

  test('should handle search with special characters', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter search query with special characters
    await page.fill('input[placeholder*="search"]', 'legal & compliance conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Verify results are displayed
    const results = await page.locator('[data-testid="event-card"]');
    await expect(results).toHaveCount.greaterThan(0);
  });

  test('should handle search with long query', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter long search query
    const longQuery = 'legal compliance conference munich germany 2024 professional development';
    await page.fill('input[placeholder*="search"]', longQuery);
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Verify results are displayed
    const results = await page.locator('[data-testid="event-card"]');
    await expect(results).toHaveCount.greaterThan(0);
  });
});
