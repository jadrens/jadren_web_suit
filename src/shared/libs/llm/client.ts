/** Browser-side unified client for locally stored LLM API profiles. */
export const LLM_PROFILES_STORAGE_KEY = "llm-api-profiles";
export const LLM_MODELS_STORAGE_KEY = "llm-api-models";

export type LlmApiType = "claude" | "openai-responses" | "openai-completions";
export interface LlmProfile { id: string; name: string; type: LlmApiType; token: string; baseUrl: string }
export interface LlmModelProfile { id: string; name: string; modelId: string; providerId: string }
export type LlmRole = "user" | "assistant" | "system" | "tool";
export interface LlmMessage { role: LlmRole; content: string; toolCallId?: string; toolCalls?: LlmToolCall[]; providerData?: unknown }
export interface LlmTool {
  name: string;
  description?: string;
  parameters: Record<string, unknown>;
  strict?: boolean;
}
export interface LlmFunction<TArgs extends Record<string, unknown> = Record<string, unknown>, TResult = unknown> extends LlmTool {
  execute: (args: TArgs, context: { callId: string; signal?: AbortSignal }) => TResult | Promise<TResult>;
}
export interface LlmToolCall { id: string; name: string; arguments: Record<string, unknown>; rawArguments: string }
export interface LlmUsage { inputTokens?: number; outputTokens?: number; reasoningTokens?: number; totalTokens?: number }
export type ReasoningEffort = "none" | "minimal" | "low" | "medium" | "high" | "xhigh";

interface LlmRequestBase {
  profile: string | LlmProfile;
  model: string;
  messages: LlmMessage[];
  systemPrompt?: string;
  tools?: LlmTool[];
  toolChoice?: "auto" | "none" | "required" | { name: string };
  maxTokens?: number;
  thinkingBudget?: number;
  reasoningEffort?: ReasoningEffort;
  temperature?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}
export interface LlmRequest extends LlmRequestBase { stream?: false }
export interface LlmStreamRequest extends LlmRequestBase { stream: true }
export interface LlmResponse { id?: string; model?: string; text: string; thinking: string; toolCalls: LlmToolCall[]; finishReason?: string; usage?: LlmUsage; raw: unknown }
export type LlmStreamEvent =
  | { type: "text_delta"; text: string }
  | { type: "thinking_delta"; thinking: string }
  | { type: "tool_call_delta"; id: string; name?: string; argumentsDelta: string }
  | { type: "tool_call"; toolCall: LlmToolCall }
  | { type: "tool_execution_start"; toolCall: LlmToolCall }
  | { type: "tool_execution_result"; toolCall: LlmToolCall; result: unknown }
  | { type: "done"; response: LlmResponse };

export function getLlmProfiles(): LlmProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const profiles = JSON.parse(localStorage.getItem(LLM_PROFILES_STORAGE_KEY) || "[]");
    return Array.isArray(profiles) ? profiles : [];
  } catch { return []; }
}

export function getLlmProfile(profile: string | LlmProfile): LlmProfile {
  if (typeof profile !== "string") return profile;
  const found = getLlmProfiles().find((item) => item.id === profile || item.name === profile);
  if (!found) throw new Error(`LLM profile not found: ${profile}`);
  return found;
}

export function getLlmModels(): LlmModelProfile[] {
  if (typeof window === "undefined") return [];
  try {
    const models = JSON.parse(localStorage.getItem(LLM_MODELS_STORAGE_KEY) || "[]");
    return Array.isArray(models) ? models : [];
  } catch { return []; }
}

export function getLlmModel(model: string | LlmModelProfile): LlmModelProfile {
  if (typeof model !== "string") return model;
  const found = getLlmModels().find((item) => item.id === model || item.name === model || item.modelId === model);
  if (!found) throw new Error(`LLM model not found: ${model}`);
  return found;
}

export function resolveLlmEndpoint(type: LlmApiType, inputUrl: string) {
  let base = inputUrl.trim().replace(/\/+$/, "");
  // Accept either a provider base URL or a complete endpoint and normalize it.
  base = base.replace(/\/(?:chat\/completions|responses|messages)$/i, "").replace(/\/+$/, "");
  if (!/\/v1$/i.test(base)) base += "/v1";
  if (type === "claude") return `${base}/messages`;
  if (type === "openai-responses") return `${base}/responses`;
  return `${base}/chat/completions`;
}

