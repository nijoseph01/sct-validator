# SCT XML Validator (React)

A premium, client-side React application for validating SEPA Instant Credit Transfer (SCT Inst) XML messages. This tool features a sleek dark-mode glassmorphism interface and specifically validates `pacs.008` (Instructions) and `pacs.002` (Status Reports) against the SEPA SCT Inst dataset elements.

## 🚀 Features

- **Premium UI**: Designed with modern glassmorphism aesthetics, utilizing deep radial space themes, transparent panels, and `lucide-react` icons.
- **Dual Input**: Drag & Drop XML files into the interactive zone or paste XML content directly.
- **Format Detection**: Automatically detects:
  - `pacs.008` (SCT Inst Instruction)
  - `pacs.002` (Payment Status Report)
- **Extended E-Commerce & P2P Parsing**:
  - Tracks specific Category Purposes (e.g., `GP2P`).
  - Identifies **Ultimate Debtor** (`UltmtDbtr`) and **Ultimate Creditor** (`UltmtCdtr`) for aggregated payments.
  - Exposes the original End-to-End IDs and Message IDs for clear `pacs.002` status tracking loops.
- **Robust Parsing**:
  - Uses `fast-xml-parser` for highly robust namespace-agnostic extraction.
  - Implements multi-path fallback logic (checking Header vs. Transaction level configurations).
- **Security**: 100% Client-Side. No servers. No telemetry. Your financial XMLs remain locally in your browser memory.

## 📋 Comprehensive Validated Fields

The application looks for the following SEPA Inst elements and maps them accordingly:

| Code   | Field                     | Description & Use Cases |
| :---   | :---                      | :--- |
| **T056** | Message Timestamp         | Creation Date Time (Critical for 10s timeouts) |
| **T014** | Originator Reference ID   | End-to-End Identification (`EndToEndId`) |
| **T054** | Transaction ID            | Unique Transaction Identification (`TxId`) |
| **T002** | Amount                    | Interbank Settlement Amount in Euro |
| **T008** | Category Purpose          | Essential for tracking P2P (`GP2P`) and specific models |
| **INIT** | Initiating Party Name/ID  | Identification of the payment initiator |
| **ULT1** | Ultimate Debtor           | The root sender in P2Pro models |
| **ULT3** | Ultimate Creditor         | The ultimate receiving merchant or party |
| **ACCP** | Status (pacs.002)         | Target Transaction Status (`ACCP`, `RJCT`, etc.) |
| **RSN1** | Status Reason (pacs.002)  | Fine-grained failure analysis (`AB03`, `AC01`, etc.) |

## 🛠️ Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/nijoseph01/sct-validator.git
   cd sct-validator
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Run locally:**
   ```bash
   npm start
   ```
   Open `http://localhost:3000` to view the beautiful analyzer in your browser.

## 📦 Deployment (GitHub Pages)

This project is configured for easy deployment to GitHub Pages.

1. Configure `package.json` with your homepage URL:
   `"homepage": "https://<your-username>.github.io/sct-validator"`
2. Run the deployment script:
   ```bash
   npm run deploy
   ```
   *This automatically builds for production and pushes to your `gh-pages` branch.*

## 🔒 Security Note

This is a **Client-Side Single Page Application (SPA)**.
* No backend server exists.
* No cookies or local storage tracking.
* All XML parsing executes purely in Javascript memory.
* Refreshing the page instantaneously clears all data.

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.