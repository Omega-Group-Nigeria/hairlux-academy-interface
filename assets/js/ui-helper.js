/**
 * HairLux UI Utilities
 * Helper functions for UI interactions and notifications
 */

const UIHelper = {
  /**
   * Ensure global toast container exists
   * @returns {HTMLElement} Toast container element
   */
  ensureToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('aria-atomic', 'true');
      document.body.appendChild(container);
    }
    return container;
  },

  /**
   * Show toast notification
   * @param {string} message - Toast message
   * @param {'success'|'error'|'info'} type - Toast type
   * @param {number} duration - Duration in milliseconds
   */
  showToast(message, type = 'info', duration = 3200) {
    const container = this.ensureToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    window.setTimeout(() => {
      toast.classList.add('hide');
      window.setTimeout(() => {
        if (toast.parentNode) toast.remove();
      }, 220);
    }, duration);
  },

  /**
   * Show loading state on button
   * @param {HTMLElement} button - Button element
   * @param {boolean} isLoading - Loading state
   */
  setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.disabled = true;
      button.dataset.originalText = button.value || button.textContent;
      if (button.tagName === 'INPUT') {
        button.value = 'Please wait...';
      } else {
        button.textContent = 'Please wait...';
      }
    } else {
      button.disabled = false;
      if (button.tagName === 'INPUT') {
        button.value = button.dataset.originalText || 'Submit';
      } else {
        button.textContent = button.dataset.originalText || 'Submit';
      }
    }
  },

  /**
   * Show error message in form
   * @param {HTMLElement} form - Form element
   * @param {string} message - Error message
   */
  showFormError(form, message) {
    const errorDiv = form.querySelector('.w-form-fail');
    if (errorDiv) {
      errorDiv.querySelector('div').textContent = message;
      errorDiv.style.display = 'block';
      
      // Hide success message if visible
      const successDiv = form.querySelector('.w-form-done');
      if (successDiv) {
        successDiv.style.display = 'none';
      }
    }
  },

  /**
   * Show success message in form
   * @param {HTMLElement} form - Form element
   * @param {string} message - Success message
   */
  showFormSuccess(form, message) {
    const successDiv = form.querySelector('.w-form-done');
    if (successDiv) {
      successDiv.querySelector('div').textContent = message;
      successDiv.style.display = 'block';
      
      // Hide error message if visible
      const errorDiv = form.querySelector('.w-form-fail');
      if (errorDiv) {
        errorDiv.style.display = 'none';
      }
    }
  },

  /**
   * Hide all form messages
   * @param {HTMLElement} form - Form element
   */
  hideFormMessages(form) {
    const errorDiv = form.querySelector('.w-form-fail');
    const successDiv = form.querySelector('.w-form-done');
    
    if (errorDiv) errorDiv.style.display = 'none';
    if (successDiv) successDiv.style.display = 'none';
  },

  /**
   * Validate email format
   * @param {string} email - Email address
   * @returns {boolean} Validation result
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate password strength
   * @param {string} password - Password
   * @returns {object} Validation result with isValid and message
   */
  validatePassword(password) {
    if (password.length < 8) {
      return {
        isValid: false,
        message: 'Password must be at least 8 characters long'
      };
    }

    if (!/[A-Z]/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one uppercase letter'
      };
    }

    if (!/[a-z]/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one lowercase letter'
      };
    }

    if (!/[0-9]/.test(password)) {
      return {
        isValid: false,
        message: 'Password must contain at least one number'
      };
    }

    return {
      isValid: true,
      message: 'Password is strong'
    };
  },

  /**
   * Redirect to page
   * @param {string} url - Page URL
   */
  redirect(url) {
    window.location.href = url;
  },

  /**
   * Where to send the user after a successful login/signup: the ?returnTo=
   * query param when the login/signup page was reached from a guest-browsable
   * page (course/training catalogue or detail) trying to enroll/register,
   * or the normal dashboard otherwise. Only ever a root-relative in-site path
   * (e.g. "app/course-detail.html?id=..."), never an absolute/external URL,
   * to avoid turning this into an open redirect.
   * @returns {string}
   */
  getPostAuthRedirect() {
    const raw = this.getQueryParam('returnTo');
    const fallback = 'app/index.html';
    if (!raw) return fallback;
    try {
      const decoded = decodeURIComponent(raw);
      if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded) || decoded.indexOf('//') === 0) {
        return fallback; // absolute / protocol-relative URL -- refuse it
      }
      return decoded;
    } catch (_) {
      return fallback;
    }
  },

  /**
   * Get query parameter from URL
   * @param {string} param - Parameter name
   * @returns {string|null} Parameter value
   */
  getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
  },

  /**
   * Show/hide password toggle
   * @param {HTMLInputElement} passwordInput - Password input field
   * @param {HTMLElement} toggleButton - Toggle button element
   */
  setupPasswordToggle(passwordInput, toggleButton) {
    toggleButton.addEventListener('click', (e) => {
      e.preventDefault();
      
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleButton.textContent = 'Hide';
      } else {
        passwordInput.type = 'password';
        toggleButton.textContent = 'Show';
      }
    });
  }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UIHelper;
}
