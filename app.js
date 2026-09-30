"use strict";

const works = window.portfolioWorks || [];
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
const safeURL = (value) => {
  if (!value) return "";
  try { const url = new URL(value, document.baseURI); return ["http:", "https:", "file:"].includes(url.protocol) ? escapeHTML(value.replace(/ /g, "%20")) : ""; } catch { return ""; }
};
const youtubeID = (value) => {
  let id = "";
  try {
    const url = new URL(value);
    if (url.hostname === "youtu.be") id = url.pathname.slice(1);
    else if (url.hostname.endsWith("youtube.com")) id = url.searchParams.get("v") || url.pathname.match(/^\/(?:embed|shorts|live)\/([^/]+)/)?.[1] || "";
  } catch { return ""; }
  return /^[\w-]{11}$/.test(id) ? id : "";
};

// 代表作は featured の番号順、その他の作品は学年の新しい順（同じ学年は配列の順番）。
const featuredWorks = works.filter((work) => work.featured).sort((a, b) => a.featured - b.featured);
const otherWorks = works.filter((work) => !work.featured).sort((a, b) => (b.year || 0) - (a.year || 0) || works.indexOf(a) - works.indexOf(b));
const orderedWorks = [...featuredWorks, ...otherWorks];

// 使用技術のタグを、作品数の多い順に並べる。
const tagsByCount = (list) => {
  const count = (tag) => list.filter((work) => work.tags?.includes(tag)).length;
  return [...new Set(list.flatMap((work) => work.tags || []))].sort((a, b) => count(b) - count(a)).map((tag) => [tag, count(tag)]);
};

const yearLabel = (year) => year ? `${year}年生` : "その他";
// 個人制作では「主な実装」、チーム制作では設計や調整も含む「担当内容」と表記する。
const implementationLabel = (work) => work.production === "個人制作" ? "主な実装" : "担当内容";
const workURL = (work) => `work.html?id=${encodeURIComponent(work.id)}`;
const factsMarkup = (facts, className) => {
  const entries = facts.filter(([, value]) => value);
  return entries.length ? `<dl class="${className}">${entries.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value)}</dd></div>`).join("")}</dl>` : "";
};
const tagsMarkup = (work, { year = true } = {}) => {
  const tags = [year ? yearLabel(work.year) : "", work.production, ...(work.tags || [])].filter(Boolean).map((tag) => `<span class="tag">${escapeHTML(tag)}</span>`);
  if (work.status) tags.push(`<span class="tag tag-status">${escapeHTML(work.status)}</span>`);
  if (work.award) tags.push(`<span class="tag tag-award">受賞：${escapeHTML(work.award)}</span>`);
  return `<div class="work-tags">${tags.join("")}</div>`;
};
const playLinkMarkup = (work) => safeURL(work.play?.url) ? `<a class="button secondary" href="${safeURL(work.play.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(work.play.platform || "公開ページ")}でプレイ <span aria-hidden="true">↗</span></a>` : "";
const videoLinkMarkup = (work) => safeURL(work.video) ? `<a class="button secondary" href="${safeURL(work.video)}" target="_blank" rel="noopener noreferrer">プレイ動画 <span aria-hidden="true">↗</span></a>` : "";
const introMarkup = (work) => [
  work.catch ? `<p class="work-catch">${escapeHTML(work.catch)}</p>` : "",
  work.summary ? `<p class="work-summary">${escapeHTML(work.summary)}</p>` : "",
  !work.catch && !work.summary ? '<p class="work-pending">作品紹介は準備中です。</p>' : ""
].join("");

// 縦長の画像（スマホ向け作品など）は、サムネイルで切り取らずに全体を表示する。
document.addEventListener("load", (event) => {
  const image = event.target;
  if (image.tagName === "IMG" && image.naturalHeight > image.naturalWidth) image.classList.add("is-portrait");
}, true);

function placeholder() {
  return '<div class="placeholder-art"><span class="placeholder-label">画像準備中</span></div>';
}

