// src/auth/setup/SetupWizard.tsx
import { useState } from "react";
import { ConnectStep } from "./steps/ConnectStep";
import { SecureStep } from "./steps/SecureStep";
import { CurrencyStep } from "./steps/CurrencyStep";
import { AccountStep } from "./steps/AccountStep";
import { STORAGE_KEYS } from "@/lib/auth";

const ALL_STEPS = [
  { id: "connect", label: "Connect", description: "Link your Google Sheet" },
  { id: "secure", label: "Secure", description: "Set up your passkey" },
  { id: "currency", label: "Currency", description: "Choose base currency" },
  { id: "account", label: "Account", description: "Create your first account" },
];

interface Props {
  onComplete: () => void;
}

export function SetupWizard({ onComplete }: Props) {
  const [step, setStep] = useState(0);
  const [hasExistingData, setHasExistingData] = useState(false);
  console.log("🚀 ~ SetupWizard ~ hasExistingData:", { hasExistingData });

  const visibleSteps = hasExistingData
    ? ALL_STEPS.filter((s) => s.id !== "currency" && s.id !== "account")
    : ALL_STEPS;

  const next = (existingData?: boolean) => {
    const newHasExisting = hasExistingData || !!existingData;
    const activeSteps = newHasExisting
      ? ALL_STEPS.filter((s) => s.id !== "currency" && s.id !== "account")
      : ALL_STEPS;

    if (existingData) setHasExistingData(true);

    if (step + 1 >= activeSteps.length) {
      localStorage.setItem(STORAGE_KEYS.SETUP_COMPLETE, "true");
      onComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const currentStep = visibleSteps[step];

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <div className="flex gap-2 mb-1">
            {visibleSteps.map((s, i) => (
              <div
                key={s.id}
                className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-primary" : "bg-muted"}`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Step {step + 1} of {visibleSteps.length} — {currentStep.label}
          </p>
          <h1 className="text-xl font-semibold mt-1">
            {currentStep.description}
          </h1>
        </div>

        {currentStep.id === "connect" && <ConnectStep onNext={next} />}
        {currentStep.id === "secure" && <SecureStep onNext={() => next()} />}
        {currentStep.id === "currency" && (
          <CurrencyStep onNext={() => next()} />
        )}
        {currentStep.id === "account" && <AccountStep onNext={() => next()} />}
      </div>
    </div>
  );
}
