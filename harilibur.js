// ============================================
//   AbsenKelas — harilibur.js  v6.0
//   Modul: Deteksi Hari Libur + Multi-User Session
// ============================================

(function () {
  'use strict';

  // ============================================
  //   DATA HARI LIBUR NASIONAL 2025 & 2026
  // ============================================
  const KETERANGAN_LIBUR = {
    "2025-01-01": "Tahun Baru Masehi 2025",
    "2025-01-27": "Isra Mikraj Nabi Muhammad SAW",
    "2025-01-28": "Cuti Bersama Isra Mikraj",
    "2025-01-29": "Tahun Baru Imlek 2576",
    "2025-03-28": "Cuti Bersama Idul Fitri",
    "2025-03-29": "Hari Suci Nyepi",
    "2025-03-31": "Idul Fitri 1446 H",
    "2025-04-01": "Idul Fitri 1446 H (Hari ke-2)",
    "2025-04-02": "Cuti Bersama Idul Fitri",
    "2025-04-03": "Cuti Bersama Idul Fitri",
    "2025-04-04": "Cuti Bersama Idul Fitri",
    "2025-04-07": "Cuti Bersama Idul Fitri",
    "2025-04-18": "Wafat Isa Almasih",
    "2025-05-01": "Hari Buruh Internasional",
    "2025-05-12": "Hari Raya Waisak",
    "2025-05-13": "Cuti Bersama Waisak",
    "2025-05-29": "Kenaikan Isa Almasih",
    "2025-06-01": "Hari Lahir Pancasila",
    "2025-06-02": "Cuti Bersama Pancasila",
    "2025-06-06": "Idul Adha 1446 H",
    "2025-06-27": "Tahun Baru Islam 1447 H",
    "2025-08-17": "HUT Kemerdekaan RI ke-80",
    "2025-09-05": "Maulid Nabi Muhammad SAW",
    "2025-12-25": "Hari Natal",
    "2025-12-26": "Cuti Bersama Natal",
    "2026-01-01": "Tahun Baru Masehi 2026",
    "2026-01-16": "Isra Mikraj Nabi Muhammad SAW",
    "2026-01-28": "Tahun Baru Imlek 2577",
    "2026-03-19": "Hari Raya Nyepi (Tahun Baru Saka 1948)",
    "2026-03-20": "Idul Fitri 1447 H",
    "2026-03-21": "Idul Fitri 1447 H (Hari ke-2)",
    "2026-03-23": "Cuti Bersama Idul Fitri",
    "2026-03-24": "Cuti Bersama Idul Fitri",
    "2026-04-03": "Wafat Isa Almasih",
    "2026-05-01": "Hari Buruh Internasional",
    "2026-05-14": "Kenaikan Isa Almasih",
    "2026-05-20": "Hari Raya Waisak",
    "2026-05-27": "Idul Adha 1447 H",
    "2026-06-01": "Hari Lahir Pancasila",
    "2026-06-17": "Tahun Baru Islam 1448 H",
    "2026-08-17": "HUT Kemerdekaan RI ke-81",
    "2026-09-25": "Maulid Nabi Muhammad SAW",
    "2026-12-25": "Hari Natal",
    "2026-12-26": "Cuti Bersama Natal"
  };

  const LIBUR_SET = new Set(Object.keys(KETERANGAN_LIBUR));

  // ============================================
  //   FUNGSI CEK HARI LIBUR (frontend & backend)
  // ============================================

  function cekHariLibur(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    const dt   = new Date(y, m - 1, d);
    const hari = dt.getDay();
    if (hari === 0) {
      return { isLibur: true, alasan: 'Hari Minggu', tipe: 'minggu' };
    }
    if (LIBUR_SET.has(dateKey)) {
      return { isLibur: true, alasan: KETERANGAN_LIBUR[dateKey], tipe: 'nasional' };
    }
    return { isLibur: false, alasan: '', tipe: null };
  }

  function cekHariIniLibur() {
    return cekHariLibur(getTodayKey());
  }

  function getTodayKey() {
    const d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  // ============================================
  //   MULTI-USER SESSION
  // ============================================

  const SESSION_KEY      = 'absenKelasSession_v6';
  const MAX_USERS        = 4;
  const SESSION_WINDOW   = 15 * 60 * 1000; // 15 mnt bergabung
  const SESSION_EXPIRE   = 60 * 60 * 1000; // 1 jam expired
  const USER_KEY         = 'absenKelasCurrentUser';

  function getSessions() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveSessions(data) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }

  function cleanupSessions() {
    const sessions = getSessions();
    const today    = getTodayKey();
    const now      = Date.now();
    let changed    = false;
    Object.keys(sessions).forEach(sid => {
      const s = sessions[sid];
      if (s.dateKey !== today || (now - s.createdAt) > SESSION_EXPIRE) {
        delete sessions[sid];
        changed = true;
      }
    });
    if (changed) saveSessions(sessions);
    return getSessions();
  }

  function generateSessionId() {
    return 'SES-' + Date.now().toString(36).toUpperCase() + '-' +
           Math.random().toString(36).slice(2, 6).toUpperCase();
  }

  function joinOrCreateSession(userName) {
    // Validasi libur (backend level)
    const libur = cekHariIniLibur();
    if (libur.isLibur) {
      return { ok: false, session: null,
               message: 'Absensi tidak dapat dilakukan pada hari libur (' + libur.alasan + ')' };
    }

    const sessions = cleanupSessions();
    const today    = getTodayKey();
    const now      = Date.now();

    // Sudah ada di sesi hari ini?
    for (const s of Object.values(sessions)) {
      if (s.dateKey === today && s.users.some(u => u.name === userName)) {
        return { ok: true, session: s, message: 'Anda sudah bergabung di sesi aktif.' };
      }
    }

    // Cari sesi terbuka (belum penuh & masih dalam window)
    for (const s of Object.values(sessions)) {
      if (s.dateKey === today && s.users.length < MAX_USERS &&
          (now - s.createdAt) <= SESSION_WINDOW) {
        s.users.push({ name: userName, joinedAt: now });
        s.lastActivity = now;
        sessions[s.sessionId] = s;
        saveSessions(sessions);
        return { ok: true, session: s,
                 message: 'Bergabung ke sesi ' + s.sessionId };
      }
    }

    // Ada sesi penuh?
    for (const s of Object.values(sessions)) {
      if (s.dateKey === today && s.users.length >= MAX_USERS) {
        return { ok: false, session: null,
                 message: 'Sesi absensi sudah penuh (' + MAX_USERS + '/' + MAX_USERS + ' orang).' };
      }
    }

    // Buat sesi baru
    const newSes = {
      sessionId:    generateSessionId(),
      dateKey:      today,
      createdAt:    now,
      lastActivity: now,
      users:        [{ name: userName, joinedAt: now }]
    };
    sessions[newSes.sessionId] = newSes;
    saveSessions(sessions);
    return { ok: true, session: newSes, message: 'Sesi baru dibuat: ' + newSes.sessionId };
  }

  // Validasi submit — dipanggil sebelum simpan
  function validateSubmitAbsensi() {
    const libur = cekHariIniLibur();
    if (libur.isLibur) {
      return { ok: false, message: 'Absensi tidak dapat dilakukan pada hari libur (' + libur.alasan + ')' };
    }
    const absen = getAbsenStorage();
    if (absen[getTodayKey()]) {
      return { ok: false, message: 'Absensi hari ini sudah tersimpan.' };
    }
    return { ok: true, message: 'OK' };
  }

  function getAbsenStorage() {
    try { return JSON.parse(localStorage.getItem('absenKelas') || '{}'); }
    catch { return {}; }
  }

  function getSessionInfo() {
    const sessions = cleanupSessions();
    const today    = getTodayKey();
    const active   = Object.values(sessions).find(s => s.dateKey === today);
    if (!active) return null;
    return {
      sessionId: active.sessionId,
      userCount: active.users.length,
      maxUsers:  MAX_USERS,
      users:     active.users,
      dateKey:   active.dateKey,
      createdAt: active.createdAt
    };
  }

  function getCurrentUser()     { return localStorage.getItem(USER_KEY) || null; }
  function setCurrentUser(n)    { localStorage.setItem(USER_KEY, n); }
  function clearCurrentUser()   { localStorage.removeItem(USER_KEY); }

  // ============================================
  //   UI — BANNER + SESSION PANEL
  // ============================================

  function renderHolidayBanner() {
    const libur = cekHariIniLibur();

    // Inject / update topbar status
    let topTag = document.getElementById('liburTopTag');
    if (!topTag) {
      topTag = document.createElement('div');
      topTag.id = 'liburTopTag';
      const topRight = document.querySelector('.topbar-right');
      if (topRight) topRight.prepend(topTag);
    }
    topTag.className = libur.isLibur ? 'libur-topbar-tag' : 'aktif-topbar-tag';
    topTag.innerHTML = libur.isLibur
      ? '<i class="fa-solid fa-calendar-xmark"></i> Hari Libur'
      : '<i class="fa-solid fa-circle-check"></i> Hari Aktif';

    // Banner di atas form absensi
    let banner = document.getElementById('holidayBanner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'holidayBanner';
      const card = document.getElementById('attendanceCard');
      if (card) card.parentNode.insertBefore(banner, card);
    }

    if (libur.isLibur) {
      banner.className = 'holiday-banner libur';
      banner.innerHTML =
        '<div class="hb-icon"><i class="fa-solid fa-' +
        (libur.tipe === 'minggu' ? 'calendar-xmark' : 'moon') + '"></i></div>' +
        '<div class="hb-text">' +
          '<strong>Hari Ini: Hari Libur</strong>' +
          '<span>' + libur.alasan + ' — Absensi tidak dapat dilakukan</span>' +
        '</div>' +
        '<div class="hb-badge libur">🔴 Libur</div>';

      // Update status pill
      const pill = document.getElementById('statusPill');
      if (pill) { pill.textContent = '🔴 Hari Libur'; pill.className = 'status-pill libur'; }

      disableAbsensiForm(libur.alasan);
    } else {
      banner.className = 'holiday-banner aktif';
      banner.innerHTML =
        '<div class="hb-icon"><i class="fa-solid fa-circle-check"></i></div>' +
        '<div class="hb-text">' +
          '<strong>Hari Aktif</strong>' +
          '<span>Absensi dapat dilakukan hari ini</span>' +
        '</div>' +
        '<div class="hb-badge aktif">🟢 Aktif</div>';
    }
  }

  function disableAbsensiForm(alasan) {
    document.querySelectorAll('.status-btn, .bulk-btn').forEach(btn => {
      btn.disabled = true;
      btn.style.cssText += ';opacity:0.38;cursor:not-allowed;pointer-events:none';
    });
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.title = 'Absensi dinonaktifkan: ' + alasan;
    }

    let notice = document.getElementById('liburFormNotice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'liburFormNotice';
      notice.className = 'libur-notice';
      const sl = document.getElementById('studentList');
      if (sl) sl.parentNode.insertBefore(notice, sl);
    }
    notice.style.display = 'flex';
    notice.innerHTML =
      '<i class="fa-solid fa-ban"></i>' +
      '<div>' +
        '<strong>Hari ini adalah hari libur, absensi tidak dapat dilakukan</strong>' +
        '<p>' + alasan + '</p>' +
      '</div>';
  }

  function renderSessionPanel() {
    const libur = cekHariIniLibur();
    let panel   = document.getElementById('sessionPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'sessionPanel';
      const footer = document.querySelector('.form-footer');
      if (footer) footer.parentNode.insertBefore(panel, footer);
    }

    if (libur.isLibur) { panel.innerHTML = ''; return; }

    const info  = getSessionInfo();
    const me    = getCurrentUser();

    if (!info) {
      panel.innerHTML =
        '<div class="session-panel empty">' +
          '<div class="sp-header">' +
            '<i class="fa-solid fa-users"></i><span>Sesi Absensi Bersama</span>' +
            '<span class="sp-count">0/' + MAX_USERS + '</span>' +
          '</div>' +
          '<p class="sp-hint">Belum ada sesi. Masukkan nama Anda untuk memulai atau bergabung.</p>' +
          '<div class="sp-login-row">' +
            '<input type="text" id="userNameInput" class="sp-input" placeholder="Nama Anda (Guru/Operator)" maxlength="40"/>' +
            '<button class="sp-btn-join" onclick="window.doJoinSession()">' +
              '<i class="fa-solid fa-right-to-bracket"></i> Mulai Sesi' +
            '</button>' +
          '</div>' +
        '</div>';
      return;
    }

    const slots = Array(MAX_USERS).fill(null).map((_, i) => info.users[i] || null);
    const isFull = info.userCount >= MAX_USERS;

    panel.innerHTML =
      '<div class="session-panel active">' +
        '<div class="sp-header">' +
          '<i class="fa-solid fa-users"></i>' +
          '<span>Sesi Absensi Bersama</span>' +
          '<span class="sp-count ' + (isFull ? 'full' : '') + '">' + info.userCount + '/' + MAX_USERS + '</span>' +
        '</div>' +
        '<div class="sp-id-row">' +
          '<span class="sp-id-label">ID Sesi:</span>' +
          '<code class="sp-session-id">' + info.sessionId + '</code>' +
        '</div>' +
        '<div class="sp-slots">' +
          slots.map(function(user, i) {
            if (user) {
              var isMe = (user.name === me);
              return '<div class="sp-slot filled ' + (isMe ? 'me' : '') + '">' +
                       '<i class="fa-solid fa-circle-user"></i>' +
                       '<span>' + user.name + '</span>' +
                       (isMe ? '<span class="sp-me-tag">Anda</span>' : '') +
                     '</div>';
            }
            return '<div class="sp-slot empty-slot">' +
                     '<i class="fa-regular fa-circle-user"></i>' +
                     '<span>Slot ' + (i + 1) + ' kosong</span>' +
                   '</div>';
          }).join('') +
        '</div>' +
        (!me && !isFull
          ? '<div class="sp-login-row" style="margin-top:10px">' +
              '<input type="text" id="userNameInput" class="sp-input" placeholder="Nama Anda untuk bergabung" maxlength="40"/>' +
              '<button class="sp-btn-join" onclick="window.doJoinSession()">' +
                '<i class="fa-solid fa-right-to-bracket"></i> Bergabung' +
              '</button>' +
            '</div>'
          : '') +
        (isFull && !me
          ? '<div class="sp-full-notice">' +
              '<i class="fa-solid fa-circle-exclamation"></i>' +
              'Sesi absensi sudah penuh (' + MAX_USERS + '/' + MAX_USERS + ' orang)' +
            '</div>'
          : '') +
      '</div>';
  }

  // ============================================
  //   GLOBAL EXPOSED FUNCTIONS
  // ============================================

  window.HariLibur = {
    cekHariLibur,
    cekHariIniLibur,
    getTodayKey,
    joinOrCreateSession,
    validateSubmitAbsensi,
    getSessionInfo,
    getCurrentUser,
    setCurrentUser,
    clearCurrentUser,
    renderHolidayBanner,
    renderSessionPanel,
    MAX_USERS
  };

  window.doJoinSession = function () {
    var input = document.getElementById('userNameInput');
    var name  = input ? input.value.trim() : '';
    if (!name) {
      if (typeof showToast === 'function') showToast('Masukkan nama Anda terlebih dahulu!', 'error');
      return;
    }
    var result = joinOrCreateSession(name);
    if (result.ok) {
      setCurrentUser(name);
      renderSessionPanel();
      if (typeof showToast === 'function') showToast('✅ ' + result.message, 'success');
    } else {
      if (typeof showToast === 'function') showToast('❌ ' + result.message, 'error');
    }
  };

  // ============================================
  //   INJECT CSS
  // ============================================
  function injectCSS() {
    if (document.getElementById('harilibur-styles')) return;
    var s = document.createElement('style');
    s.id = 'harilibur-styles';
    s.textContent = [
      /* ===== TOPBAR TAG ===== */
      '.libur-topbar-tag,.aktif-topbar-tag{display:inline-flex;align-items:center;gap:5px;font-size:11px;font-weight:700;border-radius:6px;padding:4px 10px;border:1px solid;}',
      '.libur-topbar-tag{background:rgba(248,113,113,0.13);color:#f87171;border-color:rgba(248,113,113,0.28);}',
      '.aktif-topbar-tag{background:rgba(52,211,153,0.10);color:#34d399;border-color:rgba(52,211,153,0.22);}',

      /* ===== HOLIDAY BANNER ===== */
      '.holiday-banner{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:12px;margin-bottom:16px;border:1px solid;animation:hbFade .4s ease;}',
      '@keyframes hbFade{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}',
      '.holiday-banner.libur{background:rgba(248,113,113,0.07);border-color:rgba(248,113,113,0.24);}',
      '.holiday-banner.aktif{background:rgba(52,211,153,0.06);border-color:rgba(52,211,153,0.2);}',
      '.hb-icon{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;}',
      '.holiday-banner.libur .hb-icon{background:rgba(248,113,113,0.14);color:#f87171;}',
      '.holiday-banner.aktif .hb-icon{background:rgba(52,211,153,0.14);color:#34d399;}',
      '.hb-text{flex:1;}',
      '.hb-text strong{display:block;font-size:14px;color:var(--text-primary);margin-bottom:2px;}',
      '.hb-text span{font-size:12px;color:var(--text-secondary);}',
      '.hb-badge{font-size:12px;font-weight:700;padding:4px 12px;border-radius:20px;white-space:nowrap;flex-shrink:0;}',
      '.hb-badge.libur{background:rgba(248,113,113,0.14);color:#f87171;}',
      '.hb-badge.aktif{background:rgba(52,211,153,0.14);color:#34d399;}',

      /* ===== LIBUR NOTICE ===== */
      '.libur-notice{display:flex;align-items:flex-start;gap:14px;background:rgba(248,113,113,0.06);border:1px solid rgba(248,113,113,0.2);border-radius:10px;padding:16px 18px;margin-bottom:14px;color:#f87171;}',
      '.libur-notice i{font-size:22px;margin-top:2px;flex-shrink:0;}',
      '.libur-notice strong{display:block;font-size:14px;margin-bottom:4px;}',
      '.libur-notice p{font-size:12px;color:var(--text-secondary);margin:0;}',

      /* ===== STATUS PILL LIBUR ===== */
      '.status-pill.libur{background:rgba(248,113,113,0.12)!important;color:#f87171!important;border:1px solid rgba(248,113,113,0.25)!important;}',

      /* ===== SESSION PANEL ===== */
      '.session-panel{background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:16px 18px;margin-bottom:16px;}',
      '.session-panel.active{border-color:rgba(79,142,247,0.3);}',
      '.sp-header{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:10px;}',
      '.sp-header i{color:var(--accent-blue);}',
      '.sp-count{margin-left:auto;font-size:12px;font-weight:700;background:rgba(79,142,247,0.12);color:var(--accent-blue);padding:2px 9px;border-radius:10px;}',
      '.sp-count.full{background:rgba(248,113,113,0.15);color:#f87171;}',
      '.sp-hint{font-size:12px;color:var(--text-muted);margin:0 0 12px;}',
      '.sp-id-row{display:flex;align-items:center;gap:8px;margin-bottom:10px;}',
      '.sp-id-label{font-size:11px;color:var(--text-muted);}',
      ".sp-session-id{font-family:'DM Mono',monospace;font-size:11px;background:var(--bg-input);color:var(--accent-blue);padding:3px 8px;border-radius:5px;border:1px solid var(--border);letter-spacing:.05em;}",
      '.sp-slots{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;}',
      '.sp-slot{display:flex;align-items:center;gap:8px;border-radius:8px;padding:8px 11px;font-size:12.5px;}',
      '.sp-slot.filled{background:rgba(79,142,247,0.08);border:1px solid rgba(79,142,247,0.2);color:var(--text-primary);}',
      '.sp-slot.filled i{color:var(--accent-blue);}',
      '.sp-slot.me{background:rgba(52,211,153,0.08);border-color:rgba(52,211,153,0.25);}',
      '.sp-slot.me i{color:var(--hadir);}',
      '.sp-slot.empty-slot{background:transparent;border:1px dashed rgba(255,255,255,0.08);color:var(--text-muted);}',
      '.sp-me-tag{margin-left:auto;font-size:10px;padding:1px 6px;background:rgba(52,211,153,0.15);color:var(--hadir);border-radius:4px;font-weight:700;}',
      '.sp-login-row{display:flex;gap:8px;}',
      ".sp-input{flex:1;background:var(--bg-input);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:13px;color:var(--text-primary);outline:none;font-family:'Plus Jakarta Sans',sans-serif;transition:border-color .2s;}",
      '.sp-input:focus{border-color:var(--accent-blue);}',
      ".sp-btn-join{display:flex;align-items:center;gap:6px;background:var(--accent-blue);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:13px;font-weight:600;cursor:pointer;white-space:nowrap;transition:opacity .2s;font-family:'Plus Jakarta Sans',sans-serif;}",
      '.sp-btn-join:hover{opacity:.85;}',
      '.sp-full-notice{display:flex;align-items:center;gap:8px;background:rgba(248,113,113,0.08);border:1px solid rgba(248,113,113,0.2);border-radius:8px;padding:9px 12px;margin-top:10px;font-size:12.5px;color:#f87171;}',

      /* ===== RESPONSIVE ===== */
      '@media(max-width:560px){.sp-slots{grid-template-columns:1fr}.sp-login-row{flex-direction:column}.holiday-banner{flex-wrap:wrap}}'
    ].join('\n');
    document.head.appendChild(s);
  }

  // ============================================
  //   INIT
  // ============================================
  function init() {
    injectCSS();
    var run = function () {
      setTimeout(function () {
        renderHolidayBanner();
        renderSessionPanel();
      }, 80);
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }
  }

  init();

})();
