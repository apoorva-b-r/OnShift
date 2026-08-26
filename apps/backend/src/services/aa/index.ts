import { AAService } from './AAService';
import { MockAAService } from './MockAAService';
import { SetuAAService } from './SetuAAService';

export { AAService, MockAAService, SetuAAService };

export const getAAService = (): AAService => {
  return process.env.SETU_AA_MOCK_MODE === 'false'
    ? new SetuAAService()
    : new MockAAService();
};
