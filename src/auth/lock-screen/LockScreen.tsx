// src/auth/lock-screen/LockScreen.tsx
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Fingerprint, Lock } from "lucide-react";
import { ForgotPasskey } from "./ForgotPasskey";
import { STORAGE_KEYS, sha256, verifyWebAuthn, AuthMethod } from "@/lib/auth";
import { useAuth } from "../AuthContext";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/shared/Logo";

export function LockScreen() {
  const { unlock } = useAuth();
  const method = localStorage.getItem(
    STORAGE_KEYS.AUTH_METHOD,
  ) as AuthMethod | null;
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!method) {
      unlock();
    } else if (method === "webauthn") {
      handleWebAuthn();
    }
  }, []);

  const handleWebAuthn = async () => {
    setLoading(true);
    try {
      const credentialId =
        localStorage.getItem(STORAGE_KEYS.AUTH_CREDENTIAL_ID) ?? "";
      const ok = await verifyWebAuthn(credentialId);
      if (ok) {
        unlock();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePin = async () => {
    const stored = localStorage.getItem(STORAGE_KEYS.AUTH_PIN_HASH) ?? "";
    const hash = await sha256(pin);
    if (hash === stored) {
      unlock();
    } else {
      setError(true);
      setPin("");
      setTimeout(() => setError(false), 600);
    }
  };

  if (showForgot) {
    return (
      <FullScreen>
        <ForgotPasskey onCancel={() => setShowForgot(false)} />
      </FullScreen>
    );
  }

  return (
    <FullScreen>
      <Logo className="size-10 mb-6" />

      <div className="flex items-center gap-2 mb-8 text-muted-foreground">
        <Lock className="size-4" />
        <span className="text-sm">App locked</span>
      </div>

      {method === "webauthn" ? (
        <div className="flex flex-col items-center gap-4">
          <Button
            size="lg"
            onClick={handleWebAuthn}
            disabled={loading}
            className="gap-2"
          >
            <Fingerprint className="size-5" />
            {loading ? "Verifying…" : "Unlock with biometrics"}
          </Button>
          {error && (
            <p className="text-sm text-destructive">
              Authentication failed. Try again.
            </p>
          )}
          <button
            className="text-xs text-muted-foreground underline mt-2"
            onClick={() => setShowForgot(true)}
          >
            Forgot passkey?
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-4 w-full max-w-xs">
          <Input
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setError(false);
              setPin(e.target.value.replace(/\D/g, ""));
            }}
            onKeyDown={(e) => e.key === "Enter" && handlePin()}
            placeholder="Enter PIN"
            className={cn(
              "text-center text-2xl tracking-widest font-mono",
              error && "border-destructive animate-shake",
            )}
            autoFocus
          />
          <Button
            className="w-full"
            onClick={handlePin}
            disabled={pin.length < 4}
          >
            Unlock
          </Button>
          {error && (
            <p className="text-sm text-destructive">Wrong PIN. Try again.</p>
          )}
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => setShowForgot(true)}
          >
            Forgot passkey?
          </button>
        </div>
      )}
    </FullScreen>
  );
}

function FullScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      {children}
    </div>
  );
}
