const STORAGE_KEY = "sakubuku_transactions_v1";
const THEME_KEY = "sakubuku_theme_v1";

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];
const MON = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DAY3 = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const CATEGORIES = {
  expense: [
    "Makan & Minum",
    "Transportasi",
    "Belanja Harian",
    "Tagihan & Utilitas",
    "Kesehatan",
    "Hiburan",
    "Lainnya",
  ],
  income: ["Gaji", "Bonus", "Usaha / Freelance", "Investasi", "Hadiah", "Lainnya"],
};

const DONUT_COLORS = [
  "#0d8a64",
  "#d64536",
  "#d98218",
  "#2563eb",
  "#7c3aed",
  "#0891b2",
  "#64748b",
];

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

function formatRupiah(value) {
  return idrFormatter.format(Math.round(value || 0));
}

function groupDigits(n) {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

function shortNum(n) {
  if (n >= 1e6) return `${(Math.round((n / 1e6) * 10) / 10).toString().replace(".", ",")} jt`;
  if (n >= 1e3) return `${(Math.round((n / 1e3) * 10) / 10).toString().replace(".", ",")} rb`;
  return String(Math.round(n));
}

function niceMax(v) {
  if (v <= 0) return 100000;
  const e = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / e;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * e;
}

function pad(n) {
  return (n < 10 ? "0" : "") + n;
}

function todayDate() {
  const n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

function toYmd(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseYmd(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function loadTransactions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (t) =>
          t &&
          typeof t.date === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
          (t.type === "income" || t.type === "expense") &&
          Number.isFinite(t.amount)
      )
      .map((t) => ({
        ...t,
        id: t.id || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        note: typeof t.note === "string" ? t.note : "",
        category: t.category || "Lainnya",
      }));
  } catch {
    return [];
  }
}

function saveTransactions(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    showToast("Gagal menyimpan. Penyimpanan browser penuh atau diblokir.", null, "error", 5000);
  }
}

// Theme
function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.getElementById("themeIcon");
  if (icon) icon.textContent = theme === "dark" ? "☀" : "☾";
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved || "dark");
}

// State
let transactions = loadTransactions();
let periodView = "bulan"; // 'hari' | 'bulan' | 'tahun'
let cursor = todayDate();
let chartMetric = "out"; // 'out' | 'in'
let donutMetric = "expense"; // 'expense' | 'income'
let selectedBarIdx = 0;
let currentSeries = null;

let activeFormType = "expense";
let editingTxId = null;
let activeFilterType = "all";
let searchQuery = "";
let undoAction = null;
let toastTimer = null;

// Elements
const themeToggleBtn = document.getElementById("themeToggleBtn");
const exportCsvBtn = document.getElementById("exportCsvBtn");
const resetOpenBtn = document.getElementById("resetOpenBtn");

const periodTabsEl = document.getElementById("periodTabs");
const periodPrevBtn = document.getElementById("periodPrevBtn");
const periodNextBtn = document.getElementById("periodNextBtn");
const periodLabelEl = document.getElementById("periodLabel");
const periodNowBtn = document.getElementById("periodNowBtn");

const heroLabelEl = document.getElementById("heroLabel");
const netBalanceEl = document.getElementById("netBalance");
const statusPillEl = document.getElementById("statusPill");
const savingsBadgeEl = document.getElementById("savingsBadge");
const summaryPeriodNoteEl = document.getElementById("summaryPeriodNote");
const totalIncomeEl = document.getElementById("totalIncome");
const totalExpenseEl = document.getElementById("totalExpense");
const avgStatLabelEl = document.getElementById("avgStatLabel");
const avgStatValEl = document.getElementById("avgStatVal");
const peakStatLabelEl = document.getElementById("peakStatLabel");
const peakStatValEl = document.getElementById("peakStatVal");
const incomeRatioBarEl = document.getElementById("incomeRatioBar");

const compareSubtitleEl = document.getElementById("compareSubtitle");
const compareBadgeEl = document.getElementById("compareBadge");
const prevExpenseValEl = document.getElementById("prevExpenseVal");
const diffExpenseValEl = document.getElementById("diffExpenseVal");
const donutTabsEl = document.getElementById("donutTabs");

const donutChartEl = document.getElementById("donutChart");
const donutCenterCountEl = document.getElementById("donutCenterCount");
const categoryBreakdownEl = document.getElementById("categoryBreakdown");

const barChartHeadingEl = document.getElementById("barChartHeading");
const chartReadoutLabelEl = document.getElementById("chartReadoutLabel");
const roInEl = document.getElementById("roIn");
const roOutEl = document.getElementById("roOut");
const metricTabsEl = document.getElementById("metricTabs");
const barChartEl = document.getElementById("barChart");

