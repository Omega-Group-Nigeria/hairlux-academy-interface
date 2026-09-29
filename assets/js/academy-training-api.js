/**
 * HairLux Academy In-Branch Training API Module
 * Handles all customer-facing browsing, registration, payment, identity
 * verification, and public status-lookup calls for Academy Training
 * (Build Roadmap Phase 2). Discount code validation lives in the shared
 * Academy Commerce Core, not this controller, so it's included here too
 * since Training is its only customer today.
 */

const AcademyTrainingAPI = {
  /**
   * Browse published trainings (public -- no auth required, but
   * APIHelper.request adds a token when one is present, which is fine).
   * @returns {Promise<Array>} array of AcademyTraining, each with curriculumModules
   */
  async getTrainings() {
    const res = await APIHelper.request(API_CONFIG.ENDPOINTS.ACADEMY_TRAINING.TRAININGS, { method: 'GET' });
    const d = (res && res.data) ? res.data : res;
    return Array.isArray(d) ? d : [];
  },

  /**
   * Browse open/full cohorts, optionally filtered by training.
   * @param {string} [trainingId]
   * @returns {Promise<Array>} array of AcademyCohort (with training + branch summaries)
   */
  async getCohorts(trainingId) {
    const qs = trainingId ? `?trainingId=${encodeURIComponent(trainingId)}` : '';
    const res = await APIHelper.request(API_CONFIG.ENDPOINTS.ACADEMY_TRAINING.COHORTS + qs, { method: 'GET' });
    const d = (res && res.data) ? res.data : res;
    return Array.isArray(d) ? d : [];
  },

  /**
   * Preview a discount code against a would-be order amount before
   * registering. Server re-validates for real at registration time
   * regardless -- this is UX only.
   * @param {string} code
   * @param {number} amount
   * @returns {Promise<object>} { code, name, type, discountAmount, finalAmount }
   */
  async validateDiscountCode(code, amount) {
    const res = await APIHelper.request(API_CONFIG.ENDPOINTS.ACADEMY_COMMERCE.DISCOUNT_VALIDATE, {
      method: 'POST',
      body: JSON.stringify({ code, programType: 'TRAINING', amount })
    });
    return (res && res.data) ? res.data : res;
  },

  /**
   * Register for a cohort. Auto-waitlists server-side if the cohort has
   * no capacity left -- always call this rather than branching on
   * cohort.status yourself.
   * @param {string} cohortId
   * @param {string} [discountCode]
   * @returns {Promise<object>} { registration, waitlisted, authorizationUrl, payment? }
   */
  async register(cohortId, discountCode) {
    const body = { cohortId };
    if (discountCode) body.discountCode = discountCode;
    const res = await APIHelper.request(API_CONFIG.ENDPOINTS.ACADEMY_TRAINING.REGISTRATIONS, {
      method: 'POST',
      body: JSON.stringify(body)
    });
    return (res && res.data) ? res.data : res;
  },

  /**
   * The calling learner's own in-branch registrations (My Training page),
   * newest first. Each row already carries a `stage` (PENDING_PAYMENT,
   * WAITLISTED, UPCOMING, IN_PROGRESS, COMPLETED, CLOSED), the cohort and
   * branch, schedule (next session), attendance and module progress.
   * @returns {Promise<Array>}
   */
  async listMyRegistrations() {
    const res = await APIHelper.request(API_CONFIG.ENDPOINTS.ACADEMY_TRAINING.REGISTRATIONS, { method: 'GET' });
    const d = (res && res.data) ? res.data : res;
    return Array.isArray(d) ? d : [];
  },

  /**
   * Fetch full registration detail (cohort, training, order+payment,
   * identity verification) for the calling user's own registration.
   * @param {string} registrationId
   */
  async getRegistration(registrationId) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_TRAINING.REGISTRATIONS}/${registrationId}`, { method: 'GET' });
    return (res && res.data) ? res.data : res;
  },

  /**
   * Explicitly move an existing registration onto its cohort's waitlist.
   * @param {string} registrationId
   */
  async joinWaitlist(registrationId) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_TRAINING.REGISTRATIONS}/${registrationId}/waitlist`, { method: 'POST' });
    return (res && res.data) ? res.data : res;
  },

  /**
   * Backend-only gateway re-verification after returning from Paystack.
   * The only path (besides Phase 1's own endpoint) that can confirm a
   * registration -- never trust the redirect query string alone.
   * @param {string} registrationId
   */
  async verifyPayment(registrationId) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_TRAINING.REGISTRATIONS}/${registrationId}/verify-payment`, { method: 'POST' });
    return (res && res.data) ? res.data : res;
  },

  /**
   * NIN identity verification for a confirmed registration.
   * @param {string} registrationId
   * @param {{nin:string, firstName:string, lastName:string}} identity
   */
  async verifyIdentity(registrationId, identity) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_TRAINING.REGISTRATIONS}/${registrationId}/verify-identity`, {
      method: 'POST',
      body: JSON.stringify(identity)
    });
    return (res && res.data) ? res.data : res;
  },

  /**
   * Public self-service status lookup by registration code + email --
   * no authentication needed, works for any past registration.
   * @param {string} code
   * @param {string} email
   */
  async lookupByCode(code, email) {
    const url = `${API_CONFIG.ENDPOINTS.ACADEMY_TRAINING.REGISTRATION_STATUS_BY_CODE}/${encodeURIComponent(code)}/status?email=${encodeURIComponent(email)}`;
    const res = await APIHelper.request(url, { method: 'GET' });
    return (res && res.data) ? res.data : res;
  },

  /**
   * The caller's own certificates across both Training and Courses --
   * filter the result by programType/programId for a specific cohort.
   * Shared commerce endpoint, same one AcademyCoursesAPI uses.
   */
  async listMyCertificates() {
    const res = await APIHelper.request(API_CONFIG.ENDPOINTS.ACADEMY_COMMERCE.CERTIFICATES, { method: 'GET' });
    return (res && res.data) ? res.data : res;
  }
};

// Export for non-browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AcademyTrainingAPI;
}
