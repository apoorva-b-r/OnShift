import { AAService } from './AAService';

export class SetuAAService implements AAService {
  async createConsentRequest(
    _workerId: string,
    _fiTypes: string[]
  ): Promise<{ consentId: string; status: string; consentUrl: string }> {
    throw new Error('SetuAAService.createConsentRequest is not implemented yet.');
  }

  async getConsentStatus(_consentId: string): Promise<{ consentId: string; status: string }> {
    throw new Error('SetuAAService.getConsentStatus is not implemented yet.');
  }

  async createDataSession(
    _consentId: string
  ): Promise<{ sessionId: string; consentId: string; status: string }> {
    throw new Error('SetuAAService.createDataSession is not implemented yet.');
  }

  async getDataSession(_sessionId: string): Promise<any> {
    throw new Error('SetuAAService.getDataSession is not implemented yet.');
  }
}
