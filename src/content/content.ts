import { detectAll } from "./detector";
import { DetectedContent } from "../types";
import { displayTradingSignal, displayTradingSignalDirect } from "./ui-overlay";
const processingQueue = new Set<string>();
const processedTweets = new Set<string>();
const tweetElementMap = new Map<string, HTMLElement>();
let isProcessing = false;
let extensionContextValid = true;
let lastHealthCheck = Date.now();
const HEALTH_CHECK_INTERVAL = 30000;
let walletConnected = false;
let walletAddress: string | null = null;
let walletProvider: string | null = null;
declare global {
    interface Window {
        okxwallet?: {
            solana?: {
                connect(): Promise<{ publicKey: { toString(): string } }>;
            };
        };
        phantom?: {
            solana?: {
                connect(): Promise<{ publicKey: { toString(): string } }>;
            };
        };
        solflare?: {
            isSolflare: boolean;
            connect(): Promise<{ publicKey: { toString(): string } }>;
        };
        ethereum?: {
        };
    }
}
function initializeWalletState() {
    chrome.storage.local.get(['walletConnected', 'walletAddress', 'walletProvider'], (result) => {
        if (result.walletConnected && result.walletAddress && result.walletProvider) {
            walletConnected = result.walletConnected;
            walletAddress = result.walletAddress;
            walletProvider = result.walletProvider;
            console.log('🔍 Loaded wallet state from storage:', {
                connected: walletConnected,
                address: walletAddress?.substring(0, 8) + '...',
                provider: walletProvider
            });
        } else {
            console.log('🔍 No wallet state found in storage');
        }
    });
}
function checkWalletAvailability() {
    console.log('🔍 Checking wallet availability...');
    window.postMessage({
        type: 'QUICKALPHA_CHECK_WALLETS',
        payload: {}
    }, '*');
    const messageHandler = (event: MessageEvent) => {
        if (event.source !== window) return;
        const { type, payload } = event.data;
        if (type === 'QUICKALPHA_WALLET_STATUS') {
            window.removeEventListener('message', messageHandler);
            console.log('📊 Wallet status:', payload);
            if (payload.isConnected) {
                console.log('✅ Wallet is already connected:', payload.currentProvider);
                walletConnected = true;
                walletProvider = payload.currentProvider;
                chrome.storage.local.set({
                    walletConnected: true,
                    walletProvider: payload.currentProvider
                });
            } else {
                const availableWallets = [];
                if (payload.okx.available) availableWallets.push('OKX');
                if (payload.phantom.available) availableWallets.push('Phantom');
                if (payload.solflare.available) availableWallets.push('Solflare');
                if (availableWallets.length > 0) {
                    console.log('🔍 Found available wallets:', availableWallets.join(', '));
                } else {
                    console.log('⚠️ No compatible wallets found');
                }
            }
        }
    };
    window.addEventListener('message', messageHandler);
    setTimeout(() => {
        window.removeEventListener('message', messageHandler);
    }, 5000);
}
function init() {
    console.log('QuickAlpha Content Script Initialized');
    injectWalletBridge();
    initializeWalletState();
    const bridgeReadyTimeout = setTimeout(() => {
        console.log('⚠️ Wallet bridge ready timeout - checking wallets anyway');
        checkWalletAvailability();
    }, 2000);
    const messageHandler = (event: MessageEvent) => {
        if (event.source !== window) return;
        const { type, payload } = event.data;
        if (type === 'QUICKALPHA_INJECTED_READY') {
            console.log('✅ Wallet bridge script is ready');
            clearTimeout(bridgeReadyTimeout);
            window.removeEventListener('message', messageHandler);
            setTimeout(() => {
                checkWalletAvailability();
            }, 500);
        }
    };
    window.addEventListener('message', messageHandler);
    processExistingTweets();
    setupTwitterObserver();
    setupMessageListener();
    startHealthCheck();
    setupWalletInjectionListeners();
}
function injectWalletBridge() {
    console.log('💉 Injecting wallet bridge script into page context...');
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.type = 'text/javascript';
    script.async = false;
    (document.head || document.documentElement).appendChild(script);
    script.onload = () => {
        console.log('✅ Wallet bridge script injected successfully');
        script.remove();
    };
    script.onerror = () => {
        console.error('❌ Failed to inject wallet bridge script');
        script.remove();
    };
}
function processExistingTweets() {
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    tweets.forEach(tweet => processTweet(tweet as HTMLElement));
}
function setupTwitterObserver() {
    let processingQueue: HTMLElement[] = [];
    let isProcessing = false;
    let processedElements = new WeakSet<HTMLElement>(); 
    const processQueue = async () => {
        if (isProcessing || processingQueue.length === 0) {
            return;
        }
        isProcessing = true;
        const tweetsToProcess = processingQueue.splice(0, 3); 
        for (const tweet of tweetsToProcess) {
            if (!processedElements.has(tweet)) {
                processedElements.add(tweet);
                processTweet(tweet);
                await new Promise(resolve => setTimeout(resolve, 100)); 
            }
        }
        isProcessing = false;
        if (processingQueue.length > 0) {
            setTimeout(processQueue, 200); 
        }
    };
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as HTMLElement;
                    const tweet = element.querySelector('[data-testid="tweet"]') ||
                        (element.matches('[data-testid="tweet"]') ? element : null);
                    if (tweet &&
                        !processedElements.has(tweet as HTMLElement) &&
                        !processingQueue.includes(tweet as HTMLElement)) {
                        const existingOverlay = (tweet as HTMLElement).querySelector('.quickalpha-overlay');
                        const existingProcessing = (tweet as HTMLElement).querySelector('.quickalpha-processing');
                        if (!existingOverlay && !existingProcessing) {
                            processingQueue.push(tweet as HTMLElement);
                        }
                    }
                }
            });
        });
        if (!isProcessing && processingQueue.length > 0) {
            setTimeout(processQueue, 100); 
        }
    });
    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}
