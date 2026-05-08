const DEFAULT_API_BASE = "https://api.testmail.app/api/json";

const ui = {
  form: document.getElementById("mailForm"),
  apiKey: document.getElementById("apiKey"),
  emailAddress: document.getElementById("emailAddress"),
  namespace: document.getElementById("namespace"),
  tag: document.getElementById("tag"),
  apiBase: document.getElementById("apiBase"),
  rememberKey: document.getElementById("rememberKey"),
  status: document.getElementById("status"),
  list: document.getElementById("list"),
  detail: document.getElementById("detail"),
  count: document.getElementById("count"),
  lastFetch: document.getElementById("lastFetch"),
  refreshBtn: document.getElementById("refreshBtn"),
  clearBtn: document.getElementById("clearBtn"),
  rawToggle: document.getElementById("rawToggle"),
  rawPanel: document.getElementById("rawPanel"),
  rawJson: document.getElementById("rawJson"),
  copyRaw: document.getElementById("copyRaw"),
  copyConfig: document.getElementById("copyConfig"),
  themeToggle: document.getElementById("themeToggle"),
  submitBtn: document.querySelector("button[type='submit']"),
};

const state = {
  messages: [],
  selectedId: null,
  raw: null,
  lastUrl: "",
};

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    return;
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    return;
  }
}

function setStatus(message, tone) {
  ui.status.textContent = message;
  ui.status.classList.remove("error", "ok");
  if (tone === "error") {
    ui.status.classList.add("error");
  }
  if (tone === "ok") {
    ui.status.classList.add("ok");
  }
}

function applyTheme(mode) {
  const resolved = mode === "mono" ? "mono" : "color";
  document.documentElement.dataset.theme = resolved;
  ui.themeToggle.setAttribute("aria-pressed", resolved === "mono" ? "true" : "false");
  ui.themeToggle.textContent = `Mono: ${resolved === "mono" ? "On" : "Off"}`;
  storageSet("testmail.theme", resolved);
}

function initTheme() {
  const saved = storageGet("testmail.theme");
  applyTheme(saved || "color");
}

function initRememberedKey() {
  if (!ui.apiBase.value.trim()) {
    ui.apiBase.value = DEFAULT_API_BASE;
  }

  const remember = storageGet("testmail.remember");
  if (remember === "true") {
    ui.rememberKey.checked = true;
    const savedKey = storageGet("testmail.key");
    if (savedKey) {
      ui.apiKey.value = savedKey;
    }
  }
}

function readConfig() {
  return {
    apiKey: ui.apiKey.value.trim(),
    emailAddress: ui.emailAddress.value.trim(),
    namespace: ui.namespace.value.trim(),
    tag: ui.tag.value.trim(),
    apiBase: ui.apiBase.value.trim() || DEFAULT_API_BASE,
  };
}

function parseAddress(address) {
  if (!address || !address.includes("@")) {
    return null;
  }
  const parts = address.split("@");
  if (parts.length !== 2) {
    return null;
  }
  const tag = parts[0];
  const domain = parts[1];
  if (!tag || !domain) {
    return null;
  }
  const namespace = domain.split(".")[0];
  if (!namespace) {
    return null;
  }
  return { namespace, tag };
}

function syncFromEmail() {
  const parsed = parseAddress(ui.emailAddress.value.trim());
  if (!parsed) {
    return;
  }
  if (!ui.namespace.value.trim()) {
    ui.namespace.value = parsed.namespace;
  }
  if (!ui.tag.value.trim()) {
    ui.tag.value = parsed.tag;
  }
}

function buildUrl(config) {
  let url;
  try {
    url = new URL(config.apiBase);
  } catch (error) {
    throw new Error("Invalid API base URL.");
  }

  url.searchParams.set("apikey", config.apiKey);

  let namespace = config.namespace;
  let tag = config.tag;

  if (config.emailAddress) {
    const parsed = parseAddress(config.emailAddress);
    if (parsed) {
      namespace = namespace || parsed.namespace;
      tag = tag || parsed.tag;
    }
  }

  if (!namespace) {
    throw new Error("Namespace is required.");
  }

  url.searchParams.set("namespace", namespace);
  if (tag) {
    url.searchParams.set("tag", tag);
  }

  return url;
}

function getPathValue(item, path) {
  const parts = path.split(".");
  let current = item;
  for (const part of parts) {
    if (!current || typeof current !== "object" || !(part in current)) {
      return null;
    }
    current = current[part];
  }
  return current;
}

function pickValue(item, paths) {
  for (const path of paths) {
    const value = getPathValue(item, path);
    if (value !== null && value !== undefined && value !== "") {
      return value;
    }
  }
  return "";
}

