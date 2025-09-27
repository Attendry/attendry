/**
 * Cross-Browser Tests
 * 
 * This file contains cross-browser compatibility tests.
 */

import { test, expect } from '@playwright/test';

test.describe('Cross-Browser Compatibility', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load homepage in all browsers', async ({ page }) => {
    // Verify page loads
    await expect(page).toHaveTitle(/Attendry/);
    
    // Verify main navigation is visible
    await expect(page.locator('nav')).toBeVisible();
    
    // Verify main content is visible
    await expect(page.locator('main')).toBeVisible();
  });

  test('should handle search functionality in all browsers', async ({ page }) => {
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

  test('should handle login functionality in all browsers', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Verify login form is displayed
    await expect(page.locator('form[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();

    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect or success message
    await page.waitForSelector('[data-testid="login-success"], [data-testid="error-message"]', { timeout: 10000 });

    // Verify success or error message
    const success = await page.locator('[data-testid="login-success"]');
    const error = await page.locator('[data-testid="error-message"]');
    
    await expect(success.or(error)).toBeVisible();
  });

  test('should handle form validation in all browsers', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Submit form without filling fields
    await page.click('button[type="submit"]');

    // Wait for validation errors
    await page.waitForSelector('[data-testid="validation-error"]', { timeout: 5000 });

    // Verify validation errors are displayed
    const errors = await page.locator('[data-testid="validation-error"]');
    await expect(errors).toHaveCount.greaterThan(0);
  });

  test('should handle advanced search in all browsers', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Toggle advanced search
    await page.click('button[data-testid="toggle-advanced-search"]');

    // Verify advanced search form is displayed
    await expect(page.locator('form[data-testid="advanced-search-form"]')).toBeVisible();

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

  test('should handle real-time search in all browsers', async ({ page }) => {
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
  });

  test('should handle search history in all browsers', async ({ page }) => {
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

  test('should handle event comparison in all browsers', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter search query
    await page.fill('input[placeholder*="search"]', 'legal conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Click compare button on first event
    await page.click('[data-testid="event-card"]:first-child button[data-testid="compare-button"]');

    // Verify comparison modal is displayed
    await expect(page.locator('[data-testid="comparison-modal"]')).toBeVisible();
  });

  test('should handle user profile in all browsers', async ({ page }) => {
    // Navigate to profile page
    await page.click('a[href="/profile"]');
    await expect(page).toHaveURL('/profile');

    // Verify profile form is displayed
    await expect(page.locator('form[data-testid="profile-form"]')).toBeVisible();

    // Fill profile form
    await page.fill('input[name="firstName"]', 'John');
    await page.fill('input[name="lastName"]', 'Doe');
    await page.fill('input[name="email"]', 'john.doe@example.com');
    await page.selectOption('select[name="industry"]', 'legal');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success message
    await page.waitForSelector('[data-testid="success-message"]', { timeout: 10000 });

    // Verify success message is displayed
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should handle notification settings in all browsers', async ({ page }) => {
    // Navigate to notifications page
    await page.click('a[href="/notifications"]');
    await expect(page).toHaveURL('/notifications');

    // Verify notification settings form is displayed
    await expect(page.locator('form[data-testid="notification-settings-form"]')).toBeVisible();

    // Toggle notification settings
    await page.check('input[name="emailNotifications"]');
    await page.check('input[name="pushNotifications"]');
    await page.uncheck('input[name="smsNotifications"]');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for success message
    await page.waitForSelector('[data-testid="success-message"]', { timeout: 10000 });

    // Verify success message is displayed
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible();
  });

  test('should handle user activity tracking in all browsers', async ({ page }) => {
    // Navigate to activity page
    await page.click('a[href="/activity"]');
    await expect(page).toHaveURL('/activity');

    // Verify activity list is displayed
    await expect(page.locator('[data-testid="activity-list"]')).toBeVisible();

    // Verify activity items are displayed
    const activityItems = await page.locator('[data-testid="activity-item"]');
    await expect(activityItems).toHaveCount.greaterThan(0);
  });

  test('should handle event recommendations in all browsers', async ({ page }) => {
    // Navigate to recommendations page
    await page.click('a[href="/recommendations"]');
    await expect(page).toHaveURL('/recommendations');

    // Verify recommendations are displayed
    await expect(page.locator('[data-testid="recommendations-list"]')).toBeVisible();

    // Verify recommendation items are displayed
    const recommendationItems = await page.locator('[data-testid="recommendation-item"]');
    await expect(recommendationItems).toHaveCount.greaterThan(0);
  });

  test('should handle trending events in all browsers', async ({ page }) => {
    // Navigate to trending page
    await page.click('a[href="/trending"]');
    await expect(page).toHaveURL('/trending');

    // Verify trending events are displayed
    await expect(page.locator('[data-testid="trending-events-list"]')).toBeVisible();

    // Verify trending event items are displayed
    const trendingItems = await page.locator('[data-testid="trending-item"]');
    await expect(trendingItems).toHaveCount.greaterThan(0);
  });

  test('should handle admin dashboard in all browsers', async ({ page }) => {
    // Navigate to admin dashboard
    await page.click('a[href="/admin/dashboard"]');
    await expect(page).toHaveURL('/admin/dashboard');

    // Verify admin dashboard is displayed
    await expect(page.locator('[data-testid="admin-dashboard"]')).toBeVisible();

    // Verify dashboard sections are displayed
    await expect(page.locator('[data-testid="user-metrics"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-health"]')).toBeVisible();
    await expect(page.locator('[data-testid="performance-metrics"]')).toBeVisible();
  });

  test('should handle system health monitoring in all browsers', async ({ page }) => {
    // Navigate to system health page
    await page.click('a[href="/admin/health"]');
    await expect(page).toHaveURL('/admin/health');

    // Verify system health monitor is displayed
    await expect(page.locator('[data-testid="system-health-monitor"]')).toBeVisible();

    // Verify health status indicators are displayed
    await expect(page.locator('[data-testid="health-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="service-status"]')).toBeVisible();
  });

  test('should handle analytics dashboard in all browsers', async ({ page }) => {
    // Navigate to analytics page
    await page.click('a[href="/admin/analytics"]');
    await expect(page).toHaveURL('/admin/analytics');

    // Verify analytics dashboard is displayed
    await expect(page.locator('[data-testid="analytics-dashboard"]')).toBeVisible();

    // Verify analytics sections are displayed
    await expect(page.locator('[data-testid="user-analytics"]')).toBeVisible();
    await expect(page.locator('[data-testid="event-analytics"]')).toBeVisible();
    await expect(page.locator('[data-testid="search-analytics"]')).toBeVisible();
    await expect(page.locator('[data-testid="system-analytics"]')).toBeVisible();
  });

  test('should handle accessibility features in all browsers', async ({ page }) => {
    // Navigate to accessibility page
    await page.click('a[href="/accessibility"]');
    await expect(page).toHaveURL('/accessibility');

    // Verify accessibility features are displayed
    await expect(page.locator('[data-testid="accessibility-features"]')).toBeVisible();

    // Verify accessibility controls are displayed
    await expect(page.locator('[data-testid="font-size-control"]')).toBeVisible();
    await expect(page.locator('[data-testid="color-contrast-control"]')).toBeVisible();
    await expect(page.locator('[data-testid="keyboard-navigation-control"]')).toBeVisible();
  });

  test('should handle natural language search in all browsers', async ({ page }) => {
    // Navigate to natural language search page
    await page.click('a[href="/search"]');
    await expect(page).toHaveURL('/search');

    // Verify natural language search form is displayed
    await expect(page.locator('form[data-testid="nlp-search-form"]')).toBeVisible();

    // Enter natural language query
    await page.fill('textarea[name="query"]', 'Find legal conferences in Munich next month');

    // Submit search
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Verify results are displayed
    const results = await page.locator('[data-testid="event-card"]');
    await expect(results).toHaveCount.greaterThan(0);
  });

  test('should handle event predictions in all browsers', async ({ page }) => {
    // Navigate to predictions page
    await page.click('a[href="/predictions"]');
    await expect(page).toHaveURL('/predictions');

    // Verify predictions are displayed
    await expect(page.locator('[data-testid="predictions-list"]')).toBeVisible();

    // Verify prediction items are displayed
    const predictionItems = await page.locator('[data-testid="prediction-item"]');
    await expect(predictionItems).toHaveCount.greaterThan(0);
  });

  test('should handle error boundaries in all browsers', async ({ page }) => {
    // Navigate to a page that might trigger an error
    await page.goto('/nonexistent-page');

    // Verify error boundary is displayed
    await expect(page.locator('[data-testid="error-boundary"]')).toBeVisible();

    // Verify error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    // Verify retry button is displayed
    await expect(page.locator('button[data-testid="retry-button"]')).toBeVisible();
  });

  test('should handle loading states in all browsers', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter search query
    await page.fill('input[placeholder*="search"]', 'legal conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Verify loading state is displayed
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Verify loading state is hidden
    await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
  });

  test('should handle responsive design in all browsers', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();

    // Verify mobile navigation is displayed
    await expect(page.locator('[data-testid="mobile-nav"]')).toBeVisible();

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();

    // Verify tablet layout is displayed
    await expect(page.locator('[data-testid="tablet-layout"]')).toBeVisible();

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();

    // Verify desktop layout is displayed
    await expect(page.locator('[data-testid="desktop-layout"]')).toBeVisible();
  });
});
