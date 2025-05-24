// Details page script for QuickAlpha
document.addEventListener('DOMContentLoaded', () => {
    loadSignalDetails();
    setupEventListeners();
});

function setupEventListeners() {
    // Back button event listener
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.close();
        });
    }
}

async function loadSignalDetails() {
    try {
        // Get signal data from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const signalDataEncoded = urlParams.get('signal');
        
        if (!signalDataEncoded) {
            showError('No signal data found');
            return;
        }

        const signalData = JSON.parse(decodeURIComponent(signalDataEncoded));
        displaySignalDetails(signalData);
        
    } catch (error) {
        console.error('Error loading signal details:', error);
        showError('Failed to load signal details');
    }
}

function displaySignalDetails(signalData) {
    const { signal, content, timestamp, explanation } = signalData;
    
    // Update basic signal info
    document.getElementById('signal-token').textContent = `$${signal.token || 'UNKNOWN'}`;
    
    const actionElement = document.getElementById('signal-action');
    actionElement.textContent = signal.action;
    actionElement.className = `action-badge ${signal.action.toLowerCase()}`;
    
    document.getElementById('signal-confidence').textContent = `${signal.confidence}/10`;
    document.getElementById('signal-time').textContent = formatTimestamp(timestamp);
    
    // Update analysis content
    document.getElementById('signal-explanation').textContent = signal.explanation || explanation || 'No detailed explanation available';
    
    // Update tweet content
    document.getElementById('tweet-content').textContent = content.fullText || 'Tweet content not available';
    
    // Update detection details
    displayDetectedTokens(content.tokens || []);
    displayDetectedHype(content.hypeLanguage || []);
    displayDetectedWallets(content.wallets || []);
}

function displayDetectedTokens(tokens) {
    const container = document.getElementById('detected-tokens');
    
    if (tokens.length === 0) {
        container.innerHTML = '<span class="empty-state">No tokens detected</span>';
        return;
    }
    
    container.innerHTML = tokens.map(token => 
        `<span class="token-tag">${token.symbol || token}</span>`
    ).join('');
}

function displayDetectedHype(hypeWords) {
    const container = document.getElementById('detected-hype');
    
    if (hypeWords.length === 0) {
        container.innerHTML = '<span class="empty-state">No hype language detected</span>';
        return;
    }
    
    container.innerHTML = hypeWords.map(word => 
        `<span class="hype-tag">${word}</span>`
    ).join('');
}

function displayDetectedWallets(wallets) {
    const container = document.getElementById('detected-wallets');
    
    if (wallets.length === 0) {
        container.innerHTML = '<span class="empty-state">No wallet addresses detected</span>';
        return;
    }
    
    container.innerHTML = wallets.map(wallet => {
        const address = wallet.address || wallet;
        const shortAddress = address.length > 12 ? 
            `${address.slice(0, 6)}...${address.slice(-6)}` : address;
        return `<span class="wallet-tag" title="${address}">${shortAddress}</span>`;
    }).join('');
}

function formatTimestamp(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) {
        return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
        const diffMinutes = Math.floor(diffMs / (1000 * 60));
        return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`;
    }
}

function showError(message) {
    document.getElementById('signal-token').textContent = 'Error';
    document.getElementById('signal-explanation').textContent = message;
    document.getElementById('tweet-content').textContent = 'Unable to load data';
} 