function safeText(value) {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return String(value);
  }
  return String(value);
}

function formatAddress(value) {
  if (!value) {
    return "-";
  }
  if (Array.isArray(value)) {
    const parts = value.map(formatAddress).filter((part) => part && part !== "-");
    return parts.length ? parts.join(", ") : "-";
  }
  if (typeof value === "object") {
    if (value.text) {
      return safeText(value.text);
    }
    if (value.name && value.address) {
      return `${safeText(value.name)} <${safeText(value.address)}>`;
    }
    if (value.address) {
      return safeText(value.address);
    }
    return "-";
  }
  return safeText(value);
}

function formatDate(value) {
  if (!value) {
    return "-";
  }
  const date = typeof value === "number" ? new Date(value) : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return safeText(value);
  }
  return date.toLocaleString();
}

function stripHtml(html) {
  if (!html) {
    return "";
  }
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || "";
}

function createSnippet(text) {
  const cleaned = safeText(text).replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return "No preview available.";
  }
  return cleaned.length > 120 ? `${cleaned.slice(0, 120)}...` : cleaned;
}

function normalizeMessages(data) {
  if (!data || typeof data !== "object") {
    return [];
  }

  const list = Array.isArray(data.emails)
    ? data.emails
    : Array.isArray(data.messages)
      ? data.messages
      : Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.mail)
          ? data.mail
          : [];

  return list.map((item, index) => {
    const subject = pickValue(item, ["subject", "mail_subject", "headers.subject", "headers.Subject"]);
    const from = pickValue(item, ["from", "sender", "headers.from", "headers.From"]);
    const to = pickValue(item, ["to", "recipient", "headers.to", "headers.To"]);
    const html = pickValue(item, ["html", "text_html", "body_html", "bodyHtml"]);
    const text = pickValue(item, ["text", "text_plain", "body_text", "bodyText", "plain", "body"]);
    const date = pickValue(item, ["date", "receivedAt", "timestamp", "received", "created_at", "createdAt"]);
    const id =
      pickValue(item, ["id", "messageId", "message_id", "mail_id", "uuid"]) ||
      `${index}-${Date.now()}`;

    const plainText = text || stripHtml(html);
    return {
      id,
      subject: subject || "(No subject)",
      from: formatAddress(from),
      to: formatAddress(to),
      date: formatDate(date),
      text: safeText(text),
      html: safeText(html),
      snippet: createSnippet(plainText),
      raw: item,
    };
  });
}

function updateMetrics(count) {
  ui.count.textContent = String(count);
  ui.lastFetch.textContent = new Date().toLocaleTimeString();
}

function renderList(messages) {
  ui.list.innerHTML = "";

  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No emails yet. Fetch your inbox.";
    ui.list.appendChild(empty);
    return;
  }

  messages.forEach((message, index) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "list-item";
    item.style.setProperty("--i", index);

    if (message.id === state.selectedId) {
      item.classList.add("active");
    }

    const subject = document.createElement("div");
    subject.className = "list-subject";
    subject.textContent = message.subject;

    const meta = document.createElement("div");
    meta.className = "list-meta";
    meta.textContent = `${message.from} | ${message.date}`;

    const snippet = document.createElement("div");
    snippet.className = "list-snippet";
    snippet.textContent = message.snippet;

    item.append(subject, meta, snippet);
    item.addEventListener("click", () => selectMessage(message.id));
    ui.list.appendChild(item);
  });
}

function makeMetaRow(label, value) {
  const row = document.createElement("div");
  row.className = "meta-row";

  const labelEl = document.createElement("span");
  labelEl.className = "meta-label";
  labelEl.textContent = label;

  const valueEl = document.createElement("span");
  valueEl.className = "meta-value";
  valueEl.textContent = value || "-";

  row.append(labelEl, valueEl);
  return row;
}

function buildSafeHtml(html) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';"><style>body{font-family:Space Grotesk, sans-serif;padding:16px;color:#111;background:#fff;}img{max-width:100%;height:auto;}</style></head><body>${html}</body></html>`;
}

function renderDetail(message) {
  ui.detail.innerHTML = "";

  if (!message) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "Select an email to preview.";
    ui.detail.appendChild(empty);
    return;
  }

  const title = document.createElement("h3");
  title.textContent = message.subject;

  const meta = document.createElement("div");
  meta.className = "detail-meta";
  meta.append(
    makeMetaRow("From", message.from),
    makeMetaRow("To", message.to),
    makeMetaRow("Date", message.date)
  );

  const textBlock = document.createElement("pre");
  textBlock.className = "detail-text";
  const plainText = message.text || stripHtml(message.html);
  textBlock.textContent = plainText || "No plain text content available.";

  ui.detail.append(title, meta, textBlock);

  if (message.html) {
    const htmlDetails = document.createElement("details");
    htmlDetails.className = "html-details";

    const summary = document.createElement("summary");
    summary.textContent = "HTML preview (sandboxed)";

    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.setAttribute("title", "Email HTML preview");
    frame.srcdoc = buildSafeHtml(message.html);

    htmlDetails.append(summary, frame);
    ui.detail.appendChild(htmlDetails);
  }
}

