# 🔧 ESLint Fixes Guide

## Quick Fixes for Common Issues

### 1. Fix `any` Types

**Replace `any` with specific types:**

```typescript
// ❌ Before
async function loadProfile() {
  try {
    const r = await fetch("/api/profile/get");
    const json = await r.json();
    // ... rest of function
  } catch (e: any) {
    setMsg(e.message);
  }
}

// ✅ After
interface ProfileResponse {
  profile?: {
    full_name?: string;
    company?: string;
    competitors?: string[];
    icp_terms?: string[];
    industry_terms?: string[];
    use_in_basic_search?: boolean;
  };
}

async function loadProfile() {
  try {
    const r = await fetch("/api/profile/get");
    const json: ProfileResponse = await r.json();
    // ... rest of function
  } catch (e: unknown) {
    const error = e instanceof Error ? e.message : 'Unknown error';
    setMsg(error);
  }
}
```

### 2. Remove Unused Variables

**Simply delete unused variables:**

```typescript
// ❌ Before
const [collectionHistory, setCollectionHistory] = useState<any[]>([]);

// ✅ After
// Remove the line entirely if not used
```

### 3. Fix React Unescaped Entities

**Escape quotes and apostrophes:**

```jsx
// ❌ Before
<p>He said "Hello" to me</p>
<p>Don't do this</p>

// ✅ After
<p>He said &quot;Hello&quot; to me</p>
<p>Don&apos;t do this</p>
```

### 4. Use `const` Instead of `let`

```typescript
// ❌ Before
let extractVersion = "v1";
let trace = [];

// ✅ After
const extractVersion = "v1";
const trace = [];
```

## Automated Fixes

### Run ESLint with Auto-fix:
```bash
npm run lint -- --fix
```

### Fix TypeScript Issues:
```bash
npx tsc --noEmit
```

## Gradual Approach

1. **Start with warnings** (what we did)
2. **Fix issues file by file**
3. **Enable stricter rules gradually**
4. **Set up pre-commit hooks** to prevent new issues

## Benefits of Fixing

- **Type Safety**: Fewer runtime errors
- **Code Quality**: More maintainable code
- **Team Standards**: Consistent code style
- **Professional**: Industry best practices
- **Debugging**: Easier to find and fix issues

