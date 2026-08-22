import request from 'supertest';
import app from '../src/index';
import { resetAccountAggregatorProviderForTests } from '../src/services/aa/getAccountAggregatorProvider';

describe('Account Aggregator consent route', () => {
  beforeEach(() => resetAccountAggregatorProviderForTests());

  it('returns an explicit isMock boolean from the active provider', async () => {
    const response = await request(app)
      .post('/api/v1/consent/request')
      .send({ workerId: 'OS-AA-ROUTE-TEST', fiTypes: ['DEPOSIT'] });

    expect(response.status).toBe(201);
    expect(typeof response.body.isMock).toBe('boolean');
    expect(response.body.consentId).toBeDefined();
    expect(response.body.status).toBeDefined();
  }, 5_000);

  it('returns provider financial data through the consent data route', async () => {
    const response = await request(app).get('/api/v1/consent/data/mock-consent-route-test');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.any(Array));
    expect(response.body.length).toBeGreaterThan(0);
  });
});
