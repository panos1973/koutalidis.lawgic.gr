// Circuit Breaker Pattern for External Services
export class CircuitBreaker {
  private failures = 0
  private successCount = 0
  private lastFailureTime = 0
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'
  private nextAttempt = 0
  
  constructor(
    private readonly threshold: number = 5,        // Number of failures before opening
    private readonly timeout: number = 60000,      // Time before attempting to close (ms)
    private readonly successThreshold: number = 2, // Successes needed to close from half-open
    private readonly name: string = 'CircuitBreaker'
  ) {}
  
  // Check if requests should be allowed
  isOpen(): boolean {
    this.updateState()
    return this.state === 'OPEN'
  }
  
  // Check if in half-open state (testing)
  isHalfOpen(): boolean {
    this.updateState()
    return this.state === 'HALF_OPEN'
  }
  
  // Get current state
  getState(): string {
    this.updateState()
    return this.state
  }
  
  // Record a successful call
  recordSuccess(): void {
    this.failures = 0
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++
      if (this.successCount >= this.successThreshold) {
        this.close()
      }
    }
    
    console.log(`✅ [${this.name}] Success recorded. State: ${this.state}`)
  }
  
  // Record a failed call
  recordFailure(): void {
    this.failures++
    this.lastFailureTime = Date.now()
    this.successCount = 0
    
    if (this.failures >= this.threshold) {
      this.open()
    }
    
    console.log(`❌ [${this.name}] Failure recorded (${this.failures}/${this.threshold}). State: ${this.state}`)
  }
  
  // Open the circuit (stop requests)
  private open(): void {
    this.state = 'OPEN'
    this.nextAttempt = Date.now() + this.timeout
    console.warn(`🔴 [${this.name}] Circuit OPENED. Will retry at ${new Date(this.nextAttempt).toISOString()}`)
  }
  
  // Close the circuit (allow requests)
  private close(): void {
    this.failures = 0
    this.successCount = 0
    this.state = 'CLOSED'
    console.log(`🟢 [${this.name}] Circuit CLOSED. Normal operation resumed.`)
  }
  
  // Move to half-open state (testing)
  private halfOpen(): void {
    this.state = 'HALF_OPEN'
    this.successCount = 0
    console.log(`🟡 [${this.name}] Circuit HALF-OPEN. Testing with limited requests.`)
  }
  
  // Update state based on current conditions
  private updateState(): void {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttempt) {
      this.halfOpen()
    }
  }
  
  // Get statistics
  getStats(): {
    state: string
    failures: number
    successCount: number
    lastFailureTime: number
    nextAttempt: number
  } {
    return {
      state: this.state,
      failures: this.failures,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    }
  }
  
  // Reset the circuit breaker
  reset(): void {
    this.failures = 0
    this.successCount = 0
    this.lastFailureTime = 0
    this.state = 'CLOSED'
    this.nextAttempt = 0
    console.log(`🔄 [${this.name}] Circuit reset to initial state`)
  }
}

// Singleton instances for different services
const circuitBreakers = new Map<string, CircuitBreaker>()

export function getCircuitBreaker(
  service: string, 
  threshold?: number, 
  timeout?: number
): CircuitBreaker {
  if (!circuitBreakers.has(service)) {
    circuitBreakers.set(service, new CircuitBreaker(threshold, timeout, 2, service))
  }
  return circuitBreakers.get(service)!
}

// Enhanced wrapper for protected API calls
export async function withCircuitBreaker<T>(
  service: string,
  operation: () => Promise<T>,
  fallback?: () => T | Promise<T>
): Promise<T> {
  const breaker = getCircuitBreaker(service)
  
  // Check if circuit is open
  if (breaker.isOpen()) {
    console.warn(`⚡ [${service}] Circuit is OPEN, using fallback`)
    if (fallback) {
      return await fallback()
    }
    throw new Error(`Service ${service} is temporarily unavailable (circuit open)`)
  }
  
  try {
    // Attempt the operation
    const result = await operation()
    
    // Record success
    breaker.recordSuccess()
    
    return result
  } catch (error) {
    // Record failure
    breaker.recordFailure()
    
    // If we're in half-open state and failed, open immediately
    if (breaker.isHalfOpen()) {
      console.warn(`⚠️ [${service}] Failed in HALF-OPEN state, reopening circuit`)
    }
    
    // Try fallback if available
    if (fallback) {
      console.log(`🔄 [${service}] Using fallback due to error:`, error)
      return await fallback()
    }
    
    throw error
  }
}

// Export specific circuit breakers for common services
export const perplexityCircuitBreaker = getCircuitBreaker('Perplexity', 3, 60000)
export const elasticsearchCircuitBreaker = getCircuitBreaker('Elasticsearch', 5, 30000)
export const voyageCircuitBreaker = getCircuitBreaker('Voyage', 3, 30000)