const formPanelEl = document.getElementById("formPanel");
const sheetCloseBtn = document.getElementById("sheetCloseBtn");
const sheetScrimEl = document.getElementById("sheetScrim");
const formEl = document.getElementById("transactionForm");
const formHeadingEl = document.getElementById("formHeading");
const formSubtitleEl = document.getElementById("formSubtitle");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const submitBtn = document.getElementById("submitBtn");
const typeExpenseBtn = document.getElementById("typeExpenseBtn");
const typeIncomeBtn = document.getElementById("typeIncomeBtn");
const amountInput = document.getElementById("amountInput");
const quickAmountButtons = document.querySelectorAll(".chip-btn");
const categorySelect = document.getElementById("categorySelect");
const dateInput = document.getElementById("dateInput");
const noteInput = document.getElementById("noteInput");
const formErrorEl = document.getElementById("formError");

const txCountLabelEl = document.getElementById("txCountLabel");
const filterTabButtons = document.querySelectorAll(".list-panel .filter-tab");
const searchInput = document.getElementById("searchInput");
const transactionListEl = document.getElementById("transactionList");
const emptyStateEl = document.getElementById("emptyState");

const resetModalScrimEl = document.getElementById("resetModalScrim");
const resetCancelBtn = document.getElementById("resetCancelBtn");
const resetConfirmBtn = document.getElementById("resetConfirmBtn");

const toastEl = document.getElementById("toast");
const toastTextEl = document.getElementById("toastText");
const toastUndoBtn = document.getElementById("toastUndoBtn");

let toastExitTimer = null;

function hideToastImmediate() {
  if (toastTimer) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (toastExitTimer) {
    clearTimeout(toastExitTimer);
    toastExitTimer = null;
  }
  toastEl.classList.remove("is-leaving", "is-error");
  toastEl.hidden = true;
}

function showToast(message, onUndo = null, variant = "default", duration = null) {
  hideToastImmediate();
  if (variant === "error") {
    toastEl.classList.add("is-error");
  }
  toastTextEl.textContent = message;
  undoAction = onUndo;
  toastUndoBtn.hidden = !onUndo;
  toastEl.hidden = false;
  const ms = duration ?? (onUndo ? 5000 : 2500);
  toastTimer = setTimeout(() => {
    toastEl.classList.add("is-leaving");
    toastTimer = null;
    toastExitTimer = setTimeout(() => {
      toastEl.hidden = true;
      toastEl.classList.remove("is-leaving", "is-error");
      undoAction = null;
      toastExitTimer = null;
    }, 240);
  }, ms);
}

function runUndo() {
  if (!undoAction) return;
  const action = undoAction;
  undoAction = null;
  hideToastImmediate();
  action();
}

function parseAmountInput() {
  return parseInt(amountInput.value.replace(/\D/g, ""), 10) || 0;
}

function populateCategories(type) {
  const options = CATEGORIES[type] || [];
  categorySelect.innerHTML = "";
  for (const cat of options) {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categorySelect.appendChild(opt);
  }
}

function setFormType(type) {
  activeFormType = type;
  const isExpense = type === "expense";
  typeExpenseBtn.classList.toggle("is-active", isExpense);
  typeExpenseBtn.setAttribute("aria-pressed", String(isExpense));
  typeIncomeBtn.classList.toggle("is-active", !isExpense);
  typeIncomeBtn.setAttribute("aria-pressed", String(!isExpense));
  populateCategories(type);
  noteInput.placeholder = isExpense ? "Mis. nasi padang, kopi susu" : "Mis. gaji bulanan, bonus";
  if (!editingTxId) {
    submitBtn.textContent = isExpense ? "Simpan pengeluaran" : "Simpan pemasukan";
  }
}

function hideFormError() {
  formErrorEl.hidden = true;
}

function showFormError(message) {
  hideFormError();
  showToast(message, null, "error", 5000);
}

function resetFormMode() {
  editingTxId = null;
  formHeadingEl.textContent = "Catat transaksi";
  formSubtitleEl.textContent = "Tambah pemasukan atau pengeluaran baru";
  submitBtn.textContent = activeFormType === "expense" ? "Simpan pengeluaran" : "Simpan pemasukan";
  cancelEditBtn.hidden = true;
  amountInput.value = "";
  noteInput.value = "";
  dateInput.value = toYmd(todayDate());
  hideFormError();
}

function isMobileSheetMode() {
  return window.matchMedia("(max-width: 767px)").matches;
}

function openMobileSheet(type) {
  if (!isMobileSheetMode()) return;
  if (type) setFormType(type);
  formPanelEl.classList.add("is-sheet");
  sheetScrimEl.hidden = false;
  document.body.classList.add("sheet-open");
  amountInput.focus();
}

