(function () {
  const API_BASE = 'http://localhost:4000/api/v1';

  // Application State
  const state = {
    currentStep: 1,
    workerName: 'Ravi Kumar',
    workerId: 'OS-DEMO-001',
    authToken: 'OS-DEMO-001',
    requestId: null,
    authorizationUrl: null,
    validUpto: null,
    backendStatus: 'NOT_STARTED',
    identityVerified: false,
    isDevMockMode: false,
  };

  // DOM Elements
  const el = {
    workerNameInput: document.getElementById('worker-name'),
    workerIdInput: document.getElementById('worker-id'),
    btnContinueStep1: document.getElementById('btn-continue-step1'),
    btnInitiateDigilocker: document.getElementById('btn-initiate-digilocker'),
    initiateSuccessPanel: document.getElementById('initiate-success-panel'),
    btnOpenDigilocker: document.getElementById('btn-open-digilocker'),
    btnCheckStatusStep2: document.getElementById('btn-check-status-step2'),
    btnCheckStatusStep3: document.getElementById('btn-check-status-step3'),
    btnReopenPortal: document.getElementById('btn-reopen-portal'),
    btnCompleteVerify: document.getElementById('btn-complete-verify'),
    btnCompleteRegistration: document.getElementById('btn-complete-registration'),
    btnResetDemo: document.getElementById('btn-reset-demo'),
    alertContainer: document.getElementById('alert-container'),
    toggleDevMock: document.getElementById('toggle-dev-mock'),
    
    // Dev Panel
    devWorkerId: document.getElementById('dev-worker-id'),
    devProvider: document.getElementById('dev-provider'),
    devStatusBadge: document.getElementById('dev-status-badge'),
    devVerifiedFlag: document.getElementById('dev-verified-flag'),
    devRequestId: document.getElementById('dev-request-id'),
    devExpiresAt: document.getElementById('dev-expires-at'),

    // Summary
    summaryWorkerName: document.getElementById('summary-worker-name'),
    summaryWorkerId: document.getElementById('summary-worker-id'),
  };

  // Initialize
  function init() {
    bindEvents();
    updateDevPanel();
  }

  function bindEvents() {
    el.btnContinueStep1.addEventListener('click', handleStep1Continue);
    el.btnInitiateDigilocker.addEventListener('click', handleInitiateDigilocker);
    el.btnOpenDigilocker.addEventListener('click', handleOpenDigilocker);
    el.btnCheckStatusStep2.addEventListener('click', handleCheckStatus);
    el.btnCheckStatusStep3.addEventListener('click', handleCheckStatus);
    el.btnReopenPortal.addEventListener('click', handleOpenDigilocker);
    el.btnCompleteVerify.addEventListener('click', handleCompleteVerify);
    el.btnCompleteRegistration.addEventListener('click', handleCompleteRegistration);
    el.btnResetDemo.addEventListener('click', resetDemo);

    window.addEventListener('message', (event) => {
      if (event.data?.type === 'DIGILOCKER_AUTH_COMPLETE') {
        showAlert('DigiLocker authorization detected! Syncing status...', 'success');
        handleCheckStatus();
      }
    });

    el.toggleDevMock.addEventListener('change', (e) => {
      state.isDevMockMode = e.target.checked;
      showAlert(
        state.isDevMockMode
          ? '⚠️ MOCK / DEV MODE ENABLED: Status transitions can be simulated in UI.'
          : 'ℹ️ MOCK / DEV MODE DISABLED: Real backend Setu API is active.',
        state.isDevMockMode ? 'info' : 'info'
      );
    });
  }

  // UI Step Navigation
  function goToStep(stepNum) {
    state.currentStep = stepNum;

    // Update Step Contents Visibility
    for (let i = 1; i <= 6; i++) {
      const stepSec = document.getElementById(`step-${i}`);
      if (stepSec) {
        stepSec.style.display = i === stepNum ? 'block' : 'none';
      }
    }

    // Update Stepper Bar
    for (let i = 1; i <= 5; i++) {
      const stepNode = document.getElementById(`step-node-${i}`);
      if (stepNode) {
        stepNode.classList.remove('active', 'completed');
        if (i < stepNum) {
          stepNode.classList.add('completed');
        } else if (i === stepNum || (stepNum === 6 && i === 5)) {
          stepNode.classList.add('active');
        }
      }
    }
  }

  // Helper Alert Banner
  function showAlert(msg, type = 'info') {
    el.alertContainer.innerHTML = `
      <div class="alert alert-${type}">
        ${msg}
      </div>
    `;
    setTimeout(() => {
      // Keep alert visible for 8s
    }, 8000);
  }

  function clearAlert() {
    el.alertContainer.innerHTML = '';
  }

  // Update Side Dev Panel
  function updateDevPanel() {
    el.devWorkerId.textContent = state.workerId || 'N/A';
    el.devRequestId.textContent = state.requestId || 'None';
    el.devExpiresAt.textContent = state.validUpto
      ? new Date(state.validUpto).toLocaleTimeString()
      : 'N/A';

    el.devVerifiedFlag.textContent = String(state.identityVerified);
    el.devVerifiedFlag.style.color = state.identityVerified ? '#10B981' : '#EF4444';

    // Badge update
    el.devStatusBadge.textContent = state.backendStatus;
    el.devStatusBadge.className = `badge badge-${state.backendStatus}`;
  }

  // STEP 1: Registration Continue
  function handleStep1Continue() {
    const name = el.workerNameInput.value.trim();
    const wId = el.workerIdInput.value.trim();

    if (!name || !wId) {
      showAlert('Please enter both Worker Name and Worker ID.', 'error');
      return;
    }

    state.workerName = name;
    state.workerId = wId;
    state.authToken = wId; // Authenticated worker token

    clearAlert();
    updateDevPanel();
    goToStep(2);
  }

  // STEP 2: Initiate DigiLocker Request
  async function handleInitiateDigilocker() {
    el.btnInitiateDigilocker.disabled = true;
    el.btnInitiateDigilocker.textContent = 'Creating DigiLocker Session...';
    clearAlert();

    try {
      if (state.isDevMockMode) {
        // Simulated Mock Initiate
        await new Promise((r) => setTimeout(r, 600));
        state.requestId = `req-mock-${Date.now().toString(36)}`;
        state.authorizationUrl = 'https://dg-sandbox.setu.co';
        state.validUpto = new Date(Date.now() + 600000).toISOString();
        state.backendStatus = 'REQUEST_CREATED';
        state.identityVerified = false;
      } else {
        // Real Backend Call: POST /api/v1/identity/digilocker/initiate
        const res = await fetch(`${API_BASE}/identity/digilocker/initiate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.authToken}`,
          },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || 'Failed to initiate DigiLocker session');
        }

        state.requestId = data.requestId;
        state.authorizationUrl = data.authorizationUrl;
        state.validUpto = data.validUpto;
        state.backendStatus = data.status || 'REQUEST_CREATED';
        state.identityVerified = Boolean(data.identityVerified);
      }

      updateDevPanel();
      el.initiateSuccessPanel.style.display = 'block';
      el.btnInitiateDigilocker.style.display = 'none';

      showAlert('DigiLocker session created. Click "Open DigiLocker Authorization Portal" to proceed.', 'success');
    } catch (err) {
      showAlert(`Initiation Error: ${err.message}`, 'error');
      el.btnInitiateDigilocker.disabled = false;
      el.btnInitiateDigilocker.textContent = 'Verify with DigiLocker';
    }
  }

  // STEP 2 & 3: Open DigiLocker Portal in Browser
  function handleOpenDigilocker() {
    if (!state.authorizationUrl) {
      showAlert('No valid DigiLocker authorization URL found.', 'error');
      return;
    }

    // Open real Setu authorization URL returned by backend
    window.open(state.authorizationUrl, '_blank');

    goToStep(3);
    showAlert('DigiLocker authorization portal opened in new window. After completing login, click "Check Verification Status".', 'info');
  }

  // STEP 3 & 4: Check Verification Status
  async function handleCheckStatus() {
    clearAlert();
    try {
      if (state.isDevMockMode) {
        // Simulated Status Progress in Mock Mode
        await new Promise((r) => setTimeout(r, 400));
        if (state.backendStatus === 'REQUEST_CREATED') {
          state.backendStatus = 'AUTHENTICATED';
        } else if (state.backendStatus === 'AUTHENTICATED') {
          state.backendStatus = 'VERIFIED';
          state.identityVerified = true;
        }
      } else {
        // Real Backend Call: GET /api/v1/identity/digilocker/status
        const res = await fetch(`${API_BASE}/identity/digilocker/status`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${state.authToken}`,
          },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || 'Failed to fetch status');
        }

        state.backendStatus = data.status;
        state.identityVerified = Boolean(data.identityVerified);
        if (data.validUpto) state.validUpto = data.validUpto;
      }

      updateDevPanel();

      if (state.backendStatus === 'AUTHENTICATED' && !state.identityVerified) {
        goToStep(4);
        showAlert('DigiLocker authentication confirmed! Click "Complete Identity Verification" to finalize.', 'success');
      } else if (state.backendStatus === 'VERIFIED' && state.identityVerified) {
        goToStep(5);
        showAlert('✓ Identity Verified successfully by backend!', 'success');
      } else if (['FAILED', 'EXPIRED', 'REVOKED'].includes(state.backendStatus)) {
        showAlert(`Identity Verification ${state.backendStatus}: Please restart registration.`, 'error');
      } else {
        showAlert(`Current Status: ${state.backendStatus}. If you completed DigiLocker login, try checking again in a moment.`, 'info');
      }
    } catch (err) {
      showAlert(`Status Check Error: ${err.message}`, 'error');
    }
  }

  // STEP 4: Complete Verification Call
  async function handleCompleteVerify() {
    el.btnCompleteVerify.disabled = true;
    el.btnCompleteVerify.textContent = 'Verifying with Engine...';
    clearAlert();

    try {
      if (state.isDevMockMode) {
        await new Promise((r) => setTimeout(r, 500));
        state.backendStatus = 'VERIFIED';
        state.identityVerified = true;
      } else {
        // Real Backend Call: POST /api/v1/identity/digilocker/verify
        const res = await fetch(`${API_BASE}/identity/digilocker/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${state.authToken}`,
          },
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || data.error || 'Verification failed');
        }

        state.backendStatus = data.status || 'VERIFIED';
        state.identityVerified = Boolean(data.identityVerified);
      }

      updateDevPanel();
      goToStep(5);
      showAlert('✓ Identity Verification complete! Click "Complete Registration".', 'success');
    } catch (err) {
      showAlert(`Verification Error: ${err.message}`, 'error');
      el.btnCompleteVerify.disabled = false;
      el.btnCompleteVerify.textContent = 'Complete Identity Verification';
    }
  }

  // STEP 5: Complete Registration
  function handleCompleteRegistration() {
    el.summaryWorkerName.textContent = state.workerName;
    el.summaryWorkerId.textContent = state.workerId;
    goToStep(6);
    showAlert('🎉 Registration completed successfully!', 'success');
  }

  // Reset Demo
  function resetDemo() {
    state.currentStep = 1;
    state.requestId = null;
    state.authorizationUrl = null;
    state.validUpto = null;
    state.backendStatus = 'NOT_STARTED';
    state.identityVerified = false;

    el.btnInitiateDigilocker.style.display = 'block';
    el.btnInitiateDigilocker.disabled = false;
    el.btnInitiateDigilocker.textContent = 'Verify with DigiLocker';
    el.initiateSuccessPanel.style.display = 'none';

    clearAlert();
    updateDevPanel();
    goToStep(1);
  }

  // Run on page load
  document.addEventListener('DOMContentLoaded', init);
})();