function galleryMarkup(work) {
  const shots = work.screenshots?.length ? work.screenshots : [{}];
  const pending = !shots.some((shot) => safeURL(shot.src));
  return `<div class="gallery theme-${escapeHTML(work.theme || "blue")}${pending ? " is-pending" : ""}" role="region" ${shots.length > 1 ? 'aria-roledescription="カルーセル"' : ""} aria-label="${escapeHTML(work.title)}の画像">
    <div class="gallery-track" ${shots.length > 1 ? 'tabindex="0" aria-label="画像一覧。左右の矢印キーでも切り替えられます"' : ""}>${shots.map((shot, i) => `<figure class="gallery-slide" role="group" aria-label="${i + 1} / ${shots.length}">${safeURL(shot.src) ? `<img src="${safeURL(shot.src)}" alt="${escapeHTML(shot.alt || shot.caption || work.title)}" loading="lazy" width="1280" height="720">` : placeholder()}${shot.caption ? `<figcaption>${escapeHTML(shot.caption)}</figcaption>` : ""}</figure>`).join("")}</div>
    <div class="gallery-controls" ${shots.length < 2 ? 'hidden' : ''}><button class="gallery-arrow previous" type="button" aria-label="前の画像">←</button><div class="gallery-dots">${shots.map((_, i) => `<button type="button" class="gallery-dot${i === 0 ? " active" : ""}" aria-label="${i + 1}枚目の画像を表示" aria-pressed="${i === 0}" data-slide="${i}"></button>`).join("")}</div><span class="gallery-counter" aria-live="polite" aria-atomic="true">1 / ${shots.length}</span><button class="gallery-arrow next" type="button" aria-label="次の画像">→</button></div>
  </div>`;
}

function initializeGalleries(root) {
  root.querySelectorAll(".gallery").forEach((gallery) => {
    const track = gallery.querySelector(".gallery-track");
    const slides = [...track.children];
    const dots = [...gallery.querySelectorAll(".gallery-dot")];
    let current = 0;
    const moveTo = (index) => {
      const next = Math.max(0, Math.min(slides.length - 1, index));
      track.scrollTo({ left: next * track.clientWidth, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    };
    const update = () => {
      current = Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / (track.clientWidth || 1))));
      dots.forEach((dot, i) => { dot.classList.toggle("active", i === current); dot.setAttribute("aria-pressed", String(i === current)); });
      gallery.querySelector(".gallery-counter").textContent = `${current + 1} / ${slides.length}`;
      gallery.querySelector(".previous").disabled = current === 0;
      gallery.querySelector(".next").disabled = current === slides.length - 1;
    };
    gallery.querySelector(".previous").addEventListener("click", () => moveTo(current - 1));
    gallery.querySelector(".next").addEventListener("click", () => moveTo(current + 1));
    dots.forEach((dot, i) => dot.addEventListener("click", () => moveTo(i)));
    track.addEventListener("scroll", update, { passive: true });
    track.addEventListener("keydown", (event) => {
      if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        event.preventDefault();
        moveTo(event.key === "Home" ? 0 : event.key === "End" ? slides.length - 1 : current + (event.key === "ArrowRight" ? 1 : -1));
      }
    });
    update();
  });
}

const firstShot = (work) => work.screenshots?.find((item) => safeURL(item.src));

function featuredCardMarkup(work, index) {
  const tasks = (work.implementations || []).slice(0, 4);
  return `<article class="featured-card" data-work-id="${escapeHTML(work.id)}">
    <div class="featured-media theme-${escapeHTML(work.theme || "blue")}">${galleryMarkup(work)}</div>
    <div class="featured-body">
      <p class="featured-index">FEATURED ${String(index + 1).padStart(2, "0")}</p>
      ${tagsMarkup(work)}
      <h3>${escapeHTML(work.title)}</h3>
      ${introMarkup(work)}
      ${factsMarkup([["制作期間", work.period], ["制作人数", work.team], ["担当", work.role], ["使用技術", work.tools]], "featured-facts")}
      ${tasks.length ? `<div class="featured-tasks"><h4>${implementationLabel(work)}</h4><ul>${tasks.map((task) => `<li>${escapeHTML(task.title)}</li>`).join("")}</ul></div>` : ""}
      <div class="work-actions"><a class="button primary" href="${workURL(work)}" aria-label="${escapeHTML(work.title)}の詳細を見る">詳細を見る <span aria-hidden="true">→</span></a>${videoLinkMarkup(work)}${playLinkMarkup(work)}</div>
    </div>
  </article>`;
}

