/**
 * AcademyCoursesAPI -- shared client for Academy Digital Courses
 * (Build Roadmap Phase 4 / frontend Phase 3): public catalogue browsing,
 * purchase + payment verification, course access & progress, timed
 * assessment attempts, and reviews.
 *
 * Mirrors AcademyTrainingAPI's shape exactly (same IIFE-module pattern,
 * same APIHelper.request usage, same "return res.data ?? res" unwrap
 * for endpoints that don't wrap their payload).
 */
const AcademyCoursesAPI = {
  // ── Public browsing (no auth) ─────────────────────────────────────
  async listCourses(filters) {
    const params = new URLSearchParams();
    if (filters && filters.category) params.set('category', filters.category);
    if (filters && filters.level) params.set('level', filters.level);
    const qs = params.toString();
    const res = await APIHelper.request(API_CONFIG.ENDPOINTS.ACADEMY_COURSES.COURSES + (qs ? `?${qs}` : ''));
    return (res && res.data) ? res.data : res;
  },

  async getCourse(courseId) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COURSES.COURSES}/${courseId}`);
    return (res && res.data) ? res.data : res;
  },

  async listReviews(courseId) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COURSES.COURSES}/${courseId}/reviews`);
    return (res && res.data) ? res.data : res;
  },

  // ── Purchase ───────────────────────────────────────────────────────
  async purchase(courseId, discountCode) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COURSES.PURCHASE}/${courseId}/purchase`, {
      method: 'POST',
      body: JSON.stringify(discountCode ? { discountCode } : {})
    });
    return (res && res.data) ? res.data : res;
  },

  async verifyPayment(orderId) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COURSES.COURSE_ORDERS}/${orderId}/verify-payment`, {
      method: 'POST'
    });
    return (res && res.data) ? res.data : res;
  },

  // ── Access & progress ────────────────────────────────────────────
  async listMyAccess() {
    const res = await APIHelper.request(API_CONFIG.ENDPOINTS.ACADEMY_COURSES.COURSE_ACCESS);
    return (res && res.data) ? res.data : res;
  },

  async getProgress(courseId) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COURSES.PROGRESS}/${courseId}/progress`);
    return (res && res.data) ? res.data : res;
  },

  async markLessonComplete(courseId, lessonId) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COURSES.PROGRESS}/${courseId}/progress`, {
      method: 'POST',
      body: JSON.stringify({ lessonId })
    });
    return (res && res.data) ? res.data : res;
  },

  // A locked lesson's public contentKey/resources are stripped from
  // getCourse()'s response; this gated call returns the real values for a
  // lesson the caller has active access to (previewAvailable lessons never
  // need this -- their content is already inline in getCourse()).
  async getLessonContent(courseId, lessonId) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COURSES.COURSES}/${courseId}/lessons/${lessonId}/content`);
    return (res && res.data) ? res.data : res;
  },

  // ── Assessments ───────────────────────────────────────────────────
  // NOTE: the backend has no customer-facing "list this course's
  // assessments" endpoint -- these calls need an assessment id obtained
  // some other way (see the roadmap doc's flagged gap). Implemented so
  // the moment that id is available (a future endpoint, or a direct
  // link), the attempt flow works with no further frontend changes.
  async getAssessmentForAttempt(assessmentId) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COURSES.ASSESSMENTS}/${assessmentId}/attempt`);
    return (res && res.data) ? res.data : res;
  },

  async startAttempt(assessmentId) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COURSES.ASSESSMENTS}/${assessmentId}/start`, { method: 'POST' });
    return (res && res.data) ? res.data : res;
  },

  async submitAttempt(assessmentId, sessionId, answers) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COURSES.ASSESSMENTS}/${assessmentId}/attempt`, {
      method: 'POST',
      body: JSON.stringify({ sessionId, answers })
    });
    return (res && res.data) ? res.data : res;
  },

  // ── Reviews ───────────────────────────────────────────────────────
  async submitReview(courseId, rating, review) {
    const res = await APIHelper.request(`${API_CONFIG.ENDPOINTS.ACADEMY_COURSES.COURSES}/${courseId}/reviews`, {
      method: 'POST',
      body: JSON.stringify(review ? { rating, review } : { rating })
    });
    return (res && res.data) ? res.data : res;
  },

  // ── Shared commerce (discount preview + certificates) ────────────
  async validateDiscountCode(code, amount) {
    const res = await APIHelper.request(API_CONFIG.ENDPOINTS.ACADEMY_COMMERCE.DISCOUNT_VALIDATE, {
      method: 'POST',
      body: JSON.stringify({ code, programType: 'COURSE', amount })
    });
    return (res && res.data) ? res.data : res;
  },

  // The caller's own certificates across both Training and Courses --
  // filter the result by programType/programId for a specific course.
  async listMyCertificates() {
    const res = await APIHelper.request(API_CONFIG.ENDPOINTS.ACADEMY_COMMERCE.CERTIFICATES);
    return (res && res.data) ? res.data : res;
  }
};
