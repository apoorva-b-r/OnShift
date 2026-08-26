import { AASandboxUnavailableError, SetuAccountAggregatorProvider } from './SetuAccountAggregatorProvider';
import { MockAccountAggregatorProvider } from './MockAccountAggregatorProvider';
import { AccountAggregatorProvider } from './types';

let provider: AccountAggregatorProvider | undefined;

export function getAccountAggregatorProvider(
  createSetu: () => AccountAggregatorProvider = () => new SetuAccountAggregatorProvider(),
): AccountAggregatorProvider {
  if (provider) return provider;
  try {
    provider = createSetu();
  } catch (error) {
    if (!(error instanceof AASandboxUnavailableError)) throw error;
    console.warn('[AA] Sandbox unreachable, falling back to mock provider');
    provider = new MockAccountAggregatorProvider();
  }
  return provider;
}

export function resetAccountAggregatorProviderForTests(): void {
  provider = undefined;
}