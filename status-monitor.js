(() => {
  const monitoredChains = [978, 521];
  const initialRefreshMs = 20_000;
  const maximumRefreshMs = 60_000;
  const requestTimeoutMs = 8_000;
  const validStates = new Set(["live", "delayed", "partial", "waiting", "unavailable"]);
  const rows = new Map(
    [...document.querySelectorAll("[data-status-monitor-row]")]
      .map((row) => [Number(row.dataset.statusMonitorRow), row])
      .filter(([chain]) => monitoredChains.includes(chain))
  );

  if (rows.size !== monitoredChains.length) return;

  const meta = document.querySelector("[data-status-monitor-meta]");
  const announcer = document.querySelector("[data-status-monitor-announcer]");
  const monitor = {
    controller: null,
    nextRead: null,
    refreshMs: initialRefreshMs,
    retryMs: initialRefreshMs,
    snapshot: null,
    sequences: new Map(),
    sequenceLabels: new Map(),
    announcementKey: "",
  };

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function isIsoTimestamp(value) {
    return typeof value === "string" && Number.isFinite(Date.parse(value));
  }

  function isSafeNonNegativeInteger(value) {
    return Number.isSafeInteger(value) && value >= 0;
  }

  function boundedMilliseconds(value, fallback) {
    if (!Number.isSafeInteger(value)) return fallback;
    return Math.min(Math.max(value, 5_000), maximumRefreshMs);
  }

  function boundedFreshness(value) {
    if (!Number.isSafeInteger(value)) return 90;
    return Math.min(Math.max(value, 30), 300);
  }

  function setText(row, selector, value) {
    const element = row.querySelector(selector);
    if (element) element.textContent = value;
  }

  function stateDisplay(state) {
    if (state === "live") return { label: "Live", className: "status-success" };
    if (state === "delayed") return { label: "Stale", className: "status-stale" };
    if (state === "partial") return { label: "Partial", className: "status-partial" };
    if (state === "waiting") return { label: "Awaiting signed observation", className: "status-stale" };
    return { label: "Unavailable", className: "status-failure" };
  }

  function setState(row, state) {
    const badge = row.querySelector("[data-status-monitor-state]");
    if (!badge) return;
    const display = stateDisplay(state);
    badge.className = `status-badge ${display.className}`;
    badge.textContent = display.label;
  }

  function formatUtc(value) {
    return new Date(value).toISOString().slice(0, 19).replace("T", " ") + " UTC";
  }

  function observationAgeSeconds(value) {
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    return Math.max(0, Math.floor((Date.now() - parsed) / 1_000));
  }

  function relativeObservationTime(value) {
    const seconds = observationAgeSeconds(value);
    if (seconds === null) return "Observation time unavailable";
    if (seconds < 5) return "Observed just now";
    if (seconds < 60) return `Observed ${seconds} seconds ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Observed ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 48) return `Observed ${hours} hour${hours === 1 ? "" : "s"} ago`;
    const days = Math.floor(hours / 24);
    return `Observed ${days} day${days === 1 ? "" : "s"} ago`;
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US").format(value);
  }

  function signedObservation(snapshot, chain) {
    if (!isObject(chain) || !monitoredChains.includes(chain.expectedChainId) || !validStates.has(chain.status)) return null;
    const observation = snapshot.observations.find((candidate) => String(candidate?.chain) === String(chain.expectedChainId));
    if (!isObject(observation) || typeof observation.signature !== "string" || observation.signature.length === 0) return null;
    if (!isIsoTimestamp(observation.observed_at) || observation.observed_at !== chain.checkedAt) return null;
    if (!Number.isSafeInteger(observation.sequence) || observation.sequence < 1 || chain.observationSequence !== observation.sequence) return null;

    if (chain.status === "live" || chain.status === "delayed") {
      if (
        observation.status !== "confirmed" ||
        observation.source_quorum !== 2 ||
        !isSafeNonNegativeInteger(observation.observed_block) ||
        chain.blockNumber !== observation.observed_block
      ) {
        return null;
      }
    }

    if (
      chain.status === "partial" &&
      (observation.status !== "partial" || observation.source_quorum < 1 || observation.source_quorum >= 2 || observation.observed_block !== null)
    ) {
      return null;
    }

    return observation;
  }

  function effectiveState(chain, observation, freshnessSeconds) {
    if (!observation) return chain?.status === "waiting" ? "waiting" : "unavailable";
    if (chain.status !== "live") return chain.status;
    const age = observationAgeSeconds(observation.observed_at);
    return age === null || age > freshnessSeconds ? "delayed" : "live";
  }

  function sequenceLabel(chain, sequence) {
    const previous = monitor.sequences.get(chain);
    if (!Number.isSafeInteger(previous)) {
      monitor.sequences.set(chain, sequence);
      monitor.sequenceLabels.set(chain, "current");
    } else if (sequence > previous) {
      monitor.sequences.set(chain, sequence);
      monitor.sequenceLabels.set(chain, "advanced in this browser session");
    } else if (sequence < previous) {
      monitor.sequences.set(chain, sequence);
      monitor.sequenceLabels.set(chain, "reset in this browser session");
    }
    return `Signed sequence ${formatNumber(sequence)} · ${monitor.sequenceLabels.get(chain) || "current"}`;
  }

  function setObservationTime(row, observedAt) {
    const target = row.querySelector("[data-status-monitor-time]");
    if (!target) return;
    target.classList.add("timestamp-stack", "status-monitor-timestamp");
    const time = document.createElement("time");
    const relative = document.createElement("small");
    time.dateTime = observedAt;
    time.textContent = formatUtc(observedAt);
    relative.dataset.statusMonitorRelative = observedAt;
    relative.textContent = relativeObservationTime(observedAt);
    target.replaceChildren(time, relative);
  }

  function clearObservation(row, message) {
    const target = row.querySelector("[data-status-monitor-time]");
    if (!target) return;
    target.classList.remove("timestamp-stack", "status-monitor-timestamp");
    target.textContent = message;
  }

  function renderUnavailable(row, state, message) {
    setState(row, state);
    clearObservation(row, message);
    setText(row, "[data-status-monitor-sequence]", "No verified signed sequence");
    setText(row, "[data-status-monitor-block]", "No confirmed block");
    setText(
      row,
      "[data-status-monitor-source]",
      state === "waiting" ? "Awaiting a signed public observation" : "No current signed observation returned"
    );
    setText(row, "[data-status-monitor-freshness]", "No current freshness claim");
  }

  function renderChain(snapshot, chain) {
    const chainId = chain?.expectedChainId;
    const row = rows.get(chainId);
    if (!row) return { chain: chainId, state: "unavailable", sequence: null };

    const observation = signedObservation(snapshot, chain);
    const state = effectiveState(chain, observation, snapshot.freshnessSeconds);
    if (!observation) {
      renderUnavailable(row, state, state === "waiting" ? "Awaiting a signed public observation." : "No current signed observation.");
      return { chain: chainId, state, sequence: null };
    }

    setState(row, state);
    setObservationTime(row, observation.observed_at);
    setText(row, "[data-status-monitor-sequence]", sequenceLabel(chainId, observation.sequence));
    setText(
      row,
      "[data-status-monitor-block]",
      isSafeNonNegativeInteger(observation.observed_block) ? formatNumber(observation.observed_block) : "No confirmed block"
    );
    setText(row, "[data-status-monitor-source]", "Server-validated signed bounded observation");
    setText(
      row,
      "[data-status-monitor-freshness]",
      `${snapshot.freshnessSeconds}-second maximum · ${relativeObservationTime(observation.observed_at)}`
    );
    return { chain: chainId, state, sequence: observation.sequence };
  }

  function announce(states) {
    const key = states.map(({ chain, state, sequence }) => `${chain}:${state}:${sequence ?? "none"}`).join("|");
    if (!announcer || key === monitor.announcementKey) return;
    monitor.announcementKey = key;
    announcer.textContent = `Public monitor updated: ${states
      .map(({ chain, state }) => `Chain ${chain} ${stateDisplay(state).label}`)
      .join("; ")}.`;
  }

  function renderSnapshot(snapshot) {
    const states = monitoredChains.map((chain) => renderChain(snapshot, snapshot.chains.get(chain)));
    if (meta) {
      meta.textContent = `Public monitor snapshot generated ${formatUtc(snapshot.generatedAt)}. Each row uses its own signed observation time; the snapshot time is not an activation event. Refresh target: ${Math.round(snapshot.refreshMs / 1_000)} seconds.`;
    }
    announce(states);
  }

  function renderFailure() {
    monitoredChains.forEach((chain) => {
      const row = rows.get(chain);
      if (row) renderUnavailable(row, "unavailable", "Public monitor unavailable; no current observation is asserted.");
    });
    if (meta) meta.textContent = `The public monitor did not return a valid current observation. No current state is asserted; retrying in ${Math.round(monitor.retryMs / 1_000)} seconds.`;
    announce(monitoredChains.map((chain) => ({ chain, state: "unavailable", sequence: null })));
  }

  function normalizeSnapshot(payload) {
    if (!isObject(payload) || payload.version !== 1 || !isIsoTimestamp(payload.generatedAt)) throw new Error("Invalid public monitor response");
    if (!Array.isArray(payload.chains) || !Array.isArray(payload.observations)) throw new Error("Incomplete public monitor response");
    const chains = new Map();
    for (const chain of payload.chains) {
      if (!isObject(chain) || !monitoredChains.includes(chain.expectedChainId) || chains.has(chain.expectedChainId)) continue;
      chains.set(chain.expectedChainId, chain);
    }
    if (chains.size !== monitoredChains.length) throw new Error("Missing monitored chain");
    return {
      generatedAt: payload.generatedAt,
      refreshMs: boundedMilliseconds(payload.refreshMs, initialRefreshMs),
      freshnessSeconds: boundedFreshness(payload.freshnessSeconds),
      chains,
      observations: payload.observations,
    };
  }

  async function fetchSnapshot() {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), requestTimeoutMs);
    monitor.controller = controller;
    try {
      const response = await fetch("/api/chain-progress", {
        signal: controller.signal,
        cache: "no-store",
        headers: { accept: "application/json" },
      });
      if (!response.ok) throw new Error("Public monitor unavailable");
      return normalizeSnapshot(await response.json());
    } finally {
      window.clearTimeout(timeout);
      if (monitor.controller === controller) monitor.controller = null;
    }
  }

  function scheduleRead(delay) {
    if (monitor.nextRead) window.clearTimeout(monitor.nextRead);
    if (document.hidden) return;
    monitor.nextRead = window.setTimeout(() => {
      monitor.nextRead = null;
      void readMonitor();
    }, Math.max(0, delay));
  }

  async function readMonitor() {
    if (document.hidden || monitor.controller) return;
    try {
      const snapshot = await fetchSnapshot();
      monitor.snapshot = snapshot;
      monitor.refreshMs = snapshot.refreshMs;
      monitor.retryMs = snapshot.refreshMs;
      renderSnapshot(snapshot);
      scheduleRead(snapshot.refreshMs);
    } catch {
      monitor.snapshot = null;
      monitor.retryMs = Math.min(maximumRefreshMs, Math.max(monitor.refreshMs, monitor.retryMs * 2));
      renderFailure();
      scheduleRead(monitor.retryMs);
    }
  }

  window.setInterval(() => {
    if (!document.hidden && monitor.snapshot) renderSnapshot(monitor.snapshot);
  }, 1_000);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (monitor.nextRead) window.clearTimeout(monitor.nextRead);
      monitor.nextRead = null;
      return;
    }
    scheduleRead(0);
  });
  window.addEventListener("online", () => scheduleRead(0));
  void readMonitor();
})();
