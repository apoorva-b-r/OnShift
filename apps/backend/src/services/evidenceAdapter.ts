export interface CanonicalEvidenceInput {
  id: string;
  workerId: string;
  source: string;
  type: string;
  category?: string;
  role?: string;
  platform: string;
  timestamp: string;
  amount: number;
  currency?: string;
  reference?: string;
  metadata?: Record<string, any>;
  previousHash?: string;
  integrityHash?: string;
  capturedAt?: string;
  sourceDocumentId?: string;
  extractionConfidence?: number;
}

export function validateAndNormalizeEvidence(ev: any): CanonicalEvidenceInput {
  if (!ev || typeof ev !== 'object') {
    throw new Error('Evidence record must be an object.');
  }

  if (!ev.id || typeof ev.id !== 'string') {
    throw new Error('Evidence record missing valid "id".');
  }

  const workerId = ev.workerId || 'OS-DEMO-001';

  // 1. Source Normalization
  let rawSource = (ev.source || '').toString().toUpperCase();
  let source = rawSource;
  if (rawSource === 'OBSERVED_NOTIFICATION' || rawSource === 'NOTIFICATION_LISTENER') {
    source = 'OBSERVED';
  } else if (rawSource === 'DECLARED') {
    source = 'DECLARED';
  } else if (rawSource === 'FINANCIAL' || rawSource === 'BANK' || rawSource === 'AA') {
    source = 'FINANCIAL';
  } else if (rawSource === 'OCR' || rawSource === 'DOCUMENT') {
    source = 'OCR';
  }

  if (!['DECLARED', 'OBSERVED', 'FINANCIAL', 'OCR'].includes(source)) {
    throw new Error(`Invalid or unknown evidence source: "${ev.source}"`);
  }

  // 2. Type & Role Derivation
  let rawType = (ev.type || '').toString().toUpperCase();
  let type = rawType;

  if (rawType === 'ORDER_COMPLETED') {
    type = 'NOTIFICATION_ORDER';
  } else if (rawType === 'PAYOUT_COMPLETED') {
    type = 'NOTIFICATION_PAYOUT';
  } else if (rawType === 'EARNING_RECORDED') {
    type = 'NOTIFICATION_ORDER';
  } else if (rawType === 'SELF_REPORTED_PAYOUT') {
    type = 'SELF_REPORTED_PAYOUT';
  } else if (rawType === 'AA_BANK_SETTLEMENT') {
    type = 'AA_BANK_SETTLEMENT';
  } else if (!type) {
    throw new Error('Evidence record missing "type".');
  }

  let role = ev.role ? ev.role.toString().toUpperCase() : undefined;
  if (!role) {
    if (source === 'FINANCIAL' || type.includes('SETTLEMENT') || type.includes('AA_BANK')) {
      role = 'SETTLEMENT';
    } else if (type.includes('DEDUCTION')) {
      role = 'DEDUCTION';
    } else if (type.includes('PAYOUT') || type.includes('STATEMENT') || source === 'DECLARED') {
      role = 'PAYOUT_CLAIM';
    } else {
      role = 'ORDER_EVENT';
    }
  }

  if (!['ORDER_EVENT', 'PAYOUT_CLAIM', 'DEDUCTION', 'SETTLEMENT'].includes(role)) {
    throw new Error(`Unknown or invalid evidence role: "${role}"`);
  }

  // 3. Amount Validation (Reject NaN, Infinity, string currency, negative amounts where non-deduction)
  let amount = ev.amount;
  if (typeof amount === 'string') {
    throw new Error(`Amount must be a numeric float, received string "${ev.amount}".`);
  }

  if (typeof amount !== 'number' || isNaN(amount) || !isFinite(amount)) {
    throw new Error(`Invalid amount in evidence record (${ev.id}): ${ev.amount}`);
  }

  if (amount < 0 && role !== 'DEDUCTION') {
    throw new Error(`Negative amount not permitted for role ${role} in evidence record (${ev.id}).`);
  }

  // 4. Timestamp Normalization
  let timestamp = ev.timestamp;
  if (typeof timestamp === 'number') {
    timestamp = new Date(timestamp).toISOString();
  }
  if (!timestamp || typeof timestamp !== 'string') {
    throw new Error(`Evidence record (${ev.id}) missing valid timestamp.`);
  }

  const parsedDate = new Date(timestamp);
  if (isNaN(parsedDate.getTime())) {
    throw new Error(`Evidence record (${ev.id}) contains malformed timestamp: "${timestamp}".`);
  }

  // 5. Category Derivation
  let category = ev.category;
  if (!category) {
    if (role === 'DEDUCTION') category = 'DEDUCTION';
    else if (role === 'SETTLEMENT') category = 'SETTLEMENT';
    else if (role === 'PAYOUT_CLAIM') category = 'PAYOUT';
    else category = 'EARNING';
  }

  return {
    id: ev.id,
    workerId,
    source,
    type,
    category,
    role,
    platform: ev.platform || 'Generic',
    timestamp: parsedDate.toISOString(),
    amount,
    currency: ev.currency || 'INR',
    reference: ev.reference || ev.transactionRef || ev.orderId || '',
    metadata: ev.metadata || {},
    previousHash: ev.previousHash || '',
    integrityHash: ev.integrityHash || '',
    capturedAt: ev.capturedAt || new Date().toISOString(),
    sourceDocumentId: ev.sourceDocumentId,
    extractionConfidence: typeof ev.extractionConfidence === 'number' ? ev.extractionConfidence : undefined,
  };
}
