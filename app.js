
"use strict";

/* =========================================================
   IPTV CHANNEL CATALOG
   Data source: ./channels.json
   ========================================================= */

const $ = (selector, parent = document) => parent.querySelector(selector);

const channelList = $("#channel-list");
const channelCount = $("#channel-count");
const statusMessage = $("#status-message");

const detailsOverlay = $("#channel-details");
const detailsBackdrop = $("#details-backdrop");
const closeDetailsButton = $("#close-details");
const detailsTitle = $("#details-title");
const detailsLogo = $("#details-logo");
const logoMetadata = $("#logo-metadata");
const feedList = $("#feed-list");

const themeToggle = $("#theme-toggle");
const addLogoButton = $("#add-logo-button");
const logoMenuButton = $("#logo-menu-button");
const addFeedButton = $("#add-feed-button");

let channels = [];
let activeChannel = null;
let activeChannelIndex = -1;

/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function safeURL(value) {
  if (!value) return "";

  try {
    const url = new URL(String(value), window.location.href);

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }
  } catch (_) {}

  return "";
}

function makeIcon(name) {
  const icons = {
    tv: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m7 2 5 3 5-3"/>',
    guide: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M12 8h5M12 12h5M12 16h3"/>',
    stream: '<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
    external: '<path d="M14 3h7v7M21 3 10 14"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    plus: '<path d="M12 5v14M5 12h14"/>'
  };

  return `
    <svg aria-hidden="true" viewBox="0 0 24 24"
      width="16" height="16" fill="none"
      stroke="currentColor" stroke-width="1.8"
      stroke-linecap="round" stroke-linejoin="round">
      ${icons[name] || icons.tv}
    </svg>`;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function getChannelNumber(channel) {
  return channel.number ?? channel.channel_number ?? "";
}

function getChannelId(channel) {
  return channel.id ?? channel.tvg_id ?? channel.tvgId ?? "";
}

function getChannelName(channel) {
  return channel.display_name ??
    channel.displayName ??
    channel.name ??
    getChannelId(channel) ??
    "Unnamed channel";
}

function getChannelLogo(channel) {
  return channel.logo ?? channel.logo_url ?? channel.logoUrl ?? "";
}

function getFeeds(channel) {
  return Array.isArray(channel.feeds) ? channel.feeds : [];
}

function getStreams(feed) {
  return Array.isArray(feed.streams) ? feed.streams : [];
}

function getGuides(feed) {
  return Array.isArray(feed.guides) ? feed.guides : [];
}

function getStreamURL(stream) {
  if (typeof stream === "string") return stream;

  return stream?.url ??
    stream?.src ??
    stream?.stream_url ??
    stream?.streamUrl ??
    "";
}

function getFeedName(feed, index) {
  return feed.name ??
    feed.display_name ??
    feed.displayName ??
    feed.id ??
    `Feed ${index + 1}`;
}

function getStreamName(stream, index) {
  if (typeof stream === "string") return `Stream ${index + 1}`;

  return stream?.name ??
    stream?.title ??
    stream?.quality ??
    `Stream ${index + 1}`;
}

function setStatus(message, isError = false) {
  if (!statusMessage) return;

  statusMessage.textContent = message;
  statusMessage.hidden = !message;
  statusMessage.classList.toggle("error", isError);
}

function createButton(label, className = "") {
  const button = createElement("button", className, label);
  button.type = "button";
  button.setAttribute("aria-label", label);
  return button;
}

function stopClick(event) {
  event.stopPropagation();
}

/* =========================================================
   CHANNEL LIST
   The row itself is NOT a giant click target.
   The name opens details; logo and feed count have
   their own independent click actions.
   ========================================================= */

function renderChannels() {
  if (!channelList) {
    console.error("Missing #channel-list in index.html");
    return;
  }

  channelList.replaceChildren();

  channels.forEach((channel, index) => {
    const row = createElement("div", "channel-row");
    row.dataset.channelIndex = String(index);

    const number = createElement(
      "div",
      "channel-number",
      getChannelNumber(channel) || "—"
    );

    const logoButton = createButton(
      `View logo for ${getChannelName(channel)}`,
      "channel-logo-button"
    );

    const logo = document.createElement("img");
    logo.className = "channel-logo";
    logo.alt = `${getChannelName(channel)} logo`;
    logo.loading = "lazy";

    const logoURL = safeURL(getChannelLogo(channel));

    if (logoURL) {
      logo.src = logoURL;
    } else {
      logo.hidden = true;
      logoButton.appendChild(
        createElement("span", "logo-placeholder", "TV")
      );
    }

    logo.addEventListener("error", () => {
      logo.hidden = true;

      if (!logoButton.querySelector(".logo-placeholder")) {
        logoButton.appendChild(
          createElement("span", "logo-placeholder", "TV")
        );
      }
    });

    logoButton.appendChild(logo);

    logoButton.addEventListener("click", event => {
      stopClick(event);
      openDetails(index, "logo");
    });

    const info = createElement("div", "channel-info");

    const nameButton = createButton(
      getChannelName(channel),
      "channel-name-button"
    );

    nameButton.removeAttribute("aria-label");
    nameButton.addEventListener("click", event => {
      stopClick(event);
      openDetails(index, "info");
    });

    const id = createElement(
      "code",
      "channel-id",
      getChannelId(channel) || "No channel ID"
    );

    info.append(nameButton, id);

    const feedCountButton = createButton(
      `${getFeeds(channel).length} feeds`,
      "channel-feed-count"
    );

    feedCountButton.addEventListener("click", event => {
      stopClick(event);
      openDetails(index, "feeds");
    });

    row.append(number, logoButton, info, feedCountButton);

    // Clicking empty row space does nothing.
    // Only the individual controls above respond to clicks.
    channelList.appendChild(row);
  });

  if (channelCount) {
    channelCount.textContent =
      `${channels.length} channel${channels.length === 1 ? "" : "s"}`;
  }
}

/* =========================================================
   CHANNEL DETAILS PANEL
   ========================================================= */

function openDetails(index, focusSection = "info") {
  const channel = channels[index];

  if (!channel || !detailsOverlay) return;

  activeChannel = channel;
  activeChannelIndex = index;

  if (detailsTitle) {
    detailsTitle.textContent = getChannelName(channel);
  }

  if (detailsLogo) {
    const logoURL = safeURL(getChannelLogo(channel));

    detailsLogo.hidden = !logoURL;

    if (logoURL) {
      detailsLogo.src = logoURL;
      detailsLogo.alt = `${getChannelName(channel)} logo`;
    } else {
      detailsLogo.removeAttribute("src");
      detailsLogo.alt = "No logo available";
    }
  }

  renderLogoMetadata(channel);
  renderFeeds(channel);

  detailsOverlay.hidden = false;
  document.body.classList.add("details-open");

  if (focusSection === "feeds") {
    requestAnimationFrame(() => {
      const heading = detailsOverlay.querySelector(".feed-section");
      if (heading) heading.scrollIntoView({ block: "start" });
    });
  } else if (focusSection === "logo") {
    requestAnimationFrame(() => {
      if (detailsLogo) detailsLogo.scrollIntoView({ block: "nearest" });
    });
  }

  if (closeDetailsButton) {
    closeDetailsButton.focus({ preventScroll: true });
  }
}

function closeDetails() {
  if (!detailsOverlay) return;

  detailsOverlay.hidden = true;
  document.body.classList.remove("details-open");

  activeChannel = null;
  activeChannelIndex = -1;
}

if (closeDetailsButton) {
  closeDetailsButton.addEventListener("click", event => {
    stopClick(event);
    closeDetails();
  });
}

if (detailsBackdrop) {
  detailsBackdrop.addEventListener("click", event => {
    stopClick(event);
    closeDetails();
  });
}

// Clicks inside the details panel must never act like backdrop clicks.
if (detailsOverlay) {
  const dialog = detailsOverlay.querySelector(
    ".details-dialog, .details-content, [role='dialog']"
  );

  if (dialog) {
    dialog.addEventListener("click", stopClick);
  }

  detailsOverlay.addEventListener("click", event => {
    if (event.target === detailsOverlay) {
      closeDetails();
    }
  });
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && detailsOverlay && !detailsOverlay.hidden) {
    closeDetails();
  }
});

