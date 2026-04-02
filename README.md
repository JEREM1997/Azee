# Azee / KKOPS

## HTTPS troubleshooting (Netlify)

If you see `NET::ERR_CERT_DATE_INVALID` on `https://kkops.netlify.app`, this is **not caused by the PWA code** (manifest/service worker). TLS is negotiated before the app assets load.

### Quick checks

1. Verify the device date/time/timezone is correct (automatic sync enabled).
2. Retry from another network (no captive portal / SSL interception).
3. Open from another device/browser to confirm whether issue is local.
4. In Netlify dashboard, check domain TLS certificate status and trigger certificate renewal if needed.
5. If you recently changed domains/DNS, wait for propagation and cert re-issue.

### Why this happens

`ERR_CERT_DATE_INVALID` means the browser considers the certificate not valid for the current date (expired, not yet valid, or local clock mismatch).
