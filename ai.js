// ============================================
//   AbsenKelas — AI Assistant v3.0 (ai.js)
//   Professional | Personalized | No API
//   Onboarding · LocalStorage · Modern UI
// ============================================

(function () {
  'use strict';

  // ============================================
  //   CORE STATE
  // ============================================
  let chatOpen        = false;
  let isTyping        = false;
  let conversationCtx = [];
  let undoStack       = [];
  let pendingConfirm  = null;
  let lastAction      = null;
  let onboardingStep  = 0; // 0=done, 1=ask-name
  let userName        = '';

  // ============================================
  //   LANGUAGE DATA
  // ============================================

  const STATUS_ALIASES = {
    Hadir: ['hadir','masuk','datang','ada','present','attend','hadirlah','ngantor'],
    Sakit: ['sakit','tidak sehat','demam','flu','opname','rs','rumah sakit','unwell','sick','pusing','batuk','isoman','isolasi','kurang sehat'],
    Izin:  ['izin','ijin','permisi','permit','cuti','tidak bisa','gabisa','berhalangan','pamit','pamitan'],
    Alpa:  ['alpa','alpha','bolos','mangkir','absen tanpa keterangan','tanpa keterangan','ga masuk','gak masuk','nggak masuk','tidak masuk','absent'],
  };

  const PARAPHRASE_RULES = [
    [/kayak(nya)?|sepertinya|kelihatannya/gi, ''],
    [/hari ini semua (masuk|datang)/gi, 'semua hadir'],
    [/semua (masuk|datang)/gi, 'semua hadir'],
    [/yang (gak|ga|nggak|tidak) hadir (cuma|hanya|itu|adalah)/gi, 'kecuali'],
    [/sisanya (masuk|datang)/gi, 'sisanya hadir'],
    [/tandai yang belum (jadi|sebagai|menjadi)/gi, 'tandai belum'],
    [/yang belum (diisi|terisi|ada) (jadi|menjadi|sebagai)/gi, 'tandai belum'],
    [/isi (yang )?belum (dengan|jadi|sebagai)/gi, 'tandai belum'],
  ];

  const KW_SEMUA   = ['semua','seluruh','all','semuanya','semua siswa','semua anak','seluruh siswa'];
  const KW_KECUALI = ['kecuali','terkecuali','selain','except','minus','tidak termasuk','di luar'];
  const KW_SISANYA = ['sisanya','yang lain','yang lainnya','selain mereka','selebihnya','lainnya'];

  const KW_CEKHARI    = ['absen hari ini','absensi hari ini','tampilkan absen','lihat absen','cek absen','status absen','siapa yang hadir','absen sekarang','status hari ini','lihat status','kondisi hari ini'];
  const KW_BELUM      = ['belum absen','siapa belum','yang belum','belum diisi','belum ada','sisa absen','siapa aja belum','siapa yang belum','belum lengkap','masih kosong'];
  const KW_REKAP      = ['rekap','rekapitulasi','statistik','summary','ringkasan','laporan bulan','rekap bulan','laporan','data keseluruhan','overall'];
  const KW_RESET      = ['reset','hapus','clear','bersihkan','kosongkan','ulang','restart','mulai ulang'];
  const KW_BANTUAN    = ['bantuan','help','tolong','cara pakai','bisa apa','apa saja','fitur','perintah','command','panduan','tutorial','cara','contoh','petunjuk'];
  const KW_HALO       = ['halo','hai','hello','hi','hey','selamat','assalamu','pagi','siang','sore','malam','apa kabar'];
  const KW_TERIMA     = ['terima kasih','makasih','thanks','thank you','thx','mantap','bagus','keren','oke sip','sip bos'];
  const KW_YA         = ['ya','yap','yep','oke','ok','iya','betul','bener','setuju','lanjut','gas','sip','lakukan','lanjutkan','konfirmasi','yes'];
  const KW_TIDAK      = ['tidak','nggak','ga','gak','batal','cancel','stop','gajadi','jangan','nope','no','tidak jadi','ndak'];
  const KW_UNDO       = ['undo','batalkan','batal aksi','kembalikan','undone','batalkan perubahan','balik lagi'];
  const KW_STAT_HADIR = ['berapa yang hadir','jumlah hadir','total hadir','berapa hadir','siapa hadir'];
  const KW_STAT_SAKIT = ['berapa yang sakit','jumlah sakit','siapa sakit','yang sakit hari ini'];
  const KW_STAT_IZIN  = ['berapa yang izin','jumlah izin','siapa izin','yang izin hari ini'];
  const KW_STAT_ALPA  = ['berapa yang alpa','jumlah alpa','siapa alpa','yang alpa hari ini'];
  const KW_MOST_ALPA  = ['paling sering alpa','sering bolos','paling banyak alpa','rangking alpa','siapa paling bolos'];
  const KW_STAT_WEEK  = ['rekap minggu','minggu ini','7 hari','seminggu terakhir'];
  const KW_STAT_MONTH = ['rekap bulan','bulan ini','summary bulan','laporan bulan ini'];
  const KW_GANTI_NAMA = ['ganti nama','ubah nama','nama saya','nama aku','panggil saya','panggil aku'];
  const KW_PIKET     = ['piket','petugas piket','jadwal piket','siapa piket'];
  const KW_MBG       = ['mbg','makan bergizi','petugas mbg','ambil mbg','siapa mbg','jadwal mbg'];
  const KW_ORGANISASI = ['organisasi','struktur','ketua kelas','wali kelas','pengurus kelas','jabatan','struktur kelas'];

  // ============================================
  //   TEXT UTILITIES
  // ============================================

  function norm(text) {
    return String(text).toLowerCase()
      .replace(/[.,!?;:\-\/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function applyParaphrases(text) {
    let t = text;
    PARAPHRASE_RULES.forEach(([pattern, replace]) => { t = t.replace(pattern, replace); });
    return t;
  }

  function hasAny(text, list) {
    const t = norm(text);
    return list.some(kw => t.includes(norm(kw)));
  }

  // ============================================
  //   LEVENSHTEIN FUZZY MATCH
  // ============================================

  function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({ length: m + 1 }, (_, i) =>
      Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
    );
    for (let i = 1; i <= m; i++)
      for (let j = 1; j <= n; j++)
        dp[i][j] = a[i-1] === b[j-1]
          ? dp[i-1][j-1]
          : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    return dp[m][n];
  }

  function tokenFuzzyMatch(inputToken, nameToken) {
    if (inputToken === nameToken) return true;
    if (Math.min(inputToken.length, nameToken.length) < 5) return false;
    return levenshtein(inputToken, nameToken) <= 1;
  }

  function buildSharedTokens(students) {
    const count = {};
    students.forEach(name => {
      norm(name).split(' ').forEach(tok => { count[tok] = (count[tok] || 0) + 1; });
    });
    return new Set(Object.keys(count).filter(tok => count[tok] > 1));
  }

  function getUniqueTokens(name, sharedTokens) {
    return norm(name).split(' ').filter(tok => tok.length >= 3 && !sharedTokens.has(tok));
  }

  function findStudentNames(text, students) {
    const sharedTokens = buildSharedTokens(students);
    const found = [];
    const t = norm(applyParaphrases(text));

    const STATUS_WORDS = new Set([
      'hadir','masuk','datang','ada','sakit','demam','flu','izin','ijin','cuti','alpa','alpha','bolos',
      'semua','kecuali','dan','sama','juga','serta','hari','ini','yang','jadi','mau','minta','tolong',
      'tandai','ubah','ganti','tidak','ga','gak','nggak','ya','oke','ok','dengan','sebagai',
      'sisanya','lainnya','lain','selebihnya','selain','semuanya','seluruh','please','mohon','coba',
    ]);
    const inputTokens = t.split(' ').filter(tok => tok.length >= 2 && !STATUS_WORDS.has(tok));

    students.forEach(name => {
      const nl = norm(name);
      const nameParts = nl.split(' ').filter(p => p.length >= 2);

      if (t.includes(nl)) { found.push(name); return; }

      const uniqueTokens = getUniqueTokens(name, sharedTokens);
      if (uniqueTokens.length > 0) {
        if (uniqueTokens.every(ut => t.includes(ut))) { found.push(name); return; }

        const matchedUT = uniqueTokens.filter(ut => t.includes(ut));
        if (matchedUT.length > 0) {
          const spoiled = inputTokens.some(tok => {
            if (uniqueTokens.includes(tok)) return false;
            const rival = students.find(s => {
              if (norm(s) === nl) return false;
              return getUniqueTokens(s, sharedTokens).includes(tok);
            });
            return !!rival;
          });
          if (!spoiled) { found.push(name); return; }
        }

        if (uniqueTokens.every(ut => {
          if (t.includes(ut)) return true;
          return inputTokens.some(tok => {
            if (!tokenFuzzyMatch(tok, ut)) return false;
            const exactOther = students.some(s => {
              if (norm(s) === nl) return false;
              return getUniqueTokens(s, sharedTokens).includes(tok);
            });
            return !exactOther;
          });
        })) {
          found.push(name); return;
        }
      }

      const hasShared = nameParts.some(p => sharedTokens.has(p));
      if (!hasShared && nameParts.every(p => t.includes(p))) {
        found.push(name); return;
      }

      const sharedInInput = nameParts.filter(p => sharedTokens.has(p) && t.includes(p));
      if (sharedInInput.length > 0) {
        const contradicts = inputTokens.some(tok => {
          if (nameParts.includes(tok)) return false;
          if (sharedTokens.has(tok)) return false;
          const otherStudent = students.find(s => {
            if (norm(s) === nl) return false;
            const uq = getUniqueTokens(s, sharedTokens);
            return uq.some(ut => ut === tok || tokenFuzzyMatch(tok, ut));
          });
          return !!otherStudent;
        });
        if (!contradicts && inputTokens.length > 0) { found.push(name); return; }
      }
    });

    return [...new Set(found)];
  }

  // ============================================
  //   STATUS DETECTION
  // ============================================

  function detectStatus(text) {
    const t = norm(text);
    for (const [status, aliases] of Object.entries(STATUS_ALIASES)) {
      const sorted = [...aliases].sort((a, b) => b.length - a.length);
      for (const alias of sorted) {
        if (t.includes(norm(alias))) return status;
      }
    }
    return null;
  }

  function parseMultiPairs(text) {
    const rawSegs = text.split(/,|\bdan\b|\bsama\b|\bserta\b/i).map(s => s.trim()).filter(Boolean);
    const pairs = {};
    const segData = rawSegs.map(seg => ({
      seg,
      status: detectStatus(seg),
      names: findStudentNames(seg, STUDENTS),
    }));

    let trailingStatus = null;
    for (let i = segData.length - 1; i >= 0; i--) {
      if (segData[i].status) { trailingStatus = segData[i].status; break; }
    }

    segData.forEach(({ seg, status, names }) => {
      const resolvedStatus = status || trailingStatus;
      if (!resolvedStatus || names.length === 0) return;
      names.forEach(n => { pairs[n] = resolvedStatus; });
    });

    return Object.keys(pairs).length > 0 ? pairs : null;
  }

  // ============================================
  //   STORAGE BRIDGE
  // ============================================

  function getTodayData() {
    return getStorage()[todayKey()] || null;
  }

  function getCurrentRecords() {
    const td = getTodayData();
    if (td) return { locked: true, records: { ...td.records } };
    return { locked: false, records: { ...currentSelections } };
  }

  function snapshotState() {
    const { locked, records } = getCurrentRecords();
    return { locked, records: { ...records } };
  }

  function pushUndo(label) {
    undoStack.push({ snap: snapshotState(), label });
    if (undoStack.length > 12) undoStack.shift();
  }

  function applyAttendance(changes) {
    const td = getTodayData();
    if (td) {
      const data = getStorage();
      Object.assign(data[todayKey()].records, changes);
      setStorage(data);
    } else {
      Object.assign(currentSelections, changes);
    }
    refreshUI();
  }

  function restoreSnapshot(snap) {
    if (snap.locked) {
      const data = getStorage();
      const key = todayKey();
      if (data[key]) { data[key].records = { ...snap.records }; setStorage(data); }
    } else {
      STUDENTS.forEach(n => { delete currentSelections[n]; });
      Object.assign(currentSelections, snap.records);
    }
    refreshUI();
  }

  function refreshUI() {
    // checkTodayLocked already calls renderStudentList internally, so we skip it here
    // to avoid double-render that could overwrite currentSelections display
    if (typeof window.checkTodayLocked === 'function') window.checkTodayLocked();
    if (typeof window.updateQuickStats === 'function') window.updateQuickStats();
    if (typeof window.renderRiwayat === 'function') window.renderRiwayat();
    if (typeof window.renderRekap === 'function') window.renderRekap();
  }

  function resetToday() {
    pushUndo('Reset absensi hari ini');
    const data = getStorage();
    delete data[todayKey()];
    setStorage(data);
    STUDENTS.forEach(n => { delete currentSelections[n]; });
    refreshUI();
  }

  function checkUnfilled() {
    const { records } = getCurrentRecords();
    return STUDENTS.filter(n => !records[n]);
  }

  function getStatsByStatus() {
    const { records } = getCurrentRecords();
    const r = { Hadir: [], Sakit: [], Izin: [], Alpa: [] };
    STUDENTS.forEach(n => { const s = records[n]; if (s && r[s]) r[s].push(n); });
    return r;
  }

  // ============================================
  //   USER NAME MANAGEMENT
  // ============================================

  function loadUserName() {
    return localStorage.getItem('absenKelas_userName') || '';
  }

  function saveUserName(name) {
    localStorage.setItem('absenKelas_userName', name.trim());
    userName = name.trim();
  }

  // ============================================
  //   INTENT DETECTION
  // ============================================

  function detectIntent(raw) {
    const text = applyParaphrases(raw);
    const t    = norm(text);

    if (hasAny(t, KW_GANTI_NAMA)) return { type: 'change_name' };
    if (hasAny(t, KW_HALO))    return { type: 'greet' };
    if (hasAny(t, KW_TERIMA))  return { type: 'thanks' };
    if (hasAny(t, KW_BANTUAN)) return { type: 'help' };

    if (pendingConfirm) {
      if (hasAny(t, KW_YA))    return { type: 'confirm_yes' };
      if (hasAny(t, KW_TIDAK)) return { type: 'confirm_no' };
    }

    if (hasAny(t, KW_UNDO)) return { type: 'undo' };

    // New management features
    if (hasAny(t, KW_PIKET))      return { type: 'info_piket' };
    if (hasAny(t, KW_MBG))        return { type: 'info_mbg' };
    if (hasAny(t, KW_ORGANISASI)) return { type: 'info_organisasi' };

    if (hasAny(t, KW_MOST_ALPA))  return { type: 'stat_most_absent' };
    if (hasAny(t, KW_STAT_HADIR)) return { type: 'stat_query', status: 'Hadir' };
    if (hasAny(t, KW_STAT_SAKIT)) return { type: 'stat_query', status: 'Sakit' };
    if (hasAny(t, KW_STAT_IZIN))  return { type: 'stat_query', status: 'Izin' };
    if (hasAny(t, KW_STAT_ALPA))  return { type: 'stat_query', status: 'Alpa' };
    if (hasAny(t, KW_STAT_WEEK))  return { type: 'stat_period', period: 'week' };
    if (hasAny(t, KW_STAT_MONTH)) return { type: 'stat_period', period: 'month' };

    if (hasAny(t, KW_BELUM))   return { type: 'check_unfilled' };
    if (hasAny(t, KW_CEKHARI)) return { type: 'check_today' };
    if (hasAny(t, KW_REKAP))   return { type: 'open_rekap' };

    if (hasAny(t, KW_RESET) && (t.includes('hari ini') || t.includes('absen') || t.includes('data') || t.includes('semua'))) {
      return { type: 'reset_confirm' };
    }

    const tbMatch = t.match(/tandai (yang )?belum\s*(\w+)?/);
    if (tbMatch) {
      const sw = tbMatch[2] || '';
      const st = detectStatus(sw) || detectStatus(t) || 'Alpa';
      return { type: 'fill_remaining', status: st };
    }
    if (hasAny(t, KW_SISANYA)) {
      return { type: 'fill_remaining', status: detectStatus(t) || 'Hadir' };
    }

    if (hasAny(t, KW_KECUALI) && !hasAny(t, KW_SEMUA) && lastAction === 'mark_all') {
      return { type: 'exception_followup' };
    }

    if (hasAny(t, KW_SEMUA)) return { type: 'mark_all' };

    const hasSeparator = /,|\bdan\b|\bsama\b|\bserta\b/.test(t);
    const multi = parseMultiPairs(text);
    if (multi && Object.keys(multi).length >= 1 && hasSeparator) {
      if (Object.keys(multi).length > 1) return { type: 'mark_multi', changes: multi };
      const firstName = Object.keys(multi)[0];
      return { type: 'mark_specific', names: [firstName], status: multi[firstName] };
    }

    const status = detectStatus(text);
    if (status) {
      const names = findStudentNames(text, STUDENTS);
      if (names.length > 0) return { type: 'mark_specific', names, status };
      return { type: 'status_no_name', status };
    }

    const names = findStudentNames(text, STUDENTS);
    if (names.length > 0) return { type: 'name_no_status', names };

    return { type: 'unknown' };
  }

  // ============================================
  //   STATUS ICON SVG
  // ============================================

  const STATUS_ICON = {
    Hadir: `<span class="si hadir-icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></span>`,
    Sakit: `<span class="si sakit-icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg></span>`,
    Izin:  `<span class="si izin-icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></span>`,
    Alpa:  `<span class="si alpa-icon"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></span>`,
  };

  // ============================================
  //   HANDLERS
  // ============================================

  function handle(intent, rawText) {
    const t = norm(applyParaphrases(rawText));
    const u = userName;

    switch (intent.type) {

      case 'change_name': {
        onboardingStep = 1;
        return `Tentu${u ? ', ' + u : ''}. Nama baru Anda?`;
      }

      case 'greet':  return replyGreet();
      case 'thanks': return replyThanks();
      case 'help':   return replyHelp();

      case 'confirm_yes': {
        if (!pendingConfirm) return 'Tidak ada aksi yang menunggu konfirmasi.';
        const fn = pendingConfirm.fn;
        pendingConfirm = null;
        return fn();
      }
      case 'confirm_no': {
        pendingConfirm = null;
        return `Dibatalkan${u ? ', ' + u : ''}. Tidak ada yang berubah.`;
      }

      case 'undo': {
        if (undoStack.length === 0) return 'Tidak ada aksi yang bisa dibatalkan saat ini.';
        const { snap, label } = undoStack.pop();
        restoreSnapshot(snap);
        return `Berhasil dibatalkan: <strong>${label}</strong>. Data kembali seperti sebelumnya.`;
      }

      case 'reset_confirm': {
        pendingConfirm = {
          fn: () => { resetToday(); return `Absensi hari ini sudah direset${u ? ', ' + u : ''}. Silakan isi ulang dari awal.`; },
          label: 'Reset absensi hari ini'
        };
        return `${u ? u + ', yakin' : 'Yakin'} ingin <strong>mereset absensi hari ini</strong>? Semua data hari ini akan dihapus.<br><br>Ketik <em>ya</em> untuk lanjut atau <em>tidak</em> untuk batal.`;
      }

      case 'mark_all': {
        const mainStatus = detectStatus(t) || 'Hadir';
        const changes = {};
        let exceptions = [];
        let excStatuses = {};
        let afterKecuali = '';

        for (const kw of KW_KECUALI) {
          if (t.includes(norm(kw))) {
            afterKecuali = t.split(norm(kw)).slice(1).join(' ');
            break;
          }
        }

        if (afterKecuali) {
          const excPairs = parseMultiPairs(afterKecuali);
          if (excPairs) {
            exceptions = Object.keys(excPairs);
            excStatuses = excPairs;
          } else {
            exceptions = findStudentNames(afterKecuali, STUDENTS);
            const excSt = detectStatus(afterKecuali) || 'Alpa';
            exceptions.forEach(n => { excStatuses[n] = excSt; });
          }
        }

        pushUndo('Tandai semua ' + mainStatus);
        STUDENTS.forEach(n => { changes[n] = exceptions.includes(n) ? excStatuses[n] : mainStatus; });
        applyAttendance(changes);
        lastAction = 'mark_all';

        let msg = `${u ? u + ', s' : 'S'}emua <strong>${STUDENTS.length} siswa</strong> ditandai ${STATUS_ICON[mainStatus]} <strong>${mainStatus}</strong>`;
        if (exceptions.length > 0) {
          msg += `<br><br>Pengecualian:<br>`;
          exceptions.forEach(nm => { msg += `<span class="name-chip">${nm}</span> ${STATUS_ICON[excStatuses[nm]]} ${excStatuses[nm]}<br>`; });
        }
        return msg + buildCompletionHint();
      }

      case 'mark_specific': {
        const { names, status } = intent;
        const changes = {};
        names.forEach(n => { changes[n] = status; });
        pushUndo(`Tandai ${names.slice(0,2).join(', ')}${names.length > 2 ? '...' : ''} → ${status}`);
        applyAttendance(changes);
        lastAction = 'mark_specific';

        let msg = '';
        if (names.length === 1) {
          msg = `${STATUS_ICON[status]} <span class="name-chip">${names[0]}</span> ditandai <strong>${status}</strong>.`;
        } else {
          msg = `${STATUS_ICON[status]} <strong>${names.length} siswa</strong> ditandai <strong>${status}</strong>:<br>`;
          msg += names.map(n => `<span class="name-chip">${n}</span>`).join(' ');
        }
        return msg + buildCompletionHint();
      }

      case 'mark_multi': {
        const { changes } = intent;
        pushUndo('Tandai beberapa siswa sekaligus');
        applyAttendance(changes);
        lastAction = 'mark_specific';

        let msg = `<strong>${Object.keys(changes).length} siswa</strong> berhasil diperbarui:<br><br>`;
        Object.entries(changes).forEach(([nm, st]) => { msg += `<span class="name-chip">${nm}</span> ${STATUS_ICON[st]} ${st}<br>`; });
        return msg + buildCompletionHint();
      }

      case 'fill_remaining': {
        const { status } = intent;
        const unfilled = checkUnfilled();
        if (unfilled.length === 0) return `Semua siswa sudah tercatat${u ? ', ' + u : ''}. Tidak ada yang perlu diisi lagi.`;

        pushUndo(`Isi sisa ${unfilled.length} siswa ke ${status}`);
        const changes = {};
        unfilled.forEach(n => { changes[n] = status; });
        applyAttendance(changes);
        lastAction = 'fill_remaining';

        let msg = `${u ? u + ', ' : ''}<strong>${unfilled.length} siswa</strong> yang belum tercatat ditandai ${STATUS_ICON[status]} <strong>${status}</strong>:<br>`;
        msg += unfilled.map(n => `<span class="name-chip">${n}</span>`).join(' ');
        return msg + buildCompletionHint();
      }

      case 'exception_followup': {
        let afterKecuali = '';
        for (const kw of KW_KECUALI) {
          if (t.includes(norm(kw))) { afterKecuali = t.split(norm(kw)).slice(1).join(' '); break; }
        }
        const excPairs = parseMultiPairs(afterKecuali);
        const names    = excPairs ? Object.keys(excPairs) : findStudentNames(afterKecuali, STUDENTS);
        if (names.length === 0) return `Nama siswa tidak ditemukan. Coba tulis nama lengkapnya.`;

        pushUndo('Update pengecualian');
        const changes = {};
        if (excPairs) {
          Object.assign(changes, excPairs);
        } else {
          const excSt = detectStatus(afterKecuali) || 'Alpa';
          names.forEach(n => { changes[n] = excSt; });
        }
        applyAttendance(changes);

        let msg = `Siap, saya perbarui:<br>`;
        Object.entries(changes).forEach(([nm, s]) => { msg += `<span class="name-chip">${nm}</span> ${STATUS_ICON[s]} ${s}<br>`; });
        return msg + buildCompletionHint();
      }

      case 'check_unfilled': {
        const unfilled = checkUnfilled();
        if (unfilled.length === 0) return `Absensi hari ini sudah lengkap${u ? ', ' + u : ''}. Semua siswa sudah tercatat.`;
        let msg = `${u ? u + ', m' : 'M'}asih terdapat <strong>${unfilled.length} siswa</strong> yang belum tercatat:<br><br>`;
        unfilled.forEach((n, i) => { msg += `${i+1}. ${n}<br>`; });
        if (unfilled.length <= 6) msg += `<br><em>Ketik "sisanya hadir" atau "tandai yang belum jadi alpa".</em>`;
        return msg;
      }

      case 'check_today': {
        const { locked, records } = getCurrentRecords();
        const byStatus = getStatsByStatus();
        const filled   = STUDENTS.filter(n => records[n]).length;
        if (filled === 0) return `Belum ada absensi hari ini${u ? ', ' + u : ''}.<br><br><em>Ketik "semua hadir" untuk mengisi sekaligus.</em>`;

        let msg = `<strong>Rekap Absensi Hari Ini</strong>${locked ? ' <span class="saved-badge">Tersimpan</span>' : ''}:<br><br>`;
        Object.entries(byStatus).forEach(([st, nms]) => {
          if (nms.length) msg += `${STATUS_ICON[st]} <strong>${st}</strong> (${nms.length}): ${nms.join(', ')}<br>`;
        });
        const un = checkUnfilled().length;
        if (un > 0) msg += `<br><strong>${un} siswa</strong> belum tercatat.`;
        else msg += `<br>Semua siswa sudah tercatat.`;
        return msg;
      }

      case 'info_piket': {
        const nav = document.querySelector('[data-page="piket"]');
        if (nav) nav.click();
        const now = new Date();
        const hariIdx = now.getDay();
        const HARI_PIKET = { 1:['Sauqi','Dani','Ani','Andina'], 2:['Nikma','Hatipah','Raihan Alfarezy'], 3:['Raffi','Rudi','Husna','Yuli'], 4:['Azhar','Tajudin','Aulia','Aderia'], 5:['Nauval','Jurifky','Asyifa','Aspia'], 6:['Rudi','Hanafi','Amelia','Nazua'] };
        const NAMA_HARI = ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
        if (hariIdx === 0) return `Hari ini Minggu. Tidak ada jadwal piket.`;
        const petugas = HARI_PIKET[hariIdx] || [];
        let msg = `<strong>Petugas Piket Hari Ini (${NAMA_HARI[hariIdx]}):</strong><br><br>`;
        petugas.forEach((p, i) => { msg += `${i+1}. ${p}<br>`; });
        // check attendance
        const { records } = getCurrentRecords();
        const absen = petugas.filter(p => {
          const match = STUDENTS.find(s => s.toLowerCase().includes(p.toLowerCase()));
          return match && records[match] && records[match] !== 'Hadir';
        });
        if (absen.length > 0) msg += `<br><strong style="color:#f87171">Peringatan:</strong> ${absen.join(', ')} tidak hadir hari ini.`;
        return msg;
      }

      case 'info_mbg': {
        const nav = document.querySelector('[data-page="mbg"]');
        if (nav) nav.click();
        if (typeof window.getMBGTodaySesi === 'function') {
          const { sesi, members } = window.getMBGTodaySesi();
          let msg = `<strong>Petugas Ambil MBG Hari Ini (Sesi ${sesi}):</strong><br><br>`;
          members.forEach((m, i) => { msg += `${i+1}. ${m}<br>`; });
          return msg;
        }
        return `Membuka halaman <strong>Jadwal MBG</strong>...`;
      }

      case 'info_organisasi': {
        const nav = document.querySelector('[data-page="organisasi"]');
        if (nav) nav.click();
        return `<strong>Struktur Organisasi Kelas:</strong><br><br>
<strong>Wali Kelas:</strong> Ibu Istiqomah S.Pd.I<br>
<strong>Ketua:</strong> Muhammad Jurifky Alfarizi<br>
<strong>Wakil:</strong> Muhammad Tajudin<br>
<strong>Sekretaris:</strong> Amelia Rahmah<br>
<strong>Bendahara:</strong> Hayattul Husna`;
      }

      case 'open_rekap': {
        const btn = document.querySelector('[data-page="rekap"]');
        if (btn) btn.click();
        return `Membuka halaman <strong>Rekap & Statistik</strong>...`;
      }

      case 'stat_query': {
        const { status } = intent;
        const names = getStatsByStatus()[status];
        if (!names || names.length === 0) return `Tidak ada siswa dengan status <strong>${status}</strong> hari ini.`;
        let msg = `${STATUS_ICON[status]} <strong>${status}</strong> hari ini — ${names.length} siswa:<br><br>`;
        names.forEach((n, i) => { msg += `${i+1}. ${n}<br>`; });
        return msg;
      }

      case 'stat_most_absent': return handleMostAbsent();
      case 'stat_period': return handlePeriodStat(intent.period);

      case 'name_no_status': {
        const { names } = intent;
        conversationCtx.push({ type: 'pending_name', names });
        return `Ditemukan: <strong>${names.join(', ')}</strong>. Mau ditandai sebagai apa?<div class="quick-status-row"><button class="qs-btn" onclick="window._aiSendQuick('hadir')">Hadir</button><button class="qs-btn sakit" onclick="window._aiSendQuick('sakit')">Sakit</button><button class="qs-btn izin" onclick="window._aiSendQuick('izin')">Izin</button><button class="qs-btn alpa" onclick="window._aiSendQuick('alpa')">Alpa</button></div>`;
      }

      case 'status_no_name': {
        const lastCtx = [...conversationCtx].reverse().find(c => c.type === 'pending_name');
        if (lastCtx) {
          const { names } = lastCtx;
          const { status } = intent;
          const changes = {};
          names.forEach(n => { changes[n] = status; });
          pushUndo(`Tandai ${names.join(', ')} ke ${status}`);
          applyAttendance(changes);
          lastAction = 'mark_specific';
          return `${STATUS_ICON[status]} <span class="name-chip">${names.join(', ')}</span> ditandai <strong>${status}</strong>.` + buildCompletionHint();
        }
        return `Status <strong>${intent.status}</strong> untuk siswa siapa? Sebutkan namanya.`;
      }

      default: return replyFallback(rawText);
    }
  }

  // ============================================
  //   STAT HELPERS
  // ============================================

  function handleMostAbsent() {
    const data = getStorage();
    const counts = {};
    STUDENTS.forEach(n => { counts[n] = { Alpa: 0, Sakit: 0, Izin: 0 }; });
    Object.values(data).forEach(day => {
      if (!day.records) return;
      STUDENTS.forEach(n => {
        const s = day.records[n];
        if (s && counts[n][s] !== undefined) counts[n][s]++;
      });
    });
    const sorted = STUDENTS.map(n => ({ name: n, ...counts[n] }))
      .filter(x => x.Alpa > 0)
      .sort((a, b) => b.Alpa - a.Alpa)
      .slice(0, 5);

    if (sorted.length === 0) return 'Tidak ada siswa yang pernah alpa. Kelas ini rajin semua.';
    let msg = `<strong>Siswa Paling Sering Alpa:</strong><br><br>`;
    sorted.forEach((x, i) => { msg += `${i+1}. ${x.name} — <strong>${x.Alpa}x alpa</strong><br>`; });
    return msg;
  }

  function handlePeriodStat(period) {
    const data = getStorage();
    const now  = new Date();
    let entries = Object.entries(data);

    if (period === 'week') {
      const cutoff = new Date(now - 7 * 86400000);
      entries = entries.filter(([k]) => new Date(k) >= cutoff);
    } else {
      const month = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      entries = entries.filter(([k]) => k.startsWith(month));
    }

    if (entries.length === 0) return 'Belum ada data untuk periode tersebut.';

    const totals = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 };
    entries.forEach(([, day]) => {
      if (!day.records) return;
      Object.values(day.records).forEach(s => { if (totals[s] !== undefined) totals[s]++; });
    });
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    const label = period === 'week' ? '7 Hari Terakhir' : 'Bulan Ini';

    let msg = `<strong>Rekap ${label}</strong> (${entries.length} hari data):<br><br>`;
    Object.entries(totals).forEach(([s, c]) => {
      const pct = total > 0 ? Math.round(c / total * 100) : 0;
      msg += `${STATUS_ICON[s]} <strong>${s}</strong>: ${c} entri (${pct}%)<br>`;
    });
    return msg;
  }

  function buildCompletionHint() {
    const unfilled = checkUnfilled();
    if (unfilled.length === 0) return `<br><br><span class="complete-badge">Absensi hari ini lengkap</span>`;
    if (unfilled.length <= 3) {
      return `<br><br>Sisa <strong>${unfilled.length} siswa</strong>: ${unfilled.join(', ')}.`;
    }
    return `<br><br>Masih <strong>${unfilled.length} siswa</strong> belum tercatat.`;
  }

  // ============================================
  //   SMART SUGGESTION
  // ============================================

  function generateSmartSuggestion() {
    const unfilled = checkUnfilled();
    const { records } = getCurrentRecords();
    const filled = STUDENTS.filter(n => records[n]).length;
    if (filled === 0) return null;

    if (unfilled.length > 0 && unfilled.length <= 5) {
      return {
        text: `Masih ${unfilled.length} siswa belum tercatat (${unfilled.map(n => n.split(' ')[0]).join(', ')}). Isi semua sebagai Hadir?`,
        action: 'sisanya hadir',
        label: `Isi ${unfilled.length} sisanya sebagai Hadir`
      };
    }
    if (unfilled.length > 5) {
      const hadirCount = Object.values(records).filter(s => s === 'Hadir').length;
      if (hadirCount > STUDENTS.length * 0.65) {
        return {
          text: `${unfilled.length} siswa belum tercatat. Isi semua sisanya sebagai Hadir?`,
          action: 'sisanya hadir',
          label: `Isi ${unfilled.length} sisanya sebagai Hadir`
        };
      }
    }
    return null;
  }

  // ============================================
  //   REPLY TEMPLATES
  // ============================================

  function replyGreet() {
    const h = new Date().getHours();
    const g = h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam';
    const un = checkUnfilled().length;
    const td = getTodayData();
    const u = userName;
    let msg = `${g}${u ? ', <strong>' + u + '</strong>' : ''}!<br><br>`;
    if (!td && Object.keys(currentSelections).length === 0) {
      msg += `Belum ada absensi hari ini. Ketik <em>"semua hadir"</em> untuk mulai.`;
    } else if (un > 0) {
      msg += `Sudah ${STUDENTS.length - un} siswa tercatat, masih <strong>${un} siswa</strong> belum diisi.`;
    } else {
      msg += `Absensi hari ini sudah lengkap.`;
    }
    return msg;
  }

  function replyThanks() {
    const u = userName;
    const r = [
      `Sama-sama${u ? ', ' + u : ''}. Jangan ragu jika butuh bantuan lagi.`,
      `Dengan senang hati${u ? ', ' + u : ''}.`,
      `Siap${u ? ', ' + u : ''}. Semangat mengajar hari ini!`,
    ];
    return r[Math.floor(Math.random() * r.length)];
  }

  function replyHelp() {
    const u = userName;
    return `<strong>Panduan Asisten Absensi</strong><br><br>
<div class="help-section"><div class="help-title">Absensi Massal</div>
<em>"Semua hadir"</em><br>
<em>"Semua hadir kecuali Ani izin"</em><br>
<em>"Semua hadir kecuali Ani izin dan Raihan sakit"</em></div>
<div class="help-section"><div class="help-title">Per Siswa</div>
<em>"Ahmad sakit, Dani alpa, Ani izin"</em><br>
<em>"Raihan dan Andina alpa"</em><br>
<em>"Sisanya hadir semua"</em></div>
<div class="help-section"><div class="help-title">Cek & Statistik</div>
<em>"Siapa yang belum absen?"</em><br>
<em>"Berapa yang hadir hari ini?"</em><br>
<em>"Siapa paling sering alpa?"</em><br>
<em>"Rekap minggu ini / bulan ini"</em></div>
<div class="help-section"><div class="help-title">Manajemen Kelas</div>
<em>"Siapa petugas piket hari ini?"</em><br>
<em>"Siapa petugas MBG hari ini?"</em><br>
<em>"Tampilkan struktur organisasi"</em></div>
<div class="help-section"><div class="help-title">Aksi Cepat</div>
<em>"Tandai yang belum jadi alpa"</em><br>
<em>"Undo"</em> — batalkan aksi terakhir<br>
<em>"Ganti nama"</em> — ubah nama Anda</div>`;
  }

  function replyFallback(text) {
    const names = findStudentNames(text, STUDENTS);
    if (names.length > 0 && !detectStatus(text)) {
      return `Ditemukan: <strong>${names.join(', ')}</strong>. Mau ditandai sebagai apa?<div class="quick-status-row"><button class="qs-btn" onclick="window._aiSendQuick('hadir')">Hadir</button><button class="qs-btn sakit" onclick="window._aiSendQuick('sakit')">Sakit</button><button class="qs-btn izin" onclick="window._aiSendQuick('izin')">Izin</button><button class="qs-btn alpa" onclick="window._aiSendQuick('alpa')">Alpa</button></div>`;
    }
    const f = [
      'Maaf, perintah itu belum saya pahami. Ketik <em>"bantuan"</em> untuk melihat contoh.',
      'Belum bisa memproses perintah itu. Coba ketik <em>"semua hadir"</em> atau <em>"Ahmad sakit"</em>.',
      'Perintah tidak dikenali. Ketik <em>"help"</em> untuk panduan lengkap.',
    ];
    return f[Math.floor(Math.random() * f.length)];
  }

  // ============================================
  //   MAIN PROCESS
  // ============================================

  function processInput(raw) {
    if (!raw.trim()) return 'Silakan ketik sesuatu.';

    // Onboarding: waiting for name
    if (onboardingStep === 1) {
      const cleaned = raw.trim().replace(/^(nama saya|nama aku|panggil saya|panggil aku|saya|aku)\s*/i, '').trim();
      if (cleaned.length < 2 || cleaned.length > 40) {
        return 'Nama terlalu pendek atau terlalu panjang. Coba masukkan nama Anda kembali.';
      }
      saveUserName(cleaned);
      onboardingStep = 0;
      updateHeaderName();
      const h = new Date().getHours();
      const g = h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam';
      const un = checkUnfilled().length;
      const td = getTodayData();
      let follow = '';
      if (!td && Object.keys(currentSelections).length === 0) {
        follow = `Belum ada absensi hari ini. Ketik <em>"semua hadir"</em> untuk mulai dengan cepat.`;
      } else if (un > 0) {
        follow = `Masih ada <strong>${un} siswa</strong> yang belum tercatat.`;
      } else {
        follow = `Absensi hari ini sudah lengkap.`;
      }
      return `Selamat ${g}, <strong>${cleaned}</strong>. Senang bisa membantu Anda hari ini.<br><br>${follow}`;
    }

    const intent = detectIntent(raw);
    conversationCtx.push({ type: 'user', text: raw, intent: intent.type });
    if (conversationCtx.length > 14) conversationCtx.shift();

    const reply = handle(intent, raw);

    const actionTypes = ['mark_all','mark_specific','mark_multi','fill_remaining','exception_followup'];
    if (actionTypes.includes(intent.type)) {
      const sugg = generateSmartSuggestion();
      if (sugg) setTimeout(() => { showSuggestionBubble(sugg); }, 1100);
    }

    return reply;
  }

  // ============================================
  //   UI BUILD
  // ============================================

  function buildUI() {
    injectCSS();
    buildFAB();
    buildPanel();
    setupInputEvents();
    exposeGlobals();

    userName = loadUserName();

    setTimeout(() => {
      if (!userName) {
        onboardingStep = 1;
        addBotMsg(buildWelcomeMessage());
      } else {
        const un = checkUnfilled().length;
        const td = getTodayData();
        const h = new Date().getHours();
        const g = h < 11 ? 'pagi' : h < 15 ? 'siang' : h < 18 ? 'sore' : 'malam';
        let msg = `Selamat ${g}, <strong>${userName}</strong>.`;
        if (td) {
          msg += un === 0
            ? ` Absensi hari ini sudah lengkap.`
            : ` Masih ada <strong>${un} siswa</strong> yang belum tercatat.`;
        } else {
          msg += ` Absensi hari ini belum dimulai.`;
        }
        addBotMsg(msg);
        updateHeaderName();
      }
    }, 500);
  }

  function buildWelcomeMessage() {
    return `<div class="onboarding-wrap">
      <div class="onboarding-logo">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#818cf8" stroke-width="1.6">
          <rect x="3" y="3" width="18" height="18" rx="4"/>
          <path d="M8 12h8M12 8v8"/>
        </svg>
      </div>
      <div class="onboarding-title">Asisten Absensi</div>
      <div class="onboarding-sub">Selamat datang. Saya siap membantu mempercepat proses absensi Anda.</div>
      <div class="onboarding-ask">Boleh saya tahu nama Anda?</div>
    </div>`;
  }

  function updateHeaderName() {
    const el = document.getElementById('ai-header-name');
    if (el) el.textContent = userName ? `Halo, ${userName}` : 'Asisten Absensi';
  }

  function injectCSS() {
    if (document.getElementById('ai-assistant-styles')) return;
    const s = document.createElement('style');
    s.id = 'ai-assistant-styles';
    s.textContent = `
/* FAB */
#ai-fab {
  position: fixed; bottom: 28px; right: 28px;
  width: 54px; height: 54px; border-radius: 15px;
  background: #151f35;
  border: 1px solid rgba(99,102,241,.3);
  color: #818cf8; cursor: pointer; z-index: 9999;
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 28px rgba(0,0,0,.5), 0 0 0 1px rgba(99,102,241,.12);
  transition: all .22s cubic-bezier(.34,1.56,.64,1);
}
#ai-fab:hover {
  background: #1c2a46; transform: translateY(-2px) scale(1.05);
  box-shadow: 0 14px 40px rgba(0,0,0,.6), 0 0 0 1px rgba(99,102,241,.45);
  color: #a5b4fc;
}
#ai-fab .ai-notif {
  position: absolute; top: -4px; right: -4px;
  width: 11px; height: 11px; background: #22c55e;
  border-radius: 50%; border: 2px solid #0a1628;
  animation: npulse 2.5s ease-in-out infinite;
}
@keyframes npulse {
  0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.45); }
  50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
}
.ai-fab-tip {
  position: absolute; right: 62px;
  background: #1e293b; color: #94a3b8;
  font-size: 11.5px; padding: 5px 10px; border-radius: 8px;
  white-space: nowrap; pointer-events: none; opacity: 0;
  transition: opacity .18s; font-family: 'Plus Jakarta Sans', sans-serif;
  border: 1px solid rgba(255,255,255,.07);
  box-shadow: 0 4px 16px rgba(0,0,0,.35);
}
#ai-fab:hover .ai-fab-tip { opacity: 1; }

/* PANEL */
#ai-panel {
  position: fixed; bottom: 94px; right: 28px;
  width: 385px; max-width: calc(100vw - 24px);
  background: #0c1526;
  border: 1px solid rgba(99,102,241,.16);
  border-radius: 20px;
  box-shadow: 0 32px 80px rgba(0,0,0,.65), 0 0 0 1px rgba(99,102,241,.06);
  z-index: 9998; display: flex; flex-direction: column;
  overflow: hidden; max-height: 575px;
  transform: scale(.9) translateY(18px); opacity: 0;
  pointer-events: none;
  transition: transform .32s cubic-bezier(.34,1.56,.64,1), opacity .22s ease;
}
#ai-panel.open {
  transform: scale(1) translateY(0); opacity: 1; pointer-events: all;
}

/* HEADER */
.ai-hdr {
  padding: 14px 15px 12px;
  background: linear-gradient(160deg, #121e34 0%, #0e1a2e 100%);
  border-bottom: 1px solid rgba(255,255,255,.04);
  display: flex; align-items: center; gap: 11px; flex-shrink: 0;
}
.ai-hdr-av {
  width: 38px; height: 38px; border-radius: 11px;
  background: linear-gradient(135deg, #312e81, #4c1d95);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; border: 1px solid rgba(99,102,241,.3);
  box-shadow: 0 4px 14px rgba(79,70,229,.3);
}
.ai-hdr-info { flex: 1; min-width: 0; }
.ai-hdr-name {
  font-weight: 600; font-size: 13.5px;
  color: #e2e8f0; font-family: 'Plus Jakarta Sans', sans-serif;
}
.ai-hdr-st {
  display: flex; align-items: center; gap: 5px; margin-top: 2px;
}
.ai-st-dot {
  width: 6px; height: 6px; background: #22c55e;
  border-radius: 50%; flex-shrink: 0;
  animation: npulse 2.5s ease-in-out infinite;
}
.ai-st-lbl {
  font-size: 10.5px; color: #475569;
  font-family: 'Plus Jakarta Sans', sans-serif;
}
.ai-hdr-btns { display: flex; gap: 5px; }
.ai-hdr-btn {
  width: 29px; height: 29px; border-radius: 8px;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.06);
  color: #475569; cursor: pointer; display: flex;
  align-items: center; justify-content: center;
  transition: all .15s;
}
.ai-hdr-btn:hover { background: rgba(255,255,255,.09); color: #94a3b8; }

/* PROGRESS */
.ai-prog-track { height: 2px; background: rgba(255,255,255,.04); flex-shrink: 0; }
.ai-prog-fill {
  height: 100%;
  background: linear-gradient(90deg, #4f46e5 0%, #22c55e 100%);
  transition: width .7s cubic-bezier(.4,0,.2,1);
}

/* MESSAGES */
.ai-msgs {
  flex: 1; overflow-y: auto; padding: 14px 13px 8px;
  display: flex; flex-direction: column; gap: 10px;
  scrollbar-width: thin; scrollbar-color: rgba(99,102,241,.18) transparent;
}
.ai-msgs::-webkit-scrollbar { width: 3px; }
.ai-msgs::-webkit-scrollbar-thumb { background: rgba(99,102,241,.18); border-radius: 3px; }

.msg-row { display: flex; gap: 8px; align-items: flex-end; animation: msg-in .2s ease; }
.msg-row.user { flex-direction: row-reverse; }
@keyframes msg-in {
  from { opacity: 0; transform: translateY(5px); }
  to   { opacity: 1; transform: none; }
}
.msg-av {
  width: 27px; height: 27px; border-radius: 8px;
  flex-shrink: 0; display: flex; align-items: center;
  justify-content: center; background: #131f35;
  border: 1px solid rgba(255,255,255,.06);
}
.msg-row.user .msg-av {
  background: linear-gradient(135deg, #1e3a8a, #1d4ed8);
  border-color: rgba(59,130,246,.25);
}
.msg-content { display: flex; flex-direction: column; max-width: 83%; }
.msg-row.user .msg-content { align-items: flex-end; }
.msg-bbl {
  background: #131e32; border: 1px solid rgba(255,255,255,.06);
  border-radius: 13px 13px 13px 3px;
  padding: 9px 12px; font-size: 12.5px; line-height: 1.62;
  color: #cbd5e1; word-break: break-word;
  font-family: 'Plus Jakarta Sans', sans-serif;
}
.msg-row.user .msg-bbl {
  background: linear-gradient(135deg, rgba(30,58,138,.3), rgba(29,78,216,.22));
  border-color: rgba(59,130,246,.22);
  border-radius: 13px 13px 3px 13px; color: #e2e8f0;
}
.msg-bbl strong { color: #e2e8f0; font-weight: 600; }
.msg-bbl em { color: #818cf8; font-style: normal; }
.msg-ts {
  font-size: 9.5px; color: #263347;
  margin-top: 4px; padding: 0 2px;
  font-family: 'Plus Jakarta Sans', sans-serif;
}

/* TYPING */
.typing-wrap {
  display: flex; gap: 4px; align-items: center; padding: 8px 10px;
}
.typing-dot {
  width: 6px; height: 6px; background: #4f46e5;
  border-radius: 50%; animation: ty .85s ease-in-out infinite;
}
.typing-dot:nth-child(2) { animation-delay: .18s; }
.typing-dot:nth-child(3) { animation-delay: .36s; }
@keyframes ty {
  0%,60%,100% { transform: translateY(0); opacity: .35; }
  30% { transform: translateY(-6px); opacity: 1; }
}

/* SUGGESTION */
#ai-sugg-slot { padding: 0 12px; }
.ai-sugg {
  background: rgba(16,185,129,.07);
  border: 1px solid rgba(16,185,129,.2);
  border-radius: 11px; padding: 10px 12px;
  font-size: 12px; color: #94a3b8;
  animation: sugg-in .22s ease; margin-bottom: 8px;
  font-family: 'Plus Jakarta Sans', sans-serif;
}
@keyframes sugg-in {
  from { opacity: 0; transform: translateY(5px); }
  to { opacity: 1; transform: none; }
}
.ai-sugg-txt { margin-bottom: 8px; line-height: 1.55; color: #cbd5e1; }
.ai-sugg-acts { display: flex; gap: 6px; }
.ai-sugg-btn {
  font-size: 11.5px; padding: 4px 11px; border-radius: 20px;
  border: none; cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;
  transition: all .14s;
}
.ai-sugg-yes { background: rgba(16,185,129,.18); color: #34d399; }
.ai-sugg-yes:hover { background: rgba(16,185,129,.3); }
.ai-sugg-no  { background: rgba(255,255,255,.04); color: #3d5165; }
.ai-sugg-no:hover { background: rgba(255,255,255,.09); color: #64748b; }

/* CHIPS */
.ai-chips {
  padding: 7px 12px 5px; flex-shrink: 0;
  display: flex; gap: 5px; flex-wrap: wrap;
}
.ai-chip {
  font-size: 10.5px; padding: 3px 9px; border-radius: 20px;
  border: 1px solid rgba(99,102,241,.2);
  background: rgba(99,102,241,.07); color: #6272aa;
  cursor: pointer; transition: all .15s; white-space: nowrap;
  font-family: 'Plus Jakarta Sans', sans-serif;
}
.ai-chip:hover { background: rgba(99,102,241,.18); border-color: rgba(99,102,241,.5); color: #a5b4fc; }

/* INPUT */
.ai-input-area {
  padding: 9px 12px 13px;
  display: flex; gap: 8px; align-items: flex-end;
  border-top: 1px solid rgba(255,255,255,.04);
  flex-shrink: 0;
}
.ai-textarea {
  flex: 1; background: rgba(255,255,255,.04);
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 11px; color: #e2e8f0;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-size: 12.5px; padding: 9px 12px;
  resize: none; outline: none;
  min-height: 38px; max-height: 96px;
  overflow-y: auto; transition: border-color .2s, box-shadow .2s;
  line-height: 1.45;
}
.ai-textarea:focus {
  border-color: rgba(99,102,241,.45);
  box-shadow: 0 0 0 3px rgba(99,102,241,.09);
}
.ai-textarea::placeholder { color: #263347; }
.ai-send {
  width: 38px; height: 38px; border-radius: 10px;
  background: linear-gradient(135deg, #4338ca, #6d28d9);
  border: none; color: #fff; cursor: pointer;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0; transition: all .18s;
  box-shadow: 0 3px 12px rgba(79,70,229,.4);
}
.ai-send:hover { transform: scale(1.08); box-shadow: 0 5px 18px rgba(79,70,229,.55); }
.ai-send:disabled { opacity: .3; cursor: not-allowed; transform: none; box-shadow: none; }

/* INLINE */
.name-chip {
  display: inline-block; padding: 1px 7px; border-radius: 5px;
  background: rgba(99,102,241,.15); color: #818cf8;
  font-size: 11.5px; font-weight: 600; margin: 1px 2px;
}
.si {
  display: inline-flex; align-items: center; justify-content: center;
  width: 17px; height: 17px; border-radius: 4px;
  margin-right: 3px; vertical-align: middle; flex-shrink: 0;
}
.hadir-icon { background: rgba(34,197,94,.14); color: #22c55e; }
.sakit-icon { background: rgba(251,191,36,.14); color: #fbbf24; }
.izin-icon  { background: rgba(59,130,246,.14); color: #60a5fa; }
.alpa-icon  { background: rgba(239,68,68,.14); color: #f87171; }
.saved-badge {
  display: inline-block; font-size: 9.5px; padding: 1px 6px;
  border-radius: 4px; background: rgba(34,197,94,.12);
  color: #22c55e; margin-left: 5px; font-weight: 600;
  vertical-align: middle; border: 1px solid rgba(34,197,94,.2);
}
.complete-badge {
  display: inline-block; padding: 3px 10px; border-radius: 6px;
  background: rgba(34,197,94,.1); color: #22c55e;
  font-size: 11px; font-weight: 600; border: 1px solid rgba(34,197,94,.18);
}
.help-section {
  margin-bottom: 9px; padding-bottom: 9px;
  border-bottom: 1px solid rgba(255,255,255,.04);
}
.help-section:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
.help-title {
  font-weight: 700; color: #6272aa; font-size: 10.5px;
  text-transform: uppercase; letter-spacing: .06em; margin-bottom: 5px;
}
.quick-status-row {
  display: flex; gap: 5px; flex-wrap: wrap; margin-top: 9px;
}
.qs-btn {
  font-size: 11.5px; padding: 4px 11px; border-radius: 20px;
  border: 1px solid rgba(34,197,94,.25);
  background: rgba(34,197,94,.09); color: #34d399;
  cursor: pointer; font-family: 'Plus Jakarta Sans', sans-serif;
  transition: all .14s;
}
.qs-btn:hover { background: rgba(34,197,94,.2); }
.qs-btn.sakit { border-color: rgba(251,191,36,.25); background: rgba(251,191,36,.09); color: #fbbf24; }
.qs-btn.sakit:hover { background: rgba(251,191,36,.2); }
.qs-btn.izin  { border-color: rgba(59,130,246,.25); background: rgba(59,130,246,.09); color: #60a5fa; }
.qs-btn.izin:hover { background: rgba(59,130,246,.2); }
.qs-btn.alpa  { border-color: rgba(239,68,68,.25); background: rgba(239,68,68,.09); color: #f87171; }
.qs-btn.alpa:hover { background: rgba(239,68,68,.2); }

/* ONBOARDING */
.onboarding-wrap { text-align: center; padding: 6px 0 10px; }
.onboarding-logo {
  width: 50px; height: 50px; border-radius: 14px;
  background: linear-gradient(135deg, #1a2844, #0e1a2e);
  border: 1px solid rgba(99,102,241,.25);
  display: flex; align-items: center; justify-content: center;
  margin: 0 auto 12px;
  box-shadow: 0 6px 20px rgba(0,0,0,.4), 0 0 0 1px rgba(99,102,241,.1);
}
.onboarding-title {
  font-size: 14.5px; font-weight: 700; color: #e2e8f0;
  font-family: 'Plus Jakarta Sans', sans-serif; margin-bottom: 6px;
}
.onboarding-sub {
  font-size: 12px; color: #4a5a72; line-height: 1.6;
  font-family: 'Plus Jakarta Sans', sans-serif; margin-bottom: 13px;
}
.onboarding-ask {
  font-size: 12.5px; color: #8a9bbf;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 500; font-style: italic;
}

@media (max-width: 480px) {
  #ai-panel { right: 12px; bottom: 82px; width: calc(100vw - 24px); max-height: calc(100dvh - 100px); }
  #ai-fab { right: 16px; bottom: 16px; width: 50px; height: 50px; border-radius: 14px; }
}
    `;
    document.head.appendChild(s);
  }

  function buildFAB() {
    const fab = document.createElement('button');
    fab.id = 'ai-fab';
    fab.innerHTML = `
      <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="ai-notif"></span>
      <span class="ai-fab-tip">Asisten Absensi</span>
    `;
    fab.addEventListener('click', toggleChat);
    document.body.appendChild(fab);
  }

  function buildPanel() {
    const panel = document.createElement('div');
    panel.id = 'ai-panel';
    panel.innerHTML = `
      <div class="ai-hdr">
        <div class="ai-hdr-av">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a5b4fc" stroke-width="1.7">
            <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
          </svg>
        </div>
        <div class="ai-hdr-info">
          <div class="ai-hdr-name" id="ai-header-name">Asisten Absensi</div>
          <div class="ai-hdr-st">
            <div class="ai-st-dot"></div>
            <div class="ai-st-lbl" id="ai-st-lbl">Siap membantu</div>
          </div>
        </div>
        <div class="ai-hdr-btns">
          <button class="ai-hdr-btn" title="Batalkan aksi terakhir" onclick="window._aiSendQuick('undo')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
              <path d="M3 3v5h5"/>
            </svg>
          </button>
          <button class="ai-hdr-btn" title="Tutup" onclick="window._aiToggle()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="ai-prog-track"><div class="ai-prog-fill" id="ai-prog-fill" style="width:0%"></div></div>
      <div class="ai-msgs" id="ai-msgs"></div>
      <div id="ai-sugg-slot"></div>
      <div class="ai-chips">
        <button class="ai-chip" onclick="window._aiSendQuick('Semua hadir')">Semua hadir</button>
        <button class="ai-chip" onclick="window._aiSendQuick('Siapa yang belum absen?')">Cek belum</button>
        <button class="ai-chip" onclick="window._aiSendQuick('Tampilkan absen hari ini')">Status</button>
        <button class="ai-chip" onclick="window._aiSendQuick('Tandai yang belum jadi alpa')">Sisa jadi Alpa</button>
        <button class="ai-chip" onclick="window._aiSendQuick('Siapa petugas piket hari ini?')">Piket hari ini</button>
        <button class="ai-chip" onclick="window._aiSendQuick('Siapa petugas MBG hari ini?')">MBG hari ini</button>
        <button class="ai-chip" onclick="window._aiSendQuick('Tampilkan struktur organisasi')">Organisasi</button>
        <button class="ai-chip" onclick="window._aiSendQuick('Rekap bulan ini')">Rekap bulan</button>
        <button class="ai-chip" onclick="window._aiSendQuick('bantuan')">Panduan</button>
      </div>
      <div class="ai-input-area">
        <textarea class="ai-textarea" id="ai-textarea" placeholder='Contoh: "semua hadir kecuali Ani izin"' rows="1"></textarea>
        <button class="ai-send" id="ai-send-btn" onclick="window._aiSubmit()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    `;
    document.body.appendChild(panel);
  }

  function setupInputEvents() {
    const el = document.getElementById('ai-textarea');
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); window._aiSubmit(); }
    });
    el.addEventListener('input', () => {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 96) + 'px';
    });
  }

  function exposeGlobals() {
    window._aiToggle    = toggleChat;
    window._aiSubmit    = submitChat;
    window._aiSendQuick = sendQuick;
  }

  // ============================================
  //   UI INTERACTIONS
  // ============================================

  function toggleChat() {
    chatOpen = !chatOpen;
    const panel = document.getElementById('ai-panel');
    if (panel) panel.classList.toggle('open', chatOpen);
    if (chatOpen) {
      updateProgressBar();
      setTimeout(() => {
        const inp = document.getElementById('ai-textarea');
        if (inp) inp.focus();
        scrollMsgs();
      }, 340);
    }
  }

  function sendQuick(text) {
    if (!chatOpen) toggleChat();
    setTimeout(() => submitChat(text), 180);
  }

  function submitChat(forcedText) {
    const el   = document.getElementById('ai-textarea');
    const text = typeof forcedText === 'string' ? forcedText : (el ? el.value.trim() : '');
    if (!text || isTyping) return;

    addUserMsg(text);
    if (el && typeof forcedText !== 'string') { el.value = ''; el.style.height = 'auto'; }

    isTyping = true;
    const btn = document.getElementById('ai-send-btn');
    if (btn) btn.disabled = true;
    const slot = document.getElementById('ai-sugg-slot');
    if (slot) slot.innerHTML = '';
    showTyping();
    setStatus('Memproses...');

    setTimeout(() => {
      hideTyping();
      const reply = processInput(text);
      addBotMsg(reply);
      isTyping = false;
      if (btn) btn.disabled = false;
      setStatus('Siap membantu');
      updateProgressBar();
    }, 300 + Math.random() * 380);
  }

  function addUserMsg(text) {
    const msgs = document.getElementById('ai-msgs');
    if (!msgs) return;
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const div  = document.createElement('div');
    div.className = 'msg-row user';
    div.innerHTML = `
      <div class="msg-content">
        <div class="msg-bbl">${escHtml(text)}</div>
        <div class="msg-ts">${time}</div>
      </div>
      <div class="msg-av">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
      </div>`;
    msgs.appendChild(div);
    scrollMsgs();
  }

  function addBotMsg(html) {
    const msgs = document.getElementById('ai-msgs');
    if (!msgs) return;
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const div  = document.createElement('div');
    div.className = 'msg-row bot';
    div.innerHTML = `
      <div class="msg-av">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6272aa" stroke-width="1.8">
          <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
        </svg>
      </div>
      <div class="msg-content">
        <div class="msg-bbl">${html}</div>
        <div class="msg-ts">${time}</div>
      </div>`;
    msgs.appendChild(div);
    scrollMsgs();
  }

  function showTyping() {
    const msgs = document.getElementById('ai-msgs');
    if (!msgs) return;
    const div = document.createElement('div');
    div.id = 'ai-typing-row';
    div.className = 'msg-row bot';
    div.innerHTML = `
      <div class="msg-av">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#6272aa" stroke-width="1.8">
          <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18"/>
        </svg>
      </div>
      <div class="msg-content">
        <div class="msg-bbl"><div class="typing-wrap"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>
      </div>`;
    msgs.appendChild(div);
    scrollMsgs();
  }

  function hideTyping() {
    const el = document.getElementById('ai-typing-row');
    if (el) el.remove();
  }

  function showSuggestionBubble(sugg) {
    const slot = document.getElementById('ai-sugg-slot');
    if (!slot) return;
    slot.innerHTML = `
      <div class="ai-sugg">
        <div class="ai-sugg-txt">${escHtml(sugg.text)}</div>
        <div class="ai-sugg-acts">
          <button class="ai-sugg-btn ai-sugg-yes" onclick="window._aiSendQuick('${sugg.action}');this.closest('.ai-sugg').remove()">${sugg.label}</button>
          <button class="ai-sugg-btn ai-sugg-no" onclick="this.closest('.ai-sugg').remove()">Nanti saja</button>
        </div>
      </div>`;
    scrollMsgs();
  }

  function updateProgressBar() {
    const filled = STUDENTS.filter(n => {
      const td = getTodayData();
      return td ? td.records[n] : currentSelections[n];
    }).length;
    const pct = Math.round(filled / STUDENTS.length * 100);
    const fill = document.getElementById('ai-prog-fill');
    if (fill) fill.style.width = pct + '%';
  }

  function setStatus(text) {
    const el = document.getElementById('ai-st-lbl');
    if (el) el.textContent = text;
  }

  function scrollMsgs() {
    const msgs = document.getElementById('ai-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function escHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ============================================
  //   INIT
  // ============================================
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildUI);
  } else {
    buildUI();
  }

})();
