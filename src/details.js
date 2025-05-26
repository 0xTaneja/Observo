
document.addEventListener('DOMContentLoaded', () => {
    loadSignalDetails();
    setupEventListeners();
});
function setupEventListeners() {
    const backButton = document.getElementById('back-button');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.close();
        });
    }
}
let currentToken = null;
async function loadSignalDetails() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const signalDataEncoded = urlParams.get('signal');
        if (!signalDataEncoded) {
            showError('No signal data found');
            return;
        }
        const signalData = JSON.parse(decodeURIComponent(signalDataEncoded));
        displaySignalDetails(signalData);
        if (signalData.signal.token && 
            signalData.signal.token !== 'NOTHING' && 
            signalData.signal.token !== 'Unknown' && 
            signalData.signal.token !== 'UNKNOWN') {
            currentToken = signalData.signal.token;
            loadMarketData(currentToken);
        } else {
            showMarketDataError('No valid token found for market data');
        }
    } catch (error) {
        console.error('Error loading signal details:', error);
        showError('Failed to load signal details');
    }
}
function displaySignalDetails(signalData) {
    const { signal, content, timestamp, explanation } = signalData;
    document.getElementById('signal-token').textContent = `$${signal.token || 'UNKNOWN'}`;
    const actionElement = document.getElementById('signal-action');
    actionElement.textContent = signal.action;
    actionElement.className = `action-badge ${signal.action.toLowerCase()}`;
    document.getElementById('signal-confidence').textContent = `${signal.confidence}/10`;
    document.getElementById('signal-time').textContent = formatTimestamp(timestamp);
    document.getElementById('signal-explanation').textContent = signal.explanation || explanation || 'No detailed explanation available';
    document.getElementById('tweet-content').textContent = content.fullText || 'Tweet content not available';
    displayDetectedTokens(content.tokens || []);
    displayDetectedHype(content.hypeLanguage || []);
    displayDetectedWallets(content.wallets || []);
}
async function loadMarketData(token) {
    try {
        document.getElementById('token-price').textContent = 'Loading...';
        document.getElementById('price-change').textContent = 'Loading...';
        document.getElementById('price-high').textContent = 'Loading...';
        document.getElementById('price-low').textContent = 'Loading...';
        document.getElementById('token-volume').textContent = 'Loading...';
        const marketData = await chrome.runtime.sendMessage({
            type: 'GET_TOKEN_MARKET_DATA',
            token: token
        });
        if (marketData && !marketData.error) {
            displayMarketData(marketData);
            displayRecentTrades(marketData.recentTrades);
        } else {
            showMarketDataError(marketData?.error || 'Failed to load market data');
        }
    } catch (error) {
        console.error('Error loading market data:', error);
        showMarketDataError('Failed to load market data');
    }
}
function displayMarketData(data) {
    const formattedPrice = formatPrice(data.price);
    document.getElementById('token-price').textContent = `$${formattedPrice}`;
    const priceChangeElement = document.getElementById('price-change');
    const changePercent = data.priceChangePercent24h;
    const formattedChange = formatPercentage(changePercent);
    priceChangeElement.textContent = formattedChange;
    priceChangeElement.className = `stat-value ${changePercent >= 0 ? 'positive' : 'negative'}`;
    document.getElementById('price-high').textContent = `$${formatPrice(data.high24h)}`;
    document.getElementById('price-low').textContent = `$${formatPrice(data.low24h)}`;
    document.getElementById('token-volume').textContent = formatVolume(data.volume24h);
}
function displayRecentTrades(trades) {
    const tradesBody = document.getElementById('trades-body');
    if (!tradesBody) return;
    if (!trades || trades.length === 0) {
        tradesBody.innerHTML = '<tr><td colspan="4" class="loading-trades">No recent trades available</td></tr>';
        return;
    }
    tradesBody.innerHTML = '';
    const tradesToShow = trades.slice(0, 20);
    tradesToShow.forEach(trade => {
        const row = document.createElement('tr');
        const date = new Date(trade.timestamp);
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const seconds = date.getSeconds().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}:${seconds}`;
        row.innerHTML = `
            <td>$${formatPrice(trade.price)}</td>
            <td>${trade.size.toFixed(4)}</td>
            <td class="${trade.side}">${trade.side.toUpperCase()}</td>
            <td>${timeString}</td>
        `;
        tradesBody.appendChild(row);
    });
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
function formatPrice(price) {
    if (price === null || price === undefined || isNaN(price)) {
        return 'N/A';
    }
    if (price < 0.001) {
        return price.toFixed(8);
    } else if (price < 1) {
        return price.toFixed(6);
    } else if (price < 10) {
        return price.toFixed(4);
    } else if (price < 1000) {
        return price.toFixed(2);
    }
    return price.toFixed(2);
}
function formatPercentage(percent) {
    const sign = percent >= 0 ? '+' : '';
    return `${sign}${percent.toFixed(2)}%`;
}
function formatVolume(volume) {
    if (volume >= 1e9) {
        return `$${(volume / 1e9).toFixed(2)}B`;
    } else if (volume >= 1e6) {
        return `$${(volume / 1e6).toFixed(2)}M`;
    } else if (volume >= 1e3) {
        return `$${(volume / 1e3).toFixed(2)}K`;
    }
    return `$${volume.toFixed(2)}`;
}
function showMarketDataError(message) {
    document.getElementById('token-price').textContent = 'N/A';
    document.getElementById('price-change').textContent = 'N/A';
    document.getElementById('price-high').textContent = 'N/A';
    document.getElementById('price-low').textContent = 'N/A';
    document.getElementById('token-volume').textContent = 'N/A';
    const tradesBody = document.getElementById('trades-body');
    if (tradesBody) {
        tradesBody.innerHTML = `<tr><td colspan="4" class="loading-trades">${message}</td></tr>`;
    }
}
function showError(message) {
    document.getElementById('signal-token').textContent = 'Error';
    document.getElementById('signal-explanation').textContent = message;
    document.getElementById('tweet-content').textContent = 'Unable to load data';
} 