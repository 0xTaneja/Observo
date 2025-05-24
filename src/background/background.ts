import { DetectedContent, TradingSignal } from "../types";

const config = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
    OKX_API_KEY: process.env.OKX_API_KEY || '',
    OKX_SECRET_KEY: process.env.OKX_SECRET_KEY || '',
    OKX_PASSPHRASE: process.env.OKX_PASSPHRASE || '',
    OKX_BASE_URL: 'https://www.okx.com'
}

chrome.runtime.onInstalled.addListener(() => {
    console.log('QuickAlpha Background Script Installed');
    console.log('OpenAI API configured:', !!config.OPENAI_API_KEY);
})

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Background received message:', message.type);

    if (message.type === 'ANALYZE_CONTENT') {
        handleContentAnalysis(message.data, sender, sendResponse);
        return true; // Keep message channel open for async response
    }
    
    if (message.type === 'PING') {
        // Health check response
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
    // Store user preferences (like enabled state)
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

        // Fast analysis - prioritize speed over comprehensive market data
      const signal = await generateTradingSignal(content);

        // Store the signal with content details
        await storeSignal(signal, content);
        
        // Update statistics
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
            token: signal.token || 'Unknown',
            action: signal.action,
            confidence: signal.confidence,
            timestamp: Date.now(),
            explanation: signal.explanation,
            // Store full content details for detailed view
            content: content ? {
                fullText: content.fullText,
                tokens: content.tokens,
                wallets: content.wallets,
                hypeLanguage: content.hypeLanguage
            } : null
        };

        // Get existing signals
        const result = await chrome.storage.local.get(['recentSignals']);
        const signals = result.recentSignals || [];
        
        // Add new signal to the beginning
        signals.unshift(recentSignal);
        
        // Keep only last 50 signals
        const limitedSignals = signals.slice(0, 50);
        
        // Store updated signals
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
            accuracy: 0 // Will be calculated based on real performance data
        };

        // Update counts only - no mock accuracy
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

        // Real accuracy would need to be calculated based on actual trading outcomes
        // For now, just keep existing accuracy value
        await chrome.storage.local.set({ stats: currentStats });
        
        console.log('Stats updated:', currentStats);
    } catch (error) {
        console.error('Error updating stats:', error);
    }
}

async function generateTradingSignal(content: DetectedContent): Promise<TradingSignal> {
    try {
        // Only use real OpenAI analysis - no fallbacks
        return await generateOpenAISignal(content);
    }
    catch (error) {
        console.error('Error generating trading signal', error);
        // Return error signal instead of mock analysis
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

    const prompt = `Analyze this crypto tweet and provide a BALANCED trading signal:

Tweet: "${content.fullText}"
Tokens: ${content.tokens.map(t => t.symbol).join(', ')}
Hype words: ${content.hypeLanguage.join(', ')}

IMPORTANT: Be objective and realistic. Don't just recommend BUY for everything. Consider:

SELL signals for:
- Overvalued tokens, market tops, profit-taking scenarios
- Bearish technical patterns, negative news
- Risk-off sentiment, regulatory concerns

AVOID signals for:
- Scam indicators (rug, honeypot, unverified projects)
- Excessive hype without fundamentals
- Market manipulation attempts
- Unknown or suspicious tokens

BUY signals for:
- Strong fundamentals with good entry points
- Genuine bullish momentum with solid backing
- Established projects with positive catalysts

Respond with JSON only:
{
  "action": "BUY|SELL|AVOID", 
  "confidence": 1-10,
  "reason": "Clear, specific explanation for this recommendation"
}

Be critical and analytical. Avoid being overly bullish.`;

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
            temperature: 0.7
        })
    });

    if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content || '';
    
    console.log('OpenAI Response:', aiResponse);
    
    return parseOpenAIResponse(aiResponse, content);
}

function parseOpenAIResponse(response: string, content: DetectedContent): TradingSignal {
    try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0]);
            return {
                action: parsed.action || 'AVOID',
                confidence: parsed.confidence || 5,
                explanation: parsed.reason || 'AI analysis completed',
                token: content.tokens[0]?.symbol
            };
        }
    } catch (error) {
        console.error('Error parsing OpenAI response:', error);
    }
    
    throw new Error('Could not parse OpenAI response');
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
        sendResponse({ success: true, stats: result.stats || {
            totalSignals: 0,
            buySignals: 0,
            sellSignals: 0,
            avoidSignals: 0,
            accuracy: 0
        }});
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