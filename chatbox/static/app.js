const $ = s => document.querySelector(s);
const ICON = {Music:"🎵", Art:"🎨", AI:"🤖", Building:"🏛️"};
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const api = (p, o) => fetch(p, o).then(r => r.json());
let buildings = [], near = "duke-chapel", history = [];

const EXAMPLES = ["What music events are happening?", "Any AI talks for beginners?", "Any art exhibits this week?", "What's near the Chapel?"];

async function init() {
  buildings = await api("/api/buildings");
  drawMap(); setNear(near, false);
  const st = await api("/api/status");
  $("#mode").textContent = st.mode === "claude" ? `Claude (${st.model}) + local DB` : "Offline demo · local DB only";
  addBot(`<p>Hi, I'm Blue Devil. What would you like to explore?</p><div class="ex">${EXAMPLES.map(e => `<button>${esc(e)}</button>`).join("")}</div>`);
  $("#msgs").querySelectorAll(".ex button").forEach(b => b.onclick = () => send(b.textContent));
  showEvents("", "", "Events at " + bName(near), near);
}
const bName = slug => (buildings.find(b => b.slug === slug) || {}).name || slug;

/* ---- map ---- */
function drawMap() {
  const L = $("#mapLayer");
  L.innerHTML = `<div class="path" style="left:8%;top:48%;width:84%;height:22px"></div><div class="path" style="left:44%;top:6%;width:22px;height:88%"></div>` +
    buildings.map(b => `<div class="bld" data-s="${b.slug}" style="left:${b.x*100}%;top:${b.y*100}%;width:${b.w*100}%;height:${b.h*100}%"><span>${esc(b.name)}</span></div>`).join("") + `<div class="pin" id="pin"></div>`;
  L.querySelectorAll(".bld").forEach(el => el.onclick = () => setNear(el.dataset.s));
}
function setNear(slug, refresh = true) {
  const b = buildings.find(x => x.slug === slug); if (!b) return;
  near = slug; $("#nearName").textContent = b.name;
  document.querySelectorAll(".bld").forEach(e => e.classList.toggle("here", e.dataset.s === slug));
  const pin = $("#pin"); if (pin) { pin.style.left = (b.x + b.w/2)*100 + "%"; pin.style.top = (b.y + b.h/2)*100 + "%"; }
  if (refresh) showEvents("", "", "Events at " + b.name, slug);
}
window.CampusChat = { setNear };

/* ---- info card ---- */
async function showEvents(q, cat, title, bld) {
  let ev = await api(`/api/events?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}`);
  if (bld) ev = ev.filter(e => e.building === bld);
  $("#infoCard").innerHTML = `<h3>${esc(title)}</h3>` + (ev.length ? ev.map(e =>
    `<div class="ev">${ICON[e.category]||""} <b>${esc(e.title)}</b> <a href="${esc(e.url)}" target="_blank" rel="noopener">View demo ↗</a><small>${esc(e.building_name)} · ${esc(e.when)}</small></div>`).join("") : "<small>No matching events.</small>");
}
$("#findForm").onsubmit = e => { e.preventDefault(); const q = $("#findInput").value.trim(); showEvents(q, "", q ? `Results for “${q}”` : "All events"); };
document.querySelectorAll(".chip").forEach(c => c.onclick = () => {
  document.querySelectorAll(".chip").forEach(x => x.classList.toggle("on", x === c && !c.classList.contains("on")));
  const on = c.classList.contains("on");
  showEvents("", on ? c.dataset.q : "", on ? `${c.dataset.q} events` : "All events");
});

