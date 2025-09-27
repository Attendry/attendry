/**
 * Authentication Performance Tests
 * 
 * This file contains performance tests for the authentication functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication Performance', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load login page within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    const loadTime = Date.now() - startTime;
    
    // Performance budget: 2 seconds
    expect(loadTime).toBeLessThan(2000);
  });

  test('should perform login within performance budget', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    const startTime = Date.now();
    
    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect or success message
    await page.waitForSelector('[data-testid="login-success"], [data-testid="error-message"]', { timeout: 10000 });

    const loginTime = Date.now() - startTime;
    
    // Performance budget: 3 seconds
    expect(loginTime).toBeLessThan(3000);
  });

  test('should handle multiple concurrent logins', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    const startTime = Date.now();
    
    // Perform multiple login attempts
    const logins = [
      { email: 'test1@example.com', password: 'password1' },
      { email: 'test2@example.com', password: 'password2' },
      { email: 'test3@example.com', password: 'password3' },
      { email: 'test4@example.com', password: 'password4' },
      { email: 'test5@example.com', password: 'password5' }
    ];

    for (const login of logins) {
      await page.fill('input[name="email"]', login.email);
      await page.fill('input[name="password"]', login.password);
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="login-success"], [data-testid="error-message"]', { timeout: 10000 });
    }

    const totalTime = Date.now() - startTime;
    
    // Performance budget: 15 seconds for 5 logins
    expect(totalTime).toBeLessThan(15000);
  });

  test('should handle login with validation efficiently', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    const startTime = Date.now();
    
    // Submit form without filling fields
    await page.click('button[type="submit"]');

    // Wait for validation errors
    await page.waitForSelector('[data-testid="validation-error"]', { timeout: 5000 });

    const validationTime = Date.now() - startTime;
    
    // Performance budget: 1 second for validation
    expect(validationTime).toBeLessThan(1000);
  });

  test('should handle login with invalid credentials efficiently', async ({ page }) => {
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
    
    // Performance budget: 3 seconds for error handling
    expect(errorTime).toBeLessThan(3000);
  });

  test('should handle login with special characters efficiently', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    const startTime = Date.now();
    
    // Fill login form with special characters
    await page.fill('input[name="email"]', 'test+tag@example.com');
    await page.fill('input[name="password"]', 'password!@#$%^&*()');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect or success message
    await page.waitForSelector('[data-testid="login-success"], [data-testid="error-message"]', { timeout: 10000 });

    const loginTime = Date.now() - startTime;
    
    // Performance budget: 3 seconds for special characters
    expect(loginTime).toBeLessThan(3000);
  });

  test('should handle login with long credentials efficiently', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    const startTime = Date.now();
    
    // Fill login form with long credentials
    const longEmail = 'a'.repeat(100) + '@example.com';
    const longPassword = 'a'.repeat(100);
    await page.fill('input[name="email"]', longEmail);
    await page.fill('input[name="password"]', longPassword);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for validation error
    await page.waitForSelector('[data-testid="validation-error"]', { timeout: 5000 });

    const validationTime = Date.now() - startTime;
    
    // Performance budget: 2 seconds for validation
    expect(validationTime).toBeLessThan(2000);
  });

  test('should handle login with SQL injection attempt efficiently', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    const startTime = Date.now();
    
    // Fill login form with SQL injection attempt
    await page.fill('input[name="email"]', "'; DROP TABLE users; --");
    await page.fill('input[name="password"]', "'; DROP TABLE users; --");

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

    const errorTime = Date.now() - startTime;
    
    // Performance budget: 3 seconds for security handling
    expect(errorTime).toBeLessThan(3000);
  });

  test('should handle login with XSS attempt efficiently', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    const startTime = Date.now();
    
    // Fill login form with XSS attempt
    await page.fill('input[name="email"]', '<script>alert("xss")</script>');
    await page.fill('input[name="password"]', '<script>alert("xss")</script>');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

    const errorTime = Date.now() - startTime;
    
    // Performance budget: 3 seconds for security handling
    expect(errorTime).toBeLessThan(3000);
  });

  test('should handle login with network latency', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Simulate network latency
    await page.route('**/api/auth/login', route => {
      setTimeout(() => route.continue(), 1000);
    });

    const startTime = Date.now();
    
    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect or success message
    await page.waitForSelector('[data-testid="login-success"], [data-testid="error-message"]', { timeout: 10000 });

    const loginTime = Date.now() - startTime;
    
    // Performance budget: 4 seconds with network latency
    expect(loginTime).toBeLessThan(4000);
  });

  test('should handle login with network error efficiently', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Simulate network error
    await page.route('**/api/auth/login', route => route.abort());

    const startTime = Date.now();
    
    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

    const errorTime = Date.now() - startTime;
    
    // Performance budget: 3 seconds for network error
    expect(errorTime).toBeLessThan(3000);
  });

  test('should handle login with timeout efficiently', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Simulate timeout
    await page.route('**/api/auth/login', route => {
      setTimeout(() => route.continue(), 10000);
    });

    const startTime = Date.now();
    
    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for timeout error
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 15000 });

    const timeoutTime = Date.now() - startTime;
    
    // Performance budget: 12 seconds for timeout
    expect(timeoutTime).toBeLessThan(12000);
  });

  test('should handle login with memory constraints', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    const startTime = Date.now();
    
    // Perform multiple login attempts to test memory usage
    const logins = Array.from({ length: 20 }, (_, i) => ({
      email: `test${i}@example.com`,
      password: `password${i}`
    }));
    
    for (const login of logins) {
      await page.fill('input[name="email"]', login.email);
      await page.fill('input[name="password"]', login.password);
      await page.click('button[type="submit"]');
      await page.waitForSelector('[data-testid="login-success"], [data-testid="error-message"]', { timeout: 10000 });
    }

    const totalTime = Date.now() - startTime;
    
    // Performance budget: 60 seconds for 20 logins
    expect(totalTime).toBeLessThan(60000);
  });
});
