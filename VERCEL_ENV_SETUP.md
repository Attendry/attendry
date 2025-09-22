# 🔧 Vercel Environment Variables Setup

## Required Environment Variables for Authentication

Add these to your Vercel project settings:

### 1. Site URL (Required for Auth)
```
NEXT_PUBLIC_SITE_URL=https://attendry-6o26.vercel.app
```

## How to Add Environment Variables in Vercel:

1. **Go to your Vercel Dashboard**
2. **Select your project** (attendry)
3. **Go to Settings → Environment Variables**
4. **Add the variable above**
5. **Redeploy your project**

## Supabase Configuration Required:

1. **Go to Supabase Dashboard**
2. **Navigate to Authentication → URL Configuration**
3. **Set Site URL**: `https://attendry-6o26.vercel.app`
4. **Add Redirect URL**: `https://attendry-6o26.vercel.app/auth/callback`

## After Setup:

- Magic links will work correctly
- Authentication will redirect to your Vercel domain
- Users can sign in/out properly
