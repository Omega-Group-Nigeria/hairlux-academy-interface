function getRuntimeGoogleMapsKey() {
  if (typeof window === 'undefined') return '';

  var publicConfig = window.__HAIRLUX_PUBLIC_CONFIG__;
  if (publicConfig && typeof publicConfig.googleMapsKey === 'string') {
    var runtimeKey = publicConfig.googleMapsKey.trim();
    if (runtimeKey) return runtimeKey;
  }

  var meta = document.querySelector('meta[name="hairlux-google-maps-key"]');
  return meta ? String(meta.getAttribute('content') || '').trim() : '';
}

// API Configuration
const API_CONFIG = {
  BASE_URL: 'https://api.hairlux.com.ng',
  // BASE_URL: 'https://dev-hairlux-api.up.railway.app',
  // BASE_URL: 'http://localhost:3000',

  // Public Google OAuth Client ID (not the Client Secret — that's never exposed in client-side code)
  GOOGLE_CLIENT_ID: '696072592207-g6irgnk1v9jjgvrlcmhd1bfr3frqn7ip.apps.googleusercontent.com',

  // Local storage keys
  STORAGE_KEYS: {
    ACCESS_TOKEN: 'hairlux_access_token',
    REFRESH_TOKEN: 'hairlux_refresh_token',
    USER_DATA: 'hairlux_user_data',
    APPLICANT_TOKEN: 'hairlux_applicant_token',
  },

  // API Endpoints
  ENDPOINTS: {
    AUTH: {
      REGISTER: '/auth/register',
      LOGIN: '/auth/login',
      GOOGLE: '/auth/google',
      REFRESH_TOKEN: '/auth/refresh-token',
      FORGOT_PASSWORD: '/auth/forgot-password',
      RESET_PASSWORD: '/auth/reset-password',
      VERIFY_OTP: '/auth/verify-otp',
      RESEND_OTP: '/auth/resend-otp'
    },
    USER: {
      PROFILE: '/user/profile',
      PASSWORD: '/user/password',
      ADDRESSES: '/user/addresses',
      PHONE_REQUEST_OTP: '/user/phone/request-otp',
      PHONE_VERIFY_OTP: '/user/phone/verify-otp',
      SET_PASSWORD: '/user/set-password'
    },
    SERVICES: '/services',
    JOBS: '/jobs',
    NIN_VERIFY: '/applications/verify-nin',
    APPLICATIONS: '/applications',
    BRANCHES: '/branches',
    SERVICES_CATEGORIES: '/services/categories',
    BOOKINGS: '/bookings',
    BRANCHES: '/branches',
    BOOKING_PAYMENTS: {
      BASE: '/bookings/payments',
      INITIALIZE: '/bookings/payments/initialize',
      VERIFY: '/bookings/payments/verify'
    },
    REFERRALS: '/referrals/me',
    REFERRALS_HISTORY: '/referrals/me/history',
    BOOKINGS_BUSINESS_HOURS: '/bookings/business-hours',
    BOOKINGS_BUSINESS_EXCEPTIONS: '/bookings/business-exceptions',
    DISCOUNTS_VALIDATE: '/discounts/validate',
    WALLET: '/wallet',
    STATS: '/stats',
    INFLUENCER: {
      ME: '/influencer/me',
      CODES: '/influencer/me/codes',
      REWARDS: '/influencer/me/rewards'
    },
    REWARDS_PROGRAM: {
      PROFILE: '/rewards/profile',
      TRANSACTIONS: '/rewards/transactions',
      TRANSFER: '/rewards/transfer',
      REDEEM_POINTS: '/rewards/redeem-points',
      BIRTHDAY: '/rewards/birthday'
    },
    ACADEMY_TRAINING: {
      TRAININGS: '/academy/trainings',
      COHORTS: '/academy/cohorts',
      REGISTRATIONS: '/academy/registrations',
      REGISTRATION_STATUS_BY_CODE: '/academy/registrations/code'
    },
    ACADEMY_COMMERCE: {
      DISCOUNT_VALIDATE: '/commerce/discount-codes/validate',
      CERTIFICATES: '/commerce/certificates'
    },
    FREE_RESOURCES: {
      BASE: '/academy/free-resources' // GET list; POST /:idOrSlug/download (public, lead form)
    },
    ACADEMY_COURSES: {
      COURSES: '/academy/courses',
      COURSE_REVIEWS: '/academy/courses',
      PURCHASE: '/academy/courses',
      COURSE_ORDERS: '/academy/course-orders',
      COURSE_ACCESS: '/academy/course-access',
      PROGRESS: '/academy/courses',
      ASSESSMENTS: '/academy/assessments'
    }
  },

  // Public browser key for Maps JavaScript API.
  // Set at runtime via window.__HAIRLUX_PUBLIC_CONFIG__.googleMapsKey
  // or <meta name="hairlux-google-maps-key" content="...">.
  MAPS: {
    GOOGLE_PUBLIC_KEY: getRuntimeGoogleMapsKey()
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = API_CONFIG;
}
