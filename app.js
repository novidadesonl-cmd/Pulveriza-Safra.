const TYPES = ["herbicida", "fungicida", "inseticida", "adjuvante", "fertilizante foliar", "outro"];
const UNITS = ["L", "ml", "kg", "g"];
const REASONS = ["praga", "doença", "mato", "preventivo", "outro"];
const LEVELS = ["baixo", "médio", "alto"];
const WIND = ["Não", "pouco", "forte"];
const YESNO = ["Não", "sim"];
const RAIN = ["Não", "até 1h", "até 3h", "no mesmo dia"];
const PERIOD = ["manhã", "tarde", "noite"];
const REAPPLY = ["não informado", "3", "7", "10", "14", "21"];
const STORAGE_KEY = "pulverizaSafraState";

const seed = {
  cultures: [
    { id: crypto.randomUUID(), name: "Soja", season: "2025/2026", area: 48, note: "Área demonstrativa" },
  ],
  fields: [],
  products: [],
  applications: [],
};
seed.fields.push({ id: crypto.randomUUID(), name: "Talhão Norte", cultureId: seed.cultures[0].id, hectares: 18, note: "Próximo ao açude" });
seed.products.push({ id: crypto.randomUUID(), name: "Produto Exemplo", type: "fungicida", unit: "L", purchased: 40, price: 1800, unitCost: 45, stock: 22, minStock: 8, doseRef: 1.2, note: "Substitua pelo produto real usado na fazenda" });

let state = loadState();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : seed;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function money(value) {
  return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function number(value, digits = 2) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date, days) {
  if (!date || Number.isNaN(Number(days))) return "";
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + Number(days));
  return d.toISOString().slice(0, 10);
}

function daysBetween(date) {
  if (!date) return null;
  const oneDay = 86_400_000;
  const target = new Date(`${date}T00:00:00`);
  const now = new Date(`${todayISO()}T00:00:00`);
  return Math.round((target - now) / oneDay);
}

function byId(collection, id) {
  return state[collection].find((item) => item.id === id);
}

function fillSelect(id, items, placeholder = "Selecione") {
  const select = document.getElementById(id);
  select.innerHTML = `<option value="">${placeholder}</option>` + items.map((item) => `<option value="${item.id}">${item.name}</option>`).join("");
}

