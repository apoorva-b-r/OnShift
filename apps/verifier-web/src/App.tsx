import React, { useState, useEffect } from 'react';
import { verifyCredentialSignature, signCredential } from '@onshift/credential-schema';
import { Credential, CredentialVerificationResult } from '@onshift/shared-types';
import { DEMO_WORKER } from '@onshift/mock-data';
import {
  ShieldCheck,
  ShieldAlert,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Code2,
  ChevronDown,
  ChevronUp,
  Building2,
  Lock,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Cpu,
  FileSpreadsheet,
  Zap,
  BookOpen,
  HelpCircle,
} from 'lucide-react';

const AUTHENTIC_CREDENTIAL = signCredential(
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

const TAMPERED_CREDENTIAL: Credential = {
  ...AUTHENTIC_CREDENTIAL,
  claims: {
    ...AUTHENTIC_CREDENTIAL.claims,
    verifiedIncome: 95000,
  },
};

export default function App() {
  const [jsonInput, setJsonInput] = useState(JSON.stringify(AUTHENTIC_CREDENTIAL, null, 2));
  const [result, setResult] = useState<CredentialVerificationResult | null>(null);
  const [showCode, setShowCode] = useState(false);
  const [activePreset, setActivePreset] = useState<'AUTHENTIC' | 'TAMPERED' | 'CUSTOM'>('AUTHENTIC');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    runVerification(JSON.stringify(AUTHENTIC_CREDENTIAL, null, 2));
  }, []);

  const runVerification = (inputJson: string) => {
    try {
      const parsed: Credential = JSON.parse(inputJson);
      const res = verifyCredentialSignature(parsed);
      setResult(res);
    } catch (e) {
      setResult({
        valid: false,
        issuerVerified: false,
        signatureVerified: false,
        message: 'Invalid credential payload format. Please upload or paste a valid JSON file.',
      });
    }
  };

  const handleTextareaChange = (value: string) => {
    setJsonInput(value);
    setActivePreset('CUSTOM');
    runVerification(value);
  };

  const loadAuthenticPreset = () => {
    const json = JSON.stringify(AUTHENTIC_CREDENTIAL, null, 2);
    setJsonInput(json);
    setActivePreset('AUTHENTIC');
    runVerification(json);
  };

  const loadTamperedPreset = () => {
    const json = JSON.stringify(TAMPERED_CREDENTIAL, null, 2);
    setJsonInput(json);
    setActivePreset('TAMPERED');
    runVerification(json);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        if (text) {
          setJsonInput(text);
          setActivePreset('CUSTOM');
          runVerification(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setJsonInput(text);
          setActivePreset('CUSTOM');
          runVerification(text);
        }
      };
      reader.readAsText(file);
    }
  };

  const scrollToStudio = () => {
    const el = document.getElementById('verifier-studio');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="app-root">
      {/* Institutional Top Navigation */}
      <header className="navbar">
        <div className="nav-container">
          <div className="brand">
            <img src="/logo.png" alt="OnShift Logo" className="brand-logo-img" />
            <div className="brand-text">
              <span className="brand-name">OnShift</span>
              <span className="brand-tag">VERIFIER PORTAL</span>
            </div>
          </div>

          <nav className="nav-links">
            <a href="#verifier-studio" onClick={(e) => { e.preventDefault(); scrollToStudio(); }}>Verifier Studio</a>
            <a href="#trust-architecture">Trust Architecture</a>
            <a href="#schemes-preview">Government Schemes</a>
            <a href="#docs">API & Security Docs</a>
          </nav>

          <div className="nav-actions">
            <span className="portal-badge">
              <Building2 size={15} /> Lender Portal
            </span>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-container">
          <div className="eyebrow">
            <Sparkles size={16} /> Ed25519 Cryptographic Proof Engine
          </div>
          <h1>Portable Income & Work Verification for Gig Workers</h1>
          <p className="hero-subtitle">
            Instantly verify gig worker earnings, platform activity, and bank settlement corroboration 
            with 100% cryptographic certainty — no bank logins, no paper PDFs, zero fraud risk.
          </p>

          <div className="hero-buttons">
            <button className="btn-primary" onClick={scrollToStudio}>
              Launch Verifier Studio <ArrowRight size={18} />
            </button>
            <a href="#trust-architecture" className="btn-secondary">
              Read Security Protocol
            </a>
          </div>

          {/* Stats Bar */}
          <div className="stats-ribbon">
            <div className="stat-item">
              <span className="stat-number">Ed25519</span>
              <span className="stat-label">Elliptic Curve Math</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">&lt; 10ms</span>
              <span className="stat-label">Verification Latency</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">0%</span>
              <span className="stat-label">PDF Tampering Risk</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">30</span>
              <span className="stat-label">Government Schemes</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Interactive Verifier Studio */}
      <section id="verifier-studio" className="studio-section">
        <div className="section-container">
          <div className="section-header">
            <h2>Verifier Studio</h2>
            <p>Select a scenario or upload a signed JSON credential to run live Ed25519 verification.</p>
          </div>

          {/* Preset Selector Cards */}
          <div className="scenario-grid">
            <div
              className={`scenario-card ${activePreset === 'AUTHENTIC' ? 'active-green' : ''}`}
              onClick={loadAuthenticPreset}
            >
              <div className="card-top">
                <CheckCircle2 size={26} color="#047857" />
                <span className="scenario-badge green">Scenario A</span>
              </div>
              <h3>Authentic Swiggy Partner Credential</h3>
              <p>Verified weekly income of ₹30,100 with valid OnShift Authority signature.</p>
              <button className="btn-card-action authentic">
                {activePreset === 'AUTHENTIC' ? '✓ Currently Loaded' : 'Load Authentic Credential'}
              </button>
            </div>

            <div
              className={`scenario-card ${activePreset === 'TAMPERED' ? 'active-red' : ''}`}
              onClick={loadTamperedPreset}
            >
              <div className="card-top">
                <AlertTriangle size={26} color="#E11D48" />
                <span className="scenario-badge red">Scenario B</span>
              </div>
              <h3>Forged / Tampered Income Claim</h3>
              <p>Income claim altered from ₹30,100 to ₹95,000 without authority signature keys.</p>
              <button className="btn-card-action tampered">
                {activePreset === 'TAMPERED' ? '🚨 Currently Loaded' : 'Test Fraud Detection'}
              </button>
            </div>
          </div>

          {/* File Drag & Drop Upload Zone */}
          <div
            className={`upload-box ${isDragging ? 'drag-active' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input
              type="file"
              id="file-input"
              accept=".json,.txt"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <label htmlFor="file-input" className="upload-inner">
              <Upload size={26} color={isDragging ? '#0284C7' : '#050F2A'} />
              <div>
                <span className="upload-main-text">
                  {isDragging ? 'Drop JSON Credential File Here!' : 'Upload or Drag & Drop Credential File (.json)'}
                </span>
                <span className="upload-sub-text">
                  {isDragging
                    ? 'Release mouse button to verify proof instantly'
                    : 'Drag & drop your OnShift signed JSON proof here or click to browse'}
                </span>
              </div>
            </label>
          </div>

          {/* Live Verification Results Display Card */}
          {result && (
            <div className={`result-display ${result.valid ? 'border-pass' : 'border-fail'}`}>
              <div className="result-banner-top">
                <div className="banner-left">
                  {result.valid ? (
                    <ShieldCheck size={38} color="#047857" />
                  ) : (
                    <ShieldAlert size={38} color="#E11D48" />
                  )}
                  <div>
                    <h3 className={result.valid ? 'title-pass' : 'title-fail'}>
                      {result.valid
                        ? '✓ AUTHENTIC & UNTAMPERED CREDENTIAL'
                        : '🚨 TAMPERING DETECTED — VERIFICATION FAILED'}
                    </h3>
                    <span className="issuer-tag">
                      Issuing Authority: {result.claims ? 'OnShift Proof Authority' : 'Unknown'}
                    </span>
                  </div>
                </div>

                <div className={`verdict-pill ${result.valid ? 'pill-pass' : 'pill-fail'}`}>
                  {result.valid ? 'VERIFIED' : 'TAMPERED / INVALID'}
                </div>
              </div>

              <div className="result-explanation-box">
                <p>{result.message}</p>
              </div>

              {/* Claims Details Grid when Valid */}
              {result.claims && result.valid && (
                <div className="claims-panel">
                  <h4>Disclosed Financial & Work Claims</h4>
                  <div className="claims-cards">
                    <div className="claim-card">
                      <span className="c-label">Verified Weekly Income</span>
                      <span className="c-val income-highlight">
                        ₹{result.claims.verifiedIncome.toLocaleString('en-IN')}
                      </span>
                    </div>

                    <div className="claim-card">
                      <span className="c-label">Payout Period</span>
                      <span className="c-val">{result.claims.period}</span>
                    </div>

                    <div className="claim-card">
                      <span className="c-label">Trust & Verification Level</span>
                      <span className="c-val level-highlight">
                        <Lock size={15} />
                        {result.claims.verificationLevel}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Expandable Advanced Code View */}
          <div className="advanced-accordion">
            <div className="accordion-trigger" onClick={() => setShowCode(!showCode)}>
              <div className="trigger-title">
                <Code2 size={20} />
                <span>Advanced Technical View (Raw Cryptographic JSON Payload)</span>
              </div>
              {showCode ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>

            {showCode && (
              <div className="accordion-body">
                <p className="code-instruction">
                  Edit the JSON properties directly below to test custom values:
                </p>
                <textarea
                  className="code-textarea"
                  value={jsonInput}
                  onChange={(e) => handleTextareaChange(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trust & Architecture Section */}
      <section id="trust-architecture" className="architecture-section">
        <div className="section-container">
          <div className="section-header text-center">
            <h2>Institutional Trust Architecture</h2>
            <p>How OnShift guarantees 100% tamper-proof income data for financial institutions.</p>
          </div>

          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <Cpu size={24} />
              </div>
              <h3>Ed25519 Cryptographic Math</h3>
              <p>
                Every credential is signed using 256-bit elliptic curve cryptography. Signature validity 
                is evaluated deterministically on the lender client.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Lock size={24} />
              </div>
              <h3>Selective Claim Disclosure</h3>
              <p>
                Workers share strictly required income metrics for loan approvals without revealing full 
                transaction history or personal identity.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <FileSpreadsheet size={24} />
              </div>
              <h3>Account Aggregator Corroboration</h3>
              <p>
                Declared gig app earnings are cross-verified against bank settlements (AA AA-BANK-SETTLEMENT) 
                to reach `FINANCIALLY_CORROBORATED` status.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">
                <Zap size={24} />
              </div>
              <h3>Instant Tamper Alerting</h3>
              <p>
                Any attempt to modify payout numbers, dates, or worker IDs breaks the signature hash 
                instantly, preventing fraud.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Government Schemes Integration Section */}
      <section id="schemes-preview" className="schemes-section">
        <div className="section-container">
          <div className="schemes-banner">
            <div className="schemes-content">
              <span className="schemes-tag">ECONOMIC MOBILITY PIPELINE</span>
              <h2>Government Scheme Recommendation Engine</h2>
              <p>
                Verified income credentials automatically match workers with eligible government schemes 
                including PM SVANidhi, e-Shram Pension (PM-SYM), and Ayushman Bharat.
              </p>
              <div className="schemes-chips">
                <span className="chip">PM SVANidhi Loan</span>
                <span className="chip">e-Shram Pension</span>
                <span className="chip">Ayushman Bharat Health</span>
                <span className="chip">30 Total Schemes</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="docs" className="footer">
        <div className="footer-container">
          <div className="footer-brand">
            <div className="brand">
              <img src="/logo.png" alt="OnShift Logo" className="brand-logo-img" />
              <span className="brand-name">OnShift</span>
            </div>
            <p className="footer-desc">
              Portable Proof of Work & Income for the Gig Workforce. Powered by Ed25519 Cryptography.
            </p>
          </div>

          <div className="footer-links-group">
            <div className="footer-col">
              <h4>Platform</h4>
              <a href="#verifier-studio">Verifier Studio</a>
              <a href="#trust-architecture">Trust Architecture</a>
              <a href="#schemes-preview">Government Schemes</a>
            </div>

            <div className="footer-col">
              <h4>Security & Docs</h4>
              <a href="#docs">Ed25519 Specification</a>
              <a href="#docs">API Contract</a>
              <a href="#docs">Audit Trail</a>
            </div>

            <div className="footer-col">
              <h4>Legal & Support</h4>
              <a href="#docs">Privacy Policy</a>
              <a href="#docs">Terms of Service</a>
              <a href="#docs">Contact Security Team</a>
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-container bottom-flex">
            <span>© 2026 OnShift Platform Inc. All rights reserved.</span>
            <span>Ed25519 Public Key: d75a9801...7511a</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
