/* Login tokens live in the phone's secure storage (Android Keystore / iOS Keychain). Each token is its own
   entry, so neither value gets near the size limit of a secure entry. */
import * as SecureStore from 'expo-secure-store';

import type { TokenStore } from './api/http';

const ACCESS = 'cb-access-token';
const REFRESH = 'cb-refresh-token';

export const secureTokenStore: TokenStore = {
  async load() {
    try {
      const [access_token, refresh_token] = await Promise.all([SecureStore.getItemAsync(ACCESS), SecureStore.getItemAsync(REFRESH)]);
      return access_token && refresh_token ? { access_token, refresh_token } : null;
    } catch {
      return null;
    }
  },
  async save(tokens) {
    if (tokens) {
      await SecureStore.setItemAsync(ACCESS, tokens.access_token);
      await SecureStore.setItemAsync(REFRESH, tokens.refresh_token);
    } else {
      await SecureStore.deleteItemAsync(ACCESS);
      await SecureStore.deleteItemAsync(REFRESH);
    }
  },
};
