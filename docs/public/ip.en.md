## Quick start

Retrieve the client IP address for the current request. This public endpoint requires no authentication, API key, or request parameters and returns JSON.

```http
GET /api/ip
```

Examples use the site's origin. For local development, replace it with `http://localhost:3000`.

## cURL examples

### Basic request

```bash
curl -s https://jadren.me/api/ip
```

### Pretty-print JSON

With `jq` installed:

```bash
curl -s https://jadren.me/api/ip | jq .
```

### Print only the IP

```bash
curl -s https://jadren.me/api/ip | jq -r '.ip'
```

## Response example

Successful requests return `200 OK`. Addresses below are illustrative; actual values depend on the forwarding headers received with the request.

```json
{
  "ip": "203.0.113.10",
  "headers": {
    "x-forwarded-for": "203.0.113.10, 192.0.2.20",
    "x-real-ip": "203.0.113.10"
  }
}
```

### Response fields

| Field | Type | Meaning |
| --- | --- | --- |
| `ip` | string | Client IP extracted from request headers, or `unknown` when unavailable |
| `headers.x-forwarded-for` | string or null | Complete incoming `X-Forwarded-For` header; `null` if empty or missing |
| `headers.x-real-ip` | string or null | Incoming `X-Real-IP` header; `null` if empty or missing |

`/api/ip` only returns the IP and forwarding headers. Location, ISP, and other details displayed separately on the IP lookup page are not part of this response.

## JavaScript example

Use a relative URL from a page on this site:

```javascript
const response = await fetch('/api/ip');
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();
console.log(data.ip);
```

## Address selection

1. Read the first comma-separated value in `X-Forwarded-For` and trim its surrounding whitespace.
2. If that value is empty or the header is absent, use `X-Real-IP`.
3. If neither provides a value, return `unknown`, still with status `200`.

When both headers are missing:

```json
{
  "ip": "unknown",
  "headers": {
    "x-forwarded-for": null,
    "x-real-ip": null
  }
}
```

## Local development and reverse proxies

Local requests may show `::1` (IPv6 loopback), `127.0.0.1`, or `unknown`. These reflect the request received by the service and are not necessarily your public internet address.

When deploying behind a reverse proxy, configure the proxy to set forwarding headers correctly. The endpoint reads these headers without additional IP-format or proxy-trust validation. Its output is suitable for display and debugging, rather than serving directly as an identity or access-control decision.
