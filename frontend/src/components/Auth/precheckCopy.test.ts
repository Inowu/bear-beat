import { describe, expect, it } from "vitest";
import { getPrecheckMessage } from "./precheckCopy";

describe("precheckCopy", () => {
  it("keeps trial messaging for new_account_trial when intent allows trial", () => {
    const message = getPrecheckMessage("new_account_trial", {
      intentMethod: "card",
      intentAllowsTrial: true,
    });

    expect(message).toContain("prueba gratis");
    expect(message).toContain("activar con tarjeta");
  });

  it("switches to no-trial messaging for new_account_trial when intent is paypal", () => {
    const message = getPrecheckMessage("new_account_trial", {
      intentMethod: "paypal",
      intentAllowsTrial: false,
    });

    expect(message).toContain("sin prueba");
    expect(message).toContain("PayPal");
  });

  it("switches to no-trial messaging for welcome_back_trial when intent is spei", () => {
    const message = getPrecheckMessage("welcome_back_trial", {
      intentMethod: "spei",
      intentAllowsTrial: false,
    });

    expect(message).toContain("sin prueba");
    expect(message).toContain("SPEI");
  });
});
