## 快速开始

词典提供精确查询和前缀建议两个公开的 [Connect](https://connectrpc.com/) RPC 方法（`jadren.v1.DictionaryService`），无需登录或 API Key。使用 `POST` 并设置 `Content-Type: application/json`，请求与响应均为普通 JSON；也可使用 gRPC-Web 或二进制 Protobuf 客户端。请求地址使用当前站点域名；下面的示例以本地开发地址为例。

```bash
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Lookup -H 'Content-Type: application/json' -d '{"word":"apple"}'
```

## 精确查询

```http
POST /rpc/jadren.v1.DictionaryService/Lookup

{ "word": "apples" }
```

### 请求参数

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `word`（JSON 字段） | 是 | 英语单词或短语。去除首尾空格后为 1–120 个字符，不能包含控制字符。 |

查询不区分大小写，多余空白会合并；复数等别名会自动解析到正式词条。短语中的空格需要进行 URL 编码。

```bash
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Lookup -H 'Content-Type: application/json' -d '{"word":"come to"}'
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Lookup -H 'Content-Type: application/json' -d '{"word":"apples"}'
```

### 响应示例

成功返回 `200 OK`。下面省略了具体释义内容，空数组仅用于展示结构。词典内容位于响应的 `result` 字段内，下面展示的是 `result` 的内容。

```json
{
  "query": "apples",
  "lookupKey": "apples",
  "resolvedKey": "apple",
  "isAlias": true,
  "entry": {
    "word": "apple",
    "display_word": "apple",
    "pronunciation": { "br": "/ˈæpl/", "us": "/ˈæpl/" },
    "labels": {},
    "forms": [],
    "sense_groups": [],
    "senses": [],
    "phrases": [],
    "warnings": []
  }
}
```

### 字段说明

| 字段 | 含义 |
| --- | --- |
| `query` | 去除首尾空格后的查询输入 |
| `lookupKey` | 规范化后的查询键 |
| `resolvedKey` | 解析别名后实际命中的词条键 |
| `isAlias` | 是否通过别名找到词条 |
| `entry` | 完整词条解析结果 |
| `entry.word` / `entry.display_word` | 单词与展示形式 |
| `entry.pronunciation` | 英式 `br` 和美式 `us` 音标 |
| `entry.labels` / `entry.forms` | 标签与词形变化 |
| `entry.sense_groups` / `entry.senses` | 义项分组与顶层义项，包含释义、例句等内容 |
| `entry.phrases` | 短语、习语及其义项 |
| `entry.warnings` | 词条解析警告 |

部分字段可能为空或不存在。短语词条（例如 `come to`）的顶层 `senses` 可能为空，实际内容位于 `phrases`，请同时检查。

## 前缀建议

```http
POST /rpc/jadren.v1.DictionaryService/Search

{ "query": "exper", "limit": 10 }
```

### 请求参数

| 参数 | 必填 | 说明 |
| --- | --- | --- |
| `query`（JSON 字段） | 是 | 单词或短语前缀，去除首尾空格后为 1–120 个字符，不能包含控制字符 |
| `limit` | 否 | 返回数量上限，整数 1–50，默认 20 |

```bash
curl -s http://localhost:3000/rpc/jadren.v1.DictionaryService/Search -H 'Content-Type: application/json' -d '{"query":"exper","limit":10}'
```

### 响应示例

以下仅为响应结构示例；实际结果取决于词库。无匹配结果时仍返回 `200`，`count` 为 `0`，`results` 为空数组。

```json
{
  "query": "exper",
  "count": 2,
  "results": [
    { "word": "ex·peri·ence", "lookupKey": "experience", "isAlias": false, "target": null },
    { "word": "experienced", "lookupKey": "experienced", "isAlias": true, "target": "experience" }
  ]
}
```

`count` 是本次返回的结果数。`word` 用于展示，`lookupKey` 用于后续精确查询；当 `isAlias` 为 `true` 时，`target` 是别名所指向的正式词条。

## JavaScript 调用

在读取词条前检查响应状态；词条内容位于响应的 `result` 字段。

```javascript
async function lookupWord(word) {
  const response = await fetch("/rpc/jadren.v1.DictionaryService/Lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ word }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(`${data.code}: ${data.message}`);
  }
  return data.result.entry;
}

const entry = await lookupWord("come to");
console.log(entry.senses, entry.phrases);
```

## 错误响应

错误统一返回 Connect 错误结构 `{ "code": string, "message": string, "details": [...] }`。HTTP 状态码随 Connect 错误码变化，业务错误码（如 `word_not_found`）位于 `details` 中类型为 `jadren.v1.ErrorDetail` 的条目里（JSON 中可通过 `details[0].debug.code` 读取）。

```json
{ "code": "not_found", "message": "Dictionary entry not found", "details": [{ "type": "jadren.v1.ErrorDetail", "debug": { "code": "word_not_found" } }] }
```

| HTTP 状态 | 错误码 | 原因 |
| --- | --- | --- |
| 400 | `invalid_word` | 精确查询缺少单词、过长或包含控制字符 |
| 400 | `invalid_query` | 前缀建议缺少查询词、过长或包含控制字符 |
| 400 | `invalid_limit` | `limit` 不是 1–50 范围内的整数 |
| 404 | `word_not_found` | 精确查询没有找到词条或可解析的别名 |
| 503 | `dictionary_unavailable` | 词典数据库不可用 |

## 缓存策略

| 接口 | 浏览器缓存 | 共享缓存 |
| --- | --- | --- |
| 精确查询 | 5 分钟 | 1 天 |
| 前缀建议 | 1 分钟 | 1 小时 |

以上缓存头用于成功响应。两个方法都无副作用，也支持 Connect 的 `GET` 形式（例如 `GET /rpc/jadren.v1.DictionaryService/Lookup?connect=v1&encoding=json&message=...`）；缓存头只在使用 `GET` 时生效，`POST` 响应不会被缓存。
