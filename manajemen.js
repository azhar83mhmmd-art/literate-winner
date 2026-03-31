// ============================================
//   AbsenKelas — Manajemen Kelas v1.0
//   Piket | MBG | Organisasi
// ============================================

(function () {
  'use strict';

  // ============================================
  //   DATA PIKET
  // ============================================
  const JADWAL_PIKET = {
    1: { hari: 'Senin',    anggota: ['Sauqi Rohman', 'Achmad Dani', 'Ani Zastia', 'Andina'] },
    2: { hari: 'Selasa',   anggota: ['Nikmatul Husna', 'Hatipah', 'Muhammad Raihan Alfarezy'] },
    3: { hari: 'Rabu',     anggota: ['Muhammad Rappi', 'Muhammad Rudianor', 'Hayattul Husna', 'Yuliana Rahmah'] },
    4: { hari: 'Kamis',    anggota: ['Muhammad Azhar', 'Muhammad Tajudin', 'Nur Aulia', 'Aderia'] },
    5: { hari: 'Jumat',    anggota: ['Ahmad Nauval', 'Muhammad Jurifky Alfarizi', 'Rihadatul Asyifa Nuregia', 'Aspia Nabila'] },
    6: { hari: 'Sabtu',    anggota: ['Muhammad Rudianor', 'Muhammad Hanafi', 'Amelia Rahmah', 'Nazzlia Naila'] },
  };

  // ============================================
  //   DATA MBG — ROTASI SESI
  // ============================================
  const SESI_MBG = [
    { sesi: 1, anggota: ['Nazzua Naila', 'Andina', 'Yuliana Rahmah', 'Aderia', 'Muhammad Raihan Alfarezy'] },
    { sesi: 2, anggota: ['Muhammad Azhar', 'Muhammad Jurifky Alfarizi', 'Muhammad Tajudin', 'Raihan Ramadani'] },
    { sesi: 3, anggota: ['Nur Aulia', 'Aspia Nabila', 'Sauqi Rohman', 'Ahmad Nauval', 'Hatipah', 'Hayattul Husna'] },
    { sesi: 4, anggota: ['Nikmatul Husna', 'Rihadatul Asyifa Nuregia', 'Amelia Rahmah', 'Ani Zastia', 'Muhammad Rappi', 'Muhammad Rudianor'] },
  ];

  // Titik referensi: 2025-01-06 (Senin) = Sesi 1, hari ke-0
  const MBG_REF_DATE = new Date(2025, 0, 6); // 6 Januari 2025

  // ============================================
  //   DATA ORGANISASI
  // ============================================
  const ORGANISASI = [
    { jabatan: 'Wali Kelas',  nama: 'Ibu Istiqomah S.Pd.I', icon: 'fa-chalkboard-user', utama: true },
    { jabatan: 'Ketua Kelas', nama: 'Muhammad Jurifky Alfarizi', icon: 'fa-crown', utama: true },
    { jabatan: 'Wakil Ketua', nama: 'Muhammad Tajudin', icon: 'fa-user-tie', utama: false },
    { jabatan: 'Sekretaris',  nama: 'Amelia Rahmah', icon: 'fa-pen-nib', utama: false },
    { jabatan: 'Bendahara',   nama: 'Hayattul Husna', icon: 'fa-wallet', utama: false },
  ];

  // ============================================
  //   HELPERS
  // ============================================

  function todayNoTime() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function hariIni() {
    return new Date().getDay(); // 0=Minggu
  }

  function getNamaHari(idx) {
    return ['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'][idx];
  }

  // Hitung hari kerja (non-Minggu) dari ref ke tanggal t
  function countWorkdays(from, to) {
    let count = 0;
    const cur = new Date(from);
    while (cur < to) {
      if (cur.getDay() !== 0) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  function getMBGSesiUntuk(tanggal) {
    const d = new Date(tanggal.getFullYear(), tanggal.getMonth(), tanggal.getDate());
    if (d.getDay() === 0) return null; // Minggu dilewati
    const workdays = countWorkdays(MBG_REF_DATE, d);
    const idx = workdays % SESI_MBG.length;
    return SESI_MBG[idx];
  }

  function getMBGWorkdaysToDate(d) {
    // Returns how many non-Sunday days since ref up to (not including) d
    return countWorkdays(MBG_REF_DATE, d);
  }

  // Expose to AI assistant
  window.getMBGTodaySesi = function() {
    const sesi = getMBGSesiUntuk(new Date());
    if (!sesi) return null;
    return { sesi: sesi.sesi, members: sesi.anggota };
  };

  // ============================================
  //   RENDER PIKET PAGE
  // ============================================

  function renderPiket() {
    const container = document.getElementById('piketContent');
    if (!container) return;

    const todayIdx = hariIni();
    const today = todayNoTime();

    // Get today's absent students from attendance
    let absentToday = [];
    try {
      const storage = JSON.parse(localStorage.getItem('absenKelas') || '{}');
      const key = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
      const dayData = storage[key];
      if (dayData && dayData.records) {
        absentToday = Object.entries(dayData.records)
          .filter(([,s]) => s !== 'Hadir')
          .map(([n]) => n);
      }
    } catch(e) {}

    let html = '';

    // Today's highlight card
    if (todayIdx === 0) {
      html += `<div class="mgmt-info-card">
        <div class="mgmt-info-icon"><i class="fa-solid fa-calendar-xmark"></i></div>
        <div><strong>Hari Minggu</strong> — Tidak ada jadwal piket hari ini.</div>
      </div>`;
    } else {
      const jadwalHariIni = JADWAL_PIKET[todayIdx];
      const warningNames = jadwalHariIni.anggota.filter(n => absentToday.includes(n));

      html += `<div class="mgmt-today-card">
        <div class="mgmt-today-header">
          <div class="mgmt-today-icon"><i class="fa-solid fa-broom"></i></div>
          <div>
            <div class="mgmt-today-title">Petugas Piket Hari Ini</div>
            <div class="mgmt-today-sub">${jadwalHariIni.hari}, ${today.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][today.getMonth()]} ${today.getFullYear()}</div>
          </div>
        </div>
        <div class="mgmt-today-members">
          ${jadwalHariIni.anggota.map(n => {
            const absent = absentToday.includes(n);
            return `<div class="mgmt-member-chip ${absent ? 'absent' : ''}">
              <i class="fa-solid ${absent ? 'fa-circle-xmark' : 'fa-circle-check'}"></i>
              ${n}
              ${absent ? '<span class="absent-badge">Tidak Hadir</span>' : ''}
            </div>`;
          }).join('')}
        </div>
        ${warningNames.length > 0 ? `<div class="mgmt-warning">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <span><strong>${warningNames.join(', ')}</strong> tidak hadir hari ini. Koordinasikan pengganti.</span>
        </div>` : ''}
      </div>`;
    }

    // Weekly schedule grid
    html += `<div class="mgmt-section-title"><i class="fa-solid fa-calendar-week"></i> Jadwal Piket Mingguan</div>`;
    html += `<div class="mgmt-week-grid">`;

    for (let i = 1; i <= 6; i++) {
      const jadwal = JADWAL_PIKET[i];
      const isToday = i === todayIdx;
      const isPast  = i < todayIdx;

      html += `<div class="mgmt-day-card ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}">
        <div class="mgmt-day-header">
          <span class="mgmt-day-name">${jadwal.hari}</span>
          ${isToday ? '<span class="mgmt-today-badge">Hari Ini</span>' : ''}
        </div>
        <div class="mgmt-day-members">
          ${jadwal.anggota.map(n => {
            const absent = isToday && absentToday.includes(n);
            return `<div class="mgmt-day-member ${absent ? 'absent' : ''}">
              <i class="fa-solid fa-user-${absent ? 'xmark' : 'check'}"></i>
              <span>${n}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`;
    }

    html += `</div>`;
    container.innerHTML = html;
  }

  // ============================================
  //   RENDER MBG PAGE
  // ============================================

  function renderMBG() {
    const container = document.getElementById('mbgContent');
    if (!container) return;

    const today = todayNoTime();
    const todayIdx = hariIni();

    const sesiHariIni = getMBGSesiUntuk(today);

    let html = '';

    if (todayIdx === 0) {
      html += `<div class="mgmt-info-card">
        <div class="mgmt-info-icon"><i class="fa-solid fa-calendar-xmark"></i></div>
        <div><strong>Hari Minggu</strong> — Tidak ada jadwal pengambilan MBG hari ini.</div>
      </div>`;
    } else if (sesiHariIni) {
      html += `<div class="mgmt-today-card mbg-today">
        <div class="mgmt-today-header">
          <div class="mgmt-today-icon mbg-icon"><i class="fa-solid fa-bowl-food"></i></div>
          <div>
            <div class="mgmt-today-title">Petugas Ambil MBG Hari Ini</div>
            <div class="mgmt-today-sub">Sesi ${sesiHariIni.sesi} — ${getNamaHari(todayIdx)}, ${today.getDate()} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][today.getMonth()]} ${today.getFullYear()}</div>
          </div>
        </div>
        <div class="mgmt-today-members">
          ${sesiHariIni.anggota.map(n => `<div class="mgmt-member-chip mbg-chip">
            <i class="fa-solid fa-circle-check"></i>
            ${n}
          </div>`).join('')}
        </div>
      </div>`;
    }

    // Show rotation schedule (7 days)
    html += `<div class="mgmt-section-title"><i class="fa-solid fa-rotate"></i> Rotasi Jadwal MBG (7 Hari)</div>`;
    html += `<div class="mbg-rotation-list">`;

    for (let offset = -1; offset <= 5; offset++) {
      const d = new Date(today);
      d.setDate(d.getDate() + offset);
      if (d.getDay() === 0) continue; // skip Minggu

      const sesi = getMBGSesiUntuk(d);
      if (!sesi) continue;

      const isToday = offset === 0;
      const isPast  = offset < 0;
      const bulanNm = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];

      html += `<div class="mbg-rotation-row ${isToday ? 'today' : ''} ${isPast ? 'past' : ''}">
        <div class="mbg-rot-date">
          <div class="mbg-rot-day">${getNamaHari(d.getDay())}</div>
          <div class="mbg-rot-dmy">${d.getDate()} ${bulanNm[d.getMonth()]}</div>
        </div>
        <div class="mbg-rot-sesi">
          <span class="mbg-sesi-badge sesi-${sesi.sesi}">Sesi ${sesi.sesi}</span>
        </div>
        <div class="mbg-rot-members">
          ${sesi.anggota.map(n => `<span class="mbg-name-chip">${n.split(' ')[0]}</span>`).join('')}
        </div>
        ${isToday ? '<div class="mbg-today-mark"><i class="fa-solid fa-arrow-left"></i> Hari ini</div>' : ''}
      </div>`;
    }

    html += `</div>`;

    // Full sesi list
    html += `<div class="mgmt-section-title"><i class="fa-solid fa-list-ol"></i> Daftar Lengkap Per Sesi</div>`;
    html += `<div class="mbg-sesi-grid">`;
    SESI_MBG.forEach(s => {
      html += `<div class="mbg-sesi-card sesi-${s.sesi}">
        <div class="mbg-sesi-header">
          <span class="mbg-sesi-badge sesi-${s.sesi}">Sesi ${s.sesi}</span>
          <span class="mbg-sesi-count">${s.anggota.length} siswa</span>
        </div>
        <div class="mbg-sesi-members">
          ${s.anggota.map(n => `<div class="mbg-sesi-member"><i class="fa-solid fa-user"></i> ${n}</div>`).join('')}
        </div>
      </div>`;
    });
    html += `</div>`;

    container.innerHTML = html;
  }

  // ============================================
  //   RENDER ORGANISASI PAGE
  // ============================================

  function renderOrganisasi() {
    const container = document.getElementById('organisasiContent');
    if (!container) return;

    let html = `
    <div class="org-header-card">
      <div class="org-school-icon"><i class="fa-solid fa-school"></i></div>
      <div class="org-school-info">
        <div class="org-school-name">Struktur Organisasi Kelas</div>
        <div class="org-school-sub">Tahun Pelajaran 2025/2026</div>
      </div>
    </div>

    <div class="org-grid">`;

    ORGANISASI.forEach(o => {
      html += `<div class="org-card ${o.utama ? 'utama' : ''}">
        <div class="org-card-icon ${o.utama ? 'utama' : ''}">
          <i class="fa-solid ${o.icon}"></i>
        </div>
        <div class="org-card-jabatan">${o.jabatan}</div>
        <div class="org-card-nama">${o.nama}</div>
      </div>`;
    });

    html += `</div>

    <div class="org-info-note">
      <i class="fa-solid fa-circle-info"></i>
      <span>Hubungi pengurus kelas untuk koordinasi kegiatan dan informasi kelas.</span>
    </div>`;

    container.innerHTML = html;
  }

  // ============================================
  //   INJECT CSS FOR MANAGEMENT PAGES
  // ============================================

  function injectManajemenCSS() {
    if (document.getElementById('manajemen-styles')) return;
    const s = document.createElement('style');
    s.id = 'manajemen-styles';
    s.textContent = `

/* ===== SECTION TITLE ===== */
.mgmt-section-title {
  font-size: 13px; font-weight: 700;
  color: var(--text-secondary);
  text-transform: uppercase; letter-spacing: 0.06em;
  display: flex; align-items: center; gap: 8px;
  margin: 28px 0 14px;
}
.mgmt-section-title i { color: var(--accent-blue); font-size: 12px; }

/* ===== INFO CARD ===== */
.mgmt-info-card {
  display: flex; align-items: center; gap: 14px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 18px 20px;
  color: var(--text-secondary); font-size: 14px;
  margin-bottom: 20px;
}
.mgmt-info-icon {
  width: 40px; height: 40px; border-radius: 10px;
  background: rgba(79,142,247,0.1); color: var(--accent-blue);
  display: flex; align-items: center; justify-content: center;
  font-size: 18px; flex-shrink: 0;
}

/* ===== TODAY CARD ===== */
.mgmt-today-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 22px;
  margin-bottom: 24px;
  position: relative;
  overflow: hidden;
}
.mgmt-today-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0;
  height: 3px;
  background: linear-gradient(90deg, var(--accent-blue), #818cf8);
}
.mgmt-today-card.mbg-today::before {
  background: linear-gradient(90deg, var(--hadir), #38bdf8);
}
.mgmt-today-header {
  display: flex; align-items: center; gap: 16px;
  margin-bottom: 18px;
}
.mgmt-today-icon {
  width: 48px; height: 48px; border-radius: 12px;
  background: rgba(79,142,247,0.12);
  color: var(--accent-blue);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; flex-shrink: 0;
}
.mgmt-today-icon.mbg-icon {
  background: rgba(52,211,153,0.12);
  color: var(--hadir);
}
.mgmt-today-title {
  font-weight: 700; font-size: 16px; color: var(--text-primary);
  margin-bottom: 3px;
}
.mgmt-today-sub {
  font-size: 12px; color: var(--text-muted);
}
.mgmt-today-members {
  display: flex; flex-wrap: wrap; gap: 8px;
}
.mgmt-member-chip {
  display: flex; align-items: center; gap: 7px;
  background: rgba(79,142,247,0.08);
  border: 1px solid rgba(79,142,247,0.2);
  border-radius: 8px; padding: 7px 12px;
  font-size: 13px; color: var(--text-primary);
  font-weight: 500;
}
.mgmt-member-chip i { color: var(--accent-blue); font-size: 11px; }
.mgmt-member-chip.absent {
  background: rgba(248,113,113,0.08);
  border-color: rgba(248,113,113,0.2);
  color: var(--text-secondary);
  text-decoration: line-through;
}
.mgmt-member-chip.absent i { color: var(--alpa); }
.mgmt-member-chip.mbg-chip {
  background: rgba(52,211,153,0.08);
  border-color: rgba(52,211,153,0.2);
}
.mgmt-member-chip.mbg-chip i { color: var(--hadir); }
.absent-badge {
  font-size: 10px; padding: 2px 6px; border-radius: 4px;
  background: rgba(248,113,113,0.15); color: var(--alpa);
  font-weight: 600; margin-left: 2px;
}
.mgmt-warning {
  display: flex; align-items: flex-start; gap: 10px;
  margin-top: 14px;
  background: rgba(251,146,60,0.08);
  border: 1px solid rgba(251,146,60,0.2);
  border-radius: 8px; padding: 10px 14px;
  font-size: 12.5px; color: var(--sakit);
}
.mgmt-warning i { margin-top: 1px; flex-shrink: 0; }

/* ===== WEEK GRID ===== */
.mgmt-week-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
}
.mgmt-day-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 14px 16px;
  transition: var(--transition);
}
.mgmt-day-card.today {
  border-color: rgba(79,142,247,0.4);
  background: rgba(79,142,247,0.05);
  box-shadow: 0 0 0 1px rgba(79,142,247,0.12);
}
.mgmt-day-card.past {
  opacity: 0.5;
}
.mgmt-day-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 10px;
}
.mgmt-day-name {
  font-weight: 700; font-size: 13px; color: var(--text-primary);
}
.mgmt-today-badge {
  font-size: 9.5px; padding: 2px 7px; border-radius: 4px;
  background: rgba(79,142,247,0.15); color: var(--accent-blue);
  font-weight: 700; letter-spacing: 0.04em;
}
.mgmt-day-members {
  display: flex; flex-direction: column; gap: 5px;
}
.mgmt-day-member {
  display: flex; align-items: center; gap: 7px;
  font-size: 12.5px; color: var(--text-secondary);
}
.mgmt-day-member i { color: var(--hadir); font-size: 10px; flex-shrink: 0; }
.mgmt-day-member.absent { color: var(--alpa); }
.mgmt-day-member.absent i { color: var(--alpa); }

/* ===== MBG ROTATION ===== */
.mbg-rotation-list {
  display: flex; flex-direction: column; gap: 6px;
  margin-bottom: 4px;
}
.mbg-rotation-row {
  display: flex; align-items: center; gap: 12px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 10px 14px;
  transition: var(--transition);
}
.mbg-rotation-row.today {
  border-color: rgba(52,211,153,0.4);
  background: rgba(52,211,153,0.04);
}
.mbg-rotation-row.past { opacity: 0.45; }
.mbg-rot-date {
  min-width: 64px;
}
.mbg-rot-day { font-size: 12px; font-weight: 700; color: var(--text-primary); }
.mbg-rot-dmy { font-size: 10.5px; color: var(--text-muted); }
.mbg-rot-sesi { min-width: 60px; }
.mbg-sesi-badge {
  font-size: 11px; padding: 3px 9px; border-radius: 5px;
  font-weight: 700; display: inline-block;
}
.mbg-sesi-badge.sesi-1 { background: rgba(79,142,247,0.12); color: #60a5fa; }
.mbg-sesi-badge.sesi-2 { background: rgba(167,139,250,0.12); color: var(--izin); }
.mbg-sesi-badge.sesi-3 { background: rgba(251,146,60,0.12); color: var(--sakit); }
.mbg-sesi-badge.sesi-4 { background: rgba(52,211,153,0.12); color: var(--hadir); }
.mbg-rot-members {
  display: flex; flex-wrap: wrap; gap: 5px; flex: 1;
}
.mbg-name-chip {
  font-size: 11px; padding: 2px 8px; border-radius: 4px;
  background: var(--bg-input); color: var(--text-secondary);
  border: 1px solid var(--border);
}
.mbg-today-mark {
  font-size: 10.5px; color: var(--hadir); font-weight: 600;
  white-space: nowrap;
}

/* ===== MBG SESI GRID ===== */
.mbg-sesi-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.mbg-sesi-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 16px;
}
.mbg-sesi-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 12px;
}
.mbg-sesi-count {
  font-size: 11px; color: var(--text-muted);
}
.mbg-sesi-members {
  display: flex; flex-direction: column; gap: 6px;
}
.mbg-sesi-member {
  display: flex; align-items: center; gap: 8px;
  font-size: 12.5px; color: var(--text-secondary);
}
.mbg-sesi-member i { font-size: 10px; color: var(--text-muted); }

