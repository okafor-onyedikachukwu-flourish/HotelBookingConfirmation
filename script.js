/* =========================================================
   Maison Soleil — interactions
   This one file is shared by every page. Each feature first
   checks that its elements exist on the current page, so
   nothing breaks on pages that don't use it.

   1. Mobile navigation menu        (every page)
   2. Copy the Wi-Fi password       (Your stay)
   3. Print the receipt             (Your stay)
   4. Add to calendar (.ics file)   (Your stay)
   5. Filter places                 (Around town)
   6. Breakfast note form           (Breakfast)
   7. Messages                      (Messages)
   ========================================================= */

/* Small helpers for saving data in the browser.
   localStorage can be unavailable (private mode, some embeds),
   so we wrap it in try/catch and carry on without it. */
function loadSaved(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Not saved, but the page still works */
  }
}

/* ---------- 1. Mobile navigation menu ---------- */
const sidebar = document.querySelector("[data-sidebar]");
const menuToggle = document.querySelector("[data-menu-toggle]");
const desktopQuery = window.matchMedia("(min-width: 64rem)");

function setMenu(isOpen) {
  sidebar.classList.toggle("is-open", isOpen);
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.setAttribute("aria-label", isOpen ? "Close menu" : "Open menu");
  // Lock page scroll while the full-screen menu is open
  document.documentElement.classList.toggle("menu-open", isOpen);
}

if (sidebar && menuToggle) {
  menuToggle.addEventListener("click", () => {
    const isOpen = menuToggle.getAttribute("aria-expanded") === "true";
    setMenu(!isOpen);
  });

  // Escape closes the menu and puts focus back on the toggle button
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && sidebar.classList.contains("is-open")) {
      setMenu(false);
      menuToggle.focus();
    }
  });

  // If the window grows to desktop size, reset the mobile menu
  desktopQuery.addEventListener("change", (event) => {
    if (event.matches) setMenu(false);
  });
}

/* ---------- 2. Copy the Wi-Fi password ---------- */
const copyButton = document.querySelector("[data-copy-target]");

async function copyText(text) {
  // Modern browsers: the Clipboard API
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  // Older browsers: copy from a temporary, hidden textarea
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("Copy failed");
}

if (copyButton) {
  const copyStatus = document.querySelector("[data-copy-status]");
  let copyTimer;

  copyButton.addEventListener("click", async () => {
    const target = document.getElementById(copyButton.dataset.copyTarget);
    const password = target.textContent.trim();

    try {
      await copyText(password);
      copyButton.textContent = "Copied";
      copyButton.classList.add("is-copied");
      copyStatus.textContent = "Wi-Fi password copied to clipboard.";
    } catch {
      copyButton.textContent = "Select";
      copyStatus.textContent = "Couldn't copy automatically. The password is selected, so you can copy it yourself.";
      // Select the password so the guest can copy it by hand
      window.getSelection().selectAllChildren(target);
    }

    // Reset the button after 2 seconds
    clearTimeout(copyTimer);
    copyTimer = setTimeout(() => {
      copyButton.textContent = "Copy";
      copyButton.classList.remove("is-copied");
      copyStatus.textContent = "";
    }, 2000);
  });
}

/* ---------- 3. Print the receipt ---------- */
// The @media print rules in style.css hide everything except the receipt
const printButton = document.querySelector("[data-print]");

if (printButton) {
  printButton.addEventListener("click", () => window.print());
}

/* ---------- 4. Add to calendar ---------- */
const calendarButton = document.querySelector("[data-calendar]");

// 2026-04-25T13:00:00.000Z  ->  20260425T130000Z  (the format .ics files use)
function toICSDate(date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

if (calendarButton) {
  // The dates come straight from the <time datetime="..."> tags in the receipt,
  // so if the booking changes you only need to update the HTML.
  const checkIn = new Date(document.querySelector("[data-check-in]").dateTime);
  const checkOut = new Date(document.querySelector("[data-check-out]").dateTime);

  function buildICS() {
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Maison Soleil//Booking confirmation//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      "UID:MS-2026-0421-AH@maison-soleil",
      `DTSTAMP:${toICSDate(new Date())}`,
      `DTSTART:${toICSDate(checkIn)}`,
      `DTEND:${toICSDate(checkOut)}`,
      "SUMMARY:Stay at Maison Soleil · La Garrigue",
      "LOCATION:Maison Soleil\\, 12 Rue des Oliviers\\, Cassis",
      "DESCRIPTION:Booking № MS-2026 0421-AH. Check-in from 15:00 – ring the brass bell by the blue door. Wi-Fi: Le Soleil · Guest.",
      "END:VEVENT",
      "END:VCALENDAR",
    ];
    return lines.join("\r\n"); // the .ics format wants Windows-style line endings
  }

  calendarButton.addEventListener("click", () => {
    const file = new Blob([buildICS()], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(file);

    // A temporary link with the "download" attribute saves the file
    const link = document.createElement("a");
    link.href = url;
    link.download = "maison-soleil-stay.ics";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  });
}

/* ---------- 5. Filter places (Around town) ---------- */
const filterButtons = document.querySelectorAll("[data-filter]");

if (filterButtons.length) {
  const places = document.querySelectorAll("[data-category]");
  const filterStatus = document.querySelector("[data-filter-status]");

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      // Only the clicked chip is "pressed"
      filterButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));

      // Show matching cards, hide the rest
      let shown = 0;
      places.forEach((place) => {
        const match = filter === "all" || place.dataset.category === filter;
        place.hidden = !match;
        if (match) shown++;
      });

      // Tell screen reader users what changed
      filterStatus.textContent = `Showing ${shown} ${shown === 1 ? "place" : "places"}.`;
    });
  });
}