function safeJson(value: string) {
  try { return JSON.parse(value) as Record<string, unknown>; } catch { return {}; }
}

function makeRequest(profile: LlmProfile, options: LlmRequestBase, stream: boolean) {
  const { model, messages, systemPrompt, tools, maxTokens, thinkingBudget, reasoningEffort, temperature } = options;
  if (profile.type === "claude") {
    const system = [systemPrompt, ...messages.filter((m) => m.role === "system").map((m) => m.content)].filter(Boolean).join("\n\n");
    const body: Record<string, unknown> = {
      model, stream, max_tokens: maxTokens ?? 4096,
      messages: messages.filter((m) => m.role !== "system").map((m) => m.role === "tool"
        ? { role: "user", content: [{ type: "tool_result", tool_use_id: m.toolCallId, content: m.content }] }
        : m.toolCalls?.length ? { role: "assistant", content: (m.providerData as any)?.content || [...(m.content ? [{ type: "text", text: m.content }] : []), ...m.toolCalls.map((call) => ({ type: "tool_use", id: call.id, name: call.name, input: call.arguments }))] }
        : { role: m.role, content: m.content }),
    };
    if (system) body.system = system;
    if (temperature !== undefined) body.temperature = temperature;
    if (thinkingBudget) body.thinking = { type: "enabled", budget_tokens: thinkingBudget };
    else if (reasoningEffort && reasoningEffort !== "none") {
      body.thinking = { type: "adaptive" };
      body.output_config = { effort: reasoningEffort === "minimal" ? "low" : reasoningEffort };
    }
    if (tools?.length) body.tools = tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.parameters, strict: tool.strict }));
    if (options.toolChoice) body.tool_choice = typeof options.toolChoice === "object" ? { type: "tool", name: options.toolChoice.name } : { type: options.toolChoice === "required" ? "any" : options.toolChoice };
    return { body, headers: { "x-api-key": profile.token, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", "content-type": "application/json" } };
  }
  if (profile.type === "openai-responses") {
    const body: Record<string, unknown> = {
      model, stream, input: messages.flatMap((m) => m.role === "tool"
        ? [{ type: "function_call_output", call_id: m.toolCallId, output: m.content }]
        : m.toolCalls?.length ? (m.providerData as any)?.output || [...(m.content ? [{ role: "assistant", content: m.content }] : []), ...m.toolCalls.map((call) => ({ type: "function_call", call_id: call.id, name: call.name, arguments: call.rawArguments }))]
        : [{ role: m.role, content: m.content }]),
    };
    if (systemPrompt) body.instructions = systemPrompt;
    if (maxTokens !== undefined) body.max_output_tokens = maxTokens;
    if (temperature !== undefined) body.temperature = temperature;
    if (reasoningEffort && reasoningEffort !== "none") body.reasoning = { effort: reasoningEffort, summary: "auto" };
    if (tools?.length) body.tools = tools.map((tool) => ({ type: "function", name: tool.name, description: tool.description, parameters: tool.parameters, strict: tool.strict ?? true }));
    if (options.toolChoice) body.tool_choice = typeof options.toolChoice === "object" ? { type: "function", name: options.toolChoice.name } : options.toolChoice;
    return { body, headers: { authorization: `Bearer ${profile.token}`, "content-type": "application/json" } };
  }
  const body: Record<string, unknown> = { model, stream, messages: [...(systemPrompt ? [{ role: "system", content: systemPrompt }] : []), ...messages.map((m) => m.role === "tool" ? { role: "tool", content: m.content, tool_call_id: m.toolCallId } : m.toolCalls?.length ? { role: "assistant", content: m.content || null, tool_calls: m.toolCalls.map((call) => ({ id: call.id, type: "function", function: { name: call.name, arguments: call.rawArguments } })) } : { role: m.role, content: m.content })] };
  if (maxTokens !== undefined) body.max_completion_tokens = maxTokens;
  if (temperature !== undefined) body.temperature = temperature;
  if (reasoningEffort && reasoningEffort !== "none") body.reasoning_effort = reasoningEffort;
  if (tools?.length) body.tools = tools.map((tool) => ({ type: "function", function: { name: tool.name, description: tool.description, parameters: tool.parameters, strict: tool.strict } }));
  if (options.toolChoice) body.tool_choice = typeof options.toolChoice === "object" ? { type: "function", function: { name: options.toolChoice.name } } : options.toolChoice;
  if (stream) body.stream_options = { include_usage: true };
  return { body, headers: { authorization: `Bearer ${profile.token}`, "content-type": "application/json" } };
}

