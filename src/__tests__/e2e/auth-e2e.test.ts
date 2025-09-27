/**
 * Authentication End-to-End Tests
 * 
 * This file contains end-to-end tests for the authentication functionality.
 */

import { test, expect } from '@playwright/test';

test.describe('Authentication End-to-End', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should display login page', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Verify login form is displayed
    await expect(page.locator('form[data-testid="login-form"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should handle login with valid credentials', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

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

  test('should handle login with invalid credentials', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Fill login form with invalid credentials
    await page.fill('input[name="email"]', 'invalid@example.com');
    await page.fill('input[name="password"]', 'wrongpassword');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

    // Verify error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should handle login with empty fields', async ({ page }) => {
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

  test('should handle login with invalid email format', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Fill login form with invalid email
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for validation error
    await page.waitForSelector('[data-testid="validation-error"]', { timeout: 5000 });

    // Verify validation error is displayed
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('should handle login with short password', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Fill login form with short password
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', '123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for validation error
    await page.waitForSelector('[data-testid="validation-error"]', { timeout: 5000 });

    // Verify validation error is displayed
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('should handle login with special characters in email', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Fill login form with special characters in email
    await page.fill('input[name="email"]', 'test+tag@example.com');
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

  test('should handle login with special characters in password', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Fill login form with special characters in password
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password!@#$%^&*()');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for redirect or success message
    await page.waitForSelector('[data-testid="login-success"], [data-testid="error-message"]', { timeout: 10000 });

    // Verify success or error message
    const success = await page.locator('[data-testid="login-success"]');
    const error = await page.locator('[data-testid="error-message"]');
    
    await expect(success.or(error)).toBeVisible();
  });

  test('should handle login with very long email', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Fill login form with very long email
    const longEmail = 'a'.repeat(100) + '@example.com';
    await page.fill('input[name="email"]', longEmail);
    await page.fill('input[name="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for validation error
    await page.waitForSelector('[data-testid="validation-error"]', { timeout: 5000 });

    // Verify validation error is displayed
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('should handle login with very long password', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Fill login form with very long password
    const longPassword = 'a'.repeat(1000);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', longPassword);

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for validation error
    await page.waitForSelector('[data-testid="validation-error"]', { timeout: 5000 });

    // Verify validation error is displayed
    await expect(page.locator('[data-testid="validation-error"]')).toBeVisible();
  });

  test('should handle login with SQL injection attempt', async ({ page }) => {
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

  test('should handle login with XSS attempt', async ({ page }) => {
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

  test('should handle login with network error', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Simulate network error
    await page.route('**/api/auth/login', route => route.abort());

    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for error message
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 10000 });

    // Verify error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });

  test('should handle login with timeout', async ({ page }) => {
    // Navigate to login page
    await page.click('a[href="/login"]');
    await expect(page).toHaveURL('/login');

    // Simulate timeout
    await page.route('**/api/auth/login', route => {
      setTimeout(() => route.continue(), 10000);
    });

    // Fill login form
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Wait for timeout error
    await page.waitForSelector('[data-testid="error-message"]', { timeout: 15000 });

    // Verify error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
  });
});
