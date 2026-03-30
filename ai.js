// ============================================
//   AbsenKelas — AI Assistant (ai.js)
//   Rule-based NLP | 100% Browser | No API Key
// ============================================

(function () {
  // ---- STATE ----
  let chatOpen = false;
  let chatHistory = [];
  let isTyping = false;

  // ---- STATUS ALIASES ----
  const STATUS_ALIASES = {
    hadir:    ["hadir", "masuk", "ada", "present", "datang"],
    sakit:    ["sakit", "tidak sehat", "demam", "flu", "opname", "rs", "rumah sakit", "unwell", "sick"],
    izin:     ["izin", "ijin", "permisi", "permit", "libur", "cuti", "allowed"],
    alpa:     ["alpa", "alpha", "bolos", "absen", "mangkir", "tidak masuk", "ga masuk", "nggak masuk", "absent"],
  };

  // ---- KEYWORD SETS ----
  const KW_SEMUA     = ["semua", "seluruh", "all", "semuanya", "semua siswa"];
  const KW_KECUALI   = ["kecuali", "terkecuali", "selain", "except", "minus"];
  const KW_DAN       = ["dan", "sama", "dengan", ",", "juga", "and"];
  const KW_CEKHARI   = ["absen hari ini", "absensi hari ini", "tampilkan absen", "lihat absen", "cek absen", "status absen", "siapa yang hadir", "who is here"];
  const KW_BELUM     = ["belum absen", "siapa belum", "yang belum", "belum diisi", "belum ada", "sisa absen", "siapa aja yang belum"];
  const KW_REKAP     = ["rekap", "rekapitulasi", "statistik", "summary", "ringkasan", "laporan bulan", "rekap bulan"];
  const KW_RESET     = ["reset", "hapus", "clear", "bersihkan", "kosongkan", "ulang", "restart absensi"];
  const KW_BANTUAN   = ["bantuan", "help", "tolong", "cara pakai", "bisa apa", "apa saja", "fitur", "perintah", "command", "panduan"];
  const KW_HALO      = ["halo", "hai", "hello", "hi", "hey", "selamat", "assalamu", "pagi", "siang", "sore", "malam"];
  const KW_TERIMA    = ["terima kasih", "makasih", "thanks", "thank you", "ok", "oke", "siap", "mantap", "bagus", "keren"];

  // ---- NORMALIZE TEXT ----
  function norm(text) {
    return text.toLowerCase()
      .replace(/[.,!?;:\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // ---- FUZZY NAME MATCH ----
  function findStudentNames(text, students) {
    const found = [];
    const t = norm(text);

    students.forEach(name => {
      const nameLower = norm(name);
      // Full name match
      if (t.includes(nameLower)) { found.push(name); return; }
      // First name match (if unique enough)
      const firstName = nameLower.split(' ')[0];
      if (firstName.length >= 4 && t.includes(firstName)) {
        // make sure it's not already found
        if (!found.includes(name)) found.push(name);
        return;
      }
      // Token-based: if all words in name appear in text
      const parts = nameLower.split(' ');
      if (parts.length >= 2 && parts.every(p => p.length >= 3 && t.includes(p))) {
        if (!found.includes(name)) found.push(name);
      }
    });

    return [...new Set(found)];
  }

  // ---- DETECT STATUS IN TEXT ----
  function detectStatus(text) {
    const t = norm(text);
    for (const [status, aliases] of Object.entries(STATUS_ALIASES)) {
      for (const alias of aliases) {
        if (t.includes(alias)) return capitalize(status);
      }
    }
    return null;
  }

  function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---- CHECK KEYWORD LIST ----
  function hasAny(text, list) {
    const t = norm(text);
    return list.some(kw => t.includes(kw));
  }

  // ---- GET TODAY DATA ----
  function getTodayData() {
    const data = getStorage();
    const key  = todayKey();
    return data[key] || null;
  }

  // ---- GET CURRENT SELECTIONS (unfilled) ----
  function getCurrentStatus() {
    const today = getTodayData();
    if (today) return { locked: true, records: today.records };
    return { locked: false, records: { ...currentSelections } };
  }

  // ---- APPLY ATTENDANCE CHANGE ----
  function applyAttendance(changes) {
    // changes = { studentName: status }
    const today = getTodayData();
    if (today) {
      // Update locked record
      const data = getStorage();
      const key  = todayKey();
      Object.assign(data[key].records, changes);
      setStorage(data);
      if (typeof checkTodayLocked === 'function') checkTodayLocked();
      if (typeof renderRiwayat   === 'function') renderRiwayat();
      if (typeof renderRekap     === 'function') renderRekap();
      if (typeof updateQuickStats === 'function') updateQuickStats();
    } else {
      // Update live selections
      Object.assign(currentSelections, changes);
      if (typeof renderStudentList  === 'function') renderStudentList(false);
      if (typeof updateQuickStats   === 'function') updateQuickStats();
    }
  }

  // ---- RESET TODAY ----
  function resetToday() {
    const data = getStorage();
    const key  = todayKey();
    delete data[key];
    setStorage(data);
    currentSelections = {};
    if (typeof checkTodayLocked  === 'function') checkTodayLocked();
    if (typeof renderStudentList === 'function') renderStudentList(false);
    if (typeof updateQuickStats  === 'function') updateQuickStats();
    if (typeof renderRiwayat     === 'function') renderRiwayat();
    if (typeof renderRekap       === 'function') renderRekap();
  }

  // ---- INTENT: MARK ALL ----
  function intentMarkAll(text) {
    const status = detectStatus(text);
    if (!status) return null;

    // Check for exceptions
    const t = norm(text);
    let exceptions = [];
    let exceptionPart = '';

    for (const kw of KW_KECUALI) {
      if (t.includes(kw)) {
        exceptionPart = t.split(kw).slice(1).join(kw);
        break;
      }
    }

    if (exceptionPart) {
      exceptions = findStudentNames(exceptionPart, STUDENTS);
    }

    // Build changes
    const changes = {};
    STUDENTS.forEach(name => {
      if (!exceptions.includes(name)) changes[name] = status;
    });

    // Detect exception status (e.g. "semua hadir kecuali Ani izin")
    let excStatus = null;
    if (exceptions.length > 0) {
      excStatus = detectStatus(exceptionPart) || 'Alpa';
    }
    if (excStatus) {
      exceptions.forEach(name => { changes[name] = excStatus; });
    }

    return { type: 'mark_all', changes, exceptions, status, excStatus };
  }

  // ---- INTENT: MARK SPECIFIC ----
  function intentMarkSpecific(text) {
    const status = detectStatus(text);
    if (!status) return null;

    const names = findStudentNames(text, STUDENTS);
    if (names.length === 0) return null;

    const changes = {};
    names.forEach(name => { changes[name] = status; });
    return { type: 'mark_specific', changes, names, status };
  }

  // ---- INTENT: CHECK STATUS ----
  function intentCheckStatus(text) {
    if (hasAny(text, KW_BELUM)) return { type: 'check_unfilled' };
    if (hasAny(text, KW_CEKHARI)) return { type: 'check_today' };
    return null;
  }

  // ---- INTENT: REKAP ----
  function intentRekap(text) {
    if (hasAny(text, KW_REKAP)) return { type: 'rekap' };
    return null;
  }

  // ---- INTENT: RESET ----
  function intentReset(text) {
    const t = norm(text);
    if (KW_RESET.some(kw => t.includes(kw)) && (t.includes('hari ini') || t.includes('absensi') || t.includes('absen') || t.includes('data'))) {
      return { type: 'reset' };
    }
    return null;
  }

  // ---- INTENT: HELP ----
  function intentHelp(text) {
    if (hasAny(text, KW_BANTUAN)) return { type: 'help' };
    return null;
  }

  // ---- INTENT: GREET ----
  function intentGreet(text) {
    if (hasAny(text, KW_HALO)) return { type: 'greet' };
    return null;
  }

  // ---- INTENT: THANKS ----
  function intentThanks(text) {
    if (hasAny(text, KW_TERIMA)) return { type: 'thanks' };
    return null;
  }

  // ---- MAIN: PROCESS INPUT ----
  function processInput(raw) {
    const text = raw.trim();
    if (!text) return "Ketik sesuatu dong, aku siap membantu! 😊";

    const t = norm(text);

    // ---- Greet & Social ----
    if (intentGreet(t)) return replyGreet();
    if (intentThanks(t)) return replyThanks();
    if (intentHelp(t))   return replyHelp();

    // ---- Check / Query ----
    const statusIntent = intentCheckStatus(t);
    if (statusIntent) return handleCheck(statusIntent);

    const rekapIntent = intentRekap(t);
    if (rekapIntent) return handleRekap();

    // ---- Reset ----
    const resetIntent = intentReset(t);
    if (resetIntent) return handleReset();

    // ---- Mark All (semua ...) ----
    const isAll = KW_SEMUA.some(kw => t.includes(kw));
    if (isAll) {
      const r = intentMarkAll(t);
      if (r) return handleMarkAll(r);
    }

    // ---- Mark Specific (name + status) ----
    const specific = intentMarkSpecific(t);
    if (specific) return handleMarkSpecific(specific);

    // ---- Fallback ----
    return replyFallback(text);
  }

  // ---- HANDLERS ----

  function handleMarkAll(r) {
    applyAttendance(r.changes);
    const total = Object.keys(r.changes).length;
    let msg = `Oke, ${total} siswa sudah ditandai <strong>${r.status}</strong> `;

    const emoji = { Hadir: '✅', Sakit: '🤒', Izin: '📋', Alpa: '❌' };
    msg += (emoji[r.status] || '') + '<br>';

    if (r.exceptions.length > 0) {
      const excEmoji = { Hadir: '✅', Sakit: '🤒', Izin: '📋', Alpa: '❌' };
      msg += `<br>Kecuali: <strong>${r.exceptions.join(', ')}</strong> ditandai <strong>${r.excStatus}</strong> ${excEmoji[r.excStatus] || ''}`;
    }

    // Check completeness
    const unfilledCount = checkUnfilled().length;
    if (unfilledCount === 0) {
      msg += '<br><br>🎉 <strong>Absensi hari ini sudah lengkap!</strong>';
    }
    return msg;
  }

  function handleMarkSpecific(r) {
    applyAttendance(r.changes);
    const emoji = { Hadir: '✅', Sakit: '🤒', Izin: '📋', Alpa: '❌' };
    let msg = '';

    if (r.names.length === 1) {
      msg = `Siap! <strong>${r.names[0]}</strong> sudah saya tandai <strong>${r.status}</strong> ${emoji[r.status] || ''} 👍`;
    } else {
      msg = `Oke! ${r.names.length} siswa sudah ditandai <strong>${r.status}</strong> ${emoji[r.status] || ''}:<br>`;
      msg += r.names.map(n => `• ${n}`).join('<br>');
    }

    const unfilledCount = checkUnfilled().length;
    if (unfilledCount > 0) {
      msg += `<br><br>📌 Masih ada <strong>${unfilledCount} siswa</strong> yang belum diisi.`;
    } else {
      msg += `<br><br>🎉 Semua siswa sudah terisi!`;
    }
    return msg;
  }

  function handleCheck(intent) {
    if (intent.type === 'check_unfilled') {
      const unfilled = checkUnfilled();
      if (unfilled.length === 0) {
        return '🎉 Semua siswa sudah diisi absensinya hari ini!';
      }
      let msg = `📌 Ada <strong>${unfilled.length} siswa</strong> yang belum diisi:<br>`;
      msg += unfilled.map((n, i) => `${i + 1}. ${n}`).join('<br>');
      return msg;
    }

    if (intent.type === 'check_today') {
      const { locked, records } = getCurrentStatus();
      const filled = Object.keys(records).filter(n => records[n]);
      if (filled.length === 0) {
        return '📋 Belum ada absensi hari ini. Ayo mulai! Ketik <em>"semua hadir"</em> atau tandai satu per satu.';
      }

      const byStatus = { Hadir: [], Sakit: [], Izin: [], Alpa: [] };
      STUDENTS.forEach(n => {
        const s = records[n];
        if (s && byStatus[s]) byStatus[s].push(n);
      });

      const emoji = { Hadir: '✅', Sakit: '🤒', Izin: '📋', Alpa: '❌' };
      let msg = `📊 <strong>Absensi Hari Ini</strong>${locked ? ' <span style="font-size:11px;color:#22c55e">(tersimpan)</span>' : ''}:<br><br>`;

      Object.entries(byStatus).forEach(([status, names]) => {
        if (names.length > 0) {
          msg += `${emoji[status]} <strong>${status}</strong> (${names.length}): ${names.join(', ')}<br>`;
        }
      });

      const unfilledCount = checkUnfilled().length;
      if (unfilledCount > 0) msg += `<br>⚠️ ${unfilledCount} siswa belum diisi.`;
      return msg;
    }
  }

  function handleRekap() {
    // Navigate to rekap page
    if (typeof navigateTo === 'function') navigateTo('rekap');
    else {
      const rekapBtn = document.querySelector('[data-page="rekap"]');
      if (rekapBtn) rekapBtn.click();
    }
    return '📊 Membuka halaman <strong>Rekap & Statistik</strong>... sudah saya buka ya! Lihat di panel utama 👆';
  }

  function handleReset() {
    resetToday();
    return '🗑️ Absensi hari ini sudah direset. Semua data hari ini dihapus, silakan isi ulang dari awal ya!';
  }

  function checkUnfilled() {
    const { locked, records } = getCurrentStatus();
    if (locked) return [];
    return STUDENTS.filter(n => !records[n] || records[n] === '');
  }

  // ---- REPLY HELPERS ----

  function replyGreet() {
    const greetings = [
      'Halo! 👋 Aku AI Assistant AbsenKelas. Ada yang bisa aku bantu?',
      'Hai! 😊 Siap membantu absensi kelas hari ini. Mau ngapain dulu?',
      'Selamat datang! 🎓 Aku siap bantu kelola absensi. Ketik <em>"bantuan"</em> untuk lihat perintah.',
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  function replyThanks() {
    const replies = [
      'Sama-sama! 😊 Ada lagi yang perlu dibantu?',
      'Siap, senang bisa membantu! 👍',
      'No problem! Kalau butuh sesuatu, aku selalu di sini 🤖',
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  }

  function replyHelp() {
    return `🤖 <strong>Yang bisa aku lakukan:</strong><br><br>
📌 <strong>Absensi Massal:</strong><br>
• <em>"Semua hadir"</em><br>
• <em>"Semua hadir kecuali Ani izin"</em><br>
• <em>"Semua hadir kecuali Raihan dan Andina alpa"</em><br><br>
👤 <strong>Absensi Per Siswa:</strong><br>
• <em>"Ahmad Nauval sakit"</em><br>
• <em>"Raihan dan Andina alpa"</em><br>
• <em>"Ani Zastia izin"</em><br><br>
🔍 <strong>Cek Data:</strong><br>
• <em>"Siapa yang belum absen?"</em><br>
• <em>"Tampilkan absen hari ini"</em><br>
• <em>"Rekap bulan ini"</em><br><br>
🗑️ <strong>Kontrol:</strong><br>
• <em>"Reset absensi hari ini"</em>`;
  }

  function replyFallback(text) {
    // Try to detect just a name with no status
    const names = findStudentNames(text, STUDENTS);
    if (names.length > 0 && !detectStatus(text)) {
      return `Saya menemukan nama <strong>${names.join(', ')}</strong>. Mau ditandai sebagai apa? <em>Hadir / Sakit / Izin / Alpa?</em>`;
    }

    const fallbacks = [
      `Hmm, aku kurang paham maksudnya. 🤔 Coba ketik <em>"bantuan"</em> untuk lihat contoh perintah.`,
      `Belum ngerti nih. 😅 Coba tulis lebih jelas, misalnya: <em>"Ahmad Nauval sakit"</em> atau <em>"semua hadir"</em>.`,
      `Maaf, perintahnya tidak dikenali. 🙈 Ketik <em>"help"</em> untuk panduan lengkap ya!`,
    ];
    return fallbacks[Math.floor(Math.random() * fallbacks.length)];
  }

  // ============================================
  //   UI RENDERING
  // ============================================

  function buildUI() {
    // Inject CSS
    const style = document.createElement('style');
    style.textContent = `
      /* ---- AI BUTTON ---- */
      #ai-fab {
        position: fixed;
        bottom: 28px;
        right: 28px;
        width: 58px;
        height: 58px;
        border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        color: #fff;
        border: none;
        cursor: pointer;
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 22px;
        box-shadow: 0 6px 24px rgba(99,102,241,0.5);
        transition: transform .2s, box-shadow .2s;
        animation: ai-pulse 3s ease-in-out infinite;
      }
      #ai-fab:hover { transform: scale(1.1); box-shadow: 0 8px 30px rgba(99,102,241,0.65); }
      @keyframes ai-pulse {
        0%, 100% { box-shadow: 0 6px 24px rgba(99,102,241,0.5); }
        50% { box-shadow: 0 6px 34px rgba(99,102,241,0.75); }
      }
      #ai-fab .ai-badge {
        position: absolute;
        top: -3px; right: -3px;
        width: 16px; height: 16px;
        background: #22c55e;
        border-radius: 50%;
        border: 2px solid var(--bg-main, #111827);
        animation: badge-blink 2s ease-in-out infinite;
      }
      @keyframes badge-blink {
        0%,100%{ opacity:1 } 50%{ opacity:0.4 }
      }

      /* ---- CHAT PANEL ---- */
      #ai-panel {
        position: fixed;
        bottom: 100px;
        right: 28px;
        width: 360px;
        max-width: calc(100vw - 32px);
        background: var(--bg-card, #1e2433);
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 20px;
        box-shadow: 0 20px 60px rgba(0,0,0,0.4);
        z-index: 9998;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        transform: scale(0.85) translateY(20px);
        opacity: 0;
        pointer-events: none;
        transition: transform .3s cubic-bezier(.34,1.56,.64,1), opacity .25s ease;
        max-height: 520px;
      }
      #ai-panel.open {
        transform: scale(1) translateY(0);
        opacity: 1;
        pointer-events: all;
      }

      /* Header */
      .ai-header {
        padding: 14px 16px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .ai-avatar {
        width: 36px; height: 36px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        display: flex; align-items: center; justify-content: center;
        font-size: 18px;
        flex-shrink: 0;
      }
      .ai-header-info { flex: 1; }
      .ai-header-name { font-weight: 700; font-size: 14px; color: #fff; }
      .ai-header-status { font-size: 11px; color: rgba(255,255,255,0.75); display: flex; align-items: center; gap: 4px; }
      .ai-header-status::before { content: ''; width: 6px; height: 6px; background: #22c55e; border-radius: 50%; display: inline-block; }
      .ai-close-btn {
        background: rgba(255,255,255,0.15); border: none; color: #fff;
        width: 28px; height: 28px; border-radius: 8px; cursor: pointer;
        font-size: 12px; transition: background .2s;
      }
      .ai-close-btn:hover { background: rgba(255,255,255,0.3); }

      /* Messages */
      .ai-messages {
        flex: 1;
        overflow-y: auto;
        padding: 14px 14px 4px;
        display: flex;
        flex-direction: column;
        gap: 10px;
        scrollbar-width: thin;
        scrollbar-color: rgba(99,102,241,0.3) transparent;
      }
      .ai-messages::-webkit-scrollbar { width: 4px; }
      .ai-messages::-webkit-scrollbar-thumb { background: rgba(99,102,241,0.3); border-radius: 4px; }

      .msg-row { display: flex; gap: 8px; align-items: flex-end; }
      .msg-row.user { flex-direction: row-reverse; }

      .msg-icon {
        width: 28px; height: 28px; border-radius: 50%;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        display: flex; align-items: center; justify-content: center;
        font-size: 13px; color: #fff; flex-shrink: 0;
      }
      .msg-row.user .msg-icon { background: linear-gradient(135deg, #059669, #10b981); }

      .msg-bubble {
        max-width: 76%;
        background: var(--bg-hover, rgba(255,255,255,0.05));
        border: 1px solid var(--border, rgba(255,255,255,0.08));
        border-radius: 16px 16px 16px 4px;
        padding: 10px 13px;
        font-size: 13px;
        line-height: 1.55;
        color: var(--text-primary, #f1f5f9);
        word-break: break-word;
      }
      .msg-row.user .msg-bubble {
        background: linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.25));
        border-color: rgba(99,102,241,0.4);
        border-radius: 16px 16px 4px 16px;
      }
      .msg-time {
        font-size: 10px;
        color: var(--text-muted, #64748b);
        margin-top: 3px;
        text-align: right;
      }
      .msg-row.bot .msg-time { text-align: left; }

      /* Typing indicator */
      .typing-indicator { display: flex; gap: 4px; align-items: center; padding: 12px 14px; }
      .typing-dot {
        width: 7px; height: 7px; background: #6366f1;
        border-radius: 50%; animation: typing-bounce .8s ease-in-out infinite;
      }
      .typing-dot:nth-child(2) { animation-delay: .15s; }
      .typing-dot:nth-child(3) { animation-delay: .3s; }
      @keyframes typing-bounce {
        0%,60%,100%{ transform: translateY(0) } 30%{ transform: translateY(-6px) }
      }

      /* Quick actions */
      .ai-quick-actions {
        padding: 6px 14px 4px;
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }
      .ai-quick-btn {
        font-size: 11px;
        padding: 4px 10px;
        border-radius: 20px;
        border: 1px solid rgba(99,102,241,0.4);
        background: rgba(99,102,241,0.1);
        color: #a5b4fc;
        cursor: pointer;
        transition: all .2s;
        white-space: nowrap;
      }
      .ai-quick-btn:hover {
        background: rgba(99,102,241,0.25);
        border-color: #6366f1;
        color: #c7d2fe;
      }

      /* Input area */
      .ai-input-row {
        padding: 10px 12px 14px;
        display: flex;
        gap: 8px;
        align-items: flex-end;
        border-top: 1px solid var(--border, rgba(255,255,255,0.06));
      }
      .ai-input {
        flex: 1;
        background: var(--bg-input, rgba(255,255,255,0.06));
        border: 1px solid var(--border, rgba(255,255,255,0.1));
        border-radius: 12px;
        color: var(--text-primary, #f1f5f9);
        font-family: 'Plus Jakarta Sans', sans-serif;
        font-size: 13px;
        padding: 9px 13px;
        resize: none;
        outline: none;
        min-height: 38px;
        max-height: 90px;
        overflow-y: auto;
        transition: border-color .2s;
        line-height: 1.4;
      }
      .ai-input:focus { border-color: #6366f1; }
      .ai-input::placeholder { color: var(--text-muted, #64748b); }
      .ai-send-btn {
        width: 38px; height: 38px; border-radius: 10px;
        background: linear-gradient(135deg, #6366f1, #8b5cf6);
        border: none; color: #fff; cursor: pointer;
        font-size: 15px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        transition: transform .15s, opacity .2s;
      }
      .ai-send-btn:hover { transform: scale(1.08); }
      .ai-send-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

      /* Responsive */
      @media (max-width: 480px) {
        #ai-panel { right: 12px; bottom: 90px; width: calc(100vw - 24px); }
        #ai-fab { right: 16px; bottom: 20px; }
      }
    `;
    document.head.appendChild(style);

    // FAB Button
    const fab = document.createElement('button');
    fab.id = 'ai-fab';
    fab.title = 'AI Assistant';
    fab.innerHTML = `<i class="fa-solid fa-robot"></i><span class="ai-badge"></span>`;
    fab.addEventListener('click', toggleChat);
    document.body.appendChild(fab);

    // Chat Panel
    const panel = document.createElement('div');
    panel.id = 'ai-panel';
    panel.innerHTML = `
      <div class="ai-header">
        <div class="ai-avatar">🤖</div>
        <div class="ai-header-info">
          <div class="ai-header-name">Asisten Pintar</div>
          <div class="ai-header-status">Online — siap membantu</div>
        </div>
        <button class="ai-close-btn" onclick="window._aiToggle()"><i class="fa-solid fa-xmark"></i></button>
      </div>
      <div class="ai-messages" id="ai-messages"></div>
      <div class="ai-quick-actions" id="ai-quick-actions">
        <button class="ai-quick-btn" onclick="window._aiSendQuick('Semua hadir')">✅ Semua hadir</button>
        <button class="ai-quick-btn" onclick="window._aiSendQuick('Siapa yang belum absen?')">🔍 Cek belum</button>
        <button class="ai-quick-btn" onclick="window._aiSendQuick('Tampilkan absen hari ini')">📋 Hari ini</button>
        <button class="ai-quick-btn" onclick="window._aiSendQuick('bantuan')">❓ Bantuan</button>
      </div>
      <div class="ai-input-row">
        <textarea class="ai-input" id="ai-input" placeholder="Ketik perintah... (contoh: Ahmad Nauval sakit)" rows="1"></textarea>
        <button class="ai-send-btn" id="ai-send-btn" onclick="window._aiSubmit()">
          <i class="fa-solid fa-paper-plane"></i>
        </button>
      </div>
    `;
    document.body.appendChild(panel);

    // Input events
    const inputEl = document.getElementById('ai-input');
    inputEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        window._aiSubmit();
      }
    });
    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(inputEl.scrollHeight, 90) + 'px';
    });

    // Global refs
    window._aiToggle  = toggleChat;
    window._aiSubmit  = submitChat;
    window._aiSendQuick = sendQuick;

    // Welcome message
    setTimeout(() => {
      addBotMessage("Halo! 👋 Aku <strong>Asisten Pintar AbsenKelas</strong>.<br>Ketik perintah absensi atau klik tombol cepat di atas. Ketik <em>bantuan</em> untuk panduan lengkap!");
    }, 400);
  }

  function toggleChat() {
    chatOpen = !chatOpen;
    const panel = document.getElementById('ai-panel');
    if (panel) panel.classList.toggle('open', chatOpen);
    if (chatOpen) {
      setTimeout(() => {
        const input = document.getElementById('ai-input');
        if (input) input.focus();
        scrollMessages();
      }, 300);
    }
  }

  function sendQuick(text) {
    if (!chatOpen) toggleChat();
    setTimeout(() => submitChat(text), 150);
  }

  function submitChat(forcedText) {
    const inputEl = document.getElementById('ai-input');
    const text = typeof forcedText === 'string' ? forcedText : inputEl.value.trim();
    if (!text || isTyping) return;

    addUserMessage(text);
    if (inputEl && typeof forcedText !== 'string') {
      inputEl.value = '';
      inputEl.style.height = 'auto';
    }

    isTyping = true;
    document.getElementById('ai-send-btn').disabled = true;
    showTyping();

    const delay = 500 + Math.random() * 700;
    setTimeout(() => {
      hideTyping();
      const reply = processInput(text);
      addBotMessage(reply);
      isTyping = false;
      document.getElementById('ai-send-btn').disabled = false;
    }, delay);
  }

  function addUserMessage(text) {
    const msgs = document.getElementById('ai-messages');
    if (!msgs) return;
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = 'msg-row user';
    div.innerHTML = `
      <div>
        <div class="msg-bubble">${escHtml(text)}</div>
        <div class="msg-time">${time}</div>
      </div>
      <div class="msg-icon"><i class="fa-solid fa-user"></i></div>
    `;
    msgs.appendChild(div);
    scrollMessages();
    chatHistory.push({ role: 'user', text });
  }

  function addBotMessage(html) {
    const msgs = document.getElementById('ai-messages');
    if (!msgs) return;
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const div = document.createElement('div');
    div.className = 'msg-row bot';
    div.style.opacity = '0';
    div.style.transform = 'translateY(6px)';
    div.style.transition = 'opacity .25s, transform .25s';
    div.innerHTML = `
      <div class="msg-icon">🤖</div>
      <div>
        <div class="msg-bubble">${html}</div>
        <div class="msg-time">${time}</div>
      </div>
    `;
    msgs.appendChild(div);
    requestAnimationFrame(() => {
      div.style.opacity = '1';
      div.style.transform = 'translateY(0)';
    });
    scrollMessages();
    chatHistory.push({ role: 'bot', html });
  }

  function showTyping() {
    const msgs = document.getElementById('ai-messages');
    if (!msgs) return;
    const div = document.createElement('div');
    div.className = 'msg-row bot';
    div.id = 'ai-typing';
    div.innerHTML = `
      <div class="msg-icon">🤖</div>
      <div class="msg-bubble typing-indicator">
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
        <span class="typing-dot"></span>
      </div>
    `;
    msgs.appendChild(div);
    scrollMessages();
  }

  function hideTyping() {
    const el = document.getElementById('ai-typing');
    if (el) el.remove();
  }

  function scrollMessages() {
    const msgs = document.getElementById('ai-messages');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function escHtml(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ---- INIT ----
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }

})();
