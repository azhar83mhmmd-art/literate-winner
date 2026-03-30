// ============================================
//   AbsenKelas — script.js
// ============================================

const STUDENTS = [
  "Ahmad Nauval",
  "Achmad Dani",
  "Aderia",
  "Amelia Rahmah",
  "Andina",
  "Ani Zastia",
  "Aspia Nabila",
  "Hatipah",
  "Hayattul Husna",
  "Muhammad Azhar",
  "Muhammad Hanafi",
  "Muhammad Jurifky Alfarizi",
  "Muhammad Raihan Alfarezy",
  "Muhammad Rappi",
  "Muhammad Rudianor",
  "Muhammad Tajudin",
  "Nazzlia Naila",
  "Nikmatul Husna",
  "Nur Aulia",
  "Raihan Ramadani",
  "Rihadatul Asyifa Nuregia",
  "Sauqi Rohman",
  "Yuliana Rahmah"
];

// Gender data: L = Laki-laki, P = Perempuan
const STUDENT_GENDER = {
  "Ahmad Nauval": "L",
  "Achmad Dani": "L",
  "Aderia": "P",
  "Amelia Rahmah": "P",
  "Andina": "P",
  "Ani Zastia": "P",
  "Aspia Nabila": "P",
  "Hatipah": "P",
  "Hayattul Husna": "P",
  "Muhammad Azhar": "L",
  "Muhammad Hanafi": "L",
  "Muhammad Jurifky Alfarizi": "L",
  "Muhammad Raihan Alfarezy": "L",
  "Muhammad Rappi": "L",
  "Muhammad Rudianor": "L",
  "Muhammad Tajudin": "L",
  "Nazzlia Naila": "P",
  "Nikmatul Husna": "P",
  "Nur Aulia": "P",
  "Raihan Ramadani": "L",
  "Rihadatul Asyifa Nuregia": "P",
  "Sauqi Rohman": "L",
  "Yuliana Rahmah": "P"
};

const STATUS_OPTS = ["Hadir", "Sakit", "Izin", "Alpa"];
const BULAN_ID = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const HARI_ID  = ["Minggu","Senin","Selasa","Rabu","Kamis","Jumat","Sabtu"];

// ---- DATE HELPERS ----
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function formatDate(key) {
  const [y, m, d] = key.split('-');
  const dt = new Date(+y, +m-1, +d);
  return `${HARI_ID[dt.getDay()]}, ${+d} ${BULAN_ID[+m-1]} ${y}`;
}

