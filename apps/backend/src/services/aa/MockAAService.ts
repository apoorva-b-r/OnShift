import crypto from 'crypto';
import mongoose from 'mongoose';
import { AAService } from './AAService';
import { ConsentRequest } from '../../models/ConsentRequest';

export class MockAAService implements AAService {
  private consents = new Map<
    string,
    { consentId: string; workerId: string; fiTypes: string[]; status: string; consentUrl: string }
  >();
  private sessions = new Map<
    string,
    { sessionId: string; consentId: string; status: string; data: any }
  >();

  async createConsentRequest(
    workerId: string,
    fiTypes: string[],
    baseUrlOverride?: string
  ): Promise<{ consentId: string; status: string; consentUrl: string }> {
    const uuid = crypto.randomUUID();
    const consentId = `mock-consent-${uuid}`;
    const baseUrl = baseUrlOverride || process.env.BASE_URL || 'http://localhost:4000';
    const consentUrl = `${baseUrl.replace(/\/$/, '')}/api/v1/mock-aa/consent/${consentId}`;

    const record = { consentId, workerId, fiTypes, status: 'PENDING', consentUrl };
    this.consents.set(consentId, record);

    if (mongoose.connection.readyState === 1) {
      await ConsentRequest.create({
        consentId,
        workerId,
        fiTypes: fiTypes.length > 0 ? fiTypes : ['DEPOSIT'],
        status: 'PENDING',
        consentUrl,
        isMock: true,
      });
    }

    console.log(
      `[MockAAService] createConsentRequest workerId=${workerId}, fiTypes=${fiTypes.join(', ')} -> consentId=${consentId}`
    );
    return { consentId, status: record.status, consentUrl };
  }

  async getConsentStatus(consentId: string): Promise<{ consentId: string; status: string }> {
    console.log(`[MockAAService] getConsentStatus consentId=${consentId}`);

    if (mongoose.connection.readyState === 1) {
      const doc = await ConsentRequest.findOne({ consentId }).lean();
      if (doc) {
        return { consentId: doc.consentId, status: doc.status };
      }
    }

    const record = this.consents.get(consentId);
    if (!record) {
      return { consentId, status: 'NOT_FOUND' };
    }
    return { consentId: record.consentId, status: record.status };
  }

  async createDataSession(
    consentId: string
  ): Promise<{ sessionId: string; consentId: string; status: string }> {
    let isActive = false;
    if (mongoose.connection.readyState === 1) {
      const consentDoc = await ConsentRequest.findOne({ consentId }).lean();
      if (consentDoc && consentDoc.status === 'ACTIVE') {
        isActive = true;
      }
    }

    if (!isActive) {
      const memConsent = this.consents.get(consentId);
      if (memConsent && memConsent.status === 'ACTIVE') {
        isActive = true;
      }
    }

    if (!isActive) {
      throw new Error(`Consent ${consentId} is not ACTIVE.`);
    }

    const uuid = crypto.randomUUID();
    const sessionId = `mock-session-${uuid}`;

    // Canonical Scenario 1 dataset: a single attributable platform settlement of
    // INR 30,100 that reconciles with declared/observed earnings of INR 30,500
    // minus the authorized INR 400 kit deduction -> FINANCIALLY_CORROBORATED.
    const mockData = {
      account: {
        fipId: 'HDFC Bank',
        accountType: 'SAVINGS',
        maskedAccountNumber: 'XX4821',
        ifsc: 'HDFC0000123',
        remitter: 'Gig Platform Escrow Private Limited',
      },
      transactions: [
        {
          transactionId: 'hdfc-001',
          date: '2026-08-08',
          type: 'CREDIT',
          amount: 30100,
          description: 'Gig Platform Escrow Private Limited',
        },
      ],
    };

    const record = { sessionId, consentId, status: 'READY', data: mockData };
    this.sessions.set(sessionId, record);

    console.log(
      `[MockAAService] createDataSession consentId=${consentId} -> sessionId=${sessionId}`
    );
    return { sessionId, consentId, status: 'READY' };
  }

  async getDataSession(sessionId: string): Promise<any> {
    console.log(`[MockAAService] getDataSession sessionId=${sessionId}`);
    const record = this.sessions.get(sessionId);
    if (!record) {
      return {
        account: {
          fipId: 'HDFC Bank',
          accountType: 'SAVINGS',
          maskedAccountNumber: 'XX4821',
          ifsc: 'HDFC0000123',
          remitter: 'Gig Platform Escrow Private Limited',
        },
        transactions: [
          {
            transactionId: 'hdfc-001',
            date: '2026-08-08',
            type: 'CREDIT',
            amount: 30100,
            description: 'Gig Platform Escrow Private Limited',
          },
        ],
      };
    }
    return record.data;
  }
}
