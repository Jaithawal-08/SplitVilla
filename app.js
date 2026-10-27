// Splitvilla Core State
let currentTrip = {
  name: "Goa Trip 2026",
  destination: "Goa, India",
  dates: "12–18 May"
};

let members = [];
let expenses = [];
let editingExpenseIndex = null;
let payment = {
  accountName: "Jai Thawal",
  upiId: "jaithawal@okhdfcbank",
  qrDataUrl: ""
};

// Seed/Demo data for initial presentation
const demoTrip = {
  name: "Goa Trip 2026",
  destination: "Candolim, Goa",
  dates: "12–18 May 2026"
};

const demoMembers = [
  { name: "Misty", photo: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80" },
  { name: "Rahul", photo: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&q=80" },
  { name: "Priya", photo: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=120&q=80" },
  { name: "Suryansh", photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=120&q=80" },
  { name: "Ananya", photo: "https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=120&q=80" },
  { name: "You", photo: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=120&q=80" }
];

const demoExpenses = [
  { desc: "Beach Shack Seafood Dinner", amt: 5400, payer: "Misty" },
  { desc: "North Goa Airport Cab & Fuel", amt: 3200, payer: "Rahul" },
  { desc: "Candolim Luxury Villa Deposit", amt: 7500, payer: "Misty" },
  { desc: "Water Sports & Scooter Rentals", amt: 2320, payer: "Priya" }
];

const pageTitles = {
  landing: "Splitvilla — Home",
  "create-trip": "Create a Trip",
  "join-trip": "Join a Trip",
  "trip-workspace": "Trip Workspace",
  dashboard: "Dashboard",
  members: "Trip Members",
  expenses: "Expense Ledger",
  chat: "Team Chat",
  contact: "Payment / UPI"
};

function formatInr(amount) {
  const n = Number(amount) || 0;
  return "₹" + n.toLocaleString("en-IN");
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function inferCategory(desc) {
  const d = String(desc || "").toLowerCase();
  if (d.includes("dinner") || d.includes("food") || d.includes("lunch") || d.includes("cafe") || d.includes("shack") || d.includes("drinks") || d.includes("meal")) return "FOOD";
  if (d.includes("cab") || d.includes("flight") || d.includes("fuel") || d.includes("scooter") || d.includes("taxi") || d.includes("airport") || d.includes("travel")) return "TRAVEL";
  if (d.includes("villa") || d.includes("hotel") || d.includes("stay") || d.includes("resort") || d.includes("airbnb")) return "STAY";
  return "ACTIVITIES";
}

/**
 * SOURCE OF TRUTH: Compute settlement balances and minimal peer-to-peer transfers
 */
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

function setPageLabel(id) {
  const el = document.getElementById("pageLabel");
  if (!el) return;
  el.innerText = pageTitles[id] || "Trip Workspace";
}

function saveState() {
  try {
    localStorage.setItem("splitvillaState", JSON.stringify({ currentTrip, members, expenses, payment }));
  } catch (e) {
    console.error("Failed to save state", e);
  }
}

function applyHashRoute() {
  const hash = (window.location.hash || "").replace("#", "").trim();
  const sectionIds = ["landing", "create-trip", "join-trip", "trip-workspace", "dashboard", "members", "expenses", "chat", "contact"];
  if (sectionIds.includes(hash)) {
    show(hash);
  } else {
    show("landing");
  }
}

function show(id) {
  document.querySelectorAll(".section").forEach((s) => s.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");

  const isLandingView = id === "landing" || id === "create-trip" || id === "join-trip";
  const landingNav = document.getElementById("landingNav");
  const tripNav = document.getElementById("tripNav");
  const mobileNavDock = document.getElementById("mobileNavDock");

  if (landingNav && tripNav) {
    if (isLandingView) {
      landingNav.style.display = "flex";
      tripNav.style.display = "none";
      // Hide mobile dock on landing/setup pages
      if (mobileNavDock) mobileNavDock.classList.add("dock-hidden");
    } else {
      landingNav.style.display = "none";
      tripNav.style.display = "flex";
      // Show mobile dock on trip pages
      if (mobileNavDock) mobileNavDock.classList.remove("dock-hidden");
    }
  }

  document.querySelectorAll(".nav-item").forEach((b) => {
    b.classList.remove("active");
    const oc = b.getAttribute("onclick") || "";
    if (oc.includes(`'${id}'`)) b.classList.add("active");
  });

  document.querySelectorAll(".mobile-nav-dock button").forEach((b) => {
    b.classList.remove("active");
    const oc = b.getAttribute("onclick") || "";
    if (oc.includes(`'${id}'`)) b.classList.add("active");
  });

  setPageLabel(id);

  if (window.location.hash !== "#" + id) {
    window.location.hash = id;
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

function scrollToSection(elemId, event) {
  if (event) event.preventDefault();
  if (!document.getElementById("landing").classList.contains("active")) {
    show("landing");
  }
  setTimeout(() => {
    const el = document.getElementById(elemId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  }, 100);
}

function openCreateTrip() {
  show("create-trip");
}

function openJoinTrip() {
  show("join-trip");
}

/**
 * Handle new trip creation from user input
 */
function handleCreateTrip() {
  const name = (document.getElementById("tripNameInput").value || "").trim() || "My Group Trip";
  const destination = (document.getElementById("tripDestInput").value || "").trim() || "Destination";
  const dates = (document.getElementById("tripDatesInput").value || "").trim() || "Upcoming Dates";
  const membersRaw = (document.getElementById("tripMembersInput").value || "").trim();

  currentTrip = { name, destination, dates };
  expenses = []; // Clear expenses for new trip

  if (membersRaw) {
    const parsed = membersRaw.split(",").map((s) => s.trim()).filter(Boolean);
    if (parsed.length > 0) {
      members = parsed.map((mName) => ({
        name: mName,
        photo: ""
      }));
    } else {
      members = [];
    }
  } else {
    members = [];
  }

  saveState();
  syncTripHeader();
  renderMembersList();
  renderExpenses();
  updateDashboard();
  renderWhoOwesWhom();
  renderRecentActivity();

  show("trip-workspace");
}

/**
 * Handle joining an existing trip
 */
function handleJoinTrip() {
  const code = (document.getElementById("joinCodeInput").value || "").trim() || "MYTRIP";
  const yourName = (document.getElementById("joinNameInput").value || "").trim() || "You";

  currentTrip.name = code.toUpperCase() + " Trip";

  if (!members.some((m) => m.name.toLowerCase() === yourName.toLowerCase())) {
    members.push({
      name: yourName,
      photo: ""
    });
  }

  saveState();
  syncTripHeader();
  renderMembersList();
  renderExpenses();
  updateDashboard();
  renderWhoOwesWhom();
  renderRecentActivity();

  show("trip-workspace");
}

/**
 * Load the demo Goa trip for presentation
 */
function loadDemoTrip() {
  currentTrip = { ...demoTrip };
  members = JSON.parse(JSON.stringify(demoMembers));
  expenses = JSON.parse(JSON.stringify(demoExpenses));
  saveState();

  syncTripHeader();
  renderMembersList();
  renderExpenses();
  updateDashboard();
  renderWhoOwesWhom();
  renderRecentActivity();
  show("trip-workspace");
}

function enterTrip(tripName) {
  // If no members loaded yet, seed the demo so the workspace isn't empty
  if (!members || members.length === 0) {
    loadDemoTrip();
    return;
  }
  if (tripName && typeof tripName === "string") {
    currentTrip.name = tripName;
  }
  syncTripHeader();
  renderWhoOwesWhom();
  renderRecentActivity();
  updateDashboard();
  show("trip-workspace");
}

function syncTripHeader() {
  const titleEl = document.getElementById("tripTitleDisplay");
  const metaEl = document.getElementById("tripMetaDisplay");
  const navTripName = document.getElementById("navTripName");

  if (titleEl) titleEl.innerText = currentTrip.name || "Group Trip";
  if (metaEl) metaEl.innerText = `${members.length} friends · ${currentTrip.dates || "Active"}`;
  if (navTripName) navTripName.innerText = currentTrip.name || "Group Trip";
}

function goToAnalytics() {
  window.location.href = "analytics.html";
}

/**
 * Load persisted state safely without overwriting user data
 */
function loadState() {
  try {
    const raw = localStorage.getItem("splitvillaState");
    if (raw) {
      const data = JSON.parse(raw);
      if (data && data.currentTrip) currentTrip = data.currentTrip;
      // Respect user's saved arrays even if empty
      members = Array.isArray(data.members) ? data.members : [];
      expenses = Array.isArray(data.expenses) ? data.expenses : [];
      payment = data && typeof data.payment === "object" && data.payment ? data.payment : payment;
    } else {
      // First visit: initialize with demo data so screen isn't completely empty
      currentTrip = { ...demoTrip };
      members = JSON.parse(JSON.stringify(demoMembers));
      expenses = JSON.parse(JSON.stringify(demoExpenses));
      saveState();
    }

    syncTripHeader();
    renderMembersList();
    renderExpenses();
    updateDashboard();
    renderWhoOwesWhom();
    renderRecentActivity();
    hydratePaymentUI();
    applyHashRoute();
  } catch (e) {
    console.error("Failed to load state", e);
  }
}

function getMemberAvatar(name) {
  const found = members.find((m) => m && m.name && m.name.toLowerCase() === String(name).toLowerCase());
  if (found && found.photo && !found.photo.includes("placeholder")) {
    return `<img src="${found.photo}" class="social-avatar" alt="${name}">`;
  }
  const initial = (name || "M").charAt(0).toUpperCase();
  return `<div class="social-avatar">${initial}</div>`;
}

function renderMembersList() {
  const membersList = document.getElementById("membersList");
  const payerSelect = document.getElementById("payer");
  if (!membersList || !payerSelect) return;

  membersList.innerHTML = "";
  payerSelect.innerHTML = "";

  const { netMap } = computeSettlement(members, expenses);

  if (members.length === 0) {
    membersList.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.95rem;">
        No members added yet. Add friends above to start tracking shared expenses.
      </div>
    `;
  } else {
    members.forEach((m) => {
      const div = document.createElement("div");
      div.className = "member";

      const net = netMap[m.name] || 0;
      let balanceTag = `<span class="member-balance-tag zero">Settled ✓</span>`;
      if (net > 0.009) {
        balanceTag = `<span class="member-balance-tag pos">Gets ${formatInr(net)}</span>`;
      } else if (net < -0.009) {
        balanceTag = `<span class="member-balance-tag neg">Owes ${formatInr(-net)}</span>`;
      }

      const imgTag = m.photo ? `<img src="${m.photo}" alt="${m.name}">` : `<div class="flow-avatar-round">${(m.name || "U").charAt(0).toUpperCase()}</div>`;

      div.innerHTML = `
        <div class="member-info">
          ${imgTag}
          <div class="member-name">${m.name}</div>
        </div>
        <div>${balanceTag}</div>
      `;
      membersList.appendChild(div);

      const opt = document.createElement("option");
      opt.value = m.name;
      opt.innerText = m.name;
      payerSelect.appendChild(opt);
    });
  }

  const membersCountEl = document.getElementById("membersCount");
  if (membersCountEl) membersCountEl.innerText = members.length;
  const metricMembersEl = document.getElementById("metricMembers");
  if (metricMembersEl) metricMembersEl.innerText = members.length;
  syncTripHeader();
  buildChatSenderOptions();
}

function renderExpenses() {
  const expList = document.getElementById("expList");
  if (!expList) return;
  expList.innerHTML = "";

  if (expenses.length === 0) {
    expList.innerHTML = `
      <li style="text-align: center; padding: 28px; color: var(--text-muted); font-size: 0.95rem; list-style: none;">
        No expenses recorded yet. Enter a description and amount above to log your first bill.
      </li>
    `;
    return;
  }

  expenses.forEach((e, idx) => {
    const li = document.createElement("li");
    li.className = "expense-item";

    const cat = inferCategory(e.desc);

    li.innerHTML = `
      <div class="expense-left">
        <span class="expense-category-pill">${cat}</span>
        <span><strong>${e.payer}</strong> paid ${formatInr(e.amt)} for <em>${e.desc}</em></span>
      </div>
      <div class="expense-item-actions">
        <button class="expense-mini-btn" type="button" onclick="startEditExpense(${idx})">Edit</button>
        <button class="expense-mini-btn" type="button" onclick="deleteExpense(${idx})" style="color: var(--terracotta); border-color: rgba(214, 105, 41, 0.3);">✕</button>
      </div>
    `;
    expList.appendChild(li);
  });
}

function renderWhoOwesWhom() {
  const container = document.getElementById("signatureFlowList");
  const ratioText = document.getElementById("signatureRatioText");
  if (!container) return;

  container.innerHTML = "";

  const { transfers } = computeSettlement(members, expenses);

  if (!transfers || transfers.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 32px 20px; color: var(--text-muted); font-size: 1rem;">
        ✨ All members are completely settled up! No transfers needed.
      </div>
    `;
    if (ratioText) ratioText.innerText = "ALL SETTLED · 0 TRANSFERS";
    return;
  }

  transfers.forEach((t) => {
    const row = document.createElement("div");
    row.className = "flow-card-row";

    const fromAvatar = getMemberAvatar(t.from);
    const toAvatar = getMemberAvatar(t.to);

    const isYouReceiver = t.to.toLowerCase() === "you";
    const isYouSender = t.from.toLowerCase() === "you";

    row.innerHTML = `
      <div class="flow-person">
        ${fromAvatar}
        <div class="flow-person-name ${isYouSender ? 'you-tag' : ''}">${t.from}</div>
      </div>
      <div class="flow-line-connector">
        <div class="flow-dashed-bar"></div>
        <div class="flow-amount-pill">${formatInr(t.amt)}</div>
      </div>
      <div class="flow-person receiver">
        <div class="flow-person-name ${isYouReceiver ? 'you-tag' : ''}">${t.to}</div>
        ${toAvatar}
      </div>
    `;
    container.appendChild(row);
  });

  if (ratioText) {
    const rawPairs = members.length > 1 ? (members.length * (members.length - 1)) / 2 : 1;
    const initialCount = Math.max(transfers.length + 1, Math.round(rawPairs));
    ratioText.innerText = `${initialCount} PAYMENTS → ${transfers.length} PAYMENTS`;
  }
}

function renderRecentActivity() {
  const container = document.getElementById("recentActivityList");
  if (!container) return;

  container.innerHTML = "";

  if (expenses.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.95rem;">
        No recent group activity. Start recording bills to see live activity here!
      </div>
    `;
    return;
  }

  const recent = [...expenses].reverse().slice(0, 5);

  recent.forEach((e) => {
    const item = document.createElement("div");
    item.className = "social-feed-item";

    const avatar = getMemberAvatar(e.payer);

    item.innerHTML = `
      <div class="social-feed-left">
        ${avatar}
        <div class="social-feed-text">
          <strong>${e.payer}</strong> added <span>${e.desc}</span>
        </div>
      </div>
      <div class="social-feed-amount">${formatInr(e.amt)}</div>
    `;
    container.appendChild(item);
  });
}

function updateDashboard() {
  const total = expenses.reduce((sum, e) => sum + (Number(e.amt) || 0), 0);
  const totalEl = document.getElementById("total");
  const metricTotalEl = document.getElementById("metricTotal");
  if (totalEl) totalEl.innerText = formatInr(total);
  if (metricTotalEl) metricTotalEl.innerText = formatInr(total);

  const { netMap, transfers } = computeSettlement(members, expenses);
  
  // Determine user's balance
  const youOweEl = document.getElementById("metricYouOwe");
  if (youOweEl) {
    if (members.length === 0 || total === 0) {
      youOweEl.innerText = "₹0";
    } else if (Object.prototype.hasOwnProperty.call(netMap, "You")) {
      const youNet = netMap["You"];
      if (youNet < -0.009) {
        youOweEl.innerText = formatInr(-youNet);
      } else if (youNet > 0.009) {
        youOweEl.innerText = "+" + formatInr(youNet);
      } else {
        youOweEl.innerText = "₹0";
      }
    } else {
      // If no member named "You", find maximum debt or show largest transfer
      const debts = Object.values(netMap).filter((v) => v < -0.009);
      if (debts.length > 0) {
        const maxDebt = Math.max(...debts.map((v) => Math.abs(v)));
        youOweEl.innerText = formatInr(maxDebt);
      } else {
        youOweEl.innerText = "₹0";
      }
    }
  }

  // Calculate actual settlement percentage
  const metricSettledEl = document.getElementById("metricSettled");
  if (metricSettledEl) {
    if (total === 0 || transfers.length === 0) {
      metricSettledEl.innerText = "100%";
    } else {
      const totalTransfers = transfers.reduce((sum, t) => sum + t.amt, 0);
      const ratio = Math.max(0, Math.min(100, Math.round(100 - (totalTransfers / (total || 1)) * 50)));
      metricSettledEl.innerText = `${ratio}%`;
    }
  }
}

function startEditExpense(index) {
  const e = expenses[index];
  if (!e) return;
  editingExpenseIndex = index;

  const descEl = document.getElementById("desc");
  const amtEl = document.getElementById("amt");
  const payerEl = document.getElementById("payer");
  if (descEl) descEl.value = e.desc || "";
  if (amtEl) amtEl.value = Number(e.amt) || 0;
  if (payerEl) payerEl.value = e.payer || "";

  const submit = document.getElementById("expenseSubmit");
  const cancel = document.getElementById("expenseCancel");
  if (submit) submit.innerText = "Save Edit";
  if (cancel) cancel.style.display = "inline-flex";

  show("expenses");
}

function cancelEditExpense() {
  editingExpenseIndex = null;
  const descEl = document.getElementById("desc");
  const amtEl = document.getElementById("amt");
  if (descEl) descEl.value = "";
  if (amtEl) amtEl.value = "";

  const submit = document.getElementById("expenseSubmit");
  const cancel = document.getElementById("expenseCancel");
  if (submit) submit.innerText = "Add Expense";
  if (cancel) cancel.style.display = "none";
}

function deleteExpense(index) {
  if (index < 0 || index >= expenses.length) return;
  expenses.splice(index, 1);
  if (editingExpenseIndex === index) {
    cancelEditExpense();
  }
  saveState();
  renderExpenses();
  updateDashboard();
  renderWhoOwesWhom();
  renderRecentActivity();
  renderMembersList();
}

function clearExpenses() {
  if (!expenses.length) return;
  const ok = window.confirm("Clear all trip expenses?");
  if (!ok) return;
  expenses = [];
  cancelEditExpense();
  saveState();
  renderExpenses();
  updateDashboard();
  renderWhoOwesWhom();
  renderRecentActivity();
  renderMembersList();
}

function addMember() {
  const nameInput = document.getElementById("name");
  const photoInput = document.getElementById("photo");
  const name = (nameInput ? nameInput.value : "").trim();
  if (!name) return;

  const photo = (photoInput ? photoInput.value : "").trim();

  // Avoid duplicate names
  if (!members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
    members.push({ name, photo });
  }

  if (nameInput) nameInput.value = "";
  if (photoInput) photoInput.value = "";

  saveState();
  renderMembersList();
  updateDashboard();
  renderWhoOwesWhom();
  syncTripHeader();
}

function clearMembers() {
  const ok = window.confirm("Clear all members and reset workspace?");
  if (!ok) return;
  members = [];
  expenses = [];
  saveState();
  renderMembersList();
  renderExpenses();
  updateDashboard();
  renderWhoOwesWhom();
  renderRecentActivity();
  syncTripHeader();
}

function addExpense() {
  const descEl = document.getElementById("desc");
  const amtEl = document.getElementById("amt");
  const payerEl = document.getElementById("payer");

  const desc = (descEl ? descEl.value : "").trim();
  const rawAmt = amtEl ? amtEl.value.trim() : "";
  const amt = Number(rawAmt);
  const payer = payerEl ? payerEl.value : "";

  const isDescEmpty = !desc;
  const isAmtInvalid = !rawAmt || isNaN(amt) || amt <= 0;

  if (isDescEmpty && isAmtInvalid) {
    alert("Please enter an expense description and amount.");
    return;
  }

  if (isDescEmpty) {
    alert("Please enter an expense description.");
    return;
  }

  if (isAmtInvalid) {
    alert("Please enter a valid amount.");
    return;
  }

  if (members.length === 0) {
    alert("Please add at least one member to the trip before adding expenses.");
    return;
  }

  if (!payer) {
    alert("Please select who paid for this expense.");
    return;
  }

  if (editingExpenseIndex !== null && expenses[editingExpenseIndex]) {
    expenses[editingExpenseIndex] = { desc, amt, payer };
    cancelEditExpense();
  } else {
    expenses.push({ desc, amt, payer });
    if (descEl) descEl.value = "";
    if (amtEl) amtEl.value = "";
  }

  saveState();
  renderExpenses();
  updateDashboard();
  renderWhoOwesWhom();
  renderRecentActivity();
  renderMembersList();
}

function hydratePaymentUI() {
  const nameEl = document.getElementById("contactName");
  const upiEl = document.getElementById("contactUpi");
  const qrPreview = document.getElementById("qrPreview");
  const qrEmpty = document.getElementById("qrEmpty");
  const qrUpload = document.getElementById("qrUpload");

  if (nameEl) nameEl.value = payment.accountName || "";
  if (upiEl) upiEl.value = payment.upiId || "";

  if (qrPreview && qrEmpty) {
    const hasQr = Boolean(payment.qrDataUrl);
    qrPreview.style.display = hasQr ? "block" : "none";
    qrEmpty.style.display = hasQr ? "none" : "block";
    if (hasQr) qrPreview.src = payment.qrDataUrl;
  }

  if (qrUpload && !qrUpload.dataset.bound) {
    qrUpload.dataset.bound = "true";
    qrUpload.addEventListener("change", async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;

      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      payment.qrDataUrl = dataUrl;
      saveState();
      hydratePaymentUI();
    });
  }
}

function savePaymentDetails() {
  const nameEl = document.getElementById("contactName");
  const upiEl = document.getElementById("contactUpi");
  payment.accountName = nameEl ? String(nameEl.value || "").trim() : payment.accountName;
  payment.upiId = upiEl ? String(upiEl.value || "").trim() : payment.upiId;
  saveState();
  alert("Payment details saved!");
}

async function copyUpi() {
  const upi = String((payment && payment.upiId) || "").trim();
  if (!upi) return;
  try {
    await navigator.clipboard.writeText(upi);
    alert("UPI ID copied: " + upi);
  } catch (e) {
    console.error("Failed to copy UPI", e);
  }
}

function getChatSender() {
  const sel = document.getElementById("chatSender");
  return sel ? sel.value : (members.length > 0 ? members[0].name : "You");
}

function buildChatSenderOptions() {
  const sel = document.getElementById("chatSender");
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = "";
  const senderNames = members.length > 0 ? members.map(m => m.name) : ["You"];
  senderNames.forEach((name) => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
  // Restore previous selection if still valid
  if (current && senderNames.includes(current)) sel.value = current;
}

function sendMsg() {
  const msgEl = document.getElementById("msg");
  const chatBox = document.getElementById("chatBox");
  if (!msgEl || !chatBox) return;
  const text = msgEl.value.trim();
  if (!text) return;

  const sender = getChatSender();
  const avatar = getMemberAvatar(sender);
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

  const msgDiv = document.createElement("div");
  msgDiv.className = "chat-message";
  msgDiv.innerHTML = `
    <div class="chat-avatar-wrap">${avatar}</div>
    <div class="chat-bubble-wrap">
      <div class="chat-meta"><strong>${sender}</strong><span>${timeStr}</span></div>
      <div class="chat-bubble">${text}</div>
    </div>
  `;
  chatBox.appendChild(msgDiv);
  msgEl.value = "";
  chatBox.scrollTop = chatBox.scrollHeight;
}

document.addEventListener("DOMContentLoaded", () => {
  loadState();

  // Chat: send on Enter key
  const msgEl = document.getElementById("msg");
  if (msgEl) {
    msgEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });
  }
});

window.addEventListener("hashchange", applyHashRoute);



