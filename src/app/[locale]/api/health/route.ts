import { NextRequest, NextResponse } from 'next/server'
import { Client } from '@elastic/elasticsearch'
import db from '@/db/drizzle'
import { sql } from 'drizzle-orm'

// Health check types
interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy'
  checks: {
    database: boolean
    elasticsearch: boolean
    perplexity: boolean
    deepseek: boolean
    voyage: boolean
    environment: boolean
    youcom: boolean
  }
  details: {
    database: string
    elasticsearch: string
    perplexity: string
    deepseek: string
    voyage: string
    environment: string
    youcom: string
  }
  timestamp: string
  responseTime: number
}

// Check database connectivity
async function checkDatabase(): Promise<{ healthy: boolean; details: string }> {
  try {
    const startTime = Date.now()
    const result = await db.execute(sql`SELECT 1`)
    const responseTime = Date.now() - startTime
    
    if (responseTime > 5000) {
      return { healthy: false, details: `Slow response: ${responseTime}ms` }
    }
    
    return { healthy: true, details: `Connected (${responseTime}ms)` }
  } catch (error) {
    console.error('Database health check failed:', error)
    return { 
      healthy: false, 
      details: error instanceof Error ? error.message : 'Connection failed' 
    }
  }
}

// Check Elasticsearch connectivity
async function checkElasticsearch(): Promise<{ healthy: boolean; details: string }> {
  try {
    const client = new Client({
      cloud: { id: process.env.ELASTICSEARCH_CLOUD_ID! },
      auth: { apiKey: process.env.ELASTICSEARCH_API_KEY! },
      maxRetries: 1,
      requestTimeout: 5000,
    })
    
    const startTime = Date.now()
    const health = await client.cluster.health()
    const responseTime = Date.now() - startTime
    
    if (health.status === 'red') {
      return { healthy: false, details: `Cluster status: ${health.status}` }
    }
    
    if (responseTime > 5000) {
      return { healthy: false, details: `Slow response: ${responseTime}ms` }
    }
    
    return { 
      healthy: true, 
      details: `Status: ${health.status} (${responseTime}ms)` 
    }
  } catch (error) {
    console.error('Elasticsearch health check failed:', error)
    return { 
      healthy: false, 
      details: error instanceof Error ? error.message : 'Connection failed' 
    }
  }
}

// Check Perplexity API
async function checkPerplexity(): Promise<{ healthy: boolean; details: string }> {
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY
  
  if (!PERPLEXITY_API_KEY) {
    return { healthy: false, details: 'API key not configured' }
  }
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const startTime = Date.now()
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [{ role: 'user', content: 'health check' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    if (!response.ok) {
      return { 
        healthy: false, 
        details: `HTTP ${response.status}: ${response.statusText}` 
      }
    }
    
    if (responseTime > 10000) {
      return { healthy: false, details: `Slow response: ${responseTime}ms` }
    }
    
    return { healthy: true, details: `Connected (${responseTime}ms)` }
  } catch (error) {
    console.error('Perplexity health check failed:', error)
    return { 
      healthy: false, 
      details: error instanceof Error ? error.message : 'Connection failed' 
    }
  }
}

// Check DeepSeek API
async function checkDeepSeek(): Promise<{ healthy: boolean; details: string }> {
  const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY
  
  if (!DEEPSEEK_API_KEY) {
    return { healthy: false, details: 'API key not configured' }
  }
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const startTime = Date.now()
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'health check' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    if (!response.ok) {
      return { 
        healthy: false, 
        details: `HTTP ${response.status}: ${response.statusText}` 
      }
    }
    
    if (responseTime > 10000) {
      return { healthy: false, details: `Slow response: ${responseTime}ms` }
    }
    
    return { healthy: true, details: `Connected (${responseTime}ms)` }
  } catch (error) {
    console.error('DeepSeek health check failed:', error)
    return { 
      healthy: false, 
      details: error instanceof Error ? error.message : 'Connection failed' 
    }
  }
}
async function checkYouCom(): Promise<{ healthy: boolean; details: string }> {
  const YOUCOM_API_KEY = process.env.You_com_api
  
  if (!YOUCOM_API_KEY) {
    return { healthy: false, details: 'API key not configured' }
  }
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const startTime = Date.now()
    const response = await fetch('https://api.you.com/v2/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${YOUCOM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: 'health check test',
        count: 1,
      }),
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    if (!response.ok) {
      return { 
        healthy: false, 
        details: `HTTP ${response.status}: ${response.statusText}` 
      }
    }
    
    if (responseTime > 10000) {
      return { healthy: false, details: `Slow response: ${responseTime}ms` }
    }
    
    return { healthy: true, details: `Connected (${responseTime}ms)` }
  } catch (error) {
    console.error('You.com health check failed:', error)
    return { 
      healthy: false, 
      details: error instanceof Error ? error.message : 'Connection failed' 
    }
  }
}
// Check Voyage AI
async function checkVoyage(): Promise<{ healthy: boolean; details: string }> {
  const VOYAGE_API_KEY = process.env.VOYAGE_AI_KEY
  
  if (!VOYAGE_API_KEY) {
    return { healthy: false, details: 'API key not configured' }
  }
  
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)
    
    const startTime = Date.now()
    const response = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VOYAGE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'voyage-3-large',
        input: ['health check'],
      }),
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)
    const responseTime = Date.now() - startTime
    
    if (!response.ok) {
      return { 
        healthy: false, 
        details: `HTTP ${response.status}: ${response.statusText}` 
      }
    }
    
    if (responseTime > 5000) {
      return { healthy: false, details: `Slow response: ${responseTime}ms` }
    }
    
    return { healthy: true, details: `Connected (${responseTime}ms)` }
  } catch (error) {
    console.error('Voyage health check failed:', error)
    return { 
      healthy: false, 
      details: error instanceof Error ? error.message : 'Connection failed' 
    }
  }
}

