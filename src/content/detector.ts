import { TokenMention,WalletAddress,DetectedContent,TradingSignal } from "../types";

const TOKEN_PATTERN = /\$([A-Z0-9]{2,10})\b/gi;


const WALLET_PATTERN = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;

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

export function detectTokens(text:string):TokenMention[]{
    const tokens:TokenMention[] = [];
    let match;

    TOKEN_PATTERN.lastIndex = 0;

    while((match = TOKEN_PATTERN.exec(text)) !==null){
        tokens.push({
            symbol:match[1],
            position:{
                start:match.index,
                end:match.index+match[0].length
            },
            context:getContext(text,match.index,50)
        })
    }
    return tokens;
}

export function detectWallets(text:string):WalletAddress[]{
    const wallets:WalletAddress[]=[];
    let match;
    WALLET_PATTERN.lastIndex = 0;

    while ((match = WALLET_PATTERN.exec(text)) !== null) {


        if(!isLikelyWalletAddress(match[0]))
            continue;

        
        wallets.push({
            address:match[0],
            position:{
                start:match.index,
                end:match.index+match[0].length
            },
            context:getContext(text,match.index,50)
        });
    }
    return wallets;
   
}


export function detectHypeLanguage(text:string):string[]{
    const found:string[]= [];

    const lowerText = text.toLowerCase();

    HYPE_KEYWORDS.forEach(keyword=>{
        if(lowerText.includes(keyword.toLowerCase())){
            found.push(keyword);
        }
    });
    return [...new Set(found)];

}

export function detectAll(text:string):DetectedContent{
    return {
        tokens:detectTokens(text),
        wallets:detectWallets(text),
        hypeLanguage:detectHypeLanguage(text),
        fullText:text
    }
}

function getContext(text: string, position: number, radius: number): string {
    const start = Math.max(0, position - radius);
    const end = Math.min(text.length, position + radius);
    return text.slice(start, end);
}

function isLikelyWalletAddress(address:string):boolean{

    if (address.length <32 || address.length > 44)
        return false;

    const uniqueChars = new Set(address).size;
    if(uniqueChars < 8)
        return false;

    const suspiciousPatterns = /^(http|www|com|org|[0-9]+$)/i;
    if (suspiciousPatterns.test(address)) return false;
    
    return true;
}
  