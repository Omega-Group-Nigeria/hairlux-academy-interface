/**
 * HairLux Login Page Handler
 * Handles login form submission and authentication
 */

(function () {
  'use strict';

  // Wait for DOM to be fully loaded
  document.addEventListener('DOMContentLoaded', function () {

    // Get form elements
    const loginForm = document.getElementById('wf-form-Sign-In');

    if (!loginForm) {
      console.error('Login form not found');
      return;
    }

    const passwordInput = document.getElementById('Password-2');
    const togglePasswordBtn = document.getElementById('toggle-login-password');
    const eyeIconLogin = document.getElementById('eye-icon-login');

    if (togglePasswordBtn && passwordInput && eyeIconLogin) {
      togglePasswordBtn.addEventListener('click', function () {
        const type = passwordInput.type === 'password' ? 'text' : 'password';
        passwordInput.type = type;

        if (type === 'text') {
          eyeIconLogin.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line>';
        } else {
          eyeIconLogin.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
        }
      });
    }

    (function forwardReturnToOnSignupLink() {
      var returnTo = UIHelper.getQueryParam('returnTo');
      if (!returnTo) return;
      var signupLink = document.querySelector('a.link[href="sign-up.html"]');
      if (signupLink) signupLink.href = 'sign-up.html?returnTo=' + encodeURIComponent(returnTo);
    })();

    const authNotice = sessionStorage.getItem('hairlux_auth_notice');
    if (authNotice) {
      if (authNotice === 'logged-out') {
        UIHelper.showToast('You have been logged out.', 'info');
      } else if (authNotice === 'session-expired') {
        UIHelper.showToast('Session expired. Please log in again.', 'info');
      }
      sessionStorage.removeItem('hairlux_auth_notice');
    }

    // If already authenticated, attempt a quick refresh and continue to app
    if (APIHelper.isAuthenticated()) {
      AuthAPI.refreshToken()
        .then(() => UIHelper.redirect(UIHelper.getPostAuthRedirect()))
        .catch(() => APIHelper.clearAuth());
    }

    /* ── Google Sign-In ─────────────────────────────────────────────────── */
    function initGoogleSignIn() {
      if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
        // The GSI script loads async — retry shortly if it hasn't landed yet.
        setTimeout(initGoogleSignIn, 200);
        return;
      }
      google.accounts.id.initialize({
        client_id: API_CONFIG.GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      
      var container = document.getElementById('hl-google-btn-container');
      if (container) {
        google.accounts.id.renderButton(container, {
          theme: 'outline',
          size: 'large',
          width: 320,
          text: 'continue_with',
        });
      }
    }

    async function handleGoogleCredential(response) {
      var container = document.getElementById('hl-google-btn-container');
      try {
        var result = await AuthAPI.googleSignIn(response.credential);
        UIHelper.showToast(result.message || 'Signed in successfully!', 'success');
        setTimeout(function () {
          UIHelper.redirect(UIHelper.getPostAuthRedirect());
        }, 700);
      } catch (error) {
        console.error('Google sign-in error:', error);
        var errorMessage = 'Google sign-in failed. Please try again.';
        if (error.status === 401 && error.message) {
          errorMessage = error.message;
        } else if (error.status === 0) {
          errorMessage = 'Network error. Please check your connection.';
        } else if (error.message) {
          errorMessage = error.message;
        }
        UIHelper.showToast(errorMessage, 'error');
      }
    }

    initGoogleSignIn();

    // Handle form submission
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      // Get form data
      const emailInput = document.getElementById('Email-7');
      const submitButton = loginForm.querySelector('input[type="submit"]');

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // Validation
      if (!email || !password) {
        UIHelper.showToast('Please fill in all fields', 'error');
        return;
      }

      if (!UIHelper.isValidEmail(email)) {
        UIHelper.showToast('Please enter a valid email address', 'error');
        return;
      }

      // Show loading state
      UIHelper.setButtonLoading(submitButton, true);

      try {
        // Call login API
        const response = await AuthAPI.login({
          email: email,
          password: password
        });

        UIHelper.showToast(response.message || 'Login successful!', 'success');

        // Log user data for debugging
        console.log('Login successful:', response.data);
        setTimeout(() => {
          UIHelper.redirect(UIHelper.getPostAuthRedirect());
        }, 700);

      } catch (error) {
        console.error('Login error:', error);

        // Show error alert
        let errorMessage = 'Login failed. Please try again.';

        if (error.status === 401) {
          // Check for specific inactive account message
          if (error.message === 'Your account is inactive. Please contact support.') {
            errorMessage = error.message;
          } else if (error.message === 'Please verify your email before logging in. Check your email for the OTP code.') {
            // Show OTP modal and stop error flow
            showOtpModal(email);
            return;
          } else {
            errorMessage = 'Invalid email or password';
          }
        } else if (error.status === 0) {
          errorMessage = 'Network error. Please check your connection.';
        } else if (error.message) {
          errorMessage = error.message;
        }

        UIHelper.showToast(errorMessage, 'error');

      } finally {
        // Remove loading state
        UIHelper.setButtonLoading(submitButton, false);
      }
    });

    /* ── OTP Modal Logic ───────────────────────────────────────────────────── */
    const otpModal = document.getElementById('hl-otp-modal');
    const otpCloseBtn = document.getElementById('hl-otp-close-btn');
    const otpVerifyBtn = document.getElementById('hl-otp-verify-btn');
    const otpResendBtn = document.getElementById('hl-otp-resend-btn');
    const otpCodeInput = document.getElementById('hl-otp-code');
    const otpEmailDisp = document.getElementById('hl-otp-email-display');
    const otpMsg = document.getElementById('hl-otp-msg');
    const otpCountdown = document.getElementById('hl-otp-countdown');

    var _otpEmail = '';
    var _otpTimerHandle = null;
    var _otpSecondsLeft = 60;

    if (otpModal) {
      otpModal.addEventListener('click', function (e) { e.stopPropagation(); });
    }

    if (otpCloseBtn) {
      otpCloseBtn.addEventListener('click', function () {
        closeOtpModal();
      });
    }

    if (otpCodeInput) {
      otpCodeInput.addEventListener('input', function () {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
        setOtpMsg('', '');
      });
      otpCodeInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') otpVerifyBtn && otpVerifyBtn.click();
      });
    }

    if (otpVerifyBtn) {
      otpVerifyBtn.addEventListener('click', async function () {
        const code = (otpCodeInput ? otpCodeInput.value : '').trim();
        if (!code || code.length < 4) {
          setOtpMsg('Please enter the OTP code from your email.', 'error');
          return;
        }

        otpVerifyBtn.disabled = true;
        otpVerifyBtn.textContent = 'Verifying…';
        setOtpMsg('', '');

        try {
          await AuthAPI.verifyOtp({ email: _otpEmail, otpCode: code });
          setOtpMsg('Email verified! taking you to dashboard...', 'success');
          clearOtpTimer();
          setTimeout(function () {
            closeOtpModal();
            UIHelper.redirect(UIHelper.getPostAuthRedirect());
          }, 1000);
        } catch (err) {
          const msg = (err && err.message) ? err.message : 'Invalid or expired OTP. Please try again.';
          setOtpMsg(msg, 'error');
          otpVerifyBtn.disabled = false;
          otpVerifyBtn.textContent = 'Verify & Continue';
        }
      });
    }

    if (otpResendBtn) {
      otpResendBtn.addEventListener('click', async function () {
        if (otpResendBtn.disabled) return;
        otpResendBtn.disabled = true;
        setOtpMsg('', '');

        try {
          await AuthAPI.resendOtp(_otpEmail);
          setOtpMsg('A new OTP has been sent to your email.', 'success');
          if (otpCodeInput) otpCodeInput.value = '';
          startOtpTimer();
        } catch (err) {
          const msg = (err && err.message) ? err.message : 'Could not resend OTP. Please try again.';
          setOtpMsg(msg, 'error');
          otpResendBtn.disabled = false;
        }
      });
    }

    function showOtpModal(email) {
      _otpEmail = email;
      if (otpEmailDisp) otpEmailDisp.textContent = email;
      if (otpCodeInput) otpCodeInput.value = '';
      setOtpMsg('', '');
      if (otpVerifyBtn) { otpVerifyBtn.disabled = false; otpVerifyBtn.textContent = 'Verify & Continue'; }
      if (otpModal) {
        otpModal.style.display = 'flex'; // Override inline style from HTML
        otpModal.classList.add('hl-otp-open');
      }
      if (otpCodeInput) setTimeout(function () { otpCodeInput.focus(); }, 120);
      startOtpTimer();
    }

    function closeOtpModal() {
      if (otpModal) {
        otpModal.classList.remove('hl-otp-open');
        otpModal.style.display = 'none';
      }
      clearOtpTimer();
    }

    function startOtpTimer() {
      clearOtpTimer();
      _otpSecondsLeft = 60;
      if (otpCountdown) otpCountdown.textContent = _otpSecondsLeft;
      if (otpResendBtn) {
        otpResendBtn.disabled = true;
        otpResendBtn.textContent = 'Resend OTP (' + _otpSecondsLeft + 's)';
      }
      _otpTimerHandle = setInterval(function () {
        _otpSecondsLeft -= 1;
        if (otpCountdown) otpCountdown.textContent = _otpSecondsLeft;
        if (otpResendBtn) otpResendBtn.textContent = 'Resend OTP (' + _otpSecondsLeft + 's)';
        if (_otpSecondsLeft <= 0) {
          clearOtpTimer();
          if (otpResendBtn) {
            otpResendBtn.disabled = false;
            otpResendBtn.textContent = 'Resend OTP';
          }
        }
      }, 1000);
    }

    function clearOtpTimer() {
      if (_otpTimerHandle) { clearInterval(_otpTimerHandle); _otpTimerHandle = null; }
    }

    function setOtpMsg(text, type) {
      if (!otpMsg) return;
      otpMsg.textContent = text;
      otpMsg.className = 'hl-otp-msg' + (type ? ' ' + type : '');
      otpMsg.style.display = text ? 'block' : 'none';
    }

  });

})();