function closeMobileSheet() {
  formPanelEl.classList.remove("is-sheet");
  sheetScrimEl.hidden = true;
  document.body.classList.remove("sheet-open");
}

function startEditTransaction(tx) {
  editingTxId = tx.id;
  setFormType(tx.type);
  amountInput.value = groupDigits(tx.amount);
  categorySelect.value = tx.category;
  dateInput.value = tx.date;
  noteInput.value = tx.note;
  formHeadingEl.textContent = "Edit transaksi";
  formSubtitleEl.textContent = "Perbarui rincian transaksi terpilih";
  submitBtn.textContent = "Simpan perubahan";
  cancelEditBtn.hidden = false;
  hideFormError();
  if (isMobileSheetMode()) {
    openMobileSheet(tx.type);
  } else {
    amountInput.focus();
  }
}

// Period computation
function computePeriod() {
  const T = todayDate();
  const y = cursor.getFullYear();
  const m = cursor.getMonth();

  const byDay = {};
  for (const tx of transactions) {
    const o = byDay[tx.date] || (byDay[tx.date] = { in: 0, out: 0 });
    if (tx.type === "income") o.in += tx.amount;
    else o.out += tx.amount;
  }

  const dayVal = (d, k) => (byDay[toYmd(d)] ? byDay[toYmd(d)][k] : 0);
  const series = { out: [], in: [], lab: [], full: [] };
  let rows = [];
  let title = "";
  let isCurrent = false;
  let heroLabel = "";
  let chartTitle = "";
  let avgLabel = "";
  let avgVal = 0;
  let peakLabel = "";
  let peakVal = "–";
  let defaultIdx = 0;

  if (periodView === "hari") {
    const key = toYmd(cursor);
    rows = transactions.filter((tx) => tx.date === key);
    title = `${DAYS[cursor.getDay()]}, ${cursor.getDate()} ${MON[m]} ${y}`;
    isCurrent = key === toYmd(T);
    heroLabel = isCurrent ? "Selisih hari ini" : "Selisih hari itu";
    chartTitle = "Arus kas 7 hari terakhir";
    for (let i = 6; i >= 0; i--) {
      const d = new Date(y, m, cursor.getDate() - i);
      series.out.push(dayVal(d, "out"));
      series.in.push(dayVal(d, "in"));
      series.lab.push(DAY3[d.getDay()]);
      series.full.push(`${DAYS[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}`);
    }
    const sum7 = series.out.reduce((a, b) => a + b, 0);
    avgLabel = "Rata-rata 7 hari";
    avgVal = sum7 / 7;
    const yesterday = new Date(y, m, cursor.getDate() - 1);
    peakLabel = "Pengeluaran kemarin";
    peakVal = formatRupiah(dayVal(yesterday, "out"));
    defaultIdx = 6;
  } else if (periodView === "bulan") {
    const mk = `${y}-${pad(m + 1)}`;
    rows = transactions.filter((tx) => tx.date && tx.date.startsWith(mk));
    title = `${MONTHS[m]} ${y}`;
    isCurrent = y === T.getFullYear() && m === T.getMonth();
    heroLabel = isCurrent ? "Selisih bulan ini" : "Selisih bulan itu";
    chartTitle = `Arus kas harian · ${MONTHS[m]}`;
    const dim = new Date(y, m + 1, 0).getDate();
    for (let k = 1; k <= dim; k++) {
      const d = new Date(y, m, k);
      series.out.push(dayVal(d, "out"));
      series.in.push(dayVal(d, "in"));
      series.lab.push(k === 1 || k % 5 === 0 ? String(k) : "");
      series.full.push(`${DAYS[d.getDay()]}, ${k} ${MON[m]}`);
    }
    const totalOut = series.out.reduce((a, b) => a + b, 0);
    avgLabel = "Rata-rata / hari";
    avgVal = totalOut / (isCurrent ? T.getDate() : dim);
    let peak = 0;
    for (let i = 1; i < series.out.length; i++) {
      if (series.out[i] > series.out[peak]) peak = i;
    }
    peakLabel = "Hari terboros";
    peakVal = series.out[peak] > 0 ? `${peak + 1} ${MON[m]} · ${formatRupiah(series.out[peak])}` : "–";
    defaultIdx = isCurrent ? T.getDate() - 1 : peak;
  } else {
    const yk = String(y);
    rows = transactions.filter((tx) => tx.date && tx.date.startsWith(yk));
    title = yk;
    isCurrent = y === T.getFullYear();
    heroLabel = isCurrent ? "Selisih tahun ini" : "Selisih tahun itu";
    chartTitle = `Arus kas bulanan · ${yk}`;
    for (let q = 0; q < 12; q++) {
      series.out.push(0);
      series.in.push(0);
    }
    for (const tx of rows) {
      const mi = Number(tx.date.slice(5, 7)) - 1;
      if (mi >= 0 && mi < 12) {
        if (tx.type === "income") series.in[mi] += tx.amount;
        else series.out[mi] += tx.amount;
      }
    }
    series.lab = MON.slice();
    series.full = MONTHS.map((name) => `${name} ${y}`);
    const totalOut = series.out.reduce((a, b) => a + b, 0);
    avgLabel = "Rata-rata / bulan";
    avgVal = totalOut / (isCurrent ? T.getMonth() + 1 : 12);
    let peak = 0;
    for (let i = 1; i < series.out.length; i++) {
      if (series.out[i] > series.out[peak]) peak = i;
    }
    peakLabel = "Bulan terboros";
    peakVal = series.out[peak] > 0 ? `${MONTHS[peak]} · ${formatRupiah(series.out[peak])}` : "–";
    defaultIdx = isCurrent ? T.getMonth() : peak;
  }

  let income = 0;
  let expense = 0;
  for (const tx of rows) {
    if (tx.type === "income") income += tx.amount;
    else expense += tx.amount;
  }

  let prevExpense = 0;
  let prevLabel = "";
  if (periodView === "hari") {
    const prevDay = new Date(y, m, cursor.getDate() - 1);
    prevExpense = dayVal(prevDay, "out");
    prevLabel = `${DAYS[prevDay.getDay()]}, ${prevDay.getDate()} ${MON[prevDay.getMonth()]}`;
  } else if (periodView === "bulan") {
    const prevMonth = new Date(y, m - 1, 1);
    const pmk = `${prevMonth.getFullYear()}-${pad(prevMonth.getMonth() + 1)}`;
    // Bulan berjalan dibandingkan dengan bulan lalu sampai tanggal yang sama
    const dayLimit = isCurrent ? T.getDate() : 31;
    for (const tx of transactions) {
      if (
        tx.type === "expense" &&
        tx.date &&
        tx.date.startsWith(pmk) &&
        Number(tx.date.slice(8, 10)) <= dayLimit
      ) {
        prevExpense += tx.amount;
      }
    }
    prevLabel = `${MONTHS[prevMonth.getMonth()]} ${prevMonth.getFullYear()}`;
  } else {
    const pyk = String(y - 1);
    // Tahun berjalan dibandingkan dengan tahun lalu sampai bulan yang sama
    const monthLimit = isCurrent ? T.getMonth() + 1 : 12;
    for (const tx of transactions) {
      if (
        tx.type === "expense" &&
        tx.date &&
        tx.date.startsWith(pyk) &&
        Number(tx.date.slice(5, 7)) <= monthLimit
      ) {
        prevExpense += tx.amount;
      }
    }
    prevLabel = `Tahun ${pyk}`;
  }

  return {
    rows,
    title,
    isCurrent,
    heroLabel,
    chartTitle,
    avgLabel,
    avgVal,
    peakLabel,
    peakVal,
    income,
    expense,
    prevExpense,
    prevLabel,
    series,
    defaultIdx,
  };
}

