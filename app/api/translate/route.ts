import { NextRequest, NextResponse } from 'next/server';

// Azure Translator API endpoint
const AZURE_TRANSLATOR_ENDPOINT = process.env.AZURE_TRANSLATOR_ENDPOINT || 'https://api.cognitive.microsofttranslator.com';
const AZURE_TRANSLATOR_KEY = process.env.AZURE_TRANSLATOR_KEY;
const AZURE_TRANSLATOR_REGION = process.env.AZURE_TRANSLATOR_REGION || 'global';

interface TranslationRequest {
  text: string;
  from: string;
  to: string;
}

interface AzureTranslation {
  text: string;
  to: string;
}

interface AzureTranslationResponse {
  translations: AzureTranslation[];
}

// POST /api/translate - Translate text using Azure Translator
export async function POST(request: NextRequest) {
  // Check if Azure credentials are configured
  if (!AZURE_TRANSLATOR_KEY) {
    return NextResponse.json(
      { error: 'Azure Translator API key not configured' },
      { status: 503 }
    );
  }

  try {
    const body: TranslationRequest = await request.json();
    const { text, from, to } = body;

    // Validate required fields
    if (!text || !from || !to) {
      return NextResponse.json(
        { error: 'Missing required fields: text, from, to' },
        { status: 400 }
      );
    }

    // Don't translate empty strings
    if (!text.trim()) {
      return NextResponse.json({ translation: '' });
    }

    // Build the Azure Translator API URL
    const url = new URL('/translate', AZURE_TRANSLATOR_ENDPOINT);
    url.searchParams.set('api-version', '3.0');
    url.searchParams.set('from', from);
    url.searchParams.set('to', to);

    // Make the request to Azure Translator
    const response = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': AZURE_TRANSLATOR_KEY,
        'Ocp-Apim-Subscription-Region': AZURE_TRANSLATOR_REGION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ text }]),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Azure Translator error:', response.status, errorText);
      
      if (response.status === 401) {
        return NextResponse.json(
          { error: 'Invalid Azure Translator API key' },
          { status: 503 }
        );
      }
      
      if (response.status === 403) {
        return NextResponse.json(
          { error: 'Azure Translator API access denied' },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: 'Translation service error' },
        { status: 502 }
      );
    }

    const data: AzureTranslationResponse[] = await response.json();
    
    // Extract the translated text
    const translation = data[0]?.translations[0]?.text || '';

    return NextResponse.json({ translation });
  } catch (error) {
    console.error('Translation failed:', error);
    return NextResponse.json(
      { error: 'Failed to translate text' },
      { status: 500 }
    );
  }
}
