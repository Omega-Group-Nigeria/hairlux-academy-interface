/**
 * HairLux API Library - Authentication Module
 * Handles all authentication-related API calls
 */

// API Helper Functions
const APIHelper = {
  isTokenAuthError(status, data) {
    const message = String(
      (data && (data.message || data.error || data.detail)) || ''
    ).toLowerCase();

    if (status === 401) return true;
    if (status === 403 && /(token|jwt|auth|unauthorized|expired|invalid)/.test(message)) return true;
    return /(invalid|expired)\s*(access\s*)?(token|jwt)/.test(message);
  },

  forceLogout(reason) {
    this.clearAuth();

    if (typeof window === 'undefined') return;

    try {
      if (reason) {
        sessionStorage.setItem('hairlux_auth_notice', reason);
      }
    } catch (_) {
      // Ignore storage access errors.
    }

    const path = window.location.pathname || '';
    if (/\/log-in\.html$/i.test(path)) return;

    const loginPage = /\/app(\/|$)/i.test(path) ? '../log-in.html' : 'log-in.html';
    window.location.href = loginPage;
  },

  /**
   * Make an HTTP request to the API
   * @param {string} endpoint - API endpoint path
   * @param {object} options - Request options
   * @returns {Promise<object>} API response
   */
  async request(endpoint, options = {}, _isRetry = false) {
    const url = `${API_CONFIG.BASE_URL}${endpoint}`;
    const isAuthEndpoint = endpoint.startsWith('/auth/');

    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json'
      }
    };

    // Add authorization token for protected endpoints only
    const token = this.getToken();
    if (token && !isAuthEndpoint) {
      defaultOptions.headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers
      }
    };

    try {
      console.log('Making request to:', url);
      console.log('Request config:', config);

      const response = await fetch(url, config);
      console.log('Response received:', response);

      let data = null;
      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const text = await response.text();
        data = text ? { message: text } : {};
      }
      console.log('Response data:', data);

      const isTokenError = !isAuthEndpoint && this.isTokenAuthError(response.status, data);

      if (isTokenError && !_isRetry) {
        const refreshToken = this.getRefreshToken();
        if (refreshToken) {
          try {
            await AuthAPI.refreshToken();
            return await this.request(endpoint, options, true);
          } catch (refreshError) {
            const refreshStatus = refreshError && refreshError.status;
            const refreshData = refreshError && refreshError.data;
            if (this.isTokenAuthError(refreshStatus, refreshData || refreshError)) {
              this.forceLogout('session-expired');
            }
            throw refreshError;
          }
        }

        this.forceLogout('session-expired');
      }

      if (isTokenError && _isRetry) {
        this.forceLogout('session-expired');
      }

      if (!response.ok) {
        throw {
          status: response.status,
          message: data.message || 'An error occurred',
          data: data
        };
      }

      return data;
    } catch (error) {
      console.error('Request error:', error);

      // Handle network errors (CORS, connection refused, etc.)
      if (!error.status) {
        // Check if it's a CORS error
        if (error.message && error.message.includes('fetch')) {
          throw {
            status: 0,
            message: 'CORS error or server not reachable. Make sure your API server is running and CORS is enabled.',
            data: null
          };
        }
        throw {
          status: 0,
          message: 'Network error. Please check your connection and ensure the API server is running.',
          data: null
        };
      }
      throw error;
    }
  },

  /**
   * Get access token from local storage
   * @returns {string|null} Access token
   */
  getToken() {
    return localStorage.getItem(API_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
  },

  /**
   * Get refresh token from local storage
   * @returns {string|null} Refresh token
   */
  getRefreshToken() {
    return localStorage.getItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
  },

  /**
   * Save tokens to local storage
   * @param {string} accessToken - Access token
   * @param {string} refreshToken - Refresh token
   */
  saveTokens(accessToken, refreshToken) {
    localStorage.setItem(API_CONFIG.STORAGE_KEYS.ACCESS_TOKEN, accessToken);
    localStorage.setItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
  },

  /**
   * Save user data to local storage
   * @param {object} userData - User data object
   */
  saveUserData(userData) {
    localStorage.setItem(API_CONFIG.STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
  },

  /**
   * Get user data from local storage
   * @returns {object|null} User data
   */
  getUserData() {
    const data = localStorage.getItem(API_CONFIG.STORAGE_KEYS.USER_DATA);
    return data ? JSON.parse(data) : null;
  },

  /**
   * Clear all authentication data
   */
  clearAuth() {
    localStorage.removeItem(API_CONFIG.STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(API_CONFIG.STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(API_CONFIG.STORAGE_KEYS.USER_DATA);
  },

  /**
   * Check if user is authenticated
   * @returns {boolean} Authentication status
   */
  isAuthenticated() {
    return !!this.getToken();
  }
};

// Authentication API
const AuthAPI = {
  /**
   * Register a new user
   * @param {object} userData - User registration data
   * @param {string} userData.email - User email
   * @param {string} userData.password - User password
   * @param {string} userData.firstName - User first name
   * @param {string} userData.lastName - User last name
   * @param {string} [userData.phone] - User phone number (optional)
   * @returns {Promise<object>} Registration response
   */
  async register(userData) {
    const response = await APIHelper.request(API_CONFIG.ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      body: JSON.stringify(userData)
    });

    // Save tokens and user data
    if (response && response.data && response.data.accessToken && response.data.refreshToken) {
      APIHelper.saveTokens(response.data.accessToken, response.data.refreshToken);
      if (response.data.user) {
        APIHelper.saveUserData(response.data.user);
      }
    }

    return response;
  },

  /**
   * Login user
   * @param {object} credentials - Login credentials
   * @param {string} credentials.email - User email
   * @param {string} credentials.password - User password
   * @returns {Promise<object>} Login response
   */
  async login(credentials) {
    const response = await APIHelper.request(API_CONFIG.ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify(credentials)
    });

    // Save tokens and user data
    if (response && response.data && response.data.accessToken && response.data.refreshToken) {
      APIHelper.saveTokens(response.data.accessToken, response.data.refreshToken);
      if (response.data.user) {
        APIHelper.saveUserData(response.data.user);
      }
    }

    return response;
  },

  /**
   * Sign in or sign up with Google
   * @param {string} idToken - The ID token returned by Google Sign-In
   * @returns {Promise<object>} Login response — same shape as login()
   */
  async googleSignIn(idToken) {
    const response = await APIHelper.request(API_CONFIG.ENDPOINTS.AUTH.GOOGLE, {
      method: 'POST',
      body: JSON.stringify({ idToken: idToken })
    });

    // Save tokens and user data — identical handling to login()
    if (response && response.data && response.data.accessToken && response.data.refreshToken) {
      APIHelper.saveTokens(response.data.accessToken, response.data.refreshToken);
      if (response.data.user) {
        APIHelper.saveUserData(response.data.user);
      }
    }

    return response;
  },

  /**
   * Logout user (clear local storage)
   */
  logout() {
    APIHelper.clearAuth();
  },

  /**
   * Refresh access token
   * @returns {Promise<object>} Refresh token response
   */
  async refreshToken() {
    const refreshToken = APIHelper.getRefreshToken();

    if (!refreshToken) {
      throw {
        status: 401,
        message: 'No refresh token available',
        data: null
      };
    }

    const response = await APIHelper.request(API_CONFIG.ENDPOINTS.AUTH.REFRESH_TOKEN, {
      method: 'POST',
      body: JSON.stringify({ refreshToken })
    }, true);

    // Save refreshed token(s). Some backends return only accessToken on refresh.
    const responseData = response && response.data ? response.data : response;
    const newAccessToken = responseData && responseData.accessToken;
    const newRefreshToken = responseData && responseData.refreshToken;

    if (newAccessToken) {
      APIHelper.saveTokens(newAccessToken, newRefreshToken || refreshToken);
    }

    return response;
  },

  /**
   * Request password reset
   * @param {string} email - User email address
   * @returns {Promise<object>} Forgot password response
   */
  async forgotPassword(email) {
    return await APIHelper.request(API_CONFIG.ENDPOINTS.AUTH.FORGOT_PASSWORD, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  /**
   * Reset password with token
   * @param {object} resetData - Reset password data
   * @param {string} resetData.token - Password reset token
   * @param {string} resetData.newPassword - New password
   * @returns {Promise<object>} Reset password response
   */
  async resetPassword(resetData) {
    return await APIHelper.request(API_CONFIG.ENDPOINTS.AUTH.RESET_PASSWORD, {
      method: 'POST',
      body: JSON.stringify(resetData)
    });
  },

  /**
   * Verify email with OTP code
   * @param {object} otpData - OTP verification data
   * @param {string} otpData.email - User email
   * @param {string} otpData.otpCode - 6-digit OTP code
   * @returns {Promise<object>} Verify OTP response
   */
  async verifyOtp(otpData) {
    const response = await APIHelper.request(API_CONFIG.ENDPOINTS.AUTH.VERIFY_OTP, {
      method: 'POST',
      body: JSON.stringify(otpData)
    });

    // Save tokens and user data if returned
    const data = response && response.data ? response.data : response;
    if (data && data.accessToken && data.refreshToken) {
      APIHelper.saveTokens(data.accessToken, data.refreshToken);
      if (data.user) {
        APIHelper.saveUserData(data.user);
      }
    }

    return response;
  },

  /**
   * Resend OTP verification code
   * @param {string} email - User email address
   * @returns {Promise<object>} Resend OTP response
   */
  async resendOtp(email) {
    return await APIHelper.request(API_CONFIG.ENDPOINTS.AUTH.RESEND_OTP, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  /**
   * Get current authentication status
   * @returns {object} Auth status object
   */
  getAuthStatus() {
    return {
      isAuthenticated: APIHelper.isAuthenticated(),
      user: APIHelper.getUserData(),
      token: APIHelper.getToken()
    };
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AuthAPI, APIHelper };
}