function setChartReadout(idx) {
  if (!currentSeries) return;
  selectedBarIdx = idx;
  chartReadoutLabelEl.textContent = currentSeries.full[idx];
  roInEl.textContent = `+${formatRupiah(currentSeries.in[idx])}`;
  roOutEl.textContent = `-${formatRupiah(currentSeries.out[idx])}`;

  barChartEl.querySelectorAll(".col").forEach((btn, i) => {
    btn.classList.toggle("is-sel", i === idx);
    btn.tabIndex = i === idx ? 0 : -1;
  });
}

function renderBarChart(ctx) {
  barChartHeadingEl.textContent = ctx.chartTitle;
  currentSeries = ctx.series;
  const vals = ctx.series[chartMetric];
  const n = vals.length;
  const top = niceMax(Math.max(...vals, 0));
  const gap = n > 20 ? 3 : n > 8 ? 8 : 12;

  const colsHtml = vals
    .map((v, i) => {
      const h = v > 0 ? `${Math.max((v / top) * 100, 2)}%` : "2px";
      return `<button type="button" class="col${v === 0 ? " zero" : ""}" data-i="${i}" tabindex="-1" aria-label="${ctx.series.full[i]}: masuk ${formatRupiah(ctx.series.in[i])}, keluar ${formatRupiah(ctx.series.out[i])}"><i style="height:${h}"></i></button>`;
    })
    .join("");

  const xlHtml = ctx.series.lab.map((l) => `<span class="xl">${l}</span>`).join("");

  barChartEl.innerHTML = `
    <div class="bar-chart ${chartMetric === "in" ? "is-in" : ""}" style="--n:${n};--gap:${gap}px">
      <div class="yaxis" aria-hidden="true">
        <span style="top:0">${shortNum(top)}</span>
        <span style="top:50%">${shortNum(top / 2)}</span>
        <span style="top:100%">0</span>
      </div>
      <div class="plot">
        <div class="gl" style="top:0"></div>
        <div class="gl" style="top:50%"></div>
        <div class="gl base" style="top:100%"></div>
        <div class="cols">${colsHtml}</div>
      </div>
      <div class="xaxis" aria-hidden="true">${xlHtml}</div>
    </div>
  `;

  setChartReadout(ctx.defaultIdx);
}

