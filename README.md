# Observo - AI-Powered Crypto Trading Signal Extension

## 🌟 Overview


**Observo** is a browser extension that scans websites like **Twitter/X** for crypto content (token mentions, wallet addresses, hype signals) and uses **AI + OKX API** to generate instant BUY, SELL, or AVOID signals — directly on the page.

Think of it like your AI trading assistant, embedded in your browser


## 🚀 Key Features

- 🤖 **AI Signal Engine** – Uses OpenAI to understand social media hype, wallet behavior, and trading sentiment
- 📉 **Real-Time Token Detection** – Detects tokens like `$SOL`, `$WEN`, wallet addresses, and keywords like “moon”, “pump”
- 📊 **OKX Data Integration** – Pulls real-time market data and price quotes using the OKX DEX API
- ⚡ **1-Click Insights** – Get a signal box right next to tweets or content with actionable recommendations
- 📈 **Signal Confidence** – AI gives each signal a score from 1–10 to show how strong the recommendation is
- 🧠 **Smart Dashboard** – View your signal history, stats, accuracy, and token highlights
- 🔐 **Secure Wallet Connection** – Supports OKX Wallet for deeper integration (wallet trading optional)

---

## 🔍 What Problems Does Observo Solve?

| Problem | Solution |
|--------|----------|
| 🔄 Too many tabs to check before trading | ✅ Observo gives signals right where you browse (e.g., Twitter) |
| ❓ Don’t know if a token is real or hype | ✅ AI reviews the content, sentiment, and wallet pattern |
| ⚠️ Risk of rugs and scams | ✅ Warns you with AVOID signals based on known patterns |
| 🤯 Signal overload from influencers | ✅ Observo filters hype and gives clear, confidence-based advice |

---

## 🧑‍💻 How to Use Observo

### ✅ Requirements

- Chrome browser
- Node.js 18+
- OpenAI API Key (for GPT-4)
- OKX API Keys (for quotes)

---

### Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/yourusername/observo.git
   cd observo
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure API Keys**
   
   Create environment variables or update the configuration in `src/background/background.ts`:
   ```typescript
   const config = {
     OPENAI_API_KEY: 'your-openai-api-key',
     OKX_API_KEY: 'your-okx-api-key',
     OKX_SECRET_KEY: 'your-okx-secret-key',
     OKX_PASSPHRASE: 'your-okx-passphrase'
   }
   ```

4. **Build the Extension**
   ```bash
   npm run build
   ```

5. **Load in Chrome**
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (top right toggle)
   - Click "Load unpacked" and select the `dist` folder
   - The Observo extension should now appear in your extensions list

### Development Mode

For development with hot reloading:
```bash
npm run dev
```

## 🎯 How It Works

### 1. Content Detection
Observo automatically scans social media content for:
- **Token mentions** (BTC, ETH, SOL, etc.)
- **Hype language** ("moon", "pump", "gem", etc.)
- **Wallet addresses** (Solana, Ethereum)
- **Trading sentiment** indicators

### 2. AI Analysis
The extension uses OpenAI's GPT-4 to:
- Analyze content sentiment
- Detect pump/dump schemes
- Evaluate project legitimacy
- Generate confidence-scored signals

### 3. Signal Generation
Based on analysis, Observo generates:
- **BUY**: Strong positive momentum or value opportunities
- **SELL**: Technical breakdown or profit-taking signals
- **AVOID**: Scam indicators or high-risk situations

### 4. Market Integration
Real-time data integration with:
- **OKX API**: Live prices, trading volume, market data
- **Jupiter Aggregator**: Solana DEX trading execution
- **Multiple DEXs**: Best price routing across decentralized exchanges

## 📁 Project Structure

```
src/
├── background/       # Handles AI + OKX logic
├── content/          # Scripts that scan websites
├── popup/            # UI components
├── services/         # OKX & AI APIs
├── types/            # Shared TS types
├── utils/            # Helper functions
public/               # Logo, manifest

```


## 🧪 Example Use

Scenario: You’re browsing Twitter and see a tweet like “$ZORK is the next 100x gem!”

Observo shows a signal card:

“Confidence: 3/10 – Low LP, past rug behavior detected. AVOID.”

You can click "More Info" to see why

Want to act? Get OKX DEX swap info or open token page



## 🛡️ Security & Safety

### Trading Safety
- **Educational Purpose**: Observo is for educational and informational purposes
- **DYOR**: Always conduct your own research before trading
- **Risk Warning**: Cryptocurrency trading involves significant risk
- **Test Mode**: Try with small amounts first

### Data Privacy
- **Local Storage**: All data stored locally in your browser
- **No Personal Data**: Extension doesn't collect personal information
- **API Security**: All API keys are stored securely
- **Open Source**: Full code transparency


## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the Repository**
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Commit Changes**: `git commit -m 'Add amazing feature'`
4. **Push to Branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**


## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
- **Issues**: Report bugs on [GitHub Issues](https://github.com/yourusername/observo/issues)
- **Discussions**: Join discussions on [GitHub Discussions](https://github.com/yourusername/observo/discussions)
- **Documentation**: Check our [Wiki](https://github.com/yourusername/observo/wiki)

## 🔮 Roadmap

### Phase 1 (Current)
- ✅ AI-powered signal generation
- ✅ Real-time market data integration
- ✅ Social media content analysis
- ✅ Basic trading execution

### Phase 2 (Next)
- 🔄 Multi-chain support (Ethereum, BSC)
- 🔄 Advanced charting and technical analysis
- 🔄 Portfolio management dashboard
- 🔄 Advanced risk management tools

### Phase 3 (Future)
- 📊 Machine learning model improvements
- 🤖 Automated trading strategies
- 📱 Mobile application
- 🌐 Cross-platform synchronization

---
