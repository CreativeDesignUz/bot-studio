import assert from "node:assert/strict";
import test from "node:test";
import { PublicationError, runTelegramPublication } from "../lib/bots/publication";

const base = { token: "secret", name: "Test bot", description: "Description", miniAppUrl: "https://example.com/app", webhookUrl: "https://example.com/hook", runtimeSecret: "runtime" };

test("publication stops on Telegram failure and records only completed steps", async () => {
  const recorded: string[] = [];
  await assert.rejects(runTelegramPublication({ ...base, call: async (_token, method) => { if (method === "setChatMenuButton") throw new Error("Telegram rejected"); }, recordStep: async (step) => { recorded.push(step); } }), (error) => error instanceof PublicationError && error.step === "set_menu_button");
  assert.deepEqual(recorded, ["set_name", "set_description"]);
});
test("retry skips completed publication steps and finishes remaining operations", async () => {
  const methods: string[] = [], recorded: string[] = [];
  await runTelegramPublication({ ...base, completedSteps: ["set_name", "set_description"], call: async (_token, method) => { methods.push(method); }, recordStep: async (step) => { recorded.push(step); } });
  assert.deepEqual(methods, ["setChatMenuButton", "setWebhook"]);
  assert.deepEqual(recorded, ["set_menu_button", "set_webhook"]);
});