function formatDateShort(key) {
  const [y, m, d] = key.split('-');
  return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}/${y}`;
}

function getMonthKey(key) { return key.slice(0, 7); }

// ---- STORAGE ----
function getStorage() {
  try { return JSON.parse(localStorage.getItem('absenKelas') || '{}'); }
  catch { return {}; }
}
function setStorage(data) { localStorage.setItem('absenKelas', JSON.stringify(data)); }

// ---- GLOBAL STATE ----
let currentSelections = {};   // { studentName: status }
let editDateKey = null;
let editSelections = {};

// ============================================
//   INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  updateDateDisplay();
  renderStudentList();
  checkTodayLocked();
  updateQuickStats();
  renderRiwayat();
  renderRekap();
  renderDataSiswa();
  populateMonthFilter();
  updateGenderCount();
  setInterval(updateDateDisplay, 30000);
});

function updateDateDisplay() {
  const now = new Date();
  const str = `${HARI_ID[now.getDay()]}, ${now.getDate()} ${BULAN_ID[now.getMonth()]} ${now.getFullYear()}`;
  const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  const el = document.getElementById('dateDisplay');
  if (el) el.textContent = str;
  const tb = document.getElementById('topbarDate');
  if (tb) tb.textContent = `${str} · ${timeStr}`;
}

// ============================================
//   PAGE NAV
// ============================================
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const page = item.dataset.page;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    document.getElementById('pageTitle').textContent = item.querySelector('span').textContent;

    if (page === 'riwayat') renderRiwayat();
    if (page === 'rekap') renderRekap();
    if (window.innerWidth <= 768) closeSidebar();
  });
});

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('overlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('overlay').classList.remove('open');
}

// ============================================
//   ABSENSI FORM
// ============================================
function renderStudentList(locked = false, prefill = null) {
  const container = document.getElementById('studentList');
  container.innerHTML = '';

  const genderFilter = document.getElementById('filterGender')?.value || '';
  const search = (document.getElementById('searchAbsensi')?.value || '').toLowerCase();

  let visibleIdx = 0;
  STUDENTS.forEach((name, idx) => {
    if (genderFilter && STUDENT_GENDER[name] !== genderFilter) return;
    if (search && !name.toLowerCase().includes(search)) return;

    const currentStatus = prefill ? prefill[name] : (currentSelections[name] || null);
    const delay = visibleIdx * 18;
    visibleIdx++;

    const row = document.createElement('div');
    row.className = 'student-row';
    row.style.animationDelay = delay + 'ms';

    const initials = name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    const avatarHue = (name.charCodeAt(0) * 37) % 360;
    const gender = STUDENT_GENDER[name];
    const notes = getStudentNotes(name);

    row.innerHTML = `
      <div class="student-num">${String(idx+1).padStart(2,'0')}</div>
      <div class="student-avatar" style="background: linear-gradient(135deg, hsl(${avatarHue},65%,45%), hsl(${(avatarHue+60)%360},65%,35%))">${initials}</div>
      <div class="student-name">
        ${name}
        <span class="gender-tag ${gender === 'L' ? 'laki' : 'perempuan'}">${gender === 'L' ? 'L' : 'P'}</span>
        ${notes ? `<span class="has-note-dot" title="${notes}">📝</span>` : ''}
      </div>
      <div class="status-options" id="opts-${idx}">
        ${STATUS_OPTS.map(s => `
          <button class="status-btn ${s.toLowerCase()} ${currentStatus === s ? 'active' : ''}"
            onclick="${locked ? '' : `selectStatus(${idx}, '${s}', this)`}"
            ${locked ? 'disabled style="cursor:default;opacity:0.7"' : ''}
          >${s}</button>
        `).join('')}
        ${!locked ? `<button class="note-btn" onclick="openNote('${name}')" title="Catatan"><i class="fa-solid fa-note-sticky"></i></button>` : ''}
      </div>
    `;
    container.appendChild(row);
  });

  if (container.children.length === 0) {
    container.innerHTML = `<div style="padding:30px;text-align:center;color:var(--text-muted)"><i class="fa-solid fa-magnifying-glass" style="font-size:24px;margin-bottom:8px;display:block"></i>Tidak ada siswa ditemukan</div>`;
  }

  updateProgress();
}

function selectStatus(idx, status, btn) {
  const name = STUDENTS[idx];
  currentSelections[name] = status;

  const opts = document.getElementById('opts-' + idx);
  opts.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  updateProgress();
  updateQuickStats();
}

function markAll(status) {
  STUDENTS.forEach(name => { currentSelections[name] = status; });
  renderStudentList(false);
  updateQuickStats();
  showToast(`Semua siswa ditandai: <strong>${status}</strong>`, 'info');
}

function updateProgress() {
  const filled = STUDENTS.filter(n => currentSelections[n]).length;
  const pct = (filled / STUDENTS.length) * 100;
  document.getElementById('progressCount').textContent = filled;
  document.getElementById('progressBar').style.width = pct + '%';
}

function updateQuickStats() {
  const data = getStorage();
  const key = todayKey();
  const dayData = data[key];

  const src = dayData ? dayData.records : currentSelections;

  const counts = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 };
  STUDENTS.forEach(n => { if (src[n]) counts[src[n]]++; });

  document.getElementById('statHadir').textContent = counts.Hadir;
  document.getElementById('statSakit').textContent = counts.Sakit;
  document.getElementById('statIzin').textContent  = counts.Izin;
  document.getElementById('statAlpa').textContent  = counts.Alpa;
}

function checkTodayLocked() {
  const data = getStorage();
  const key = todayKey();
  const locked = !!data[key];

  const notice = document.getElementById('lockedNotice');
  const pill   = document.getElementById('statusPill');
  const btn    = document.getElementById('submitBtn');

  if (locked) {
    notice.style.display = 'flex';
    pill.textContent = '✓ Absensi Tersimpan';
    pill.className = 'status-pill done';
    btn.disabled = true;
    renderStudentList(true, data[key].records);
  } else {
    notice.style.display = 'none';
    pill.textContent = '● Absensi Terbuka';
    pill.className = 'status-pill open';
    btn.disabled = false;
    renderStudentList(false);
  }
  updateQuickStats();
}

function submitAbsensi() {
  const unfilled = STUDENTS.filter(n => !currentSelections[n]);
  if (unfilled.length > 0) {
    showToast(`${unfilled.length} siswa belum diisi!`, 'error');
    return;
  }

  const key = todayKey();
  const now = new Date();
  const data = getStorage();

  data[key] = {
    date: key,
    savedAt: now.toISOString(),
    records: { ...currentSelections }
  };
  setStorage(data);

  currentSelections = {};
  checkTodayLocked();
  renderRiwayat();
  renderRekap();
  showToast('Absensi berhasil disimpan! 🎉', 'success');
}

// ============================================
//   RIWAYAT
// ============================================
let riwayatView = 'harian'; // 'harian' | 'bulanan'

function switchRiwayatView(view) {
  riwayatView = view;
  document.getElementById('viewHarian').classList.toggle('active', view === 'harian');
  document.getElementById('viewBulanan').classList.toggle('active', view === 'bulanan');
  renderRiwayat();
}

function renderRiwayat() {
  if (riwayatView === 'bulanan') renderRiwayatBulanan();
  else renderRiwayatHarian();
}

function renderRiwayatHarian() {
  const data = getStorage();
  const search = (document.getElementById('searchRiwayat')?.value || '').toLowerCase();
  const container = document.getElementById('riwayatList');
  container.innerHTML = '';

  const keys = Object.keys(data).sort().reverse();

  if (keys.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-calendar-xmark"></i>
        <h3>Belum ada data absensi</h3>
        <p>Mulai isi absensi di tab "Absensi Hari Ini"</p>
      </div>`;
    return;
  }

  let rendered = 0;
  keys.forEach(key => {
    const entry = data[key];
    const dateStr = formatDate(key);
    const timeStr = entry.savedAt ? new Date(entry.savedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-';

    if (search && !dateStr.toLowerCase().includes(search) &&
        !STUDENTS.some(n => n.toLowerCase().includes(search))) return;

    const counts = countStatuses(entry.records);
    rendered++;

    const div = document.createElement('div');
    div.className = 'riwayat-day';
    div.innerHTML = `
      <div class="riwayat-day-header" onclick="toggleRiwayat(this)">
        <div class="riwayat-date-info">
          <div class="riwayat-date-icon"><i class="fa-solid fa-calendar-day"></i></div>
          <div>
            <div class="riwayat-date-title">${dateStr}</div>
            <div class="riwayat-date-sub">Disimpan pukul ${timeStr} · ${STUDENTS.length} siswa</div>
          </div>
        </div>
        <div class="riwayat-badges">
          ${counts.Hadir > 0 ? `<span class="badge hadir"><i class="fa-solid fa-circle-check"></i> ${counts.Hadir} Hadir</span>` : ''}
          ${counts.Sakit > 0 ? `<span class="badge sakit"><i class="fa-solid fa-heart-pulse"></i> ${counts.Sakit} Sakit</span>` : ''}
          ${counts.Izin  > 0 ? `<span class="badge izin"><i class="fa-solid fa-envelope"></i> ${counts.Izin} Izin</span>` : ''}
          ${counts.Alpa  > 0 ? `<span class="badge alpa"><i class="fa-solid fa-circle-xmark"></i> ${counts.Alpa} Alpa</span>` : ''}
        </div>
        <div class="riwayat-actions" onclick="event.stopPropagation()">
          <button class="btn-icon" title="Edit" onclick="openEdit('${key}')"><i class="fa-solid fa-pen"></i></button>
          <button class="btn-icon delete" title="Hapus" onclick="deleteDay('${key}')"><i class="fa-solid fa-trash"></i></button>
        </div>
      </div>
      <div class="riwayat-day-body">
        <table class="mini-table">
          <thead>
            <tr><th>#</th><th>Nama Siswa</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${STUDENTS.filter(n => !search || n.toLowerCase().includes(search)).map((n, i) => `
              <tr>
                <td class="td-num">${i+1}</td>
                <td>${n}</td>
                <td><span class="badge ${(entry.records[n]||'alpa').toLowerCase()}">${entry.records[n] || 'Alpa'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    container.appendChild(div);
  });

  if (rendered === 0) {
    container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><h3>Tidak ada hasil ditemukan</h3><p>Coba kata kunci lain</p></div>`;
  }
}

function renderRiwayatBulanan() {
  const data = getStorage();
  const search = (document.getElementById('searchRiwayat')?.value || '').toLowerCase();
  const container = document.getElementById('riwayatList');
  container.innerHTML = '';

  const allKeys = Object.keys(data).sort().reverse();

  if (allKeys.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fa-solid fa-calendar-xmark"></i>
        <h3>Belum ada data absensi</h3>
        <p>Mulai isi absensi di tab "Absensi Hari Ini"</p>
      </div>`;
    return;
  }

  // Group keys by month
  const byMonth = {};
  allKeys.forEach(key => {
    const mk = getMonthKey(key);
    if (!byMonth[mk]) byMonth[mk] = [];
    byMonth[mk].push(key);
  });

  const monthKeys = Object.keys(byMonth).sort().reverse();

  monthKeys.forEach(mk => {
    const dayKeys = byMonth[mk].sort();
    const [y, mo] = mk.split('-');
    const monthLabel = `${BULAN_ID[+mo-1]} ${y}`;
    const totalDays = dayKeys.length;

    // Aggregate per student for this month
    const totals = {};
    STUDENTS.forEach(n => { totals[n] = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 }; });
    dayKeys.forEach(key => {
      STUDENTS.forEach(n => {
        const s = data[key].records[n] || 'Alpa';
        totals[n][s]++;
      });
    });

    // Month-level grand totals
    let gtH=0, gtS=0, gtI=0, gtA=0;
    STUDENTS.forEach(n => { gtH+=totals[n].Hadir; gtS+=totals[n].Sakit; gtI+=totals[n].Izin; gtA+=totals[n].Alpa; });

    // Filter students
    const filteredStudents = STUDENTS.filter(n => !search || n.toLowerCase().includes(search));

    const wrapper = document.createElement('div');
    wrapper.className = 'riwayat-month-block';

    wrapper.innerHTML = `
      <div class="riwayat-month-header" onclick="toggleMonthBlock(this)">
        <div class="riwayat-date-info">
          <div class="riwayat-date-icon" style="background:var(--accent-blue-glow);color:var(--accent-blue)"><i class="fa-solid fa-calendar-alt"></i></div>
          <div>
            <div class="riwayat-date-title">${monthLabel}</div>
            <div class="riwayat-date-sub">${totalDays} hari · ${STUDENTS.length} siswa</div>
          </div>
        </div>
        <div class="riwayat-badges">
          <span class="badge hadir"><i class="fa-solid fa-circle-check"></i> ${gtH} Hadir</span>
          <span class="badge sakit"><i class="fa-solid fa-heart-pulse"></i> ${gtS} Sakit</span>
          <span class="badge izin"><i class="fa-solid fa-envelope"></i> ${gtI} Izin</span>
          <span class="badge alpa"><i class="fa-solid fa-circle-xmark"></i> ${gtA} Alpa</span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
          <span class="expand-icon month-chevron"><i class="fa-solid fa-chevron-right"></i></span>
        </div>
      </div>
      <div class="riwayat-month-body">
        <div class="table-wrap">
          <table class="rekap-table">
            <thead>
              <tr>
                <th>No</th>
                <th>Nama Siswa</th>
                <th><span class="badge-th hadir">Hadir</span></th>
                <th><span class="badge-th sakit">Sakit</span></th>
                <th><span class="badge-th izin">Izin</span></th>
                <th><span class="badge-th alpa">Alpa</span></th>
                <th>Total</th>
                <th>% Hadir</th>
              </tr>
            </thead>
            <tbody>
              ${filteredStudents.map((name, i) => {
                const t = totals[name];
                const total = t.Hadir + t.Sakit + t.Izin + t.Alpa;
                const pct = total ? ((t.Hadir / total) * 100) : 0;
                const fillClass = pct >= 75 ? '' : pct >= 50 ? 'mid' : 'low';
                return `<tr>
                  <td><div class="rank-num">${i+1}</div></td>
                  <td style="font-weight:600">${name}</td>
                  <td><span class="td-num hadir">${t.Hadir}</span></td>
                  <td><span class="td-num sakit">${t.Sakit}</span></td>
                  <td><span class="td-num izin">${t.Izin}</span></td>
                  <td><span class="td-num alpa">${t.Alpa}</span></td>
                  <td><span class="td-num" style="color:var(--text-secondary)">${total}</span></td>
                  <td>
                    <div class="pct-bar-wrap">
                      <div class="pct-bar"><div class="pct-fill ${fillClass}" style="width:${pct}%"></div></div>
                      <span class="pct-text" style="color:${pct>=75?'var(--hadir)':pct>=50?'var(--sakit)':'var(--alpa)'}">${pct.toFixed(0)}%</span>
                    </div>
                  </td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
    container.appendChild(wrapper);
  });
}

