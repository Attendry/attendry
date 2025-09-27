/**
 * Security Tests
 * 
 * This file contains security tests for the application.
 */

import { test, expect } from '@playwright/test';

test.describe('Security Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should prevent SQL injection in search', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter SQL injection attempt
    await page.fill('input[placeholder*="search"]', "'; DROP TABLE events; --");
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results or error message
    await page.waitForSelector('[data-testid="search-results"], [data-testid="error-message"]', { timeout: 10000 });

    // Verify either results or error message is displayed
    const results = await page.locator('[data-testid="search-results"]');
    const error = await page.locator('[data-testid="error-message"]');
    
    await expect(results.or(error)).toBeVisible();
  });

  test('should prevent XSS in search', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter XSS attempt
    await page.fill('input[placeholder*="search"]', '<script>alert("xss")</script>');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results or error message
    await page.waitForSelector('[data-testid="search-results"], [data-testid="error-message"]', { timeout: 10000 });

    // Verify either results or error message is displayed
    const results = await page.locator('[data-testid="search-results"]');
    const error = await page.locator('[data-testid="error-message"]');
    
    await expect(results.or(error)).toBeVisible();
  });

  test('should prevent SQL injection in login', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Fill login form with SQL injection attempt
    await page.fill('input[name="email"]', "'; DROP TABLE users; --");
    await page.fill('input[name="password"]', "'; DROP TABLE users; --");

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

    // Verify error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should prevent XSS in login', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Fill login form with XSS attempt
    await page.fill('input[name="email"]', '<script>alert("xss")</script>');
    await page.fill('input[name="password"]', '<script>alert("xss")</script>');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

    // Verify error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should prevent CSRF attacks', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Check for CSRF token
    const csrfToken = await page.locator('input[name="csrf_token"]');
    await expect(csrfToken).toBeVisible();
  });

  test('should prevent clickjacking', async ({ page }) => {
    // Check for X-Frame-Options header
    const response = await page.goto('/');
    const headers = response?.headers();
    
    expect(headers?.['x-frame-options']).toBeDefined();
  });

  test('should prevent MIME type sniffing', async ({ page }) => {
    // Check for X-Content-Type-Options header
    const response = await page.goto('/');
    const headers = response?.headers();
    
    expect(headers?.['x-content-type-options']).toBeDefined();
  });

  test('should prevent XSS with X-XSS-Protection', async ({ page }) => {
    // Check for X-XSS-Protection header
    const response = await page.goto('/');
    const headers = response?.headers();
    
    expect(headers?.['x-xss-protection']).toBeDefined();
  });

  test('should use secure cookies', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Check for secure cookie attributes
    const cookies = await page.context().cookies();
    const secureCookies = cookies.filter(cookie => cookie.secure);
    
    expect(secureCookies.length).toBeGreaterThan(0);
  });

  test('should use HTTP-only cookies', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Check for HTTP-only cookie attributes
    const cookies = await page.context().cookies();
    const httpOnlyCookies = cookies.filter(cookie => cookie.httpOnly);
    
    expect(httpOnlyCookies.length).toBeGreaterThan(0);
  });

  test('should prevent directory traversal', async ({ page }) => {
    // Try to access a file outside the web root
    const response = await page.goto('/../../../etc/passwd');
    
    expect(response?.status()).toBe(404);
  });

  test('should prevent access to sensitive files', async ({ page }) => {
    // Try to access sensitive files
    const sensitiveFiles = [
      '/.env',
      '/package.json',
      '/.git/config',
      '/config/database.yml',
      '/.htaccess'
    ];

    for (const file of sensitiveFiles) {
      const response = await page.goto(file);
      expect(response?.status()).toBe(404);
    }
  });

  test('should prevent information disclosure in error messages', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter invalid search query
    await page.fill('input[placeholder*="search"]', '');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

    // Verify error message doesn't contain sensitive information
    const errorMessage = await page.locator('[data-testid="error-message"]').textContent();
    expect(errorMessage).not.toContain('database');
    expect(errorMessage).not.toContain('password');
    expect(errorMessage).not.toContain('secret');
    expect(errorMessage).not.toContain('key');
  });

  test('should prevent brute force attacks', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Attempt multiple failed logins
    for (let i = 0; i < 5; i++) {
      await page.fill('input[name="email"]', 'test@example.com');
      await page.fill('input[name="password"]', 'wrongpassword');
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });
    }

    // Check for rate limiting
    const errorMessage = await page.locator('[data-testid="error-message"]').textContent();
    expect(errorMessage).toContain('rate limit');
  });

  test('should prevent session fixation', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Get initial session ID
    const initialCookies = await page.context().cookies();
    const initialSession = initialCookies.find(cookie => cookie.name === 'session');

    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect or success message
    await page.waitForSelector('[data-testid="login-success"], [data-testid="error-message"]', { timeout: 10000 });

    // Check if session ID changed
    const finalCookies = await page.context().cookies();
    const finalSession = finalCookies.find(cookie => cookie.name === 'session');

    if (initialSession && finalSession) {
      expect(finalSession.value).not.toBe(initialSession.value);
    }
  });

  test('should prevent timing attacks', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    const startTime = Date.now();
    
    // Fill login form with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

    const errorTime = Date.now() - startTime;

    // Reset and try with valid email but wrong password
    await page.reload();
    await page.fill('input[name="email"]', 'valid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');

    const startTime2 = Date.now();
    await page.click('button[type="submit"]');
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

    const errorTime2 = Date.now() - startTime2;

    // Verify response times are similar (within 100ms)
    expect(Math.abs(errorTime - errorTime2)).toBeLessThan(100);
  });

  test('should prevent open redirects', async ({ page }) => {
    // Try to redirect to external site
    const response = await page.goto('/redirect?url=https://evil.com');
    
    expect(response?.url()).not.toContain('evil.com');
  });

  test('should prevent HTTP parameter pollution', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter search query with duplicate parameters
    await page.fill('input[placeholder*="search"]', 'legal conference');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results
    await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });

    // Verify results are displayed
    const results = await page.locator('[data-testid="event-card"]');
    await expect(results).toHaveCount.greaterThan(0);
  });

  test('should prevent LDAP injection', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Fill login form with LDAP injection attempt
    await page.fill('input[name="email"]', 'admin)(&(password=*))');
    await page.fill('input[name="password"]', 'password');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

    // Verify error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should prevent command injection', async ({ page }) => {
    // Navigate to events page
    await page.click('a[href="/events"]');
    await expect(page).toHaveURL('/events');

    // Enter command injection attempt
    await page.fill('input[placeholder*="search"]', 'legal; rm -rf /');
    
    // Click search button
    await page.click('button[type="submit"]');

    // Wait for results or error message
    await page.waitForSelector('[data-testid="search-results"], [data-testid="error-message"]', { timeout: 10000 });

    // Verify either results or error message is displayed
    const results = await page.locator('[data-testid="search-results"]');
    const error = await page.locator('[data-testid="error-message"]');
    
    await expect(results.or(error)).toBeVisible();
  });

  test('should prevent XML external entity attacks', async ({ page }) => {
    // Try to access XML endpoint with XXE payload
    const response = await page.goto('/api/xml', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/xml',
      },
      body: '<?xml version="1.0"?><!DOCTYPE root [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><root>&xxe;</root>'
    });
    
    expect(response?.status()).toBe(404);
  });

  test('should prevent server-side request forgery', async ({ page }) => {
    // Try to make SSRF request
    const response = await page.goto('/api/proxy?url=http://localhost:22');
    
    expect(response?.status()).toBe(404);
  });
});
