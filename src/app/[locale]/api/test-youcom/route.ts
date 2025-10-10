// src/app/[locale]/api/test-youcom/route.ts
// Test route to diagnose You.com API integration

import { NextRequest, NextResponse } from 'next/server';
import { testYouComConnection, getYouComStatus, searchYouComForLegal } from '@/lib/youComSearchUtils';

export async function GET(request: NextRequest) {
  console.log('🧪 Starting You.com API diagnostic test...');
  
  const results = {
    timestamp: new Date().toISOString(),
    environment: {
      nodeEnv: process.env.NODE_ENV,
      hasYouComKey: !!process.env.You_com_api,
      hasYouComKeyAlt: !!process.env.YOUCOM_API_KEY,
      keyPrefix: process.env.You_com_api?.substring(0, 10) || process.env.YOUCOM_API_KEY?.substring(0, 10) || 'NOT_SET'
    },
    status: null as any,
    connectionTest: null as any,
    sampleSearch: null as any,
    errors: [] as string[]
  };
  
  try {
    // 1. Get status
    console.log('📊 Checking You.com status...');
    results.status = getYouComStatus();
    
    // 2. Test connection
    console.log('🔌 Testing You.com connection...');
    results.connectionTest = await testYouComConnection();
    
    // 3. Try a sample search if connection successful
    if (results.connectionTest.success) {
      console.log('🔍 Performing sample search...');
      
      const sampleQuery = 'σύμβαση πώλησης ακινήτου τύπος';
      const searchResult = await searchYouComForLegal(sampleQuery, {
        keywords: ['συμβολαιογραφικό', 'έγγραφο'],
        detectedLaws: ['ΑΚ 369', 'ΑΚ 1192']
      });
      
      results.sampleSearch = {
        query: sampleQuery,
        success: searchResult.success,
        totalResults: searchResult.metadata.totalResults,
        legislation: searchResult.legislation?.length || 0,
        jurisprudence: searchResult.jurisprudence?.length || 0,
        developments: searchResult.developments?.length || 0,
        error: searchResult.metadata.error,
        sampleResult: searchResult.legislation?.[0] || searchResult.developments?.[0] || null
      };
    }
    
  } catch (error: any) {
    console.error('❌ Test error:', error);
    results.errors.push(error.message || error.toString());
  }
  
  // Determine overall health
  const isHealthy = results.connectionTest?.success && results.sampleSearch?.success;
  
  // Format response
  const response = {
    healthy: isHealthy,
    message: isHealthy 
      ? `✅ You.com API is working! Found ${results.sampleSearch?.totalResults || 0} results`
      : `❌ You.com API issues detected`,
    details: results,
    recommendations: [] as string[]
  };
  
  // Add recommendations based on issues
  if (!results.environment.hasYouComKey && !results.environment.hasYouComKeyAlt) {
    response.recommendations.push('Set You_com_api or YOUCOM_API_KEY in your .env file');
  }
  
  if (results.connectionTest && !results.connectionTest.success) {
    if (results.connectionTest.message.includes('Invalid API key')) {
      response.recommendations.push('Your API key appears to be invalid. Check your You.com dashboard.');
    } else if (results.connectionTest.message.includes('Payment required')) {
      response.recommendations.push('Your You.com account may need payment or credits.');
    } else if (results.connectionTest.message.includes('Rate limit')) {
      response.recommendations.push('You have hit the rate limit. Wait a minute and try again.');
    }
  }
  
  if (results.sampleSearch && !results.sampleSearch.success) {
    response.recommendations.push('Search is failing. Check the error message for details.');
  }
  
  console.log('🧪 Test complete:', response.message);
  
  return NextResponse.json(response, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query = 'test legal query νόμος' } = body;
    
    console.log('🧪 Custom You.com test with query:', query);
    
    const result = await searchYouComForLegal(query);
    
    return NextResponse.json({
      success: result.success,
      query,
      results: {
        total: result.metadata.totalResults,
        legislation: result.legislation?.length || 0,
        jurisprudence: result.jurisprudence?.length || 0,
        developments: result.developments?.length || 0
      },
      error: result.metadata.error,
      sample: result.legislation?.[0] || result.developments?.[0] || null,
      metadata: result.metadata
    });
    
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message || 'Test failed'
    }, { status: 500 });
  }
}
