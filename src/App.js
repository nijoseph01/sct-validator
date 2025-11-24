import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { XMLParser } from 'fast-xml-parser';
import { Upload, AlertCircle, CheckCircle, XCircle, Hash, Clock, ArrowRight } from 'lucide-react';
import './App.css';

// --- CONFIGURATION: MULTI-PATH MAPPINGS ---
// We now provide arrays of paths. The code checks Path 1. If missing, checks Path 2.
const FIELD_MAPPINGS = {
  'pacs.008': [
    // Header Info
    { code: 'T014', label: 'Originator Reference ID',          paths: ['CdtTrfTxInf.PmtId.EndToEndId'] },
    { code: 'T056', label: 'Timestamp',           paths: ['GrpHdr.CreDtTm'] },

    // Transaction Info
    { code: 'T054', label: 'Transaction ID',      paths: ['CdtTrfTxInf.PmtId.TxId'] },
    { code: 'E001', label: 'Name of the Beneficiary',  paths: ['CdtTrfTxInf.Cdtr.Nm'] },
    { code: 'C001', label: 'IBAN of the account of the Beneficiary',              paths: ['CdtTrfTxInf.CdtrAcct.Id.IBAN'] },
    
    // T002: 'Amount of the SCT Inst in euro
    { code: 'T002', label: 'Amount of the SCT Inst in euro',     paths: [
        'CdtTrfTxInf.IntrBkSttlmAmt',       // Standard Location
        'GrpHdr.SttlmInf.IntrBkSttlmAmt',   // Alternative Location
        'GrpHdr.IntrBkSttlmAmt'             // Rare Variation
    ]},

    // T007: Purpose of SCT Inst
    { code: 'T007', label: 'Purpose of SCT Inst',       paths: [
        'CdtTrfTxInf.Purp.Cd',  // Tx Level
        'GrpHdr.PmtTpInf.SvcLvl.Cd'        // Header Level (Common for Batches)
    ]},

    // T008: Category purpose
    { code: 'T008', label: 'Category purpose',    paths: [
      'GrpHdr.PmtTpInf.CtgyPurp.Prtry'
    ]},

    // T009: Remittance Information
    { code: 'T009', label: 'Remittance Information',    paths: [
        'CdtTrfTxInf.RmtInf.Ustrd',
        'CdtTrfTxInf.RmtInf.Strd.CdtrRefInf.Ref'
    ]},

    // Other Info
    { code: 'D001', label: 'Debtor IBAN',         paths: ['CdtTrfTxInf.DbtrAcct.Id.IBAN'] },
    { code: 'P001', label: 'Name of the originator',     paths: ['CdtTrfTxInf.Dbtr.Nm'] }
  ],

  // Simplified pacs.002 support
  'pacs.002': [
    { code: 'T014', label: 'Originator Reference ID',          paths: ['OrgnlGrpInfAndSts.OrgnlMsgId'] },
    { code: 'XXXX', label: 'Originator Transaction ID',          paths: ['TxInfAndSts.OrgnlTxId'] },
    { code: 'ACCP', label: 'Settlement Confirmation',         paths: ['OrgnlGrpInfAndSts.GrpSts'] },
    { code: 'T008', label: 'Categrory purpose',         paths: ['TxInfAndSts.OrgnlEndToEndId'] }
  ]
};

