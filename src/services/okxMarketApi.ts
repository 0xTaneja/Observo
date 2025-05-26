import { CandlestickData, Time } from 'lightweight-charts';
const OKX_API_BASE_URL = 'https://www.okx.com/api/v5';
const ENDPOINTS = {
    CANDLESTICK: '/market/candles',
    TICKER: '/market/ticker',
    TRADES: '/market/trades',
    INDEX_PRICE: '/market/index-tickers',
    MARKET_INDEX: '/market/index-candles',
};
export interface OkxApiResponse<T> {
    code: string;
    msg: string;
    data: T[];
}
export interface OkxTicker {
    instId: string;
    last: string;
    lastSz: string;
    askPx: string;
    askSz: string;
    bidPx: string;
    bidSz: string;
    open24h: string;
    high24h: string;
    low24h: string;
    volCcy24h: string;
    vol24h: string;
    ts: string;
    sodUtc0: string;
    sodUtc8: string;
}
export interface OkxTrade {
    instId: string;
    tradeId: string;
    px: string;
    sz: string;
    side: string;
    ts: string;
}
export interface OkxCandlestick {
    ts: string;       
    o: string;        
    h: string;        
    l: string;        
    c: string;        
    vol: string;      
    volCcy: string;   
}
export interface TokenMarketData {
    symbol: string;
    price: number;
    priceChangePercent24h: number;
    high24h: number;
    low24h: number;
    volume24h: number;
    lastUpdated: string;
    candlesticks: CandlestickData[];
    recentTrades: {
        price: number;
        size: number;
        side: 'buy' | 'sell';
        timestamp: string;
    }[];
}
function formatTokenPair(token: string): string {
    token = token.toUpperCase();
    if (token.includes('-')) {
        return token;
    }
    if (token === 'SOL') {
        return 'SOL-USDT';
    } else if (token === 'BTC') {
        return 'BTC-USDT';
    } else if (token === 'ETH') {
        return 'ETH-USDT';
    } else if (token === 'BONK') {
        return 'BONK-USDT';
    } else if (token === 'WIF') {
        return 'WIF-USDT';
    } else if (token === 'DOGE') {
        return 'DOGE-USDT';
    } else if (token === 'SHIB') {
        return 'SHIB-USDT';
    }
    return `${token}-USDT`;
}
export async function getTokenTicker(token: string): Promise<OkxTicker | null> {
    try {
        const instId = formatTokenPair(token);
        const url = `${OKX_API_BASE_URL}${ENDPOINTS.TICKER}?instId=${instId}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`OKX API error: ${response.status}`);
        }
        const data: OkxApiResponse<OkxTicker> = await response.json();
        if (data.code !== '0' || !data.data || data.data.length === 0) {
            console.error('OKX API error:', data.msg);
            return null;
        }
        return data.data[0];
    } catch (error) {
        console.error('Error fetching token ticker:', error);
        return null;
    }
}
export async function getRecentTrades(token: string, limit: number = 20): Promise<OkxTrade[]> {
    try {
        const instId = formatTokenPair(token);
        const url = `${OKX_API_BASE_URL}${ENDPOINTS.TRADES}?instId=${instId}&limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`OKX API error: ${response.status}`);
        }
        const data: OkxApiResponse<OkxTrade> = await response.json();
        if (data.code !== '0' || !data.data) {
            console.error('OKX API error:', data.msg);
            return [];
        }
        return data.data;
    } catch (error) {
        console.error('Error fetching recent trades:', error);
        return [];
    }
}
export async function getCandlestickData(token: string, bar: string = '1H', limit: number = 100): Promise<OkxCandlestick[]> {
    try {
        const instId = formatTokenPair(token);
        const url = `${OKX_API_BASE_URL}${ENDPOINTS.CANDLESTICK}?instId=${instId}&bar=${bar}&limit=${limit}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`OKX API error: ${response.status}`);
        }
        const data: OkxApiResponse<OkxCandlestick[]> = await response.json();
        if (data.code !== '0' || !data.data) {
            console.error('OKX API error:', data.msg);
            return [];
        }
        return data.data.flat();
    } catch (error) {
        console.error('Error fetching candlestick data:', error);
        return [];
    }
}
export function convertCandlestickData(data: OkxCandlestick[]): CandlestickData[] {
    return data.map(candle => ({
        time: (parseInt(candle.ts) / 1000) as Time,
        open: parseFloat(candle.o),
        high: parseFloat(candle.h),
        low: parseFloat(candle.l),
        close: parseFloat(candle.c),
    })).reverse(); 
}
export async function getTokenMarketData(token: string): Promise<TokenMarketData | null> {
    try {
        const [ticker, candlestickData, trades] = await Promise.all([
            getTokenTicker(token),
            getCandlestickData(token),
            getRecentTrades(token),
        ]);
        if (!ticker) {
            console.error('Failed to get ticker data for', token);
            return null;
        }
        const open24h = parseFloat(ticker.open24h);
        const last = parseFloat(ticker.last);
        const priceChangePercent24h = ((last - open24h) / open24h) * 100;
        const candlesticks = convertCandlestickData(candlestickData);
        const recentTrades = trades.map(trade => ({
            price: parseFloat(trade.px),
            size: parseFloat(trade.sz),
            side: trade.side === 'buy' ? 'buy' : 'sell' as 'buy' | 'sell',
            timestamp: new Date(parseInt(trade.ts)).toISOString(),
        }));
        return {
            symbol: token,
            price: last,
            priceChangePercent24h,
            high24h: parseFloat(ticker.high24h),
            low24h: parseFloat(ticker.low24h),
            volume24h: parseFloat(ticker.vol24h),
            lastUpdated: new Date(parseInt(ticker.ts)).toISOString(),
            candlesticks,
            recentTrades,
        };
    } catch (error) {
        console.error('Error getting token market data:', error);
        return null;
    }
} 