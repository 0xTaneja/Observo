import { TradingSignal, DetectedContent } from "../types";

interface SignalOverlayData {
  signal: TradingSignal;
  tweetId: string;
  content: any;
}

// Store active overlays to prevent duplicates
const activeOverlays = new Map<string, HTMLElement>();

export function displayTradingSignal(signal: TradingSignal, tweetId: string, content: DetectedContent): void {
  console.log('Attempting to display signal overlay:', { signal, tweetId, content });
  
  addOverlayStyles();
  
  const tweetElement = findTweetElement(tweetId);
  if (!tweetElement) {
    console.error('Tweet element not found for ID:', tweetId);
    return;
  }

  // Remove existing overlay
  const existingOverlay = tweetElement.querySelector('.quickalpha-overlay');
  if (existingOverlay) {
    existingOverlay.remove();
  }

  // Create compact overlay
  const overlay = document.createElement('div');
  overlay.className = 'quickalpha-overlay';
  
  const compactCard = document.createElement('div');
  compactCard.className = 'quickalpha-compact';
  
  // Action badge
  const actionElement = document.createElement('div');
  actionElement.className = `quickalpha-action ${signal.action.toLowerCase()}`;
  actionElement.textContent = signal.action;
  
  // Reason (shortened)
  const reasonElement = document.createElement('div');
  reasonElement.className = 'quickalpha-reason';
  const shortReason = signal.explanation?.split('.')[0] || 'Analysis complete';
  reasonElement.textContent = shortReason.length > 20 ? shortReason.slice(0, 20) + '...' : shortReason;
  
  // Confidence
  const confidenceElement = document.createElement('div');
  confidenceElement.className = 'quickalpha-confidence';
  confidenceElement.textContent = `${signal.confidence}/10`;
  
  compactCard.appendChild(actionElement);
  compactCard.appendChild(reasonElement);
  compactCard.appendChild(confidenceElement);
  
  // Add click handler for details
  compactCard.addEventListener('click', () => {
    showDetailModal(signal, content);
  });
  
  overlay.appendChild(compactCard);
  
  // Insert overlay after tweet content
  const tweetTextElement = tweetElement.querySelector('[data-testid="tweetText"]');
  if (tweetTextElement && tweetTextElement.parentNode) {
    tweetTextElement.parentNode.insertBefore(overlay, tweetTextElement.nextSibling);
  } else {
    tweetElement.appendChild(overlay);
  }
  
  // Animate in
  setTimeout(() => {
    overlay.classList.add('show');
  }, 100);
  
  console.log('Signal overlay displayed successfully');
}

function findTweetElement(tweetId: string): HTMLElement | null {
  console.log('Looking for tweet with ID:', tweetId);
  
  // Try multiple approaches to find the tweet
  const tweets = document.querySelectorAll('[data-testid="tweet"]');
  console.log('Found', tweets.length, 'tweets on page');
  
  for (const tweet of tweets) {
    const tweetElement = tweet as HTMLElement;
    
    // Method 1: Try to match by actual tweet ID from URL
    const tweetLink = tweetElement.querySelector('a[href*="/status/"]');
    if (tweetLink) {
      const href = (tweetLink as HTMLAnchorElement).href;
      const statusMatch = href.match(/\/status\/(\d+)/);
      if (statusMatch && statusMatch[1] === tweetId) {
        console.log('Found tweet by URL match');
        return tweetElement;
      }
    }
    
    // Method 2: Try to match by text content (simplified)
    const tweetText = tweetElement.querySelector('[data-testid="tweetText"]');
    if (tweetText) {
      const text = tweetText.textContent?.trim() || '';
      // Create a simple hash to match
      const textHash = text.toLowerCase().replace(/\s+/g, '').slice(0, 50);
      if (textHash.length > 10 && tweetId.includes(textHash.slice(0, 8))) {
        console.log('Found tweet by text content match');
        return tweetElement;
      }
    }
  }
  
  // Method 3: Fallback - find by containing crypto tokens
  for (const tweet of tweets) {
    const tweetElement = tweet as HTMLElement;
    const content = tweetElement.textContent?.toLowerCase() || '';
    if (content.includes('$') && (content.includes('virgen') || content.includes('xrp') || content.includes('btc'))) {
      console.log('Found tweet by token content fallback');
      return tweetElement;
    }
  }
  
  console.log('Tweet element not found for ID:', tweetId);
  return null;
}

function addOverlayStyles() {
  // Only add styles once
  if (document.getElementById('quickalpha-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'quickalpha-styles';
  styles.textContent = `
    .quickalpha-overlay {
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.2s ease;
      margin-top: 8px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      z-index: 9999;
      position: relative;
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
      transition: all 0.2s ease;
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
    }

    .quickalpha-confidence {
      color: #6366f1;
      font-size: 10px;
      font-weight: 700;
    }

    .quickalpha-overlay.show {
      opacity: 1;
      transform: translateY(0);
    }

    /* Modal styles */
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
    }

    .quickalpha-close:hover {
      background: #f3f4f6;
      color: #374151;
    }
  `;
  
  document.head.appendChild(styles);
}

function showDetailModal(signal: TradingSignal, content: DetectedContent): void {
  // Remove existing modal
  const existingModal = document.querySelector('.quickalpha-modal');
  if (existingModal) {
    existingModal.remove();
  }

  const modal = document.createElement('div');
  modal.className = 'quickalpha-modal';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'quickalpha-modal-content';
  modalContent.style.position = 'relative';
  
  modalContent.innerHTML = `
    <button class="quickalpha-close">&times;</button>
    <h3>Trading Signal Details</h3>
    <p><strong>Token:</strong> ${signal.token || 'N/A'}</p>
    <p><strong>Action:</strong> <span style="color: ${getActionColor(signal.action)}">${signal.action}</span></p>
    <p><strong>Confidence:</strong> ${signal.confidence}/10</p>
    <p><strong>Explanation:</strong> ${signal.explanation}</p>
    <p><strong>Detected Tokens:</strong> ${content.tokens.map(t => t.symbol).join(', ') || 'None'}</p>
    <p><strong>Hype Words:</strong> ${content.hypeLanguage.join(', ') || 'None'}</p>
  `;
  
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
  
  // Show modal
  setTimeout(() => {
    modal.classList.add('show');
  }, 10);
  
  // Close handlers
  const closeBtn = modalContent.querySelector('.quickalpha-close');
  closeBtn?.addEventListener('click', () => {
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