function selectMessage(id) {
  state.selectedId = id;
  renderList(state.messages);
  const message = state.messages.find((item) => item.id === id);
  renderDetail(message || null);
}

function updateRawPanel(data) {
  if (!data) {
    ui.rawJson.textContent = "";
    return;
  }
  ui.rawJson.textContent = JSON.stringify(data, null, 2);
}

async function copyText(text, successMessage) {
  if (!text) {
    setStatus("Nothing to copy.", "error");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    setStatus(successMessage, "ok");
  } catch (error) {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "absolute";
    area.style.left = "-9999px";
    document.body.appendChild(area);
    area.select();
    document.execCommand("copy");
    document.body.removeChild(area);
    setStatus(successMessage, "ok");
  }
}

async function fetchInbox(event) {
  if (event) {
    event.preventDefault();
  }

  const config = readConfig();
  if (!config.apiKey) {
    setStatus("Enter your TestMail API key.", "error");
    return;
  }

  let url;
  try {
    url = buildUrl(config);
  } catch (error) {
    setStatus(error.message, "error");
    return;
  }

  ui.refreshBtn.disabled = true;
  ui.submitBtn.disabled = true;
  setStatus("Fetching inbox...", "ok");

  try {
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    const data = await response.json();
    state.raw = data;
    state.lastUrl = url.toString();

    updateRawPanel(data);
    const messages = normalizeMessages(data);
    state.messages = messages;
    state.selectedId = messages.length ? messages[0].id : null;

    renderList(messages);
    renderDetail(messages.length ? messages[0] : null);
    updateMetrics(messages.length);

    if (data.result && data.result !== "ok") {
      setStatus(`API responded: ${data.message || data.result}`, "error");
    } else {
      setStatus(`Loaded ${messages.length} messages.`, "ok");
    }
  } catch (error) {
    setStatus(`Fetch failed: ${error.message}`, "error");
  } finally {
    ui.refreshBtn.disabled = false;
    ui.submitBtn.disabled = false;
  }
}

function clearAll() {
  ui.apiKey.value = "";
  ui.emailAddress.value = "";
  ui.namespace.value = "";
  ui.tag.value = "";
  state.messages = [];
  state.selectedId = null;
  state.raw = null;
  state.lastUrl = "";
  ui.rawPanel.hidden = true;
  updateRawPanel(null);
  renderList([]);
  renderDetail(null);
  updateMetrics(0);
  setStatus("Cleared.", "ok");

  if (ui.rememberKey.checked) {
    storageSet("testmail.key", "");
  }
}

function initHandlers() {
  ui.form.addEventListener("submit", fetchInbox);
  ui.refreshBtn.addEventListener("click", fetchInbox);
  ui.clearBtn.addEventListener("click", clearAll);

  ui.rawToggle.addEventListener("click", () => {
    ui.rawPanel.hidden = !ui.rawPanel.hidden;
  });

  ui.copyRaw.addEventListener("click", () => {
    copyText(ui.rawJson.textContent, "Raw JSON copied.");
  });

  ui.copyConfig.addEventListener("click", () => {
    const config = readConfig();
    if (!config.apiKey) {
      setStatus("Enter your TestMail API key first.", "error");
      return;
    }
    try {
      const url = buildUrl(config);
      copyText(url.toString(), "Request URL copied.");
    } catch (error) {
      setStatus(error.message, "error");
    }
  });

  ui.themeToggle.addEventListener("click", () => {
    const current = document.documentElement.dataset.theme === "mono" ? "mono" : "color";
    applyTheme(current === "mono" ? "color" : "mono");
  });

  ui.rememberKey.addEventListener("change", () => {
    storageSet("testmail.remember", ui.rememberKey.checked ? "true" : "false");
    if (!ui.rememberKey.checked) {
      storageRemove("testmail.key");
    } else if (ui.apiKey.value.trim()) {
      storageSet("testmail.key", ui.apiKey.value.trim());
    }
  });

  ui.apiKey.addEventListener("input", () => {
    if (ui.rememberKey.checked) {
      storageSet("testmail.key", ui.apiKey.value.trim());
    }
  });

  ui.emailAddress.addEventListener("input", syncFromEmail);
}

initTheme();
initRememberedKey();
initHandlers();
setStatus("Ready.", "ok");
