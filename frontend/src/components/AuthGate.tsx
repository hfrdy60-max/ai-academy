import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getCachedAccount, getCurrentAccount, getSessionToken } from "../services/accountService";

export default function AuthGate() {
  const location = useLocation();
  const [state, setState] = useState<"checking" | "valid" | "invalid">("checking");
  useEffect(() => {
    let active = true;
    if (!getSessionToken()) { setState("invalid"); return; }
    void getCurrentAccount().then(() => { if (active) setState("valid"); })
      .catch(() => {
        // Preserve access to locally cached lessons when the network or Worker is unavailable.
        if (active) setState(getCachedAccount() ? "valid" : "invalid");
      });
    return () => { active = false; };
  }, []);
  if (state === "checking") return <div className="grid min-h-dvh place-items-center" role="status">در حال بررسی حساب کاربری…</div>;
  if (state === "invalid") return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Outlet />;
}
