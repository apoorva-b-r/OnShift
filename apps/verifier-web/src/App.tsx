import React, { useState, useEffect } from 'react';
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
  Sun,
  Moon,
  User,
  LogOut,
  LogIn,
  UserPlus,
  X,
  UserCheck,
  Cpu,
} from 'lucide-react';

import type { CredentialVerificationResult } from './credentialTypes';
import { verifyCredentialInBrowser, formatClaimLabel, formatClaimValue } from './verifyCredential';

interface LenderUser {
  name: string;
  email: string;
  institution: string;
  role: string;
}
import { WorkerStudio } from './WorkerStudio';

export default function App() {
  const [activeTab, setActiveTab] = useState<'worker' | 'verifier' | 'architecture'>('worker');
  const [jsonInput, setJsonInput] = useState('');
  const [result, setResult] = useState<CredentialVerificationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showTechnicalJson, setShowTechnicalJson] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState('No credential loaded');
  const [lastVerifiedAt, setLastVerifiedAt] = useState<string | null>(null);
  const [hasAttemptedVerification, setHasAttemptedVerification] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('onshift_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('onshift_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Auth & Profile state
  const [user, setUser] = useState<LenderUser | null>(() => {
    const saved = localStorage.getItem('onshift_lender_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed) {
          if (!parsed.institution || parsed.institution.includes('Risk & Underwriting Desk') || parsed.institution === '-') {
            parsed.institution = '--';
          }
          return parsed;
        }
      } catch {
        // fallback
      }
    }
    return null;
  });

  const [activeModal, setActiveModal] = useState<'login' | 'signup' | 'profile' | null>(null);

  // Form states
  const [loginEmail, setLoginEmail] = useState('');
  const [loginInstitution, setLoginInstitution] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupInstitution, setSignupInstitution] = useState('');
  const [signupPassword, setSignupPassword] = useState('');

  const handleSaveUser = (u: LenderUser | null) => {
    setUser(u);
    if (u) {
      localStorage.setItem('onshift_lender_user', JSON.stringify(u));
    } else {
      localStorage.removeItem('onshift_lender_user');
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail) return;
    const namePart = loginEmail.split('@')[0].replace(/[\._]/g, ' ');
    const name = namePart.replace(/\b\w/g, (s) => s.toUpperCase());

    const newUser: LenderUser = {
      name: name || 'Lender Officer',
      email: loginEmail,
      institution: loginInstitution.trim() || '--',
      role: 'Risk Assessment Officer',
    };
    handleSaveUser(newUser);
    setActiveModal(null);
    setLoginEmail('');
    setLoginInstitution('');
    setLoginPassword('');
  };

  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupEmail || !signupName) return;
    const newUser: LenderUser = {
      name: signupName,
      email: signupEmail,
      institution: signupInstitution.trim() || '--',
      role: 'Credit Risk Officer',
    };
    handleSaveUser(newUser);
    setActiveModal(null);
    setSignupName('');
    setSignupEmail('');
    setSignupInstitution('');
    setSignupPassword('');
  };

  const handleLogout = () => {
    handleSaveUser(null);
    setActiveModal(null);
  };

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

  const handleSendCredentialToVerifier = (credentialJson: string) => {
    ingestCredentialText(credentialJson, 'Issued Worker Credential (Direct)');
    setActiveTab('verifier');
    window.scrollTo({ top: 0, behavior: 'smooth' });
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
              <span className="brand-tag">INCOME VERIFICATION SYSTEM</span>
            </div>
          </div>

          <nav className="nav-links">
            <button
              className={`nav-tab-btn ${activeTab === 'worker' ? 'active' : ''}`}
              onClick={() => setActiveTab('worker')}
            >
              <UserCheck size={16} /> Worker Studio
            </button>

            <button
              className={`nav-tab-btn ${activeTab === 'verifier' ? 'active' : ''}`}
              onClick={() => setActiveTab('verifier')}
            >
              <Building2 size={16} /> Lender Verifier
            </button>

            <button
              className={`nav-tab-btn ${activeTab === 'architecture' ? 'active' : ''}`}
              onClick={() => setActiveTab('architecture')}
            >
              <Cpu size={16} /> Trust Architecture
            </button>
          </nav>

          <div className="nav-actions">
            <button
              type="button"
              className="theme-toggle-btn"
              onClick={toggleTheme}
              title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {user ? (
              <>
                <button
                  type="button"
                  className="user-profile-btn"
                  onClick={() => setActiveModal('profile')}
                  title="View Lender Profile"
                >
                  <span className="user-avatar-circle">{user.name.charAt(0).toUpperCase()}</span>
                  <span>{user.name.split(' ')[0]}</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={handleLogout}
                  title="Log Out"
                >
                  <LogOut size={15} /> Log Out
                </button>
              </>
            ) : (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn-secondary-sm"
                  onClick={() => setActiveModal('login')}
                >
                  <LogIn size={15} /> Log In
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}
                  onClick={() => setActiveModal('signup')}
                >
                  <UserPlus size={15} /> Sign Up
                </button>
              </div>
            )}
            <span className="portal-badge">
              {activeTab === 'worker' ? (
                <>
                  <UserCheck size={15} /> Worker Pipeline Mode
                </>
              ) : (
                <>
                  <Building2 size={15} /> Verifier Portal
                </>
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Areas based on Active Tab */}
      {activeTab === 'worker' && (
        <section className="worker-section-wrapper">
          <div className="section-container">
            <div className="section-header text-center">
              <h2>Worker Verification & Credential Pipeline</h2>
              <p>
                Connects directly to Express API Gateway (`http://localhost:4000/api/v1`) and Python Reconciliation Engine.
              </p>
            </div>
            <WorkerStudio onSendCredentialToVerifier={handleSendCredentialToVerifier} />
          </div>
        </section>
      )}

      {activeTab === 'verifier' && (
        <>
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
                  <span className="stat-label">Scheme Signals</span>
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
        </>
      )}

      {activeTab === 'architecture' && (
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
                <h3>Ed25519 Cryptographic Signatures</h3>
                <p>Private Ed25519 keypairs ensure that any payload modification invalidates the signature.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <CheckCircle2 size={24} />
                </div>
                <h3>Evidence Corroboration Engine</h3>
                <p>Python FastAPI engine reconciles platform notification logs, work session activity, and bank statement settlements.</p>
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
      )}

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
                <span className="brand-tag">INCOME VERIFICATION SYSTEM</span>
              </div>
            </div>
            <p className="footer-desc">
              Authoritative Income Verification Pipeline for Gig Workers. Powered by Python Reconciliation Engine and Ed25519 W3C Verifiable Credentials.
            </p>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="footer-container bottom-flex">
            <span>© 2026 OnShift Proof Authority. All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* Modal Dialogs */}
      {activeModal === 'login' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><LogIn size={20} /> Lender Sign In</h3>
              <button type="button" className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleLoginSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Work / Institutional Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="example@lender.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Institution / Bank Name (Optional)</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Leave blank for --"
                    value={loginInstitution}
                    onChange={(e) => setLoginInstitution(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                  Sign In to Verifier Portal
                </button>
                <div className="auth-switch-text">
                  New lender desk?
                  <button type="button" className="btn-link" onClick={() => setActiveModal('signup')}>
                    Register Institution
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === 'signup' && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><UserPlus size={20} /> Register Lender Account</h3>
              <button type="button" className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSignUpSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Vikram Malhotra"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Institution / Bank Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Axis Microfinance Desk"
                    value={signupInstitution}
                    onChange={(e) => setSignupInstitution(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Work Email</label>
                  <input
                    type="email"
                    className="form-input"
                    placeholder="underwriter@institution.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '0.5rem' }}>
                  Create Lender Account
                </button>
                <div className="auth-switch-text">
                  Already registered?
                  <button type="button" className="btn-link" onClick={() => setActiveModal('login')}>
                    Sign In
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeModal === 'profile' && user && (
        <div className="modal-overlay" onClick={() => setActiveModal(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><User size={20} /> Lender Profile</h3>
              <button type="button" className="modal-close-btn" onClick={() => setActiveModal(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="profile-avatar-banner">
                <div className="profile-avatar-large">{user.name.charAt(0).toUpperCase()}</div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{user.name}</h4>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {user.role}
                  </span>
                </div>
              </div>

              <div className="profile-details-grid">
                <div className="profile-detail-item">
                  <span className="pd-label">Institution</span>
                  <span className="pd-val">{user.institution && user.institution !== '-' ? user.institution : '--'}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="pd-label">Verified Email</span>
                  <span className="pd-val">{user.email}</span>
                </div>
                <div className="profile-detail-item">
                  <span className="pd-label">Authority Level</span>
                  <span className="pd-val" style={{ color: '#047857' }}>
                    <ShieldCheck size={16} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                    Verified Ed25519 Verifier Desk
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  type="button"
                  className="btn-secondary-sm"
                  style={{ width: '100%', justifyContent: 'center', color: '#E11D48', borderColor: '#FECDD3' }}
                  onClick={handleLogout}
                >
                  <LogOut size={16} /> Log Out
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => setActiveModal(null)}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