function processTweet(tweetElement: HTMLElement) {
    try {
        const tweetId = generateTweetId(tweetElement);
        if (processedTweets.has(tweetId) || processingQueue.has(tweetId)) {
            console.log('Tweet already processed or in queue:', tweetId);
            return;
        }
        const existingOverlay = tweetElement.querySelector('.quickalpha-overlay');
        if (existingOverlay) {
            console.log('Overlay already exists for tweet:', tweetId);
            return;
        }
        const tweetText = extractTweetText(tweetElement);
        if (!tweetText || tweetText.length < 10) { 
            return;
        }
        tweetElementMap.set(tweetId, tweetElement);
        processingQueue.add(tweetId);
        console.log('Processing tweet:', tweetId, 'Queue size:', processingQueue.size);
        const detectedContent = detectAll(tweetText);
        if (hasRelevantContent(detectedContent)) {
            processedTweets.add(tweetId);
            addProcessingIndicator(tweetElement, tweetId);
            sendMessageWithRetry({
                type: 'ANALYZE_CONTENT',
                data: {
                    content: detectedContent,
                    tweetId: tweetId,
                    tweetText: tweetText, 
                    timestamp: Date.now() 
                }
            }, (response) => {
                removeProcessingIndicator(tweetElement);
                if (response && response.success) {
                    console.log('Successfully sent content for analysis');
                } else if (response && response.error) {
                    console.warn('Analysis failed:', response.error);
                    tweetElementMap.delete(tweetId);
                }
                processingQueue.delete(tweetId);
            });
            console.log('Detected content in tweet:', detectedContent);
        } else {
            processingQueue.delete(tweetId);
            tweetElementMap.delete(tweetId);
        }
    }
    catch (error) {
        console.error('Error processing tweet:', error);
        const tweetId = generateTweetId(tweetElement);
        processingQueue.delete(tweetId);
        tweetElementMap.delete(tweetId);
    }
}
function extractTweetText(tweetElement: HTMLElement): string {
    const textSelectors = [
        '[data-testid="tweetText"]',
        '[lang]', 
        '.css-901oao' 
    ];
    for (const selector of textSelectors) {
        const textElement = tweetElement.querySelector(selector);
        if (textElement?.textContent) {
            return textElement.textContent.trim();
        }
    }
    return '';
}
function generateTweetId(tweetElement: HTMLElement): string {
    const link = tweetElement.querySelector('a[href*="/status/"]');
    if (link) {
        const href = (link as HTMLAnchorElement).href;
        const statusMatch = href.match(/\/status\/(\d+)/);
        if (statusMatch) {
            return `tweet_${statusMatch[1]}`;
        }
    }
    const text = extractTweetText(tweetElement);
    const timeElement = tweetElement.querySelector('time');
    const timestamp = timeElement ? timeElement.getAttribute('datetime') || timeElement.textContent : '';
    const uniqueString = `${text}_${timestamp}_${tweetElement.getBoundingClientRect().top}`;
    return `tweet_${hashString(uniqueString)}`;
}
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; 
    }
    return Math.abs(hash).toString();
}
function hasRelevantContent(content: DetectedContent): boolean {
    return content.tokens.length > 0 ||
        content.wallets.length > 0 ||
        content.hypeLanguage.length >= 2; 
}
function setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Content script received message:', message.type, message);
        if (message.type === 'DISPLAY_SIGNAL') {
            const { signal, tweetId, content } = message.data;
            console.log('Attempting to display signal overlay:', { signal, tweetId, content });
            try {
                const storedTweetElement = tweetElementMap.get(tweetId);
                if (storedTweetElement && document.contains(storedTweetElement)) {
                    console.log('Using stored tweet element for overlay display');
                    displayTradingSignalDirect(signal, tweetId, content, storedTweetElement);
                    sendResponse({ success: true });
                } else {
                    console.log('Stored tweet element not found, falling back to search');
                    displayTradingSignal(signal, tweetId, content);
                    sendResponse({ success: true });
                }
                console.log('Signal overlay displayed successfully');
            } catch (error) {
                console.error('Error displaying signal overlay:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                sendResponse({ success: false, error: errorMessage });
            }
        }
        if (message.type === 'CONNECT_WALLET_REQUEST') {
            connectWalletOnTwitter().then(result => {
                sendResponse(result);
            }).catch(error => {
                sendResponse({ success: false, error: error.message });
            });
            return true; 
        }
        return true;
    });
}
function sendMessageWithRetry(message: any, callback?: (response: any) => void, retries = 3): void {
    console.log('Sending message for analysis:', message.type);
    try {
        chrome.runtime.sendMessage(message, (response: any) => {
            const lastError = chrome.runtime.lastError;
            if (lastError) {
                console.warn('Runtime message error:', lastError.message);
                if (lastError.message && (lastError.message.includes('Extension context invalidated') ||
                    lastError.message.includes('receiving end does not exist') ||
                    lastError.message.includes('message port closed'))) {
                    extensionContextValid = false;
                    if (retries > 0) {
                        console.log(`Retrying message in 2000ms, ${retries} attempts remaining`);
                        setTimeout(() => {
                            sendMessageWithRetry(message, callback, retries - 1);
                        }, 2000);
                        return;
                    } else {
                        console.error('Failed to send message after all retries');
                    }
                } else {
                    console.warn('Other message error:', lastError.message);
                    if (callback) {
                        callback({ success: false, error: lastError.message });
                    }
                }
            } else {
                extensionContextValid = true;
                console.log('Message sent successfully');
                if (callback) {
                    callback(response);
                }
            }
        });
    } catch (error) {
        console.error('Error sending message:', error);
        extensionContextValid = false;
        if (retries > 0 && error instanceof Error &&
            error.message.includes('Extension context invalidated')) {
            setTimeout(() => {
                sendMessageWithRetry(message, callback, retries - 1);
            }, 2000);
        }
    }
}
function startHealthCheck() {
    setInterval(() => {
        checkExtensionHealth();
    }, HEALTH_CHECK_INTERVAL);
}
function checkExtensionHealth() {
    try {
        if (chrome.runtime && chrome.runtime.id) {
            lastHealthCheck = Date.now();
            chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('Health check ping failed:', chrome.runtime.lastError.message);
                } else {
                    extensionContextValid = true;
                    console.log('Health check passed');
                }
            });
        } else {
            console.warn('Chrome runtime not available during health check');
        }
    } catch (error) {
        console.warn('Health check error:', error);
    }
}
async function connectWalletOnTwitter() {
    console.log('🔗 Attempting wallet connection via page bridge...');
    return new Promise((resolve, reject) => {
        const messageHandler = (event: MessageEvent) => {
            if (event.source !== window) return;
            const { type, payload } = event.data;
            if (type === 'QUICKALPHA_WALLET_CONNECTED') {
                console.log('✅ Wallet connected via page bridge!', payload);
                window.removeEventListener('message', messageHandler);
                walletConnected = true;
                walletAddress = payload.address;
                walletProvider = payload.provider;
                chrome.storage.local.set({
                    walletConnected: true,
                    walletAddress: payload.address,
                    walletProvider: payload.provider
                });
                showSuccessNotification(`${payload.provider.toUpperCase()} Wallet connected successfully!`);
                resolve({
                    success: true,
                    walletAddress: payload.address,
                    walletProvider: payload.provider
                });
            }
            if (type === 'QUICKALPHA_WALLET_ERROR') {
                console.error('❌ Wallet connection failed via page bridge:', payload.error);
                window.removeEventListener('message', messageHandler);
                showErrorNotification(`Wallet connection failed: ${payload.error}`);
                reject(new Error(payload.error));
            }
        };
        window.addEventListener('message', messageHandler);
        window.postMessage({
            type: 'QUICKALPHA_CONNECT_WALLET',
            payload: {}
        }, '*');
        setTimeout(() => {
            window.removeEventListener('message', messageHandler);
            reject(new Error('Wallet connection timeout - no response from page context'));
        }, 30000);
    });
}
function showSuccessNotification(message: string) {
    showNotification(message, '#16a34a');
}
function showErrorNotification(message: string) {
    showNotification(message, '#dc2626');
}
function showNotification(message: string, color: string) {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${color};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        z-index: 10001;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.remove();
    }, 5000);
}
function setupWalletInjectionListeners() {
    console.log('📡 Setting up wallet injection listeners...');
    const walletEvents = [
        'okxwallet#initialized',
        'ethereum#initialized',
        'phantom#initialized',
        'solana#initialized',
        'wallet#initialized'
    ];
    walletEvents.forEach(eventName => {
        window.addEventListener(eventName, () => {
            console.log(`🎉 Received wallet event: ${eventName}`);
            setTimeout(() => {
                console.log('Checking wallets after injection event...');
                checkWalletsAfterInjection();
            }, 100);
        });
    });
    if (document.readyState === 'complete') {
        setTimeout(checkWalletsAfterInjection, 1000);
    } else {
        window.addEventListener('load', () => {
            setTimeout(checkWalletsAfterInjection, 1000);
        });
    }
    triggerWalletInjection();
}
function triggerWalletInjection() {
    console.log('🔄 Triggering wallet injection...');
    try {
        const events = [
            new Event('ethereum#initialized'),
            new Event('DOMContentLoaded'),
            new CustomEvent('okxwallet#initialized'),
            new CustomEvent('phantom#initialized')
        ];
        events.forEach(event => {
            window.dispatchEvent(event);
            document.dispatchEvent(event);
        });
    } catch (error) {
        console.log('Error triggering wallet injection:', error);
    }
}
function checkWalletsAfterInjection() {
    console.log('🔍 Checking wallets after injection...');
    console.log('OKX available:', !!window.okxwallet);
    console.log('Phantom available:', !!window.phantom);
    console.log('Ethereum available:', !!window.ethereum);
    console.log('Solflare available:', !!window.solflare);
    if (window.okxwallet || window.phantom || window.solflare) {
        console.log('✅ Wallets detected after injection!');
    }
}
function addProcessingIndicator(tweetElement: HTMLElement, tweetId: string) {
    const existing = tweetElement.querySelector('.quickalpha-processing');
    if (existing) {
        existing.remove();
    }
    const indicator = document.createElement('div');
    indicator.className = 'quickalpha-processing';
    indicator.setAttribute('data-tweet-id', tweetId);
    indicator.style.cssText = `
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: rgba(99, 102, 241, 0.1);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 8px;
        padding: 4px 8px;
        font-size: 11px;
        color: #6366f1;
        margin-top: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    indicator.innerHTML = `
        <div style="width: 12px; height: 12px; border: 2px solid rgba(99, 102, 241, 0.3); border-top: 2px solid #6366f1; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        Analyzing...
    `;
    if (!document.getElementById('quickalpha-spinner-styles')) {
        const spinnerStyles = document.createElement('style');
        spinnerStyles.id = 'quickalpha-spinner-styles';
        spinnerStyles.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(spinnerStyles);
    }
    const tweetTextElement = tweetElement.querySelector('[data-testid="tweetText"]');
    if (tweetTextElement && tweetTextElement.parentNode) {
        tweetTextElement.parentNode.insertBefore(indicator, tweetTextElement.nextSibling);
    } else {
        tweetElement.appendChild(indicator);
    }
}
function removeProcessingIndicator(tweetElement: HTMLElement) {
    const indicator = tweetElement.querySelector('.quickalpha-processing');
    if (indicator) {
        indicator.remove();
    }
}
function cleanupTweetElements(): void {
    tweetElementMap.forEach((element, tweetId) => {
        if (!document.contains(element)) {
            tweetElementMap.delete(tweetId);
            processedTweets.delete(tweetId);
            processingQueue.delete(tweetId);
        }
    });
    console.log('Tweet element map size after cleanup:', tweetElementMap.size);
}
setInterval(cleanupTweetElements, 10000); 
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}