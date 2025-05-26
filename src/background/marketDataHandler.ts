import {
    getTokenMarketData,
    getCandlestickData,
    convertCandlestickData
} from '../services/okxMarketApi';
interface MarketDataCache {
    [token: string]: {
        data: any;
        timestamp: number;
        candlesticks: {
            [timeframe: string]: {
                data: any;
                timestamp: number;
            }
        }
    }
}
const CACHE_EXPIRY = 60 * 1000;
const marketDataCache: MarketDataCache = {};
export function setupMarketDataHandlers() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'GET_TOKEN_MARKET_DATA') {
            handleGetTokenMarketData(request.token)
                .then(sendResponse)
                .catch(error => {
                    console.error('Error handling market data request:', error);
                    sendResponse({ error: error.message });
                });
            return true; 
        }
        if (request.type === 'GET_CANDLESTICK_DATA') {
            handleGetCandlestickData(request.token, request.timeframe)
                .then(sendResponse)
                .catch(error => {
                    console.error('Error handling candlestick data request:', error);
                    sendResponse({ error: error.message });
                });
            return true; 
        }
        return false;
    });
}
async function handleGetTokenMarketData(token: string) {
    try {
        if (!token) {
            throw new Error('Token is required');
        }
        const cachedData = marketDataCache[token];
        const now = Date.now();
        if (cachedData && (now - cachedData.timestamp) < CACHE_EXPIRY) {
            console.log(`Using cached market data for ${token}`);
            return cachedData.data;
        }
        console.log(`Fetching fresh market data for ${token}`);
        const marketData = await getTokenMarketData(token);
        if (!marketData) {
            throw new Error(`Failed to get market data for ${token}`);
        }
        marketDataCache[token] = {
            data: marketData,
            timestamp: now,
            candlesticks: cachedData?.candlesticks || {}
        };
        return marketData;
    } catch (error) {
        console.error('Error getting token market data:', error);
        throw error;
    }
}
async function handleGetCandlestickData(token: string, timeframe: string = '1H') {
    try {
        if (!token) {
            throw new Error('Token is required');
        }
        const cachedData = marketDataCache[token]?.candlesticks?.[timeframe];
        const now = Date.now();
        if (cachedData && (now - cachedData.timestamp) < CACHE_EXPIRY) {
            console.log(`Using cached candlestick data for ${token} (${timeframe})`);
            return { candlesticks: cachedData.data };
        }
        console.log(`Fetching fresh candlestick data for ${token} (${timeframe})`);
        const candlesticks = await getCandlestickData(token, timeframe);
        if (!candlesticks || candlesticks.length === 0) {
            throw new Error(`Failed to get candlestick data for ${token}`);
        }
        const chartData = convertCandlestickData(candlesticks);
        if (!marketDataCache[token]) {
            marketDataCache[token] = {
                data: null,
                timestamp: 0,
                candlesticks: {}
            };
        }
        if (!marketDataCache[token].candlesticks) {
            marketDataCache[token].candlesticks = {};
        }
        marketDataCache[token].candlesticks[timeframe] = {
            data: chartData,
            timestamp: now
        };
        return { candlesticks: chartData };
    } catch (error) {
        console.error('Error getting candlestick data:', error);
        throw error;
    }
} 