async function request(profile: LlmProfile, options: LlmRequestBase, stream: boolean) {
  const built = makeRequest(profile, options, stream);
  const response = await fetch(resolveLlmEndpoint(profile.type, profile.baseUrl), { method: "POST", headers: { ...built.headers, ...options.headers }, body: JSON.stringify(built.body), signal: options.signal });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`LLM API ${response.status}: ${detail || response.statusText}`);
  }
  return response;
}

function parseNonStream(profile: LlmProfile, raw: any): LlmResponse {
  if (profile.type === "claude") {
    const content = raw.content || [];
    return { id: raw.id, model: raw.model, text: content.filter((x: any) => x.type === "text").map((x: any) => x.text).join(""), thinking: content.filter((x: any) => x.type === "thinking").map((x: any) => x.thinking).join(""), toolCalls: content.filter((x: any) => x.type === "tool_use").map((x: any) => ({ id: x.id, name: x.name, arguments: x.input || {}, rawArguments: JSON.stringify(x.input || {}) })), finishReason: raw.stop_reason, usage: { inputTokens: raw.usage?.input_tokens, outputTokens: raw.usage?.output_tokens }, raw };
  }
  if (profile.type === "openai-responses") {
    const output = raw.output || [];
    const reasoning = output.filter((x: any) => x.type === "reasoning").flatMap((x: any) => x.summary || x.content || []).map((x: any) => x.text || "").join("");
    return { id: raw.id, model: raw.model, text: raw.output_text || output.flatMap((x: any) => x.content || []).filter((x: any) => x.type === "output_text").map((x: any) => x.text).join(""), thinking: reasoning, toolCalls: output.filter((x: any) => x.type === "function_call").map((x: any) => ({ id: x.call_id || x.id, name: x.name, arguments: safeJson(x.arguments || "{}"), rawArguments: x.arguments || "{}" })), finishReason: raw.status, usage: { inputTokens: raw.usage?.input_tokens, outputTokens: raw.usage?.output_tokens, reasoningTokens: raw.usage?.output_tokens_details?.reasoning_tokens, totalTokens: raw.usage?.total_tokens }, raw };
  }
  const choice = raw.choices?.[0] || {};
  const message = choice.message || {};
  return { id: raw.id, model: raw.model, text: message.content || "", thinking: message.reasoning_content || "", toolCalls: (message.tool_calls || []).map((x: any) => ({ id: x.id, name: x.function?.name, arguments: safeJson(x.function?.arguments || "{}"), rawArguments: x.function?.arguments || "{}" })), finishReason: choice.finish_reason, usage: { inputTokens: raw.usage?.prompt_tokens, outputTokens: raw.usage?.completion_tokens, reasoningTokens: raw.usage?.completion_tokens_details?.reasoning_tokens, totalTokens: raw.usage?.total_tokens }, raw };
}

async function* readSse(response: Response) {
  if (!response.body) throw new Error("LLM API returned no stream body");
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const blocks = buffer.split(/\r?\n\r?\n/); buffer = blocks.pop() || "";
    for (const block of blocks) {
      const data = block.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).trim()).join("\n");
      if (data && data !== "[DONE]") yield JSON.parse(data);
    }
    if (done) break;
  }
}

