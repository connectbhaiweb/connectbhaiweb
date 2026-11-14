import * as Joi from 'joi';

/** Validates process.env at boot. The app refuses to start with a bad/missing config. */
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  APP_ENV: Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
  PORT: Joi.number().port().default(4000),
  API_PREFIX: Joi.string().default('api/v1'),
  FRONTEND_URL: Joi.string().default('http://localhost:3000'),
  /** reverse geocoder for "Use my current location" (Nominatim-compatible: GET ?format=jsonv2&lat=&lon=&addressdetails=1). Use a paid/self-hosted one at scale. */
  /** India Post PIN directory used by the forms' PIN lookup */
  PINCODE_API_URL: Joi.string().uri().default('https://api.postalpincode.in/pincode'),
  GEOCODER_URL: Joi.string().uri().default('https://nominatim.openstreetmap.org/reverse'),
  GEOCODER_USER_AGENT: Joi.string().default('ConnectBhai/1.0 (support@connectbhai.in)'),
  GEOCODER_TIMEOUT_MS: Joi.number().integer().min(500).max(15000).default(5000),
  SWAGGER_ENABLED: Joi.boolean().default(false),
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'log', 'debug', 'verbose').default('log'),
  THROTTLE_TTL_SECONDS: Joi.number().default(60),
  THROTTLE_LIMIT: Joi.number().default(300),
  THROTTLE_ENABLED: Joi.boolean().default(true),

  DATABASE_URL: Joi.string().uri({ scheme: ['mysql'] }).required(),

  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  OTP_TTL_MINUTES: Joi.number().default(5),
  OTP_MAX_ATTEMPTS: Joi.number().default(5),
  OTP_DEV_CODE: Joi.string().pattern(/^\d{4,8}$/).allow('').default(''),

  // Fees, GST % and auto-assign are NOT env settings: they live in the app_settings table (Admin > Settings).
  GST_HOME_STATE_CODE: Joi.string().length(2).default('23'),

  DATA_ENCRYPTION_KEY: Joi.string().hex().length(64).required(),

  RAZORPAY_KEY_ID: Joi.string().allow('').default(''),
  RAZORPAY_KEY_SECRET: Joi.string().allow('').default(''),
  RAZORPAY_WEBHOOK_SECRET: Joi.string().allow('').default(''),
  WHATSAPP_API_URL: Joi.string().allow('').default(''),
  WHATSAPP_API_TOKEN: Joi.string().allow('').default(''),
  /** every upload (KYC, tickets, chat, logos, sheets) goes to Cloudinary */
  CLOUDINARY_CLOUD_NAME: Joi.string().allow('').default(''),
  CLOUDINARY_API_KEY: Joi.string().allow('').default(''),
  CLOUDINARY_API_SECRET: Joi.string().allow('').default(''),
  /** where Cloudinary serves images from (change for a custom domain / CDN) and where the upload + download API lives */
  CLOUDINARY_DELIVERY_URL: Joi.string().uri().default('https://res.cloudinary.com'),
  CLOUDINARY_API_URL: Joi.string().uri().default('https://api.cloudinary.com/v1_1'),
  PAYMENT_REMINDER_MINUTES: Joi.number().min(0).max(10080).default(30),   // minutes after a TIP registers before the unpaid-fee WhatsApp reminder
  FEEDBACK_DELAY_HOURS: Joi.number().min(0).max(240).default(24),   // hours after installation before the feedback WhatsApp is sent
  UPLOAD_MAX_MB: Joi.number().integer().min(1).max(25).default(5),
  AISENSY_API_KEY: Joi.string().allow('').default(''),
  GENIEACS_NBI_URL: Joi.string().allow('').default(''),
  GENIEACS_API_TOKEN: Joi.string().allow('').default(''),
  GENIEACS_USERNAME: Joi.string().allow('').default(''),
  GENIEACS_PASSWORD: Joi.string().allow('').default(''),
  SPEEDTEST_FILE_URL: Joi.string().uri().allow('').default(''),   // plain-http test file the modem downloads (default http://speedtest.tele2.net/10MB.zip)
  SPEEDTEST_PING_HOST: Joi.string().allow('').default(''),
  /** read by prisma/seed.ts only; listed so a typo shows at boot */
  SEED_ADMIN_PHONE: Joi.string().pattern(/^\d{10}$/).allow('').default(''),
  SEED_ADMIN_PASSWORD: Joi.string().allow('').default(''),
  SEED_DEMO_PASSWORD: Joi.string().allow('').default(''),
  SEED_SAMPLE_PARTNERS: Joi.boolean().default(true),
  CARE_PLAN_SYNC_MINUTES: Joi.number().min(0).default(10),   // how often every linked modem is read from GenieACS (0 = off)
})
  .unknown(true)
  .custom((v, helpers) => {
    if (v.APP_ENV === 'production') {
      if (/change-me/i.test(v.JWT_SECRET) || /change-me/i.test(v.JWT_REFRESH_SECRET)) return helpers.message({ custom: 'JWT secrets must be changed in production' } as any);
      if (/^0+$/.test(v.DATA_ENCRYPTION_KEY)) return helpers.message({ custom: 'DATA_ENCRYPTION_KEY must be set in production' } as any);
      if (v.SEED_ADMIN_PASSWORD === 'Admin@12345') return helpers.message({ custom: 'SEED_ADMIN_PASSWORD must not be the default in production' } as any);
      if (v.OTP_DEV_CODE) return helpers.message({ custom: 'OTP_DEV_CODE must be empty in production' } as any);
      if (!v.CLOUDINARY_CLOUD_NAME || !v.CLOUDINARY_API_KEY || !v.CLOUDINARY_API_SECRET) return helpers.message({ custom: 'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET are required in production (all uploads go to Cloudinary)' } as any);
    }
    return v;
  }, 'production safety checks');
