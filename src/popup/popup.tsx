import * as React from 'react';
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './popup.css';
interface Settings {
  enabled: boolean;
}
interface RecentSignal {
  action: string;
  token: string;
  confidence: number;
  timestamp: number;
  explanation?: string;
  content?: {
    fullText: string;
    tokens: string[];
    wallets: string[];
    hypeLanguage: string[];
  };
}
const Popup: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'signals'>('dashboard');
  const [settings, setSettings] = useState<Settings>({
    enabled: true
  });
  const [recentSignals, setRecentSignals] = useState<RecentSignal[]>([]);
  const [stats, setStats] = useState({
    totalSignals: 0,
    buySignals: 0,
    sellSignals: 0,
    holdSignals: 0,
    avoidSignals: 0,
    accuracy: 0
  });
  const [walletConnected, setWalletConnected] = useState<boolean>(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [signalsError, setSignalsError] = useState<string | null>(null);
  const [connectedWallet, setConnectedWallet] = useState<any>(null);
  const [activeFilter, setActiveFilter] = useState<'all' | 'buy' | 'sell' | 'hold' | 'avoid' | 'high-confidence'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  useEffect(() => {
    loadSettings();
    loadRecentSignals();
    loadStats();
    loadWalletState();
  }, []);
  const loadWalletState = async () => {
    try {
      const result = await chrome.storage.local.get(['walletConnected', 'walletAddress', 'walletProvider']);
      if (result.walletConnected && result.walletAddress) {
        setWalletConnected(true);
        setWalletAddress(result.walletAddress);
        console.log('📱 Wallet state loaded from storage:', {
          address: result.walletAddress,
          provider: result.walletProvider
        });
      }
    } catch (error) {
      console.error('Error loading wallet state:', error);
    }
  };
  const openSwapInNewTab = () => {
    connectWalletViaContentScript();
  };
  const connectWalletViaContentScript = async () => {
    try {
      chrome.tabs.query({ url: ["https://twitter.com/*", "https://x.com/*"] }, async (tabs) => {
        if (tabs.length > 0) {
          const twitterTab = tabs[0];
          chrome.tabs.sendMessage(twitterTab.id!, {
            type: 'CONNECT_WALLET_REQUEST'
          }, (response) => {
            if (response && response.success) {
              handleWalletConnectionSuccess(response);
            } else {
              openTwitterSwapInterface(twitterTab.id!);
            }
          });
        } else {
          chrome.tabs.create({ 
            url: 'https://twitter.com/home'
          }, (tab) => {
            setTimeout(() => {
              if (tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                  type: 'SHOW_SWAP_INTERFACE'
                });
              }
            }, 3000);
          });
        }
      });
    } catch (error) {
      console.error('Error connecting wallet via content script:', error);
      showFallbackInstructions();
    }
  };
  const openTwitterSwapInterface = (tabId: number) => {
    chrome.tabs.sendMessage(tabId, {
      type: 'SHOW_SWAP_INTERFACE'
    });
    chrome.tabs.update(tabId, { active: true });
  };
  const handleWalletConnectionSuccess = (response: any) => {
    setWalletConnected(true);
    setWalletAddress(response.walletAddress);
    setWalletError(null);
    chrome.storage.local.set({
      walletConnected: true,
      walletAddress: response.walletAddress,
      walletProvider: response.walletProvider
    });
    console.log('✅ Wallet connected via Twitter content script!');
    console.log('Address:', response.walletAddress);
    console.log('Provider:', response.walletProvider);
    alert(`✅ Wallet Connected!\n\nAddress: ${response.walletAddress.slice(0, 8)}...\nProvider: ${response.walletProvider.toUpperCase()}\n\nTrading signals are now ready!`);
  };
  const showFallbackInstructions = () => {
    setWalletError(`
🔄 Wallet Connection Steps:
1. Open Twitter/X in a new tab
2. Click the extension icon again  
3. The wallet will connect on Twitter where it works properly
4. Trading signals will then work with one-click buy!
This ensures seamless integration between wallet and trading signals.
    `);
  };
  const disconnectWallet = () => {
    setWalletConnected(false);
    setWalletAddress(null);
    setWalletError(null);
    setConnectedWallet(null);
    chrome.storage.local.remove(['walletConnected', 'walletAddress', 'walletProvider']);
  };
  const loadSettings = async () => {
    try {
      const result = await chrome.storage.sync.get(['quickalphaSettings']);
      if (result.quickalphaSettings) {
        setSettings({ ...settings, ...result.quickalphaSettings });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };
  const saveSettings = async () => {
    try {
      await chrome.storage.sync.set({ quickalphaSettings: settings });
      chrome.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: settings
      });
      alert('Settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('Error saving settings');
    }
  };
  const loadRecentSignals = async () => {
    try {
      setSignalsError(null);
      chrome.runtime.sendMessage({ type: 'GET_RECENT_SIGNALS' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          setSignalsError('Failed to communicate with background script');
          return;
        }
        if (response && response.success) {
          setRecentSignals(response.signals.slice(0, 10)); 
          console.log('Loaded signals:', response.signals);
        } else {
          console.error('Failed to load signals:', response?.error);
          setSignalsError(response?.error || 'Failed to load signals');
        }
      });
    } catch (error) {
      console.error('Error loading recent signals:', error);
      setSignalsError('Error loading signals: ' + String(error));
    }
  };
  const loadStats = async () => {
    try {
      chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
        if (response && response.success) {
          const updatedStats = {
            totalSignals: 0,
            buySignals: 0,
            sellSignals: 0,
            holdSignals: 0,
            avoidSignals: 0,
            accuracy: 0,
            ...response.stats
          };
          setStats(updatedStats);
          console.log('Loaded stats:', updatedStats);
        } else {
          console.error('Failed to load stats:', response?.error);
        }
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };
  const toggleExtension = async () => {
    const newSettings = { ...settings, enabled: !settings.enabled };
    setSettings(newSettings);
    await chrome.storage.sync.set({ quickalphaSettings: newSettings });
    chrome.runtime.sendMessage({
      type: 'TOGGLE_EXTENSION',
      enabled: newSettings.enabled
    });
  };
  const clearData = async () => {
    if (confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      try {
        chrome.runtime.sendMessage({ type: 'CLEAR_DATA' }, (response) => {
          if (response && response.success) {
            setRecentSignals([]);
            setStats({ 
              totalSignals: 0, 
              buySignals: 0, 
              sellSignals: 0,
              holdSignals: 0,
              avoidSignals: 0, 
              accuracy: 0 
            });
            alert('Data cleared successfully!');
          } else {
            alert('Error clearing data');
          }
        });
      } catch (error) {
        console.error('Error clearing data:', error);
        alert('Error clearing data');
      }
    }
  };
  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };
  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case 'buy': return '#10b981';
      case 'sell': return '#ef4444';
      case 'hold': return '#f59e0b';
      case 'avoid': return '#6b7280';
      case 'invert': return '#8b5cf6';
      default: return '#6b7280';
    }
  };
  const openDetailedAnalysis = (signal: RecentSignal) => {
    try {
      const signalData = {
        signal: {
          token: signal.token,
          action: signal.action,
          confidence: signal.confidence,
          explanation: signal.explanation
        },
        content: signal.content || {
          fullText: 'Tweet content not available',
          tokens: [],
          wallets: [],
          hypeLanguage: []
        },
        timestamp: signal.timestamp
      };
      const encodedData = encodeURIComponent(JSON.stringify(signalData));
      const detailsUrl = chrome.runtime.getURL(`popup/details.html?signal=${encodedData}`);
      chrome.tabs.create({ url: detailsUrl });
    } catch (error) {
      console.error('Error opening detailed analysis:', error);
      alert('Failed to open detailed analysis');
    }
  };
  const filterSignals = (signals: RecentSignal[]) => {
    let filteredSignals = [...signals];
    switch (activeFilter) {
      case 'buy':
        filteredSignals = filteredSignals.filter(signal => 
          signal.action?.toLowerCase() === 'buy'
        );
        break;
      case 'sell':
        filteredSignals = filteredSignals.filter(signal => 
          signal.action?.toLowerCase() === 'sell'
        );
        break;
      case 'hold':
        filteredSignals = filteredSignals.filter(signal => 
          signal.action?.toLowerCase() === 'hold'
        );
        break;
      case 'avoid':
        filteredSignals = filteredSignals.filter(signal => 
          signal.action?.toLowerCase() === 'avoid'
        );
        break;
      case 'high-confidence':
        filteredSignals = filteredSignals.filter(signal => 
          (signal.confidence || 0) >= 80
        );
        break;
      case 'all':
      default:
        break;
    }
    if (searchTerm.trim()) {
      filteredSignals = filteredSignals.filter(signal =>
        signal.token?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signal.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        signal.explanation?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    return filteredSignals;
  };
  const handleFilterChange = (filter: 'all' | 'buy' | 'sell' | 'hold' | 'avoid' | 'high-confidence') => {
    setActiveFilter(filter);
  };
  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };
  const filteredSignals = filterSignals(recentSignals);
  return (
    <div className="popup-container">
      <div className="popup-header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">Observo</span>
        </div>
        <div className="status-indicator">
          <div className={`status-dot ${settings.enabled ? 'active' : 'inactive'}`}></div>
          <span className="status-text">{settings.enabled ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          📊 Dashboard
        </button>
        <button 
          className={`tab-btn ${activeTab === 'signals' ? 'active' : ''}`}
          onClick={() => setActiveTab('signals')}
        >
          🔔 Signals
        </button>
        <button 
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          ⚙️ Settings
        </button>
      </div>
      <div className="tab-content">
        {activeTab === 'dashboard' && (
          <div className="dashboard-container">
            {}
            <div className="wallet-connection-section">
              <h3 className="section-title">Wallet Connection</h3>
              {walletConnected && walletAddress ? (
                <div className="connected-wallet">
                  <div className="wallet-status">
                    <div className="wallet-connected">
                      <div className="status-icon">✅</div>
                      <div className="wallet-details">
                        <div className="wallet-label">Connected Wallet</div>
                        <div className="wallet-address">{walletAddress.slice(0, 8)}...{walletAddress.slice(-8)}</div>
                      </div>
                      <button className="disconnect-btn" onClick={disconnectWallet}>
                        Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="wallet-connection">
                  <div className="wallet-options">
                    <button className="connect-wallet-btn" onClick={openSwapInNewTab}>
                      <div className="wallet-icon">🔗</div>
                      <div className="wallet-info">
                        <div className="wallet-name">Connect OKX Wallet</div>
                        <div className="wallet-description">Connect via Twitter for signal trading</div>
                      </div>
                    </button>
                  </div>
                  {walletError && (
                    <div className="wallet-error">
                      <div className="error-icon">⚠️</div>
                      <p>{walletError}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-icon">📈</div>
                <h3>Total Signals</h3>
                <p className="stat-value">{stats.totalSignals}</p>
                <span className="stat-trend">+12% this week</span>
              </div>
              <div className="stat-card">
                <div className="stat-icon">💚</div>
                <h3>Buy Signals</h3>
                <p className="stat-value">{stats.buySignals}</p>
                <span className="stat-trend">+8% this week</span>
              </div>
              <div className="stat-card">
                <div className="stat-icon">⚠️</div>
                <h3>Avoid Signals</h3>
                <p className="stat-value">{stats.avoidSignals}</p>
                <span className="stat-trend">-15% this week</span>
              </div>
              <div className="stat-card">
                <div className="stat-icon">🎯</div>
                <h3>Accuracy</h3>
                <p className="stat-value">{stats.accuracy}%</p>
                <span className="stat-trend">+2% this week</span>
              </div>
            </div>
            {}
            <div className="performance-section">
              <h3 className="section-title">Performance Overview</h3>
              <div className="performance-cards">
                <div className="performance-card">
                  <div className="performance-header">
                    <span className="performance-title">Win Rate</span>
                    <span className="performance-value">78.5%</span>
                  </div>
                  <div className="performance-bar">
                    <div className="performance-fill" style={{ width: '78.5%' }}></div>
                  </div>
                </div>
                <div className="performance-card">
                  <div className="performance-header">
                    <span className="performance-title">Avg Confidence</span>
                    <span className="performance-value">85.2%</span>
                  </div>
                  <div className="performance-bar">
                    <div className="performance-fill" style={{ width: '85.2%' }}></div>
                  </div>
                </div>
              </div>
            </div>
            {}
            <div className="activity-section">
              <h3 className="section-title">Recent Activity</h3>
              <div className="activity-list">
                <div className="activity-item">
                  <div className="activity-icon buy">📈</div>
                  <div className="activity-content">
                    <div className="activity-title">BUY signal detected</div>
                    <div className="activity-subtitle">SOL/USDC • 2 minutes ago</div>
                  </div>
                  <div className="activity-confidence">92%</div>
                </div>
                <div className="activity-item">
                  <div className="activity-icon avoid">⚠️</div>
                  <div className="activity-content">
                    <div className="activity-title">AVOID signal detected</div>
                    <div className="activity-subtitle">SHIB/USD • 15 minutes ago</div>
                  </div>
                  <div className="activity-confidence">76%</div>
                </div>
                <div className="activity-item">
                  <div className="activity-icon buy">📈</div>
                  <div className="activity-content">
                    <div className="activity-title">BUY signal detected</div>
                    <div className="activity-subtitle">USDC/USDT • 1 hour ago</div>
                  </div>
                  <div className="activity-confidence">84%</div>
                </div>
              </div>
            </div>
            {}
            <div className="quick-actions-section">
              <h3 className="section-title">Quick Actions</h3>
              <div className="quick-actions-grid">
                <button className="quick-action-btn" onClick={() => setActiveTab('signals')}>
                  <div className="action-icon">🔔</div>
                  <span>View Signals</span>
                </button>
                <button className="quick-action-btn" onClick={loadRecentSignals}>
                  <div className="action-icon">🔄</div>
                  <span>Refresh Data</span>
                </button>
                <button className="quick-action-btn" onClick={() => setActiveTab('settings')}>
                  <div className="action-icon">⚙️</div>
                  <span>Settings</span>
                </button>
                <button className="quick-action-btn" onClick={walletConnected ? disconnectWallet : openSwapInNewTab}>
                  <div className="action-icon">{walletConnected ? '🔌' : '🔗'}</div>
                  <span>{walletConnected ? 'Disconnect' : 'Connect Wallet'}</span>
                </button>
              </div>
            </div>
            {}
            <div className="market-status-section">
              <h3 className="section-title">Market Status</h3>
              <div className="market-indicators">
                <div className="market-indicator">
                  <div className="indicator-label">Market Sentiment</div>
                  <div className="indicator-value bullish">Bullish</div>
                </div>
                <div className="market-indicator">
                  <div className="indicator-label">Signal Quality</div>
                  <div className="indicator-value high">High</div>
                </div>
                <div className="market-indicator">
                  <div className="indicator-label">Active Monitors</div>
                  <div className="indicator-value">{settings.enabled ? '3' : '0'}</div>
                </div>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'signals' && (
          <div className="signals-container">
            {signalsError ? (
              <div className="error-fallback">
                <div className="error-icon">⚠️</div>
                <h3>Something went wrong</h3>
                <p>{signalsError}</p>
                <button 
                  className="retry-btn" 
                  onClick={() => {
                    setSignalsError(null);
                    loadRecentSignals();
                  }}
                >
                  Try Again
                </button>
              </div>
            ) : (
              <>
                {}
                <div className="signals-header">
                  <div className="signals-title">
                    <h3>Trading Signals</h3>
                    <span className="signals-count">
                      {filteredSignals ? filteredSignals.length : 0} of {recentSignals ? recentSignals.length : 0} signals
                    </span>
                  </div>
                  <button className="refresh-signals-btn" onClick={loadRecentSignals}>
                    🔄 Refresh
                  </button>
                </div>
                {}
                <div className="signal-filters">
                  <button 
                    className={`filter-tab ${activeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('all')}
                  >
                    All ({recentSignals.length})
                  </button>
                  <button 
                    className={`filter-tab ${activeFilter === 'buy' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('buy')}
                  >
                    Buy ({recentSignals.filter(s => s.action?.toLowerCase() === 'buy').length})
                  </button>
                  <button 
                    className={`filter-tab ${activeFilter === 'sell' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('sell')}
                  >
                    Sell ({recentSignals.filter(s => s.action?.toLowerCase() === 'sell').length})
                  </button>
                  <button 
                    className={`filter-tab ${activeFilter === 'hold' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('hold')}
                  >
                    Hold ({recentSignals.filter(s => s.action?.toLowerCase() === 'hold').length})
                  </button>
                  <button 
                    className={`filter-tab ${activeFilter === 'avoid' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('avoid')}
                  >
                    Avoid ({recentSignals.filter(s => s.action?.toLowerCase() === 'avoid').length})
                  </button>
                  <button 
                    className={`filter-tab ${activeFilter === 'high-confidence' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('high-confidence')}
                  >
                    High Confidence ({recentSignals.filter(s => (s.confidence || 0) >= 80).length})
                  </button>
                </div>
                {}
                <div className="search-container">
                  <span className="search-icon">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search signals by token..." 
                    className="search-input"
                    value={searchTerm}
                    onChange={handleSearchChange}
                  />
                  {searchTerm && (
                    <button 
                      className="clear-search-btn" 
                      onClick={() => setSearchTerm('')}
                      title="Clear search"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {}
                <div className="signals-list">
                  {!recentSignals || recentSignals.length === 0 ? (
                    <div className="empty-signals">
                      <div className="empty-icon">📊</div>
                      <h4>No signals yet</h4>
                      <p>Start monitoring Twitter to see trading signals here</p>
                      <button className="start-monitoring-btn" onClick={() => setActiveTab('settings')}>
                        Enable Monitoring
                      </button>
                    </div>
                  ) : filteredSignals.length === 0 ? (
                    <div className="empty-signals">
                      <div className="empty-icon">🔍</div>
                      <h4>No signals found</h4>
                      <p>
                        {searchTerm ? `No signals match "${searchTerm}"` : `No ${activeFilter} signals available`}
                      </p>
                      <button 
                        className="start-monitoring-btn" 
                        onClick={() => {
                          setSearchTerm('');
                          setActiveFilter('all');
                        }}
                      >
                        Clear Filters
                      </button>
                  </div>
                ) : (
                    filteredSignals.map((signal, index) => {
                      try {
                        return (
                          <div 
                            key={index} 
                            className="enhanced-signal-card"
                            onClick={() => openDetailedAnalysis(signal)}
                          >
                            <div className="signal-card-header">
                              <div className="signal-token-info">
                                <div className="token-avatar">
                                  {signal.token ? String(signal.token).slice(0, 2).toUpperCase() : 'NA'}
                                </div>
                                <div className="token-details">
                                  <div className="token-symbol">{signal.token || 'Unknown'}</div>
                                  <div className="signal-time">{signal.timestamp ? formatTimestamp(signal.timestamp) : 'Unknown time'}</div>
                                </div>
                              </div>
                              <div 
                                className="signal-action-badge"
                                style={{ backgroundColor: getActionColor(signal.action || 'unknown') }}
                              >
                                {signal.action ? String(signal.action).toUpperCase() : 'UNKNOWN'}
                              </div>
                            </div>
                            <div className="signal-card-body">
                              <div className="confidence-section">
                                <div className="confidence-label">Confidence Score</div>
                                <div className="confidence-bar">
                                  <div 
                                    className="confidence-fill" 
                                    style={{ 
                                      width: `${signal.confidence || 0}%`,
                                      backgroundColor: (signal.confidence || 0) >= 80 ? '#10b981' : 
                                                     (signal.confidence || 0) >= 60 ? '#f59e0b' : '#ef4444'
                                    }}
                                  ></div>
                                </div>
                                <div className="confidence-value">{signal.confidence || 0}%</div>
                              </div>
                              {signal.explanation && (
                                <div className="signal-explanation">
                                  <div className="explanation-label">Analysis</div>
                                  <div className="explanation-text">
                                    {String(signal.explanation).slice(0, 80)}...
                                  </div>
                                </div>
                              )}
                            </div>
                            <div className="signal-card-footer">
                              <div className="signal-tags">
                                {signal.content?.tokens && Array.isArray(signal.content.tokens) && 
                                 signal.content.tokens.slice(0, 2).map((token, idx) => (
                                  <span key={idx} className="signal-tag">{String(token)}</span>
                                ))}
                              </div>
                              <div className="view-details">
                                View Details →
                              </div>
                            </div>
                          </div>
                        );
                      } catch (error) {
                        console.error('Error rendering signal:', error);
                        return (
                          <div key={index} className="signal-error">
                            <span>Error rendering signal</span>
                          </div>
                        );
                      }
                    })
                  )}
                </div>
                {}
                {filteredSignals && filteredSignals.length > 0 && (
                  <div className="load-more-section">
                    <button className="load-more-btn" onClick={loadRecentSignals}>
                      Load More Signals
                    </button>
                    <p className="load-more-info">
                      Showing {filteredSignals.length} of {recentSignals.length} signals
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        )}
        {activeTab === 'settings' && (
          <div className="settings-container">
            <div className="setting-item">
              <label className="setting-label">
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={toggleExtension}
                />
                Enable Extension
              </label>
            </div>
            <button 
              className="clear-data-btn"
              onClick={clearData}
            >
              Clear All Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<Popup />);
}
export default Popup;