function fillStaticSelect(id, values) {
  document.getElementById(id).innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function setScreen(sectionId) {
  document.querySelectorAll(".screen").forEach((screen) => screen.classList.toggle("active-screen", screen.id === sectionId));
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.section === sectionId));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function initNavigation() {
  document.querySelectorAll("[data-section]").forEach((button) => button.addEventListener("click", () => setScreen(button.dataset.section)));
  document.querySelectorAll("[data-open-section]").forEach((button) => button.addEventListener("click", () => setScreen(button.dataset.openSection)));
  document.querySelectorAll("[data-reset-form]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.resetForm).reset()));
}

function refreshSelects() {
  fillSelect("fieldCulture", state.cultures);
  fillSelect("applicationCulture", state.cultures);
  fillSelect("applicationField", state.fields);
  fillSelect("applicationProduct", state.products);
  fillSelect("filterCulture", state.cultures, "Todas");
  fillSelect("filterField", state.fields, "Todos");
  fillSelect("filterProduct", state.products, "Todos");
}

function riskFor(app) {
  const risks = [];
  if (app.rain === "até 1h") risks.push({ type: "danger", text: "Risco alto por chuva até 1h" });
  if (app.rain === "até 3h") risks.push({ type: "warning", text: "Risco médio por chuva até 3h" });
  if (app.wind === "forte") risks.push({ type: "warning", text: "Risco de deriva por vento forte" });
  if (app.fog === "sim") risks.push({ type: "warning", text: "Atenção climática por neblina" });
  return risks;
}

function isGraceActive(app) {
  const remaining = daysBetween(app.graceEnd);
  return remaining !== null && remaining >= 0;
}

function getAlerts() {
  const alerts = [];
  state.applications.forEach((app) => {
    const culture = byId("cultures", app.cultureId)?.name || "Cultura não informada";
    const field = byId("fields", app.fieldId)?.name || "Talhão não informado";
    const product = byId("products", app.productId)?.name || "Produto não informado";
    const reapplyDays = daysBetween(app.nextReapply);
    if (reapplyDays !== null && reapplyDays < 0) alerts.push({ severity: "danger", category: "Reaplicação atrasada", text: `${culture} / ${field} com ${product}: prazo venceu em ${app.nextReapply}.` });
    if (reapplyDays === 0) alerts.push({ severity: "danger", category: "Reaplicação hoje", text: `${culture} / ${field} com ${product}: reaplicar hoje.` });
    if (reapplyDays !== null && reapplyDays > 0 && reapplyDays <= 3) alerts.push({ severity: "warning", category: "Reaplicação em até 3 dias", text: `${culture} / ${field} com ${product}: faltam ${reapplyDays} dia(s).` });
    if (isGraceActive(app)) alerts.push({ severity: "warning", category: "Carência ativa", text: `${product}: carência até ${app.graceEnd}.` });
    riskFor(app).forEach((risk) => alerts.push({ severity: risk.type, category: risk.text, text: `${culture} / ${field} em ${app.date}.` }));
  });

  state.products.forEach((product) => {
    if (Number(product.stock) < Number(product.minStock || 0)) alerts.push({ severity: "danger", category: "Estoque baixo", text: `${product.name}: ${number(product.stock, 3)} ${product.unit} em estoque; mínimo ${number(product.minStock, 3)} ${product.unit}.` });
    const coverage = product.doseRef ? Number(product.stock || 0) / Number(product.doseRef) : 0;
    const nextArea = Math.max(...state.fields.map((field) => Number(field.hectares || 0)), 0);
    if (product.doseRef && coverage < nextArea) alerts.push({ severity: "warning", category: "Produto insuficiente para próxima aplicação", text: `${product.name}: cobre cerca de ${number(coverage)} ha pela dose referência.` });
  });
  return alerts;
}

function renderDashboard() {
  const alerts = getAlerts();
  const totalCost = state.applications.reduce((sum, app) => sum + Number(app.totalCost || 0), 0);
  const totalArea = state.applications.reduce((sum, app) => sum + Number(app.hectares || 0), 0);
  const cardData = [
    ["Reaplicações hoje", alerts.filter((a) => a.category === "Reaplicação hoje").length, "danger"],
    ["Reaplicações em até 3 dias", alerts.filter((a) => a.category === "Reaplicação em até 3 dias").length, "warning"],
    ["Aplicações atrasadas", alerts.filter((a) => a.category === "Reaplicação atrasada").length, "danger"],
    ["Risco por chuva ou vento", alerts.filter((a) => a.category.includes("chuva") || a.category.includes("vento")).length, "warning"],
    ["Produtos com estoque baixo", alerts.filter((a) => a.category === "Estoque baixo").length, "earth"],
    ["Gasto total na safra", money(totalCost), ""],
    ["Custo médio por hectare", money(totalArea ? totalCost / totalArea : 0), ""],
  ];
  document.getElementById("dashboardCards").innerHTML = cardData.map(([label, value, style]) => `<article class="metric-card ${style}"><span>${label}</span><strong>${value}</strong></article>`).join("");
}

function renderCultures() {
  document.getElementById("cultureList").innerHTML = state.cultures.map((culture) => `
    <article class="item-card"><h3>${culture.name}</h3><p class="meta">Safra: ${culture.season || "não informado"}<br>Área: ${number(culture.area)} ha<br>${culture.note || ""}</p>${actions("culture", culture.id)}</article>`).join("") || empty("Nenhuma cultura cadastrada.");
}

function renderFields() {
  document.getElementById("fieldList").innerHTML = state.fields.map((field) => `
    <article class="item-card"><h3>${field.name}</h3><p class="meta">Cultura: ${byId("cultures", field.cultureId)?.name || "não informada"}<br>Área: ${number(field.hectares)} ha<br>${field.note || ""}</p>${actions("field", field.id)}</article>`).join("") || empty("Nenhum talhão/local cadastrado.");
}

function renderProducts() {
  document.getElementById("productList").innerHTML = state.products.map((product) => {
    const coverage = product.doseRef ? Number(product.stock || 0) / Number(product.doseRef) : 0;
    const low = Number(product.stock) < Number(product.minStock || 0);
    return `<article class="item-card"><h3>${product.name}</h3><div class="badge-row"><span class="badge">${product.type}</span><span class="badge ${low ? "danger" : ""}">Estoque: ${number(product.stock, 3)} ${product.unit}</span></div><p class="meta">Custo unitário: ${money(product.unitCost)}<br>Cobre aprox.: ${product.doseRef ? `${number(coverage)} ha` : "dose referência não informada"}<br>${product.note || ""}</p>${actions("product", product.id)}</article>`;
  }).join("") || empty("Nenhum produto cadastrado.");
}

function renderAlerts() {
  const alerts = getAlerts();
  document.getElementById("alertsList").innerHTML = alerts.map((alert) => `<article class="alert-card ${alert.severity}"><h3>${alert.category}</h3><p class="meta">${alert.text}</p></article>`).join("") || empty("Nenhum alerta no momento.");
}

function renderHistory() {
  const filters = {
    cultureId: filterCulture.value,
    fieldId: filterField.value,
    productId: filterProduct.value,
    operator: filterOperator.value.toLowerCase(),
    from: filterFrom.value,
    to: filterTo.value,
    risk: filterRisk.checked,
    late: filterLate.checked,
  };
  const apps = state.applications.filter((app) => {
    if (filters.cultureId && app.cultureId !== filters.cultureId) return false;
    if (filters.fieldId && app.fieldId !== filters.fieldId) return false;
    if (filters.productId && app.productId !== filters.productId) return false;
    if (filters.operator && !String(app.operator || "").toLowerCase().includes(filters.operator)) return false;
    if (filters.from && app.date < filters.from) return false;
    if (filters.to && app.date > filters.to) return false;
    if (filters.risk && !riskFor(app).length) return false;
    if (filters.late && !(daysBetween(app.nextReapply) < 0)) return false;
    return true;
  });
  document.getElementById("historyList").innerHTML = apps.map(applicationCard).join("") || empty("Nenhuma aplicação encontrada.");
}

function renderReports() {
  const costByCulture = state.cultures.map((culture) => ({ name: culture.name, cost: sumApps((app) => app.cultureId === culture.id, "totalCost"), area: sumApps((app) => app.cultureId === culture.id, "hectares") }));
  const productUsage = state.products.map((product) => ({ name: product.name, qty: sumApps((app) => app.productId === product.id, "usedQty"), unit: product.unit, stock: product.stock, doseRef: product.doseRef }));
  const mostUsed = [...productUsage].sort((a, b) => b.qty - a.qty)[0];
  const fieldCosts = state.fields.map((field) => ({ name: field.name, cost: sumApps((app) => app.fieldId === field.id, "totalCost") })).sort((a, b) => b.cost - a.cost);
  const riskCount = state.applications.filter((app) => riskFor(app).length).length;
  const cards = [
    ["Custo total por cultura", costByCulture.map((c) => `${c.name}: ${money(c.cost)} (${money(c.area ? c.cost / c.area : 0)}/ha)`).join("<br>") || "Sem dados"],
    ["Quantidade usada por produto", productUsage.map((p) => `${p.name}: ${number(p.qty, 3)} ${p.unit}`).join("<br>") || "Sem dados"],
    ["Produto mais usado", mostUsed && mostUsed.qty ? `${mostUsed.name}: ${number(mostUsed.qty, 3)} ${mostUsed.unit}` : "Sem dados"],
    ["Talhão com maior custo", fieldCosts[0]?.cost ? `${fieldCosts[0].name}: ${money(fieldCosts[0].cost)}` : "Sem dados"],
    ["Aplicações com risco climático", `${riskCount} aplicação(ões)`],
    ["Saldo de estoque", productUsage.map((p) => `${p.name}: ${number(p.stock, 3)} ${p.unit}`).join("<br>") || "Sem dados"],
    ["Hectares que o estoque ainda cobre", productUsage.map((p) => `${p.name}: ${p.doseRef ? number(Number(p.stock || 0) / Number(p.doseRef)) : "não informado"} ha`).join("<br>") || "Sem dados"],
  ];
  document.getElementById("reportsGrid").innerHTML = cards.map(([title, body]) => `<article class="report-card"><h3>${title}</h3><p class="meta">${body}</p></article>`).join("");
}

function sumApps(predicate, field) {
  return state.applications.filter(predicate).reduce((sum, app) => sum + Number(app[field] || 0), 0);
}

function applicationCard(app) {
  const risks = riskFor(app);
  return `<article class="item-card"><h3>${app.date} • ${byId("products", app.productId)?.name || "Produto não informado"}</h3><div class="badge-row">${risks.map((r) => `<span class="badge ${r.type}">${r.text}</span>`).join("")}<span class="badge">${money(app.totalCost)}</span></div><p class="meta">Cultura: ${byId("cultures", app.cultureId)?.name || "não informado"}<br>Talhão: ${byId("fields", app.fieldId)?.name || "não informado"}<br>Área: ${number(app.hectares)} ha • Dose: ${number(app.dose, 3)} • Usado: ${number(app.usedQty, 3)}<br>Reaplicação: ${app.nextReapply || "não informado"} • Carência até: ${app.graceEnd || "não informado"}<br>Operador: ${app.operator || "não informado"}</p>${actions("application", app.id)}</article>`;
}

function actions(type, id) {
  return `<div class="card-actions"><button class="edit-btn" data-edit="${type}" data-id="${id}">Editar</button><button class="delete-btn" data-delete="${type}" data-id="${id}">Excluir</button></div>`;
}

function empty(message) {
  return `<article class="item-card"><p class="meta">${message}</p></article>`;
}

function refreshAll() {
  saveState();
  refreshSelects();
  renderDashboard();
  renderCultures();
  renderFields();
  renderProducts();
  renderAlerts();
  renderHistory();
  renderReports();
}

function bindForms() {
  cultureForm.addEventListener("submit", (event) => {
    event.preventDefault();
    upsert("cultures", { id: cultureId.value, name: cultureName.value, season: cultureSeason.value, area: Number(cultureArea.value), note: cultureNote.value });
    cultureForm.reset();
    refreshAll();
  });

  fieldForm.addEventListener("submit", (event) => {
    event.preventDefault();
    upsert("fields", { id: fieldId.value, name: fieldName.value, cultureId: fieldCulture.value, hectares: Number(fieldHectares.value), note: fieldNote.value });
    fieldForm.reset();
    refreshAll();
  });

  productForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const product = { id: productId.value, name: productName.value, type: productType.value, unit: productUnit.value, purchased: Number(productPurchased.value), price: Number(productPrice.value), unitCost: unitCost(), stock: Number(productStock.value), minStock: Number(productMinStock.value), doseRef: Number(productDoseRef.value), note: productNote.value };
    upsert("products", product);
    productForm.reset();
    productUnitCost.value = "";
    refreshAll();
  });

  applicationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const existing = applicationId.value ? byId("applications", applicationId.value) : null;
    if (existing) restoreStock(existing);
    const app = getApplicationFromForm();
    const product = byId("products", app.productId);
    if (product) product.stock = Math.max(0, Number(product.stock || 0) - Number(app.usedQty || 0));
    upsert("applications", app);
    applicationForm.reset();
    applicationDate.value = todayISO();
    applicationId.value = "";
    updateApplicationCalculations();
    refreshAll();
    setScreen("historico");
  });
}

