import React, { useState } from 'react';
import { verifyCredentialSignature, signCredential } from '@onshift/credential-schema';
import { Credential, CredentialVerificationResult } from '@onshift/shared-types';
import { DEMO_WORKER } from '@onshift/mock-data';
import { ShieldCheck, ShieldAlert, FileCheck, RefreshCw } from 'lucide-react';

const SAMPLE_CREDENTIAL = signCredential(
  DEMO_WORKER.id,
  {
    verifiedIncome: 30100,
    period: '01 Aug to 07 Aug 2026',
    verificationLevel: 'FINANCIALLY_CORROBORATED',
  },
  '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60',
  'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a',
  'OnShift Proof Authority'
);

export default function App() {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(SAMPLE_CREDENTIAL, null, 2));
  const [result, setResult] = useState<CredentialVerificationResult | null>(null);

  const handleVerify = () => {
    try {
      const parsed: Credential = JSON.parse(jsonInput);
      const res = verifyCredentialSignature(parsed);
      setResult(res);
    } catch (e) {
      setResult({
        valid: false,
        issuerVerified: false,
        signatureVerified: false,
        message: 'Invalid JSON format in credential input field.',
      });
    }
  };

  const handleLoadSample = () => {
    setJsonInput(JSON.stringify(SAMPLE_CREDENTIAL, null, 2));
    setResult(null);
  };

  return (
    <div className="container">
      <header className="header">
        <div className="logo">
          <FileCheck size={28} color="#0EA5E9" />
          OnShift <span>Verifier Portal</span>
        </div>
        <div style={{ fontSize: '0.85rem', color: '#94A3B8' }}>
          Ed25519 Cryptographic Proof Verification
        </div>
      </header>

      <main>
        <section className="card">
          <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>Paste Signed Credential</h2>
          <textarea
            className="textarea"
            value={jsonInput}
            onChange={(e) => setJsonInput(e.target.value)}
            placeholder="Paste OnShift signed credential JSON here..."
          />
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="btn" onClick={handleVerify}>
              Verify Credential
            </button>
            <button
              className="btn"
              style={{ background: 'rgba(255,255,255,0.08)', color: '#F1F5F9' }}
              onClick={handleLoadSample}
            >
              <RefreshCw size={16} style={{ display: 'inline', marginRight: '6px' }} />
              Reset Sample Credential
            </button>
          </div>
        </section>

        {result && (
          <section className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ fontSize: '1.2rem' }}>Verification Summary</h2>
              {result.valid ? (
                <span className="status-badge valid">
                  <ShieldCheck size={18} /> Valid Signature & Issuer
                </span>
              ) : (
                <span className="status-badge invalid">
                  <ShieldAlert size={18} /> Verification Failed
                </span>
              )}
            </div>

            <p style={{ color: '#94A3B8', marginBottom: '1.5rem' }}>{result.message}</p>

            {result.claims && (
              <div>
                <h3 style={{ fontSize: '0.95rem', color: '#0EA5E9', marginBottom: '0.75rem' }}>
                  Disclosed Claims Only
                </h3>
                <div className="claims-grid">
                  <div className="claim-box">
                    <div className="claim-label">Verified Weekly Income</div>
                    <div className="claim-value">₹{result.claims.verifiedIncome.toLocaleString('en-IN')}</div>
                  </div>
                  <div className="claim-box">
                    <div className="claim-label">Payout Period</div>
                    <div className="claim-value" style={{ fontSize: '1.05rem' }}>{result.claims.period}</div>
                  </div>
                  <div className="claim-box">
                    <div className="claim-label">Verification Level</div>
                    <div className="claim-value" style={{ fontSize: '1rem', color: '#10B981' }}>
                      {result.claims.verificationLevel}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
