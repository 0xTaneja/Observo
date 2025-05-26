interface OKXToken {
  tokenContractAddress: string;
  tokenSymbol: string;
  tokenUnitPrice: string;
  decimal: string;
  isHoneyPot: boolean;
  taxRate: string;
}
interface OKXQuoteResponse {
  code: string;
  data: Array<{
    routerResult: {
      chainId: string;
      chainIndex: string;
      fromToken: OKXToken;
      toToken: OKXToken;
      fromTokenAmount: string;
      toTokenAmount: string;
      estimateGasFee: string;
      priceImpactPercentage: string;
      tradeFee: string;
    };
  }>;
  msg: string;
}
interface OKXSwapResponse {
  code: string;
  data: Array<{
    routerResult: {
      chainId: string;
      chainIndex: string;
      fromToken: OKXToken;
      toToken: OKXToken;
      fromTokenAmount: string;
      toTokenAmount: string;
      estimateGasFee: string;
      priceImpactPercentage: string;
      tradeFee: string;
    };
    tx: {
      data: string;
      from: string;
      gas: string;
      gasPrice: string;
      to: string;
      value: string;
      minReceiveAmount: string;
      slippage: string;
    };
  }>;
  msg: string;
}
export class OKXDexService {
  private baseUrl = 'https://web3.okx.com/api/v5/dex/aggregator';
  private chainIndex = '501'; 
  private chainId = '501'; 
  private apiKey: string;
  private secretKey: string;
  private passphrase: string;
  constructor(config: { apiKey: string; secretKey: string; passphrase: string }) {
    this.apiKey = config.apiKey;
    this.secretKey = config.secretKey;
    this.passphrase = config.passphrase;
  }
  async getTokens(): Promise<OKXToken[]> {
    try {
      const url = `${this.baseUrl}/all-tokens?chainIndex=${this.chainIndex}`;
      const headers = await this.generateHeaders('GET', `/api/v5/dex/aggregator/all-tokens?chainIndex=${this.chainIndex}`, '');
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });
      if (!response.ok) {
        throw new Error(`OKX API error: ${response.status}`);
      }
      const data = await response.json();
      if (data.code !== '0') {
        throw new Error(`OKX API error: ${data.msg}`);
      }
      return data.data || [];
    } catch (error) {
      console.error('Error fetching OKX tokens:', error);
      throw error;
    }
  }
  async getQuote(params: {
    fromTokenAddress: string;
    toTokenAddress: string;
    amount: string; 
    slippage?: string;
  }): Promise<OKXQuoteResponse> {
    try {
      if (!params.fromTokenAddress) {
        throw new Error('Missing fromTokenAddress parameter');
      }
      if (!params.toTokenAddress) {
        throw new Error('Missing toTokenAddress parameter');
      }
      if (!params.amount) {
        throw new Error('Missing amount parameter');
      }
      if (params.amount === '0') {
        console.error('❌ Amount cannot be zero');
        throw new Error('Amount cannot be zero');
      }
      if (!/^\d+$/.test(params.amount)) {
        console.error('❌ Invalid amount format:', params.amount);
        throw new Error('Amount must be a valid integer string (in smallest units with no decimals)');
      }
      if (params.amount.length < 2) {
        console.warn('⚠️ Amount might be too small, adding a zero');
        params.amount = params.amount + '0';
      }
      const queryParams = new URLSearchParams({
        chainIndex: this.chainIndex,    
        chainId: this.chainId,          
        fromTokenAddress: params.fromTokenAddress, 
        toTokenAddress: params.toTokenAddress,     
        amount: params.amount,          
        directRoute: 'false',           
        priceImpactProtectionPercentage: '1.0'     
      });
      const url = `${this.baseUrl}/quote?${queryParams.toString()}`;
      const requestPath = `/api/v5/dex/aggregator/quote?${queryParams.toString()}`;
      const headers = await this.generateHeaders('GET', requestPath, '');
      console.log('🔍 Getting OKX quote:', url);
      console.log('🔍 Quote parameters:', Object.fromEntries(queryParams));
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });
      console.log(`📊 Response status: ${response.status}`);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ OKX Quote API HTTP Error:', response.status, errorText);
        throw new Error(`OKX Quote API error: ${response.status} - ${errorText}`);
      }
      const data: OKXQuoteResponse = await response.json();
      console.log('📊 Raw response data:', JSON.stringify(data).slice(0, 200) + '...');
      if (data.code !== '0') {
        console.error('❌ OKX Quote API Error Response:', JSON.stringify(data));
        console.error('❌ Failed request parameters:', Object.fromEntries(queryParams));
        if (data.msg === 'Insufficient liquidity') {
          const minAmount = 10000; 
          if (parseInt(params.amount) < minAmount) {
            console.log(`⚠️ Amount may be too small. Trying with minimum test amount: ${minAmount}`);
            const testParams = {
              ...params,
              amount: minAmount.toString()
            };
            try {
              const testQuote = await this.getTestQuote(testParams);
              if (testQuote && testQuote.code === '0') {
                console.log('✅ Test quote successful - pair has liquidity at higher amounts');
                throw new Error(`Insufficient liquidity for this amount. Try with a larger amount (min ~${minAmount} units).`);
              }
            } catch (testError) {
              console.error('❌ Test quote also failed:', testError);
            }
          }
        }
        throw new Error(`OKX Quote error: ${data.msg}`);
      }
      console.log('✅ OKX Quote received:', data);
      return data;
    } catch (error) {
      console.error('Error getting OKX quote:', error);
      throw error;
    }
  }
  private async getTestQuote(params: {
    fromTokenAddress: string;
    toTokenAddress: string;
    amount: string;
  }): Promise<any> {
    const queryParams = new URLSearchParams({
      chainIndex: this.chainIndex,
      chainId: this.chainId,
      fromTokenAddress: params.fromTokenAddress,
      toTokenAddress: params.toTokenAddress,
      amount: params.amount,
      directRoute: 'false'
    });
    const url = `${this.baseUrl}/quote?${queryParams.toString()}`;
    const requestPath = `/api/v5/dex/aggregator/quote?${queryParams.toString()}`;
    const headers = await this.generateHeaders('GET', requestPath, '');
    console.log('🧪 Running test quote with larger amount:', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });
    return await response.json();
  }
  async getSwap(params: {
    fromTokenAddress: string;
    toTokenAddress: string;
    amount: string; 
    userWalletAddress: string;
    slippage?: string;
  }): Promise<OKXSwapResponse> {
    try {
      const slippage = params.slippage || '0.01'; 
      const queryParams = new URLSearchParams({
        chainIndex: this.chainIndex,
        chainId: this.chainId, 
        fromTokenAddress: params.fromTokenAddress,
        toTokenAddress: params.toTokenAddress,
        amount: params.amount,
        userWalletAddress: params.userWalletAddress,
        slippage: slippage
      });
      const url = `${this.baseUrl}/swap?${queryParams.toString()}`;
      const requestPath = `/api/v5/dex/aggregator/swap?${queryParams.toString()}`;
      const headers = await this.generateHeaders('GET', requestPath, '');
      console.log('🔄 Getting OKX swap data:', url);
      const response = await fetch(url, {
        method: 'GET',
        headers: headers
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OKX Swap API error: ${response.status} - ${errorText}`);
      }
      const data: OKXSwapResponse = await response.json();
      if (data.code !== '0') {
        throw new Error(`OKX Swap error: ${data.msg}`);
      }
      console.log('✅ OKX Swap data received:', data);
      return data;
    } catch (error) {
      console.error('Error getting OKX swap:', error);
      throw error;
    }
  }
  private async generateHeaders(method: string, requestPath: string, body: string): Promise<Record<string, string>> {
    const timestamp = new Date().toISOString();
    const signatureString = timestamp + method + requestPath + body;
    const signature = await this.generateHMACSignature(signatureString, this.secretKey);
    return {
      'OK-ACCESS-KEY': this.apiKey,
      'OK-ACCESS-SIGN': signature,
      'OK-ACCESS-TIMESTAMP': timestamp,
      'OK-ACCESS-PASSPHRASE': this.passphrase,
      'Content-Type': 'application/json'
    };
  }
  private async generateHMACSignature(message: string, secret: string): Promise<string> {
    try {
      const encoder = new TextEncoder();
      const keyData = encoder.encode(secret);
      const messageData = encoder.encode(message);
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
      const signatureArray = new Uint8Array(signature);
      const base64Signature = btoa(String.fromCharCode(...signatureArray));
      return base64Signature;
    } catch (error) {
      console.error('Error generating HMAC signature:', error);
      throw new Error('Failed to generate API signature');
    }
  }
  static getCommonTokens() {
    return {
      SOL: 'So11111111111111111111111111111111111111112', 
      USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
      BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
      WIF: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
      PEPE: '5z3EqYQo9HiCdY3g7Jj8bG5P9QJvLqX7Hs1rGjKvUqAB', 
      JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
      RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
      ORCA: 'orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE',
      SAMO: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU'
    };
  }
  static toSmallestUnits(amount: number, decimals: number): string {
    try {
      if (amount <= 0) {
        console.error('Cannot convert zero or negative amount to smallest units');
        return '0';
      }
      if (decimals === 9) { 
        const amountStr = amount.toString();
        if (amountStr.includes('.')) {
          const parts = amountStr.split('.');
          const integerPart = parts[0];
          const decimalPart = parts[1].padEnd(9, '0').slice(0, 9);
          console.log(`🔍 SOL amount conversion: ${amount} -> ${integerPart}${decimalPart}`);
          return integerPart + decimalPart;
        } else {
          const result = amount + '000000000'; 
          console.log(`🔍 Integer SOL conversion: ${amount} -> ${result}`);
          return result;
        }
      }
      const amountStr = amount.toString();
      if (amountStr.includes('.')) {
        const parts = amountStr.split('.');
        const integerPart = parts[0];
        const decimalPart = parts[1].padEnd(decimals, '0').slice(0, decimals);
        const result = integerPart + decimalPart;
        const cleanResult = result.replace(/^0+/, '') || '0';
        console.log(`🔍 Amount conversion: ${amount} with ${decimals} decimals -> ${cleanResult}`);
        if (cleanResult === '0' && amount > 0) {
          console.warn(`⚠️ Amount ${amount} converted to 0! Using minimum value.`);
          return '1' + '0'.repeat(Math.max(0, decimals - 1));
        }
        return cleanResult;
      } else {
        let result = '';
        if (decimals <= 15) {
          if (amount >= 1000000) {
            result = amount + '0'.repeat(decimals);
          } else {
            const multiplier = Math.pow(10, decimals);
            result = Math.floor(amount * multiplier).toString();
          }
        } else {
          result = amount + '0'.repeat(decimals);
        }
        console.log(`🔍 Amount conversion (integer): ${amount} with ${decimals} decimals -> ${result}`);
        return result;
      }
    } catch (error) {
      console.error('Error converting to smallest units:', error);
      if (amount > 0) {
        return '1' + '0'.repeat(decimals > 0 ? decimals - 1 : 0);
      }
      return '0';
    }
  }
  static fromSmallestUnits(amount: string, decimals: number): number {
    return parseInt(amount) / Math.pow(10, decimals);
  }
  static fromSmallestUnitsSafe(amount: string | undefined, decimals: number): number {
    if (!amount || amount === '0') {
      return 0;
    }
    try {
      const amountStr = typeof amount === 'string' ? amount : String(amount);
      if (amountStr.length <= decimals) {
        const leadingZeros = decimals - amountStr.length;
        const decimalPart = amountStr.padStart(decimals, '0');
        const formattedAmount = `0.${decimalPart}`;
        console.log(`🔍 Formatted very small amount: ${amountStr} with ${decimals} decimals -> ${formattedAmount}`);
        return parseFloat(formattedAmount);
      }
      return parseInt(amountStr) / Math.pow(10, decimals);
    } catch (error) {
      console.error('Error converting from smallest units:', error);
      const amountNum = typeof amount === 'string' ? parseInt(amount) : 0;
      return amountNum / Math.pow(10, decimals);
    }
  }
} 