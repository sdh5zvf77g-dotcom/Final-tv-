const $ = id => document.getElementById(id);
const v = $("v"), msg = $("msg"), list = $("list"), q = $("q"), cat = $("cat");
const now = $("now"), stats = $("stats"), clearSearch = $("clearSearch");
const overlay = $("overlay"), retryBtn = $("retryBtn");

const PAGE = 200;
const TIMEOUT = 18000;
const secure = location.protocol === "https:";

let chans = [];
let hls = null;
let cur = null;
let token = 0;
let timer = null;
let shown = PAGE;
let rows = [];
let favs = [];
let recent = [];
let activeTab = "all";
let lastFailed = null;

const store = {
  get(k, d) {
    try { return JSON.parse(localStorage.getItem(k)) ?? d; }
    catch { return d; }
  },
  set(k, x) {
    try { localStorage.setItem(k, JSON.stringify(x)); }
    catch {}
  }
};

favs = store.get("favs", []);
recent = store.get("recent", []);

/* ---------- Playlist parsing ---------- */
function parse(text) {
  const out = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i].startsWith("#EXTINF")) continue;
    let j = i + 1;
    while (j < lines.length && (!lines[j].trim() || lines[j].startsWith("#"))) j++;
    const url = (lines[j] || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    // On HTTPS pages browsers block mixed content – skip plain HTTP streams
    if (secure && /^http:/i.test(url)) continue;

    const m = k => (lines[i].match(new RegExp(k + '="([^"]*)"')) || [])[1] || "";
    const name = (lines[i].slice(lines[i].lastIndexOf(",") + 1) || m("tvg-name") || "Channel").trim();
    const group = (m("group-title") || "Other").split(";")[0].trim() || "Other";
    out.push({
      name,
      url,
      logo: m("tvg-logo"),
      group
    });
  }
  return out;
}

/* ---------- Fetch with cache + timeout ---------- */
async function getText(url) {
  const key = "pl:" + url;
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 25000);
    const r = await fetch(url, { signal: ctl.signal, cache: "no-cache" });
    clearTimeout(t);
    if (!r.ok) throw new Error("HTTP " + r.status);
    const txt = await r.text();
    try {
      const c = await caches.open("freetv-lists");
      await c.put(key, new Response(txt));
    } catch {}
    return txt;
  } catch (e) {
    try {
      const c = await caches.open("freetv-lists");
      const r = await c.match(key);
      if (r) return await r.text();
    } catch {}
    throw e;
  }
}

/* ---------- Load all sources ---------- */
async function load() {
  showMsg("Loading free channels from around the world…", true);
  let sources;
  try {
    sources = (await (await fetch("sources.json")).json()).sources;
  } catch {
    sources = [
      { url: "https://iptv-org.github.io/iptv/index.country.m3u" },
      { url: "https://iptv-org.github.io/iptv/index.category.m3u" }
    ];
  }

  const results = await Promise.allSettled(sources.map(s => getText(s.url)));
  const seen = new Set();
  chans = [];

  results.forEach(r => {
    if (r.status === "fulfilled") {
      parse(r.value).forEach(c => {
        if (!seen.has(c.url)) {
          seen.add(c.url);
          chans.push(c);
        }
      });
    }
  });

  if (!chans.length) {
    showMsg("Couldn't load any channel lists.\nCheck your connection and reload the page.", false);
    stats.textContent = "0 channels";
    return;
  }

  chans.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  // Build category / country dropdown
  const groups = [...new Set(chans.map(c => c.group))].sort((a, b) => a.localeCompare(b));
  cat.innerHTML = "";
  ["All countries & categories", ...groups].forEach(g => {
    const o = document.createElement("option");
    o.value = g === "All countries & categories" ? "All" : g;
    o.textContent = g;
    cat.appendChild(o);
  });

  const httpsCount = chans.length;
  stats.textContent = `${httpsCount.toLocaleString()} free channels (HTTPS only)`;
  showMsg("Pick a channel to start watching", false);
  filter();
}

/* ---------- Filtering & tabs ---------- */
function filter() {
  const term = q.value.trim().toLowerCase();
  const g = cat.value;
  const favSet = new Set(favs);

  let base;
  if (activeTab === "favs") {
    base = chans.filter(c => favSet.has(c.url));
  } else if (activeTab === "recent") {
    const recentMap = new Map(chans.map(c => [c.url, c]));
    base = recent.map(u => recentMap.get(u)).filter(Boolean);
  } else {
    base = chans;
  }

  rows = base.filter(c => {
    const matchGroup = g === "All" || c.group === g;
    const matchName = !term || c.name.toLowerCase().includes(term) || c.group.toLowerCase().includes(term);
    return matchGroup && matchName;
  });

  shown = PAGE;
  render();
  list.scrollTop = 0;
}

