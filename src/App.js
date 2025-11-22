import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { XMLParser } from 'fast-xml-parser';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import './App.css';

function App() {
  const [xmlContent, setXmlContent] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [error, setError] = useState(null);

  // 1. Parser Configuration
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    removeNsp: true // crucial for ignoring "ns:" prefixes
  });

  // 2. Helper: Recursively find a key in a deep object
  // This fixes the issue where 'Document' might be inside 'Request' or 'AppHdr'
  const findTag = (obj, tagName) => {
    if (!obj || typeof obj !== 'object') return null;
    if (obj[tagName]) return obj[tagName];
    
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const found = findTag(obj[key], tagName);
        if (found) return found;
      }
    }
    return null;
  };

  const processXML = (xmlString) => {
    try {
      setError(null);
      setParsedResult(null);
      
      // Parse XML
      const jsonObj = parser.parse(xmlString);
      console.log("Parsed JSON:", jsonObj); // Check Console F12 if you still have issues

      let type = 'Unknown';
      let isValid = false;
      let extractedData = [];
      let validationMessage = '';

      // --- SMART SEARCH FOR ROOTS ---
      const sctInstRoot = findTag(jsonObj, 'FIToFICustomerCreditTransfer');
      const statusRoot = findTag(jsonObj, 'FIToFIPaymentStatusReport');

      // --- LOGIC FOR pacs.008.001.08 ---
      if (sctInstRoot) {
        type = 'pacs.008 (SCT Inst)';
        
        if (sctInstRoot.GrpHdr) {
            isValid = true;
            validationMessage = "Valid Structure: FIToFICustomerCreditTransfer found.";
            
            const txInfo = sctInstRoot.CdtTrfTxInf;
            const firstTx = Array.isArray(txInfo) ? txInfo[0] : txInfo;

            extractedData = [
                { label: 'Message ID', value: sctInstRoot.GrpHdr.MsgId },
                { label: 'Creation Date', value: sctInstRoot.GrpHdr.CreDtTm },
                { label: 'Nb of Txs', value: sctInstRoot.GrpHdr.NbOfTxs },
                { label: 'Settlement Method', value: sctInstRoot.GrpHdr.SttlmInf?.SttlmMtd || 'N/A' },
                { label: 'End-to-End ID', value: firstTx?.PmtId?.EndToEndId || 'N/A' },
                { label: 'Amount', value: firstTx?.IntrBkSttlmAmt || 'N/A' }
            ];
        } else {
            validationMessage = "Error: Found 'FIToFICustomerCreditTransfer' but 'GrpHdr' is missing.";
        }
      } 
      
      // --- LOGIC FOR pacs.002.001.10 ---
      else if (statusRoot) {
        type = 'pacs.002 (Status Report)';
        
        if (statusRoot.GrpHdr) {
            isValid = true;
            validationMessage = "Valid Structure: FIToFIPaymentStatusReport found.";
            
            const txInfo = statusRoot.TxInfAndSts;
            const firstTx = Array.isArray(txInfo) ? txInfo[0] : txInfo;

            extractedData = [
                { label: 'Message ID', value: statusRoot.GrpHdr.MsgId },
                { label: 'Original Msg ID', value: statusRoot.OriginalGroupInformationAndStatus?.OrgnlMsgId || 'N/A' },
                { label: 'Tx Status', value: firstTx?.TxSts || 'N/A' },
                { label: 'Reason Code', value: firstTx?.StsRsnInf?.Rsn?.Cd || 'N/A' }
            ];
        } else {
             validationMessage = "Error: Found 'FIToFIPaymentStatusReport' but 'GrpHdr' is missing.";
        }
      } 
      
      else {
          // Fallback: If tags not found, check text content to give a hint
          if (xmlString.includes('pacs.008')) validationMessage = "Detected pacs.008 namespace, but could not find <FIToFICustomerCreditTransfer> tag.";
          else if (xmlString.includes('pacs.002')) validationMessage = "Detected pacs.002 namespace, but could not find <FIToFIPaymentStatusReport> tag.";
          else validationMessage = "Unknown XML format. Could not find standard SCT Inst tags.";
      }

      setParsedResult({
        type,
        isValid,
        message: validationMessage,
        data: extractedData
      });

    } catch (err) {
      setError("XML Parsing Error. The file format is invalid.");
      console.error(err);
    }
  };

  // ... (Dropzone and Return logic remains the same)
  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => {
      setXmlContent(reader.result);
      processXML(reader.result);
    };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({ 
    onDrop, 
    accept: {'text/xml': ['.xml'], 'application/xml': ['.xml']} 
  });

  return (
    <div className="container">
      <div className="header">
        <h1>SCT Inst Validator (Robust)</h1>
      </div>

      <div className="input-methods">
        <div className="card">
            <h3><Upload size={20}/> Upload File</h3>
            <div {...getRootProps({ className: 'dropzone' })}>
                <input {...getInputProps()} />
                <p>Drag & drop XML file here</p>
            </div>
        </div>

        <div className="card">
            <h3><FileText size={20}/> Paste XML</h3>
            <textarea 
                value={xmlContent}
                onChange={(e) => setXmlContent(e.target.value)}
                placeholder="Paste content here..."
            />
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
            <p>{parsedResult.message}</p>
            
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
