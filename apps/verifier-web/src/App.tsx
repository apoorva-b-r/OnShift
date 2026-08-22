import React, { useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  Building2,
  FileCheck,
  RefreshCw,
  UploadCloud,
  FileCode,
  CheckCircle2,
  Lock,
  ArrowRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

import type { CredentialVerificationResult } from './credentialTypes';
import { verifyCredentialInBrowser, formatClaimLabel, formatClaimValue } from './verifyCredential';

export default function App() {
  const [jsonInput, setJsonInput] = useState('');
  const [result, setResult] = useState<CredentialVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showTechnicalJson, setShowTechnicalJson] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('No credential loaded');
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);
  const [hasAttemptedVerification, setHasAttemptedVerification] = useState(false);

  const runVerification = async (inputJson: string) => {
    const trimmed = inputJson.trim();
    if (!trimmed) {
      setResult(null);
      setHasAttemptedVerification(false);
      setLastVerifiedAt(null);
      return;
    }

    setLoading(true);
    setHasAttemptedVerification(true);
    try {
      const parsed = JSON.parse(trimmed);
      const verificationResult = await verifyCredentialInBrowser(parsed);
      setResult(verificationResult);
      setLastVerifiedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setResult({
        valid: false,
        signatureVerified: false,
        message: 'Invalid JSON. Upload or paste a worker-exported OnShift credential file.',
      });
      setLastVerifiedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyClick = () => {
    runVerification(jsonInput);
  };

  const ingestCredentialText = (text: string, sourceLabel: string) => {
    let formattedText = text;
    try {
      const parsed = JSON.parse(text);
      formattedText = JSON.stringify(parsed, null, 2);
    } catch {
      // keep original text if unparseable
    }
    setJsonInput(formattedText);
    setUploadedFileName(sourceLabel);
    runVerification(formattedText);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonInput(text);
    if (!uploadedFileName || uploadedFileName === 'No credential loaded') {
      setUploadedFileName('Raw JSON Editor');
    }
    runVerification(text);
  };



  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (text) {
        ingestCredentialText(text, file.name);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        ingestCredentialText(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  const scrollToStudio = () => {
    const el = document.getElementById('verifier-studio');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const claimEntries = result?.claims ? Object.entries(result.claims).filter(([, v]) => v !== undefined) : [];

  return (
    <div className="app-root">
      <header className="navbar">
        <div className="nav-container">
          <div className="brand">
            <img
              src="/logo.png"
              alt="OnShift Logo"
              className="brand-logo-img"
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="brand-text">
              <span className="brand-name">OnShift</span>
              <span className="brand-tag">LENDER & VERIFIER PORTAL</span>
            </div>
          </div>

          <nav className="nav-links">
            <a
              href="#verifier-studio"
              onClick={(e) => {
                e.preventDefault();
                scrollToStudio();
              }}
            >
              Verify Credential
            </a>
            <a href="#trust-architecture">Trust Architecture</a>
            <a href="#schemes-preview">Scheme Signals</a>
          </nav>

          <div className="nav-actions">
            <span className="portal-badge">
              <Building2 size={15} /> Lender Verifier
            </span>
          </div>
        </div>
      </header>

      <section className="hero">
        <div className="hero-container">
          <div className="eyebrow">
            <Sparkles size={16} /> Worker-owned proof for lender review
          </div>
          <h1>Verify Gig Income Credentials Before Lending Decisions</h1>
          <p className="hero-subtitle">
            OnShift lets banks, NBFCs, landlords, and benefit desks validate only the worker-disclosed
            income claims they need, backed by Ed25519 signatures and bank-settlement corroboration.
          </p>

          <div className="hero-buttons">
            <button className="btn-primary" onClick={scrollToStudio}>
              Verify a Credential <ArrowRight size={18} />
            </button>
            <a href="#trust-architecture" className="btn-secondary">
              Review Trust Model
            </a>
          </div>

          <div className="stats-ribbon">
            <div className="stat-item">
              <span className="stat-number">Ed25519</span>
              <span className="stat-label">Signature Verification</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">&lt; 10ms</span>
              <span className="stat-label">Verification Latency</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">Selective</span>
              <span className="stat-label">Claim Disclosure</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">30</span>
              <span className="stat-label">Scheme Eligibility Signals</span>
            </div>
          </div>
        </div>
      </section>

      <section id="verifier-studio" className="studio-section">
        <div className="section-container">
          <div className="section-header text-center">
            <h2>Lender Credential Verification</h2>
            <p>
              Drag & drop or browse the JSON credential shared by the worker. Verification runs locally in your
              browser using Ed25519 — no backend call is required.
            </p>
          </div>

          <div className="verification-console">
            <div className="upload-panel">
              <div
                className={`upload-box ${isDragging ? 'drag-active' : ''}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <label htmlFor="file-input-id" className="upload-inner">
                  <span className="upload-icon-wrap">
                    <UploadCloud size={34} />
                  </span>
                  <div>
                    <span className="upload-main-text">
                      {isDragging ? 'Drop Credential JSON Here' : 'Drag & Drop Credential JSON Here'}
                    </span>
                    <span className="upload-sub-text">
                      Or click to browse files. Accepts any worker-exported .json credential.
                    </span>
                  </div>
                  <span className="browse-pill">Browse File</span>
                  <input
                    id="file-input-id"
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              <div className="upload-status-row">
                <span>
                  <FileCheck size={17} /> {uploadedFileName}
                </span>
                <span>
                  <RefreshCw size={15} className={loading ? 'spin-icon' : ''} />{' '}
                  {loading ? 'Verifying credential…' : lastVerifiedAt ? `Checked at ${lastVerifiedAt}` : 'Awaiting credential'}
                </span>
              </div>

              <div className="verify-action-row">
                <button type="button" className="btn-primary verify-btn" onClick={handleVerifyClick} disabled={loading}>
                  {loading ? 'Verifying…' : 'Verify Credential'}
                </button>
              </div>
            </div>

            <div className="review-panel">
              <h3>Review Checklist</h3>
              <div className="review-items">
                <div className="review-item">
                  <CheckCircle2 size={17} /> Signature must verify against the embedded issuer public key.
                </div>
                <div className="review-item">
                  <CheckCircle2 size={17} /> Issuer identity should match your trusted OnShift authority.
                </div>
                <div className="review-item">
                  <CheckCircle2 size={17} /> Credential must be within its validUntil window.
                </div>
                <div className="review-item">
                  <Lock size={17} /> Only worker-disclosed claims are visible to this portal.
                </div>
              </div>
            </div>
          </div>

          {!hasAttemptedVerification && (
            <div className="empty-state-panel">
              <FileCheck size={40} />
              <h3>No credential loaded yet</h3>
              <p>Upload a worker-shared JSON credential or paste one below, then click Verify Credential.</p>
            </div>
          )}

          {hasAttemptedVerification && result && (
            <div className={`result-display ${result.valid ? 'border-pass' : 'border-fail'}`}>
              <div className="result-banner-top">
                <div className="banner-left">
                  {result.valid ? <ShieldCheck size={32} color="#047857" /> : <ShieldAlert size={32} color="#E11D48" />}
                  <div>
                    <span className={result.valid ? 'title-pass' : 'title-fail'}>
                      {result.valid ? 'VERIFIED VALID' : result.signatureVerified ? 'CREDENTIAL ISSUE' : 'VERIFICATION FAILED'}
                    </span>
                    {(result.issuer || result.workerId) && (
                      <div className="issuer-tag">
                        {result.issuer && (
                          <>
                            Issuer: <strong>{result.issuer}</strong>
                          </>
                        )}
                        {result.issuer && result.workerId && ' | '}
                        {result.workerId && (
                          <>
                            Worker ID: <strong>{result.workerId}</strong>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <span className={`verdict-pill ${result.valid ? 'pill-pass' : 'pill-fail'}`}>
                  {result.valid
                    ? 'CRYPTOGRAPHICALLY AUTHENTIC'
                    : result.signatureVerified
                      ? 'SIGNATURE OK — OTHER ISSUE'
                      : 'SIGNATURE INVALID / ALTERED'}
                </span>
              </div>

              <div className="result-explanation-box">{result.message}</div>

              {(result.issuedAt || result.validUntil) && (
                <div className="validity-row">
                  {result.issuedAt && <span>Issued: {new Date(result.issuedAt).toLocaleString('en-IN')}</span>}
                  {result.validUntil && <span>Valid until: {new Date(result.validUntil).toLocaleString('en-IN')}</span>}
                </div>
              )}

              {claimEntries.length > 0 && (
                <div className="claims-panel">
                  <h4>Disclosed Credential Claims</h4>
                  <div className="claims-cards">
                    {claimEntries.map(([key, value]) => (
                      <div className="claim-card" key={key}>
                        <span className="c-label">{formatClaimLabel(key)}</span>
                        <span className={`c-val ${key === 'verifiedIncome' ? 'income-highlight' : key === 'verificationLevel' ? 'level-highlight' : ''}`}>
                          {key === 'verificationLevel' && result.valid && <CheckCircle2 size={16} />}{' '}
                          {formatClaimValue(key, value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="advanced-accordion">
            <div className="accordion-trigger" onClick={() => setShowTechnicalJson(!showTechnicalJson)}>
              <span className="trigger-title">
                <FileCode size={18} /> Paste Raw Credential JSON
              </span>
              {showTechnicalJson ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </div>

            {showTechnicalJson && (
              <div className="accordion-body">
                <p className="code-instruction">
                  Paste or edit raw credential JSON below. Edits verify live instantly.
                </p>
                <textarea
                  className="code-textarea"
                  value={jsonInput}
                  onChange={handleTextareaChange}
                  placeholder='{"type":"OnShiftIncomeCredential","workerId":"...","issuer":"...","issuedAt":"...","validUntil":"...","claims":{...},"signature":"...","publicKeyHex":"..."}'
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="trust-architecture" className="architecture-section">
        <div className="section-container">
          <div className="section-header text-center">
            <h2>Institutional Trust Architecture</h2>
            <p>How OnShift gives lenders a tamper-evident proof without exposing a worker's full financial trail.</p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Lock size={24} />
              </div>
              <h3>Ed25519 Signatures</h3>
              <p>Cryptographic keypairs ensure that any payload modification invalidates the signature.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <CheckCircle2 size={24} />
              </div>
              <h3>Evidence Corroboration</h3>
              <p>Combines platform notification logs, work session activity, and bank statement settlements.</p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Building2 size={24} />
              </div>
              <h3>Lender-ready Decision Signal</h3>
              <p>Shows verified income, payout period, and verification level without requiring editable PDFs.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="schemes-preview" className="schemes-section">
        <div className="section-container">
          <div className="schemes-banner">
            <div className="schemes-content">
              <span className="schemes-tag">OPTIONAL ELIGIBILITY LAYER</span>
              <h2>Scheme and Benefit Matching Signals</h2>
              <p>
                When a verifier is a scheme provider, the same verified credential can support eligibility
                checks against central and state welfare programs.
              </p>
              <div className="schemes-chips">
                <span className="chip">PM-SYM Pension</span>
                <span className="chip">Atal Pension Yojana (APY)</span>
                <span className="chip">PM-SVANidhi</span>
                <span className="chip">e-Shram Social Security</span>
                <span className="chip">+26 More Schemes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="brand">
              <img
                src="/logo.png"
                alt="OnShift Logo"
                className="brand-logo-img"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="brand-text">
                <span className="brand-name">OnShift</span>
                <span className="brand-tag">VERIFIER PORTAL</span>
              </div>
            </div>
            <p className="footer-desc">
              External verification portal for lenders, banks, landlords, and scheme providers. Powered by
              Ed25519 cryptography and worker-controlled selective disclosure.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-container bottom-flex">
            <span>© 2026 OnShift Proof Authority. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