function upsert(collection, item) {
  item.id = item.id || crypto.randomUUID();
  const index = state[collection].findIndex((stored) => stored.id === item.id);
  if (index >= 0) state[collection][index] = item;
  else state[collection].push(item);
}

function unitCost() {
  return Number(productPurchased.value) ? Number(productPrice.value || 0) / Number(productPurchased.value) : 0;
}

function restoreStock(app) {
  const product = byId("products", app.productId);
  if (product) product.stock = Number(product.stock || 0) + Number(app.usedQty || 0);
}

function getApplicationFromForm() {
  return {
    id: applicationId.value,
    date: applicationDate.value,
    cultureId: applicationCulture.value,
    fieldId: applicationField.value,
    hectares: Number(applicationHectares.value),
    productId: applicationProduct.value,
    productType: applicationProductType.value,
    dose: Number(applicationDose.value),
    calculatedQty: Number(applicationCalculatedQty.dataset.value || 0),
    usedQty: Number(applicationUsedQty.value),
    totalCost: Number(applicationTotalCost.dataset.value || 0),
    costHa: Number(applicationCostHa.dataset.value || 0),
    difference: Number(applicationDifference.dataset.value || 0),
    reason: applicationReason.value,
    problem: applicationProblem.value,
    level: applicationLevel.value,
    operator: applicationOperator.value,
    note: applicationNote.value,
    wind: weatherWind.value,
    fog: weatherFog.value,
    rain: weatherRain.value,
    wetSoil: weatherWetSoil.value,
    period: weatherPeriod.value,
    reapplyDays: applicationReapplyQuick.value,
    nextReapply: applicationNextReapply.value,
    graceDays: Number(applicationGraceDays.value),
    graceEnd: applicationGraceEnd.value,
  };
}