function toggleMonthBlock(header) {
  const body = header.nextElementSibling;
  const chevron = header.querySelector('.month-chevron');
  const isOpen = body.classList.contains('open');
  body.classList.toggle('open', !isOpen);
  if (chevron) chevron.classList.toggle('rotated', !isOpen);
}

function deleteDay(key) {
  showConfirm(
    'Hapus Data Absensi',
    `Hapus data absensi tanggal <strong>${formatDate(key)}</strong>? Tindakan ini tidak dapat dibatalkan.`,
    () => {
      const data = getStorage();
      delete data[key];
      setStorage(data);
      renderRiwayat();
      if (key === todayKey()) checkTodayLocked();
      updateQuickStats();
      renderRekap();
      showToast('Data absensi dihapus.', 'info');
    }
  );
}

// ============================================
//   EDIT MODAL
// ============================================
function openEdit(key) {
  editDateKey = key;
  const data = getStorage();
  editSelections = { ...data[key].records };

  document.getElementById('modalDate').textContent = '📅 ' + formatDate(key);

  const container = document.getElementById('modalStudentList');
  container.innerHTML = '';

  STUDENTS.forEach((name, idx) => {
    const currentStatus = editSelections[name] || null;
    const initials = name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    const avatarHue = (name.charCodeAt(0) * 37) % 360;

    const row = document.createElement('div');
    row.className = 'student-row';
    row.innerHTML = `
      <div class="student-num">${String(idx+1).padStart(2,'0')}</div>
      <div class="student-avatar" style="background: linear-gradient(135deg, hsl(${avatarHue},65%,45%), hsl(${(avatarHue+60)%360},65%,35%))">${initials}</div>
      <div class="student-name">${name}</div>
      <div class="status-options" id="edit-opts-${idx}">
        ${STATUS_OPTS.map(s => `
          <button class="status-btn ${s.toLowerCase()} ${currentStatus === s ? 'active' : ''}"
            onclick="selectEditStatus(${idx}, '${s}', this)"
          >${s}</button>
        `).join('')}
      </div>
    `;
    container.appendChild(row);
  });

  document.getElementById('modalOverlay').classList.add('open');
  document.getElementById('editModal').classList.add('open');
}

