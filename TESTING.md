# Testing Guide

This document provides a comprehensive guide to testing the Attendry application.

## Overview

The application uses a multi-layered testing approach:

- **Unit Tests**: Test individual components and functions
- **Integration Tests**: Test API endpoints and service interactions
- **End-to-End Tests**: Test complete user workflows
- **Performance Tests**: Test application performance under load
- **Security Tests**: Test security vulnerabilities and protections
- **Cross-Browser Tests**: Test compatibility across different browsers

## Test Structure

```
src/__tests__/
├── components/           # Component unit tests
├── integration/          # Integration tests
├── e2e/                 # End-to-end tests
├── performance/         # Performance tests
├── security/            # Security tests
└── cross-browser/       # Cross-browser tests
```

## Running Tests

### Unit Tests (Jest)

```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

### End-to-End Tests (Playwright)

```bash
# Run all E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode
npm run test:e2e:headed

# Debug E2E tests
npm run test:e2e:debug
```

### Performance Tests

```bash
# Run performance tests
npm run test:performance

# Run performance tests in watch mode
npm run test:performance:watch
```

## Test Categories

### 1. Unit Tests

Unit tests focus on testing individual components and functions in isolation.

**Location**: `src/__tests__/components/`

**Examples**:
- `EventCard.test.tsx` - Tests the EventCard component
- `AdvancedSearch.test.tsx` - Tests the AdvancedSearch component
- `UserProfile.test.tsx` - Tests the UserProfile component

**Key Features**:
- Component rendering
- User interactions
- State management
- Props handling
- Error boundaries

### 2. Integration Tests

Integration tests verify that different parts of the application work together correctly.

**Location**: `src/__tests__/integration/`

**Examples**:
- `search-flow.test.ts` - Tests the complete search workflow
- `auth-flow.test.ts` - Tests the authentication workflow

**Key Features**:
- API endpoint testing
- Service integration
- Database interactions
- Cache behavior
- Error handling

### 3. End-to-End Tests

E2E tests simulate real user interactions with the application.

**Location**: `src/__tests__/e2e/`

**Examples**:
- `search-e2e.test.ts` - Tests search functionality from user perspective
- `auth-e2e.test.ts` - Tests authentication from user perspective

**Key Features**:
- Complete user workflows
- UI interactions
- Form submissions
- Navigation
- Error handling

### 4. Performance Tests

Performance tests ensure the application meets performance requirements.

**Location**: `src/__tests__/performance/`

**Examples**:
- `search-performance.test.ts` - Tests search performance
- `auth-performance.test.ts` - Tests authentication performance

**Key Features**:
- Load time testing
- Response time testing
- Memory usage testing
- Concurrent user testing
- Performance budgets

### 5. Security Tests

Security tests verify that the application is protected against common vulnerabilities.

**Location**: `src/__tests__/security/`

**Examples**:
- `security.test.ts` - Tests security protections

**Key Features**:
- SQL injection prevention
- XSS prevention
- CSRF protection
- Authentication security
- Input validation

### 6. Cross-Browser Tests

Cross-browser tests ensure compatibility across different browsers and devices.

**Location**: `src/__tests__/cross-browser/`

**Examples**:
- `cross-browser.test.ts` - Tests cross-browser compatibility

**Key Features**:
- Browser compatibility
- Device compatibility
- Responsive design
- Feature support

## Test Configuration

### Jest Configuration

The Jest configuration is defined in `jest.config.js`:

- **Test Environment**: jsdom for React components
- **Setup Files**: `jest.setup.js` for global test setup
- **Coverage**: HTML and LCOV reports
- **Module Mapping**: Path aliases for imports
- **Transform**: Babel for TypeScript/JSX

### Playwright Configuration

The Playwright configuration is defined in `playwright.config.ts`:

- **Test Directory**: `./src/__tests__`
- **Browsers**: Chrome, Firefox, Safari, Edge
- **Devices**: Desktop and mobile viewports
- **Reporter**: HTML, JSON, and JUnit reports
- **Screenshots**: On failure
- **Videos**: On failure

## Test Utilities

### Test Utils

The `src/lib/testing/test-utils.tsx` file provides common test utilities:

- **Mock Data**: Predefined test data
- **Mock Functions**: Common mock implementations
- **Test Helpers**: Utility functions for tests
- **Setup Functions**: Common test setup

### Mock Data

Common mock data includes:

- `mockEventData` - Sample event data
- `mockUserProfile` - Sample user profile
- `mockSearchResults` - Sample search results
- `mockApiResponse` - Sample API responses

## Best Practices

### 1. Test Organization

- Group related tests in describe blocks
- Use descriptive test names
- Follow the AAA pattern (Arrange, Act, Assert)
- Keep tests focused and atomic

### 2. Mocking

- Mock external dependencies
- Use realistic mock data
- Avoid over-mocking
- Test error scenarios

### 3. Assertions

- Use specific assertions
- Test both positive and negative cases
- Verify error messages
- Check side effects

### 4. Performance

- Set appropriate timeouts
- Use performance budgets
- Test under load
- Monitor memory usage

### 5. Security

- Test input validation
- Verify authentication
- Check authorization
- Test error handling

## Continuous Integration

### GitHub Actions

The CI pipeline runs:

1. **Linting**: ESLint checks
2. **Unit Tests**: Jest tests with coverage
3. **E2E Tests**: Playwright tests
4. **Performance Tests**: Performance benchmarks
5. **Security Tests**: Security vulnerability checks

### Test Reports

Test results are available in:

- **HTML Reports**: `test-results/` directory
- **Coverage Reports**: `coverage/` directory
- **Performance Reports**: `performance-results/` directory

## Debugging Tests

### Unit Tests

```bash
# Run specific test file
npm test -- EventCard.test.tsx

# Run tests with verbose output
npm test -- --verbose

# Run tests in debug mode
npm test -- --detectOpenHandles
```

### E2E Tests

```bash
# Run specific test file
npm run test:e2e -- search-e2e.test.ts

# Run tests in headed mode
npm run test:e2e:headed

# Debug specific test
npm run test:e2e:debug -- search-e2e.test.ts
```

### Performance Tests

```bash
# Run performance tests with detailed output
npm run test:performance -- --verbose

# Run specific performance test
npm run test:performance -- --grep "search performance"
```

## Troubleshooting

### Common Issues

1. **Test Timeouts**: Increase timeout values for slow tests
2. **Mock Issues**: Ensure mocks are properly configured
3. **Environment Variables**: Set required environment variables
4. **Dependencies**: Install all required test dependencies

### Debug Tips

1. **Console Logs**: Use `console.log` for debugging
2. **Test Isolation**: Ensure tests don't depend on each other
3. **Cleanup**: Properly clean up after tests
4. **Async Handling**: Use proper async/await patterns

## Contributing

When adding new tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Add appropriate mocks
4. Include both positive and negative test cases
5. Update this documentation if needed

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library Documentation](https://testing-library.com/docs/)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
