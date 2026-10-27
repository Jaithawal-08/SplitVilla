let chart;
let settlementTextForWA = "";

function shareOnWhatsApp() {
  if (!settlementTextForWA) return;
  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(settlementTextForWA)}`;
  window.open(url, '_blank');
}

function goBack() {
  window.location.href = "index.html#trip-workspace";
}

function showEmptyState() {
  const el = document.getElementById("emptyState");
  if (el) el.style.display = "block";
}

function showResultsEmptyState() {
  const el = document.getElementById("resultsEmpty");
  if (el) el.style.display = "block";
}

function formatInr(amount) {
  const n = Number(amount) || 0;
  return "₹" + n.toLocaleString("en-IN");
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function computeSettlement(mList, expList) {
  const names = (mList || []).map((m) => m && m.name).filter(Boolean);
  const unique = Array.from(new Set(names));
  if (unique.length === 0) return { total: 0, share: 0, paidMap: {}, netMap: {}, transfers: [] };

  const paidMap = {};
  unique.forEach((name) => (paidMap[name] = 0));

  let total = 0;
  (expList || []).forEach((e) => {
    const payer = e && e.payer ? String(e.payer).trim() : "";
    const amt = Number(e && e.amt) || 0;
    total += amt;
    if (!payer) return;
    if (!Object.prototype.hasOwnProperty.call(paidMap, payer)) {
      paidMap[payer] = 0;
      unique.push(payer);
    }
    paidMap[payer] += amt;
  });

  const share = unique.length > 0 ? total / unique.length : 0;
  const netMap = {};
  unique.forEach((name) => {
    netMap[name] = round2((Number(paidMap[name]) || 0) - share);
  });

  const creditors = [];
  const debtors = [];
  Object.entries(netMap).forEach(([name, net]) => {
    const v = round2(net);
    if (v > 0.009) creditors.push({ name, amt: v });
    else if (v < -0.009) debtors.push({ name, amt: -v });
  });

  creditors.sort((a, b) => b.amt - a.amt);
  debtors.sort((a, b) => b.amt - a.amt);

  const transfers = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const d = debtors[i];
    const c = creditors[j];
    const pay = round2(Math.min(d.amt, c.amt));
    if (pay > 0) transfers.push({ from: d.name, to: c.name, amt: pay });
    d.amt = round2(d.amt - pay);
    c.amt = round2(c.amt - pay);
    if (d.amt <= 0.009) i++;
    if (c.amt <= 0.009) j++;
  }

  return { total: round2(total), share: round2(share), paidMap, netMap, transfers };
}

function renderResults(members, expenses) {
  const netList = document.getElementById("netList");
  const transferList = document.getElementById("transferList");
  if (!netList || !transferList) return;

  netList.innerHTML = "";
  transferList.innerHTML = "";

  const waBtn = document.getElementById("waShareBtn");
  if (waBtn) waBtn.classList.remove("visible");
  settlementTextForWA = "";

  const { total, share, paidMap, netMap, transfers } = computeSettlement(members, expenses);
  const names = Object.keys(netMap);
  if (names.length === 0 || total <= 0) {
    showResultsEmptyState();
    return;
  }

  let waText = `*Splitvilla Settlement*\n\n*Total Spent:* ${formatInr(total)}\n*Share per person:* ${formatInr(share)}\n\n*Net Balances:*\n`;

  const header = document.createElement("div");
  header.className = "results-meta";
  header.innerHTML = `<div><strong>Total</strong> ${formatInr(total)}</div><div><strong>Share</strong> ${formatInr(share)} / person</div>`;
  netList.appendChild(header);

  names
    .sort((a, b) => (netMap[b] || 0) - (netMap[a] || 0))
    .forEach((name) => {
      const net = Number(netMap[name]) || 0;
      const paid = Number(paidMap[name]) || 0;
      const row = document.createElement("div");
      row.className = "results-row";
      row.innerHTML = `
        <div class="results-name">${name}</div>
        <div class="results-sub">Paid ${formatInr(paid)}</div>
        <div class="results-amt ${net >= 0 ? "pos" : "neg"}">${net >= 0 ? "+" : ""}${formatInr(net)}</div>
      `;
      netList.appendChild(row);
      waText += `- ${name}: ${net >= 0 ? "+" : ""}${formatInr(net)}\n`;
    });

  if (transfers.length === 0) {
    const ok = document.createElement("div");
    ok.className = "results-row";
    ok.innerHTML = `<div class="results-name">All settled</div><div class="results-sub">No transfers needed.</div><div class="results-amt pos">${formatInr(0)}</div>`;
    transferList.appendChild(ok);
    waText += `\n*All settled!* No transfers needed. 💸`;
    settlementTextForWA = waText;
    if (waBtn) waBtn.classList.add("visible");
    return;
  }

  waText += `\n*Minimal Transfers:*\n`;
  transfers.forEach((t) => {
    const row = document.createElement("div");
    row.className = "results-row";
    row.innerHTML = `
      <div class="results-name">${t.from} → ${t.to}</div>
      <div class="results-sub">Transfer</div>
      <div class="results-amt neg">${formatInr(t.amt)}</div>
    `;
    transferList.appendChild(row);
    waText += `💰 ${t.from} → ${t.to}: ${formatInr(t.amt)}\n`;
  });
  
  waText += `\nSettle up via Splitvilla!`;
  settlementTextForWA = waText;
  if (waBtn) waBtn.classList.add("visible");
}

function switchTab(tab) {
  const overview = document.getElementById("viewOverview");
  const results = document.getElementById("viewResults");
  const tabOverview = document.getElementById("tabOverview");
  const tabResults = document.getElementById("tabResults");
  if (!overview || !results || !tabOverview || !tabResults) return;

  const isResults = tab === "results";
  overview.style.display = isResults ? "none" : "block";
  results.style.display = isResults ? "block" : "none";

  tabOverview.classList.toggle("active", !isResults);
  tabResults.classList.toggle("active", isResults);
  tabOverview.setAttribute("aria-selected", String(!isResults));
  tabResults.setAttribute("aria-selected", String(isResults));
}

function buildAnalytics() {
  try {
    const raw = localStorage.getItem("splitvillaState");
    if (!raw) {
      showEmptyState();
      showResultsEmptyState();
      return;
    }

    const data = JSON.parse(raw);
    const members = Array.isArray(data.members) ? data.members : [];
    const expenses = Array.isArray(data.expenses) ? data.expenses : [];

    if (members.length === 0 || expenses.length === 0) {
      showEmptyState();
      showResultsEmptyState();
      return;
    }

    const paidMap = {};
    members.forEach((m) => {
      paidMap[m.name] = 0;
    });

    expenses.forEach((e) => {
      if (!Object.prototype.hasOwnProperty.call(paidMap, e.payer)) {
        paidMap[e.payer] = 0;
      }
      paidMap[e.payer] += Number(e.amt) || 0;
    });

    const labels = Object.keys(paidMap);
    const values = Object.values(paidMap);
    if (labels.length === 0) {
      showEmptyState();
      return;
    }

    const palette = ["#153323", "#D66929", "#2B6E3F", "#E58A3C", "#3D5A47", "#8EAA99", "#A64D1B"];
    const ctx = document.getElementById("chart");
    if (!ctx) return;

    if (chart) chart.destroy();

    chart = new Chart(ctx, {
      type: "doughnut",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((_, i) => palette[i % palette.length]),
            borderColor: "#FFFFFF",
            borderWidth: 2,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#373E3A",
              font: {
                family: "'Plus Jakarta Sans', sans-serif",
                size: 13,
                weight: '500'
              },
              boxWidth: 12,
              boxHeight: 12,
              padding: 16
            }
          }
        }
      }
    });

    renderResults(members, expenses);
  } catch (e) {
    console.error("Failed to build analytics", e);
    showEmptyState();
    showResultsEmptyState();
  }
}

document.addEventListener("DOMContentLoaded", buildAnalytics);
