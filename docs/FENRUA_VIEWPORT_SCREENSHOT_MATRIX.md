# Fenrua Viewport Screenshot Matrix

Status: required visual evidence matrix

Routes: `/`, `/architecture/`, `/kernel/`, `/utilities/`, `/research/`, every `/research/<record>/`, `/verify/`, `/developers/`, `/toolchain/`, `/evidence/`, `/status/`.

## Required Viewports

Mobile: `320x568`, `360x640`, `375x667`, `390x844`, `393x852`, `412x915`, `430x932`  
Tablet: `768x1024`, `820x1180`, `1024x768`, `1024x1366`  
Desktop: `1280x720`, `1366x768`, `1440x900`, `1536x864`, `1728x1117`, `1920x1080`, `2560x1440`

## Required Checks

- No unintended horizontal scrolling.
- No heading, badge, nav, footer, card, table, code, or hash collision.
- No hidden primary controls.
- No global overflow suppression used to hide failures.

## Current Evidence

The implementation includes route-level static validation and live Playwright screenshot probes for representative mobile and desktop layouts. The full matrix remains the formal independent review workload.