function selectEditStatus(idx, status, btn) {
  const name = STUDENTS[idx];
  editSelections[name] = status;

  const opts = document.getElementById('edit-opts-' + idx);
  opts.querySelectorAll('.status-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function saveEdit() {
  if (!editDateKey) return;
  const data = getStorage();
  data[editDateKey].records = { ...editSelections };
  data[editDateKey].editedAt = new Date().toISOString();
  setStorage(data);

  if (editDateKey === todayKey()) checkTodayLocked();
  renderRiwayat();
  renderRekap();
  updateQuickStats();
  closeModal();
  showToast('Perubahan absensi disimpan! ✅', 'success');
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.getElementById('editModal').classList.remove('open');
  editDateKey = null;
  editSelections = {};
}

// ============================================
//   REKAP
// ============================================
function populateMonthFilter() {
  const sel = document.getElementById('filterBulan');
  const data = getStorage();
  const months = new Set(Object.keys(data).map(k => getMonthKey(k)));
  const now = new Date();
  const curMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;

  if (!months.has(curMonth)) months.add(curMonth);

  const sorted = Array.from(months).sort().reverse();
  sel.innerHTML = '';
  sorted.forEach(m => {
    const [y, mo] = m.split('-');
    const opt = document.createElement('option');
    opt.value = m;
    opt.textContent = `${BULAN_ID[+mo-1]} ${y}`;
    sel.appendChild(opt);
  });
}

function renderRekap() {
  populateMonthFilter();
  const sel = document.getElementById('filterBulan');
  const selectedMonth = sel?.value || '';
  const search = (document.getElementById('searchRekap')?.value || '').toLowerCase();
  const data = getStorage();

  // Filter by month
  const keys = Object.keys(data).filter(k => !selectedMonth || getMonthKey(k) === selectedMonth).sort();
  const totalDays = keys.length;

  // Aggregate per student
  const totals = {};
  STUDENTS.forEach(n => { totals[n] = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 }; });

  keys.forEach(key => {
    STUDENTS.forEach(n => {
      const s = data[key].records[n] || 'Alpa';
      totals[n][s]++;
    });
  });

  // Overall counts for donut
  let grandTotal = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 };
  STUDENTS.forEach(n => {
    grandTotal.Hadir += totals[n].Hadir;
    grandTotal.Sakit += totals[n].Sakit;
    grandTotal.Izin  += totals[n].Izin;
    grandTotal.Alpa  += totals[n].Alpa;
  });

  const totalEntries = grandTotal.Hadir + grandTotal.Sakit + grandTotal.Izin + grandTotal.Alpa;

  // Summary cards
  const pctH = totalEntries ? ((grandTotal.Hadir / totalEntries) * 100).toFixed(1) : '0.0';
  document.getElementById('rekapSummary').innerHTML = `
    <div class="rekap-summary-card hadir">
      <div class="label">Total Hadir</div>
      <div class="value">${grandTotal.Hadir}</div>
      <div class="sub">${pctH}% dari total presensi</div>
    </div>
    <div class="rekap-summary-card sakit">
      <div class="label">Total Sakit</div>
      <div class="value">${grandTotal.Sakit}</div>
      <div class="sub">${totalEntries ? ((grandTotal.Sakit/totalEntries)*100).toFixed(1) : '0.0'}% dari total presensi</div>
    </div>
    <div class="rekap-summary-card izin">
      <div class="label">Total Izin</div>
      <div class="value">${grandTotal.Izin}</div>
      <div class="sub">${totalEntries ? ((grandTotal.Izin/totalEntries)*100).toFixed(1) : '0.0'}% dari total presensi</div>
    </div>
    <div class="rekap-summary-card alpa">
      <div class="label">Total Alpa</div>
      <div class="value">${grandTotal.Alpa}</div>
      <div class="sub">${totalEntries ? ((grandTotal.Alpa/totalEntries)*100).toFixed(1) : '0.0'}% dari total presensi</div>
    </div>
  `;

  // Donut Chart
  renderDonut(grandTotal, totalEntries);

  // Table
  const tbody = document.getElementById('rekapTbody');
  tbody.innerHTML = '';

  const filtered = STUDENTS.filter(n => !search || n.toLowerCase().includes(search));

  if (totalDays === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 40px; color: var(--text-muted);">Belum ada data untuk bulan ini.</td></tr>`;
    return;
  }

  filtered.forEach((name, i) => {
    const t = totals[name];
    const total = t.Hadir + t.Sakit + t.Izin + t.Alpa;
    const pct = total ? ((t.Hadir / total) * 100) : 0;
    const fillClass = pct >= 75 ? '' : pct >= 50 ? 'mid' : 'low';
    const rowId = `rekap-detail-${i}`;

    // Build daily detail rows for this student
    const dailyRows = keys.map(key => {
      const s = data[key].records[name] || 'Alpa';
      return `<tr class="rekap-detail-row">
        <td colspan="3" style="padding-left:56px;color:var(--text-muted);font-size:12px;font-family:'DM Mono',monospace">${formatDateShort(key)}</td>
        <td colspan="3" style="font-size:12px;color:var(--text-secondary)">${formatDate(key).split(',')[0]}</td>
        <td colspan="3"><span class="badge ${s.toLowerCase()}" style="font-size:11px">${s}</span></td>
      </tr>`;
    }).join('');

    const tr = document.createElement('tr');
    tr.className = 'rekap-main-row';
    tr.setAttribute('data-row', rowId);
    tr.style.cursor = 'pointer';
    tr.onclick = function() { toggleRekapDetail(rowId, this); };
    tr.innerHTML = `
      <td style="width:32px;text-align:center">
        <span class="expand-icon" id="icon-${rowId}"><i class="fa-solid fa-chevron-right"></i></span>
      </td>
      <td><div class="rank-num">${i+1}</div></td>
      <td style="font-weight:600">${name}</td>
      <td><span class="td-num hadir">${t.Hadir}</span></td>
      <td><span class="td-num sakit">${t.Sakit}</span></td>
      <td><span class="td-num izin">${t.Izin}</span></td>
      <td><span class="td-num alpa">${t.Alpa}</span></td>
      <td><span class="td-num" style="color:var(--text-secondary)">${total}</span></td>
      <td>
        <div class="pct-bar-wrap">
          <div class="pct-bar">
            <div class="pct-fill ${fillClass}" style="width:${pct}%"></div>
          </div>
          <span class="pct-text" style="color:${pct >= 75 ? 'var(--hadir)' : pct >= 50 ? 'var(--sakit)' : 'var(--alpa)'}">${pct.toFixed(0)}%</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);

    // Detail container row
    const detailTr = document.createElement('tr');
    detailTr.id = rowId;
    detailTr.className = 'rekap-detail-container';
    detailTr.innerHTML = `
      <td colspan="9" style="padding:0">
        <div class="rekap-detail-inner">
          <table class="rekap-daily-table">
            <thead>
              <tr>
                <th style="width:110px">Tanggal</th>
                <th style="width:80px">Hari</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${keys.map(key => {
                const s = data[key].records[name] || 'Alpa';
                return `<tr>
                  <td style="font-family:'DM Mono',monospace;font-size:12px">${formatDateShort(key)}</td>
                  <td style="color:var(--text-muted);font-size:12px">${formatDate(key).split(',')[0]}</td>
                  <td><span class="badge ${s.toLowerCase()}">${s}</span></td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </td>
    `;
    tbody.appendChild(detailTr);
  });
}

function toggleRekapDetail(rowId, trEl) {
  const detailTr = document.getElementById(rowId);
  const icon = document.getElementById('icon-' + rowId);
  const isOpen = detailTr.classList.contains('open');
  detailTr.classList.toggle('open', !isOpen);
  if (icon) icon.classList.toggle('rotated', !isOpen);
  trEl.classList.toggle('row-expanded', !isOpen);
}

function renderDonut(counts, total) {
  const svg = document.getElementById('donutChart');
  const legend = document.getElementById('donutLegend');
  svg.innerHTML = '';
  legend.innerHTML = '';

  if (total === 0) {
    svg.innerHTML = `<circle cx="100" cy="100" r="70" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="24"/>`;
    legend.innerHTML = `<p style="color:var(--text-muted);font-size:12px">Belum ada data</p>`;
    return;
  }

  const colors = { Hadir: '#34d399', Sakit: '#fb923c', Izin: '#a78bfa', Alpa: '#f87171' };
  const cx = 100, cy = 100, r = 70, sw = 24;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const entries = Object.entries(counts);

  entries.forEach(([status, val]) => {
    if (val === 0) return;
    const pct = val / total;
    const dashLen = pct * circumference;
    const gapLen = circumference - dashLen;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', cx);
    circle.setAttribute('cy', cy);
    circle.setAttribute('r', r);
    circle.setAttribute('fill', 'none');
    circle.setAttribute('stroke', colors[status]);
    circle.setAttribute('stroke-width', sw);
    circle.setAttribute('stroke-dasharray', `${dashLen} ${gapLen}`);
    circle.setAttribute('stroke-dashoffset', circumference - offset * circumference);
    circle.setAttribute('transform', `rotate(-90 ${cx} ${cy})`);
    svg.appendChild(circle);

    offset += pct;

    const legendItem = document.createElement('div');
    legendItem.className = 'legend-item';
    legendItem.innerHTML = `
      <div class="legend-dot" style="background:${colors[status]}"></div>
      <span class="legend-label">${status}</span>
      <span class="legend-val" style="color:${colors[status]}">${val}</span>
    `;
    legend.appendChild(legendItem);
  });

  // Center circle
  const center = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  center.setAttribute('cx', cx); center.setAttribute('cy', cy);
  center.setAttribute('r', r - sw/2 - 2);
  center.setAttribute('fill', '#1a1e2a');
  svg.appendChild(center);

  const text1 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text1.setAttribute('x', cx); text1.setAttribute('y', cy - 4);
  text1.setAttribute('text-anchor', 'middle');
  text1.setAttribute('fill', '#eef0f7');
  text1.setAttribute('font-size', '18');
  text1.setAttribute('font-weight', '800');
  text1.setAttribute('font-family', 'Plus Jakarta Sans');
  text1.textContent = total;
  svg.appendChild(text1);

  const text2 = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text2.setAttribute('x', cx); text2.setAttribute('y', cy + 14);
  text2.setAttribute('text-anchor', 'middle');
  text2.setAttribute('fill', '#4a5268');
  text2.setAttribute('font-size', '10');
  text2.setAttribute('font-family', 'Plus Jakarta Sans');
  text2.textContent = 'Total';
  svg.appendChild(text2);
}

// ============================================
//   EXPORT CSV
// ============================================
function exportCSV() {
  const data = getStorage();
  const keys = Object.keys(data).sort();

  if (keys.length === 0) {
    showToast('Tidak ada data untuk di-export.', 'error');
    return;
  }

  let csv = 'Tanggal,Nama Siswa,Status,Jam Simpan\n';

  keys.forEach(key => {
    const entry = data[key];
    const dateStr = formatDateShort(key);
    const timeStr = entry.savedAt ? new Date(entry.savedAt).toLocaleTimeString('id-ID') : '-';

    STUDENTS.forEach(name => {
      const status = entry.records[name] || 'Alpa';
      csv += `"${dateStr}","${name}","${status}","${timeStr}"\n`;
    });
  });

  // BOM for Excel UTF-8
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `AbsenKelas_Export_${todayKey()}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  showToast('Data berhasil di-export! 📥', 'success');
}

// ============================================
//   UTILS
// ============================================
function countStatuses(records) {
  const counts = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 };
  STUDENTS.forEach(n => {
    if (records[n]) counts[records[n]]++;
  });
  return counts;
}

let toastTimer;
function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  const icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', info: 'fa-circle-info' };
  toast.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${msg}`;
  toast.className = `toast ${type} show`;

  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.classList.remove('show'); }, 3200);
}