function updateApplicationCalculations() {
  const product = byId("products", applicationProduct.value);
  applicationProductType.value = product?.type || "não informado";
  const hectares = Number(applicationHectares.value || 0);
  const dose = Number(applicationDose.value || 0);
  const calculated = hectares * dose;
  const used = Number(applicationUsedQty.value || calculated || 0);
  const totalCost = used * Number(product?.unitCost || 0);
  const costHa = hectares ? totalCost / hectares : 0;
  const difference = calculated ? ((used - calculated) / calculated) * 100 : 0;
  applicationCalculatedQty.value = `${number(calculated, 3)} ${product?.unit || ""}`;
  applicationCalculatedQty.dataset.value = calculated;
  applicationTotalCost.value = money(totalCost);
  applicationTotalCost.dataset.value = totalCost;
  applicationCostHa.value = money(costHa);
  applicationCostHa.dataset.value = costHa;
  applicationDifference.value = `${number(difference)}%`;
  applicationDifference.dataset.value = difference;
  const customDate = applicationReapplyCustom.value;
  applicationNextReapply.value = customDate || (applicationReapplyQuick.value !== "não informado" ? addDays(applicationDate.value, applicationReapplyQuick.value) : "");
  applicationGraceEnd.value = applicationGraceDays.value ? addDays(applicationDate.value, applicationGraceDays.value) : "";
  const alerts = [];
  if (used > calculated && calculated > 0) alerts.push("Atenção: uso acima do previsto. Verifique dose, regulagem ou área informada.");
  riskFor({ rain: weatherRain.value, wind: weatherWind.value, fog: weatherFog.value }).forEach((risk) => alerts.push(risk.text));
  applicationAlerts.innerHTML = alerts.map((alert) => `<div class="inline-alert">${alert}</div>`).join("");
}