/* =========================================================
   LOGO METADATA
   ========================================================= */

function renderLogoMetadata(channel) {
  if (!logoMetadata) return;

  const metadata = [
    ["Channel", getChannelName(channel)],
    ["Channel ID", getChannelId(channel)],
    ["Logo URL", getChannelLogo(channel)],
    ["Network", channel.network],
    ["Owners", Array.isArray(channel.owners)
      ? channel.owners.join(", ")
      : channel.owners],
    ["Country", channel.country],
    ["Subdivision", channel.subdivision],
    ["City", channel.city],
    ["Website", channel.website],
    ["Launched", channel.launched],
    ["Closed", channel.closed],
    ["Timezone", channel.timezone],
    ["Languages", Array.isArray(channel.languages)
      ? channel.languages.join(", ")
      : channel.languages],
    ["Categories", Array.isArray(channel.categories)
      ? channel.categories.join(", ")
      : channel.categories],
    ["Alt names", Array.isArray(channel.alt_names)
      ? channel.alt_names.join(", ")
      : channel.alt_names]
  ].filter(([, value]) => value !== undefined &&
    value !== null &&
    String(value).trim() !== "");

  logoMetadata.replaceChildren(createMetadataTable(metadata));
}

/* =========================================================
   FEEDS
   ========================================================= */