async function* streamLlm(options: LlmStreamRequest): AsyncGenerator<LlmStreamEvent> {
  const profile = getLlmProfile(options.profile);
  const response = await request(profile, options, true);
  let text = "", thinking = "", rawFinal: any = null;
  let usage: LlmUsage | undefined;
  const calls = new Map<string, { id: string; name: string; args: string }>();
  const claudeBlocks = new Map<number, any>();
  for await (const event of readSse(response)) {
    if (profile.type === "claude") {
      if (event.type === "message_start") { rawFinal = event.message; usage = { inputTokens: event.message?.usage?.input_tokens, outputTokens: event.message?.usage?.output_tokens }; }
      if (event.type === "content_block_start") { claudeBlocks.set(event.index, { ...event.content_block }); if (event.content_block?.type === "tool_use") calls.set(String(event.index), { id: event.content_block.id, name: event.content_block.name, args: "" }); }
      if (event.type === "content_block_delta" && event.delta?.type === "text_delta") { text += event.delta.text; const block = claudeBlocks.get(event.index); if (block) block.text = (block.text || "") + event.delta.text; yield { type: "text_delta", text: event.delta.text }; }
      if (event.type === "content_block_delta" && event.delta?.type === "thinking_delta") { thinking += event.delta.thinking; const block = claudeBlocks.get(event.index); if (block) block.thinking = (block.thinking || "") + event.delta.thinking; yield { type: "thinking_delta", thinking: event.delta.thinking }; }
      if (event.type === "content_block_delta" && event.delta?.type === "signature_delta") { const block = claudeBlocks.get(event.index); if (block) block.signature = (block.signature || "") + event.delta.signature; }
      if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") { const call = calls.get(String(event.index)); if (call) { call.args += event.delta.partial_json; yield { type: "tool_call_delta", id: call.id, name: call.name, argumentsDelta: event.delta.partial_json }; } }
      if (event.type === "message_delta") { rawFinal = { ...(rawFinal || {}), ...event.delta }; usage = { ...usage, outputTokens: event.usage?.output_tokens ?? usage?.outputTokens }; }
    } else if (profile.type === "openai-responses") {
      if (event.type === "response.output_text.delta") { text += event.delta; yield { type: "text_delta", text: event.delta }; }
      if (event.type === "response.reasoning_summary_text.delta" || event.type === "response.reasoning_text.delta") { thinking += event.delta; yield { type: "thinking_delta", thinking: event.delta }; }
      if (event.type === "response.output_item.added" && event.item?.type === "function_call") calls.set(String(event.output_index), { id: event.item.call_id || event.item.id, name: event.item.name, args: "" });
      if (event.type === "response.function_call_arguments.delta") { const call = calls.get(String(event.output_index)); if (call) { call.args += event.delta; yield { type: "tool_call_delta", id: call.id, name: call.name, argumentsDelta: event.delta }; } }
      if (event.type === "response.completed") { rawFinal = event.response; usage = { inputTokens: event.response?.usage?.input_tokens, outputTokens: event.response?.usage?.output_tokens, reasoningTokens: event.response?.usage?.output_tokens_details?.reasoning_tokens, totalTokens: event.response?.usage?.total_tokens }; }
    } else {
      const choice = event.choices?.[0]; const delta = choice?.delta;
      if (delta?.content) { text += delta.content; yield { type: "text_delta", text: delta.content }; }
      if (delta?.reasoning_content) { thinking += delta.reasoning_content; yield { type: "thinking_delta", thinking: delta.reasoning_content }; }
      for (const part of delta?.tool_calls || []) { const key = String(part.index); const call = calls.get(key) || { id: part.id || key, name: part.function?.name || "", args: "" }; call.id = part.id || call.id; call.name = part.function?.name || call.name; call.args += part.function?.arguments || ""; calls.set(key, call); yield { type: "tool_call_delta", id: call.id, name: call.name, argumentsDelta: part.function?.arguments || "" }; }
      if (event.usage) { rawFinal = event; usage = { inputTokens: event.usage.prompt_tokens, outputTokens: event.usage.completion_tokens, reasoningTokens: event.usage.completion_tokens_details?.reasoning_tokens, totalTokens: event.usage.total_tokens }; }
    }
  }
  if (profile.type === "claude") rawFinal = { ...(rawFinal || {}), model: options.model, content: [...claudeBlocks.entries()].sort(([a], [b]) => a - b).map(([index, block]) => block.type === "tool_use" ? { ...block, input: safeJson(calls.get(String(index))?.args || "{}") } : block) };
  const toolCalls = [...calls.values()].map((call) => ({ id: call.id, name: call.name, arguments: safeJson(call.args), rawArguments: call.args }));
  for (const toolCall of toolCalls) yield { type: "tool_call", toolCall };
  yield { type: "done", response: { id: rawFinal?.id, model: rawFinal?.model || options.model, text, thinking, toolCalls, finishReason: rawFinal?.stop_reason || rawFinal?.status, usage, raw: rawFinal } };
}

export function callLlm(options: LlmStreamRequest): AsyncGenerator<LlmStreamEvent>;
export function callLlm(options: LlmRequest): Promise<LlmResponse>;
export function callLlm(options: LlmRequest | LlmStreamRequest): Promise<LlmResponse> | AsyncGenerator<LlmStreamEvent> {
  if (options.stream) return streamLlm(options);
  return (async () => {
    const profile = getLlmProfile(options.profile);
    const response = await request(profile, options, false);
    return parseNonStream(profile, await response.json());
  })();
}