// ============================================
//   GENDER COUNT
// ============================================
function updateGenderCount() {
  const laki = STUDENTS.filter(n => STUDENT_GENDER[n] === 'L').length;
  const perempuan = STUDENTS.filter(n => STUDENT_GENDER[n] === 'P').length;
  const elL = document.getElementById('countLaki');
  const elP = document.getElementById('countPerempuan');
  if (elL) elL.textContent = `${laki} Laki-laki`;
  if (elP) elP.textContent = `${perempuan} Perempuan`;
}

// ============================================
//   CATATAN SISWA (NOTES)
// ============================================
function getNoteStorage() {
  try { return JSON.parse(localStorage.getItem('absenKelasNotes') || '{}'); }
  catch { return {}; }
}
function setNoteStorage(data) { localStorage.setItem('absenKelasNotes', JSON.stringify(data)); }

function getStudentNotes(name) {
  const notes = getNoteStorage();
  return notes[name] || '';
}

let currentNoteName = null;
function openNote(name) {
  currentNoteName = name;
  document.getElementById('noteSiswaName').textContent = '📝 Catatan untuk: ' + name;
  document.getElementById('noteTextarea').value = getStudentNotes(name);
  document.getElementById('noteOverlay').classList.add('open');
  document.getElementById('noteModal').classList.add('open');
  setTimeout(() => document.getElementById('noteTextarea').focus(), 100);
}

function closeNote() {
  document.getElementById('noteOverlay').classList.remove('open');
  document.getElementById('noteModal').classList.remove('open');
  currentNoteName = null;
}

function saveNote() {
  if (!currentNoteName) return;
  const notes = getNoteStorage();
  const val = document.getElementById('noteTextarea').value.trim();
  if (val) {
    notes[currentNoteName] = val;
  } else {
    delete notes[currentNoteName];
  }
  setNoteStorage(notes);
  closeNote();
  renderStudentList(false);
  renderDataSiswa();
  showToast(`Catatan untuk ${currentNoteName} disimpan!`, 'success');
}

// ============================================
//   CONFIRM MODAL
// ============================================
let confirmCallback = null;
function showConfirm(title, msg, onOk) {
  confirmCallback = onOk;
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMsg').innerHTML = msg;
  document.getElementById('confirmOverlay').classList.add('open');
  document.getElementById('confirmModal').classList.add('open');
  document.getElementById('confirmOkBtn').onclick = () => {
    closeConfirm();
    if (confirmCallback) confirmCallback();
  };
}
function closeConfirm() {
  document.getElementById('confirmOverlay').classList.remove('open');
  document.getElementById('confirmModal').classList.remove('open');
  confirmCallback = null;
}