function renderFeeds(channel) {
  if (!feedList) return;

  feedList.replaceChildren();

  const feeds = getFeeds(channel);

  const section = createElement("div", "feed-section");
  const heading = createElement("div", "section-heading");
  heading.innerHTML =
    `<span class="section-symbol">${makeIcon("stream")}</span><span>Feeds</span>`;

  section.appendChild(heading);

  if (!feeds.length) {
    section.appendChild(
      createElement("p", "inline-note", "No feeds listed for this channel.")
    );
  } else {
    feeds.forEach((feed, index) => {
      section.appendChild(renderFeed(feed, index, channel));
    });
  }

  feedList.appendChild(section);
}

function renderFeed(feed, feedIndex, channel) {
  const card = createElement("section", "feed-card");
  const header = createElement("div", "feed-header");
  const title = createElement("h3", "feed-title", getFeedName(feed, feedIndex));

  header.appendChild(title);

  const body = createElement("div", "feed-body");

  const feedMetadata = [
    ["Feed ID", feed.id],
    ["Name", feed.name],
    ["Display name", feed.display_name ?? feed.displayName],
    ["Country", feed.country],
    ["Language", feed.language],
    ["Quality", feed.quality],
    ["Resolution", feed.resolution],
    ["Format", feed.format],
    ["Notes", feed.notes]
  ].filter(([, value]) => value !== undefined &&
    value !== null &&
    String(value).trim() !== "");

  if (feedMetadata.length) {
    body.appendChild(createMetadataTable(feedMetadata));
  }

  const streamsHeading = createElement("div", "section-heading");
  streamsHeading.innerHTML =
    `<span class="section-symbol">${makeIcon("stream")}</span><span>Streams</span>`;
  body.appendChild(streamsHeading);

  const streams = createElement("div", "stream-list");
  const streamItems = getStreams(feed);

  if (streamItems.length) {
    streamItems.forEach((stream, streamIndex) => {
      streams.appendChild(renderStream(stream, streamIndex, channel, feed));
    });
  } else {
    streams.appendChild(
      createElement("p", "inline-note", "No streams listed for this feed.")
    );
  }

  body.appendChild(streams);

  const guidesHeading = createElement("div", "section-heading");
  guidesHeading.style.paddingLeft = "0";
  guidesHeading.innerHTML =
    `<span class="section-symbol">${makeIcon("guide")}</span><span>Guides</span>`;
  body.appendChild(guidesHeading);

  const guides = getGuides(feed);

  if (guides.length) {
    const guideRows = guides.map((guide, guideIndex) => [
      `Guide ${guideIndex + 1}`,
      [
        guide.language ? `Language: ${guide.language}` : "",
        guide.site ? `Site: ${guide.site}` : "",
        guide.site_id ? `Site ID: ${guide.site_id}` : "",
        guide.site_name ? `Name: ${guide.site_name}` : "",
        guide.url ? `URL: ${guide.url}` : ""
      ].filter(Boolean).join(" · ")
    ]);

    body.appendChild(createMetadataTable(guideRows));
  } else {
    body.appendChild(
      createElement("p", "inline-note", "No guides listed for this feed.")
    );
  }

  card.append(header, body);

  // Defensive: clicks within a feed card must not bubble into
  // any parent element that might open or close the panel.
  card.addEventListener("click", stopClick);

  return card;
}