/* ===== ORGANISASI ===== */
.org-header-card {
  display: flex; align-items: center; gap: 18px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius); padding: 22px 24px;
  margin-bottom: 28px;
  position: relative; overflow: hidden;
}
.org-header-card::before {
  content: '';
  position: absolute; top: 0; left: 0; right: 0; height: 3px;
  background: linear-gradient(90deg, #f59e0b, #818cf8, var(--accent-blue));
}
.org-school-icon {
  width: 56px; height: 56px; border-radius: 14px;
  background: linear-gradient(135deg, rgba(245,158,11,0.15), rgba(129,140,248,0.15));
  border: 1px solid rgba(245,158,11,0.25);
  display: flex; align-items: center; justify-content: center;
  font-size: 24px; color: #f59e0b; flex-shrink: 0;
}
.org-school-name {
  font-size: 17px; font-weight: 800; color: var(--text-primary);
  margin-bottom: 4px;
}
.org-school-sub {
  font-size: 12px; color: var(--text-muted);
}
.org-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
  margin-bottom: 20px;
}
.org-card {
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: 22px 18px;
  text-align: center; transition: var(--transition);
}
.org-card:hover {
  background: var(--bg-card-hover);
  border-color: rgba(79,142,247,0.25);
  transform: translateY(-2px);
  box-shadow: var(--shadow);
}
.org-card.utama {
  border-color: rgba(245,158,11,0.25);
  background: rgba(245,158,11,0.03);
}
.org-card.utama:hover {
  border-color: rgba(245,158,11,0.4);
}
.org-card-icon {
  width: 52px; height: 52px; border-radius: 14px;
  background: rgba(79,142,247,0.1);
  color: var(--accent-blue);
  display: flex; align-items: center; justify-content: center;
  font-size: 20px; margin: 0 auto 14px;
}
.org-card-icon.utama {
  background: rgba(245,158,11,0.12);
  color: #f59e0b;
}
.org-card-jabatan {
  font-size: 11px; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--text-muted); margin-bottom: 8px;
}
.org-card-nama {
  font-size: 14px; font-weight: 700; color: var(--text-primary);
  line-height: 1.4;
}
.org-info-note {
  display: flex; align-items: center; gap: 10px;
  background: var(--bg-card); border: 1px solid var(--border);
  border-radius: var(--radius-sm); padding: 12px 16px;
  font-size: 12.5px; color: var(--text-muted);
}
.org-info-note i { color: var(--accent-blue); flex-shrink: 0; }