/* ---------- 6. Breakfast note form ---------- */
const breakfastForm = document.querySelector("[data-breakfast-form]");

if (breakfastForm) {
  const savedBox = document.querySelector("[data-breakfast-saved]");
  const summary = document.querySelector("[data-breakfast-summary]");
  const editButton = document.querySelector("[data-breakfast-edit]");
  const timeSelect = breakfastForm.elements.time;
  const timeError = document.getElementById("bf-time-error");
  const STORAGE_KEY = "maison-soleil-breakfast-note";

  function showSaved(note) {
    const diet = note.diet.length ? note.diet.join(", ") : "No dietary needs";
    summary.textContent = `Breakfast at ${note.time} · ${diet}${note.note ? ` · “${note.note}”` : ""}`;
    breakfastForm.hidden = true;
    savedBox.hidden = false;
  }

  function showError(show) {
    timeError.hidden = !show;
    timeSelect.setAttribute("aria-invalid", String(show));
  }

  // If a note was saved earlier, show it straight away
  const existing = loadSaved(STORAGE_KEY, null);
  if (existing) {
    showSaved(existing);
    // Pre-fill the form in case the guest wants to change it
    timeSelect.value = existing.time;
    breakfastForm.elements.note.value = existing.note;
    breakfastForm.querySelectorAll('[name="diet"]').forEach((box) => {
      box.checked = existing.diet.includes(box.value);
    });
  }

  breakfastForm.addEventListener("submit", (event) => {
    event.preventDefault(); // there's no server, so we handle it here

    if (!timeSelect.value) {
      showError(true);
      timeSelect.focus();
      return;
    }
    showError(false);

    const note = {
      time: timeSelect.value,
      diet: [...breakfastForm.querySelectorAll('[name="diet"]:checked')].map((box) => box.value),
      note: breakfastForm.elements.note.value.trim(),
    };

    save(STORAGE_KEY, note);
    showSaved(note);
    savedBox.focus(); // move focus so screen readers announce the result
  });

  // Clear the error as soon as a time is picked
  timeSelect.addEventListener("change", () => {
    if (timeSelect.value) showError(false);
  });

  editButton.addEventListener("click", () => {
    savedBox.hidden = true;
    breakfastForm.hidden = false;
    timeSelect.focus();
  });
}

/* ---------- 7. Messages ---------- */
const composer = document.querySelector("[data-composer]");

if (composer) {
  const thread = document.querySelector("[data-thread]");
  const input = composer.elements.message;
  const STORAGE_KEY = "maison-soleil-messages";
  const sent = loadSaved(STORAGE_KEY, []);

  // Build a guest message bubble.
  // We use textContent (not innerHTML) so typed text can never inject HTML.
  function addBubble(message) {
    const bubble = document.createElement("li");
    bubble.className = "bubble bubble--guest";

    const text = document.createElement("p");
    text.textContent = message.text;

    const time = document.createElement("time");
    time.dateTime = message.sentAt;
    time.textContent = new Date(message.sentAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false, // 24-hour time, like the rest of the site
    });

    bubble.append(text, time);
    thread.append(bubble);
    return bubble;
  }

  // A small "Your messages" divider above the guest's new messages
  let hasDivider = false;
  function addDivider() {
    const day = document.createElement("li");
    day.className = "thread__day";
    day.innerHTML = "<span>Your messages</span>";
    thread.append(day);
    hasDivider = true;
  }

  // Show messages sent on an earlier visit
  if (sent.length) {
    addDivider();
    sent.forEach(addBubble);
  }

  // Let the text box grow as the guest types
  function autoGrow() {
    input.style.height = "auto";
    input.style.height = `${input.scrollHeight}px`;
  }
  input.addEventListener("input", autoGrow);

  // Enter sends, Shift + Enter makes a new line
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      composer.requestSubmit();
    }
  });

  composer.addEventListener("submit", (event) => {
    event.preventDefault();
    const text = input.value.trim();
    if (!text) {
      input.focus();
      return;
    }

    const message = { text, sentAt: new Date().toISOString() };
    sent.push(message);
    save(STORAGE_KEY, sent);

    if (!hasDivider) addDivider();
    const bubble = addBubble(message);
    bubble.scrollIntoView({ behavior: "smooth", block: "nearest" });

    input.value = "";
    autoGrow();
    input.focus();
  });

  // Quick replies fill the text box so the guest can edit before sending
  document.querySelectorAll("[data-quick-reply]").forEach((chip) => {
    chip.addEventListener("click", () => {
      input.value = chip.textContent.trim();
      autoGrow();
      input.focus();
    });
  });
}