function workCardMarkup(work) {
  const shot = firstShot(work);
  const actions = videoLinkMarkup(work) + playLinkMarkup(work);
  return `<article class="work-card theme-${escapeHTML(work.theme || "blue")}" data-work-id="${escapeHTML(work.id)}">
    <div class="work-thumb">${shot ? `<img src="${safeURL(shot.src)}" alt="" loading="lazy" width="1280" height="720">` : placeholder()}</div>
    <div class="work-card-body">
      <h3><a class="work-card-link" href="${workURL(work)}">${escapeHTML(work.title)}</a></h3>
      ${introMarkup(work)}
      ${tagsMarkup(work)}
    </div>
    ${actions ? `<div class="work-card-actions">${actions}</div>` : ""}
  </article>`;
}

function renderHeroVisual() {
  document.querySelector("#hero-visual").innerHTML = featuredWorks.filter(firstShot).map((work, index) =>
    `<a class="hero-shot" href="${workURL(work)}"><img src="${safeURL(firstShot(work).src)}" alt="" ${index ? 'loading="lazy"' : ""} width="1280" height="720"><span>${escapeHTML(work.title)}</span></a>`
  ).join("");
}

function renderStats() {
  const stats = document.querySelector("#work-stats");
  const count = (predicate) => works.filter(predicate).length;
  stats.innerHTML = factsMarkup([
    ["制作作品", `${works.length}本`],
    ["個人制作 / チーム制作", `${count((work) => work.production === "個人制作")}本 / ${count((work) => work.production === "チーム制作")}本`],
    ["使用技術", tagsByCount(works).map(([tag, total]) => `${tag} ${total}本`).join("・")]
  ], "hero-stats-list");
}

function renderWorks(filter = "all") {
  const selected = otherWorks.filter((work) => filter === "all" || (work.tags || []).includes(filter));
  document.querySelector("#works-grid").innerHTML = selected.map(workCardMarkup).join("") || '<p class="empty-state">該当する作品はまだありません。</p>';
  document.querySelector("#filter-status").textContent = `${selected.length}件の作品を表示しています`;
}

function renderFilters() {
  const container = document.querySelector("#work-filters");
  container.innerHTML = [["all", otherWorks.length], ...tagsByCount(otherWorks)].map(([tag, count]) => {
    return `<button type="button" class="filter${tag === "all" ? " active" : ""}" data-filter="${escapeHTML(tag)}" aria-pressed="${tag === "all"}">${tag === "all" ? "すべて" : escapeHTML(tag)} <span class="filter-count">${count}本</span></button>`;
  }).join("");
  container.addEventListener("click", (event) => {
    const button = event.target.closest(".filter");
    if (!button) return;
    container.querySelectorAll(".filter").forEach((item) => { item.classList.toggle("active", item === button); item.setAttribute("aria-pressed", String(item === button)); });
    renderWorks(button.dataset.filter);
  });
}

const featuredList = document.querySelector("#featured-list");
if (featuredList) {
  featuredList.innerHTML = featuredWorks.map(featuredCardMarkup).join("") || '<p class="empty-state">代表作は準備中です。</p>';
  initializeGalleries(featuredList);
  document.querySelector("#work-count").textContent = `${otherWorks.length}作品`;
  renderHeroVisual();
  renderStats();
  renderFilters();
  renderWorks();
}

function videoMarkup(work) {
  const id = youtubeID(work.video);
  if (id) return `<div class="video-frame"><iframe src="https://www.youtube-nocookie.com/embed/${id}" title="${escapeHTML(work.title)}のプレイ動画" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe></div>`;
  return videoLinkMarkup(work);
}

function pagerMarkup(work) {
  const index = orderedWorks.indexOf(work);
  const link = (item, label, className) => item ? `<a class="${className}" href="${workURL(item)}"><small>${label}</small>${escapeHTML(item.title)}</a>` : "<span></span>";
  return `<nav class="work-pager" aria-label="ほかの作品">${link(orderedWorks[index - 1], "← 前の作品", "pager-prev")}${link(orderedWorks[index + 1], "次の作品 →", "pager-next")}</nav>`;
}