function renderDonutAndBreakdown(rows) {
  const totals = new Map();
  let totalAmount = 0;

  for (const tx of rows) {
    if (tx.type !== donutMetric) continue;
    totalAmount += tx.amount;
    totals.set(tx.category, (totals.get(tx.category) || 0) + tx.amount);
  }

  const entries = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
  donutCenterCountEl.textContent = String(entries.length);

  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const svgParts = [
    `<circle cx="60" cy="60" r="${radius}" fill="none" stroke="var(--bg)" stroke-width="14" />`,
  ];

  if (totalAmount > 0) {
    let offset = 0;
    entries.forEach(([, amount], idx) => {
      const dash = (amount / totalAmount) * circumference;
      const color = DONUT_COLORS[idx % DONUT_COLORS.length];
      svgParts.push(
        `<circle cx="60" cy="60" r="${radius}" fill="none" stroke="${color}" stroke-width="14" stroke-dasharray="${dash} ${circumference - dash}" stroke-dashoffset="${-offset}" />`
      );
      offset += dash;
    });
  }
  donutChartEl.innerHTML = svgParts.join("");

  categoryBreakdownEl.innerHTML = "";
  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "breakdown-empty";
    empty.textContent =
      donutMetric === "income"
        ? "Belum ada pemasukan pada periode ini."
        : "Belum ada pengeluaran pada periode ini.";
    categoryBreakdownEl.appendChild(empty);
    return;
  }

  entries.forEach(([category, amount], idx) => {
    const pct = Math.round((amount / totalAmount) * 100);
    const color = DONUT_COLORS[idx % DONUT_COLORS.length];

    const row = document.createElement("div");
    row.className = "legend-row";

    const left = document.createElement("div");
    left.className = "legend-left";

    const swatch = document.createElement("span");
    swatch.className = "legend-swatch";
    swatch.style.backgroundColor = color;

    const name = document.createElement("span");
    name.className = "legend-name";
    name.textContent = category;

    left.append(swatch, name);

    const val = document.createElement("span");
    val.className = "legend-val";
    val.textContent = `${pct}% · ${formatRupiah(amount)}`;

    row.append(left, val);
    categoryBreakdownEl.appendChild(row);
  });
}

function formatDisplayDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  if (!y || !m || !d) return isoDate;
  return dateFormatter.format(new Date(y, m - 1, d));
}

