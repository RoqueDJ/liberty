
"use strict";

const $ = (selector, root = document) => root.querySelector(selector);

const elements = {
  list: $("#channel-list"),
  count: $("#channel-count"),
  status: $("#status-message"),
  overlay: $("#channel-details"),
  backdrop: $("#details-backdrop"),
  close: $("#close-details"),
  title: $("#details-title"),
  logo: $("#details-logo"),
  logoMetadata: $("#logo-metadata"),
  feedTitle: $("#feed-section-title"),
  feeds: $("#feed-list"),
  theme: $("#theme-toggle"),
  addLogo: $("#add-logo-button"),
  logoMenu: $("#logo-menu-button"),
  addFeed: $("#add-feed-button")
};

let channels = [];
let activeChannel = null;
let previouslyFocused = null;
let openMenu = null;

const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

const asArray = value => Array.isArray(value)
  ? value
  : value == null || value === "" ? [] : [value];

function displayValue(value) {
  if (value === true) return "true";
  if (value === false) return "false";
  if (value == null || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function normalizedChannel(channel) {
  const item = { ...channel };

  item.number = item.number ?? item.channel_number ?? "";
  item.id = item.id ?? "";
  item.name = item.name ?? item.display_name ?? item.id ?? "Unnamed channel";
  item.display_name = item.display_name ?? item.name;
  item.alt_names = asArray(item.alt_names ?? item.alt_name);
  item.logo = item.logo ?? "";
  item.feeds = asArray(item.feeds).map((feed, index) => ({
    ...feed,
    id: feed.id ?? `FEED${index + 1}`,
    name: feed.name ?? feed.id ?? `Feed ${index + 1}`,
    streams: asArray(feed.streams),
    guides: asArray(feed.guides)
  }));

  return item;
}

function channelTitle(channel) {
  return channel.display_name || channel.name || channel.id;
}

function channelNumber(channel) {
  return channel.number ? String(channel.number) : "";
}

function makeIcon(name) {
  const paths = {
    feed: '<path d="M3 15.1a7 7 0 0 1 3.9 3.9M3 11.1A11 11 0 0 1 11 19M3 19h.01M15 19h2.8c1.2 0 2-.8 2-2V7c0-1.2-.8-2-2-2H5c-1.2 0-2 .8-2 2"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M17 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h5"/>',
    guide: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 10h18"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    menu: '<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>'
  };

  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || ""}</svg>`;
}

function createMetadataTable(rows) {
  const table = document.createElement("table");
  table.className = "metadata-table";
  const tbody = document.createElement("tbody");

  rows.forEach(([label, value]) => {
    const tr = document.createElement("tr");
    const tdLabel = document.createElement("td");
    const tdValue = document.createElement("td");

    tdLabel.textContent = label;
    tdValue.textContent = displayValue(value);

    tr.append(tdLabel, tdValue);
    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  return table;
}

function channelMetadata(channel) {
  const known = [
    ["id", channel.id],
    ["name", channel.name],
    ["alt_names", channel.alt_names],
    ["network", channel.network],
    ["owners", channel.owners ?? channel.owner],
    ["country", channel.country],
    ["broadcast_area", channel.broadcast_area],
    ["timezones", channel.timezones],
    ["languages", channel.languages],
    ["categories", channel.categories],
    ["is_nsfw", channel.is_nsfw],
    ["website", channel.website]
  ];

  return known.filter(([, value]) => value !== undefined && value !== null && value !== "");
}

function logoMetadata(channel) {
  const logo = channel.logo || "";
  const parts = logo.split(/[?#]/)[0].split(".");
  const format = parts.length > 1 ? parts.pop().toUpperCase() : "—";

  return [
    ["url", logo || "—"],
    ["in_use", Boolean(logo)],
    ["width", channel.logo_width ?? channel.logoWidth ?? "—"],
    ["height", channel.logo_height ?? channel.logoHeight ?? "—"],
    ["format", channel.logo_format ?? format]
  ];
}

function renderChannels() {
  elements.list.replaceChildren();

  elements.count.textContent =
    `${channels.length} ${channels.length === 1 ? "channel" : "channels"}`;

  if (!channels.length) {
    const empty = document.createElement("div");
    empty.className = "empty-message";
    empty.textContent = "No channels found in channels.json.";
    elements.list.appendChild(empty);
    return;
  }

  channels.forEach((channel, index) => {
    const row = document.createElement("div");
    row.className = "channel-row";
    row.tabIndex = 0;
    row.setAttribute("role", "button");
    row.setAttribute("aria-label", `Open ${channelTitle(channel)}`);

    const logoColumn = document.createElement("div");
    logoColumn.className = "channel-logo-column";

    const number = document.createElement("span");
    number.className = "channel-number";
    number.textContent = channelNumber(channel);

    const logoButton = document.createElement("button");
    logoButton.className = "channel-logo-button";
    logoButton.type = "button";
    logoButton.setAttribute("aria-label", `View ${channelTitle(channel)} details`);

    if (channel.logo) {
      const img = document.createElement("img");
      img.src = channel.logo;
      img.alt = channel.name;
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.onerror = () => {
        img.replaceWith(makeLogoPlaceholder(channel.name));
      };
      logoButton.appendChild(img);
    } else {
      logoButton.appendChild(makeLogoPlaceholder(channel.name));
    }

    logoColumn.append(number, logoButton);

    const nameColumn = document.createElement("div");
    nameColumn.className = "channel-name-column";

    const name = document.createElement("div");
    name.className = "channel-name";
    name.textContent = channelTitle(channel);

    nameColumn.appendChild(name);

    const alt = channel.alt_names[0];
    if (alt) {
      const altName = document.createElement("div");
      altName.className = "channel-alt-name";
      altName.textContent = alt;
      nameColumn.appendChild(altName);
    }

    const idColumn = document.createElement("div");
    idColumn.className = "channel-id-column";

    const id = document.createElement("code");
    id.textContent = channel.id || "—";
    idColumn.appendChild(id);

    const countButton = document.createElement("button");
    countButton.className = "channel-feed-count";
    countButton.type = "button";
    countButton.title = "View feeds";
    countButton.innerHTML = `${makeIcon("feed")}<span>${channel.feeds.length}</span><span class="feed-word">feed${channel.feeds.length === 1 ? "" : "s"}</span>`;

    countButton.addEventListener("click", event => {
      event.stopPropagation();
      openDetails(index);
    });

    logoButton.addEventListener("click", event => {
      event.stopPropagation();
      openDetails(index);
    });

    row.addEventListener("click", () => openDetails(index));
    row.addEventListener("keydown", event => {
      if (event.target !== row) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetails(index);
      }
    });

    row.append(logoColumn, nameColumn, idColumn, countButton);
    elements.list.appendChild(row);
  });
}

function makeLogoPlaceholder(name) {
  const placeholder = document.createElement("span");
  placeholder.className = "channel-logo-placeholder";
  placeholder.textContent = name;
  return placeholder;
}

function openDetails(index) {
  const channel = channels[index];
  if (!channel) return;

  activeChannel = channel;
  previouslyFocused = document.activeElement;

  elements.title.textContent = channelTitle(channel);
  elements.logo.src = channel.logo || "";
  elements.logo.alt = channel.name || "Channel logo";
  elements.logo.style.display = channel.logo ? "block" : "none";

  elements.logoMetadata.replaceChildren(
    createMetadataTable(logoMetadata(channel))
  );

  // Channel metadata appears after the logo metadata, as a separate table.
  const channelTable = createMetadataTable(channelMetadata(channel));
  channelTable.classList.add("channel-metadata-table");
  elements.logoMetadata.appendChild(channelTable);

  elements.feedTitle.textContent = "Feeds";
  renderFeeds(channel);
  elements.overlay.hidden = false;
  document.body.style.overflow = "hidden";
  elements.close.focus();
}

function closeDetails() {
  elements.overlay.hidden = true;
  document.body.style.overflow = "";
  closeMenus();

  if (previouslyFocused && typeof previouslyFocused.focus === "function") {
    previouslyFocused.focus();
  }
}

function renderFeeds(channel) {
  elements.feeds.replaceChildren();

  if (!channel.feeds.length) {
    const note = document.createElement("p");
    note.className = "inline-note";
    note.textContent = "No feeds listed for this channel.";
    elements.feeds.appendChild(note);
    return;
  }

  channel.feeds.forEach((feed, index) => {
    const card = document.createElement("article");
    card.className = "feed-card";
    card.id = `feed-${index}`;

    const header = document.createElement("div");
    header.className = "feed-card-header";

    const expand = document.createElement("button");
    expand.className = "small-icon-button";
    expand.type = "button";
    expand.title = "Collapse";
    expand.setAttribute("aria-label", "Collapse feed");
    expand.innerHTML = `<span class="chevron">${makeIcon("chevron")}</span>`;

    const name = document.createElement("div");
    name.className = "feed-name";
    name.textContent = feed.name;

    const id = document.createElement("div");
    id.className = "feed-id";
    id.innerHTML = `<code>${esc(feed.id)}</code>`;

    const stats = document.createElement("div");
    stats.className = "feed-stats";

    const streamsButton = document.createElement("button");
    streamsButton.className = "stat-button";
    streamsButton.type = "button";
    streamsButton.title = "Streams";
    streamsButton.innerHTML = `${makeIcon("feed")}<span>${feed.streams.length}</span>`;

    const guidesButton = document.createElement("button");
    guidesButton.className = "stat-button";
    guidesButton.type = "button";
    guidesButton.title = "Guides";
    guidesButton.innerHTML = `${makeIcon("guide")}<span>${feed.guides.length}</span>`;

    stats.append(streamsButton, guidesButton);

    const menuWrap = document.createElement("div");
    menuWrap.className = "relative-menu";

    const menuButton = document.createElement("button");
    menuButton.className = "icon-button feed-menu-button";
    menuButton.type = "button";
    menuButton.title = "Menu";
    menuButton.setAttribute("aria-label", `Menu for ${feed.name}`);
    menuButton.innerHTML = makeIcon("menu");

    menuWrap.appendChild(menuButton);
    header.append(expand, name, id, stats, menuWrap);

    const body = document.createElement("div");
    body.className = "feed-card-body";

    const feedRows = [
      ["id", feed.id],
      ["name", feed.name],
      ["is_main", feed.is_main],
      ["broadcast_area", feed.broadcast_area],
      ["timezones", feed.timezones],
      ["languages", feed.languages],
      ["format", feed.format]
    ].filter(([, value]) => value !== undefined && value !== null && value !== "");

    body.appendChild(createMetadataTable(feedRows));

    const streamHeading = document.createElement("div");
    streamHeading.className = "section-heading";
    streamHeading.style.paddingLeft = "0";
    streamHeading.innerHTML = `<span class="section-symbol">${makeIcon("feed")}</span><span>Streams</span><span class="section-spacer"></span>`;

    const addStream = document.createElement("button");
    addStream.className = "icon-button";
    addStream.type = "button";
    addStream.title = "Add Stream";
    addStream.setAttribute("aria-label", "Add Stream");
    addStream.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 7v10M7 12h10"/><circle cx="12" cy="12" r="10"/></svg>';
    addStream.addEventListener("click", () => addStreamPrompt(channel, feed));

    streamHeading.appendChild(addStream);
    body.appendChild(streamHeading);

    const streams = document.createElement("div");
    streams.className = "stream-list";

    if (feed.streams.length) {
      feed.streams.forEach((stream, streamIndex) => {
        streams.appendChild(renderStream(stream, streamIndex, channel, feed));
      });
    } else {
      const note = document.createElement("p");
      note.className = "inline-note";
      note.textContent = "No streams listed for this feed.";
      streams.appendChild(note);
    }

    body.appendChild(streams);

    const guidesHeading = document.createElement("div");
    guidesHeading.className = "section-heading";
    guidesHeading.style.paddingLeft = "0";
    guidesHeading.innerHTML = `<span class="section-symbol">${makeIcon("guide")}</span><span>Guides</span>`;
    body.appendChild(guidesHeading);

    if (feed.guides.length) {
      const guidesTable = createMetadataTable(
        feed.guides.map((guide, guideIndex) => [
          `Guide ${guideIndex + 1}`,
          [
            guide.language ? `Language: ${guide.language}` : "",
            guide.site ? `Site: ${guide.site}` : "",
            guide.site_id ? `Site ID: ${guide.site_id}` : "",
            guide.site_name ? `Name: ${guide.site_name}` : ""
          ].filter(Boolean).join(" · ")
        ])
      );
      body.appendChild(guidesTable);
    } else {
      const note = document.createElement("p");
      note.className = "inline-note";
      note.textContent = "No guides listed for this feed.";
      body.appendChild(note);
    }

    card.append(header, body);

    expand.addEventListener("click", () => {
      const collapsed = card.classList.toggle("collapsed");
      expand.title = collapsed ? "Expand" : "Collapse";
      expand.setAttribute("aria-label", expand.title);
    });

    streamsButton.addEventListener("click", () => {
      card.classList.remove("collapsed");
      streams.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    guidesButton.addEventListener("click", () => {
      card.classList.remove("collapsed");
      guidesHeading.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });

    menuButton.addEventListener("click", () => {
      showMenu(menuWrap, [
        ["Edit feed", () => editFeedPrompt(channel, feed)],
        ["Add stream", () => addStreamPrompt(channel, feed)],
        ["Delete feed", () => deleteFeedPrompt(channel, feed)]
      ]);
    });

    elements.feeds.appendChild(card);
  });
}

function renderStream(stream, index, channel, feed) {
  const card = document.createElement("article");
  card.className = "stream-card collapsed";

  const header = document.createElement("div");
  header.className = "stream-card-header";

  const expand = document.createElement("button");
  expand.className = "small-icon-button";
  expand.type = "button";
  expand.title = "Expand";
  expand.setAttribute("aria-label", "Expand stream");
  expand.innerHTML = `<span class="chevron">${makeIcon("chevron")}</span>`;

  const urlWrap = document.createElement("div");
  urlWrap.className = "stream-url-wrap";

  const url = stream.url || stream.link || "";
  const link = document.createElement("a");
  link.className = "stream-url";
  link.textContent = url || stream.title || `Stream ${index + 1}`;
  link.title = url || "";
  link.href = safeHttpUrl(url) || "#";
  link.target = "_blank";
  link.rel = "noopener noreferrer external";

  if (!safeHttpUrl(url)) {
    link.addEventListener("click", event => event.preventDefault());
    link.title = "No valid HTTP(S) stream URL";
  }

  urlWrap.appendChild(link);

  const external = document.createElement("span");
  external.className = "external-link-mark";
  external.innerHTML = makeIcon("external");

  const menuWrap = document.createElement("div");
  menuWrap.className = "relative-menu";

  const menuButton = document.createElement("button");
  menuButton.className = "icon-button stream-menu-button";
  menuButton.type = "button";
  menuButton.title = "Menu";
  menuButton.setAttribute("aria-label", "Stream menu");
  menuButton.innerHTML = makeIcon("menu");
  menuWrap.appendChild(menuButton);

  header.append(expand, urlWrap, external, menuWrap);

  const body = document.createElement("div");
  body.className = "stream-card-body";

  const rows = [
    ["title", stream.title],
    ["url", url],
    ["quality", stream.quality],
    ["format", stream.format],
    ["user_agent", stream.user_agent],
    ["referrer", stream.referrer],
    ["is_main", stream.is_main],
    ["open_in_new_tab", true]
  ].filter(([, value]) => value !== undefined && value !== null && value !== "");

  body.appendChild(createMetadataTable(rows));

  expand.addEventListener("click", () => {
    const collapsed = card.classList.toggle("collapsed");
    expand.title = collapsed ? "Expand" : "Collapse";
    expand.setAttribute("aria-label", expand.title);
  });

  menuButton.addEventListener("click", () => {
    showMenu(menuWrap, [
      ["Open stream", () => {
        const valid = safeHttpUrl(url);
        if (valid) window.open(valid, "_blank", "noopener,noreferrer");
      }],
      ["Edit stream", () => editStreamPrompt(channel, feed, stream)],
      ["Delete stream", () => deleteStreamPrompt(channel, feed, stream)]
    ]);
  });

  card.append(header, body);
  return card;
}

function safeHttpUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function showMenu(parent, actions) {
  closeMenus();

  const menu = document.createElement("div");
  menu.className = "action-menu";

  actions.forEach(([label, action]) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      closeMenus();
      action();
    });
    menu.appendChild(button);
  });

  parent.appendChild(menu);
  openMenu = menu;
}

function closeMenus() {
  if (openMenu) openMenu.remove();
  openMenu = null;
}

function refresh() {
  renderChannels();
  if (activeChannel) {
    const index = channels.indexOf(activeChannel);
    if (index >= 0) openDetails(index);
    else closeDetails();
  }
}

function addLogoPrompt() {
  if (!activeChannel) return;
  const url = prompt("Enter the logo image URL:", activeChannel.logo || "");
  if (url === null) return;

  if (url && !safeHttpUrl(url)) {
    alert("Please enter a valid HTTP or HTTPS URL.");
    return;
  }

  activeChannel.logo = url.trim();
  refresh();
}

function addFeedPrompt(channel) {
  const name = prompt("Feed name (for example, HD):");
  if (!name || !name.trim()) return;

  const id = prompt("Feed ID:", name.trim().replace(/\s+/g, ""));
  if (id === null) return;

  channel.feeds.push({
    id: id.trim() || name.trim(),
    name: name.trim(),
    is_main: channel.feeds.length === 0,
    streams: [],
    guides: []
  });

  refresh();
}

function addStreamPrompt(channel, feed) {
  const url = prompt("Paste the stream URL (HTTP/HTTPS):");
  if (!url || !url.trim()) return;

  if (!safeHttpUrl(url.trim())) {
    alert("Please enter a valid HTTP or HTTPS URL.");
    return;
  }

  const title = prompt("Stream title:", feed.name || "Stream");
  if (title === null) return;

  feed.streams.push({
    title: title.trim() || "Stream",
    url: url.trim(),
    open_in_new_tab: true
  });

  refresh();
}

function editFeedPrompt(channel, feed) {
  const name = prompt("Feed name:", feed.name);
  if (name === null || !name.trim()) return;
  const id = prompt("Feed ID:", feed.id);
  if (id === null) return;

  feed.name = name.trim();
  feed.id = id.trim() || feed.id;
  refresh();
}

function deleteFeedPrompt(channel, feed) {
  if (!confirm(`Delete feed "${feed.name}" from this page?`)) return;
  channel.feeds = channel.feeds.filter(item => item !== feed);
  refresh();
}

function editStreamPrompt(channel, feed, stream) {
  const url = prompt("Stream URL:", stream.url || "");
  if (url === null || !url.trim()) return;

  if (!safeHttpUrl(url.trim())) {
    alert("Please enter a valid HTTP or HTTPS URL.");
    return;
  }

  const title = prompt("Stream title:", stream.title || "");
  if (title === null) return;

  stream.url = url.trim();
  stream.title = title.trim();
  refresh();
}

function deleteStreamPrompt(channel, feed, stream) {
  if (!confirm("Delete this stream from the current page?")) return;
  feed.streams = feed.streams.filter(item => item !== stream);
  refresh();
}

elements.close.addEventListener("click", closeDetails);
elements.backdrop.addEventListener("click", closeDetails);
elements.addLogo.addEventListener("click", addLogoPrompt);
elements.logoMenu.addEventListener("click", () => {
  showMenu(elements.logoMenu.parentElement, [
    ["Change logo URL", addLogoPrompt],
    ["Remove logo", () => {
      if (!activeChannel) return;
      if (!confirm("Remove this channel's logo?")) return;
      activeChannel.logo = "";
      refresh();
    }]
  ]);
});
elements.addFeed.addEventListener("click", () => {
  if (activeChannel) addFeedPrompt(activeChannel);
});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    if (openMenu) closeMenus();
    else if (!elements.overlay.hidden) closeDetails();
  }
});

document.addEventListener("click", event => {
  if (openMenu && !openMenu.contains(event.target)) closeMenus();
});

elements.theme.addEventListener("click", () => {
  document.body.classList.toggle("dark");
  elements.theme.title = document.body.classList.contains("dark")
    ? "Switch to light theme"
    : "Switch to dark theme";
});

async function loadChannels() {
  try {
    const response = await fetch("channels.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`channels.json returned HTTP ${response.status}`);
    }

    const data = await response.json();
    const source = Array.isArray(data) ? data : data.channels;

    if (!Array.isArray(source)) {
      throw new Error('Expected an array or an object containing "channels".');
    }
     
    channels = source.map(normalizedChannel);
    renderChannels();
    elements.status.textContent = "";
  } catch (error) {
    console.error(error);
    elements.list.innerHTML = "";
    const message = document.createElement("div");
    message.className = "empty-message";
    message.textContent =
      "Couldn't load channels.json. Check the file name and JSON syntax.";
    elements.list.appendChild(message);
    elements.status.textContent = "Loading failed";
  }
}

loadChannels();
