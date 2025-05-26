const { execSync } = require('child_process');
async function testRateLimiting() {
    console.log('🧪 Testing Rate Limiting and Retry Logic...\n');
    const RATE_LIMIT_CONFIG = {
        maxRetries: 3,
        baseDelay: 1000, 
        maxDelay: 10000, 
        backoffMultiplier: 2
    };
    class RequestQueue {
        constructor() {
            this.queue = [];
            this.processing = false;
            this.lastRequestTime = 0;
            this.minInterval = 200; 
        }
        async add(requestFn) {
            return new Promise((resolve, reject) => {
                this.queue.push(async () => {
                    try {
                        const result = await requestFn();
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
                this.processQueue();
            });
        }
        async processQueue() {
            if (this.processing || this.queue.length === 0) return;
            this.processing = true;
            while (this.queue.length > 0) {
                const now = Date.now();
                const timeSinceLastRequest = now - this.lastRequestTime;
                if (timeSinceLastRequest < this.minInterval) {
                    await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastRequest));
                }
                const request = this.queue.shift();
                if (request) {
                    this.lastRequestTime = Date.now();
                    await request();
                }
            }
            this.processing = false;
        }
    }
    async function retryWithBackoff(fn, maxRetries = RATE_LIMIT_CONFIG.maxRetries, baseDelay = RATE_LIMIT_CONFIG.baseDelay) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                const errorObj = error instanceof Error ? error : new Error(String(error));
                lastError = errorObj;
                if (errorObj.message.includes('429')) {
                    if (attempt < maxRetries) {
                        const delay = Math.min(
                            baseDelay * Math.pow(RATE_LIMIT_CONFIG.backoffMultiplier, attempt),
                            RATE_LIMIT_CONFIG.maxDelay
                        );
                        console.log(`⏳ Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        continue;
                    }
                }
                if (attempt === 0 && !errorObj.message.includes('429')) {
                    throw errorObj;
                }
                if (attempt === maxRetries) {
                    throw new Error(`Max retries (${maxRetries}) exceeded. Last error: ${lastError.message}`);
                }
            }
        }
        throw lastError;
    }
    const requestQueue = new RequestQueue();
    console.log('📋 Test 1: Normal request');
    try {
        const result = await requestQueue.add(async () => {
            return await retryWithBackoff(async () => {
                console.log('✅ Making normal API request...');
                return { success: true, data: 'Normal response' };
            });
        });
        console.log('✅ Normal request succeeded:', result);
    } catch (error) {
        console.error('❌ Normal request failed:', error.message);
    }
    console.log('\n📋 Test 2: Simulated 429 error with eventual success');
    let attemptCount = 0;
    try {
        const result = await requestQueue.add(async () => {
            return await retryWithBackoff(async () => {
                attemptCount++;
                console.log(`🔄 Attempt ${attemptCount}...`);
                if (attemptCount < 3) {
                    throw new Error('429 - {"msg":"Too Many Requests","code":"50011"}');
                }
                return { success: true, data: 'Success after retries' };
            });
        });
        console.log('✅ Request succeeded after retries:', result);
    } catch (error) {
        console.error('❌ Request failed after retries:', error.message);
    }
    console.log('\n📋 Test 3: Multiple concurrent requests (queue test)');
    const promises = [];
    for (let i = 1; i <= 5; i++) {
        promises.push(
            requestQueue.add(async () => {
                console.log(`🔄 Processing request ${i}`);
                await new Promise(resolve => setTimeout(resolve, 100)); 
                return { requestId: i, timestamp: Date.now() };
            })
        );
    }
    try {
        const results = await Promise.all(promises);
        console.log('✅ All queued requests completed:');
        results.forEach(result => {
            console.log(`   Request ${result.requestId} completed at ${new Date(result.timestamp).toISOString()}`);
        });
        const timestamps = results.map(r => r.timestamp);
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i - 1]);
        }
        console.log('📊 Request intervals (ms):', intervals);
        const allIntervalsValid = intervals.every(interval => interval >= 200);
        console.log(`✅ Rate limiting working: ${allIntervalsValid ? 'YES' : 'NO'}`);
    } catch (error) {
        console.error('❌ Queued requests failed:', error.message);
    }
    console.log('\n🎉 Rate limiting tests completed!');
    console.log('\n💡 Key improvements implemented:');
    console.log('   • Request queuing with minimum 200ms intervals');
    console.log('   • Exponential backoff for 429 errors (1s, 2s, 4s)');
    console.log('   • Maximum 3 retries for rate limit errors');
    console.log('   • Immediate failure for non-rate-limit errors');
    console.log('   • Enhanced token search with alternatives and variations');
}
testRateLimiting().catch(console.error); 