function bindCalculations() {
  [productPurchased, productPrice].forEach((input) => input.addEventListener("input", () => productUnitCost.value = money(unitCost())));
  [applicationProduct, applicationHectares, applicationDose, applicationUsedQty, applicationDate, applicationReapplyQuick, applicationReapplyCustom, applicationGraceDays, weatherRain, weatherWind, weatherFog].forEach((input) => input.addEventListener("input", updateApplicationCalculations));
  applicationProduct.addEventListener("change", () => {
    const product = byId("products", applicationProduct.value);
    if (product?.doseRef && !applicationDose.value) applicationDose.value = product.doseRef;
    updateApplicationCalculations();
  });
}

function bindDelegatedActions() {
  document.body.addEventListener("click", (event) => {
    const edit = event.target.closest("[data-edit]");
    const del = event.target.closest("[data-delete]");
    if (edit) editItem(edit.dataset.edit, edit.dataset.id);
    if (del) deleteItem(del.dataset.delete, del.dataset.id);
  });
  historyFilters.addEventListener("input", renderHistory);
}

function editItem(type, id) {
  const map = { culture: "cultures", field: "fields", product: "products", application: "applications" };
  const item = byId(map[type], id);
  if (!item) return;
  if (type === "culture") {
    setScreen("culturas"); cultureId.value = item.id; cultureName.value = item.name; cultureSeason.value = item.season; cultureArea.value = item.area; cultureNote.value = item.note;
  }
  if (type === "field") {
    setScreen("talhoes"); fieldId.value = item.id; fieldName.value = item.name; fieldCulture.value = item.cultureId; fieldHectares.value = item.hectares; fieldNote.value = item.note;
  }
  if (type === "product") {
    setScreen("produtos"); productId.value = item.id; productName.value = item.name; productType.value = item.type; productUnit.value = item.unit; productPurchased.value = item.purchased; productPrice.value = item.price; productUnitCost.value = money(item.unitCost); productStock.value = item.stock; productMinStock.value = item.minStock; productDoseRef.value = item.doseRef; productNote.value = item.note;
  }
  if (type === "application") {
    setScreen("nova-aplicacao"); fillApplicationForm(item);
  }
}

