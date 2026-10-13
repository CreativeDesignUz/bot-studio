export type HomeButton = { label?: string; action?: string };
export type BotSettings = Record<string, unknown> & { home_buttons?: HomeButton[] };

export function mergeHomeButtons(settings: BotSettings | null | undefined, homeButtons: HomeButton[] | undefined) {
  if (homeButtons === undefined) return settings ?? {};
  return { ...(settings ?? {}), home_buttons: homeButtons };
}