// Check Environment Variables
async function checkEnvironment(): Promise<{ healthy: boolean; details: string }> {
  const requiredVars = [
    'DATABASE_URL',
    'ELASTICSEARCH_CLOUD_ID',
    'ELASTICSEARCH_API_KEY',
    'PERPLEXITY_API_KEY',
    'DEEPSEEK_API_KEY',
    'VOYAGE_AI_KEY'
  ]
  
  const missing = requiredVars.filter(varName => !process.env[varName])
  
  if (missing.length > 0) {
    return { 
      healthy: false, 
      details: `Missing: ${missing.join(', ')}` 
    }
  }
  
  return { healthy: true, details: 'All required variables present' }
}

// Main health check handler
export async function GET(req: NextRequest): Promise<NextResponse> {
  const startTime = Date.now()
  
  try {
    // Run all health checks in parallel
    const [dbCheck, esCheck, perplexityCheck, deepseekCheck, voyageCheck, envCheck, youComCheck] = await Promise.allSettled([
      checkDatabase(),
      checkElasticsearch(),
      checkPerplexity(),
      checkDeepSeek(),
      checkVoyage(),
      checkEnvironment(),
      checkYouCom(),
    ])
    
    // Extract results safely
    const dbResult = dbCheck.status === 'fulfilled' ? dbCheck.value : { healthy: false, details: 'Check failed' }
    const esResult = esCheck.status === 'fulfilled' ? esCheck.value : { healthy: false, details: 'Check failed' }
    const perplexityResult = perplexityCheck.status === 'fulfilled' ? perplexityCheck.value : { healthy: false, details: 'Check failed' }
    const deepseekResult = deepseekCheck.status === 'fulfilled' ? deepseekCheck.value : { healthy: false, details: 'Check failed' }
    const voyageResult = voyageCheck.status === 'fulfilled' ? voyageCheck.value : { healthy: false, details: 'Check failed' }
    const envResult = envCheck.status === 'fulfilled' ? envCheck.value : { healthy: false, details: 'Check failed' }
    const youComResult = youComCheck.status === 'fulfilled' ? youComCheck.value : { healthy: false, details: 'Check failed' }
    
    // Determine overall status
    const allHealthy = dbResult.healthy && esResult.healthy && perplexityResult.healthy && deepseekResult.healthy && voyageResult.healthy && envResult.healthy && youComResult.healthy
    const anyUnhealthy = !dbResult.healthy || !esResult.healthy
    const status = anyUnhealthy ? 'unhealthy' : allHealthy ? 'healthy' : 'degraded'
    
    const result: HealthCheckResult = {
      status,
      checks: {
        database: dbResult.healthy,
        elasticsearch: esResult.healthy,
        perplexity: perplexityResult.healthy,
        deepseek: deepseekResult.healthy,
        voyage: voyageResult.healthy,
        environment: envResult.healthy,
        youcom: youComResult.healthy,
      },
      details: {
        database: dbResult.details,
        elasticsearch: esResult.details,
        perplexity: perplexityResult.details,
        deepseek: deepseekResult.details,
        voyage: voyageResult.details,
        environment: envResult.details,
        youcom: youComResult.details,
      },
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
    }
    
    // Return appropriate status code based on health
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503
    
    return NextResponse.json(result, { status: statusCode })
    
  } catch (error) {
    console.error('Health check error:', error)
    
    const errorResult: HealthCheckResult = {
      status: 'unhealthy',
      checks: {
        database: false,
        elasticsearch: false,
        perplexity: false,
        deepseek: false,
        voyage: false,
        environment: false,
        youcom: false,
      },
      details: {
        database: 'Check failed',
        elasticsearch: 'Check failed',
        perplexity: 'Check failed',
        deepseek: 'Check failed',
        voyage: 'Check failed',
        environment: 'Check failed',
        youcom: 'Check failed',
      },
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
    }
    
    return NextResponse.json(errorResult, { status: 503 })
  }
}
// Optional: Add a simple HTML view for browser access
export async function HEAD(req: NextRequest): Promise<NextResponse> {
  // Simple HEAD request for uptime monitoring
  return new NextResponse(null, { status: 200 })
}