/* ---- chat ---- */
function addBot(html) {
  const d = document.createElement("div"); d.className = "row";
  d.innerHTML = `<div class="av"><b>D</b></div><div class="bub">${html}</div>`;
  $("#msgs").append(d); $("#msgs").scrollTop = 1e9; return d;
}
function addUser(t) {
  const d = document.createElement("div"); d.className = "row user";
  d.innerHTML = `<div class="bub">${esc(t)}</div>`; $("#msgs").append(d); $("#msgs").scrollTop = 1e9;
}
function render(res) {
  const num = {}; res.links.forEach((l, i) => num[l.key] = i + 1);
  const uid = "l" + Date.now();
  const text = esc(res.reply).replace(/\[([EB]:[\w-]+)\]/g, (m, k) => num[k] ? `<button class="cite" data-t="${uid}-${num[k]}">${num[k]}</button>` : "")
    .split(/\n\s*\n/).map(p => `<p>${p.trim()}</p>`).join("");
  let links = "";
  if (res.links.length) links = `<div class="links"><div class="lbl">LINKS · FROM THE LOCAL DATABASE</div>` + res.links.map((l, i) => `
    <div class="lrow" id="${uid}-${i+1}"><span class="ic">${ICON[l.category]||"📌"}</span>
    <div class="t">${l.url ? `<a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.title)} ↗</a>` : `<a>${esc(l.title)}</a>`}<em>${esc(l.building_name)} · ${esc(l.when)}</em></div>
    <div class="b"><button class="sm" data-guide="${esc(l.building)}">Guide</button><button class="sm" data-map="${esc(l.building)}">Map</button></div></div>`).join("") + `</div>`;
  const row = addBot(text + links);
  row.querySelectorAll(".cite").forEach(c => c.onclick = () => {
    row.querySelectorAll(".lrow").forEach(r => r.classList.remove("hl"));
    const t = document.getElementById(c.dataset.t); t.classList.add("hl"); t.scrollIntoView({block: "nearest"});
  });
  row.querySelectorAll("[data-guide]").forEach(b => b.onclick = () => openModal(b.dataset.guide));
  row.querySelectorAll("[data-map]").forEach(b => b.onclick = () => locate(b.dataset.map));
}
function locate(slug) {
  setNear(slug);
  document.dispatchEvent(new CustomEvent("campus:locate", {detail: {slug}}));
}
async function send(text) {
  text = text.trim(); if (!text) return;
  addUser(text); $("#chatInput").value = "";
  const wait = addBot('<span class="dots"><i></i><i></i><i></i></span>');
  try {
    const res = await api("/api/chat", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({message: text, history, near})});
    wait.remove(); render(res);
    history.push({role: "user", content: text}, {role: "assistant", content: res.reply.replace(/\[[EB]:[\w-]+\]/g, "")});
  } catch { wait.remove(); addBot("<p>Sorry, I couldn't reach the server.</p>"); }
}
$("#chatForm").onsubmit = e => { e.preventDefault(); send($("#chatInput").value); };

/* ---- modal ---- */
async function openModal(slug) {
  const b = await api("/api/buildings/" + slug);
  $("#mZone").textContent = `${b.zone.toUpperCase()} / BUILDING GUIDE`;
  $("#mTitle").textContent = b.name; $("#mTag").textContent = b.tagline; $("#mName").textContent = b.name;
  $("#mPic").textContent = b.image; $("#mAbout").textContent = b.about + " " + b.history; $("#mTips").textContent = b.tips;
  $("#mAddr").textContent = "📍 " + b.address;
  $("#mLocate").onclick = () => { closeModal(); locate(slug); };
  $("#mEvents").innerHTML = b.events.map(e => `<div class="evrow"><div class="cat">${ICON[e.category]||""} ${esc(e.category.toUpperCase())}</div><h4>${esc(e.title)}</h4><p>${esc(e.blurb)}</p>
    <div class="tags"><span>🕒 ${esc(e.when)}</span><span>📍 ${esc(e.place)}</span><span>⏱ ${esc(e.duration)}</span><span>👥 ${esc(e.audience)}</span></div>
    <a href="${esc(e.url)}" target="_blank" rel="noopener">Event website ↗</a></div>`).join("") || "<p>No events listed.</p>";
  $("#modal").hidden = false;
}
const closeModal = () => $("#modal").hidden = true;
$("#mClose").onclick = $("#mBack").onclick = closeModal;
$("#modal").onclick = e => { if (e.target.id === "modal") closeModal(); };
document.addEventListener("keydown", e => {
  if (e.key === "Escape") return closeModal();
  if (e.target.tagName === "INPUT") return;
  if (e.key.toLowerCase() === "e") openModal(near);
  if (e.key.toLowerCase() === "m") closeModal();
});
init();