/* =========================================================
   STREAM LINKS
   ========================================================= */

function renderStream(stream, streamIndex, channel, feed) {
  const item = createElement("div", "stream-item");
  const url = getStreamURL(stream);
  const streamName = getStreamName(stream, streamIndex);

  const name = createElement("div", "stream-name", streamName);
  item.appendChild(name);

  if (stream && typeof stream === "object") {
    const details = [
      stream.quality,
      stream.resolution,
      stream.format,
      stream.user_agent ? `User-Agent: ${stream.user_agent}` : ""
    ].filter(Boolean).join(" · ");

    if (details) {
      item.appendChild(createElement("div", "stream-meta", details));
    }
  }

  const validURL = safeURL(url);

  if (validURL) {
    const actions = createElement("div", "stream-actions");

    const link = document.createElement("a");
    link.className = "stream-url";
    link.href = validURL;
    link.textContent = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "Open this stream URL in a new tab";

    // Keep the stream link independent of all parent click handlers.
    link.addEventListener("click", event => {
      event.stopPropagation();
    });

    const openButton = createButton("Open stream", "stream-open-button");
    openButton.innerHTML = `${makeIcon("external")}<span>Open</span>`;

    openButton.addEventListener("click", event => {
      stopClick(event);
      window.open(validURL, "_blank", "noopener,noreferrer");
    });

    const copyButton = createButton("Copy stream URL", "stream-copy-button");
    copyButton.innerHTML = `${makeIcon("copy")}<span>Copy</span>`;

    copyButton.addEventListener("click", async event => {
      stopClick(event);

      try {
        await navigator.clipboard.writeText(validURL);
        copyButton.querySelector("span").textContent = "Copied!";
        setTimeout(() => {
          const label = copyButton.querySelector("span");
          if (label) label.textContent = "Copy";
        }, 1500);
      } catch (_) {
        // Fallback for browsers that don't allow clipboard access.
        const input = document.createElement("textarea");
        input.value = validURL;
        input.readOnly = true;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();

        let copied = false;
        try {
          copied = document.execCommand("copy");
        } catch (_) {}

        input.remove();

        copyButton.querySelector("span").textContent =
          copied ? "Copied!" : "Select URL";

        if (!copied) {
          window.prompt("Copy this stream URL:", validURL);
        }
      }
    });

    actions.append(link, openButton, copyButton);
    item.appendChild(actions);
  } else if (url) {
    item.appendChild(
      createElement("p", "inline-note", "This stream URL is not a valid HTTP or HTTPS link.")
    );
    item.appendChild(createElement("code", "stream-url-invalid", url));
  } else {
    item.appendChild(
      createElement("p", "inline-note", "No URL provided for this stream.")
    );
  }

  item.addEventListener("click", stopClick);

  return item;
}

/* =========================================================
   METADATA TABLE
   ========================================================= */

