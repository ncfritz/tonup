import * as ExpoIap from 'expo-iap';

import { storeKitPurchases, type IapApi } from './storekit';

export const purchases = storeKitPurchases(ExpoIap as unknown as IapApi);
