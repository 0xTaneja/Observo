import { TokenMention, WalletAddress, DetectedContent, TradingSignal } from "../types";
const TOKEN_PATTERN = /\$([A-Z][A-Z0-9]{1,9})\b/gi;
const WALLET_PATTERN = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
const DOLLAR_AMOUNT_PATTERNS = [
    /^\d+[kmbtKMBT]?$/i,  
    /^\d+\.?\d*[kmbtKMBT]?$/i,  
    /^[0-9]+$/,  
    /^[0-9]+[kmbtKMBT]$/i,  
    /^\d+\.\d+[kmbtKMBT]?$/i,  
    /^\d+[kmbtKMBT]\d*$/i,  
];
const COMMON_ABBREVIATIONS = new Set([
    'USD', 'EUR', 'GBP', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'INR', 
    'CEO', 'CTO', 'CFO', 'AI', 'ML', 'API', 'SDK', 'UI', 'UX', 
    'ATH', 'ATL', 'YTD', 'EOY', 'Q1', 'Q2', 'Q3', 'Q4', 
    'TV', 'PC', 'CPU', 'GPU', 'RAM', 'SSD', 'HDD', 
    'USA', 'NYC', 'LA', 'UK', 'EU', 'US', 
    'AM', 'PM', 'EST', 'PST', 'GMT', 'UTC', 
    'LLC', 'INC', 'LTD', 'CO', 'CORP', 
]);
const KNOWN_CRYPTO_TOKENS = new Set([
    'BTC', 'ETH', 'SOL', 'ADA', 'DOT', 'LINK', 'UNI', 'AAVE', 'COMP',
    'DOGE', 'SHIB', 'PEPE', 'FLOKI', 'BONK', 'WIF', 'BOME',
    'USDT', 'USDC', 'BUSD', 'DAI', 'FRAX', 'TUSD',
    'MATIC', 'AVAX', 'ATOM', 'NEAR', 'FTM', 'ALGO',
    'VIRTUAL', 'AI16Z', 'GOAT', 'FARTCOIN', 'PNUT', 'ACT',
    'TRUMP', 'MAGA', 'BIDEN', 'TRUMPCOIN', 'TRUMP2024', 'TRUMP47'
]);
const HYPE_KEYWORDS = [
    'moon', 'mooning', 'to the moon', '🚀',
    'rug', 'rugpull', 'rug pull', 'scam',
    '100x', '1000x', 'moonshot', 'gem',
    'diamond hands', 'paper hands', 'hodl',
    'pump', 'dump', 'dip', 'buy the dip',
    'lambo', 'when lambo', 'degenerste', 'ape in',
    'wagmi', 'ngmi', 'probably nothing',
    'bullish', 'bearish', 'bottomed out'
]
export function detectTokens(text: string): TokenMention[] {
    const tokens: TokenMention[] = [];
    let match;
    TOKEN_PATTERN.lastIndex = 0;
    while ((match = TOKEN_PATTERN.exec(text)) !== null) {
        const symbol = match[1].toUpperCase();
        if (isValidTokenSymbol(symbol, text, match.index)) {
            tokens.push({
                symbol: symbol,
                position: {
                    start: match.index,
                    end: match.index + match[0].length
                },
                context: getContext(text, match.index, 50)
            });
        }
    }
    return tokens;
}
function isValidTokenSymbol(symbol: string, fullText: string, position: number): boolean {
    if (KNOWN_CRYPTO_TOKENS.has(symbol)) {
        return true;
    }
    for (const pattern of DOLLAR_AMOUNT_PATTERNS) {
        if (pattern.test(symbol)) {
            console.log(`Filtered out dollar amount: $${symbol}`);
            return false;
        }
    }
    if (COMMON_ABBREVIATIONS.has(symbol)) {
        console.log(`Filtered out common abbreviation: $${symbol}`);
        return false;
    }
    if (/^\d/.test(symbol)) {
        console.log(`Filtered out number starting token: $${symbol}`);
        return false;
    }
    if (!/[A-Z]/i.test(symbol)) {
        return false;
    }
    if (symbol.length < 2 || symbol.length > 10) {
        return false;
    }
    const context = getContext(fullText, position, 20).toLowerCase();
    const dollarAmountContext = [
        'staked', 'worth', 'value', 'price', 'cost', 'paid', 'spent',
        'invested', 'lost', 'gained', 'profit', 'loss', 'fee', 'fees',
        'deposit', 'withdraw', 'transfer', 'send', 'receive'
    ];
    for (const contextWord of dollarAmountContext) {
        if (context.includes(contextWord)) {
            console.log(`Filtered out due to dollar context: $${symbol} (context: ${contextWord})`);
            return false;
        }
    }
    const vowels = symbol.match(/[AEIOU]/g);
    const consonants = symbol.match(/[BCDFGHJKLMNPQRSTVWXYZ]/g);
    if (symbol.length > 3) {
        if (!vowels || !consonants) {
            return false; 
        }
    }
    return true;
}
export function detectWallets(text: string): WalletAddress[] {
    const wallets: WalletAddress[] = [];
    let match;
    WALLET_PATTERN.lastIndex = 0;
    while ((match = WALLET_PATTERN.exec(text)) !== null) {
        if (!isLikelyWalletAddress(match[0]))
            continue;
        wallets.push({
            address: match[0],
            position: {
                start: match.index,
                end: match.index + match[0].length
            },
            context: getContext(text, match.index, 50)
        });
    }
    return wallets;
}
export function detectHypeLanguage(text: string): string[] {
    const found: string[] = [];
    const lowerText = text.toLowerCase();
    HYPE_KEYWORDS.forEach(keyword => {
        if (lowerText.includes(keyword.toLowerCase())) {
            found.push(keyword);
        }
    });
    return [...new Set(found)];
}
export function detectAll(text: string): DetectedContent {
    return {
        tokens: detectTokens(text),
        wallets: detectWallets(text),
        hypeLanguage: detectHypeLanguage(text),
        fullText: text
    }
}
function getContext(text: string, position: number, radius: number): string {
    const start = Math.max(0, position - radius);
    const end = Math.min(text.length, position + radius);
    return text.slice(start, end);
}
function isLikelyWalletAddress(address: string): boolean {
    if (address.length < 32 || address.length > 44)
        return false;
    const uniqueChars = new Set(address).size;
    if (uniqueChars < 8)
        return false;
    const suspiciousPatterns = /^(http|www|com|org|[0-9]+$)/i;
    if (suspiciousPatterns.test(address)) return false;
    return true;
}
