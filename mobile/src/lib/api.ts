/* The one API object of the app, wired to the phone: secure token storage, Razorpay, saved speed tests, files. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';

import { createHttp } from './api/http';
import { createRest } from './api/rest';
import { API_URL } from './config';
import { openCheckout } from './razorpay';
import { secureTokenStore } from './tokenStore';

export const http = createHttp({ baseUrl: API_URL, store: secureTokenStore });
export const API = createRest({ http, checkout: openCheckout, storage: AsyncStorage, filePart: (file) => new File(file.uri) });