function createMetadataTable(rows) {
  const table = document.createElement("table");
  table.className = "metadata-table";

  const tbody = document.createElement("tbody");

  rows.forEach(([label, value]) => {
    if (value === undefined || value === null || value === "") return;

    const tr = document.createElement("tr");
    const th = createElement("th", "", label);
    const td = document.createElement("td");

    // URLs in metadata are displayed as clickable links.
    const possibleURL = safeURL(value);

    if (possibleURL && String(value).trim() === possibleURL) {
      const link = document.createElement("a");
      link.href = possibleURL;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = String(value);
      link.addEventListener("click", stopClick);
      td.appendChild(link);
    } else {
      td.textContent = String(value);
    }

    tr.append(th, td);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}

/* =========================================================
   HEADER ACTIONS
   ========================================================= */

function promptForChannelIndex() {
  if (!channels.length) return null;

  const options = channels.map((channel, index) =>
    `${index + 1}. ${getChannelName(channel)} (${getChannelId(channel)})`
  ).join("\n");

  const answer = window.prompt(
    `Enter a channel number:\n\n${options}`,
    activeChannelIndex >= 0 ? String(activeChannelIndex + 1) : "1"
  );

  if (answer === null) return null;

  const index = Number(answer) - 1;

  if (!Number.isInteger(index) || index < 0 || index >= channels.length) {
    window.alert("That channel number is not valid.");
    return null;
  }

  return index;
}

if (addLogoButton) {
  addLogoButton.addEventListener("click", event => {
    stopClick(event);

    const index = activeChannelIndex >= 0
      ? activeChannelIndex
      : promptForChannelIndex();

    if (index === null || index === undefined) return;

    const channel = channels[index];
    const logo = getChannelLogo(channel);

    if (logo) {
      window.prompt("Logo URL:", logo);
    } else {
      const newLogo = window.prompt("Enter the logo URL:");

      if (newLogo && safeURL(newLogo)) {
        window.alert(
          "To save this logo permanently, update the logo field for this channel in channels.json."
        );
      }
    }
  });
}

if (logoMenuButton) {
  logoMenuButton.addEventListener("click", event => {
    stopClick(event);

    const index = activeChannelIndex >= 0
      ? activeChannelIndex
      : promptForChannelIndex();

    if (index === null || index === undefined) return;

    const logo = getChannelLogo(channels[index]);

    if (!logo) {
      window.alert("This channel does not have a logo URL.");
      return;
    }

    window.open(logo, "_blank", "noopener,noreferrer");
  });
}
if (addFeedButton) {
  addFeedButton.addEventListener("click", event => {
    stopClick(event);

    const index = activeChannelIndex >= 0
      ? activeChannelIndex
      : promptForChannelIndex();

    if (index === null || index === undefined) return;

    window.alert(
      `To add a feed to ${getChannelName(channels[index])}, edit its feeds array in channels.json.`
    );
  });
}

/* =========================================================
   THEME
   ========================================================= */

function applyTheme(theme) {
  const normalized = theme === "dark" ? "dark" : "light";

  document.documentElement.dataset.theme = normalized;
  document.body.dataset.theme = normalized;

  if (themeToggle) {
    themeToggle.setAttribute(
      "aria-label",
      normalized === "dark" ? "Switch to light theme" : "Switch to dark theme"
    );

    themeToggle.title =
      normalized === "dark" ? "Switch to light theme" : "Switch to dark theme";
  }
}

if (themeToggle) {
  themeToggle.addEventListener("click", event => {
    stopClick(event);

    const current =
      document.documentElement.dataset.theme ||
      document.body.dataset.theme ||
      "light";
        applyTheme(current === "dark" ? "light" : "dark");
  });
}

/* =========================================================
   LOAD CHANNELS
   ========================================================= */

async function loadChannels() {
  setStatus("Loading channels…");

  try {
    const response = await fetch("./channels.json", {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Could not load channels.json (HTTP ${response.status})`);
    }

    const data = await response.json();

    // Accept either { "channels": [...] } or a direct array.
    channels = Array.isArray(data)
      ? data
      : Array.isArray(data.channels)
        ? data.channels
        : [];

    if (!channels.length) {
      renderChannels();
      setStatus("No channels found. Check channels.json.", true);
      return;
    }

    renderChannels();
    setStatus("");
  } catch (error) {
    console.error("Channel catalog loading error:", error);
    renderChannels();

    setStatus(
      "Could not load channels.json. Make sure the file is beside index.html and that the site is being opened through a web server.",
      true
    );
  }
}

/* =========================================================
   STARTUP
   ========================================================= */

applyTheme(
  document.documentElement.dataset.theme ||
  document.body.dataset.theme ||
  "light"
);

loadChannels();
