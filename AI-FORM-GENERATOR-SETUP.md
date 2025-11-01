# AI Form Generator Setup Guide

## Overview
The AI Form Generator uses OpenAI's GPT-4o-mini model to automatically generate forms based on natural language descriptions.

## Requirements

### 1. OpenAI API Key (Required)
- **Service**: OpenAI Platform
- **Model Used**: GPT-4o-mini
- **Get API Key**: https://platform.openai.com/api-keys
- **Environment Variable**: `OPENAI_API_KEY`

### 2. Upstash Redis (Optional - for rate limiting)
- **Service**: Upstash Redis
- **Purpose**: Rate limiting (5 requests per 60 seconds in production)
- **Get Started**: https://upstash.com/
- **Environment Variables**:
  - `UPSTASH_REDIS_REST_URL`
  - `UPSTASH_REDIS_REST_TOKEN`

**Note**: Rate limiting is **disabled in development mode**, so Upstash is optional for local testing.

## Setup Instructions

### Step 1: Get OpenAI API Key
1. Visit https://platform.openai.com/api-keys
2. Sign in or create an OpenAI account
3. Click "Create new secret key"
4. Give it a name (e.g., "TinyForm Development")
5. Copy the API key (starts with `sk-`)

### Step 2: Configure Environment Variables
Edit `/apps/web/.env.local`:

```bash
# OpenAI (Required for AI form generation)
OPENAI_API_KEY=sk-your-actual-api-key-here
```

### Step 3: Restart Development Server
```bash
# Stop current server (Ctrl+C)
# Then restart
bun dev
```

### Step 4: Test the AI Generator
1. Navigate to http://localhost:3000/ai-form-generator
2. Enter a prompt like: "Create a contact form with name, email, phone, and message fields"
3. Click "Generate Form"
4. Watch as AI creates your form!

## How It Works

### AI Generation Flow
1. User enters a natural language prompt
2. Frontend sends request to `/api/generate`
3. Backend calls OpenAI GPT-4o-mini with structured output schema
4. AI returns form schema in JSON format
5. Frontend renders the generated form elements
6. User can edit, save, and publish the generated form

### Example Prompts

**Simple Contact Form**:
```
Create a contact form with name, email, and message
```

**Job Application**:
```
Build a job application form with personal info, resume upload, cover letter, and references
```

**Event Registration**:
```
Design an event registration form with attendee details, dietary preferences, and payment section
```

**Survey Form**:
```
Generate a customer satisfaction survey with rating scales and feedback fields
```

## Rate Limiting

### Development
- Rate limiting is **disabled** in development mode
- No Upstash Redis required for local testing

### Production
- Rate limit: **5 requests per 60 seconds** per IP address
- Uses Upstash Redis for tracking
- Returns 429 status when limit exceeded

## Troubleshooting

### Error: "Incorrect API key provided"
**Solution**:
- Check that your OpenAI API key is correctly set in `.env.local`
- Ensure there are no extra spaces or quotes around the key
- Verify the key is active on OpenAI platform

### Error: "Rate limit exceeded"
**Solution**:
- In development, rate limiting should be disabled
- In production, wait 60 seconds before trying again
- Configure Upstash Redis if needed

### Form Not Generating
**Solution**:
1. Check browser console for errors
2. Verify OPENAI_API_KEY is set correctly
3. Restart the development server
4. Check if you have sufficient OpenAI API credits

## Cost Estimation

The AI form generator uses GPT-4o-mini, which is very cost-effective:

- **Model**: GPT-4o-mini
- **Input**: ~$0.15 per 1M tokens
- **Output**: ~$0.60 per 1M tokens
- **Typical Form Generation**: ~500-1000 tokens total
- **Estimated Cost Per Generation**: < $0.001 (less than a tenth of a cent)

## Features

- ✅ Natural language to form conversion
- ✅ Supports all form element types
- ✅ Multi-step form generation
- ✅ Smart field validation
- ✅ Form description and title generation
- ✅ Streaming response for real-time updates
- ✅ Error handling and retry logic

## Security Notes

- Never commit your `.env.local` file to git
- The `.env.local` file is already in `.gitignore`
- API keys are only used server-side (in API routes)
- Rate limiting protects against abuse in production

## Next Steps

After generating a form:
1. **Edit**: Customize fields, labels, and validation
2. **Publish**: Make the form publicly available
3. **Embed**: Get embed code for your website
4. **Track**: View submissions and analytics

---

*For more information, see the main [CLAUDE.md](/CLAUDE.md) documentation.*
