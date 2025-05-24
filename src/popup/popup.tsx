import * as React from 'react';
import { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { SolanaAgentKit, KeypairWallet } from 'solana-agent-kit';
import { TokenSwap } from '../components/TokenSwap';
import './popup.css';
import { Keypair } from '@solana/web3.js';

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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'settings' | 'signals' | 'swap'>('dashboard');
  const [settings, setSettings] = useState<Settings>({
    enabled: true
  });
  const [recentSignals, setRecentSignals] = useState<RecentSignal[]>([]);
  const [stats, setStats] = useState({
    totalSignals: 0,
    buySignals: 0,
    avoidSignals: 0,
    accuracy: 0
  });
  const [agent, setAgent] = useState<SolanaAgentKit | null>(null);
  const [signalsError, setSignalsError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
    loadRecentSignals();
    loadStats();
    initializeSolanaAgent();
  }, []);

  const initializeSolanaAgent = async () => {
    try {
      const keypair = Keypair.generate();
      const wallet = new KeypairWallet(keypair, 'https://api.mainnet-beta.solana.com');

      const agent = new SolanaAgentKit(
        wallet,
        'https://api.mainnet-beta.solana.com',
        {
          OPENAI_API_KEY: process.env.OPENAI_API_KEY || ''
        }
      );

      // For now, use the agent without the DeFi plugin
      // We'll implement direct OKX API integration
      setAgent(agent);
    } catch (error) {
      console.error('Error initializing Solana agent:', error);
    }
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
      
      // Send settings to background script
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
      // Request signals from background script
      chrome.runtime.sendMessage({ type: 'GET_RECENT_SIGNALS' }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Chrome runtime error:', chrome.runtime.lastError);
          setSignalsError('Failed to communicate with background script');
          return;
        }
        
        if (response && response.success) {
          setRecentSignals(response.signals.slice(0, 10)); // Last 10 signals
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
      // Request stats from background script
      chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
        if (response && response.success) {
          setStats(response.stats);
          console.log('Loaded stats:', response.stats);
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
            setStats({ totalSignals: 0, buySignals: 0, avoidSignals: 0, accuracy: 0 });
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
      case 'avoid': return '#6b7280';
      case 'invert': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const openDetailedAnalysis = (signal: RecentSignal) => {
    try {
      // Prepare signal data for the details page
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

      // Encode the signal data for URL
      const encodedData = encodeURIComponent(JSON.stringify(signalData));
      
      // Open the details page in a new tab
      const detailsUrl = chrome.runtime.getURL(`popup/details.html?signal=${encodedData}`);
      chrome.tabs.create({ url: detailsUrl });
      
    } catch (error) {
      console.error('Error opening detailed analysis:', error);
      alert('Failed to open detailed analysis');
    }
  };

  return (
    <div className="popup-container">
      <div className="popup-header">
        <div className="logo">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">QuickAlpha</span>
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
          className={`tab-btn ${activeTab === 'swap' ? 'active' : ''}`}
          onClick={() => setActiveTab('swap')}
        >
          💱 Swap
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

            {/* Performance Section */}
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

            {/* Recent Activity */}
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

            {/* Quick Actions */}
            <div className="quick-actions-section">
              <h3 className="section-title">Quick Actions</h3>
              <div className="quick-actions-grid">
                <button className="quick-action-btn" onClick={() => setActiveTab('signals')}>
                  <div className="action-icon">🔔</div>
                  <span>View Signals</span>
                </button>
                <button className="quick-action-btn" onClick={() => setActiveTab('swap')}>
                  <div className="action-icon">💱</div>
                  <span>Token Swap</span>
                </button>
                <button className="quick-action-btn" onClick={loadRecentSignals}>
                  <div className="action-icon">🔄</div>
                  <span>Refresh Data</span>
                </button>
                <button className="quick-action-btn" onClick={() => setActiveTab('settings')}>
                  <div className="action-icon">⚙️</div>
                  <span>Settings</span>
                </button>
              </div>
            </div>

            {/* Market Status */}
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
                {/* Signals Header with Actions */}
                <div className="signals-header">
                  <div className="signals-title">
                    <h3>Trading Signals</h3>
                    <span className="signals-count">{recentSignals ? recentSignals.length : 0} signals</span>
                  </div>
                  <button className="refresh-signals-btn" onClick={loadRecentSignals}>
                    🔄 Refresh
                  </button>
                </div>

                {/* Filter Tabs */}
                <div className="signal-filters">
                  <button className="filter-tab active">All</button>
                  <button className="filter-tab">Buy</button>
                  <button className="filter-tab">Avoid</button>
                  <button className="filter-tab">High Confidence</button>
                </div>

                {/* Search Bar */}
                <div className="search-container">
                  <span className="search-icon">🔍</span>
                  <input 
                    type="text" 
                    placeholder="Search signals by token..." 
                    className="search-input"
                  />
                </div>

                {/* Signals List */}
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
                  ) : (
                    recentSignals.map((signal, index) => {
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

                {/* Load More Button */}
                {recentSignals && recentSignals.length > 0 && (
                  <div className="load-more-section">
                    <button className="load-more-btn">
                      Load More Signals
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'swap' && agent && (
          <div className="swap-container">
            <TokenSwap agent={agent} />
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