function render() {
  list.textContent = "";
  if (!rows.length) {
    const d = document.createElement("div");
    d.className = "empty";
    if (activeTab === "favs") {
      d.innerHTML = "<strong>No favorites yet</strong>Tap the ★ on any channel to save it here.";
    } else if (activeTab === "recent") {
      d.innerHTML = "<strong>Nothing watched yet</strong>Channels you play will appear here.";
    } else {
      d.innerHTML = "<strong>No channels match</strong>Try a different search or category.";
    }
    list.appendChild(d);
    return;
  }

  const frag = document.createDocumentFragment();
  const favSet = new Set(favs);

  rows.slice(0, shown).forEach(c => {
    const li = document.createElement("li");
    li.dataset.url = c.url;
    li.tabIndex = 0;
    li.setAttribute("role", "option");
    if (cur && cur.url === c.url) li.setAttribute("aria-current", "true");

    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    if (c.logo) {
      img.src = c.logo;
      img.onerror = () => { img.style.visibility = "hidden"; };
    } else {
      img.style.visibility = "hidden";
    }

    const info = document.createElement("div");
    info.className = "info";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = c.name;
    const group = document.createElement("div");
    group.className = "group";
    group.textContent = c.group;
    info.append(name, group);

    const f = document.createElement("button");
    const on = favSet.has(c.url);
    f.className = "fav" + (on ? " on" : "");
    f.textContent = on ? "★" : "☆";
    f.setAttribute("aria-label", on ? "Remove favorite" : "Add favorite");
    f.onclick = e => {
      e.stopPropagation();
      if (favs.includes(c.url)) {
        favs = favs.filter(x => x !== c.url);
      } else {
        favs = [...favs, c.url];
      }
      store.set("favs", favs);
      if (activeTab === "favs") {
        const y = list.scrollTop;
        filter();
        list.scrollTop = y;
      } else {
        f.classList.toggle("on");
        const nowOn = f.classList.contains("on");
        f.textContent = nowOn ? "★" : "☆";
        f.setAttribute("aria-label", nowOn ? "Remove favorite" : "Add favorite");
      }
    };

    li.append(img, info, f);
    li.onclick = () => play(c);
    li.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); play(c); } };
    frag.appendChild(li);
  });

  if (rows.length > shown) {
    const b = document.createElement("button");
    b.className = "more";
    b.textContent = `Show more (${(rows.length - shown).toLocaleString()} left)`;
    b.onclick = () => {
      shown += PAGE;
      const y = list.scrollTop;
      render();
      list.scrollTop = y;
    };
    frag.appendChild(b);
  }

  list.appendChild(frag);
}

/* ---------- Playback ---------- */
function showMsg(text, spinning) {
  msg.querySelector("p").textContent = text;
  msg.querySelector(".spinner").style.display = spinning ? "block" : "none";
  msg.classList.remove("hidden");
  overlay.classList.add("hidden");
}

function hideMsg() {
  msg.classList.add("hidden");
  overlay.classList.add("hidden");
}

function stop() {
  clearTimeout(timer);
  if (hls) {
    hls.destroy();
    hls = null;
  }
  v.removeAttribute("src");
  v.load();
}

function play(c) {
  const my = ++token;
  cur = c;
  lastFailed = null;

  // Recent list (max 30)
  recent = [c.url, ...recent.filter(u => u !== c.url)].slice(0, 30);
  store.set("recent", recent);
  store.set("last", { name: c.name, url: c.url });

  now.textContent = c.name;
  showMsg("Starting " + c.name + "…", true);
  mark();
  stop();

  const fail = (reason) => {
    if (my !== token) return;
    clearTimeout(timer);
    lastFailed = c;
    const tip = secure
      ? "Many free streams block browser playback (CORS) or are geo-restricted. Try another channel or open this page on Safari / iOS."
      : "Stream did not respond. Try another channel.";
    showMsg((c.name + " isn’t available right now.\n" + (reason || tip)), false);
    overlay.classList.remove("hidden");
  };

  timer = setTimeout(() => fail("Timed out."), TIMEOUT);
  v.onerror = () => fail();

  // Native HLS (Safari / iOS) – more permissive with CORS
  if (v.canPlayType("application/vnd.apple.mpegurl")) {
    v.src = c.url;
  } else if (window.Hls && Hls.isSupported()) {
    let recovered = false;
    hls = new Hls({
      maxBufferLength: 30,
      maxMaxBufferLength: 60,
      lowLatencyMode: false,
      enableWorker: true,
      cors: true
    });
    hls.on(Hls.Events.ERROR, (_, d) => {
      if (my !== token || !d.fatal) return;
      if (d.type === Hls.ErrorTypes.MEDIA_ERROR && !recovered) {
        recovered = true;
        hls.recoverMediaError();
        return;
      }
      if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
        fail("Network / CORS error – stream server blocked the browser.");
      } else {
        fail();
      }
    });
    hls.loadSource(c.url);
    hls.attachMedia(v);
  } else {
    return fail("This browser cannot play live streams.");
  }

  const p = v.play();
  if (p && p.catch) p.catch(() => {});

  if ("mediaSession" in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: c.name,
        artist: "Free TV",
        artwork: c.logo ? [{ src: c.logo, sizes: "96x96", type: "image/png" }] : []
      });
    } catch {}
  }
}

function mark() {
  list.querySelectorAll("li").forEach(li => {
    if (cur && li.dataset.url === cur.url) li.setAttribute("aria-current", "true");
    else li.removeAttribute("aria-current");
  });
}

/* ---------- Events ---------- */
v.addEventListener("playing", () => {
  clearTimeout(timer);
  hideMsg();
});

v.addEventListener("waiting", () => {
  if (cur) showMsg("Buffering…", true);
});

let deb;
q.oninput = () => {
  clearTimeout(deb);
  clearSearch.classList.toggle("hidden", !q.value);
  deb = setTimeout(filter, 180);
};

clearSearch.onclick = () => {
  q.value = "";
  clearSearch.classList.add("hidden");
  filter();
  q.focus();
};

cat.onchange = filter;

document.querySelectorAll(".tab").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    activeTab = btn.dataset.tab;
    // Reset category filter when switching tabs for clarity
    if (activeTab !== "all") cat.value = "All";
    filter();
  };
});

retryBtn.onclick = () => {
  if (lastFailed) play(lastFailed);
};

/* Start */
load();
