import React, { useState, useEffect } from 'react';
import { OKXDexService } from '../services/okxDexService';
import { SolanaAgentKit } from 'solana-agent-kit';

interface TokenSwapProps {
  agent: SolanaAgentKit;
}

export const TokenSwap: React.FC<TokenSwapProps> = ({ agent }) => {
  const [fromToken, setFromToken] = useState('SOL');
  const [toToken, setToToken] = useState('USDC');
  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [swapSuccess, setSwapSuccess] = useState<any>(null);

  const okxDexService = new OKXDexService(agent);

  const tokens = [
    { symbol: 'SOL', name: 'Solana', icon: '◎', color: '#14F195' },
    { symbol: 'USDC', name: 'USD Coin', icon: '$', color: '#2775CA' },
    { symbol: 'USDT', name: 'Tether', icon: '₮', color: '#26A17B' }
  ];

  const handleGetQuote = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSwapSuccess(null);
      
      const result = await okxDexService.getQuote({
        fromToken,
        toToken,
        amount: parseFloat(amount),
      });
      
      setQuote(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get quote';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSwap = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const result = await okxDexService.executeSwap({
        fromToken,
        toToken,
        amount: parseFloat(amount),
      });
      
      setSwapSuccess(result);
      setQuote(null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Swap failed';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const swapTokens = () => {
    setFromToken(toToken);
    setToToken(fromToken);
    setQuote(null);
    setError(null);
    setSwapSuccess(null);
  };

  const getTokenIcon = (symbol: string) => {
    const token = tokens.find(t => t.symbol === symbol);
    return token ? token.icon : '◎';
  };

  const getTokenColor = (symbol: string) => {
    const token = tokens.find(t => t.symbol === symbol);
    return token ? token.color : '#14F195';
  };

  return (
    <div className="swap-wrapper">
      {/* Header */}
      <div className="swap-title">
        <h2>Swap Tokens</h2>
        <p>Exchange your crypto instantly</p>
      </div>

      {/* Main Swap Card */}
      <div className="swap-card">
        {/* From Token Section */}
        <div className="token-section">
          <div className="section-label">From</div>
          <div className="token-container">
            <div className="token-selector">
              <div className="token-info">
                <div 
                  className="token-icon" 
                  style={{ backgroundColor: getTokenColor(fromToken) }}
                >
                  {getTokenIcon(fromToken)}
                </div>
                <select
                  value={fromToken}
                  onChange={(e) => setFromToken(e.target.value)}
                  className="token-dropdown"
                >
                  {tokens.map(token => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="amount-field"
                step="0.000001"
                min="0"
              />
            </div>
            <div className="balance-info">
              Balance: -- {fromToken}
            </div>
          </div>
        </div>

        {/* Swap Arrow */}
        <div className="swap-divider">
          <button onClick={swapTokens} className="swap-button">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M7 16V4M7 4L3 8M7 4L11 8M17 8V20M17 20L21 16M17 20L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>

        {/* To Token Section */}
        <div className="token-section">
          <div className="section-label">To</div>
          <div className="token-container">
            <div className="token-selector">
              <div className="token-info">
                <div 
                  className="token-icon" 
                  style={{ backgroundColor: getTokenColor(toToken) }}
                >
                  {getTokenIcon(toToken)}
                </div>
                <select
                  value={toToken}
                  onChange={(e) => setToToken(e.target.value)}
                  className="token-dropdown"
                >
                  {tokens.map(token => (
                    <option key={token.symbol} value={token.symbol}>
                      {token.symbol}
                    </option>
                  ))}
                </select>
              </div>
              <div className="amount-display">
                {quote ? quote.summary.toAmount.toFixed(6) : '0.00'}
              </div>
            </div>
            <div className="balance-info">
              Balance: -- {toToken}
            </div>
          </div>
        </div>
      </div>

      {/* Quote Information */}
      {quote && (
        <div className="quote-section">
          <div className="quote-header">
            <span className="quote-title">Quote Details</span>
            <span className="quote-badge">Best Rate</span>
          </div>
          <div className="quote-items">
            <div className="quote-item">
              <span>Rate</span>
              <span>1 {fromToken} = {quote.summary.exchangeRate.toFixed(4)} {toToken}</span>
            </div>
            <div className="quote-item">
              <span>Price Impact</span>
              <span className="impact-value">{quote.summary.priceImpact}</span>
            </div>
            <div className="quote-item">
              <span>Route</span>
              <span>{quote.summary.quoteData?.route || 'Direct'}</span>
            </div>
            <div className="quote-item">
              <span>Network Fee</span>
              <span>{quote.summary.quoteData?.estimatedGas || '~$0.01'}</span>
            </div>
          </div>
        </div>
      )}

      {/* Success State */}
      {swapSuccess && (
        <div className="success-section">
          <div className="success-icon">✓</div>
          <h3>Swap Successful!</h3>
          <div className="success-details">
            <p>You swapped <strong>{swapSuccess.summary.fromAmount} {swapSuccess.summary.fromToken}</strong></p>
            <p>You received <strong>{swapSuccess.summary.toAmount} {swapSuccess.summary.toToken}</strong></p>
            <a href={swapSuccess.summary.explorerUrl} target="_blank" rel="noopener noreferrer" className="explorer-link">
              View Transaction →
            </a>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="error-section">
          <div className="error-icon">!</div>
          <p>{error}</p>
        </div>
      )}

      {/* Action Button */}
      <div className="action-section">
        {!quote && !swapSuccess && (
          <button
            onClick={handleGetQuote}
            disabled={loading || !amount || fromToken === toToken}
            className="action-button primary"
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Getting Quote...
              </>
            ) : (
              'Get Quote'
            )}
          </button>
        )}
        
        {quote && !swapSuccess && (
          <button
            onClick={handleSwap}
            disabled={loading}
            className="action-button success"
          >
            {loading ? (
              <>
                <div className="loading-spinner"></div>
                Executing Swap...
              </>
            ) : (
              `Confirm Swap`
            )}
          </button>
        )}

        {swapSuccess && (
          <button
            onClick={() => {
              setSwapSuccess(null);
              setQuote(null);
              setAmount('');
            }}
            className="action-button secondary"
          >
            New Swap
          </button>
        )}
      </div>
    </div>
  );
}; 