function App() {
  const [xmlContent, setXmlContent] = useState('');
  const [parsedResult, setParsedResult] = useState(null);
  const [error, setError] = useState(null);

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_", 
    removeNsp: true 
  });

  // Helper: Find Root (Case Insensitive)
  const findRootByCandidates = (obj, candidates) => {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of Object.keys(obj)) {
        if (candidates.some(c => c.toLowerCase() === key.toLowerCase())) return obj[key];
    }
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const found = findRootByCandidates(obj[key], candidates);
        if (found) return found;
      }
    }
    return null;
  };

  // Helper: Extract Value trying Multiple Paths
  const extractValueWithFallback = (rootObj, paths) => {
    for (const path of paths) {
        const val = extractSinglePath(rootObj, path);
        if (val !== 'MISSING') return val;
    }
    return 'MISSING';
  };

  const extractSinglePath = (rootObj, path) => {
    try {
      const keys = path.split('.');
      let current = rootObj;
      
      for (const key of keys) {
        if (!current) return 'MISSING';
        if (Array.isArray(current)) current = current[0]; // Take first Tx if multiple

        const foundKey = Object.keys(current).find(k => k.toLowerCase() === key.toLowerCase());
        if (foundKey) current = current[foundKey];
        else return 'MISSING';
      }
      
      if (typeof current === 'object' && current['#text']) return current['#text'];
      if (typeof current === 'object') return JSON.stringify(current).replace(/["{}]/g, '').substring(0, 30) + '...';
      return current;
    } catch (e) { return 'MISSING'; }
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

      const pacs008Roots = ['FIToFICustomerCreditTransfer', 'FIToFICstmrCdtTrf', 'F1ToFICstmerCdtTrf'];
      const pacs002Roots = ['FIToFIPaymentStatusReport', 'FIToFIPmtStsRpt'];

      const sctInstRoot = findRootByCandidates(jsonObj, pacs008Roots);
      const statusRoot = findRootByCandidates(jsonObj, pacs002Roots);

      if (sctInstRoot) {
        type = 'pacs.008 (Instruction)';
        isValid = true;
        validationMessage = "SCT Inst Instruction Detected";
        // Use the new Fallback Extractor
        extractedData = FIELD_MAPPINGS['pacs.008'].map(f => ({
           code: f.code,
           label: f.label,
           value: extractValueWithFallback(sctInstRoot, f.paths)
        }));
      } 
      else if (statusRoot) {
        type = 'pacs.002 (Report)';
        isValid = true;
        validationMessage = "Payment Status Report Detected";
        extractedData = FIELD_MAPPINGS['pacs.002'].map(f => ({
           code: f.code,
           label: f.label,
           value: extractValueWithFallback(statusRoot, f.paths)
        }));
      } 
      else {
          validationMessage = "Could not identify a valid pacs.008 or pacs.002 root tag.";
      }

      setParsedResult({ type, isValid, message: validationMessage, data: extractedData });

    } catch (err) {
      setError("XML Syntax Error: " + err.message);
    }
  };

  const onDrop = useCallback((acceptedFiles) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => { setXmlContent(reader.result); processXML(reader.result); };
    reader.readAsText(file);
  }, []);

  const { getRootProps, getInputProps } = useDropzone({ onDrop });

  return (
    <div className="container">
      <div className="header">
        <h1>SCT Inst Validator</h1>
        <p>Robust Parsing</p>
      </div>

      <div className="input-methods">
        <div className="card">
            <div {...getRootProps({ className: 'dropzone' })}>
                <input {...getInputProps()} />
                <p>Drag & drop XML file</p>
            </div>
        </div>
        <div className="card">
            <textarea value={xmlContent} onChange={(e) => setXmlContent(e.target.value)} placeholder="Paste XML content..." />
            <button className="btn" onClick={() => processXML(xmlContent)}>Validate</button>
        </div>
      </div>

      {error && <div className="card" style={{color: '#dc3545', borderColor:'#dc3545'}}><AlertCircle size={20}/> {error}</div>}

      {parsedResult && !error && (
        <div className="results-area card">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems:'center'}}>
                <h2>Result</h2>
                <div className={`badge ${parsedResult.isValid ? 'badge-success' : 'badge-error'}`} style={{fontSize:'1.1em'}}>
                    {parsedResult.isValid ? <CheckCircle size={16} style={{marginRight:5}}/> : <XCircle size={16} style={{marginRight:5}}/>}
                    {parsedResult.type}
                </div>
            </div>
            <p style={{color:'#666', marginTop:'5px'}}>{parsedResult.message}</p>
            
            {parsedResult.data.length > 0 && (
                <table className="sct-table">
                    <thead>
                        <tr>
                            <th style={{width: '80px'}}>Code</th>
                            <th>Field Name</th>
                            <th>Extracted Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {parsedResult.data.map((r, i) => (
                            <tr key={i}>
                                <td><span className="badge badge-info">{r.code}</span></td>
                                <td>
                                    <div style={{display:'flex', alignItems:'center'}}>
                                        {r.code === 'T056' && <Clock size={14} style={{marginRight:5, color:'#666'}}/>}
                                        {r.code === 'T054' && <Hash size={14} style={{marginRight:5, color:'#666'}}/>}
                                        <span style={{fontWeight:600}}>{r.label}</span>
                                    </div>
                                </td>
                                <td>
                                    {r.value === 'MISSING' 
                                        ? <span className="status-missing">MISSING</span> 
                                        : <span className="status-found">{r.value}</span>
                                    }
                                </td>
                            </tr>
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