// ============================================
//   DATA SISWA PAGE
// ============================================
function renderDataSiswa() {
  const search = (document.getElementById('searchSiswa')?.value || '').toLowerCase();
  const genderFilter = document.getElementById('filterSiswaGender')?.value || '';
  const tbody = document.getElementById('siswaTbody');
  if (!tbody) return;
  tbody.innerHTML = '';

  const data = getStorage();
  const allKeys = Object.keys(data);

  let no = 1;
  STUDENTS.forEach((name, idx) => {
    if (search && !name.toLowerCase().includes(search)) return;
    if (genderFilter && STUDENT_GENDER[name] !== genderFilter) return;

    // count total hadir across all records
    let hadirCount = 0;
    allKeys.forEach(key => {
      if (data[key].records[name] === 'Hadir') hadirCount++;
    });
    const totalDays = allKeys.length;
    const pct = totalDays ? ((hadirCount / totalDays) * 100).toFixed(0) : null;
    const gender = STUDENT_GENDER[name];
    const notes = getStudentNotes(name);
    const initials = name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase();
    const avatarHue = (name.charCodeAt(0) * 37) % 360;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><div class="rank-num">${no++}</div></td>
      <td>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="student-avatar" style="width:32px;height:32px;font-size:11px;border-radius:8px;background:linear-gradient(135deg,hsl(${avatarHue},65%,45%),hsl(${(avatarHue+60)%360},65%,35%));display:flex;align-items:center;justify-content:center;flex-shrink:0">${initials}</div>
          <div>
            <div style="font-weight:600">${name}</div>
            ${notes ? `<div style="font-size:11px;color:var(--text-muted);margin-top:2px">📝 ${notes.length > 40 ? notes.slice(0,40)+'…' : notes}</div>` : ''}
          </div>
        </div>
      </td>
      <td><span class="gender-tag ${gender === 'L' ? 'laki' : 'perempuan'}">${gender === 'L' ? '♂ Laki-laki' : '♀ Perempuan'}</span></td>
      <td>
        ${totalDays > 0
          ? `<div class="pct-bar-wrap">
              <div class="pct-bar" style="min-width:60px"><div class="pct-fill ${+pct>=75?'':+pct>=50?'mid':'low'}" style="width:${pct}%"></div></div>
              <span class="pct-text" style="color:${+pct>=75?'var(--hadir)':+pct>=50?'var(--sakit)':'var(--alpa)'}">${hadirCount}/${totalDays} (${pct}%)</span>
            </div>`
          : `<span style="color:var(--text-muted);font-size:12px">Belum ada data</span>`}
      </td>
      <td>
        <button class="btn-icon" title="Catatan" onclick="openNote('${name.replace(/'/g,"\\'")}')">
          <i class="fa-solid fa-note-sticky" style="color:var(--izin)"></i>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ============================================
//   CETAK / PRINT
// ============================================
function printAbsensi() {
  const data = getStorage();
  const todayData = data[todayKey()];

  let rows = '';
  if (todayData) {
    STUDENTS.forEach((name, i) => {
      const status = todayData.records[name] || 'Alpa';
      const colors = { Hadir: '#34d399', Sakit: '#fb923c', Izin: '#a78bfa', Alpa: '#f87171' };
      rows += `<tr>
        <td>${i+1}</td>
        <td>${name}</td>
        <td>${STUDENT_GENDER[name] === 'L' ? 'L' : 'P'}</td>
        <td style="color:${colors[status]};font-weight:700">${status}</td>
        <td>${getStudentNotes(name) || '-'}</td>
      </tr>`;
    });
  } else {
    STUDENTS.forEach((name, i) => {
      rows += `<tr>
        <td>${i+1}</td>
        <td>${name}</td>
        <td>${STUDENT_GENDER[name] === 'L' ? 'L' : 'P'}</td>
        <td></td>
        <td></td>
      </tr>`;
    });
  }

  const now = new Date();
  const dateStr = `${HARI_ID[now.getDay()]}, ${now.getDate()} ${BULAN_ID[now.getMonth()]} ${now.getFullYear()}`;

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Absensi ${dateStr}</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
    h2 { margin-bottom: 4px; }
    p { color: #555; margin-bottom: 16px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { background: #1a1e2a; color: #fff; padding: 8px 12px; text-align: left; }
    td { padding: 7px 12px; border-bottom: 1px solid #e5e7eb; }
    tr:nth-child(even) td { background: #f9fafb; }
    .footer { margin-top: 32px; font-size: 12px; color: #888; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h2>Daftar Absensi Kelas</h2>
  <p>${dateStr} &nbsp;·&nbsp; ${STUDENTS.length} Siswa ${todayData ? '· <b>Data tersimpan</b>' : '· <i>Belum diisi</i>'}</p>
  <table>
    <thead><tr><th>#</th><th>Nama Siswa</th><th>JK</th><th>Status</th><th>Catatan</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Dicetak pada ${now.toLocaleString('id-ID')} · AbsenKelas</div>
  <script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`);
  win.document.close();
}

// ============================================
//   PDF DOWNLOAD
// ============================================
let pdfTargetType = 'rekap';

function downloadPDFRekap() {
  selectPDFType('rekap');
  openPDFModal();
}
function downloadPDFRiwayat() {
  selectPDFType(riwayatView === 'bulanan' ? 'semua' : 'riwayat');
  openPDFModal();
}

function selectPDFType(type) {
  pdfTargetType = type;
  ['rekap','riwayat','semua'].forEach(t => {
    document.getElementById('pdfType' + t.charAt(0).toUpperCase() + t.slice(1))?.classList.toggle('active', t === type);
  });
}

function openPDFModal() {
  document.getElementById('pdfOverlay').classList.add('open');
  document.getElementById('pdfModal').classList.add('open');
}
function closePDFModal() {
  document.getElementById('pdfOverlay').classList.remove('open');
  document.getElementById('pdfModal').classList.remove('open');
}

function getPDFMeta() {
  return {
    sekolah: document.getElementById('pdfSekolah').value.trim() || 'Nama Sekolah',
    kelas:   document.getElementById('pdfKelas').value.trim()   || 'Kelas',
    guru:    document.getElementById('pdfGuru').value.trim()    || 'Wali Kelas',
    tahun:   document.getElementById('pdfTahun').value.trim()   || new Date().getFullYear() + '/' + (new Date().getFullYear()+1),
  };
}

function generatePDF() {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) { showToast('Library PDF belum siap, coba lagi.', 'error'); return; }

  const meta = getPDFMeta();

  if (pdfTargetType === 'rekap') generatePDFRekap(meta);
  else if (pdfTargetType === 'riwayat') generatePDFHarian(meta);
  else if (pdfTargetType === 'semua') generatePDFSemuaBulan(meta);

  closePDFModal();
}

// ---- HELPERS ----
function pdfHeader(doc, meta, title, subtitle) {
  const pageW = doc.internal.pageSize.getWidth();

  // Top bar
  doc.setFillColor(15, 20, 30);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(meta.sekolah.toUpperCase(), 14, 10);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(160, 170, 190);
  doc.text(`${meta.kelas}  ·  Wali Kelas: ${meta.guru}  ·  TP ${meta.tahun}`, 14, 17);

  // Title block
  doc.setTextColor(15, 20, 30);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 38);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 110, 130);
  doc.text(subtitle, 14, 45);

  // Divider
  doc.setDrawColor(220, 225, 235);
  doc.setLineWidth(0.4);
  doc.line(14, 49, pageW - 14, 49);

  return 55; // Y cursor after header
}

function pdfFooter(doc) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const pages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(245, 247, 250);
    doc.rect(0, pageH - 12, pageW, 12, 'F');
    doc.setTextColor(150, 160, 175);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(`AbsenKelas · Dicetak: ${new Date().toLocaleString('id-ID')}`, 14, pageH - 4.5);
    doc.text(`Halaman ${i} / ${pages}`, pageW - 14, pageH - 4.5, { align: 'right' });
  }
}

function statusColor(status) {
  if (status === 'Hadir') return [52, 211, 153];
  if (status === 'Sakit') return [251, 146, 60];
  if (status === 'Izin')  return [167, 139, 250];
  return [248, 113, 113]; // Alpa
}

// ---- PDF REKAP BULANAN ----
function generatePDFRekap(meta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const data = getStorage();

  const sel = document.getElementById('filterBulan');
  const selectedMonth = sel?.value || '';
  const [y, mo] = selectedMonth ? selectedMonth.split('-') : [new Date().getFullYear(), new Date().getMonth()+1];
  const monthLabel = `${BULAN_ID[+mo-1]} ${y}`;

  const keys = Object.keys(data).filter(k => !selectedMonth || getMonthKey(k) === selectedMonth).sort();

  const totals = {};
  STUDENTS.forEach(n => { totals[n] = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 }; });
  keys.forEach(key => {
    STUDENTS.forEach(n => {
      const s = data[key].records[n] || 'Alpa';
      totals[n][s]++;
    });
  });

  let yPos = pdfHeader(doc, meta, `REKAP KEHADIRAN — ${monthLabel.toUpperCase()}`, `${keys.length} hari aktif · ${STUDENTS.length} siswa`);

  // Summary boxes
  let grandH=0, grandS=0, grandI=0, grandA=0;
  STUDENTS.forEach(n => { grandH+=totals[n].Hadir; grandS+=totals[n].Sakit; grandI+=totals[n].Izin; grandA+=totals[n].Alpa; });
  const grandT = grandH+grandS+grandI+grandA;

  const boxes = [
    { label: 'Total Hadir', val: grandH, pct: grandT ? ((grandH/grandT)*100).toFixed(1) : '0', color: [52,211,153] },
    { label: 'Total Sakit', val: grandS, pct: grandT ? ((grandS/grandT)*100).toFixed(1) : '0', color: [251,146,60] },
    { label: 'Total Izin',  val: grandI, pct: grandT ? ((grandI/grandT)*100).toFixed(1) : '0', color: [167,139,250] },
    { label: 'Total Alpa',  val: grandA, pct: grandT ? ((grandA/grandT)*100).toFixed(1) : '0', color: [248,113,113] },
  ];
  const pageW = doc.internal.pageSize.getWidth();
  const boxW = (pageW - 28 - 9) / 4;
  boxes.forEach((b, i) => {
    const bx = 14 + i * (boxW + 3);
    doc.setFillColor(245, 247, 250);
    doc.roundedRect(bx, yPos, boxW, 18, 2, 2, 'F');
    doc.setFillColor(...b.color);
    doc.roundedRect(bx, yPos, 3, 18, 1, 1, 'F');
    doc.setTextColor(...b.color);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text(String(b.val), bx + 6, yPos + 10);
    doc.setTextColor(80, 90, 110);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(b.label, bx + 6, yPos + 15);
    doc.setTextColor(150, 160, 175);
    doc.text(`${b.pct}%`, bx + boxW - 4, yPos + 15, { align: 'right' });
  });
  yPos += 24;

  // Main table
  const tableBody = STUDENTS.map((name, i) => {
    const t = totals[name];
    const total = t.Hadir + t.Sakit + t.Izin + t.Alpa;
    const pct = total ? ((t.Hadir / total) * 100).toFixed(0) : '0';
    return [i+1, name, t.Hadir, t.Sakit, t.Izin, t.Alpa, total, `${pct}%`];
  });

  doc.autoTable({
    startY: yPos,
    head: [['No', 'Nama Siswa', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Total', '% Hadir']],
    body: tableBody,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3, font: 'helvetica', textColor: [30, 35, 50] },
    headStyles: { fillColor: [15, 20, 30], textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
    alternateRowStyles: { fillColor: [248, 249, 252] },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      2: { halign: 'center', textColor: [52,211,153], fontStyle: 'bold' },
      3: { halign: 'center', textColor: [251,146,60], fontStyle: 'bold' },
      4: { halign: 'center', textColor: [167,139,250], fontStyle: 'bold' },
      5: { halign: 'center', textColor: [248,113,113], fontStyle: 'bold' },
      6: { halign: 'center' },
      7: { halign: 'center', fontStyle: 'bold' },
    },
    didDrawCell: (d) => {
      if (d.section === 'body' && d.column.index === 7) {
        const pct = parseFloat(d.cell.text[0]);
        const color = pct >= 75 ? [52,211,153] : pct >= 50 ? [251,146,60] : [248,113,113];
        doc.setTextColor(...color);
      }
    },
    margin: { left: 14, right: 14 },
  });

  pdfFooter(doc);
  doc.save(`Rekap_${meta.kelas.replace(/\s/g,'_')}_${monthLabel.replace(/\s/g,'_')}.pdf`);
  showToast('PDF Rekap berhasil didownload! 📄', 'success');
}

// ---- PDF RIWAYAT HARIAN ----
function generatePDFHarian(meta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const data = getStorage();
  const keys = Object.keys(data).sort().reverse();

  if (keys.length === 0) { showToast('Tidak ada data untuk di-export.', 'error'); return; }

  const now = new Date();
  let yPos = pdfHeader(doc, meta,
    'RIWAYAT ABSENSI HARIAN',
    `${keys.length} hari tersimpan · ${STUDENTS.length} siswa · Per ${now.getDate()} ${BULAN_ID[now.getMonth()]} ${now.getFullYear()}`
  );

  // Build wide table: Nama | Tgl1 | Tgl2 | ... (max ~20 per page)
  const CHUNK = 18;
  const chunks = [];
  for (let i = 0; i < keys.length; i += CHUNK) chunks.push(keys.slice(i, i + CHUNK));

  chunks.forEach((chunkKeys, ci) => {
    if (ci > 0) {
      doc.addPage();
      yPos = pdfHeader(doc, meta, 'RIWAYAT ABSENSI HARIAN (lanjutan)', `Halaman ${ci+1}`);
    }

    const headRow = ['No', 'Nama Siswa', ...chunkKeys.map(k => {
      const [yr, mm, dd] = k.split('-');
      return `${dd}/${mm}`;
    })];

    const bodyRows = STUDENTS.map((name, i) => {
      const cells = chunkKeys.map(key => data[key]?.records[name] || 'A');
      // Abbreviate
      const abbr = { Hadir: 'H', Sakit: 'S', Izin: 'I', Alpa: 'A' };
      return [i+1, name, ...cells.map(s => abbr[s] || s[0])];
    });

    doc.autoTable({
      startY: yPos,
      head: [headRow],
      body: bodyRows,
      theme: 'grid',
      styles: { fontSize: 7.5, cellPadding: 2, font: 'helvetica', halign: 'center', textColor: [30,35,50] },
      headStyles: { fillColor: [15,20,30], textColor: [255,255,255], fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248,249,252] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 42, halign: 'left' },
      },
      didDrawCell: (d) => {
        if (d.section !== 'body' || d.column.index < 2) return;
        const val = d.cell.text[0];
        const colorMap = { H: [52,211,153], S: [251,146,60], I: [167,139,250], A: [248,113,113] };
        if (colorMap[val]) {
          doc.setTextColor(...colorMap[val]);
          doc.setFont('helvetica', 'bold');
        }
      },
      margin: { left: 10, right: 10 },
    });
  });

  // Legend
  const lastY = doc.lastAutoTable.finalY + 6;
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120,130,145);
  doc.text('Keterangan: H = Hadir  ·  S = Sakit  ·  I = Izin  ·  A = Alpa', 10, lastY);

  pdfFooter(doc);
  doc.save(`Riwayat_Harian_${meta.kelas.replace(/\s/g,'_')}.pdf`);
  showToast('PDF Riwayat Harian berhasil didownload! 📄', 'success');
}

// ---- PDF SEMUA BULAN ----
function generatePDFSemuaBulan(meta) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const data = getStorage();
  const allKeys = Object.keys(data).sort();

  if (allKeys.length === 0) { showToast('Tidak ada data untuk di-export.', 'error'); return; }

  // Group by month
  const byMonth = {};
  allKeys.forEach(key => {
    const mk = getMonthKey(key);
    if (!byMonth[mk]) byMonth[mk] = [];
    byMonth[mk].push(key);
  });
  const monthKeys = Object.keys(byMonth).sort().reverse();

  let firstPage = true;
  monthKeys.forEach(mk => {
    const dayKeys = byMonth[mk].sort();
    const [y, mo] = mk.split('-');
    const monthLabel = `${BULAN_ID[+mo-1]} ${y}`;

    const totals = {};
    STUDENTS.forEach(n => { totals[n] = { Hadir: 0, Sakit: 0, Izin: 0, Alpa: 0 }; });
    dayKeys.forEach(key => {
      STUDENTS.forEach(n => {
        const s = data[key].records[n] || 'Alpa';
        totals[n][s]++;
      });
    });

    if (!firstPage) doc.addPage();
    firstPage = false;

    let yPos = pdfHeader(doc, meta,
      `REKAP KEHADIRAN — ${monthLabel.toUpperCase()}`,
      `${dayKeys.length} hari aktif · ${STUDENTS.length} siswa`
    );

    // Summary row
    let gH=0, gS=0, gI=0, gA=0;
    STUDENTS.forEach(n => { gH+=totals[n].Hadir; gS+=totals[n].Sakit; gI+=totals[n].Izin; gA+=totals[n].Alpa; });
    const gT = gH+gS+gI+gA;
    const pageW = doc.internal.pageSize.getWidth();
    const boxW = (pageW - 28 - 9) / 4;
    const sumBoxes = [
      { label:'Hadir', val: gH, pct: gT?((gH/gT)*100).toFixed(0):'0', color:[52,211,153] },
      { label:'Sakit', val: gS, pct: gT?((gS/gT)*100).toFixed(0):'0', color:[251,146,60] },
      { label:'Izin',  val: gI, pct: gT?((gI/gT)*100).toFixed(0):'0', color:[167,139,250] },
      { label:'Alpa',  val: gA, pct: gT?((gA/gT)*100).toFixed(0):'0', color:[248,113,113] },
    ];
    sumBoxes.forEach((b, i) => {
      const bx = 14 + i * (boxW + 3);
      doc.setFillColor(245,247,250); doc.roundedRect(bx, yPos, boxW, 16, 2, 2, 'F');
      doc.setFillColor(...b.color); doc.roundedRect(bx, yPos, 3, 16, 1, 1, 'F');
      doc.setTextColor(...b.color); doc.setFontSize(14); doc.setFont('helvetica','bold');
      doc.text(String(b.val), bx+6, yPos+9);
      doc.setTextColor(80,90,110); doc.setFontSize(7); doc.setFont('helvetica','normal');
      doc.text(b.label, bx+6, yPos+14);
      doc.setTextColor(150,160,175);
      doc.text(`${b.pct}%`, bx+boxW-4, yPos+14, {align:'right'});
    });
    yPos += 22;

    const tableBody = STUDENTS.map((name, i) => {
      const t = totals[name];
      const total = t.Hadir+t.Sakit+t.Izin+t.Alpa;
      const pct = total ? ((t.Hadir/total)*100).toFixed(0) : '0';
      return [i+1, name, t.Hadir, t.Sakit, t.Izin, t.Alpa, total, `${pct}%`];
    });

    doc.autoTable({
      startY: yPos,
      head: [['No','Nama Siswa','Hadir','Sakit','Izin','Alpa','Total','% Hadir']],
      body: tableBody,
      theme: 'grid',
      styles: { fontSize: 8.5, cellPadding: 2.5, font:'helvetica', textColor:[30,35,50] },
      headStyles: { fillColor:[15,20,30], textColor:[255,255,255], fontStyle:'bold', fontSize:7.5 },
      alternateRowStyles: { fillColor:[248,249,252] },
      columnStyles: {
        0: { cellWidth:10, halign:'center' },
        2: { halign:'center', textColor:[52,211,153], fontStyle:'bold' },
        3: { halign:'center', textColor:[251,146,60], fontStyle:'bold' },
        4: { halign:'center', textColor:[167,139,250], fontStyle:'bold' },
        5: { halign:'center', textColor:[248,113,113], fontStyle:'bold' },
        6: { halign:'center' },
        7: { halign:'center', fontStyle:'bold' },
      },
      didDrawCell: (d) => {
        if (d.section === 'body' && d.column.index === 7) {
          const pct = parseFloat(d.cell.text[0]);
          doc.setTextColor(...(pct>=75?[52,211,153]:pct>=50?[251,146,60]:[248,113,113]));
        }
      },
      margin: { left:14, right:14 },
    });
  });

  pdfFooter(doc);
  doc.save(`Rekap_Semua_Bulan_${meta.kelas.replace(/\s/g,'_')}.pdf`);
  showToast('PDF Semua Bulan berhasil didownload! 📄', 'success');
}
