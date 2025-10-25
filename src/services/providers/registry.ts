import { ProviderClient } from './types';

const providers = new Map<string, ProviderClient>();

export function registerProvider(provider: string, client: ProviderClient) {
  providers.set(provider.toLowerCase(), client);
}

export function getProviderClient(provider: string): ProviderClient {
  const client = providers.get(provider.toLowerCase());
  if (!client) {
    const e = new Error(`No provider registered for ${provider}`);
    // @ts-ignore
    e.status = 400;
    throw e;
  }
  return client;
}


