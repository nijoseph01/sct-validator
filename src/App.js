import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { XMLParser } from 'fast-xml-parser';
import { Upload, AlertCircle, CheckCircle, XCircle, Hash, Clock, ArrowRight, FileUp, Code } from 'lucide-react';
import './App.css';

// --- CONFIGURATION: MULTI-PATH MAPPINGS ---
// We now provide arrays of paths. The code checks Path 1. If missing, checks Path 2.
const FIELD_MAPPINGS = {
  'pacs.008': [
    // Header Info
    { code: 'T056', label: 'Message Creation Timestamp', paths: ['GrpHdr.CreDtTm'] },
    { code: 'T014', label: 'Originator Reference ID (EndToEndId)', paths: ['CdtTrfTxInf.PmtId.EndToEndId'] },
    { code: 'MSG1', label: 'Message ID', paths: ['GrpHdr.MsgId'] },

    // Transaction Core Info
    { code: 'T054', label: 'Transaction ID', paths: ['CdtTrfTxInf.PmtId.TxId'] },
    {
      code: 'T002', label: 'Amount of the SCT Inst in euro', paths: [
        'CdtTrfTxInf.IntrBkSttlmAmt',
        'GrpHdr.SttlmInf.IntrBkSttlmAmt',
        'GrpHdr.IntrBkSttlmAmt'
      ]
    },
    {
      code: 'T005', label: 'Requested Execution Date', paths: [
        'CdtTrfTxInf.ReqdExctnDt',
        'CdtTrfTxInf.IntrBkSttlmDt'
      ]
    },

    // Purpose & Category (Crucial for E-com / P2P)
    {
      code: 'T007', label: 'Purpose of SCT Inst', paths: [
        'CdtTrfTxInf.Purp.Cd',
        'GrpHdr.PmtTpInf.SvcLvl.Cd'
      ]
    },
    {
      code: 'T008', label: 'Category purpose (e.g. GP2P)', paths: [
        'GrpHdr.PmtTpInf.CtgyPurp.Prtry',
        'GrpHdr.PmtTpInf.CtgyPurp.Cd'
      ]
    },

    // Parties
    { code: 'INIT', label: 'Initiating Party Name', paths: ['GrpHdr.InitgPty.Nm'] },
    { code: 'INI1', label: 'Initiating Party ID', paths: ['GrpHdr.InitgPty.Id.OrgId.Othr.Id', 'GrpHdr.InitgPty.Id.PrvtId.Othr.Id'] },

    { code: 'P001', label: 'Name of the Originator (Debtor)', paths: ['CdtTrfTxInf.Dbtr.Nm'] },
    { code: 'D001', label: 'Debtor IBAN', paths: ['CdtTrfTxInf.DbtrAcct.Id.IBAN'] },

    { code: 'ULT1', label: 'Ultimate Debtor Name (e.g. P2Pro sender)', paths: ['CdtTrfTxInf.UltmtDbtr.Nm'] },
    { code: 'ULT2', label: 'Ultimate Debtor ID', paths: ['CdtTrfTxInf.UltmtDbtr.Id.PrvtId.Othr.Id', 'CdtTrfTxInf.UltmtDbtr.Id.OrgId.Othr.Id'] },

    { code: 'E001', label: 'Name of the Beneficiary (Creditor)', paths: ['CdtTrfTxInf.Cdtr.Nm'] },
    { code: 'C001', label: 'Creditor IBAN', paths: ['CdtTrfTxInf.CdtrAcct.Id.IBAN'] },

    { code: 'ULT3', label: 'Ultimate Creditor Name (e.g. Merchant)', paths: ['CdtTrfTxInf.UltmtCdtr.Nm'] },
    { code: 'ULT4', label: 'Ultimate Creditor ID', paths: ['CdtTrfTxInf.UltmtCdtr.Id.OrgId.Othr.Id', 'CdtTrfTxInf.UltmtCdtr.Id.PrvtId.Othr.Id'] },

    // Remittance & Charges
    { code: 'CHRG', label: 'Charge Bearer', paths: ['CdtTrfTxInf.ChrgBr'] },
    {
      code: 'T009', label: 'Remittance Information', paths: [
        'CdtTrfTxInf.RmtInf.Ustrd',
        'CdtTrfTxInf.RmtInf.Strd.CdtrRefInf.Ref'
      ]
    }
  ],

  'pacs.002': [
    { code: 'MSG1', label: 'Message Creation Timestamp', paths: ['GrpHdr.CreDtTm'] },
    { code: 'REF1', label: 'Original Message ID', paths: ['OrgnlGrpInfAndSts.OrgnlMsgId'] },
    { code: 'REF2', label: 'Original End To End ID', paths: ['TxInfAndSts.OrgnlEndToEndId'] },
    { code: 'REF3', label: 'Original Instruction ID', paths: ['TxInfAndSts.OrgnlInstrId'] },
    { code: 'REF4', label: 'Original UETR Tracking ID', paths: ['TxInfAndSts.OrgnlUETR'] },

    {
      code: 'ACCP', label: 'Transaction Status (Target/Tx Level)', paths: [
        'TxInfAndSts.TxSts',
        'OrgnlGrpInfAndSts.GrpSts'
      ]
    },
    { code: 'RSN1', label: 'Status Reason Code (e.g. RJCT, AB03)', paths: ['TxInfAndSts.StsRsnInf.Rsn.Cd'] },
    { code: 'RSN2', label: 'Status Reason Additional Info', paths: ['TxInfAndSts.StsRsnInf.AddtlInf'] }
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
        <h1>SCT XML Validator</h1>
        <p>Premium dark mode analyzer with glassmorphism</p>
      </div>

      <div className="input-methods">
        <div className="glass-panel">
          <div {...getRootProps({ className: 'dropzone' })}>
            <input {...getInputProps()} />
            <FileUp size={48} color="var(--secondary-color)" strokeWidth={1.5} />
            <p>Drag & Drop XML File Here</p>
          </div>
        </div>
        <div className="glass-panel">
          <textarea value={xmlContent} onChange={(e) => setXmlContent(e.target.value)} placeholder="Paste XML content here..." />
          <button className="btn" onClick={() => processXML(xmlContent)}>
            <Code size={18} style={{ marginRight: '8px', verticalAlign: 'middle', position: 'relative', top: '-1px' }} />
            Validate XML
          </button>
        </div>
      </div>

      {error && <div className="glass-panel error-card"><AlertCircle size={24} /> {error}</div>}

      {parsedResult && !error && (
        <div className="results-area glass-panel">
          <div className="results-header">
            <h2>Analysis Result</h2>
            <div className={`badge ${parsedResult.isValid ? 'badge-success' : 'badge-error'}`}>
              {parsedResult.isValid ? <CheckCircle size={16} style={{ marginRight: 5 }} /> : <XCircle size={16} style={{ marginRight: 5 }} />}
              {parsedResult.type}
            </div>
          </div>
          <p style={{ color: 'var(--text-muted)', marginTop: '5px', marginBottom: '15px' }}>{parsedResult.message}</p>

          {parsedResult.data.length > 0 && (
            <table className="sct-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Code</th>
                  <th>Field Name</th>
                  <th>Extracted Value</th>
                </tr>
              </thead>
              <tbody>
                {parsedResult.data.map((r, i) => (
                  <tr key={i}>
                    <td><span className="badge badge-info">{r.code}</span></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        {r.code === 'T056' && <Clock size={14} style={{ marginRight: 5, color: '#666' }} />}
                        {r.code === 'T054' && <Hash size={14} style={{ marginRight: 5, color: '#666' }} />}
                        <span style={{ fontWeight: 600 }}>{r.label}</span>
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