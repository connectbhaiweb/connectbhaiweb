/* The only file that talks to the Razorpay native module. The app never holds a Razorpay secret: the key id and
   order come from the server, and the server verifies the signature. */
import RazorpayCheckout from 'react-native-razorpay';

import { AppError } from './api/base';
import type { Checkout } from './api/checkout';
import { checkoutErrorMessage } from './checkoutError';

export const openCheckout: Checkout = async (options) => {
  try {
    return await RazorpayCheckout.open(options);
  } catch (error) {
    throw new AppError(checkoutErrorMessage(error));
  }
};