function getVisibleTransactions(periodRows) {
  const query = searchQuery.trim().toLowerCase();
  return periodRows
    .filter((tx) => {
      if (activeFilterType !== "all" && tx.type !== activeFilterType) return false;
      if (!query) return true;
      return (
        tx.note.toLowerCase().includes(query) ||
        tx.category.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function renderList(visibleList) {
  txCountLabelEl.textContent = `${visibleList.length} transaksi`;
  transactionListEl.innerHTML = "";

  if (visibleList.length === 0) {
    emptyStateEl.hidden = false;
    return;
  }

  emptyStateEl.hidden = true;

  for (const tx of visibleList) {
    const li = document.createElement("li");
    li.className = "tx-item";

    const avatar = document.createElement("span");
    avatar.className = `tx-avatar ${tx.type === "income" ? "is-income" : "is-expense"}`;
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = tx.type === "income" ? "↑" : "↓";

    const main = document.createElement("div");
    main.className = "tx-main";

    const note = document.createElement("p");
    note.className = "tx-note";
    note.textContent = tx.note || tx.category;

    const meta = document.createElement("div");
    meta.className = "tx-meta";

    const badge = document.createElement("span");
    badge.className = `tx-badge ${tx.type === "income" ? "is-income" : "is-expense"}`;
    badge.textContent = tx.category;

    const dateSpan = document.createElement("span");
    dateSpan.textContent = formatDisplayDate(tx.date);

    meta.append(badge, dateSpan);
    main.append(note, meta);

    const amount = document.createElement("div");
    amount.className = `tx-amount ${tx.type === "income" ? "is-income" : "is-expense"}`;
    amount.textContent = `${tx.type === "income" ? "+" : "-"}${formatRupiah(tx.amount)}`;

    const actions = document.createElement("div");
    actions.className = "tx-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "tx-action-btn";
    editBtn.textContent = "Edit";
    editBtn.addEventListener("click", () => startEditTransaction(tx));

    const delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "tx-action-btn is-delete";
    delBtn.textContent = "Hapus";
    delBtn.addEventListener("click", () => {
      const idx = transactions.findIndex((item) => item.id === tx.id);
      if (idx === -1) return;
      const removed = transactions[idx];
      transactions.splice(idx, 1);
      saveTransactions(transactions);
      if (editingTxId === tx.id) resetFormMode();
      renderAll();
      showToast("Transaksi dihapus", () => {
        transactions.splice(idx, 0, removed);
        saveTransactions(transactions);
        renderAll();
      });
    });

    actions.append(editBtn, delBtn);
    li.append(avatar, main, amount, actions);
    transactionListEl.appendChild(li);
  }
}

function renderAll() {
  const ctx = computePeriod();

  // Period header
  periodLabelEl.textContent = ctx.title;
  periodNextBtn.disabled = ctx.isCurrent;
  periodNowBtn.hidden = ctx.isCurrent;
  periodNowBtn.textContent = { hari: "Hari ini", bulan: "Bulan ini", tahun: "Tahun ini" }[periodView];

  // Hero summary
  const net = ctx.income - ctx.expense;
  heroLabelEl.textContent = ctx.heroLabel;
  netBalanceEl.textContent = formatRupiah(net);
  netBalanceEl.classList.toggle("is-negative", net < 0);
  totalIncomeEl.textContent = formatRupiah(ctx.income);
  totalExpenseEl.textContent = formatRupiah(ctx.expense);
  summaryPeriodNoteEl.textContent = `${ctx.rows.length} transaksi pada ${ctx.title}`;

  statusPillEl.className = "status-pill";
  if (net > 0) {
    statusPillEl.textContent = "Surplus";
    statusPillEl.classList.add("is-pos");
  } else if (net < 0) {
    statusPillEl.textContent = "Defisit";
    statusPillEl.classList.add("is-neg");
  } else {
    statusPillEl.textContent = "Impas";
    statusPillEl.classList.add("is-even");
  }

  const savingsRate = ctx.income > 0 ? Math.max(0, Math.round((net / ctx.income) * 100)) : 0;
  savingsBadgeEl.textContent = `Tabungan ${savingsRate}%`;

  avgStatLabelEl.textContent = ctx.avgLabel;
  avgStatValEl.textContent = formatRupiah(ctx.avgVal);
  peakStatLabelEl.textContent = ctx.peakLabel;
  peakStatValEl.textContent = ctx.peakVal;

  const totalFlow = ctx.income + ctx.expense;
  const incomePercent = totalFlow === 0 ? 50 : Math.round((ctx.income / totalFlow) * 100);
  incomeRatioBarEl.style.width = `${incomePercent}%`;

  // Period comparison
  compareSubtitleEl.textContent = `Dibanding ${ctx.prevLabel}`;
  prevExpenseValEl.textContent = formatRupiah(ctx.prevExpense);
  const diff = ctx.expense - ctx.prevExpense;
  compareBadgeEl.className = "compare-badge";
  diffExpenseValEl.className = "compare-v";

  if (ctx.prevExpense === 0 && ctx.expense === 0) {
    compareBadgeEl.textContent = "Belum ada data";
    compareBadgeEl.classList.add("is-neutral");
    diffExpenseValEl.textContent = "Rp0";
  } else if (ctx.prevExpense === 0) {
    compareBadgeEl.textContent = "Periode baru";
    compareBadgeEl.classList.add("is-neutral");
    diffExpenseValEl.textContent = `+${formatRupiah(diff)}`;
  } else if (diff < 0) {
    const pct = Math.round((Math.abs(diff) / ctx.prevExpense) * 100);
    compareBadgeEl.textContent = `Hemat ${pct}%`;
    compareBadgeEl.classList.add("is-good");
    diffExpenseValEl.textContent = `-${formatRupiah(Math.abs(diff))}`;
    diffExpenseValEl.classList.add("is-good");
  } else if (diff > 0) {
    const pct = Math.round((diff / ctx.prevExpense) * 100);
    compareBadgeEl.textContent = `Naik ${pct}%`;
    compareBadgeEl.classList.add("is-bad");
    diffExpenseValEl.textContent = `+${formatRupiah(diff)}`;
    diffExpenseValEl.classList.add("is-bad");
  } else {
    compareBadgeEl.textContent = "Sama persis";
    compareBadgeEl.classList.add("is-neutral");
    diffExpenseValEl.textContent = "Rp0";
  }

  renderDonutAndBreakdown(ctx.rows);
  renderBarChart(ctx);
  renderList(getVisibleTransactions(ctx.rows));
}

function exportCsv() {
  const ctx = computePeriod();
  // Ekspor seluruh transaksi pada periode yang tampil, tanpa terpengaruh filter dan pencarian
  const list = ctx.rows.slice().sort((a, b) => a.date.localeCompare(b.date));
  if (list.length === 0) {
    showToast("Tidak ada transaksi untuk diunduh");
    return;
  }

  // Titik koma dipakai karena Excel dengan pengaturan regional Indonesia memisahkan kolom dengan ";"
  const csvCell = (value) => {
    let s = String(value ?? "");
    // Cegah teks yang diawali = + - @ dibaca sebagai rumus di Excel
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };

  const header = ["Tanggal", "Jenis", "Kategori", "Keterangan", "Nominal (IDR)"];
  const rows = list.map((tx) => [
    tx.date,
    tx.type === "income" ? "Pemasukan" : "Pengeluaran",
    tx.category,
    tx.note || tx.category,
    tx.amount,
  ]);

  const csvContent = [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  // BOM di depan supaya Excel membaca file sebagai UTF-8
  const blob = new Blob(["﻿" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `dompet-grace-${periodView}-${toYmd(cursor)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  showToast("File CSV berhasil diunduh");
}

// Event Listeners
themeToggleBtn.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

periodTabsEl.addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-view]");
  if (!btn || btn.dataset.view === periodView) return;
  periodView = btn.dataset.view;
  periodTabsEl.querySelectorAll(".period-tab").forEach((b) => {
    const active = b === btn;
    b.classList.toggle("is-active", active);
    b.setAttribute("aria-selected", String(active));
  });
  renderAll();
});

function shiftPeriod(dir) {
  if (periodView === "hari") {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + dir);
  } else if (periodView === "bulan") {
    cursor = new Date(cursor.getFullYear(), cursor.getMonth() + dir, 1);
  } else {
    cursor = new Date(cursor.getFullYear() + dir, 0, 1);
  }
  renderAll();
}

periodPrevBtn.addEventListener("click", () => shiftPeriod(-1));
periodNextBtn.addEventListener("click", () => shiftPeriod(1));
periodNowBtn.addEventListener("click", () => {
  cursor = todayDate();
  renderAll();
});

metricTabsEl.addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-metric]");
  if (!btn || btn.dataset.metric === chartMetric) return;
  chartMetric = btn.dataset.metric;
  metricTabsEl.querySelectorAll(".filter-tab").forEach((b) => {
    b.classList.toggle("is-active", b === btn);
  });
  renderBarChart(computePeriod());
});

// Bar chart pointer & keyboard interaction
function colAt(ev, plot) {
  const rect = plot.getBoundingClientRect();
  const n = currentSeries.lab.length;
  const idx = Math.floor(((ev.clientX - rect.left) / rect.width) * n);
  return Math.max(0, Math.min(n - 1, idx));
}

["pointermove", "pointerdown"].forEach((evtName) => {
  barChartEl.addEventListener(evtName, (ev) => {
    if (!currentSeries) return;
    const plot = ev.target.closest && ev.target.closest(".plot");
    if (!plot) return;
    const idx = colAt(ev, plot);
    if (idx !== selectedBarIdx) setChartReadout(idx);
  });
});

barChartEl.addEventListener("keydown", (ev) => {
  const btn = ev.target.closest && ev.target.closest(".col");
  if (!btn || !currentSeries) return;
  let idx = Number(btn.dataset.i);
  const n = currentSeries.lab.length;
  if (ev.key === "ArrowRight") idx = Math.min(n - 1, idx + 1);
  else if (ev.key === "ArrowLeft") idx = Math.max(0, idx - 1);
  else if (ev.key === "Home") idx = 0;
  else if (ev.key === "End") idx = n - 1;
  else return;
  ev.preventDefault();
  setChartReadout(idx);
  barChartEl.querySelectorAll(".col")[idx]?.focus();
});

// Form & Quick Amounts
typeExpenseBtn.addEventListener("click", () => setFormType("expense"));
typeIncomeBtn.addEventListener("click", () => setFormType("income"));

amountInput.addEventListener("input", () => {
  const digits = amountInput.value.replace(/\D/g, "").replace(/^0+/, "").slice(0, 11);
  amountInput.value = digits ? groupDigits(Number(digits)) : "";
});

for (const chip of quickAmountButtons) {
  chip.addEventListener("click", () => {
    const addVal = Number(chip.dataset.add) || 0;
    const next = parseAmountInput() + addVal;
    amountInput.value = groupDigits(next);
  });
}

cancelEditBtn.addEventListener("click", resetFormMode);

formEl.addEventListener("submit", (event) => {
  event.preventDefault();
  hideFormError();

  const amount = parseAmountInput();
  const category = categorySelect.value;
  const date = dateInput.value || toYmd(todayDate());
  const note = noteInput.value.trim() || category;

  if (!Number.isFinite(amount) || amount <= 0) {
    showFormError("Masukkan nominal lebih dari Rp0.");
    amountInput.focus();
    return;
  }

  if (editingTxId) {
    const target = transactions.find((t) => t.id === editingTxId);
    let previousCopy = null;
    if (target) {
      previousCopy = { ...target };
      target.type = activeFormType;
      target.amount = amount;
      target.category = category;
      target.date = date;
      target.note = note;
    }
    saveTransactions(transactions);
    cursor = parseYmd(date);
    resetFormMode();
    closeMobileSheet();
    renderAll();
    showToast("Perubahan disimpan", previousCopy ? () => {
      const current = transactions.find((t) => t.id === previousCopy.id);
      if (current) Object.assign(current, previousCopy);
      saveTransactions(transactions);
      renderAll();
    } : null);
    return;
  }

  const newTx = {
    id: `tx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: activeFormType,
    amount,
    category,
    date,
    note,
  };

  transactions.unshift(newTx);
  saveTransactions(transactions);
  cursor = parseYmd(date);
  resetFormMode();
  closeMobileSheet();
  renderAll();
  showToast("Transaksi dicatat", () => {
    transactions = transactions.filter((t) => t.id !== newTx.id);
    saveTransactions(transactions);
    renderAll();
  });
});

// Mobile bottom sheet triggers
document.querySelectorAll("[data-open-sheet]").forEach((btn) => {
  btn.addEventListener("click", () => {
    resetFormMode();
    openMobileSheet(btn.dataset.openSheet);
  });
});
sheetCloseBtn.addEventListener("click", closeMobileSheet);
sheetScrimEl.addEventListener("click", closeMobileSheet);

// Donut category toggle
donutTabsEl.addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-donut]");
  if (!btn || btn.dataset.donut === donutMetric) return;
  donutMetric = btn.dataset.donut;
  donutTabsEl.querySelectorAll(".mini-seg-btn").forEach((b) => {
    b.classList.toggle("is-active", b === btn);
  });
  renderDonutAndBreakdown(computePeriod().rows);
});

// Reset modal
resetOpenBtn.addEventListener("click", () => {
  if (transactions.length === 0) {
    showToast("Belum ada catatan untuk direset");
    return;
  }
  resetModalScrimEl.hidden = false;
  resetCancelBtn.focus();
});
resetCancelBtn.addEventListener("click", () => {
  resetModalScrimEl.hidden = true;
});
resetModalScrimEl.addEventListener("click", (ev) => {
  if (ev.target === resetModalScrimEl) resetModalScrimEl.hidden = true;
});
resetConfirmBtn.addEventListener("click", () => {
  const snapshot = transactions.map((t) => ({ ...t }));
  transactions = [];
  saveTransactions(transactions);
  resetFormMode();
  resetModalScrimEl.hidden = true;
  renderAll();
  showToast("Semua catatan direset", () => {
    transactions = snapshot;
    saveTransactions(transactions);
    renderAll();
  });
});

// Undo button & Ctrl+Z
toastUndoBtn.addEventListener("click", runUndo);
document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") {
    if (!resetModalScrimEl.hidden) resetModalScrimEl.hidden = true;
    else if (formPanelEl.classList.contains("is-sheet")) closeMobileSheet();
    return;
  }
  if (!undoAction || !(ev.ctrlKey || ev.metaKey) || ev.altKey || ev.shiftKey || ev.key.toLowerCase() !== "z") {
    return;
  }
  const tag = ev.target && ev.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  ev.preventDefault();
  runUndo();
});

// Filters & Export
for (const tab of filterTabButtons) {
  tab.addEventListener("click", () => {
    activeFilterType = tab.dataset.filter;
    for (const btn of filterTabButtons) {
      btn.classList.toggle("is-active", btn === tab);
    }
    renderList(getVisibleTransactions(computePeriod().rows));
  });
}

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value;
  renderList(getVisibleTransactions(computePeriod().rows));
});

exportCsvBtn.addEventListener("click", exportCsv);

// Init
initTheme();
dateInput.value = toYmd(todayDate());
setFormType("expense");
renderAll();

// PWA: service worker hanya didaftarkan di http(s), jadi versi Electron (file://) tidak terpengaruh
if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
