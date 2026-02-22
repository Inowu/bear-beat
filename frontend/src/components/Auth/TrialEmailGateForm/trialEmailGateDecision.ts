import type {
  PrecheckIneligibleReason,
  PrecheckMessageKey,
} from "../precheckCopy";

export type TrialEmailGatePrecheckTrial = {
  enabled: boolean;
  days: number;
  gb: number;
  trialState: "eligible" | "ineligible" | "unknown_for_new";
  accountState: "new" | "existing_active" | "existing_blocked" | "existing_deleted";
};

export type TrialEmailGateApiResult = {
  nextAction: "login" | "register" | "support";
  accountState: "new" | "existing_active" | "existing_blocked" | "existing_deleted";
  trialState: "eligible" | "ineligible" | "unknown_for_new";
  trial: { enabled: boolean; days: number; gb: number };
  messageKey: PrecheckMessageKey;
  ineligibleReason?: PrecheckIneligibleReason | null;
};

export type TrialEmailGateNavigationDecision =
  | {
      mode: "navigate";
      to: "/auth" | "/auth/registro";
      state: {
        from: string;
        prefillEmail: string;
        precheckMessageKey: PrecheckMessageKey;
        precheckTrial: TrialEmailGatePrecheckTrial;
        precheckIneligibleReason: PrecheckIneligibleReason | null;
      };
    }
  | {
      mode: "support";
      messageKey: PrecheckMessageKey;
    };

export function resolveTrialEmailGateDecision(input: {
  result: TrialEmailGateApiResult;
  from: string;
  email: string;
}): TrialEmailGateNavigationDecision {
  const { result, from, email } = input;
  if (result.nextAction === "support") {
    return {
      mode: "support",
      messageKey: result.messageKey,
    };
  }

  return {
    mode: "navigate",
    to: result.nextAction === "login" ? "/auth" : "/auth/registro",
    state: {
      from,
      prefillEmail: email,
      precheckMessageKey: result.messageKey,
      precheckTrial: {
        enabled: Boolean(result.trial?.enabled),
        days: Number(result.trial?.days ?? 0),
        gb: Number(result.trial?.gb ?? 0),
        trialState: result.trialState,
        accountState: result.accountState,
      },
      precheckIneligibleReason: result.ineligibleReason ?? null,
    },
  };
}
