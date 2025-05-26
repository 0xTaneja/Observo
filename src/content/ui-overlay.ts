import { TradingSignal, DetectedContent } from "../types";
interface SignalOverlayData {
  signal: TradingSignal;
  tweetId: string;
  content: any;
}
const activeOverlays = new Map<string, {
  element: HTMLElement;
  observer?: IntersectionObserver;
  tweetElement: HTMLElement;
}>();
let visibilityObserver: IntersectionObserver | null = null;
export function displayTradingSignal(signal: TradingSignal, tweetId: string, content: DetectedContent): void {
  console.log('Attempting to display signal overlay:', { signal, tweetId, content });
  addOverlayStyles();
  const tweetElement = findTweetElement(tweetId);
  if (!tweetElement) {
    console.error('Tweet element not found for ID:', tweetId);
    return;
  }
  displayTradingSignalDirect(signal, tweetId, content, tweetElement);
}
export function displayTradingSignalDirect(signal: TradingSignal, tweetId: string, content: DetectedContent, tweetElement: HTMLElement): void {
  console.log('Displaying signal overlay directly on element:', { signal, tweetId, content });
  addOverlayStyles();
  const existingOverlay = tweetElement.querySelector('.quickalpha-overlay');
  const existingProcessing = tweetElement.querySelector('.quickalpha-processing');
  if (existingOverlay) {
    console.log('Overlay already exists for tweet, skipping:', tweetId);
    return;
  }
  if (existingProcessing) {
    existingProcessing.remove();
  }
  removeExistingOverlay(tweetId);
  const overlay = createOptimizedOverlay(signal, content, tweetId);
  insertOverlayOptimized(overlay, tweetElement);
  setupOverlayVisibility(overlay, tweetElement, tweetId);
  activeOverlays.set(tweetId, {
    element: overlay,
    tweetElement: tweetElement
  });
  requestAnimationFrame(() => {
    overlay.classList.add('show');
  });
  console.log('Signal overlay displayed successfully for tweet:', tweetId);
}
function removeExistingOverlay(tweetId: string): void {
  const existing = activeOverlays.get(tweetId);
  if (existing) {
    existing.observer?.disconnect();
    existing.element.remove();
    activeOverlays.delete(tweetId);
  }
}
function createOptimizedOverlay(signal: TradingSignal, content: DetectedContent, tweetId: string): HTMLElement {
  const overlay = document.createElement('div');
  overlay.className = 'quickalpha-overlay';
  overlay.setAttribute('data-tweet-id', tweetId);
  const compactCard = document.createElement('div');
  compactCard.className = 'quickalpha-compact';
  const actionElement = document.createElement('div');
  actionElement.className = `quickalpha-action ${signal.action.toLowerCase()}`;
  actionElement.textContent = signal.action;
  const reasonElement = document.createElement('div');
  reasonElement.className = 'quickalpha-reason';
  const shortReason = signal.explanation?.split('.')[0] || 'Analysis complete';
  reasonElement.textContent = shortReason.length > 20 ? shortReason.slice(0, 20) + '...' : shortReason;
  const confidenceElement = document.createElement('div');
  confidenceElement.className = 'quickalpha-confidence';
  confidenceElement.textContent = `${signal.confidence}/10`;
  const tradingButtons = document.createElement('div');
  tradingButtons.className = 'quickalpha-trading-buttons';
  if (signal.action.toLowerCase() === 'buy' || signal.action.toLowerCase() === 'sell') {
    const tradeButton = document.createElement('button');
    tradeButton.className = `quickalpha-trade-btn ${signal.action.toLowerCase()}`;
    tradeButton.innerHTML = signal.action.toLowerCase() === 'buy' ? '🚀 BUY' : '📉 SELL';
    tradeButton.onclick = (e) => {
      e.stopPropagation();
      showTradeModal(signal, content);
    };
    tradingButtons.appendChild(tradeButton);
  }
  compactCard.appendChild(actionElement);
  compactCard.appendChild(reasonElement);
  compactCard.appendChild(confidenceElement);
  compactCard.appendChild(tradingButtons);
  compactCard.addEventListener('click', (e) => {
    if (!(e.target as HTMLElement).classList.contains('quickalpha-trade-btn')) {
      showDetailModal(signal, content);
    }
  });
  overlay.appendChild(compactCard);
  return overlay;
}
function insertOverlayOptimized(overlay: HTMLElement, tweetElement: HTMLElement): void {
  const tweetTextElement = tweetElement.querySelector('[data-testid="tweetText"]');
  const tweetContentElement = tweetElement.querySelector('[data-testid="tweetText"]')?.parentElement;
  if (tweetTextElement && tweetTextElement.parentNode) {
    tweetTextElement.parentNode.insertBefore(overlay, tweetTextElement.nextSibling);
  } else if (tweetContentElement) {
    tweetContentElement.appendChild(overlay);
  } else {
    tweetElement.appendChild(overlay);
  }
}
function setupOverlayVisibility(overlay: HTMLElement, tweetElement: HTMLElement, tweetId: string): void {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        overlay.style.display = 'block';
      } else {
        overlay.style.display = 'none';
      }
    });
  }, {
    threshold: 0.1,
    rootMargin: '50px'
  });
  observer.observe(tweetElement);
  const overlayData = activeOverlays.get(tweetId);
  if (overlayData) {
    overlayData.observer = observer;
  }
}
function cleanupOverlays(): void {
  activeOverlays.forEach((overlayData, tweetId) => {
    if (!document.contains(overlayData.tweetElement)) {
      overlayData.observer?.disconnect();
      overlayData.element.remove();
      activeOverlays.delete(tweetId);
}
  });
}
setInterval(cleanupOverlays, 5000); 
function findTweetElement(tweetId: string): HTMLElement | null {
  console.log('Looking for tweet with ID:', tweetId);
  const actualTweetId = tweetId.startsWith('tweet_') ? tweetId.substring(6) : tweetId;
  const tweets = document.querySelectorAll('[data-testid="tweet"]');
  console.log('Found', tweets.length, 'tweets on page');
  for (const tweet of tweets) {
    const tweetElement = tweet as HTMLElement;
    const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
    if (tweetLink) {
      const href = (tweetLink as HTMLAnchorElement).href;
      const statusMatch = href.match(/\/status\/(\d+)/);
      if (statusMatch && statusMatch[1] === actualTweetId) {
        console.log('Found tweet by URL match:', statusMatch[1]);
        return tweetElement;
      }
    }
    }
  if (actualTweetId.length < 10) { 
    console.log('Hash-based ID detected, searching by content...');
    for (const tweet of tweets) {
      const tweetElement = tweet as HTMLElement;
      const processingElement = tweetElement.querySelector(`[data-tweet-id="${tweetId}"]`);
      if (processingElement) {
        console.log('Found tweet by processing indicator match');
        return tweetElement;
      }
      const overlayElement = tweetElement.querySelector(`.quickalpha-overlay[data-tweet-id="${tweetId}"]`);
      if (overlayElement) {
        console.log('Found tweet by existing overlay match');
        return tweetElement;
      }
    }
  }
  console.log('Fallback: looking for recent crypto tweet...');
  for (const tweet of tweets) {
    const tweetElement = tweet as HTMLElement;
    const content = tweetElement.textContent?.toLowerCase() || '';
    if (content.includes('$') && 
        !tweetElement.querySelector('.quickalpha-overlay') &&
        !tweetElement.querySelector('.quickalpha-processing')) {
      const cryptoTerms = ['btc', 'eth', 'sol', 'crypto', 'token', 'coin', 'pump', 'moon'];
      const hasCryptoTerms = cryptoTerms.some(term => content.includes(term));
      if (hasCryptoTerms) {
        console.log('Found tweet by crypto content fallback');
      return tweetElement;
      }
    }
  }
  console.log('Tweet element not found for ID:', tweetId);
  return null;
}
function addOverlayStyles() {
  if (document.getElementById('quickalpha-styles')) return;
  const styles = document.createElement('style');
  styles.id = 'quickalpha-styles';
  styles.textContent = `
    .quickalpha-overlay {
      opacity: 0;
      transform: translateY(-5px);
      transition: all 0.15s ease-out;
      margin-top: 8px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 9999;
      position: relative;
      will-change: opacity, transform;
      contain: layout style paint;
    }
    .quickalpha-compact {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: white;
      border-radius: 12px;
      padding: 8px 12px;
      font-size: 12px;
      font-weight: 600;
      border: 2px solid rgba(0, 0, 0, 0.1);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      backdrop-filter: blur(10px);
      cursor: pointer;
      transition: all 0.15s ease-out;
      position: relative;
      will-change: transform, box-shadow;
      contain: layout style paint;
    }
    .quickalpha-compact:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
    }
    .quickalpha-action {
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      min-width: 40px;
      text-align: center;
      flex-shrink: 0;
    }
    .quickalpha-action.buy {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
    }
    .quickalpha-action.sell {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
    }
    .quickalpha-action.avoid {
      background: linear-gradient(135deg, #6b7280, #4b5563);
      color: white;
    }
    .quickalpha-reason {
      color: #475569;
      font-size: 11px;
      font-weight: 500;
      max-width: 120px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      flex-shrink: 1;
    }
    .quickalpha-confidence {
      color: #6366f1;
      font-size: 10px;
      font-weight: 700;
      flex-shrink: 0;
    }
    /* Trading Buttons */
    .quickalpha-trading-buttons {
      display: flex;
      gap: 4px;
      flex-shrink: 0;
    }
    .quickalpha-trade-btn {
      background: none;
      border: 1px solid;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease-out;
      display: flex;
      align-items: center;
      gap: 2px;
      will-change: transform, background-color;
    }
    .quickalpha-trade-btn.buy {
      border-color: #10b981;
      color: #10b981;
      background: rgba(16, 185, 129, 0.1);
    }
    .quickalpha-trade-btn.buy:hover {
      background: #10b981;
      color: white;
      transform: translateY(-1px);
    }
    .quickalpha-trade-btn.sell {
      border-color: #ef4444;
      color: #ef4444;
      background: rgba(239, 68, 68, 0.1);
    }
    .quickalpha-trade-btn.sell:hover {
      background: #ef4444;
      color: white;
      transform: translateY(-1px);
    }
    .quickalpha-overlay.show {
      opacity: 1;
      transform: translateY(0);
    }
    /* Performance optimizations */
    .quickalpha-overlay * {
      box-sizing: border-box;
    }
    /* Reduce repaints during scroll */
    .quickalpha-overlay[style*="display: none"] {
      visibility: hidden;
      pointer-events: none;
    }
    /* Trade Modal styles - optimized */
    .quickalpha-trade-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: all 0.2s ease-out;
      backdrop-filter: blur(4px);
      will-change: opacity, visibility;
    }
    .quickalpha-trade-modal.show {
      opacity: 1;
      visibility: visible;
    }
    .quickalpha-trade-modal-content {
      background: white;
      border-radius: 20px;
      padding: 24px;
      max-width: 480px;
      width: 90%;
      margin: 20px;
      transform: scale(0.95);
      transition: transform 0.2s ease-out;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      position: relative;
      will-change: transform;
    }
    .quickalpha-trade-modal.show .quickalpha-trade-modal-content {
      transform: scale(1);
    }
    .trade-header {
      margin-bottom: 20px;
      text-align: center;
    }
    .trade-header h3 {
      margin: 0 0 12px 0;
      color: #1e293b;
      font-size: 20px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .confidence-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      color: white;
    }
    .trade-explanation {
      background: #f8fafc;
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
      border-left: 4px solid #6366f1;
    }
    .trade-explanation p {
      margin: 0;
      color: #475569;
      font-size: 14px;
      line-height: 1.5;
    }
    .trade-amount-section {
      margin-bottom: 20px;
    }
    .trade-amount-section label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 12px;
    }
    .amount-buttons {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 12px;
    }
    .amount-btn {
      padding: 10px 8px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      background: white;
      font-size: 12px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .amount-btn:hover {
      border-color: #6366f1;
      color: #6366f1;
    }
    .amount-btn.active {
      border-color: #6366f1;
      background: #6366f1;
      color: white;
    }
    #trade-amount {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s ease;
    }
    #trade-amount:focus {
      border-color: #6366f1;
    }
    .trade-settings {
      margin-bottom: 20px;
    }
    .slippage-section label {
      display: block;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
      margin-bottom: 8px;
    }
    #slippage {
      width: 100%;
      padding: 10px 12px;
      border: 2px solid #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      background: white;
      outline: none;
      transition: border-color 0.2s ease;
    }
    #slippage:focus {
      border-color: #6366f1;
    }
    .trade-info {
      background: #f8fafc;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 20px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      margin-bottom: 4px;
    }
    .info-row:last-child {
      margin-bottom: 0;
    }
    .info-row span:first-child {
      color: #64748b;
      font-weight: 500;
    }
    .info-row span:last-child {
      color: #1e293b;
      font-weight: 600;
    }
    .trade-actions {
      display: flex;
      gap: 12px;
    }
    .cancel-trade-btn {
      flex: 1;
      padding: 12px 20px;
      border: 2px solid #e2e8f0;
      border-radius: 12px;
      background: white;
      color: #64748b;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .cancel-trade-btn:hover {
      border-color: #cbd5e1;
      color: #475569;
    }
    .confirm-trade-btn {
      flex: 2;
      padding: 12px 20px;
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
      overflow: hidden;
    }
    .confirm-trade-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .trade-btn-text,
    .trade-btn-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .trade-success {
      text-align: center;
      padding: 20px;
    }
    .success-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    .trade-success h3 {
      color: #10b981;
      font-size: 20px;
      font-weight: 700;
      margin-bottom: 12px;
    }
    .trade-success p {
      color: #64748b;
      margin-bottom: 8px;
      line-height: 1.5;
    }
    .close-success-btn {
      margin-top: 20px;
      padding: 12px 24px;
      background: #10b981;
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .close-success-btn:hover {
      background: #059669;
      transform: translateY(-1px);
    }
    /* Detail Modal styles */
    .quickalpha-modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    }
    .quickalpha-modal.show {
      opacity: 1;
      visibility: visible;
    }
    .quickalpha-modal-content {
      background: white;
      border-radius: 16px;
      padding: 24px;
      max-width: 400px;
      margin: 20px;
      transform: scale(0.9);
      transition: transform 0.3s ease;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      position: relative;
    }
    .quickalpha-modal.show .quickalpha-modal-content {
      transform: scale(1);
    }
    .quickalpha-modal h3 {
      margin: 0 0 16px 0;
      color: #1e293b;
      font-size: 20px;
      font-weight: 700;
    }
    .quickalpha-modal p {
      margin: 8px 0;
      color: #475569;
      line-height: 1.5;
    }
    .detail-trade-section {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
    }
    .detail-trade-btn {
      width: 100%;
      padding: 12px 20px;
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .detail-trade-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }
    .quickalpha-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #6b7280;
      padding: 8px;
      border-radius: 8px;
      transition: all 0.2s ease;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .quickalpha-close:hover {
      background: #f3f4f6;
      color: #374151;
    }
    .loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .trade-modal-header h3 {
      margin: 0;
      font-size: 18px;
      color: #1a1a1a;
    }
    .trade-form {
      padding: 20px 0;
    }
    .amount-input-group {
      margin-bottom: 20px;
    }
    .amount-input-group label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #374151;
    }
    .amount-input {
      width: 100%;
      padding: 12px 16px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      background: #f9fafb;
      color: #1f2937;
      transition: all 0.2s ease;
      box-sizing: border-box;
    }
    .amount-input:focus {
      outline: none;
      border-color: #6366f1;
      background: white;
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }
    .trade-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }
    .trade-btn {
      flex: 1;
      padding: 14px 20px;
      border: none;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      text-transform: uppercase;
    }
    .trade-btn.buy {
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
    }
    .trade-btn.buy:hover {
      background: linear-gradient(135deg, #059669, #047857);
      transform: translateY(-1px);
    }
    .trade-btn.sell {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      color: white;
    }
    .trade-btn.sell:hover {
      background: linear-gradient(135deg, #dc2626, #b91c1c);
      transform: translateY(-1px);
    }
    .cancel-btn {
      flex: 1;
      padding: 14px 20px;
      border: 2px solid #e5e7eb;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      background: white;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .cancel-btn:hover {
      border-color: #d1d5db;
      background: #f9fafb;
      transform: translateY(-1px);
    }
    /* New Swap Interface Styles */
    .swap-header {
      margin-bottom: 20px;
      text-align: center;
    }
    .swap-header h3 {
      margin: 0 0 12px 0;
      color: #1e293b;
      font-size: 20px;
      font-weight: 700;
    }
    .swap-interface {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .swap-section {
      background: #f8fafc;
      border-radius: 12px;
      padding: 16px;
      border: 1px solid #e2e8f0;
    }
    .swap-label {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 600;
      color: #64748b;
    }
    .balance-info {
      font-size: 12px;
      color: #94a3b8;
    }
    .swap-input-container {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
    }
    .swap-amount-input {
      flex: 1;
      border: none;
      background: transparent;
      font-size: 20px;
      font-weight: 600;
      color: #1e293b;
      outline: none;
      padding: 8px 0;
      min-width: 0;
      width: 100%;
    }
    .swap-amount-input::placeholder {
      color: #cbd5e1;
    }
    .swap-amount-input.readonly {
      color: #64748b;
    }
    .token-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      background: white;
      border-radius: 8px;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      min-width: 80px;
      flex-shrink: 0;
    }
    .token-icon-text {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      flex-shrink: 0;
    }
    .token-symbol {
      font-size: 14px;
      font-weight: 600;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 60px;
    }
    .quick-amounts {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .quick-amount-btn {
      flex: 1;
      padding: 6px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: white;
      color: #64748b;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .quick-amount-btn:hover {
      border-color: #6366f1;
      color: #6366f1;
      background: #f0f9ff;
    }
    .swap-arrow-container {
      display: flex;
      justify-content: center;
      margin: -8px 0;
      position: relative;
      z-index: 1;
    }
    .swap-arrow-btn {
      background: white;
      border: 2px solid #e2e8f0;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #64748b;
    }
    .swap-arrow-btn:hover {
      border-color: #6366f1;
      color: #6366f1;
      transform: rotate(180deg);
    }
    .quote-info {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 12px;
      border: 1px solid #e2e8f0;
    }
    .quote-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 4px 0;
      font-size: 14px;
    }
    .quote-row span:first-child {
      color: #64748b;
      font-weight: 500;
    }
    .quote-row span:last-child {
      color: #1e293b;
      font-weight: 600;
    }
    .swap-actions {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 8px;
    }
    .swap-btn {
      width: 100%;
      padding: 16px 24px;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: white;
      position: relative;
      overflow: hidden;
    }
    .swap-btn:hover:not(:disabled) {
      background: linear-gradient(135deg, #4f46e5, #4338ca);
      transform: translateY(-1px);
    }
    .swap-btn:disabled {
      background: #e2e8f0;
      color: #94a3b8;
      cursor: not-allowed;
      transform: none;
    }
    .swap-btn-loading {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .loading-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top: 2px solid white;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(styles);
}
function showTradeModal(signal: TradingSignal, content: DetectedContent): void {
  console.log('🔄 Loading tokens for swap modal...');
  const tokenLoadingTimeout = setTimeout(() => {
    console.warn('⚠️ Token loading timeout - no response after 10 seconds');
  }, 10000);
  chrome.runtime.sendMessage({
    type: 'LOAD_TOKENS_FOR_SWAP'
  }, (response) => {
    clearTimeout(tokenLoadingTimeout);
    if (chrome.runtime.lastError) {
      console.error('❌ Chrome runtime error during token loading:', chrome.runtime.lastError);
      return;
    }
    if (response?.success) {
      console.log(`✅ Tokens loaded for swap: ${response.tokens?.length || 0} tokens`);
      if (response.warning) {
        console.warn('⚠️ Token loading warning:', response.warning);
      }
      if (response.debugInfo) {
        console.log('🔍 Token debug info:', response.debugInfo);
      }
    } else {
      console.error('❌ Failed to load tokens for swap:', response?.error);
    }
  });
  const existingModal = document.querySelector('.quickalpha-trade-modal');
  if (existingModal) {
    existingModal.remove();
  }
  const modal = document.createElement('div');
  modal.className = 'quickalpha-trade-modal';
  const modalContent = document.createElement('div');
  modalContent.className = 'quickalpha-trade-modal-content';
  const actionColor = getActionColor(signal.action);
  const actionEmoji = signal.action.toLowerCase() === 'buy' ? '🚀' : '📉';
  const isBuy = signal.action.toLowerCase() === 'buy';
  const fromToken = isBuy ? 'SOL' : (signal.token || 'TOKEN');
  const toToken = isBuy ? (signal.token || 'TOKEN') : 'SOL';
  modalContent.innerHTML = `
    <button class="quickalpha-close">&times;</button>
    <div class="swap-header">
      <h3>${actionEmoji} Swap ${fromToken} → ${toToken}</h3>
      <div class="confidence-badge" style="background: ${actionColor}">
        ${signal.confidence}/10 Confidence
      </div>
    </div>
    <div class="trade-explanation">
      <p><strong>Signal:</strong> ${signal.explanation}</p>
    </div>
    <div class="swap-interface">
      <!-- From Token Section -->
      <div class="swap-section" id="from-token-section">
        <div class="swap-label">
          <span>From</span>
          <span class="balance-info" id="from-balance">Balance: --</span>
        </div>
        <div class="swap-input-container">
        <input 
          type="number" 
            id="from-amount" 
            placeholder="0.0"
          min="0"
          step="0.000001"
            class="swap-amount-input"
        />
          <div class="token-selector">
            <div class="token-icon-text" style="background: ${getTokenColor(fromToken)}">${fromToken.charAt(0)}</div>
            <span class="token-symbol">${fromToken}</span>
          </div>
        </div>
        <div class="quick-amounts">
          <button class="quick-amount-btn" data-percent="25">25%</button>
          <button class="quick-amount-btn" data-percent="50">50%</button>
          <button class="quick-amount-btn" data-percent="75">75%</button>
          <button class="quick-amount-btn" data-percent="100">MAX</button>
        </div>
      </div>
      <!-- Swap Arrow -->
      <div class="swap-arrow-container">
        <button class="swap-arrow-btn" id="swap-direction">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4"/>
          </svg>
        </button>
      </div>
      <!-- To Token Section -->
      <div class="swap-section" id="to-token-section">
        <div class="swap-label">
          <span>To</span>
          <span class="balance-info" id="to-balance">Balance: --</span>
        </div>
        <div class="swap-input-container">
          <input 
            type="number" 
            id="to-amount" 
            placeholder="0.0"
            readonly
            class="swap-amount-input readonly"
          />
          <div class="token-selector">
            <div class="token-icon-text" style="background: ${getTokenColor(toToken)}">${toToken.charAt(0)}</div>
            <span class="token-symbol">${toToken}</span>
          </div>
        </div>
      </div>
      <!-- Quote Information -->
      <div class="quote-info" id="quote-info" style="display: none;">
        <div class="quote-row">
          <span>Rate</span>
          <span id="exchange-rate">--</span>
        </div>
        <div class="quote-row">
          <span>Price Impact</span>
          <span id="price-impact">--</span>
        </div>
        <div class="quote-row">
          <span>Slippage</span>
          <span>1.0%</span>
        </div>
        <div class="quote-row">
          <span>Network Fee</span>
          <span id="network-fee">--</span>
        </div>
      </div>
      <!-- Swap Button -->
      <div class="swap-actions">
        <button class="swap-btn" id="execute-swap" disabled>
          <span class="swap-btn-text">Enter Amount</span>
          <div class="swap-btn-loading" style="display: none;">
            <div class="loading-spinner"></div>
            Getting Quote...
          </div>
        </button>
        <button class="cancel-btn" id="cancel-swap">Cancel</button>
      </div>
    </div>
  `;
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
  setupSwapModalListeners(modal, signal, content, fromToken, toToken);
}
function setupSwapModalListeners(modal: HTMLElement, signal: TradingSignal, content: DetectedContent, fromToken: string, toToken: string): void {
  const modalContent = modal.querySelector('.quickalpha-trade-modal-content') as HTMLElement;
  const closeBtn = modalContent.querySelector('.quickalpha-close') as HTMLElement;
  const cancelBtn = modalContent.querySelector('#cancel-swap') as HTMLElement;
  const fromAmountInput = modalContent.querySelector('#from-amount') as HTMLInputElement;
  const toAmountInput = modalContent.querySelector('#to-amount') as HTMLInputElement;
  const executeSwapBtn = modalContent.querySelector('#execute-swap') as HTMLButtonElement;
  const swapBtnText = executeSwapBtn.querySelector('.swap-btn-text') as HTMLElement;
  const swapBtnLoading = executeSwapBtn.querySelector('.swap-btn-loading') as HTMLElement;
  const quoteInfo = modalContent.querySelector('#quote-info') as HTMLElement;
  const swapArrowBtn = modalContent.querySelector('#swap-direction') as HTMLElement;
  let currentQuote: any = null;
  let quoteTimeout: NodeJS.Timeout | null = null;
  let currentFromToken = fromToken;
  let currentToToken = toToken;
  const closeModal = () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  };
  closeBtn?.addEventListener('click', closeModal);
  cancelBtn?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeModal();
    }
  });
  swapArrowBtn?.addEventListener('click', () => {
    const tempToken = currentFromToken;
    currentFromToken = currentToToken;
    currentToToken = tempToken;
    updateTokenDisplay();
    fromAmountInput.value = '';
    toAmountInput.value = '';
    quoteInfo.style.display = 'none';
    executeSwapBtn.disabled = true;
    swapBtnText.textContent = 'Enter Amount';
    if (quoteTimeout) {
      clearTimeout(quoteTimeout);
    }
    console.log(`Swapped direction: ${currentFromToken} → ${currentToToken}`);
  });
  function updateTokenDisplay() {
    console.log(`Updating token display: ${currentFromToken} → ${currentToToken}`);
    const fromSection = modalContent.querySelector('#from-token-section');
    const fromTokenIcon = fromSection?.querySelector('.token-icon-text') as HTMLElement;
    const fromTokenSymbol = fromSection?.querySelector('.token-symbol') as HTMLElement;
    if (fromTokenIcon && fromTokenSymbol) {
      fromTokenIcon.textContent = currentFromToken.charAt(0);
      fromTokenIcon.style.background = getTokenColor(currentFromToken);
      fromTokenSymbol.textContent = currentFromToken;
      console.log(`Updated FROM token: ${currentFromToken}`);
    } else {
      console.error('Could not find FROM token elements');
    }
    const toSection = modalContent.querySelector('#to-token-section');
    const toTokenIcon = toSection?.querySelector('.token-icon-text') as HTMLElement;
    const toTokenSymbol = toSection?.querySelector('.token-symbol') as HTMLElement;
    if (toTokenIcon && toTokenSymbol) {
      toTokenIcon.textContent = currentToToken.charAt(0);
      toTokenIcon.style.background = getTokenColor(currentToToken);
      toTokenSymbol.textContent = currentToToken;
      console.log(`Updated TO token: ${currentToToken}`);
    } else {
      console.error('Could not find TO token elements');
    }
    swapBtnText.textContent = `Swap ${currentFromToken} → ${currentToToken}`;
    const headerTitle = modalContent.querySelector('.swap-header h3') as HTMLElement;
    if (headerTitle) {
      const emoji = currentFromToken === 'SOL' ? '🚀' : '📉';
      headerTitle.innerHTML = `${emoji} Swap ${currentFromToken} → ${currentToToken}`;
    }
  }
  const quickAmountBtns = modalContent.querySelectorAll('.quick-amount-btn');
  quickAmountBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const percent = btn.getAttribute('data-percent');
      if (percent === '100') {
        fromAmountInput.value = '1.0'; 
      } else {
        const amount = (parseFloat(percent || '0') / 100) * 1.0; 
        fromAmountInput.value = amount.toString();
      }
      fromAmountInput.dispatchEvent(new Event('input'));
    });
  });
  fromAmountInput.addEventListener('input', () => {
    const amount = parseFloat(fromAmountInput.value);
    if (quoteTimeout) {
      clearTimeout(quoteTimeout);
    }
    if (!amount || amount <= 0) {
      toAmountInput.value = '';
      quoteInfo.style.display = 'none';
      executeSwapBtn.disabled = true;
      swapBtnText.textContent = 'Enter Amount';
      return;
    }
    swapBtnText.style.display = 'none';
    swapBtnLoading.style.display = 'flex';
    executeSwapBtn.disabled = true;
    quoteTimeout = setTimeout(async () => {
      try {
        await fetchQuote(amount, currentFromToken, currentToToken);
      } catch (error) {
        console.error('Quote fetch failed:', error);
        showQuoteError(error instanceof Error ? error.message : 'Failed to get quote');
    }
    }, 500); 
  });
  executeSwapBtn.addEventListener('click', async () => {
    if (!currentQuote || executeSwapBtn.disabled) return;
    const amount = parseFloat(fromAmountInput.value);
    swapBtnText.textContent = 'Preparing Trade...';
    swapBtnText.style.display = 'block';
    swapBtnLoading.style.display = 'none';
    executeSwapBtn.disabled = true;
    try {
      const updatedSignal = {
        ...signal,
        action: currentFromToken === 'SOL' ? 'BUY' : 'SELL',
        token: currentFromToken === 'SOL' ? currentToToken : currentFromToken
      };
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'EXECUTE_TRADE',
          data: {
            signal: updatedSignal,
            amount: amount,
            slippage: 0.01, 
            timestamp: Date.now()
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      if (response.success) {
        await showTransactionSigningModal(response.transaction);
        closeModal();
      } else {
        throw new Error(response.error || 'Trade execution failed');
      }
    } catch (error) {
      console.error('Trade execution failed:', error);
      alert(`Trade failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      swapBtnText.textContent = `Swap ${currentFromToken} → ${currentToToken}`;
      executeSwapBtn.disabled = false;
    }
  });
  async function fetchQuote(amount: number, from: string, to: string) {
    try {
      console.log(`🔍 Fetching real OKX quote: ${amount} ${from} → ${to}`);
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'GET_QUOTE',
          data: {
            fromToken: from,
            toToken: to,
            amount: amount,
            slippage: 0.01 
          }
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
    }
        });
      });
      if (!response.success) {
        throw new Error(response.error || 'Failed to get quote');
      }
      const quote = response.quote;
      console.log('✅ Real OKX quote received:', quote);
      const isMockQuote = !chrome.runtime.getManifest().key; 
      if (isMockQuote) {
        console.log('⚠️ Using mock quote data (OKX API not configured)');
      }
      toAmountInput.value = quote.toAmount.toFixed(6);
      const exchangeRateEl = modalContent.querySelector('#exchange-rate');
      const priceImpactEl = modalContent.querySelector('#price-impact');
      const networkFeeEl = modalContent.querySelector('#network-fee');
      if (exchangeRateEl) exchangeRateEl.textContent = `1 ${from} = ${quote.exchangeRate.toFixed(6)} ${to}`;
      if (priceImpactEl) priceImpactEl.textContent = `${quote.priceImpact.toFixed(2)}%`;
      if (networkFeeEl) networkFeeEl.textContent = `~${quote.estimatedGas} SOL`;
      quoteInfo.style.display = 'block';
      swapBtnText.textContent = `Swap ${from} → ${to}`;
      swapBtnText.style.display = 'block';
      swapBtnLoading.style.display = 'none';
      executeSwapBtn.disabled = false;
      currentQuote = {
        fromAmount: amount,
        toAmount: quote.toAmount,
        exchangeRate: quote.exchangeRate,
        priceImpact: quote.priceImpact,
        estimatedGas: quote.estimatedGas,
        tradeFee: quote.tradeFee
      };
    } catch (error) {
      console.error('❌ Real quote fetch failed:', error);
      showQuoteError(error instanceof Error ? error.message : 'Failed to get quote');
    }
  }
  function showQuoteError(message: string) {
    toAmountInput.value = '';
    quoteInfo.style.display = 'none';
    swapBtnText.textContent = 'Quote Failed';
    swapBtnText.style.display = 'block';
    swapBtnLoading.style.display = 'none';
    executeSwapBtn.disabled = true;
    setTimeout(() => {
      swapBtnText.textContent = 'Enter Amount';
    }, 2000);
  }
}
async function executeTrade(signal: TradingSignal, amount: number, slippage: number) {
  try {
    console.log('Initiating trade execution:', { signal, amount, slippage });
    const response = await new Promise<any>((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'EXECUTE_TRADE',
        data: { signal, amount, slippage, timestamp: Date.now() }
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
    if (!response.success) {
      throw new Error(response.error || 'Trade execution failed');
    }
    if (response.transaction?.status === 'ready_to_sign') {
      await showTransactionSigningModal(response.transaction);
    } else if (response.transaction) {
      console.log('Trade completed:', response.transaction);
      return response;
    } else {
      throw new Error('Invalid trade response');
    }
  } catch (error) {
    console.error('Trade execution failed:', error);
    throw error;
  }
}
async function showTransactionSigningModal(txData: any) {
  return new Promise((resolve, reject) => {
    const existingModal = document.querySelector('.quickalpha-signing-modal');
    if (existingModal) {
      existingModal.remove();
    }
    const existingModals = document.querySelectorAll('.quickalpha-signal-modal, .quickalpha-detail-modal, .quickalpha-modal');
    existingModals.forEach(modal => {
      (modal as HTMLElement).style.display = 'none';
    });
    const signingModal = document.createElement('div');
    signingModal.className = 'quickalpha-signing-modal';
    signingModal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(0, 0, 0, 0.8);
      z-index: 2147483647; /* Maximum z-index */
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    `;
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background-color: white;
      border-radius: 16px;
      padding: 24px;
      max-width: 450px;
      width: 90%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2);
      position: relative;
      border: 2px solid #3b82f6;
    `;
    const closeBtn = document.createElement('button');
    closeBtn.className = 'quickalpha-close';
    closeBtn.style.cssText = `
      position: absolute;
      top: 16px;
      right: 16px;
      background: #f3f4f6;
      border: none;
      border-radius: 50%;
      font-size: 24px;
      line-height: 1;
      cursor: pointer;
      color: #4b5563;
      z-index: 10;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `;
    closeBtn.textContent = '×';
    modalContent.appendChild(closeBtn);
    const header = document.createElement('div');
    header.style.cssText = `
      background-color: #3b82f6;
      margin: -24px -24px 24px -24px;
      padding: 20px 24px;
      border-radius: 14px 14px 0 0;
      color: white;
      text-align: center;
    `;
    const title = document.createElement('h3');
    title.textContent = '🔐 Sign Transaction';
    title.style.cssText = `
      margin: 0;
      font-size: 20px;
      font-weight: 700;
      color: white;
    `;
    header.appendChild(title);
    const body = document.createElement('div');
    body.style.cssText = `
      padding: 0;
    `;
    const chainInfo = document.createElement('div');
    chainInfo.style.cssText = `
      text-align: center;
      margin-bottom: 24px;
    `;
    const chainBadge = document.createElement('div');
    chainBadge.style.cssText = `
      display: inline-block;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 600;
      color: white;
      background: ${txData.chain === 'solana' ?
        'linear-gradient(135deg, #9945ff, #14f195)' :
        'linear-gradient(135deg, #627eea, #8b94b8)'};
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    `;
    chainBadge.textContent = txData.chain === 'solana' ? '🔗 Solana' : '🔗 Ethereum';
    chainInfo.appendChild(chainBadge);
    const tradeDetails = document.createElement('div');
    tradeDetails.style.cssText = `
      background: #f8fafc;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    `;
    const fromRow = document.createElement('div');
    fromRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    `;
    const fromLabel = document.createElement('span');
    fromLabel.style.cssText = `
      font-weight: 600;
      color: #4b5563;
    `;
    fromLabel.textContent = 'From:';
    const fromValue = document.createElement('span');
    fromValue.style.cssText = `
      font-weight: 600;
      color: #1e40af;
      background: rgba(59, 130, 246, 0.1);
      padding: 6px 12px;
      border-radius: 6px;
    `;
    fromValue.textContent = `${txData.fromAmount} ${txData.fromToken}`;
    fromRow.appendChild(fromLabel);
    fromRow.appendChild(fromValue);
    const toRow = document.createElement('div');
    toRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e2e8f0;
    `;
    const toLabel = document.createElement('span');
    toLabel.style.cssText = `
      font-weight: 600;
      color: #4b5563;
    `;
    toLabel.textContent = 'To:';
    const toValue = document.createElement('span');
    toValue.style.cssText = `
      font-weight: 600;
      color: #047857;
      background: rgba(16, 185, 129, 0.1);
      padding: 6px 12px;
      border-radius: 6px;
    `;
    toValue.textContent = `~${parseFloat(txData.toAmount).toFixed(6)} ${txData.toToken}`;
    toRow.appendChild(toLabel);
    toRow.appendChild(toValue);
    const slippageRow = document.createElement('div');
    slippageRow.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
    `;
    const slippageLabel = document.createElement('span');
    slippageLabel.style.cssText = `
      font-weight: 600;
      color: #4b5563;
    `;
    slippageLabel.textContent = 'Slippage:';
    const slippageValue = document.createElement('span');
    slippageValue.style.cssText = `
      font-weight: 600;
      color: #9333ea;
      background: rgba(147, 51, 234, 0.1);
      padding: 6px 12px;
      border-radius: 6px;
    `;
    slippageValue.textContent = txData.slippage;
    slippageRow.appendChild(slippageLabel);
    slippageRow.appendChild(slippageValue);
    tradeDetails.appendChild(fromRow);
    tradeDetails.appendChild(toRow);
    tradeDetails.appendChild(slippageRow);
    const instructions = document.createElement('div');
    instructions.style.cssText = `
      text-align: center;
      margin-bottom: 24px;
      color: #4b5563;
      font-size: 14px;
      line-height: 1.6;
      background: #eff6ff;
      padding: 16px;
      border-radius: 12px;
      border-left: 4px solid #3b82f6;
    `;
    const instructionsP1 = document.createElement('p');
    instructionsP1.style.cssText = `
      margin: 0 0 8px 0;
      font-weight: 600;
    `;
    instructionsP1.textContent = '📱 Please check your wallet to sign this transaction.';
    const instructionsP2 = document.createElement('p');
    instructionsP2.style.cssText = `
      margin: 0;
    `;
    instructionsP2.textContent = 'The transaction details have been prepared and are ready for your approval.';
    instructions.appendChild(instructionsP1);
    instructions.appendChild(instructionsP2);
    const actions = document.createElement('div');
    actions.style.cssText = `
      display: flex;
      gap: 12px;
      justify-content: center;
    `;
    const signBtn = document.createElement('button');
    signBtn.style.cssText = `
      flex: 1;
      padding: 16px 20px;
      background: linear-gradient(135deg, #10b981, #059669);
      color: white;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 6px rgba(16, 185, 129, 0.25);
    `;
    signBtn.innerHTML = '🔐 <span style="position:relative;top:1px;">Open Wallet to Sign</span>';
    const cancelBtn = document.createElement('button');
    cancelBtn.style.cssText = `
      flex: 1;
      padding: 16px 20px;
      border: 2px solid #e5e7eb;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      background: white;
      color: #6b7280;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
    `;
    cancelBtn.textContent = 'Cancel';
    actions.appendChild(signBtn);
    actions.appendChild(cancelBtn);
    body.appendChild(chainInfo);
    body.appendChild(tradeDetails);
    body.appendChild(instructions);
    body.appendChild(actions);
    modalContent.appendChild(header);
    modalContent.appendChild(body);
    signingModal.appendChild(modalContent);
    if (!document.getElementById('signing-modal-styles')) {
      const signingStyles = document.createElement('style');
      signingStyles.id = 'signing-modal-styles';
      signingStyles.textContent = `
        .quickalpha-signing-modal {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2147483647; /* Maximum z-index value to be on top of everything */
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          animation: modalFadeIn 0.3s ease-out forwards;
        }
        @keyframes modalFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .quickalpha-signing-modal-content {
          background: white;
          border-radius: 16px;
          width: 90%;
          max-width: 450px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          animation: modalContentZoomIn 0.3s ease-out forwards;
        }
        @keyframes modalContentZoomIn {
          from {
            transform: scale(0.9);
          }
          to {
            transform: scale(1);
          }
        }
        .signing-header {
          background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
          color: white;
          padding: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .signing-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 700;
        }
        .quickalpha-close {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          font-size: 24px;
          line-height: 1;
          cursor: pointer;
          padding: 6px;
          margin: 0;
          border-radius: 50%;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .quickalpha-close:hover {
          background: rgba(255, 255, 255, 0.3);
          transform: scale(1.1);
        }
        .signing-body {
          padding: 24px;
        }
        .chain-info {
          text-align: center;
          margin-bottom: 20px;
        }
        .chain-badge {
          display: inline-block;
          padding: 8px 16px;
          border-radius: 20px;
          font-size: 14px;
          font-weight: 600;
          color: white;
        }
        .chain-badge.solana {
          background: linear-gradient(135deg, #9945ff, #14f195);
        }
        .chain-badge.ethereum {
          background: linear-gradient(135deg, #627eea, #8b94b8);
        }
        .trade-details {
          background: #f8fafc;
          border-radius: 12px;
          padding: 20px;
          margin-bottom: 20px;
          border: 1px solid #e2e8f0;
        }
        .detail-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #e2e8f0;
          font-size: 14px;
        }
        .detail-row:last-child {
          margin-bottom: 0;
          padding-bottom: 0;
          border-bottom: none;
        }
        .detail-label {
          font-weight: 600;
          color: #4b5563;
        }
        .detail-value {
          font-weight: 600;
          color: #1e3a8a;
          background: rgba(59, 130, 246, 0.1);
          padding: 6px 12px;
          border-radius: 6px;
        }
        .signing-instructions {
          text-align: center;
          margin-bottom: 24px;
          color: #4b5563;
          font-size: 14px;
          line-height: 1.6;
          background: #eff6ff;
          padding: 16px;
          border-radius: 12px;
          border-left: 4px solid #3b82f6;
        }
        .signing-actions {
          display: flex;
          gap: 12px;
        }
        .sign-btn {
          flex: 1;
          padding: 16px 20px;
          background: linear-gradient(135deg, #10b981, #059669);
          color: white;
          border: none;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          box-shadow: 0 4px 6px rgba(16, 185, 129, 0.25);
        }
        .sign-btn:hover {
          background: linear-gradient(135deg, #059669, #047857);
          transform: translateY(-1px);
          box-shadow: 0 6px 12px rgba(16, 185, 129, 0.3);
        }
        .cancel-signing-btn {
          flex: 1;
          padding: 16px 20px;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          font-size: 16px;
          font-weight: 600;
          background: white;
          color: #6b7280;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .cancel-signing-btn:hover {
          border-color: #d1d5db;
          background: #f9fafb;
          transform: translateY(-1px);
        }
      `;
      document.head.appendChild(signingStyles);
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        signingModal.remove();
        existingModals.forEach(modal => {
          (modal as HTMLElement).style.display = 'block';
        });
        reject(new Error('Transaction signing cancelled by user'));
      });
    }
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        signingModal.remove();
        existingModals.forEach(modal => {
          (modal as HTMLElement).style.display = 'block';
        });
        reject(new Error('Transaction signing cancelled by user'));
      });
    }
    if (signBtn) {
      signBtn.addEventListener('click', () => {
      initiateWalletSigning(txData);
      signingModal.remove();
      resolve(txData);
    });
    }
    document.body.appendChild(signingModal);
  });
}
async function initiateWalletSigning(txData: any) {
  try {
    console.log('🔄 Preparing transaction for wallet signing:', txData);
    await verifyWalletConnection();
    if (!txData.transaction?.data && txData.transaction) {
      console.log('⚠️ Transaction data needs restructuring for wallet compatibility');
      if (typeof txData.transaction === 'string') {
        txData.transaction = {
          data: txData.transaction
        };
      } else if (typeof txData.transaction === 'object') {
        txData.transaction.data = txData.transaction.data ||
          txData.transaction.tx ||
          txData.transaction.rawTransaction ||
          JSON.stringify(txData.transaction);
      }
    }
    window.postMessage({
      type: 'QUICKALPHA_SIGN_TRANSACTION',
      data: {
        ...txData,
        chain: txData.chain || 'solana',
        timestamp: Date.now()  
      }
    }, '*');
    console.log('🚀 Transaction sent to wallet for signing:', txData);
  } catch (error) {
    console.error('❌ Failed to initiate wallet signing:', error);
    throw error;
  }
}
async function verifyWalletConnection(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get(['walletConnected', 'walletAddress', 'walletProvider'], async (result) => {
      if (result.walletConnected && result.walletAddress) {
        console.log('✅ Wallet already connected:', {
          address: result.walletAddress.substring(0, 8) + '...',
          provider: result.walletProvider
        });
        resolve(true);
        return;
      }
      console.log('⚠️ No wallet connected, attempting to connect...');
      window.postMessage({
        type: 'QUICKALPHA_CHECK_WALLETS',
        payload: {}
      }, '*');
      const messageHandler = (event: MessageEvent) => {
        if (event.source !== window || !event.data) return;
        const { type, payload } = event.data;
        if (type === 'QUICKALPHA_WALLET_STATUS') {
          window.removeEventListener('message', messageHandler);
          console.log('🔍 Wallet status:', payload);
          if (payload.isConnected) {
            console.log('✅ Wallet is already connected via injected script');
            resolve(true);
            return;
          }
          const availableWallets = [];
          if (payload.okx.available) availableWallets.push('OKX');
          if (payload.phantom.available) availableWallets.push('Phantom');
          if (payload.solflare.available) availableWallets.push('Solflare');
          if (availableWallets.length > 0) {
            console.log('🔍 Found available wallets:', availableWallets.join(', '));
            showWalletConnectionModal();
            reject(new Error('Please connect your wallet first'));
          } else {
            reject(new Error('No compatible wallet found. Please install OKX Wallet or Phantom'));
          }
        }
      };
      window.addEventListener('message', messageHandler);
      setTimeout(() => {
        window.removeEventListener('message', messageHandler);
        reject(new Error('Wallet connection check timed out'));
      }, 5000);
    });
  });
}
function showWalletConnectionModal() {
  const modal = document.createElement('div');
  modal.className = 'quickalpha-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
    `;
  const content = document.createElement('div');
  content.className = 'quickalpha-wallet-content';
  content.style.cssText = `
    background: white;
    border-radius: 12px;
    padding: 24px;
    max-width: 400px;
    width: 90%;
    text-align: center;
  `;
  const title = document.createElement('h3');
  title.textContent = 'Connect Your Wallet';
  title.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 20px;
    font-weight: 700;
  `;
  const message = document.createElement('p');
  message.textContent = 'You need to connect a wallet to sign transactions.';
  message.style.cssText = `
    margin: 0 0 24px 0;
    color: #4b5563;
  `;
  const connectButton = document.createElement('button');
  connectButton.textContent = 'Connect Wallet';
  connectButton.style.cssText = `
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: white;
    border: none;
    border-radius: 8px;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
    margin-bottom: 12px;
  `;
  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'Cancel';
  cancelButton.style.cssText = `
    background: white;
    color: #6b7280;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    padding: 12px 24px;
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    width: 100%;
  `;
  content.appendChild(title);
  content.appendChild(message);
  content.appendChild(connectButton);
  content.appendChild(cancelButton);
  modal.appendChild(content);
  connectButton.addEventListener('click', async () => {
    connectButton.textContent = 'Connecting...';
    connectButton.disabled = true;
    try {
      const response = await new Promise<any>((resolve, reject) => {
        chrome.runtime.sendMessage({
          type: 'CONNECT_WALLET_REQUEST'
        }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        });
      });
      if (response.success) {
        modal.remove();
        window.location.reload();
      } else {
        throw new Error(response.error || 'Failed to connect wallet');
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      message.textContent = `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      message.style.color = '#dc2626';
      connectButton.textContent = 'Try Again';
      connectButton.disabled = false;
    }
  });
  cancelButton.addEventListener('click', () => {
    modal.remove();
  });
  document.body.appendChild(modal);
}
function showDetailModal(signal: TradingSignal, content: DetectedContent): void {
  const existingModal = document.querySelector('.quickalpha-modal');
  if (existingModal) {
    existingModal.remove();
  }
  const modal = document.createElement('div');
  modal.className = 'quickalpha-modal';
  const modalContent = document.createElement('div');
  modalContent.className = 'quickalpha-modal-content';
  modalContent.style.position = 'relative';
  modalContent.style.maxWidth = '600px'; 
  const closeBtn = document.createElement('button');
  closeBtn.className = 'quickalpha-close';
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    position: absolute;
    top: 16px;
    right: 16px;
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #6b7280;
    padding: 8px;
    border-radius: 8px;
    transition: all 0.2s ease;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
  const title = document.createElement('h3');
  title.textContent = 'Trading Signal Details';
  title.style.cssText = `
    margin: 0 0 16px 0;
    font-size: 20px;
    font-weight: 700;
    padding-right: 32px;
  `;
  const tokenInfo = document.createElement('div');
  tokenInfo.style.cssText = `
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 24px;
  `;
  const tokenBasics = document.createElement('div');
  tokenBasics.style.cssText = `
    flex: 1;
    min-width: 200px;
  `;
  tokenBasics.innerHTML = `
    <p><strong>Token:</strong> ${signal.token || 'N/A'}</p>
    <p><strong>Action:</strong> <span style="color: ${getActionColor(signal.action)}">${signal.action}</span></p>
    <p><strong>Confidence:</strong> ${signal.confidence}/10</p>
  `;
  tokenInfo.appendChild(tokenBasics);
  const explanationSection = document.createElement('div');
  explanationSection.style.cssText = `
    margin-bottom: 24px;
  `;
  explanationSection.innerHTML = `
    <p><strong>Signal Explanation:</strong></p>
    <p style="background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb;">${signal.explanation}</p>
    <p><strong>Detected Tokens:</strong> ${content.tokens.map(t => t.symbol).join(', ') || 'None'}</p>
    <p><strong>Hype Words:</strong> ${content.hypeLanguage.join(', ') || 'None'}</p>
  `;
  const sentimentSection = document.createElement('div');
  sentimentSection.style.cssText = `
    margin-bottom: 24px;
    display: none;
  `;
  sentimentSection.id = 'sentiment-explanation';
  sentimentSection.innerHTML = `
    <p><strong>Market Sentiment Analysis:</strong></p>
    <p id="sentiment-reason" style="background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb;">Loading market sentiment analysis...</p>
  `;
  const tradesSection = document.createElement('div');
  tradesSection.style.cssText = `
    margin-bottom: 24px;
    display: none;
  `;
  tradesSection.id = 'recent-trades';
  tradesSection.innerHTML = `
    <p><strong>Recent Trades:</strong></p>
    <div style="max-height: 200px; overflow-y: auto; background: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb;">
      <table id="trades-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Price</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Size</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Side</th>
            <th style="text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb;">Time</th>
          </tr>
        </thead>
        <tbody id="trades-body">
          <tr>
            <td colspan="4" style="text-align: center; padding: 16px;">Loading recent trades...</td>
          </tr>
        </tbody>
      </table>
      </div>
  `;
  const actionSection = document.createElement('div');
  actionSection.className = 'detail-trade-section';
  actionSection.style.cssText = `
    margin-top: 24px;
  `;
  if (signal.action.toLowerCase() === 'buy' || signal.action.toLowerCase() === 'sell') {
    const actionBtn = document.createElement('button');
    actionBtn.className = 'detail-trade-btn';
    actionBtn.style.cssText = `
      background: ${getActionColor(signal.action)};
      width: 100%;
      padding: 12px 20px;
      border: none;
      border-radius: 12px;
      color: white;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    `;
    actionBtn.innerHTML = signal.action.toLowerCase() === 'buy' ? '🚀 Trade Now' : '📉 Trade Now';
    actionBtn.addEventListener('click', () => {
      modal.remove();
      showTradeModal(signal, content);
    });
    actionSection.appendChild(actionBtn);
  }
  modalContent.appendChild(closeBtn);
  modalContent.appendChild(title);
  modalContent.appendChild(tokenInfo);
  modalContent.appendChild(explanationSection);
  modalContent.appendChild(actionSection);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    setTimeout(() => modal.remove(), 300);
  });
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.remove('show');
      setTimeout(() => modal.remove(), 300);
    }
  });
}
function getActionColor(action: string): string {
  switch (action.toLowerCase()) {
    case 'buy': return '#10b981';
    case 'sell': return '#ef4444';
    case 'avoid': return '#6b7280';
    default: return '#6b7280';
  }
}
function getTokenColor(token: string): string {
  const tokenColors: Record<string, string> = {
    'SOL': 'linear-gradient(135deg, #9945ff, #14f195)',
    'BTC': 'linear-gradient(135deg, #f7931a, #ffb74d)',
    'ETH': 'linear-gradient(135deg, #627eea, #8b94b8)',
    'USDC': 'linear-gradient(135deg, #2775ca, #4dabf7)',
    'USDT': 'linear-gradient(135deg, #26a17b, #4fd1c7)',
    'BONK': 'linear-gradient(135deg, #ff6b35, #ff8e53)',
    'WIF': 'linear-gradient(135deg, #8b5cf6, #a78bfa)',
    'PEPE': 'linear-gradient(135deg, #22c55e, #4ade80)',
    'DOGE': 'linear-gradient(135deg, #c2a633, #d4af37)',
    'SHIB': 'linear-gradient(135deg, #f97316, #fb923c)'
  };
  return tokenColors[token.toUpperCase()] || 'linear-gradient(135deg, #6366f1, #4f46e5)';
}
