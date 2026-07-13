import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [status, monitor] = await Promise.all([
  readFile(new URL("../status/index.html", import.meta.url), "utf8"),
  readFile(new URL("../status-monitor.js", import.meta.url), "utf8"),
]);

assert.match(status, /<script src="\/status-monitor\.js" defer><\/script>/, "Status must load its isolated public monitor.");
assert.match(status, /LIVE SIGNED OBSERVATIONS/, "Status must distinguish live observations from static release records.");
assert.match(status, /STATIC RELEASE RECORDS/, "Static records must be explicitly scoped as non-live.");
assert.match(status, /data-status-monitor-row="978"/, "Status must render a Chain 978 monitor target.");
assert.match(status, /data-status-monitor-row="521"/, "Status must render a Chain N521 monitor target.");
assert.match(status, /Last signed observation/, "Live rows must label the true observation time.");
assert.match(status, /not an activation event or release-build time/i, "Status must not imply an activation event.");
assert.doesNotMatch(status, /data-relative-time=/, "Static release timestamps must not masquerade as live monitor updates.");
assert.doesNotMatch(status, /data-label="Timestamp"/, "Static release records must not expose a faux event-time column.");
assert.doesNotMatch(status, /Last successful check/, "Static records must not claim a per-record runtime check.");
assert.doesNotMatch(status, /2026-07-13T07:56:58Z/, "The shared release-input time must not be rendered as Status evidence.");

assert.match(monitor, /fetch\("\/api\/chain-progress"/, "The monitor may consume only the bounded public observation endpoint.");
assert.match(monitor, /cache: "no-store"/, "The monitor must request a current public response.");
assert.match(monitor, /observation\.observed_at !== chain\.checkedAt/, "The monitor must bind the row time to the signed observation time.");
assert.match(monitor, /chain\.observationSequence !== observation\.sequence/, "The monitor must bind the displayed sequence to the signed observation.");
assert.match(monitor, /No current state is asserted/, "Unavailable monitor responses must fail closed.");
assert.match(monitor, /advanced in this browser session/, "Sequence progress must be scoped to the current browser session.");
assert.doesNotMatch(monitor, /FENRUA_[A-Z_]+/, "The browser monitor must not read protected configuration.");
assert.doesNotMatch(monitor, /https?:\/\//, "The browser monitor must not contact an external or protected endpoint.");

console.log(JSON.stringify({ status: "ok", scope: "status-observation-monitor", chains: 2 }));
