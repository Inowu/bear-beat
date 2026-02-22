import { describe, expect, it } from "vitest";
import { resolveTrialEmailGateDecision } from "./trialEmailGateDecision";

describe("trialEmailGateDecision", () => {
  it("maps login decisions to /auth preserving from and prefilled email", () => {
    const decision = resolveTrialEmailGateDecision({
      result: {
        nextAction: "login",
        accountState: "existing_active",
        trialState: "eligible",
        trial: { enabled: true, days: 7, gb: 100 },
        messageKey: "welcome_back_trial",
      },
      from: "/comprar?priceId=123&entry=fastlane",
      email: "dj@example.com",
    });

    expect(decision.mode).toBe("navigate");
    if (decision.mode !== "navigate") return;
    expect(decision.to).toBe("/auth");
    expect(decision.state.from).toBe("/comprar?priceId=123&entry=fastlane");
    expect(decision.state.prefillEmail).toBe("dj@example.com");
    expect(decision.state.precheckMessageKey).toBe("welcome_back_trial");
    expect(decision.state.precheckTrial).toEqual({
      enabled: true,
      days: 7,
      gb: 100,
      trialState: "eligible",
      accountState: "existing_active",
    });
  });

  it("maps register decisions to /auth/registro preserving from and prefilled email", () => {
    const decision = resolveTrialEmailGateDecision({
      result: {
        nextAction: "register",
        accountState: "new",
        trialState: "unknown_for_new",
        trial: { enabled: true, days: 7, gb: 100 },
        messageKey: "new_account_trial",
      },
      from: "/planes?entry=compare",
      email: "new@example.com",
    });

    expect(decision.mode).toBe("navigate");
    if (decision.mode !== "navigate") return;
    expect(decision.to).toBe("/auth/registro");
    expect(decision.state.from).toBe("/planes?entry=compare");
    expect(decision.state.prefillEmail).toBe("new@example.com");
    expect(decision.state.precheckMessageKey).toBe("new_account_trial");
    expect(decision.state.precheckTrial).toEqual({
      enabled: true,
      days: 7,
      gb: 100,
      trialState: "unknown_for_new",
      accountState: "new",
    });
  });

  it("returns support mode when backend requires support follow-up", () => {
    const decision = resolveTrialEmailGateDecision({
      result: {
        nextAction: "support",
        accountState: "existing_deleted",
        trialState: "ineligible",
        trial: { enabled: true, days: 7, gb: 100 },
        messageKey: "deleted_account",
      },
      from: "/planes?entry=compare",
      email: "deleted@example.com",
    });

    expect(decision).toEqual({
      mode: "support",
      messageKey: "deleted_account",
    });
  });

  it("does not leak email in URL path/query for navigation decisions", () => {
    const decision = resolveTrialEmailGateDecision({
      result: {
        nextAction: "login",
        accountState: "existing_active",
        trialState: "ineligible",
        trial: { enabled: true, days: 7, gb: 100 },
        messageKey: "welcome_back_no_trial",
      },
      from: "/comprar?priceId=999&method=paypal",
      email: "private@example.com",
    });

    expect(decision.mode).toBe("navigate");
    if (decision.mode !== "navigate") return;
    expect(decision.to.includes("@")).toBe(false);
    expect(decision.to.includes("?")).toBe(false);
    expect(decision.state.from).toBe("/comprar?priceId=999&method=paypal");
    expect(decision.state.prefillEmail).toBe("private@example.com");
    expect(decision.state.precheckTrial.trialState).toBe("ineligible");
    expect(decision.state.precheckTrial.accountState).toBe("existing_active");
  });
});
