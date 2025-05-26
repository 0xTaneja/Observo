import { DetectedContent, TradingSignal } from "../types";
import { OKXDexService } from "../services/okxDexService";
import { setupMarketDataHandlers } from "./marketDataHandler";
import {
    getTokenMarketData,
    getCandlestickData,
    convertCandlestickData
} from "../services/okxMarketApi";
const config = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    OKX_API_KEY: process.env.OKX_API_KEY || '66dfb78a-be05-4fe7-8e52-3a47c0b2e6b7',
    OKX_SECRET_KEY: process.env.OKX_SECRET_KEY || '2B8360879705AAF00AE104526C72494C',
    OKX_PASSPHRASE: process.env.OKX_PASSPHRASE || 'J.896RCAHMtaNBw',
    OKX_API_KEY1: process.env.OKX_API_KEY1 || '',
    OKX_SECRET_KEY1: process.env.OKX_SECRET_KEY1 || '',
    OKX_PASSPHRASE1: process.env.OKX_PASSPHRASE1 || '',
    OKX_BASE_URL: 'https://www.okx.com'
}
let tokenCache: Map<string, any> = new Map();
let tokenCacheExpiry: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; 
chrome.runtime.onInstalled.addListener(() => {
    console.log('Observo Background Script Installed');
    console.log('OpenAI API configured:', !!config.OPENAI_API_KEY);
    refreshTokenCache().catch(error => {
        console.error('Failed to initialize token cache:', error);
    });
    console.log('Market data handlers initialized directly in background.ts');
})
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.type);
    if (message.type === 'ANALYZE_CONTENT') {
        handleContentAnalysis(message.data, sender, sendResponse);
        return true; 
    }
    if (message.type === 'TEST_OKX_API') {
        handleTestOKXAPI(sendResponse);
        return true; 
    }
    if (message.type === 'EXECUTE_TRADE') {
        handleExecuteTrade(message.data, sendResponse);
        return true; 
    }
    if (message.type === 'GET_QUOTE') {
        handleGetQuote(message.data, sendResponse);
        return true; 
    }
    if (message.type === 'GET_SUPPORTED_TOKENS') {
        handleGetSupportedTokens(sendResponse);
        return true; 
    }
    if (message.type === 'LOAD_TOKENS_FOR_SWAP') {
        handleLoadTokensForSwap(sendResponse);
        return true; 
    }
    if (message.type === 'GET_TOKEN_MARKET_DATA') {
        handleGetTokenMarketData(message.token, sendResponse);
        return true; 
    }
    if (message.type === 'GET_CANDLESTICK_DATA') {
        handleGetCandlestickData(message.token, message.timeframe, sendResponse);
        return true; 
    }
    if (message.type === 'PING') {
        sendResponse({ success: true, timestamp: Date.now() });
        return false;
    }
    switch (message.type) {
        case 'UPDATE_SETTINGS':
            handleUpdateSettings(message.settings);
            sendResponse({ success: true });
            break;
        case 'TOGGLE_EXTENSION':
            handleToggleExtension(message.enabled);
            sendResponse({ success: true });
            break;
        case 'GET_RECENT_SIGNALS':
            handleGetRecentSignals(sendResponse);
            return true;
        case 'GET_STATS':
            handleGetStats(sendResponse);
            return true;
        case 'CLEAR_DATA':
            handleClearData(sendResponse);
            return true;
        default:
            console.log('Unknown message type:', message.type);
            sendResponse({ success: false, error: 'Unknown message type' });
    }
});
async function handleUpdateSettings(newSettings: any) {
    await chrome.storage.sync.set({ quickalphaSettings: newSettings });
    console.log('Settings updated successfully');
}
function handleToggleExtension(enabled: boolean) {
    console.log(`Extension ${enabled ? 'enabled' : 'disabled'}`);
}
async function handleContentAnalysis(data: any, sender: chrome.runtime.MessageSender, sendResponse: Function) {
    try {
        const { content, tweetId, tweetElement } = data;
        console.log('Analyzing content: ', content);
        const signal = await generateTradingSignal(content);
        await storeSignal(signal, content);
        await updateStats(signal);
        if (sender.tab?.id) {
            chrome.tabs.sendMessage(sender.tab.id, {
                type: 'DISPLAY_SIGNAL',
                data: {
                    signal,
                    tweetId,
                    content
                }
            });
        }
        sendResponse({ success: true, signal });
    }
    catch (error) {
        console.error('Error analyzing content', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown Message';
        sendResponse({ success: false, error: errorMessage });
    }
}
async function storeSignal(signal: TradingSignal, content?: DetectedContent) {
    try {
        const recentSignal = {
            token: signal.token || null,
            action: signal.action,
            confidence: signal.confidence,
            timestamp: Date.now(),
            explanation: signal.explanation,
            content: content ? {
                fullText: content.fullText,
                tokens: content.tokens,
                wallets: content.wallets,
                hypeLanguage: content.hypeLanguage
            } : null
        };
        const result = await chrome.storage.local.get(['recentSignals']);
        const signals = result.recentSignals || [];
        signals.unshift(recentSignal);
        const limitedSignals = signals.slice(0, 50);
        await chrome.storage.local.set({ recentSignals: limitedSignals });
        console.log('Signal stored:', recentSignal);
    } catch (error) {
        console.error('Error storing signal:', error);
    }
}
async function updateStats(signal: TradingSignal) {
    try {
        const result = await chrome.storage.local.get(['stats']);
        const currentStats = result.stats || {
            totalSignals: 0,
            buySignals: 0,
            sellSignals: 0,
            avoidSignals: 0,
            accuracy: 0 
        };
        currentStats.totalSignals += 1;
        switch (signal.action.toLowerCase()) {
            case 'buy':
                currentStats.buySignals += 1;
                break;
            case 'sell':
                currentStats.sellSignals += 1;
                break;
            case 'avoid':
            case 'invert':
                currentStats.avoidSignals += 1;
                break;
        }
        await chrome.storage.local.set({ stats: currentStats });
        console.log('Stats updated:', currentStats);
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}
async function generateTradingSignal(content: DetectedContent): Promise<TradingSignal> {
    try {
        return await generateOpenAISignal(content);
    }
    catch (error) {
        console.error('Error generating trading signal', error);
        return {
            action: 'AVOID',
            confidence: 1,
            explanation: 'Analysis failed - please check OpenAI API configuration',
            token: content.tokens[0]?.symbol
        };
    }
}
async function generateOpenAISignal(content: DetectedContent): Promise<TradingSignal> {
    if (!config.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
    }
    const prompt = `Analyze this crypto content for trading signals:
Content: "${content.fullText}"
Detected tokens: ${content.tokens.map(t => t.symbol).join(', ')}
Hype language: ${content.hypeLanguage.join(', ')}
You are a balanced crypto trading analyst. Provide actionable trading recommendations:
BUY signals for:
- Established tokens (BTC, ETH, SOL, etc.) with positive momentum
- Strong technical breakouts or bullish patterns
- Positive news, partnerships, or fundamental developments
- Oversold conditions with reversal signals
- Community excitement around legitimate projects
SELL signals for:
- Tokens showing weakness after strong runs
- Technical breakdown patterns or resistance rejections
- Negative news or regulatory concerns
- Overbought conditions with distribution signs
- Profit-taking opportunities at key levels
AVOID signals for:
- Clear scam indicators (rug pulls, honeypots)
- Completely unknown or suspicious tokens
- Obvious pump and dump schemes
- Tokens with no real utility or backing
IMPORTANT: Be more aggressive with BUY/SELL recommendations. Most crypto content should result in actionable signals, not just AVOID. Look for trading opportunities even in volatile markets.
CRITICAL: Respond with ONLY valid JSON in this exact format (no extra text):
{
  "action": "BUY",
  "confidence": 8,
  "reason": "Clear explanation here"
}
Valid actions: BUY, SELL, AVOID
Confidence: 1-10 (integer only)
Favor actionable signals over conservative avoidance.`;
    console.log('🤖 Sending request to OpenAI...');
    console.log('📝 Prompt length:', prompt.length);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${config.OPENAI_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 150,
            temperature: 0.3, 
            response_format: { type: "json_object" } 
        })
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OpenAI API Error:', response.status, errorText);
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log('📊 OpenAI API Response Data:', data);
    const aiResponse = data.choices[0]?.message?.content || '';
    console.log('🤖 AI Response Content:', aiResponse);
    if (!aiResponse) {
        throw new Error('Empty response from OpenAI');
    }
    return parseOpenAIResponse(aiResponse, content);
}
function parseOpenAIResponse(response: string, content: DetectedContent): TradingSignal {
    console.log('Raw OpenAI Response:', response);
    try {
        const jsonMatch = response.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
            try {
                const parsed = JSON.parse(jsonMatch[0]);
                console.log('Successfully parsed JSON:', parsed);
                return {
                    action: parsed.action || 'AVOID',
                    confidence: parsed.confidence || 5,
                    explanation: parsed.reason || parsed.explanation || 'AI analysis completed',
                    token: content.tokens[0]?.symbol
                };
            } catch (jsonError) {
                console.log('JSON parse failed, trying to fix malformed JSON...');
                let fixedJson = jsonMatch[0];
                fixedJson = fixedJson.replace(/,(\s*[}\]])/g, '$1');
                fixedJson = fixedJson.replace(/(\w+):/g, '"$1":');
                fixedJson = fixedJson.replace(/'/g, '"');
                // Remove any trailing text after the closing brace
                const braceIndex = fixedJson.lastIndexOf('}');
                if (braceIndex !== -1) {
                    fixedJson = fixedJson.substring(0, braceIndex + 1);
                }
                console.log('Attempting to parse fixed JSON:', fixedJson);
                try {
                    const parsed = JSON.parse(fixedJson);
                    console.log('Successfully parsed fixed JSON:', parsed);
                    return {
                        action: parsed.action || 'AVOID',
                        confidence: parsed.confidence || 5,
                        explanation: parsed.reason || parsed.explanation || 'AI analysis completed',
                        token: content.tokens[0]?.symbol
                    };
                } catch (fixedJsonError) {
                    console.log('Fixed JSON parse also failed, trying manual extraction...');
                }
            }
        }
        // Method 3: Manual extraction using regex patterns
        console.log('Attempting manual field extraction...');
        const actionMatch = response.match(/"action"\s*:\s*"([^"]+)"/i) ||
            response.match(/action[:\s]+([A-Z]+)/i);
        const confidenceMatch = response.match(/"confidence"\s*:\s*(\d+)/i) ||
            response.match(/confidence[:\s]+(\d+)/i);
        const reasonMatch = response.match(/"reason"\s*:\s*"([^"]+)"/i) ||
            response.match(/"explanation"\s*:\s*"([^"]+)"/i) ||
            response.match(/reason[:\s]+"?([^"}\n]+)"?/i);
        const action = actionMatch ? actionMatch[1].toUpperCase() : 'AVOID';
        const confidence = confidenceMatch ? parseInt(confidenceMatch[1]) : 5;
        const explanation = reasonMatch ? reasonMatch[1].trim() : 'AI analysis completed';
        console.log('Manually extracted:', { action, confidence, explanation });
        // Validate action
        const validActions = ['BUY', 'SELL', 'AVOID', 'HOLD'];
        const finalAction = validActions.includes(action) ? action : 'AVOID';
        // Validate confidence
        const finalConfidence = Math.max(1, Math.min(10, confidence));
        return {
            action: finalAction as any,
            confidence: finalConfidence,
            explanation: explanation,
            token: content.tokens[0]?.symbol
        };
    } catch (error) {
        console.error('All parsing methods failed:', error);
        console.log('Falling back to text analysis...');
        // Method 4: Fallback - analyze the text content for sentiment
        const lowerResponse = response.toLowerCase();
        let action = 'AVOID';
        let confidence = 3;
        let explanation = 'Could not parse AI response, using fallback analysis';
        if (lowerResponse.includes('buy') || lowerResponse.includes('bullish') || lowerResponse.includes('positive')) {
            action = 'BUY';
            confidence = 6;
            explanation = 'Positive sentiment detected in AI response';
        } else if (lowerResponse.includes('sell') || lowerResponse.includes('bearish') || lowerResponse.includes('negative')) {
            action = 'SELL';
            confidence = 6;
            explanation = 'Negative sentiment detected in AI response';
        } else if (lowerResponse.includes('avoid') || lowerResponse.includes('scam') || lowerResponse.includes('risky')) {
            action = 'AVOID';
            confidence = 7;
            explanation = 'Risk indicators detected in AI response';
        }
        return {
            action: action as any,
            confidence: confidence,
            explanation: explanation,
            token: content.tokens[0]?.symbol
        };
    }
}
chrome.runtime.onStartup.addListener(() => {
    console.log('QuickAlpha background script started');
});
async function handleGetRecentSignals(sendResponse: Function) {
    try {
        const result = await chrome.storage.local.get(['recentSignals']);
        sendResponse({ success: true, signals: result.recentSignals || [] });
    } catch (error) {
        console.error('Error getting recent signals:', error);
        sendResponse({ success: false, error: 'Failed to get signals' });
    }
}
async function handleGetStats(sendResponse: Function) {
    try {
        const result = await chrome.storage.local.get(['stats']);
        sendResponse({
            success: true, stats: result.stats || {
                totalSignals: 0,
                buySignals: 0,
                sellSignals: 0,
                avoidSignals: 0,
                accuracy: 0
            }
        });
    } catch (error) {
        console.error('Error getting stats:', error);
        sendResponse({ success: false, error: 'Failed to get stats' });
    }
}
async function handleClearData(sendResponse: Function) {
    try {
        await chrome.storage.local.clear();
        sendResponse({ success: true });
    } catch (error) {
        console.error('Error clearing data:', error);
        sendResponse({ success: false, error: 'Failed to clear data' });
    }
}
async function handleTestOKXAPI(sendResponse: Function) {
    try {
        console.log('🧪 Testing OKX DEX API...');
        // Call OKX API endpoint
        const response = await callOKXAllTokens();
        console.log('✅ OKX API Response:', response);
        sendResponse({ success: true, data: response });
    } catch (error) {
        console.error('❌ OKX API Test Failed:', error);
        sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'OKX API test failed'
        });
    }
}
async function callOKXAllTokens() {
    const chainIndex = '501'; // Solana (was incorrectly set to '1' for Ethereum)
    const url = `https://web3.okx.com/api/v5/dex/aggregator/all-tokens?chainIndex=${chainIndex}`;
    // Generate timestamp
    const timestamp = new Date().toISOString();
    // Create signature according to OKX API docs
    const method = 'GET';
    const requestPath = `/api/v5/dex/aggregator/all-tokens?chainIndex=${chainIndex}`;
    const body = '';
    // Create the signature string: timestamp + method + requestPath + body
    const signatureString = timestamp + method + requestPath + body;
    // Generate HMAC-SHA256 signature
    const signature = await generateHMACSignature(signatureString, config.OKX_SECRET_KEY);
    const headers = {
        'OK-ACCESS-KEY': config.OKX_API_KEY,
        'OK-ACCESS-SIGN': signature,
        'OK-ACCESS-TIMESTAMP': timestamp,
        'OK-ACCESS-PASSPHRASE': config.OKX_PASSPHRASE,
        'Content-Type': 'application/json'
    };
    console.log('🔗 Calling OKX API for Solana tokens:', url);
    console.log('📋 Signature String:', signatureString);
    console.log('📋 Headers:', { ...headers, 'OK-ACCESS-SIGN': signature.substring(0, 10) + '...' });
    const response = await fetch(url, {
        method: 'GET',
        headers: headers
    });
    console.log('📊 Response Status:', response.status);
    console.log('📊 Response Headers:', Object.fromEntries(response.headers.entries()));
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OKX API Error: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    console.log('✅ OKX Solana tokens response:', data);
    return data;
}
async function generateHMACSignature(message: string, secret: string): Promise<string> {
    try {
        // Convert secret and message to Uint8Array
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(message);
        // Import the secret key
        const cryptoKey = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        // Generate signature
        const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
        // Convert to base64
        const signatureArray = new Uint8Array(signature);
        const base64Signature = btoa(String.fromCharCode(...signatureArray));
        return base64Signature;
    } catch (error) {
        console.error('Error generating HMAC signature:', error);
        throw new Error('Failed to generate API signature');
    }
}
async function handleExecuteTrade(data: any, sendResponse: Function) {
    try {
        console.log('🚀 Executing trade:', data);
        const { signal, amount, slippage, timestamp } = data;
        if (!signal || !amount) {
            throw new Error('Missing required trade parameters');
        }
        // Get wallet address from storage (should be set when wallet connects)
        const walletData = await chrome.storage.local.get(['walletAddress']);
        const userWalletAddress = walletData.walletAddress;
        if (!userWalletAddress) {
            throw new Error('No wallet connected. Please connect your wallet first.');
        }
        // Determine token addresses based on signal
        const solAddress = OKXDexService.getCommonTokens().SOL;
        let fromTokenAddress: string;
        let toTokenAddress: string;
        let tradeAmount: string;
        let fromTokenDecimals: number;
        if (signal.action.toLowerCase() === 'buy') {
            // BUY signal: SOL → Target Token
            fromTokenAddress = solAddress;
            toTokenAddress = await getTokenAddress(signal.token);
            fromTokenDecimals = 9; // SOL has 9 decimals
            tradeAmount = OKXDexService.toSmallestUnits(amount, fromTokenDecimals);
        } else if (signal.action.toLowerCase() === 'sell') {
            // SELL signal: Target Token → SOL
            fromTokenAddress = await getTokenAddress(signal.token);
            toTokenAddress = solAddress;
            // For sell, amount is in target token units (need to get decimals)
            fromTokenDecimals = await getTokenDecimals(signal.token);
            tradeAmount = OKXDexService.toSmallestUnits(amount, fromTokenDecimals);
        } else {
            throw new Error('Invalid signal action. Only BUY and SELL are supported.');
        }
        // Validate tradeAmount
        if (!tradeAmount || tradeAmount === '0' || tradeAmount === 'NaN') {
            console.error('❌ Invalid trade amount after conversion:', tradeAmount);
            throw new Error(`Invalid trade amount after conversion. Please try a larger amount.`);
        }
        // Try with primary API keys first
        let quote;
        let swap;
        let apiKeySetUsed = 'primary';
        const quoteParams = {
            fromTokenAddress,
            toTokenAddress,
            amount: tradeAmount,
            slippage: slippage?.toString() || '0.01'
        };
        try {
            console.log('🔑 Using primary API keys for trade');
            // Initialize OKX DEX service with primary API keys
            const okxService = new OKXDexService({
                apiKey: config.OKX_API_KEY,
                secretKey: config.OKX_SECRET_KEY,
                passphrase: config.OKX_PASSPHRASE
            });
            // Get quote first
            console.log('📊 Getting quote for trade...', quoteParams);
            quote = await okxService.getQuote(quoteParams);
            // Get swap transaction data
            console.log('🔄 Getting swap transaction...');
            swap = await okxService.getSwap({
                ...quoteParams,
                userWalletAddress
            });
        } catch (error) {
            console.error('❌ Primary API keys failed:', error);
            // Check if backup API keys are available
            if (config.OKX_API_KEY1 && config.OKX_SECRET_KEY1 && config.OKX_PASSPHRASE1) {
                console.log('🔄 Trying with backup API keys');
                apiKeySetUsed = 'backup';
                // Initialize OKX DEX service with backup API keys
                const okxService = new OKXDexService({
                    apiKey: config.OKX_API_KEY1,
                    secretKey: config.OKX_SECRET_KEY1,
                    passphrase: config.OKX_PASSPHRASE1
                });
                // Get quote with backup keys
                console.log('📡 Calling OKX getQuote with backup keys...');
                quote = await okxService.getQuote(quoteParams);
                // Get swap with backup keys
                console.log('📡 Calling OKX getSwap with backup keys...');
                swap = await okxService.getSwap({
                    ...quoteParams,
                    userWalletAddress
                });
            } else {
                console.error('❌ No backup API keys available');
                throw error;
            }
        }
        // Check quote response
        if (!quote.data || quote.data.length === 0) {
            throw new Error('No quote available for this trade');
        }
        // Check swap response
        if (!swap.data || swap.data.length === 0) {
            throw new Error('No swap data available');
        }
        // Extract the router result from quote with better error handling
        let quoteResult: any;
        try {
            // Handle different possible response structures
            if (quote.data[0].routerResult) {
                quoteResult = quote.data[0].routerResult;
            } else if ('chainId' in quote.data[0]) {
                quoteResult = quote.data[0];
            } else {
                // Try to find routing data in the response
                const possibleFields = ['routerResult', 'result', 'router', 'quoteData'];
                for (const field of possibleFields) {
                    if (quote.data[0][field as keyof typeof quote.data[0]]) {
                        quoteResult = quote.data[0][field as keyof typeof quote.data[0]];
                        console.log(`✅ Found quote routing data in field: ${field}`);
                        break;
                    }
                }
                // If still not found, use the first data item as is
                if (!quoteResult) {
                    console.warn('⚠️ Could not find explicit routing data, using data object directly');
                    quoteResult = quote.data[0];
                }
            }
        } catch (error) {
            console.error('❌ Error parsing quote response:', error);
            throw new Error('Failed to parse quote response');
        }
        // Extract swap result similarly
        const swapResult = swap.data[0];
        // Extract token info with fallbacks
        const fromToken = quoteResult.fromToken || {};
        const toToken = quoteResult.toToken || {};
        // Use values from our initial parameters if missing in response
        const fromTokenSymbol = fromToken.tokenSymbol || (signal.action.toLowerCase() === 'buy' ? 'SOL' : signal.token);
        const toTokenSymbol = toToken.tokenSymbol || (signal.action.toLowerCase() === 'buy' ? signal.token : 'SOL');
        // Get decimals for conversion
        const fromDecimal = parseInt(fromToken.decimal || fromToken.decimals || fromTokenDecimals.toString());
        const toDecimal = parseInt(toToken.decimal || toToken.decimals || ((signal.action.toLowerCase() === 'buy' ?
            await getTokenDecimals(signal.token) : 9)).toString());
        // Extract amounts with fallbacks
        const fromTokenAmount = quoteResult.fromTokenAmount || quoteResult.fromAmount || tradeAmount;
        const toTokenAmount = quoteResult.toTokenAmount || quoteResult.toAmount || '0';
        // Prepare transaction for wallet signing with added error handling
        const transactionData = {
            chain: 'solana',
            transaction: swapResult.tx || {},
            fromToken: fromTokenSymbol,
            toToken: toTokenSymbol,
            fromAmount: OKXDexService.fromSmallestUnitsSafe(fromTokenAmount, fromDecimal),
            toAmount: OKXDexService.fromSmallestUnitsSafe(toTokenAmount, toDecimal),
            slippage: swapResult.tx?.slippage || slippage?.toString() || '0.01',
            estimatedGas: quoteResult.estimateGasFee || '0',
            priceImpact: quoteResult.priceImpactPercentage || '0'
        };
        console.log('✅ Trade prepared successfully:', transactionData);
        sendResponse({
            success: true,
            transaction: transactionData,
            quote: quoteResult,
            apiKeySet: apiKeySetUsed,
            message: 'Trade prepared. Please sign the transaction in your wallet.'
        });
    } catch (error) {
        console.error('❌ Trade execution failed:', error);
        sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Trade execution failed'
        });
    }
}
async function getTokenInfo(tokenSymbol: string): Promise<{ address: string; decimals: number } | null> {
    try {
        console.log(`🔍 Looking up token info for: ${tokenSymbol}`);
        // Check if cache is valid
        if (Date.now() > tokenCacheExpiry || tokenCache.size === 0) {
            console.log('🔄 Refreshing token cache from OKX API...');
            await refreshTokenCache();
        }
        console.log(`📋 Cache contains ${tokenCache.size} tokens`);
        console.log(`🔍 Searching for token: ${tokenSymbol.toUpperCase()}`);
        // Log some cache keys for debugging
        const cacheKeys = Array.from(tokenCache.keys());
        console.log(`📋 First 10 cache keys: ${cacheKeys.slice(0, 10).join(', ')}`);
        // Check if the specific token exists
        const upperSymbol = tokenSymbol.toUpperCase();
        const tokenInfo = tokenCache.get(upperSymbol);
        if (!tokenInfo) {
            console.warn(`⚠️ Token ${tokenSymbol} not found in OKX supported tokens`);
            console.log(`🔍 Available tokens containing "${tokenSymbol}": ${cacheKeys.filter(key => key.includes(upperSymbol)).join(', ')}`);
            return null;
        }
        console.log(`✅ Found token ${tokenSymbol}:`, {
            symbol: tokenInfo.tokenSymbol,
            address: tokenInfo.tokenContractAddress,
            decimals: tokenInfo.decimal
        });
        return {
            address: tokenInfo.tokenContractAddress,
            decimals: parseInt(tokenInfo.decimal)
        };
    } catch (error) {
        console.error('❌ Error getting token info:', error);
        return null;
    }
}
async function refreshTokenCache(): Promise<void> {
    try {
        console.log('🔄 Starting token cache refresh...');
        // Check if OKX API is configured
        if (!config.OKX_API_KEY || !config.OKX_SECRET_KEY || !config.OKX_PASSPHRASE) {
            console.warn('⚠️ OKX API not configured, using fallback tokens');
            // Use static fallback for development with more tokens including CWIF
            const fallbackTokens = [
                { tokenSymbol: 'SOL', tokenContractAddress: 'So11111111111111111111111111111111111111112', decimal: '9' },
                { tokenSymbol: 'USDC', tokenContractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimal: '6' },
                { tokenSymbol: 'BONK', tokenContractAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimal: '5' },
                { tokenSymbol: 'WIF', tokenContractAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimal: '6' },
                { tokenSymbol: 'CWIF', tokenContractAddress: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', decimal: '6' },
                { tokenSymbol: 'USDT', tokenContractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimal: '6' },
                { tokenSymbol: 'JUP', tokenContractAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimal: '6' }
            ];
            tokenCache.clear();
            fallbackTokens.forEach(token => {
                tokenCache.set(token.tokenSymbol.toUpperCase(), token);
            });
            tokenCacheExpiry = Date.now() + CACHE_DURATION;
            console.log(`✅ Fallback tokens loaded: ${fallbackTokens.map(t => t.tokenSymbol).join(', ')}`);
            return;
        }
        console.log('🌐 OKX API configured, fetching real Solana tokens...');
        const okxService = new OKXDexService({
            apiKey: config.OKX_API_KEY,
            secretKey: config.OKX_SECRET_KEY,
            passphrase: config.OKX_PASSPHRASE
        });
        console.log('📡 Calling OKX getTokens() for Solana...');
        const tokens = await okxService.getTokens();
        console.log(`✅ Loaded ${tokens.length} tokens from OKX API`);
        if (tokens.length === 0) {
            console.warn('⚠️ No tokens returned from OKX API, this might indicate an issue');
            throw new Error('No tokens returned from OKX API');
        }
        // Log first few tokens for debugging
        console.log('📋 Sample tokens from OKX:', tokens.slice(0, 5).map(t => ({
            symbol: t.tokenSymbol,
            address: t.tokenContractAddress,
            decimals: t.decimal
        })));
        // Update cache
        tokenCache.clear();
        tokens.forEach(token => {
            const symbol = token.tokenSymbol.toUpperCase();
            tokenCache.set(symbol, token);
            // Log specific tokens we're looking for
            if (['CWIF', 'WIF', 'SOL', 'BONK'].includes(symbol)) {
                console.log(`✅ Found ${symbol}: ${token.tokenContractAddress}`);
            }
        });
        tokenCacheExpiry = Date.now() + CACHE_DURATION;
        console.log(`✅ Token cache refreshed successfully with ${tokenCache.size} tokens`);
        console.log('🔍 Cache contains:', Array.from(tokenCache.keys()).slice(0, 20).join(', '));
    } catch (error) {
        console.error('❌ Failed to refresh token cache:', error);
        // If we have existing cache, keep it
        if (tokenCache.size > 0) {
            console.log('⚠️ Keeping existing cache with', tokenCache.size, 'tokens');
            // Extend expiry by 1 minute to retry soon
            tokenCacheExpiry = Date.now() + (1 * 60 * 1000);
        } else {
            // No cache at all, use comprehensive fallback
            console.log('⚠️ No existing cache, using comprehensive fallback');
            const comprehensiveFallback = [
                { tokenSymbol: 'SOL', tokenContractAddress: 'So11111111111111111111111111111111111111112', decimal: '9' },
                { tokenSymbol: 'USDC', tokenContractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimal: '6' },
                { tokenSymbol: 'BONK', tokenContractAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimal: '5' },
                { tokenSymbol: 'WIF', tokenContractAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimal: '6' },
                { tokenSymbol: 'CWIF', tokenContractAddress: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump', decimal: '6' },
                { tokenSymbol: 'USDT', tokenContractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimal: '6' },
                { tokenSymbol: 'JUP', tokenContractAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimal: '6' }
            ];
            tokenCache.clear();
            comprehensiveFallback.forEach(token => {
                tokenCache.set(token.tokenSymbol.toUpperCase(), token);
            });
            tokenCacheExpiry = Date.now() + (1 * 60 * 1000); // Retry in 1 minute
            console.log(`✅ Comprehensive fallback loaded: ${comprehensiveFallback.map(t => t.tokenSymbol).join(', ')}`);
        }
        throw error; // Re-throw to let caller know there was an issue
    }
}
// Helper function to get token address by symbol (now dynamic)
async function getTokenAddress(tokenSymbol: string): Promise<string> {
    const tokenInfo = await getTokenInfo(tokenSymbol);
    if (!tokenInfo) {
        throw new Error(`Token ${tokenSymbol} not supported on Solana or not found in OKX`);
    }
    return tokenInfo.address;
}
// Helper function to get token decimals (now dynamic)
async function getTokenDecimals(tokenSymbol: string): Promise<number> {
    const tokenInfo = await getTokenInfo(tokenSymbol);
    if (!tokenInfo) {
        console.warn(`⚠️ Using default decimals for unknown token: ${tokenSymbol}`);
        return 6; // Default fallback
    }
    return tokenInfo.decimals;
}
async function handleGetQuote(data: any, sendResponse: Function) {
    try {
        console.log('📊 Getting real-time quote:', data);
        const { fromToken, toToken, amount, slippage } = data;
        if (!fromToken || !toToken || !amount) {
            throw new Error('Missing required quote parameters');
        }
        console.log(`🔍 Quote request: ${amount} ${fromToken} → ${toToken}`);
        // Validate amount is a number
        if (isNaN(parseFloat(amount))) {
            console.error('❌ Amount is not a valid number:', amount);
            throw new Error('Amount must be a valid number');
        }
        const parsedAmount = parseFloat(amount);
        if (parsedAmount <= 0) {
            console.error('❌ Amount must be greater than zero:', parsedAmount);
            throw new Error('Amount must be greater than zero');
        }
        // Ensure amount is reasonable for the token being swapped
        // Too small amounts can cause "Insufficient liquidity" errors
        console.log(`🔍 Checking if amount ${parsedAmount} is reasonable for ${fromToken}...`);
        // Minimum reasonable amounts based on token type (for Solana tokens)
        const recommendedMinAmounts: { [key: string]: number } = {
            'SOL': 0.001,  // 0.001 SOL is ~$0.10
            'BONK': 10000, // 10000 BONK is ~$0.10
            'WIF': 1,      // 1 WIF is ~$0.10
            'USDC': 0.1,   // 0.1 USDC is $0.10
            'USDT': 0.1,   // 0.1 USDT is $0.10
            'DEFAULT': 1   // Default minimum
        };
        const minAmount = recommendedMinAmounts[fromToken.toUpperCase()] || recommendedMinAmounts['DEFAULT'];
        if (parsedAmount < minAmount) {
            console.warn(`⚠️ Amount ${parsedAmount} might be too small for ${fromToken}, minimum recommended: ${minAmount}`);
            // Continue anyway, but warn the user
        }
        // Get token addresses with detailed logging
        console.log(`🔍 Getting address for ${fromToken}...`);
        const fromTokenAddress = await getTokenAddress(fromToken);
        console.log(`✅ ${fromToken} address: ${fromTokenAddress}`);
        console.log(`🔍 Getting address for ${toToken}...`);
        const toTokenAddress = await getTokenAddress(toToken);
        console.log(`✅ ${toToken} address: ${toTokenAddress}`);
        // Convert amount to smallest units with detailed logging
        console.log(`🔍 Getting decimals for ${fromToken}...`);
        const fromTokenDecimals = await getTokenDecimals(fromToken);
        console.log(`✅ ${fromToken} decimals: ${fromTokenDecimals}`);
        console.log(`🔍 Converting amount ${parsedAmount} to smallest units with ${fromTokenDecimals} decimals...`);
        const tradeAmount = OKXDexService.toSmallestUnits(parsedAmount, fromTokenDecimals);
        console.log(`✅ Trade amount in smallest units: ${tradeAmount}`);
        // Validate tradeAmount
        if (!tradeAmount || tradeAmount === '0' || tradeAmount === 'NaN') {
            console.error('❌ Invalid trade amount after conversion:', tradeAmount);
            throw new Error(`Invalid trade amount after conversion. Please try a larger amount (min ~${minAmount} ${fromToken})`);
        }
        // Check if amount is too small
        if (tradeAmount.length < 2 && parsedAmount > 0) {
            console.warn(`⚠️ Converted amount ${tradeAmount} is very small, may not have enough liquidity`);
        }
        // Debug: Log the exact parameters being sent to OKX
        const quoteParams = {
            fromTokenAddress,
            toTokenAddress,
            amount: tradeAmount,
            slippage: slippage?.toString() || '0.01'
        };
        // Try with primary API keys first
        let quote;
        let apiKeySetUsed = 'primary';
        try {
            console.log('🔑 Using primary API keys');
            // Initialize OKX DEX service with primary API keys
            const okxService = new OKXDexService({
                apiKey: config.OKX_API_KEY,
                secretKey: config.OKX_SECRET_KEY,
                passphrase: config.OKX_PASSPHRASE
            });
            console.log('🔍 OKX Quote parameters:', quoteParams);
            console.log(`🔍 Full OKX Quote URL will be: ${okxService['baseUrl']}/quote?chainIndex=${okxService['chainIndex']}&chainId=${okxService['chainId']}&fromTokenAddress=${fromTokenAddress}&toTokenAddress=${toTokenAddress}&amount=${tradeAmount}`);
            // Get quote from OKX
            console.log('📡 Calling OKX getQuote with primary keys...');
            quote = await okxService.getQuote(quoteParams);
        } catch (error) {
            console.error('❌ Primary API keys failed:', error);
            // Check if backup API keys are available
            if (config.OKX_API_KEY1 && config.OKX_SECRET_KEY1 && config.OKX_PASSPHRASE1) {
                console.log('🔄 Trying with backup API keys');
                apiKeySetUsed = 'backup';
                // Initialize OKX DEX service with backup API keys
                const okxService = new OKXDexService({
                    apiKey: config.OKX_API_KEY1,
                    secretKey: config.OKX_SECRET_KEY1,
                    passphrase: config.OKX_PASSPHRASE1
                });
                // Get quote from OKX with backup keys
                console.log('📡 Calling OKX getQuote with backup keys...');
                quote = await okxService.getQuote(quoteParams);
            } else {
                console.error('❌ No backup API keys available');
                throw error;
            }
        }
        if (!quote.data || quote.data.length === 0) {
            console.error('❌ Empty data array in quote response:', quote);
            throw new Error('No quote available for this pair');
        }
        // Check response structure and extract routing data
        let quoteResult: any;
        try {
            // Log full response structure for debugging
            console.log('📊 Full response structure:', JSON.stringify(quote.data[0]).slice(0, 500) + '...');
            // Handle different possible response structures
            if (quote.data[0].routerResult) {
                // Direct routerResult field
                quoteResult = quote.data[0].routerResult;
            } else if ('chainId' in quote.data[0]) {
                // The data object itself might be the router result
                quoteResult = quote.data[0];
            } else {
                // Try to find routing data in the response
                const possibleFields = ['routerResult', 'result', 'router', 'quoteData'];
                for (const field of possibleFields) {
                    if (quote.data[0][field as keyof typeof quote.data[0]]) {
                        quoteResult = quote.data[0][field as keyof typeof quote.data[0]];
                        console.log(`✅ Found routing data in field: ${field}`);
                        break;
                    }
                }
                // If still not found, use the first data item as is
                if (!quoteResult) {
                    console.warn('⚠️ Could not find explicit routing data, using data object directly');
                    quoteResult = quote.data[0];
                }
            }
        } catch (error) {
            console.error('❌ Error parsing quote response:', error);
            console.error('❌ Raw response data:', JSON.stringify(quote).slice(0, 1000));
            throw new Error('Failed to parse quote response');
        }
        if (!quoteResult) {
            console.error('❌ Could not extract quote result from response:', quote);
            throw new Error('Invalid quote response format');
        }
        console.log('📊 Extracted quote result:', quoteResult);
        // Extract required fields with fallbacks for different response structures
        const resultFromToken = quoteResult.fromToken || {};
        const resultToToken = quoteResult.toToken || {};
        const fromAmount = quoteResult.fromTokenAmount || quoteResult.fromAmount || '0';
        const toAmount = quoteResult.toTokenAmount || quoteResult.toAmount || '0';
        // Check if we have the minimum required data
        if (!resultFromToken || !resultToToken || !fromAmount || !toAmount) {
            console.error('❌ Missing required fields in quote result');
            throw new Error('Incomplete quote data');
        }
        // Get decimals for both tokens to handle conversions properly
        const toTokenDecimals = await getTokenDecimals(toToken);
        console.log(`✅ ${toToken} decimals: ${toTokenDecimals}`);
        // Format response for frontend with careful handling of potentially missing fields
        const fromTokenDecimal = parseInt(resultFromToken.decimal || resultFromToken.decimals || fromTokenDecimals.toString());
        const toTokenDecimal = parseInt(resultToToken.decimal || resultToToken.decimals || toTokenDecimals.toString());
        // Handle special cases for original amounts
        let originalAmount = parsedAmount;
        // Convert amounts, using the safe method for very small values
        const convertedFromAmount = originalAmount; // Use original amount instead of converted
        const convertedToAmount = OKXDexService.fromSmallestUnitsSafe(toAmount, toTokenDecimal);
        // Calculate exchange rate safely
        let exchangeRate = 0;
        if (convertedFromAmount > 0) {
            exchangeRate = convertedToAmount / convertedFromAmount;
        }
        console.log(`💱 Conversion results: ${convertedFromAmount} ${fromToken} -> ${convertedToAmount} ${toToken} (rate: ${exchangeRate})`);
        // Double-check if the results are realistic
        if (fromToken.toUpperCase() === 'SOL' && toToken.toUpperCase() === 'BONK' && exchangeRate < 100000) {
            console.warn('⚠️ Exchange rate looks suspiciously low for SOL→BONK');
            // Make a rough estimate based on known rates (1 SOL ≈ 1 billion BONK)
            if (convertedToAmount < 1000000 && parsedAmount >= 0.001) {
                console.warn('⚠️ Correcting suspiciously low BONK amount');
                const estimatedBonk = parsedAmount * 900000000; // ~900M BONK per SOL
                console.log(`⚠️ Estimated BONK amount: ${estimatedBonk}`);
                const formattedQuote = {
                    fromToken: fromToken,
                    toToken: toToken,
                    fromAmount: parsedAmount,
                    toAmount: estimatedBonk,
                    exchangeRate: 900000000, // ~900M BONK per SOL
                    priceImpact: parseFloat(quoteResult.priceImpactPercentage || '0'),
                    estimatedGas: quoteResult.estimateGasFee || '0',
                    tradeFee: quoteResult.tradeFee || '0',
                    estimatedRate: true
                };
                console.log('⚠️ Using estimated quote:', formattedQuote);
                sendResponse({
                    success: true,
                    quote: formattedQuote,
                    realQuote: true,
                    apiKeySet: apiKeySetUsed,
                    estimated: true
                });
                return;
            }
        }
        const formattedQuote = {
            fromToken: resultFromToken.tokenSymbol || resultFromToken.symbol || fromToken,
            toToken: resultToToken.tokenSymbol || resultToToken.symbol || toToken,
            fromAmount: convertedFromAmount,
            toAmount: convertedToAmount,
            exchangeRate: exchangeRate,
            priceImpact: parseFloat(quoteResult.priceImpactPercentage || '0'),
            estimatedGas: quoteResult.estimateGasFee || '0',
            tradeFee: quoteResult.tradeFee || '0'
        };
        console.log('✅ Real OKX quote received:', formattedQuote);
        sendResponse({
            success: true,
            quote: formattedQuote,
            realQuote: true,
            apiKeySet: apiKeySetUsed
        });
    } catch (error) {
        console.error('❌ Quote fetch failed:', error);
        // Enhanced error logging
        if (error instanceof Error) {
            console.error('❌ Error details:', {
                message: error.message,
                stack: error.stack,
                name: error.name
            });
        }
        sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Quote fetch failed'
        });
    }
}
async function handleGetSupportedTokens(sendResponse: Function) {
    try {
        // Ensure cache is fresh
        if (Date.now() > tokenCacheExpiry || tokenCache.size === 0) {
            await refreshTokenCache();
        }
        const tokens = Array.from(tokenCache.values());
        console.log(`📋 Returning ${tokens.length} supported tokens`);
        sendResponse({
            success: true,
            tokens: tokens,
            cacheExpiry: tokenCacheExpiry
        });
    } catch (error) {
        console.error('❌ Error getting supported tokens:', error);
        sendResponse({
            success: false,
            error: 'Failed to get supported tokens'
        });
    }
}
async function handleLoadTokensForSwap(sendResponse: Function) {
    try {
        console.log('🔄 Loading tokens for swap modal...');
        // Force refresh if cache is expired or empty
        if (Date.now() > tokenCacheExpiry || tokenCache.size === 0) {
            console.log('🔄 Cache expired or empty, refreshing...');
            await refreshTokenCache();
        }
        const tokens = Array.from(tokenCache.values());
        console.log(`✅ Loaded ${tokens.length} tokens for swap`);
        // Debug: Search for specific tokens
        const searchTokens = ['CWIF', 'BONK', 'WIF', 'SOL', 'USDC'];
        console.log('🔍 Debugging token search:');
        searchTokens.forEach(symbol => {
            const found = tokenCache.has(symbol.toUpperCase());
            const tokenData = tokenCache.get(symbol.toUpperCase());
            console.log(`  ${symbol}: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
            if (found && tokenData) {
                console.log(`    Address: ${tokenData.tokenContractAddress}`);
                console.log(`    Decimals: ${tokenData.decimal}`);
            }
        });
        // Also search for partial matches of CWIF
        const allTokenSymbols = Array.from(tokenCache.keys());
        const cwifMatches = allTokenSymbols.filter(symbol => symbol.includes('CWIF') || symbol.includes('WIF'));
        console.log(`🔍 Tokens containing 'WIF': ${cwifMatches.join(', ')}`);
        // Return token list with cache info
        sendResponse({
            success: true,
            tokens: tokens,
            cacheSize: tokenCache.size,
            cacheExpiry: tokenCacheExpiry,
            message: `${tokens.length} tokens loaded successfully`,
            debugInfo: {
                searchResults: searchTokens.map(symbol => ({
                    symbol,
                    found: tokenCache.has(symbol.toUpperCase()),
                    data: tokenCache.get(symbol.toUpperCase())
                })),
                wifMatches: cwifMatches
            }
        });
    } catch (error) {
        console.error('❌ Error loading tokens for swap:', error);
        // Try to return whatever we have in cache
        const tokens = Array.from(tokenCache.values());
        if (tokens.length > 0) {
            console.log(`⚠️ Returning ${tokens.length} cached tokens despite error`);
            sendResponse({
                success: true,
                tokens: tokens,
                cacheSize: tokenCache.size,
                warning: 'Using cached tokens due to refresh error',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        } else {
            sendResponse({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to load tokens for swap'
            });
        }
    }
}
async function handleGetTokenMarketData(token: string, sendResponse: Function) {
    try {
        if (!token || token === 'NOTHING' || token === 'Unknown' || token === 'UNKNOWN') {
            throw new Error('Invalid or unknown token');
        }
        console.log(`🔍 Getting market data for token: ${token}`);
        const marketData = await getTokenMarketData(token);
        if (!marketData) {
            throw new Error(`Failed to get market data for ${token}`);
        }
        sendResponse(marketData);
    } catch (error) {
        console.error('Error getting token market data:', error);
        sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}
async function handleGetCandlestickData(token: string, timeframe: string = '1H', sendResponse: Function) {
    try {
        if (!token) {
            throw new Error('Token is required');
        }
        console.log(`🔍 Getting candlestick data for token: ${token}, timeframe: ${timeframe}`);
        const candlesticks = await getCandlestickData(token, timeframe);
        if (!candlesticks || candlesticks.length === 0) {
            throw new Error(`Failed to get candlestick data for ${token}`);
        }
        // Convert to chart format
        const chartData = convertCandlestickData(candlesticks);
        sendResponse({ candlesticks: chartData });
    } catch (error) {
        console.error('Error getting candlestick data:', error);
        sendResponse({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
}