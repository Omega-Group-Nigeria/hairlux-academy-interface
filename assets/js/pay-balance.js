/**
 * Hairlux Academy: pay a training balance (pay-balance.html).
 *
 * For in-branch training enrolled with a deposit. The learner enters their
 * registration code and email (the link in the confirmation and reminder
 * emails fills in the code; a signed-in learner's email is filled in too),
 * sees what is left to pay, and pays it through Paystack. Paystack then
 * returns them to enrolment-confirmed.html?balance=HLACD-..., which confirms it.
 */
(function () {
  'use strict';

  var E = window.HLXEnrol;
  var $ = E.$, esc = E.esc, naira = E.naira;
  var current = null; // { registrationCode, email, registration }

  function showError(id, msg) {
    var el = $(id);
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  function busy(btn, on, label) {
    btn.disabled = on;
    btn.innerHTML = on ? '<span class="en-spinner"></span> Please wait' : esc(label);
  }

  function render(r) {
    $('pbFind').classList.add('hidden');
    $('pbResult').classList.remove('hidden');
    $('pbTitle').textContent = r.trainingName;
    $('pbLead').textContent = r.cohortName + ' at ' + r.branch.name + ', ' + E.dateRange(r.startDate, r.endDate);
    $('pbRows').innerHTML = [
      ['Registration code', esc(r.registrationCode)],
      r.totalFee != null ? ['Fee', naira(r.totalFee), 'total'] : null,
      r.amountPaid != null ? ['Paid so far', naira(r.amountPaid)] : null,
      ['Balance', r.balanceDue > 0 ? naira(r.balanceDue) : 'Nothing, fully paid', 'pay'],
    ].filter(Boolean).map(function (x) {
      return '<div class="en-row' + (x[2] ? ' ' + x[2] : '') + '"><span>' + esc(x[0]) + '</span><span>' + x[1] + '</span></div>';
    }).join('');

    var payBtn = $('pbPayBtn');
    if (r.balanceDue > 0 && r.status === 'CONFIRMED') {
      $('pbNote').innerHTML = '<strong>Due before ' + esc(E.dateLabel(r.startDate)) + '</strong>' +
        (r.daysToStart <= 0 ? 'Your class has started: please pay now or at the branch to continue attending.'
          : 'Your class starts in ' + r.daysToStart + (r.daysToStart === 1 ? ' day' : ' days') + '. You can also pay at the branch before the class.');
      $('pbNote').classList.add('warn');
      payBtn.classList.remove('hidden');
      payBtn.textContent = 'Pay ' + naira(r.balanceDue) + ' now';
    } else {
      $('pbNote').innerHTML = r.balanceDue > 0
        ? '<strong>This registration is no longer active</strong>Please contact Hairlux Academy.'
        : '<strong>You are all set</strong>Your training is fully paid. Bring your registration code on your first day.';
      $('pbNote').classList.remove('warn');
      payBtn.classList.add('hidden');
    }
  }

  async function find(e) {
    if (e) e.preventDefault();
    showError('pbFindError', '');
    var code = $('pbCode').value.trim().toUpperCase();
    var email = $('pbEmail').value.trim();
    if (!code) { showError('pbFindError', 'Enter your registration code.'); $('pbCode').focus(); return; }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { showError('pbFindError', 'Enter the email you enrolled with.'); $('pbEmail').focus(); return; }
    var btn = $('pbFindBtn');
    busy(btn, true);
    try {
      var r = await E.api('/public/academy/enrolment/balance/lookup', { method: 'POST', body: JSON.stringify({ registrationCode: code, email: email }) });
      current = { registrationCode: code, email: email, registration: r };
      render(r);
    } catch (err) {
      showError('pbFindError', err.message || 'We could not find that registration.');
    } finally {
      busy(btn, false, 'Find my registration');
    }
  }

  async function pay() {
    if (!current) return;
    showError('pbPayError', '');
    var btn = $('pbPayBtn');
    var label = btn.textContent;
    busy(btn, true);
    try {
      var data = await E.api('/public/academy/enrolment/balance/pay', {
        method: 'POST',
        body: JSON.stringify({ registrationCode: current.registrationCode, email: current.email }),
      });
      window.location.href = data.authorizationUrl;
    } catch (err) {
      showError('pbPayError', err.message || 'We could not start the payment. Please try again.');
      busy(btn, false, label);
    }
  }

  function init() {
    $('enYear').textContent = new Date().getFullYear();
    var q = new URLSearchParams(location.search);
    if (q.get('code')) $('pbCode').value = q.get('code').toUpperCase();
    $('pbEmail').value = E.signedInEmail();
    $('pbFind').addEventListener('submit', find);
    $('pbPayBtn').addEventListener('click', pay);
    $('pbBack').addEventListener('click', function (e) {
      e.preventDefault();
      current = null;
      $('pbResult').classList.add('hidden');
      $('pbFind').classList.remove('hidden');
    });
    // Both filled in (link from the email, signed in): look it up straight away.
    if ($('pbCode').value && $('pbEmail').value) find();
    else ($('pbCode').value ? $('pbEmail') : $('pbCode')).focus();
  }

  init();
})();