function deleteItem(type, id) {
  const map = { culture: "cultures", field: "fields", product: "products", application: "applications" };
  if (!confirm("Excluir este registro?")) return;
  const collection = map[type];
  const item = byId(collection, id);
  if (type === "application" && item) restoreStock(item);
  state[collection] = state[collection].filter((stored) => stored.id !== id);
  refreshAll();
}

function fillApplicationForm(app) {
  applicationId.value = app.id; applicationDate.value = app.date; applicationCulture.value = app.cultureId; applicationField.value = app.fieldId; applicationHectares.value = app.hectares; applicationProduct.value = app.productId; applicationProductType.value = app.productType; applicationDose.value = app.dose; applicationUsedQty.value = app.usedQty; applicationReason.value = app.reason; applicationProblem.value = app.problem; applicationLevel.value = app.level; applicationOperator.value = app.operator; applicationNote.value = app.note; weatherWind.value = app.wind; weatherFog.value = app.fog; weatherRain.value = app.rain; weatherWetSoil.value = app.wetSoil; weatherPeriod.value = app.period; applicationReapplyQuick.value = app.reapplyDays; applicationReapplyCustom.value = ""; applicationGraceDays.value = app.graceDays;
  updateApplicationCalculations();
}

function initVoiceText() {
  voiceMode.addEventListener("click", () => voicePanel.classList.toggle("hidden"));
  manualMode.addEventListener("click", () => voicePanel.classList.add("hidden"));
  interpretText.addEventListener("click", () => {
    const text = voiceText.value.toLowerCase();
    applicationDate.value = text.includes("ontem") ? addDays(todayISO(), -1) : todayISO();
    const area = text.match(/(\d+[,.]?\d*)\s*(ha|hectare|hectares)/);
    const dose = text.match(/dose\s*(de)?\s*(\d+[,.]?\d*)/);
    const used = text.match(/(usei|usado|usou|quantidade)\s*(\d+[,.]?\d*)/);
    if (area) applicationHectares.value = area[1].replace(",", ".");
    if (dose) applicationDose.value = dose[2].replace(",", ".");
    if (used) applicationUsedQty.value = used[2].replace(",", ".");
    state.cultures.forEach((culture) => { if (text.includes(culture.name.toLowerCase())) applicationCulture.value = culture.id; });
    state.fields.forEach((field) => { if (text.includes(field.name.toLowerCase())) applicationField.value = field.id; });
    state.products.forEach((product) => { if (text.includes(product.name.toLowerCase())) applicationProduct.value = product.id; });
    TYPES.forEach((type) => { if (text.includes(type)) applicationProductType.value = type; });
    REASONS.forEach((reason) => { if (text.includes(reason)) applicationReason.value = reason; });
    if (text.includes("vento forte")) weatherWind.value = "forte"; else if (text.includes("vento")) weatherWind.value = "pouco";
    if (text.includes("neblina")) weatherFog.value = "sim";
    if (text.includes("choveu até 1") || text.includes("chuva até 1")) weatherRain.value = "até 1h";
    else if (text.includes("choveu até 3") || text.includes("chuva até 3")) weatherRain.value = "até 3h";
    else if (text.includes("choveu")) weatherRain.value = "no mesmo dia";
    const reapply = text.match(/reaplica\w*\s*(em)?\s*(\d+)/);
    if (reapply && REAPPLY.includes(reapply[2])) applicationReapplyQuick.value = reapply[2];
    const grace = text.match(/car[eê]ncia\s*(de)?\s*(\d+)/);
    if (grace) applicationGraceDays.value = grace[2];
    updateApplicationCalculations();
    alert("Interpretação preenchida para revisão. Campos ausentes ficam como não informado e podem ser editados antes de confirmar.");
  });
}

function init() {
  fillStaticSelect("productType", TYPES);
  fillStaticSelect("productUnit", UNITS);
  fillStaticSelect("applicationReason", REASONS);
  fillStaticSelect("applicationLevel", LEVELS);
  fillStaticSelect("weatherWind", WIND);
  fillStaticSelect("weatherFog", YESNO);
  fillStaticSelect("weatherRain", RAIN);
  fillStaticSelect("weatherWetSoil", YESNO);
  fillStaticSelect("weatherPeriod", PERIOD);
  fillStaticSelect("applicationReapplyQuick", REAPPLY);
  applicationDate.value = todayISO();
  initNavigation();
  bindForms();
  bindCalculations();
  bindDelegatedActions();
  initVoiceText();
  refreshAll();
  updateApplicationCalculations();
}

init();
