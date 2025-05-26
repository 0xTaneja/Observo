import { CandlestickData, Time } from 'lightweight-charts';
const DEX_API_BASE_URL = 'https://www.okx.com/api/v5/market';
const ENDPOINTS = {
    CANDLESTICKS: '/candles',
    TRADES: '/trades',
    TICKER: '/ticker',
    PRICE: '/price',
};
export enum MarketSentiment {
    VERY_BULLISH = 'VERY_BULLISH',
    BULLISH = 'BULLISH',
    NEUTRAL = 'NEUTRAL',
    BEARISH = 'BEARISH',
    VERY_BEARISH = 'VERY_BEARISH',
}
export interface TokenPrice {
    symbol: string;
    price: number;
    priceChangePercent24h: number;
    volume24h: number;
    lastUpdated: string;
}
export interface Trade {
    price: number;
    size: number;
    side: 'buy' | 'sell';
    timestamp: string;
}
export interface MarketData {
    price: TokenPrice;
    candlesticks: CandlestickData[];
    recentTrades: Trade[];
    sentiment: MarketSentiment;
    sentimentReason: string;
}
function calculateMarketSentiment(trades: Trade[], priceChange: number): { sentiment: MarketSentiment, reason: string } {
    const buyCount = trades.filter(t => t.side === 'buy').length;
    const sellCount = trades.filter(t => t.side === 'sell').length;
    const buyVolume = trades.filter(t => t.side === 'buy').reduce((sum, t) => sum + t.size, 0);
    const sellVolume = trades.filter(t => t.side === 'sell').reduce((sum, t) => sum + t.size, 0);
    const tradeRatio = buyCount / (sellCount || 1);
    const volumeRatio = buyVolume / (sellVolume || 1);
    let sentiment: MarketSentiment;
    let reason: string;
    if (priceChange > 10 && tradeRatio > 1.5 && volumeRatio > 1.5) {
        sentiment = MarketSentiment.VERY_BULLISH;
        reason = 'Strong price increase with high buy volume';
    } else if (priceChange > 5 && tradeRatio > 1.2) {
        sentiment = MarketSentiment.BULLISH;
        reason = 'Price increase with more buyers than sellers';
    } else if (priceChange < -10 && tradeRatio < 0.5 && volumeRatio < 0.5) {
        sentiment = MarketSentiment.VERY_BEARISH;
        reason = 'Sharp price decrease with high sell volume';
    } else if (priceChange < -5 && tradeRatio < 0.8) {
        sentiment = MarketSentiment.BEARISH;
        reason = 'Price decrease with more sellers than buyers';
    } else {
        sentiment = MarketSentiment.NEUTRAL;
        reason = 'Balanced buying and selling activity';
    }
    return { sentiment, reason };
}
export async function fetchCandlesticks(symbol: string, timeframe: string = '1D', limit: number = 30): Promise<CandlestickData[]> {
    try {
        const sampleData: CandlestickData[] = [];
        const now = new Date();
        let basePrice = 100 + Math.random() * 50;
        for (let i = 0; i < limit; i++) {
            const date = new Date(now);
            date.setDate(now.getDate() - (limit - i));
            const volatility = 5 + Math.random() * 10;
            const open = basePrice;
            const close = basePrice + (Math.random() - 0.5) * volatility;
            const low = Math.min(open, close) - Math.random() * volatility * 0.5;
            const high = Math.max(open, close) + Math.random() * volatility * 0.5;
            sampleData.push({
                time: date.getTime() / 1000 as Time,
                open,
                high,
                low,
                close
            });
            basePrice = close;
        }
        return sampleData;
    } catch (error) {
        console.error('Error fetching candlestick data:', error);
        return [];
    }
}
export async function fetchRecentTrades(symbol: string, limit: number = 20): Promise<Trade[]> {
    try {
        const sampleTrades: Trade[] = [];
        const now = new Date();
        const basePrice = 100 + Math.random() * 50;
        for (let i = 0; i < limit; i++) {
            const minutesAgo = i * 2;
            const date = new Date(now);
            date.setMinutes(now.getMinutes() - minutesAgo);
            const side = Math.random() > 0.5 ? 'buy' : 'sell';
            const price = basePrice + (Math.random() - 0.5) * 10;
            const size = 0.1 + Math.random() * 5;
            sampleTrades.push({
                price,
                size,
                side,
                timestamp: date.toISOString()
            });
        }
        return sampleTrades;
    } catch (error) {
        console.error('Error fetching recent trades:', error);
        return [];
    }
}
export async function fetchTokenPrice(symbol: string): Promise<TokenPrice> {
    try {
        const basePrice = 100 + Math.random() * 50;
        const priceChangePercent = (Math.random() - 0.3) * 20; 
        const volume = 100000 + Math.random() * 900000;
        return {
            symbol,
            price: basePrice,
            priceChangePercent24h: priceChangePercent,
            volume24h: volume,
            lastUpdated: new Date().toISOString()
        };
    } catch (error) {
        console.error('Error fetching token price:', error);
        return {
            symbol,
            price: 0,
            priceChangePercent24h: 0,
            volume24h: 0,
            lastUpdated: new Date().toISOString()
        };
    }
}
export async function fetchMarketData(symbol: string): Promise<MarketData> {
    try {
        const [price, candlesticks, recentTrades] = await Promise.all([
            fetchTokenPrice(symbol),
            fetchCandlesticks(symbol),
            fetchRecentTrades(symbol)
        ]);
        const { sentiment, reason } = calculateMarketSentiment(recentTrades, price.priceChangePercent24h);
        return {
            price,
            candlesticks,
            recentTrades,
            sentiment,
            sentimentReason: reason
        };
    } catch (error) {
        console.error('Error fetching market data:', error);
        throw error;
    }
} 