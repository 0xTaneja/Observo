import { detectAll } from "./detector";
import { DetectedContent } from "../types";
import { displayTradingSignal } from "./ui-overlay";

// Processing queue to prevent overwhelming the background script
const processingQueue = new Set<string>();
const processedTweets = new Set<string>();
let isProcessing = false;
let extensionContextValid = true;
let lastHealthCheck = Date.now();

// Health check interval (every 30 seconds)
const HEALTH_CHECK_INTERVAL = 30000;

function init(){
    console.log('QuickAlpha Content Script Initialized');

    processExistingTweets();

    setupTwitterObserver();


    setupMessageListener();
    
    // Start periodic health checks
    startHealthCheck();
}

function processExistingTweets(){
    const tweets = document.querySelectorAll('[data-testid="tweet"]');
    tweets.forEach(tweet=>processTweet(tweet as HTMLElement));

}

function setupTwitterObserver() {
    let processingQueue: HTMLElement[] = [];
    let isProcessing = false;

    const processQueue = async () => {
        if (isProcessing || processingQueue.length === 0) {
            return;
        }

        isProcessing = true;
        const tweetsToProcess = processingQueue.splice(0, 5); // Process max 5 at a time
        
        for (const tweet of tweetsToProcess) {
            processTweet(tweet);
            await new Promise(resolve => setTimeout(resolve, 50)); // Small delay between processing
        }
        
        isProcessing = false;
        
        // Process remaining queue
        if (processingQueue.length > 0) {
            setTimeout(processQueue, 100);
        }
    };

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const element = node as HTMLElement;

                    const tweet = element.querySelector('[data-testid="tweet"]') || 
                    (element.matches('[data-testid="tweet"]') ? element : null);
       
                    if (tweet && !processingQueue.includes(tweet as HTMLElement)) {
                        processingQueue.push(tweet as HTMLElement);
                    }
                }
            });
        });

        // Start processing if not already running
        processQueue();
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
            return;
        }

        const tweetText = extractTweetText(tweetElement);
        if (!tweetText || tweetText.length < 10) { // Minimum text length check
            return;
        }

        // Add to processing queue to prevent duplicates
        processingQueue.add(tweetId);

        const detectedContent = detectAll(tweetText);

        if (hasRelevantContent(detectedContent)) {
            processedTweets.add(tweetId);

            // Reduced delay for faster processing
            setTimeout(() => {
                sendMessageWithRetry({
                    type: 'ANALYZE_CONTENT',
                    data: {
                        content: detectedContent,
                        tweetId: tweetId,
                        tweetElement: null // Don't pass large objects for better performance
                    }
                }, (response) => {
                    if (response && response.success) {
                        console.log('Successfully sent content for analysis');
                    } else if (response && response.error) {
                        console.warn('Analysis failed:', response.error);
                    }
                    
                    // Remove from processing queue
                    processingQueue.delete(tweetId);
                });
            }, 50); // Reduced delay from 100ms to 50ms for faster processing

            console.log('Detected content in tweet:', detectedContent);
        } else {
            // Remove from queue if no relevant content
            processingQueue.delete(tweetId);
        }
    }
    catch (error) {
        console.error('Error processing tweet:', error);
        // Remove from queue on error
        const tweetId = generateTweetId(tweetElement);
        processingQueue.delete(tweetId);
    }
}

function extractTweetText(tweetElement:HTMLElement):string{

    const textSelectors = [
        '[data-testid="tweetText"]',
        '[lang]', // Tweets have lang attribute
        '.css-901oao' // Fallback class name
    ];

    for (const selector of textSelectors){
        const textElement = tweetElement.querySelector(selector);
        if(textElement?.textContent){
            return textElement.textContent.trim();
        }
    }
    return '';
}

function generateTweetId(tweetElement:HTMLElement):string{
    const link = tweetElement.querySelector('a[href*="/status/"]');
    if (link) {
      const href = (link as HTMLAnchorElement).href;
      const statusMatch = href.match(/\/status\/(\d+)/);
      if (statusMatch) return statusMatch[1];
    }
    
    // Fallback: use text content hash
    const text = extractTweetText(tweetElement);
    return `tweet_${hashString(text)}`;
}

// Simple string hash function
function hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }


function hasRelevantContent(content:DetectedContent):boolean{
    return content.tokens.length > 0 || 
    content.wallets.length > 0 || 
    content.hypeLanguage.length > 0;
}
function setupMessageListener(){
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        console.log('Content script received message:', message.type, message);
        
        if (message.type === 'DISPLAY_SIGNAL') {
            const { signal, tweetId, content } = message.data;
            console.log('Attempting to display signal overlay:', { signal, tweetId, content });
            
            try {
                // Call the new simplified overlay function
                displayTradingSignal(signal, tweetId, content);
                console.log('Signal overlay displayed successfully');
                sendResponse({ success: true });
            } catch (error) {
                console.error('Error displaying signal overlay:', error);
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                sendResponse({ success: false, error: errorMessage });
            }
        }
        
        return true;
    });
}

// Robust message sending with retry logic and error handling
function sendMessageWithRetry(message: any, callback?: (response: any) => void, retries = 3): void {
    // Always try to send first, don't pre-check extensionContextValid
    console.log('Sending message for analysis:', message.type);
    
    try {
        chrome.runtime.sendMessage(message, (response: any) => {
            const lastError = chrome.runtime.lastError;
            
            if (lastError) {
                console.warn('Runtime message error:', lastError.message);
                
                // Handle specific error types
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
                    // Other types of errors - still call callback
                    console.warn('Other message error:', lastError.message);
                    if (callback) {
                        callback({ success: false, error: lastError.message });
                    }
                }
            } else {
                // Success - mark context as valid and call callback
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
        
        // Retry if we have attempts left
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
            
            // Test the connection with a ping, but don't fail immediately
            chrome.runtime.sendMessage({ type: 'PING' }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn('Health check ping failed:', chrome.runtime.lastError.message);
                    // Don't immediately set to false, let the actual message sending handle errors
                } else {
                    extensionContextValid = true;
                    console.log('Health check passed');
                }
            });
        } else {
            console.warn('Chrome runtime not available during health check');
            // Don't immediately set to false
        }
    } catch (error) {
        console.warn('Health check error:', error);
        // Don't immediately set to false
    }
}

if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
}else{
    init();
}