/* ===== RESPONSIVE ===== */
@media (max-width: 640px) {
  .mgmt-week-grid { grid-template-columns: repeat(2, 1fr); }
  .mbg-sesi-grid { grid-template-columns: 1fr 1fr; }
  .org-grid { grid-template-columns: repeat(2, 1fr); }
  .mbg-rotation-row { flex-wrap: wrap; gap: 8px; }
  .mbg-rot-members { margin-top: 2px; }
}
@media (max-width: 420px) {
  .mgmt-week-grid { grid-template-columns: 1fr; }
  .mbg-sesi-grid  { grid-template-columns: 1fr; }
  .org-grid       { grid-template-columns: 1fr; }
}
    `;
    document.head.appendChild(s);
  }

  // ============================================
  //   INJECT HTML PAGES & NAV
  // ============================================

  function injectPages() {
    const main = document.getElementById('mainContent');
    if (!main) return;

    // PAGE: PIKET
    const pagePiket = document.createElement('section');
    pagePiket.className = 'page';
    pagePiket.id = 'page-piket';
    pagePiket.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="section-title">Jadwal Piket</h1>
          <p class="section-sub">Petugas kebersihan kelas mingguan</p>
        </div>
        <div class="header-actions">
          <button class="btn-export" onclick="window.renderPiketPage()">
            <i class="fa-solid fa-rotate"></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>
      <div id="piketContent"></div>
    `;
    main.appendChild(pagePiket);

    // PAGE: MBG
    const pageMBG = document.createElement('section');
    pageMBG.className = 'page';
    pageMBG.id = 'page-mbg';
    pageMBG.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="section-title">Jadwal MBG</h1>
          <p class="section-sub">Rotasi petugas pengambilan Makan Bergizi</p>
        </div>
        <div class="header-actions">
          <button class="btn-export" onclick="window.renderMBGPage()">
            <i class="fa-solid fa-rotate"></i>
            <span>Refresh</span>
          </button>
        </div>
      </div>
      <div id="mbgContent"></div>
    `;
    main.appendChild(pageMBG);

    // PAGE: ORGANISASI
    const pageOrg = document.createElement('section');
    pageOrg.className = 'page';
    pageOrg.id = 'page-organisasi';
    pageOrg.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="section-title">Struktur Organisasi</h1>
          <p class="section-sub">Pengurus dan wali kelas</p>
        </div>
      </div>
      <div id="organisasiContent"></div>
    `;
    main.appendChild(pageOrg);
  }

  // ============================================
  //   INJECT NAV ITEMS
  // ============================================

  function injectNavItems() {
    const nav = document.querySelector('.sidebar-nav');
    if (!nav) return;

    const navItems = [
      { page: 'piket',      icon: 'fa-broom',      label: 'Jadwal Piket' },
      { page: 'mbg',        icon: 'fa-bowl-food',  label: 'Jadwal MBG' },
      { page: 'organisasi', icon: 'fa-users-gear',  label: 'Organisasi' },
    ];

    // Add separator
    const sep = document.createElement('div');
    sep.style.cssText = 'height:1px;background:var(--border);margin:8px 12px;';
    nav.appendChild(sep);

    navItems.forEach(item => {
      const a = document.createElement('a');
      a.href = '#';
      a.className = 'nav-item';
      a.dataset.page = item.page;
      a.innerHTML = `<i class="fa-solid ${item.icon}"></i><span>${item.label}</span>`;
      a.addEventListener('click', e => {
        e.preventDefault();
        navigateTo(item.page, item.label);
      });
      nav.appendChild(a);
    });
  }

  // ============================================
  //   NAVIGATION HANDLER
  // ============================================

  function navigateTo(page, label) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const active = document.querySelector(`[data-page="${page}"]`);
    if (active) active.classList.add('active');

    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    const pageTitle = document.getElementById('pageTitle');
    if (pageTitle) pageTitle.textContent = label;

    // Render content on navigate
    if (page === 'piket')      renderPiket();
    if (page === 'mbg')        renderMBG();
    if (page === 'organisasi') renderOrganisasi();

    if (window.innerWidth <= 768) {
      if (typeof window.closeSidebar === 'function') window.closeSidebar();
    }
  }

  // Expose globally for AI assistant and refresh buttons
  window.renderPiketPage      = renderPiket;
  window.renderMBGPage        = renderMBG;
  window.renderOrganisasiPage = renderOrganisasi;

  // ============================================
  //   INIT
  // ============================================

  function init() {
    injectManajemenCSS();
    injectPages();
    injectNavItems();

    // Pre-render so pages are ready when opened
    renderOrganisasi();

    // Auto-refresh piket and MBG when attendance changes
    // Intercept submitAbsensi to re-render piket after save
    const origSubmit = window.submitAbsensi;
    if (typeof origSubmit === 'function') {
      window.submitAbsensi = function() {
        origSubmit.apply(this, arguments);
        setTimeout(() => {
          if (document.getElementById('page-piket').classList.contains('active')) renderPiket();
          if (document.getElementById('page-mbg').classList.contains('active')) renderMBG();
        }, 300);
      };
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