export interface LlmClientOptions {
  profile: string | LlmProfile;
  model?: string;
  maxToolRounds?: number;
}
export interface LlmRunOptions extends Omit<LlmRequest, "profile" | "tools" | "model"> {
  model?: string;
  tools?: LlmFunction[];
  maxToolRounds?: number;
}
export interface LlmRunStreamOptions extends Omit<LlmStreamRequest, "profile" | "tools" | "stream" | "model"> {
  model?: string;
  tools?: LlmFunction[];
  maxToolRounds?: number;
}

function stringifyToolResult(value: unknown) {
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

/**
 * High-level client that automatically executes local tool functions.
 * API tokens are read from the selected browser-local profile at call time.
 */
export class LlmClient {
  constructor(private readonly config: LlmClientOptions) {}

  static fromModel(model: string | LlmModelProfile, options: { maxToolRounds?: number } = {}) {
    const selected = getLlmModel(model);
    return new LlmClient({ profile: selected.providerId, model: selected.modelId, ...options });
  }

  private model(override?: string) {
    const model = override || this.config.model;
    if (!model) throw new Error("An LLM model is required");
    return model;
  }

  async call(options: LlmRunOptions): Promise<LlmResponse> {
    const functions = options.tools || [];
    const messages = [...options.messages];
    const maxRounds = options.maxToolRounds ?? this.config.maxToolRounds ?? 8;
    for (let round = 0; round <= maxRounds; round++) {
      const response = await callLlm({ ...options, profile: this.config.profile, model: this.model(options.model), messages, tools: functions.map(({ execute: _execute, ...tool }) => tool) });
      if (!response.toolCalls.length) return response;
      if (round === maxRounds) throw new Error(`Maximum tool rounds exceeded (${maxRounds})`);
      messages.push({ role: "assistant", content: response.text, toolCalls: response.toolCalls, providerData: response.raw });
      for (const toolCall of response.toolCalls) {
        const fn = functions.find((tool) => tool.name === toolCall.name);
        if (!fn) throw new Error(`No function provided for tool: ${toolCall.name}`);
        const result = await fn.execute(toolCall.arguments, { callId: toolCall.id, signal: options.signal });
        messages.push({ role: "tool", toolCallId: toolCall.id, content: stringifyToolResult(result) });
      }
    }
    throw new Error("Unreachable tool loop state");
  }

  async *stream(options: LlmRunStreamOptions): AsyncGenerator<LlmStreamEvent> {
    const functions = options.tools || [];
    const messages = [...options.messages];
    const maxRounds = options.maxToolRounds ?? this.config.maxToolRounds ?? 8;
    const aggregateUsage: LlmUsage = {};
    for (let round = 0; round <= maxRounds; round++) {
      let completed: LlmResponse | null = null;
      const events = callLlm({ ...options, stream: true, profile: this.config.profile, model: this.model(options.model), messages, tools: functions.map(({ execute: _execute, ...tool }) => tool) });
      for await (const event of events) {
        if (event.type === "done") {
          completed = event.response;
          for (const key of ["inputTokens", "outputTokens", "reasoningTokens", "totalTokens"] as const) if (event.response.usage?.[key] !== undefined) aggregateUsage[key] = (aggregateUsage[key] || 0) + (event.response.usage[key] || 0);
        }
        else yield event;
      }
      if (!completed) throw new Error("LLM stream ended without a final response");
      if (!completed.toolCalls.length) { completed.usage = aggregateUsage; yield { type: "done", response: completed }; return; }
      if (round === maxRounds) throw new Error(`Maximum tool rounds exceeded (${maxRounds})`);
      messages.push({ role: "assistant", content: completed.text, toolCalls: completed.toolCalls, providerData: completed.raw });
      for (const toolCall of completed.toolCalls) {
        const fn = functions.find((tool) => tool.name === toolCall.name);
        if (!fn) throw new Error(`No function provided for tool: ${toolCall.name}`);
        yield { type: "tool_execution_start", toolCall };
        const result = await fn.execute(toolCall.arguments, { callId: toolCall.id, signal: options.signal });
        yield { type: "tool_execution_result", toolCall, result };
        messages.push({ role: "tool", toolCallId: toolCall.id, content: stringifyToolResult(result) });
      }
    }
  }
}
