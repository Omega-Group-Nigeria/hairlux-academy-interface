
    document.addEventListener('DOMContentLoaded', async () => {
      const toast = (msg, type = 'success') => { if (typeof UIHelper !== 'undefined') UIHelper.showToast(msg, type); };
      const errMsg = (err, fallback) => (err && err.message) ? err.message : fallback;
      const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

      const params = new URLSearchParams(window.location.search);
      const courseId = params.get('id');
      const root = document.getElementById('playerRoot');
      document.getElementById('backToDetail').href = courseId ? `../course-detail.html?id=${courseId}` : '../courses.html';

      if (!courseId) {
        root.innerHTML = '<div class="empty-state">No course specified. <a href="../courses.html">Back to Digital Courses</a></div>';
        return;
      }

      let course = null;
      let progress = null;
      let flatLessons = []; // [{lesson, module}]
      let currentLessonId = params.get('lesson') || null;
      let assessmentId = params.get('assessment') || null;

      function mediaMarkup(lesson) {
        if (!lesson.previewAvailable && !lesson._contentChecked) {
          return '<div class="empty-state">Loading lesson content…</div>';
        }
        if (lesson._contentError) {
          return `<div class="empty-state">${esc(lesson._contentError)}</div>`;
        }
        const key = lesson.contentKey || '';
        if (!key) return '<div class="empty-state">No content attached to this lesson yet.</div>';
        const isEmbed = /youtube\.com|youtu\.be|vimeo\.com/i.test(key);
        if (lesson.type === 'VIDEO') {
          if (isEmbed) return `<div class="crs-media-wrap"><iframe src="${esc(key)}" allowfullscreen></iframe></div>`;
          return `<div class="crs-media-wrap"><video controls src="${esc(key)}"></video></div>`;
        }
        if (lesson.type === 'AUDIO') return `<div class="crs-media-wrap"><audio controls src="${esc(key)}"></audio></div>`;
        if (lesson.type === 'PDF') return `<div class="crs-media-wrap"><iframe src="${esc(key)}"></iframe></div>`;
        if (/^https?:\/\//i.test(key)) return `<div class="form-hint">Read: <a href="${esc(key)}" target="_blank" rel="noopener">${esc(key)}</a></div>`;
        return `<div class="crs-text-lesson">${esc(key)}</div>`;
      }

      function lastIndex() {
        if (!progress || !progress.lastLessonId) return -1;
        return flatLessons.findIndex(x => x.lesson.id === progress.lastLessonId);
      }

      function isLockedHeuristic(index) {
        // OPEN_ACCESS: nothing locked client-side (server enforces nothing on view either way).
        // SEQUENTIAL/ASSESSMENT_BASED: approximate using lastLessonId's position, since no
        // per-lesson completion list is exposed to the frontend (flagged in the roadmap doc).
        // Real enforcement always happens server-side in markLessonComplete regardless of this.
        if (course.unlockMode === 'OPEN_ACCESS') return false;
        return index > lastIndex() + 1;
      }

      function updateUrl() {
        const url = new URL(window.location.href);
        if (currentLessonId) url.searchParams.set('lesson', currentLessonId); else url.searchParams.delete('lesson');
        if (assessmentId) url.searchParams.set('assessment', assessmentId); else url.searchParams.delete('assessment');
        window.history.replaceState({}, document.title, url.pathname + url.search);
      }

      async function ensureLessonContent(lesson) {
        if (lesson.previewAvailable || lesson._contentChecked) return;
        try {
          const data = await AcademyCoursesAPI.getLessonContent(courseId, lesson.id);
          lesson.contentKey = data.contentKey;
          lesson.resources = data.resources;
        } catch (err) {
          lesson._contentError = errMsg(err, "Could not load this lesson's content.");
        } finally {
          lesson._contentChecked = true;
        }
      }

      async function selectAssessment(id) {
        currentLessonId = null;
        assessmentId = id;
        updateUrl();
        renderAll();
      }

      function renderSidebar() {
        let html = `
          <div class="crs-player-progress">
            <div style="font-weight:700;font-size:13px;color:var(--primary);">${esc(course.title)}</div>
            <div class="crs-progress-bar"><div class="crs-progress-bar-fill" style="width:${Math.round(progress ? progress.percentComplete : 0)}%;"></div></div>
            <div class="crs-progress-label">${Math.round(progress ? progress.percentComplete : 0)}% complete${progress && progress.completedAt ? ' · Completed 🎉' : ''}</div>
          </div>`;
        (course.modules || []).forEach(m => {
          html += `<div class="crs-player-module-head">${esc(m.name)}</div>`;
          (m.lessons || []).forEach(l => {
            const idx = flatLessons.findIndex(x => x.lesson.id === l.id);
            const locked = isLockedHeuristic(idx);
            const done = idx <= lastIndex() && idx !== -1 && lastIndex() !== -1;
            const isCurrent = l.id === currentLessonId;
            const icon = done ? '✓' : (locked ? '🔒' : '▶');
            html += `<div class="crs-player-lesson ${isCurrent ? 'is-current' : ''} ${locked ? 'is-locked' : ''}" data-lesson-id="${l.id}" data-locked="${locked ? '1' : '0'}">
              <span class="crs-player-lesson-icon">${icon}</span><span>${esc(l.title)}</span>
            </div>`;
          });
          (m.assessments || []).forEach((a, i) => {
            const label = (m.assessments.length > 1) ? `Module Assessment ${i + 1}` : 'Module Assessment';
            const isCurrent = assessmentId === a.id;
            html += `<div class="crs-player-lesson crs-player-assessment ${isCurrent ? 'is-current' : ''}" data-assessment-id="${a.id}">
              <span class="crs-player-lesson-icon">📝</span><span>${esc(label)}</span>
            </div>`;
          });
        });
        if (course.assessments && course.assessments.length) {
          html += `<div class="crs-player-module-head">Course Assessment</div>`;
          course.assessments.forEach((a, i) => {
            const label = (course.assessments.length > 1) ? `Final Assessment ${i + 1}` : 'Final Assessment';
            const isCurrent = assessmentId === a.id;
            html += `<div class="crs-player-lesson crs-player-assessment ${isCurrent ? 'is-current' : ''}" data-assessment-id="${a.id}">
              <span class="crs-player-lesson-icon">📝</span><span>${esc(label)}</span>
            </div>`;
          });
        }
        return html;
      }

      function renderLessonPane(lesson) {
        const idx = flatLessons.findIndex(x => x.lesson.id === lesson.id);
        const alreadyMarked = idx <= lastIndex() && lastIndex() !== -1;
        const prev = flatLessons[idx - 1];
        const next = flatLessons[idx + 1];
        return `
          <h2>${esc(lesson.title)}</h2>
          <div class="crs-player-content-meta">${lesson.type}${lesson.duration ? ` · ${lesson.duration} min` : ''}</div>
          ${mediaMarkup(lesson)}
          ${(lesson.resources && lesson.resources.length) ? `<div class="crs-resources"><h4>Resources</h4>${lesson.resources.map(r => `<a href="${esc(r)}" target="_blank" rel="noopener">${esc(r)}</a>`).join('')}</div>` : ''}
          <div class="crs-player-actions">
            <div style="display:flex;gap:8px;">
              <button class="btn-crs btn-crs-outline" id="btnPrevLesson" ${prev ? '' : 'disabled'}>← Previous</button>
              <button class="btn-crs btn-crs-outline" id="btnNextLesson" ${next ? '' : 'disabled'}>Next →</button>
            </div>
            <button class="btn-crs btn-crs-primary" id="btnMarkComplete">${alreadyMarked ? '✓ Marked Complete' : 'Mark Complete'}</button>
          </div>`;
      }

      function renderAssessmentPane(id) {
        return `<div id="assessmentPane"><div class="empty-state">Loading assessment…</div></div>`;
      }

      async function loadAssessmentPane(id) {
        const pane = document.getElementById('assessmentPane');
        try {
          const state = await AcademyCoursesAPI.getAssessmentForAttempt(id);
          if (!state.canAttempt) {
            pane.innerHTML = `<h2>Assessment</h2><div class="empty-state">${state.alreadyPassed ? 'You have already passed this assessment.' : 'No attempts remaining for this assessment.'}</div>`;
            return;
          }
          pane.innerHTML = `
            <h2>Assessment</h2>
            <div class="crs-player-content-meta">Passing score ${state.passingScore}% · ${state.attemptsRemaining} attempt${state.attemptsRemaining === 1 ? '' : 's'} remaining${state.timeLimit ? ` · ${state.timeLimit} min time limit` : ''}</div>
            <button class="btn-crs btn-crs-primary" id="btnStartAttempt">Start Attempt</button>
            <div id="attemptForm" style="margin-top:18px;"></div>`;
          document.getElementById('btnStartAttempt').addEventListener('click', async () => {
            const btn = document.getElementById('btnStartAttempt');
            UIHelper.setButtonLoading(btn, true);
            try {
              const session = await AcademyCoursesAPI.startAttempt(id);
              btn.style.display = 'none';
              renderAttemptForm(id, session.sessionId, state.questions);
            } catch (err) {
              toast(errMsg(err, 'Could not start attempt.'), 'error');
            } finally {
              UIHelper.setButtonLoading(btn, false);
            }
          });
        } catch (err) {
          pane.innerHTML = `<h2>Assessment</h2><div class="empty-state">${errMsg(err, 'Could not load this assessment.')}</div>`;
        }
      }

      function renderAttemptForm(assessmentId, sessionId, questions) {
        const container = document.getElementById('attemptForm');
        container.innerHTML = questions.map((q, i) => {
          let inputs = '';
          if (q.type === 'TRUE_FALSE') {
            inputs = ['true', 'false'].map(v => `<label style="display:block;margin:4px 0;"><input type="radio" name="q_${q.id}" value="${v}"> ${v}</label>`).join('');
          } else if (q.type === 'MULTIPLE_CHOICE') {
            inputs = (q.options || []).map(o => `<label style="display:block;margin:4px 0;"><input type="radio" name="q_${q.id}" value="${esc(o)}"> ${esc(o)}</label>`).join('');
          } else if (q.type === 'MULTIPLE_ANSWER') {
            inputs = (q.options || []).map(o => `<label style="display:block;margin:4px 0;"><input type="checkbox" name="q_${q.id}" value="${esc(o)}"> ${esc(o)}</label>`).join('');
          } else {
            inputs = `<input type="text" name="q_${q.id}" style="height:38px;padding:0 10px;border:1px solid var(--border);border-radius:8px;width:100%;box-sizing:border-box;">`;
          }
          return `<div style="margin-bottom:16px;"><div style="font-weight:600;font-size:13px;margin-bottom:6px;">${i + 1}. ${esc(q.prompt)}</div>${inputs}</div>`;
        }).join('') + `<button class="btn-crs btn-crs-primary" id="btnSubmitAttempt">Submit Attempt</button><div id="attemptResult" style="margin-top:14px;"></div>`;

        document.getElementById('btnSubmitAttempt').addEventListener('click', async () => {
          const answers = questions.map(q => {
            const inputs = container.querySelectorAll(`[name="q_${q.id}"]`);
            let response = [];
            inputs.forEach(inp => {
              if ((inp.type === 'radio' || inp.type === 'checkbox') && inp.checked) response.push(inp.value);
              if (inp.type === 'text') response = inp.value ? [inp.value] : [];
            });
            return { questionId: q.id, response };
          });
          const btn = document.getElementById('btnSubmitAttempt');
          UIHelper.setButtonLoading(btn, true);
          try {
            const result = await AcademyCoursesAPI.submitAttempt(assessmentId, sessionId, answers);
            const resultBox = document.getElementById('attemptResult');
            if (typeof result.passed === 'boolean') {
              resultBox.innerHTML = `<div class="form-${result.passed ? 'success' : 'error'} is-visible">${result.passed ? '✓ Passed' : '✗ Not passed'} — score ${result.score}%</div>`;
            } else {
              resultBox.innerHTML = `<div class="form-hint">Attempt submitted — results are released separately for this assessment.</div>`;
            }
            btn.disabled = true;
          } catch (err) {
            toast(errMsg(err, 'Could not submit attempt.'), 'error');
          } finally {
            UIHelper.setButtonLoading(btn, false);
          }
        });
      }

      async function selectLesson(lessonId) {
        currentLessonId = lessonId;
        assessmentId = null;
        updateUrl();
        renderAll();
      }

      function renderAll() {
        const contentPane = document.getElementById('contentPane');
        const sidebar = document.getElementById('sidebarInner');
        if (sidebar) sidebar.innerHTML = renderSidebar();

        if (assessmentId) {
          contentPane.innerHTML = renderAssessmentPane(assessmentId);
          loadAssessmentPane(assessmentId);
        } else {
          const entry = flatLessons.find(x => x.lesson.id === currentLessonId);
          if (!entry) {
            contentPane.innerHTML = '<div class="empty-state">Select a lesson from the left to begin.</div>';
          } else {
            contentPane.innerHTML = renderLessonPane(entry.lesson);
            const markBtn = document.getElementById('btnMarkComplete');
            if (markBtn) markBtn.addEventListener('click', () => markComplete(entry.lesson.id));
            const prevBtn = document.getElementById('btnPrevLesson');
            if (prevBtn) prevBtn.addEventListener('click', () => {
              const idx = flatLessons.findIndex(x => x.lesson.id === entry.lesson.id);
              if (flatLessons[idx - 1]) selectLesson(flatLessons[idx - 1].lesson.id);
            });
            const nextBtn = document.getElementById('btnNextLesson');
            if (nextBtn) nextBtn.addEventListener('click', () => {
              const idx = flatLessons.findIndex(x => x.lesson.id === entry.lesson.id);
              if (flatLessons[idx + 1]) selectLesson(flatLessons[idx + 1].lesson.id);
            });
            if (!entry.lesson.previewAvailable && !entry.lesson._contentChecked) {
              ensureLessonContent(entry.lesson).then(() => {
                if (!assessmentId && currentLessonId === entry.lesson.id) renderAll();
              });
            }
          }
        }

        document.querySelectorAll('.crs-player-lesson:not(.crs-player-assessment)').forEach(row => {
          row.addEventListener('click', () => {
            if (row.dataset.locked === '1') { toast('Complete the prior lessons first.', 'error'); return; }
            selectLesson(row.dataset.lessonId);
          });
        });
        document.querySelectorAll('.crs-player-assessment').forEach(row => {
          row.addEventListener('click', () => selectAssessment(row.dataset.assessmentId));
        });
      }

      async function markComplete(lessonId) {
        try {
          progress = await AcademyCoursesAPI.markLessonComplete(courseId, lessonId);
          toast('Progress saved!');
          const idx = flatLessons.findIndex(x => x.lesson.id === lessonId);
          const next = flatLessons[idx + 1];
          if (next) { selectLesson(next.lesson.id); } else { renderAll(); }
        } catch (err) {
          toast(errMsg(err, 'Could not update progress.'), 'error');
        }
      }

      async function init() {
        try {
          course = await AcademyCoursesAPI.getCourse(courseId);
        } catch (err) {
          root.innerHTML = `<div class="empty-state">${errMsg(err, 'Course not found.')}</div>`;
          return;
        }
        flatLessons = [];
        (course.modules || []).forEach(m => (m.lessons || []).forEach(l => flatLessons.push({ lesson: l, module: m })));

        try {
          progress = await AcademyCoursesAPI.getProgress(courseId);
        } catch (err) {
          root.innerHTML = `<div class="empty-state">${errMsg(err, "You don't have access to this course yet.")} <a href="../course-detail.html?id=${courseId}">Go to course details →</a></div>`;
          return;
        }

        if (!currentLessonId) currentLessonId = progress.lastLessonId || (flatLessons[0] && flatLessons[0].lesson.id) || null;

        root.innerHTML = `
          <div class="crs-player-grid">
            <div class="crs-player-sidebar" id="sidebarInner"></div>
            <div class="crs-player-content" id="contentPane"></div>
          </div>`;

        renderAll();
      }

      init();
    });
