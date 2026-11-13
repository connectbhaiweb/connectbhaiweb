/* One place for the public support number. Change it here and the top bar, the floating buttons and the links follow. */
export const SUPPORT_PHONE_E164 = "+919479935365";                 // tel: link
export const SUPPORT_PHONE_WA = "919479935365";                      // wa.me wants digits only, no "+"
export const SUPPORT_PHONE_TEXT = "+91 94799 35365";                 // what people read
export const SUPPORT_WA_MESSAGE = "Hi Connect Bhai, I need help choosing a broadband plan.";
export const SUPPORT_WA_URL = `https://wa.me/${SUPPORT_PHONE_WA}?text=${encodeURIComponent(SUPPORT_WA_MESSAGE)}`;
