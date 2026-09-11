## 快速开始

获取当前请求的客户端 IP 地址。接口公开，无需登录、API Key 或请求参数，返回 JSON。

```http
GET /api/ip
```

以下示例使用站点地址；本地开发时可以替换为 `http://localhost:3000`。

## cURL 调用

### 基础请求

```bash
curl -s https://jadren.me/api/ip
```

### 格式化 JSON

安装 `jq` 后，可以格式化查看响应：

```bash
curl -s https://jadren.me/api/ip | jq .
```

### 只输出 IP

```bash
curl -s https://jadren.me/api/ip | jq -r '.ip'
```

## 响应示例

成功返回 `200 OK`。以下地址仅为示例，实际值由本次请求的转发头决定。

```json
{
  "ip": "203.0.113.10",
  "headers": {
    "x-forwarded-for": "203.0.113.10, 192.0.2.20",
    "x-real-ip": "203.0.113.10"
  }
}
```

### 字段说明

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `ip` | string | 从请求头提取的客户端 IP；缺少可用值时为 `unknown` |
| `headers.x-forwarded-for` | string 或 null | 收到的完整 `X-Forwarded-For` 请求头；空值或缺失时为 `null` |
| `headers.x-real-ip` | string 或 null | 收到的 `X-Real-IP` 请求头；空值或缺失时为 `null` |

`/api/ip` 只返回 IP 与转发头，不包含 IP 查询页面额外展示的地理位置、运营商等信息。

## JavaScript 调用

在本站页面中可以使用相对地址：

```javascript
const response = await fetch('/api/ip');
if (!response.ok) throw new Error(`HTTP ${response.status}`);
const data = await response.json();
console.log(data.ip);
```

## 地址提取规则

1. 优先取 `X-Forwarded-For` 中逗号分隔的第一个值，并去除首尾空格。
2. 如果第一个值为空或没有该请求头，使用 `X-Real-IP`。
3. 两者都没有可用值时，返回 `unknown`；响应仍为 `200`。

没有转发头时的响应：

```json
{
  "ip": "unknown",
  "headers": {
    "x-forwarded-for": null,
    "x-real-ip": null
  }
}
```

## 本地开发与反向代理

本地访问时可能显示 `::1`（IPv6 回环地址）、`127.0.0.1`，或 `unknown`。这反映的是服务收到的请求信息，不一定是你的公网出口 IP。

部署在反向代理之后时，需要由代理正确设置转发头。当前接口读取这些头部，不额外验证 IP 格式或代理可信性，因此返回结果适合展示与调试，不应直接作为身份或访问权限判断依据。
