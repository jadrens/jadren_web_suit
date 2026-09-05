export type ShellTokenType =
  | "comment"
  | "string"
  | "variable"
  | "option"
  | "command"
  | "keyword"
  | "operator"
  | "number"
  | "permission"
  | "timestamp"
  | "date"
  | "path"
  | "prompt"
  | "status"
  | "plain";

export interface ShellToken {
  type: ShellTokenType;
  text: string;
}

const shellKeywords = new Set([
  "case", "do", "done", "elif", "else", "esac", "fi", "for", "function",
  "if", "in", "select", "then", "time", "until", "while",
]);

const commandWrappers = new Set([
  "builtin", "command", "doas", "env", "exec", "nohup", "sudo", "time", "xargs",
]);

const statuses = new Set([
  "active", "dead", "disabled", "enabled", "error", "failed", "inactive", "loaded",
  "not-found", "ok", "running", "stopped", "success", "warning",
]);

function classifyWord(word: string, expectsCommand: boolean): ShellTokenType {
  if (/^[bcdlps-][rwxStTs-]{9}[+.@]?$/.test(word)) return "permission";
  if (/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(word)) return "timestamp";
  if (/^\d{4}-\d{2}-\d{2}$/.test(word)) return "date";
  if (/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test(word)) return "date";
  if (/^(?:\$[A-Za-z_][A-Za-z0-9_]*|\$\{[^}]+\})$/.test(word)) return "variable";
  if (/^[A-Za-z_][A-Za-z0-9_]*=.*/.test(word)) return "variable";
  if (/^--?[A-Za-z0-9]/.test(word)) return "option";
  if (/^(?:~|\.{1,2}|\/)(?:\/|[^\s])*/.test(word)) return "path";
  if (shellKeywords.has(word)) return "keyword";
  if (statuses.has(word.toLowerCase())) return "status";
  if (/^\d+(?:\.\d+)?(?:[KMGTPE]i?B?)?$/.test(word)) return "number";
  if (expectsCommand) return "command";
  return "plain";
}

export function tokenizeShell(code: string): ShellToken[] {
  const tokens: ShellToken[] = [];
  let i = 0;
  let lineStart = true;
  let expectsCommand = true;

  while (i < code.length) {
    if (code[i] === "\n") {
      tokens.push({ type: "plain", text: "\n" });
      i++;
      lineStart = true;
      expectsCommand = true;
      continue;
    }

    if (lineStart) {
      const prompt = code.slice(i).match(/^(?:(?:[\w.-]+@[\w.-]+(?::[^\s#$]+)?|[^\s#$]+)[$#]|\$)(?=\s)/);
      if (prompt) {
        tokens.push({ type: "prompt", text: prompt[0] });
        i += prompt[0].length;
        lineStart = false;
        expectsCommand = true;
        continue;
      }
    }

    if (code[i] === " " || code[i] === "\t") {
      let end = i + 1;
      while (end < code.length && (code[end] === " " || code[end] === "\t")) end++;
      tokens.push({ type: "plain", text: code.slice(i, end) });
      i = end;
      continue;
    }

    if (code[i] === "#" && (lineStart || /\s/.test(code[i - 1] ?? ""))) {
      let end = code.indexOf("\n", i);
      if (end === -1) end = code.length;
      tokens.push({ type: "comment", text: code.slice(i, end) });
      i = end;
      lineStart = false;
      continue;
    }

    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      let end = i + 1;
      while (end < code.length && code[end] !== quote) {
        if (quote === '"' && code[end] === "\\") end++;
        end++;
      }
      if (end < code.length) end++;
      tokens.push({ type: "string", text: code.slice(i, end) });
      i = end;
      lineStart = false;
      expectsCommand = false;
      continue;
    }

    const variable = code.slice(i).match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*|\{[^}\n]+\}|[?#@*!$0-9-])/);
    if (variable) {
      tokens.push({ type: "variable", text: variable[0] });
      i += variable[0].length;
      lineStart = false;
      continue;
    }

    const operator = code.slice(i).match(/^(?:&&|\|\||;;|;&|;;&|>>|<<|[|;&()<>])/);
    if (operator) {
      tokens.push({ type: "operator", text: operator[0] });
      i += operator[0].length;
      lineStart = false;
      if (/^(?:&&|\|\||\||;|;;|;&|;;&)$/.test(operator[0])) expectsCommand = true;
      continue;
    }

    let end = i + 1;
    while (end < code.length && !/[\s'"|;&()<>]/.test(code[end])) end++;
    const word = code.slice(i, end);
    const type = classifyWord(word, expectsCommand);
    tokens.push({ type, text: word });
    i = end;
    lineStart = false;

    if (type === "command") {
      expectsCommand = commandWrappers.has(word);
    } else if (type !== "variable" || !word.includes("=")) {
      expectsCommand = false;
    }
  }

  return tokens;
}
