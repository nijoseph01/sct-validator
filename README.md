SCT Inst Validator (React)

A secure, client-side React application for validating SEPA Instant Credit Transfer (SCT Inst) XML messages. This tool specifically validates pacs.008 (Instructions) and pacs.002 (Status Reports) against specific SCT Inst dataset elements.

🚀 Features

Dual Input: Drag & Drop XML files or Paste XML content directly.

Format Detection: Automatically detects:

pacs.008 (SCT Inst Instruction)

pacs.002 (Positive Confirmation - ACCP)

pacs.002 (Negative Confirmation - RJCT)

Specific Field Extraction: Extracts and validates key fields like E001, C001, T007, T056, etc.

Robust Parsing:

Uses native browser DOMParser (no heavy external dependencies).

Handles namespace prefixes automatically (e.g., ns:Document vs Document).

Fallback Logic: Checks multiple XML paths (Header vs Transaction level) to find values like Settlement Date or Payment Type.

Security: All processing happens locally in the browser. No data is sent to any server.

📋 Validated Fields

The application looks for the following SCT Inst Rulebook codes:

Code

Label

Description

T014

Message ID

Unique Message Identification

T056

Timestamp

Creation Date Time (Critical for 10s timeout)

T054

Transaction ID

Unique Transaction Identification

E001

End-to-End ID

End-to-End Identification

C001

Amount

Interbank Settlement Amount

T002

Settlement Date

Interbank Settlement Date

T007

Purpose

Purpose Code (e.g., MP2P, SALA)

T008

Local Instrument

Local Instrument Code (Must be 'INST')

T009

Category Purpose

Category Purpose Code

D001

Debtor IBAN

Originator Account Number

P001

Remittance Info

Unstructured Remittance Information

R001

Status Code

Transaction Status (ACCP/RJCT)

🛠️ Installation & Setup

Clone the repository:

git clone [https://github.com/your-username/sct-validator.git](https://github.com/your-username/sct-validator.git)
cd sct-validator


Install dependencies:

npm install
# Note: Main dependencies are 'react', 'react-dom', 'react-dropzone', 'lucide-react'


Run locally:

npm start


Open http://localhost:3000 to view it in the browser.

📦 Deployment (GitHub Pages)

This project is configured for easy deployment to GitHub Pages.

Install the deployer (if not already installed):

npm install gh-pages --save-dev


Configure package.json:
Add your homepage URL at the top level:

"homepage": "https://<your-username>.github.io/sct-validator",


Deploy:

npm run deploy


This creates a production build and pushes it to the gh-pages branch.

🔒 Security Note

This application is a Client-Side Single Page Application (SPA).

It does not have a backend server.

It does not store cookies or local storage data.

All XML parsing is performed in the user's browser memory using JavaScript.

Refreshing the page clears all data.

🤝 Contributing

Fork the Project

Create your Feature Branch (git checkout -b feature/AmazingFeature)

Commit your Changes (git commit -m 'Add some AmazingFeature')

Push to the Branch (git push origin feature/AmazingFeature)

Open a Pull Request

📄 License

Distributed under the MIT License. See LICENSE for more information.