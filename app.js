
"use strict";

/* =========================================================
   CHANNEL LIST — app.js
   Reads channels.json and renders an expandable channel list.
   No search bar, no country sections, no forced video playback.
   ========================================================= */

const DATA_URL = "./channels.json";

const channelList = document.getElementById("channel-list");
const channelCount = document.getElementById("channel-count");
const statusMessage = document.getElementById("status-message");
const themeToggle = document.getElementById("theme-toggle");

let channels = [];

/* ---------- General helpers ---------- */

function makeElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) {
    element.className = className;
  }

  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  return element;
}

function getText(value, fallback = "") {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (Array.isArray(value)) {
    return value.map(String).join(", ");
  }

  return String(value);
}

function getArray(value) {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null || value === "") return [];
  return [value];
}

function safeURL(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim(), window.location.href);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
}

function makeLink(label, url, className = "detail-link", newTab = true) {
  const validURL = safeURL(url);

  if (!validURL) {
    return makeElement("span", "", label);
  }

  const link = makeElement("a", className, label);
  link.href = validURL;

  if (newTab) {
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  return link;
}

function addStatus(message, isError = false) {
  if (!statusMessage) return;

  statusMessage.textContent = message;
  statusMessage.classList.toggle("error", isError);
}

/* ---------- Channel metadata ---------- */

function makeBadge(text, modifier = "") {
  const badge = makeElement(
    "span",
    "small-badge" + (modifier ? " " + modifier : ""),
    text
  );

  return badge;
}

function addDetailRow(table, label, value, linkURL = null) {
  if (
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0)
  ) {
    return;
  }

  const row = makeElement("div", "details-table-row");
  const key = makeElement("div", "details-table-label", label);
  const val = makeElement("div", "details-table-value");

  if (linkURL && safeURL(linkURL)) {
    val.appendChild(makeLink(getText(value), linkURL));
  } else {
    val.textContent = getText(value);
  }

  row.append(key, val);
  table.appendChild(row);
}

function renderMetadata(channel, container) {
  const heading = makeElement("h3", "details-heading", "Channel information");
  const table = makeElement("div", "details-table");

  addDetailRow(table, "Channel number", channel.number);
  addDetailRow(table, "Channel ID", channel.id);
  addDetailRow(table, "Display name", channel.display_name);
  addDetailRow(table, "Network", channel.network);
  addDetailRow(table, "Owner", channel.owner);
  addDetailRow(table, "Country", channel.country);
  addDetailRow(table, "Broadcast area", channel.broadcast_area);
  addDetailRow(table, "Time zone", channel.timezones);
  addDetailRow(table, "Languages", channel.languages);
  addDetailRow(table, "Categories", channel.categories);
  addDetailRow(table, "Website", channel.website, channel.website);

  container.append(heading, table);
}

/* ---------- Streams ---------- */

function renderStreams(feed, feedContainer) {
  const streams = getArray(feed.streams);

  if (streams.length === 0) {
    feedContainer.appendChild(
      makeElement("p", "empty-section", "No streams listed for this feed.")
    );
    return;
  }

  const streamList = makeElement("div", "stream-list");

  streams.forEach((stream, index) => {
    if (!stream || typeof stream !== "object") return;

    const row = makeElement("div", "stream-row");
    const info = makeElement("div", "stream-info");

    const title = getText(
      stream.title,
      getText(stream.name, "Stream " + (index + 1))
    );

    info.appendChild(makeElement("div", "stream-name", title));

    if (stream.quality || stream.format || stream.url) {
      info.appendChild(
        makeElement(
          "div",
          "stream-url",
          [
            stream.quality || stream.format || "",
            stream.url || ""
          ].filter(Boolean).join(" · ")
        )
      );
    }

    const actions = makeElement("div", "stream-actions");
    const validURL = safeURL(stream.url);

    if (validURL) {
      const openButton = makeLink(
        "Open stream ↗",
        validURL,
        "action-button primary",
        true
      );

      openButton.setAttribute("aria-label", "Open " + title + " in a new tab");
      actions.appendChild(openButton);

      const copyButton = makeElement("button", "action-button", "Copy URL");
      copyButton.type = "button";

      copyButton.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(validURL);
          copyButton.textContent = "Copied!";
        } catch {
          // Fallback for browsers without clipboard permission.
          const textArea = makeElement("textarea");
          textArea.value = validURL;
          textArea.setAttribute("readonly", "");
          textArea.style.position = "fixed";
          textArea.style.opacity = "0";

          document.body.appendChild(textArea);
          textArea.select();

          let copied = false;

          try {
            copied = document.execCommand("copy");
          } catch {
            copied = false;
          }

          textArea.remove();
          copyButton.textContent = copied ? "Copied!" : "Copy unavailable";
        }

        window.setTimeout(() => {
          copyButton.textContent = "Copy URL";
        }, 1800);
      });

      actions.appendChild(copyButton);
    } else {
      actions.appendChild(
        makeElement("span", "empty-section", "No valid stream URL")
      );
    }

    row.append(info, actions);
    streamList.appendChild(row);
  });

  feedContainer.appendChild(streamList);
}

