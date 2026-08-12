# 🚀 AerospaceBot — ISRO & NASA Specialist AI

AerospaceBot is a professional, AI-powered space assistant designed to answer complex queries regarding ISRO, NASA, launch vehicles, satellites, astrophysics, and the global aerospace industry. Powered by the Gemini AI API, the bot provides detailed, formatted, and strictly domain-scoped responses.

## ✨ Features
- **Strict Domain Focus**: Programmed to exclusively discuss aerospace, astronomy, and space tech. It politely declines off-topic questions.
- **Premium UI/UX**: A highly responsive, modern glassmorphism interface with custom typography, glowing accents, and an interactive particle starfield background.
- **Markdown & Formatting**: Automatically formats responses with clean tables, bold highlights, code blocks, and structured lists.
- **Universal Responsiveness**: The UI seamlessly scales from large desktop monitors down to mobile screens with an off-canvas sidebar.
- **Model Fallbacks**: Automatically attempts to use the latest `gemini-2.5-flash` model, falling back to older versions if necessary.
- **Secure API Key Handling**: Add your API key directly via the UI (stored locally in the browser), or provide it securely on the server via `.env`.

## 🛠️ Tech Stack
- **Frontend**: Vanilla HTML5, CSS3, JavaScript (ES6). No heavy frameworks, ensuring blazing fast load times.
- **Backend**: Node.js and Express.js.
- **AI Engine**: Google Generative Language API (@google/generative-ai).

## 🚀 Getting Started

### Prerequisites
- Node.js (v18 or higher)
- A free Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/AerospaceBot.git
   cd AerospaceBot
   ```

2. Install the backend dependencies:
   ```bash
   npm install
   ```

3. Setup your environment variables:
   Copy the example environment file and add your API key:
   ```bash
   cp .env.example .env
   ```
   *Note: Alternatively, you can leave the `.env` blank and just enter your API key directly in the web UI when the app is running.*

4. Start the server:
   ```bash
   npm run dev
   ```

5. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## 🤝 Contributing
Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

## 📝 License
This project is open-source and available under the MIT License.
