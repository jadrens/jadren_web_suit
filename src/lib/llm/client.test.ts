import { afterEach, describe, expect, test } from "bun:test";
import { callLlm, LlmClient, type LlmProfile } from "./client";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

function sse(events: unknown[]) {
  return new Response(events.map(event => `data: ${JSON.stringify(event)}\n\n`).join("") + "data: [DONE]\n\n", {
    headers: { "content-type": "text/event-stream" },
  });
}

describe("DeepSeek tool requests", () => {
  test("omits unsupported tool_choice and passes reasoning through retries and tool rounds", async () => {
    const profile: LlmProfile = { id: "deepseek", name: "DeepSeek", type: "openai-completions", token: "test", baseUrl: "https://api.deepseek.com" };
    const requests: Array<{ tool_choice?: unknown; messages: Array<{ role: string; reasoning_content?: string; tool_calls?: unknown[] }> }> = [];
    const responses = [
      sse([{ choices: [{ delta: { reasoning_content: "first thought" } }] }, { choices: [{ delta: { content: "I should use a tool" } }] }]),
      sse([{ choices: [{ delta: { reasoning_content: "second thought" } }] }, { choices: [{ delta: { tool_calls: [{ index: 0, id: "call-1", function: { name: "complete", arguments: '{"value":"done"}' } }] } }] }]),
      sse([{ choices: [{ delta: { content: "Finished" } }] }]),
    ];
    globalThis.fetch = Object.assign(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      return responses[requests.length - 1];
    }, { preconnect: originalFetch.preconnect });

    let completed = false;
    const client = new LlmClient({ profile, model: "deepseek-reasoner" });
    for await (const event of client.stream({
      messages: [{ role: "user", content: "Complete this entry" }],
      tools: [{ name: "complete", parameters: { type: "object", properties: { value: { type: "string" } }, required: ["value"] }, execute: () => { completed = true; return { accepted: true }; } }],
      isComplete: () => completed,
      maxIncompleteRetries: 1,
    })) { if (event.type === "done") break; }

    expect(completed).toBe(true);
    expect(requests).toHaveLength(3);
    expect(requests.every(request => !("tool_choice" in request))).toBe(true);
    expect(requests[1].messages.find(message => message.role === "assistant")?.reasoning_content).toBe("first thought");
    expect(requests[2].messages.find(message => message.tool_calls)?.reasoning_content).toBe("second thought");
  });

  test("keeps required tool choice for other OpenAI compatible providers", async () => {
    const profile: LlmProfile = { id: "other", name: "Other", type: "openai-completions", token: "test", baseUrl: "https://example.com" };
    let toolChoice: unknown;
    globalThis.fetch = Object.assign(async (_input: RequestInfo | URL, init?: RequestInit) => {
      toolChoice = JSON.parse(String(init?.body)).tool_choice;
      return Response.json({ choices: [{ message: { content: "done" } }] });
    }, { preconnect: originalFetch.preconnect });
    await callLlm({ profile, model: "other-model", messages: [{ role: "user", content: "test" }], toolChoice: "required" });
    expect(toolChoice).toBe("required");
  });

  test("replays reasoning items on a Responses API retry without forcing tool choice", async () => {
    const profile: LlmProfile = { id: "deepseek-responses", name: "DeepSeek Responses", type: "openai-responses", token: "test", baseUrl: "https://api.deepseek.com" };
    const requests: Array<{ tool_choice?: unknown; input: Array<{ type?: string; role?: string }> }> = [];
    const responses = [
      sse([{ type: "response.completed", response: { status: "completed", output: [
        { type: "reasoning", content: [{ type: "reasoning_text", text: "first thought" }] },
        { type: "message", role: "assistant", content: [{ type: "output_text", text: "I should use a tool" }] },
      ] } }]),
      sse([
        { type: "response.output_item.added", output_index: 0, item: { type: "function_call", call_id: "call-1", name: "complete" } },
        { type: "response.function_call_arguments.delta", output_index: 0, delta: '{"value":"done"}' },
        { type: "response.completed", response: { status: "completed", output: [{ type: "function_call", call_id: "call-1", name: "complete", arguments: '{"value":"done"}' }] } },
      ]),
      sse([{ type: "response.completed", response: { status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "Finished" }] }] } }]),
    ];
    globalThis.fetch = Object.assign(async (_input: RequestInfo | URL, init?: RequestInit) => {
      requests.push(JSON.parse(String(init?.body)));
      return responses[requests.length - 1];
    }, { preconnect: originalFetch.preconnect });

    let completed = false;
    const client = new LlmClient({ profile, model: "deepseek-flash" });
    for await (const event of client.stream({
      messages: [{ role: "user", content: "Complete this entry" }],
      tools: [{ name: "complete", parameters: { type: "object", properties: { value: { type: "string" } }, required: ["value"] }, execute: () => { completed = true; return { accepted: true }; } }],
      isComplete: () => completed,
      maxIncompleteRetries: 1,
    })) { if (event.type === "done") break; }

    expect(completed).toBe(true);
    expect(requests).toHaveLength(3);
    expect(requests.every(request => !("tool_choice" in request))).toBe(true);
    expect(requests[1].input.some(item => item.type === "reasoning")).toBe(true);
    expect(requests[2].input.some(item => item.type === "function_call")).toBe(true);
    expect(requests[2].input.some(item => item.type === "function_call_output")).toBe(true);
  });
});