/* ---------- EPG / guide providers ---------- */

function renderGuides(feed, feedContainer) {
  const guides = getArray(feed.guides);

  if (guides.length === 0) {
    feedContainer.appendChild(
      makeElement("p", "empty-section", "No guide providers listed.")
    );
    return;
  }

  const guideList = makeElement("div", "guide-list");

  guides.forEach((guide) => {
    if (!guide || typeof guide !== "object") return;

    const card = makeElement("div", "guide-card");
    const row = makeElement("div", "guide-row");

    const language = makeElement(
      "div",
      "guide-language",
      getText(guide.language, "—").toUpperCase()
    );

    const info = makeElement("div", "guide-info");
    info.appendChild(
      makeElement(
        "div",
        "guide-provider",
        getText(guide.site_name, getText(guide.site, "Guide provider"))
      )
    );

    if (guide.site) {
      const domain = getText(guide.site).replace(/^https?:\/\//i, "");
      const siteURL = /^https?:\/\//i.test(guide.site)
        ? guide.site
        : "https://" + domain;

      info.appendChild(
        makeLink(domain, siteURL, "detail-link", true)
      );
    }

    if (guide.site_id) {
      info.appendChild(
        makeElement("div", "guide-id", "Site ID: " + guide.site_id)
      );
    }

    if (guide.id) {
      info.appendChild(
        makeElement("div", "guide-id", "Guide ID: " + guide.id)
      );
    }

    row.append(language, info);
    card.appendChild(row);
    guideList.appendChild(card);
  });

  feedContainer.appendChild(guideList);
}

/* ---------- Individual feeds ---------- */

function renderFeed(feed, index) {
  const card = makeElement("section", "feed-card");
  const top = makeElement("div", "feed-top");
  const titleArea = makeElement("div", "");

  const feedName = getText(
    feed.name,
    getText(feed.id, "Feed " + (index + 1))
  );

  titleArea.appendChild(makeElement("h3", "feed-title", feedName));

  if (feed.id) {
    titleArea.appendChild(
      makeElement("div", "feed-subtitle", "Feed ID: " + feed.id)
    );
  }

  top.appendChild(titleArea);

  if (feed.is_main) {
    top.appendChild(makeBadge("Main feed", "success"));
  }

  card.appendChild(top);

  if (feed.format) {
    card.appendChild(
      makeElement("p", "feed-subtitle", "Format: " + feed.format)
    );
  }

  const streamsHeading = makeElement("h4", "details-heading", "Streams");
  const streamsContainer = makeElement("div", "feed-content");

  streamsContainer.appendChild(streamsHeading);
  renderStreams(feed, streamsContainer);
  card.appendChild(streamsContainer);

  const guidesHeading = makeElement("h4", "details-heading", "TV guides");
  const guidesContainer = makeElement("div", "feed-content");

  guidesContainer.appendChild(guidesHeading);
  renderGuides(feed, guidesContainer);
  card.appendChild(guidesContainer);

  return card;
}

/* ---------- Expanded channel details ---------- */

function renderChannelDetails(channel) {
  const details = makeElement("div", "channel-details");

  renderMetadata(channel, details);

  const feedsHeading = makeElement("h3", "details-heading", "Feeds");
  details.appendChild(feedsHeading);

  const feeds = getArray(channel.feeds);

  if (feeds.length === 0) {
    details.appendChild(
      makeElement("p", "empty-section", "No feeds have been added yet.")
    );
  } else {
    const feedList = makeElement("div", "feed-list");

    feeds.forEach((feed, index) => {
      if (feed && typeof feed === "object") {
        feedList.appendChild(renderFeed(feed, index));
      }
    });

    details.appendChild(feedList);
  }

  return details;
}

/* ---------- Channel rows ---------- */

function renderChannel(channel, index) {
  const card = makeElement("article", "channel-card");
  const row = makeElement("button", "channel-row");

  row.type = "button";
  row.setAttribute("aria-expanded", "false");

  const number = makeElement(
    "span",
    "channel-number",
    getText(channel.number, String(index + 1))
  );

  const logoWrap = makeElement("span", "channel-logo-wrap");

  const logoURL = safeURL(channel.logo);

  if (logoURL) {
    const logo = makeElement("img", "channel-logo");
    logo.src = logoURL;
    logo.alt = getText(channel.name, "Channel") + " logo";
    logo.loading = "lazy";
    logo.decoding = "async";

    const fallback = makeElement(
      "span",
      "channel-logo-fallback",
      getText(channel.name, "TV").slice(0, 3).toUpperCase()
    );

    fallback.hidden = true;

    logo.addEventListener("error", () => {
      logo.hidden = true;
      fallback.hidden = false;
    });

    logo.addEventListener("load", () => {
      logo.hidden = false;
      fallback.hidden = true;
    });

    logoWrap.append(logo, fallback);
  } else {
    logoWrap.appendChild(
      makeElement(
        "span",
        "channel-logo-fallback",
        getText(channel.name, "TV").slice(0, 3).toUpperCase()
      )
    );
  }

  const main = makeElement("span", "channel-main");
  const name = makeElement(
    "span",
    "channel-name",
    getText(channel.display_name, getText(channel.name, "Unnamed channel"))
  );

  const meta = makeElement("span", "channel-meta");

  if (channel.id) {
    meta.appendChild(makeElement("span", "channel-id", channel.id));
  }

  if (channel.network) {
    if (meta.childNodes.length) {
      meta.appendChild(makeElement("span", "meta-separator", "·"));
    }

    meta.appendChild(makeElement("span", "", channel.network));
  }

  if (channel.country) {
    if (meta.childNodes.length) {
      meta.appendChild(makeElement("span", "meta-separator", "·"));
    }

    meta.appendChild(makeElement("span", "", channel.country));
  }

  main.append(name, meta);

  const badges = makeElement("span", "channel-badges");
  const feedCount = getArray(channel.feeds).length;
  const streamCount = getArray(channel.feeds).reduce((total, feed) => {
    return total + getArray(feed && feed.streams).length;
  }, 0);

  badges.appendChild(makeBadge(feedCount + " feeds"));
  badges.appendChild(makeBadge(streamCount + " streams", streamCount ? "accent" : ""));

  const chevron = makeElement("span", "channel-chevron", "⌄");
  chevron.setAttribute("aria-hidden", "true");

  row.append(number, logoWrap, main, badges, chevron);

  const details = renderChannelDetails(channel);
  details.hidden = true;

  row.addEventListener("click", () => {
    const isOpening = details.hidden;

    details.hidden = !isOpening;
    row.setAttribute("aria-expanded", String(isOpening));
    card.classList.toggle("is-expanded", isOpening);
    chevron.textContent = isOpening ? "⌃" : "⌄";
  });

  card.append(row, details);

  return card;
}

/* ---------- Load and display JSON ---------- */

function showEmpty(message) {
  if (!channelList) return;

  channelList.replaceChildren(
    makeElement("div", "empty-section", message)
  );
}

async function loadChannels() {
  if (!channelList) {
    console.error('Missing HTML element: "#channel-list".');
    return;
  }

  addStatus("Loading channels…");

  try {
    const response = await fetch(DATA_URL, {
      cache: "no-cache"
    });

    if (!response.ok) {
      throw new Error("Could not load channels.json (HTTP " + response.status + ").");
    }

    const data = await response.json();

    if (!data || !Array.isArray(data.channels)) {
      throw new Error('Invalid JSON format. Expected an object with a "channels" array.');
    }

    channels = data.channels.filter(
      (channel) => channel && typeof channel === "object"
    );

    // Keep the source order from channels.json.
    channelList.replaceChildren();

    if (channels.length === 0) {
      showEmpty("No channels yet. Add channels to channels.json.");
      if (channelCount) channelCount.textContent = "0";
      addStatus("No channels found.");
      return;
    }

    const fragment = document.createDocumentFragment();

    channels.forEach((channel, index) => {
      fragment.appendChild(renderChannel(channel, index));
    });

    channelList.appendChild(fragment);

    if (channelCount) {
      channelCount.textContent = String(channels.length);
    }

    addStatus(
      "Loaded " + channels.length + " channel" +
      (channels.length === 1 ? "" : "s") + "."
    );
  } catch (error) {
    console.error("Channel list error:", error);

    if (channelCount) channelCount.textContent = "0";

    showEmpty(
      "Couldn't load channels.json. Make sure the file exists, contains valid JSON, and is published with your website."
    );

    addStatus("Unable to load channels.", true);
  }
}

/* ---------- Light / dark theme ---------- */

function setTheme(isLight) {
  document.documentElement.classList.toggle("light-theme", isLight);

  if (themeToggle) {
    themeToggle.textContent = isLight ? "☾ Dark mode" : "☀ Light mode";
    themeToggle.setAttribute(
      "aria-label",
      isLight ? "Switch to dark mode" : "Switch to light mode"
    );
    themeToggle.setAttribute("aria-pressed", String(isLight));
  }

  try {
    localStorage.setItem("channel-list-theme", isLight ? "light" : "dark");
  } catch {
    // The theme still works if browser storage is unavailable.
  }
}

function initializeTheme() {
  let savedTheme = "dark";

  try {
    savedTheme = localStorage.getItem("channel-list-theme") || "dark";
  } catch {
    // Use dark mode by default.
  }

  setTheme(savedTheme === "light");

  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const isCurrentlyLight =
        document.documentElement.classList.contains("light-theme");

      setTheme(!isCurrentlyLight);
    });
  }
}

/* ---------- Start the app ---------- */

initializeTheme();
loadChannels();