function implementationImagesMarkup(item) {
  const images = (item.images || []).filter((image) => safeURL(image.src));
  if (!images.length) return "";
  return `<div class="implementation-images" aria-label="${escapeHTML(item.title)}の比較画像">${images.map((image) => `<figure><img src="${safeURL(image.src)}" alt="${escapeHTML(image.alt || image.caption || item.title)}" loading="lazy"><figcaption>${escapeHTML(image.caption || "")}</figcaption></figure>`).join("")}</div>`;
}

const detail = document.querySelector("#work-detail");
if (detail) {
  const work = works.find((item) => item.id === new URLSearchParams(location.search).get("id"));
  if (!work) {
    document.title = "作品が見つかりません | 松島 朋也 Portfolio";
    detail.innerHTML = '<div class="not-found"><p class="eyebrow">WORK NOT FOUND</p><h1>作品が見つかりませんでした。</h1><p>作品一覧から、見たい作品を選択してください。</p><a class="button primary" href="index.html#works">作品一覧へ戻る →</a></div>';
  } else {
    document.title = `${work.title} | 松島 朋也 Portfolio`;
    const back = work.featured ? { href: "index.html#featured", label: "← 代表作に戻る" } : { href: "index.html#works", label: "← 作品一覧に戻る" };
    const backLink = document.querySelector("#back-link");
    backLink.href = back.href;
    backLink.textContent = back.label;
    detail.innerHTML = `<header class="detail-heading"><p class="eyebrow">${work.featured ? "FEATURED WORK" : "WORK"}</p><h1>${escapeHTML(work.title)}</h1>${tagsMarkup(work)}${introMarkup(work)}</header>
      ${work.video ? `<section class="detail-video" aria-label="プレイ動画">${videoMarkup(work)}</section>` : ""}
      ${galleryMarkup(work)}
      ${factsMarkup([["制作学年", yearLabel(work.year)], ["制作区分", work.production], ["制作期間", work.period], ["制作人数", work.team], ["担当範囲", work.role], ["使用技術", work.tools || work.tags?.join(" / ")], ["受賞", work.award], ["公開先", work.play?.platform], ["制作状況", work.status]], "project-facts")}
      <div class="detail-body">
        <section><p class="eyebrow">OVERVIEW</p><h2>作品について</h2><p>${escapeHTML(work.overview || "作品の概要や担当した内容は、順次追加します。")}</p></section>
        ${work.implementations?.length ? `<section><p class="eyebrow">DEVELOPMENT</p><h2>${implementationLabel(work)}と工夫</h2>${work.implementations.map((item) => `<div class="implementation"><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.body)}</p>${implementationImagesMarkup(item)}</div>`).join("")}</section>` : ""}
        ${work.play?.platform ? `<section><p class="eyebrow">PLAY THE GAME</p><h2>公開ページ</h2>${safeURL(work.play.url) ? playLinkMarkup(work) : `<p>${escapeHTML(work.play.platform)}に掲載しています。作品ページへのリンクは準備中です。</p>`}</section>` : ""}
        ${safeURL(work.download?.url) ? `<section class="download-section"><p class="eyebrow">PLAY THE GAME</p><h2>ゲームをダウンロード</h2>${work.download.info ? `<p>${escapeHTML(work.download.info)}</p>` : ""}<a class="button primary" href="${safeURL(work.download.url)}" download>${escapeHTML(work.download.label || "実行ファイルをダウンロード")} ↓</a></section>` : ""}
      </div>
      ${pagerMarkup(work)}`;
    initializeGalleries(detail);
  }
}

// 配色の切り替え（既定は暗い系）。選んだ配色は保存し、ほかのページでも引き継ぐ。
const themeSwitch = document.querySelector("#theme-switch");
if (themeSwitch) {
  const applyTheme = (theme) => {
    document.documentElement.dataset.theme = theme;
    themeSwitch.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.theme === theme)));
  };
  themeSwitch.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-theme]");
    if (!button) return;
    applyTheme(button.dataset.theme);
    try { localStorage.setItem("portfolio-theme", button.dataset.theme); } catch {}
  });
  applyTheme(document.documentElement.dataset.theme === "light" ? "light" : "dark");
}
