import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { XMLParser } from 'fast-xml-parser';
import { Upload, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import './App.css';

function App() {
  const [xmlContent, setXmlContent] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [error, setError] = useState(null);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "", 
    removeNsp: true 
  });

  // Helper: Find object by checking a list of possible key names
  const findRootByCandidates = (obj, candidates) => {
    if (!obj || typeof obj !== 'object') return null;

    // 1. Check current level for any of the candidate tags
    for (const key of Object.keys(obj)) {
        if (candidates.includes(key)) return obj[key];
    }

    // 2. Recursive search deeper
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const found = findRootByCandidates(obj[key], candidates);
        if (found) return found;
      }
    }
    return null;
  };

  const processXML = (xmlString) => {
    try {
      setError(null);
      setParsedResult(null);
      const jsonObj = parser.parse(xmlString);

      let type = 'Unknown';
      let isValid = false;
      let extractedData = [];
      let validationMessage = '';

      // --- CONFIGURATION: DEFINING POSSIBLE TAG NAMES ---
      
      // 1. PACS 008 CANDIDATES (SCT Inst)
      // We check: Standard v8, Standard v2, and your specific tag (F1...)
      const pacs008Roots = [
          'FIToFICustomerCreditTransfer', // ISO 20022 v8 (Standard)
          'FIToFICstmrCdtTrf',            // ISO 20022 v2 (Older SEPA)
          'F1ToFICstmerCdtTrf'            // YOUR SPECIFIC TAG
      ];

      // 2. PACS 002 CANDIDATES (Status Report)
      const pacs002Roots = [
          'FIToFIPaymentStatusReport',    // ISO 20022 v10 (Standard)
          'FIToFIPmtStsRpt'               // ISO 20022 v3 (Older SEPA)
      ];

      // --- SEARCH ---
      const sctInstRoot = findRootByCandidates(jsonObj, pacs008Roots);
      const statusRoot = findRootByCandidates(jsonObj, pacs002Roots);

      if (sctInstRoot) {
        type = 'pacs.008 (SCT Inst)';
        
        // Search for Header (GrpHdr) inside the found root
        const header = sctInstRoot.GrpHdr || sctInstRoot.GroupHeader;

        if (header) {
            isValid = true;
            validationMessage = "Valid Structure Found.";
            
            // Handle Transaction Info (It might be CdtTrfTxInf OR CreditTransferTransactionInformation)
            const txInfo = sctInstRoot.CdtTrfTxInf || sctInstRoot.CreditTransferTransactionInformation;
            const firstTx = Array.isArray(txInfo) ? txInfo[0] : txInfo;

            extractedData = [
                { label: 'Root Tag Used', value: 'Found in file' }, // Just to confirm it worked
                { label: 'Message ID', value: header.MsgId || header.MessageIdentification },
                { label: 'Creation Date', value: header.CreDtTm || header.CreationDateTime },
                { label: 'Nb of Txs', value: header.NbOfTxs || header.NumberOfTransactions },
                { label: 'End-to-End ID', value: firstTx?.PmtId?.EndToEndId || firstTx?.PaymentIdentification?.EndToEndIdentification || 'N/A' },
                { label: 'Amount', value: firstTx?.IntrBkSttlmAmt || firstTx?.InterbankSettlementAmount || 'N/A' }
            ];
        } else {
            validationMessage = "Found the root tag, but 'GrpHdr' is missing inside it.";
        }
      } 
      
      else if (statusRoot) {
        type = 'pacs.002 (Status Report)';
        const header = statusRoot.GrpHdr || statusRoot.GroupHeader;

        if (header) {
            isValid = true;
            validationMessage = "Valid Structure Found.";
            extractedData = [
                { label: 'Message ID', value: header.MsgId },
                { label: 'Original ID', value: statusRoot.OrgnlGrpInfAndSts?.OrgnlMsgId || 'N/A' }
            ];
        } else {
             validationMessage = "Found status root, but 'GrpHdr' is missing.";
        }
      } 
      else {
          validationMessage = `Could not find any known SCT Inst tags. Checked for: ${pacs008Roots.join(', ')}`;
      }

      setParsedResult({ type, isValid, message: validationMessage, data: extractedData });

    } catch (err) {
      setError("XML Syntax Error: " + err.message);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => {
        setXmlContent(reader.result);
        processXML(reader.result);
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return (
    <div className="container">
      <div className="header"><h1>SCT Inst Validator</h1></div>

      <div className="input-methods">
        <div className="card">
            <div {...getRootProps({ className: 'dropzone' })}>
                <input {...getInputProps()} />
                <p>Drag & drop XML file</p>
            </div>
        </div>
        <div className="card">
            <textarea value={xmlContent} onChange={(e) => setXmlContent(e.target.value)} placeholder="Paste XML..." />
            <button className="btn" onClick={() => processXML(xmlContent)}>Validate</button>
        </div>
      </div>

      {error && <div className="card" style={{color: 'red'}}><AlertCircle size={20}/> {error}</div>}

      {parsedResult && !error && (
        <div className="results-area card">
            <div style={{display: 'flex', justifyContent: 'space-between'}}>
                <h2>Result</h2>
                <span className={`badge ${parsedResult.isValid ? 'badge-success' : 'badge-error'}`}>
                    {parsedResult.isValid ? 'VALID' : 'INVALID'}
                </span>
            </div>
            <p><strong>Status:</strong> {parsedResult.message}</p>
            
            {parsedResult.data.length > 0 && (
                <table>
                    <thead><tr><th>Field</th><th>Value</th></tr></thead>
                    <tbody>
                        {parsedResult.data.map((r, i) => (
                            <tr key={i}><td>{r.label}</td><td>{r.value}</td></tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
      )}
    </div>
  );
}

export default App;