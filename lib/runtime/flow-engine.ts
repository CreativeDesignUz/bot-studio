export type RuntimeCommand = { command: string; response: string };

export function resolveTextFlow(text: string, commands: RuntimeCommand[]) {
  const command = text.trim().split(/\s+/, 1)[0].replace(/^\//, "").split("@")[0].toLowerCase();
  const match = commands.find((item) => item.command.toLowerCase() === command);
  return match?.response ?? null;
}
