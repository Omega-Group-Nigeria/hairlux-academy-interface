/**
 * HairLux Sign Up Page Handler
 * Handles multi-step registration form
 */

(function() {
  'use strict';

  // Wait for DOM to be fully loaded
  document.addEventListener('DOMContentLoaded', function() {
    
    // Get form elements
    const signupForm = document.getElementById('wf-form-Sign-Up');
    const step1 = document.getElementById('signup-step-1');
    const step2 = document.getElementById('signup-step-2');
    const stepTitle = document.getElementById('signup-step-title');
    const nextStepBtn = document.getElementById('next-step-btn');
    const prevStepBtn = document.getElementById('prev-step-btn');
    const submitBtn = document.getElementById('signup-submit-btn');
    const submitBtnDefaultLabel = (submitBtn && submitBtn.textContent)
      ? submitBtn.textContent.trim()
      : 'Sign Up';

    if (submitBtn) {
      submitBtn.dataset.defaultText = submitBtnDefaultLabel;
    }

    // Step 1 inputs
    const emailInput = document.getElementById('signup-email');
    const passwordInput = document.getElementById('signup-password');
    const confirmPasswordInput = document.getElementById('signup-confirm-password');

    // Step 2 inputs
    const firstNameInput = document.getElementById('signup-firstName');
    const lastNameInput = document.getElementById('signup-lastName');
    const phoneInput = document.getElementById('signup-phone');
    const referralCodeInput = document.getElementById('signup-referralCode');

    (function forwardReturnToOnLoginLink() {
      var returnTo = UIHelper.getQueryParam('returnTo');
      if (!returnTo) return;
      var loginLink = document.querySelector('a.link[href="log-in.html"]');
      if (loginLink) loginLink.href = 'log-in.html?returnTo=' + encodeURIComponent(returnTo);
    })();

    // If already logged in, refresh token and go straight to the app
    if (APIHelper.isAuthenticated()) {
      AuthAPI.refreshToken()
        .then(() => UIHelper.redirect(UIHelper.getPostAuthRedirect()))
        .catch(() => APIHelper.clearAuth());
    }

    /* ── Google Sign-In ─────────────────────────────────────────────────── */
    // Same backend endpoint as the login page — googleSignIn() on the
    // server handles both "create a new account" and "log in an existing
    // one" in a single call, so this one button covers both signup and
    // login without needing to know which the person actually wants.
    function initGoogleSignIn() {
      if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) {
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

    // Password toggle buttons
    const togglePasswordBtn = document.getElementById('toggle-password');
    const toggleConfirmPasswordBtn = document.getElementById('toggle-confirm-password');

    if (!signupForm) {
      console.error('Sign up form not found');
      return;
    }

    function resetSubmitButton() {
      if (!submitBtn) return;
      UIHelper.setButtonLoading(submitBtn, false);
      submitBtn.textContent = submitBtn.dataset.defaultText || submitBtnDefaultLabel;
    }

    // Password visibility toggle functionality
    togglePasswordBtn.addEventListener('click', function() {
      const type = passwordInput.type === 'password' ? 'text' : 'password';
      passwordInput.type = type;
      
      // Toggle eye icon (add slash for "hidden" state)
      const eyeIcon = document.getElementById('eye-icon');
      if (type === 'text') {
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line>';
      } else {
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
      }
    });

    toggleConfirmPasswordBtn.addEventListener('click', function() {
      const type = confirmPasswordInput.type === 'password' ? 'text' : 'password';
      confirmPasswordInput.type = type;
      
      // Toggle eye icon
      const eyeIcon = document.getElementById('eye-icon-confirm');
      if (type === 'text') {
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle><line x1="1" y1="1" x2="23" y2="23"></line>';
      } else {
        eyeIcon.innerHTML = '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>';
      }
    });

    // Handle Next button - Step 1 to Step 2
    nextStepBtn.addEventListener('click', function() {
      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const confirmPassword = confirmPasswordInput.value;

      // Validation for step 1
      if (!email || !password || !confirmPassword) {
        UIHelper.showToast('Please fill in all fields', 'error');
        return;
      }

      if (!UIHelper.isValidEmail(email)) {
        UIHelper.showToast('Please enter a valid email address', 'error');
        return;
      }

      const passwordValidation = UIHelper.validatePassword(password);
      if (!passwordValidation.isValid) {
        UIHelper.showToast(passwordValidation.message, 'error');
        return;
      }

      if (password !== confirmPassword) {
        UIHelper.showToast('Passwords do not match', 'error');
        return;
      }

      // Move to step 2
      step1.style.display = 'none';
      step2.style.display = 'block';
      stepTitle.textContent = 'One last step';
      UIHelper.showToast('Great, now complete your profile details.', 'info', 1800);
    });

    // Handle Back button - Step 2 to Step 1
    prevStepBtn.addEventListener('click', function() {
      step2.style.display = 'none';
      step1.style.display = 'block';
      stepTitle.textContent = 'Create an account';
    });

    // Handle form submission - Step 2
    signupForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const email = emailInput.value.trim();
      const password = passwordInput.value;
      const firstName = firstNameInput.value.trim();
      const lastName = lastNameInput.value.trim();
      const phone = phoneInput.value.trim();
      const referralCode = referralCodeInput ? referralCodeInput.value.trim() : '';

      // Validation for step 2
      if (!firstName || !lastName) {
        UIHelper.showToast('Please enter your first and last name', 'error');
        return;
      }

      // Show loading state
      submitBtn.dataset.originalText = submitBtn.dataset.defaultText || submitBtnDefaultLabel;
      UIHelper.setButtonLoading(submitBtn, true);

      try {
        const registrationData = { email, password, firstName, lastName };
        if (phone) registrationData.phone = phone;
        if (referralCode) registrationData.referralCode = referralCode;

        const response = await AuthAPI.register(registrationData);

        UIHelper.showToast(response.message || 'Account created! Check your email for the OTP.', 'success');
        signupForm.reset();

        // Show intermediate loading state before OTP modal
        const logoSection = document.querySelector('.logo-s');
        const formContainer = document.querySelector('.form-container');
        if (logoSection) {
          logoSection.innerHTML =
            '<img src="assets/img/logo.png" alt="HairLux" class="signup-brand-logo" />' +
            '<h1 class="h-m" id="signup-step-title">One last step</h1>' +
            '<p class="h-s" style="font-weight:400;margin-top:8px;margin-bottom:14px;">OTP is on its way to your email. Please wait...</p>' +
            '<img src="https://media.tenor.com/WX_LDjYUrMsAAAAj/loading.gif" style="width:40px;" alt="loading" />';
        }
        if (formContainer) formContainer.style.display = 'none';

        // Show OTP modal after a brief pause so the loading state is visible
        setTimeout(function() {
          showOtpModal(email);
        }, 1200);

      } catch (error) {
        console.error('Registration error:', error);
        let errorMessage = 'Registration failed. Please try again.';
        if (error.status === 409 || error.statusCode === 409) {
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('phone')) {
            errorMessage = 'This phone number is already associated with an account.';
          } else {
            errorMessage = 'This email is already registered. Please login instead.';
          }
        } else if (error.status === 400 || error.statusCode === 400) {
          errorMessage = error.message || 'Invalid registration data. Please check your inputs.';
        } else if (error.status === 0) {
          errorMessage = 'Network error. Please check your connection.';
        } else if (error.message) {
          errorMessage = Array.isArray(error.message) ? error.message.join(', ') : error.message;
        }
        UIHelper.showToast(errorMessage, 'error');
        resetSubmitButton();
      }
    });

    // If browser validation blocks submit, ensure button label does not remain in loading state.
    if (submitBtn) {
      submitBtn.addEventListener('click', function() {
        window.setTimeout(function() {
          if (!signupForm.checkValidity()) {
            resetSubmitButton();
          }
        }, 0);
      });
    }

    /* ── OTP Modal ─────────────────────────────────────────────────────────── */

    const otpModal      = document.getElementById('hl-otp-modal');
    const otpCloseBtn   = document.getElementById('hl-otp-close-btn');
    const otpVerifyBtn  = document.getElementById('hl-otp-verify-btn');
    const otpResendBtn  = document.getElementById('hl-otp-resend-btn');
    const otpCodeInput  = document.getElementById('hl-otp-code');
    const otpEmailDisp  = document.getElementById('hl-otp-email-display');
    const otpMsg        = document.getElementById('hl-otp-msg');
    const otpCountdown  = document.getElementById('hl-otp-countdown');

    var _otpEmail        = '';
    var _otpTimerHandle  = null;
    var _otpSecondsLeft  = 60;

    // Block backdrop click from closing the modal
    if (otpModal) {
      otpModal.addEventListener('click', function(e) {
        e.stopPropagation();
      });
    }

    // X button closes modal without verifying - Redirect to Login
    if (otpCloseBtn) {
      otpCloseBtn.addEventListener('click', function() {
        closeOtpModal();
        // If user closes OTP modal without verifying, clear any potential session and go to login
        APIHelper.clearAuth();
        var _returnTo = UIHelper.getQueryParam('returnTo');
        window.location.href = 'log-in.html' + (_returnTo ? '?returnTo=' + encodeURIComponent(_returnTo) : '');
      });
    }

    // Only allow digits in OTP input
    if (otpCodeInput) {
      otpCodeInput.addEventListener('input', function() {
        this.value = this.value.replace(/\D/g, '').slice(0, 6);
        setOtpMsg('', '');
      });
      otpCodeInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') otpVerifyBtn && otpVerifyBtn.click();
      });
    }

    // Verify OTP
    if (otpVerifyBtn) {
      otpVerifyBtn.addEventListener('click', async function() {
        const code = (otpCodeInput ? otpCodeInput.value : '').trim();
        if (!code || code.length < 4) {
          setOtpMsg('Please enter the OTP code from your email.', 'error');
          return;
        }

        otpVerifyBtn.disabled    = true;
        otpVerifyBtn.textContent = 'Verifying…';
        setOtpMsg('', '');

        try {
          await AuthAPI.verifyOtp({ email: _otpEmail, otpCode: code });
          setOtpMsg('Email verified! Taking you to your dashboard…', 'success');
          clearOtpTimer();
          setTimeout(function() {
            closeOtpModal();
            UIHelper.redirect(UIHelper.getPostAuthRedirect());
          }, 1000);
        } catch (err) {
          const msg = (err && err.message) ? err.message : 'Invalid or expired OTP. Please try again.';
          setOtpMsg(msg, 'error');
          otpVerifyBtn.disabled    = false;
          otpVerifyBtn.textContent = 'Verify & Continue';
        }
      });
    }

    // Resend OTP
    if (otpResendBtn) {
      otpResendBtn.addEventListener('click', async function() {
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
      if (otpModal) otpModal.classList.add('hl-otp-open');
      if (otpCodeInput) setTimeout(function() { otpCodeInput.focus(); }, 120);
      startOtpTimer();
    }

    function closeOtpModal() {
      if (otpModal) otpModal.classList.remove('hl-otp-open');
      clearOtpTimer();
    }

    function startOtpTimer() {
      clearOtpTimer();
      _otpSecondsLeft = 60;
      if (otpCountdown) otpCountdown.textContent = _otpSecondsLeft;
      if (otpResendBtn) {
        otpResendBtn.disabled    = true;
        otpResendBtn.textContent = 'Resend OTP (' + _otpSecondsLeft + 's)';
      }
      _otpTimerHandle = setInterval(function() {
        _otpSecondsLeft -= 1;
        if (otpCountdown) otpCountdown.textContent = _otpSecondsLeft;
        if (otpResendBtn) otpResendBtn.textContent = 'Resend OTP (' + _otpSecondsLeft + 's)';
        if (_otpSecondsLeft <= 0) {
          clearOtpTimer();
          if (otpResendBtn) {
            otpResendBtn.disabled    = false;
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
      otpMsg.className   = 'hl-otp-msg' + (type ? ' ' + type : '');
    }

  }); // DOMContentLoaded

})();
