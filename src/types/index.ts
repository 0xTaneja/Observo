export interface TokenMention {
    symbol: string;
    position: { start: number, end: number };
    context: string;
}
export interface WalletAddress {
    address: string;
    position: { start: number, end: number };
    context: string;
}
export interface TradingSignal {
    action: 'BUY' | 'SELL' | 'AVOID' | 'INVERT' | 'HOLD' | 'HODL' | 'HODS';
    confidence: number;
    explanation: string;
    token?: string;
    price?: number;
    recommendation?: string;
}
export interface DetectedContent {
    tokens: TokenMention[];
    wallets: WalletAddress[];
    hypeLanguage: string[];
    fullText: string;
}