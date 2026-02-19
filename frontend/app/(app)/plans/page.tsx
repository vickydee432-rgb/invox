"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function PlansPage() {
  const [billingStatus, setBillingStatus] = useState<{
    status: string;
    plan: string | null;
    billingCycle: string | null;
    isActive: boolean;
    isTrial: boolean;
    readOnly: boolean;
    trialEndsAt?: string;
    currentPeriodEnd?: string;
  } | null>(null);
  const [billingPlan, setBillingPlan] = useState("pro_monthly");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalEmbedError, setPaypalEmbedError] = useState("");
  const paypalButtonRef = useRef<HTMLDivElement | null>(null);
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
  const paypalPlanIds = {
    pro_monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO_MONTHLY || "",
    pro_yearly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO_YEARLY || "",
    businessplus_monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_BUSINESSPLUS_MONTHLY || "",
    businessplus_yearly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_BUSINESSPLUS_YEARLY || ""
  };

  const loadBillingStatus = async () => {
    setBillingLoading(true);
    setBillingError("");
    try {
      const data = await apiFetch<{
        status: string;
        plan: string | null;
        billingCycle: string | null;
        isActive: boolean;
        isTrial: boolean;
        readOnly: boolean;
        trialEndsAt?: string;
        currentPeriodEnd?: string;
      }>("/api/billing/status");
      setBillingStatus(data);
    } catch (err: any) {
      setBillingError(err.message || "Failed to load billing status");
    } finally {
      setBillingLoading(false);
    }
  };

  useEffect(() => {
    loadBillingStatus();
  }, []);

  useEffect(() => {
    if (!paypalReady || !paypalButtonRef.current) return;
    const planId = paypalPlanIds[billingPlan as keyof typeof paypalPlanIds];
    if (!planId) {
      setPaypalEmbedError("Missing PayPal plan ID for the selected plan.");
      return;
    }
    setPaypalEmbedError("");
    const paypal = (window as any).paypal;
    if (!paypal) {
      setPaypalEmbedError("PayPal SDK not ready.");
      return;
    }
    paypalButtonRef.current.innerHTML = "";
    paypal
      .Buttons({
        style: {
          layout: "vertical",
          shape: "pill",
          label: "subscribe"
        },
        createSubscription: (_data: any, actions: any) => {
          return actions.subscription.create({ plan_id: planId });
        },
        onApprove: () => {
          loadBillingStatus();
        },
        onError: (err: any) => {
          setPaypalEmbedError(err?.message || "PayPal checkout failed.");
        }
      })
      .render(paypalButtonRef.current);
  }, [paypalReady, billingPlan]);

  return (
    <>
      {paypalClientId ? (
        <Script
          src={`https://www.paypal.com/sdk/js?client-id=${paypalClientId}&vault=true&intent=subscription`}
          strategy="afterInteractive"
          onLoad={() => setPaypalReady(true)}
        />
      ) : null}

      <section className="panel">
        <div className="panel-title">Plans & Billing</div>
        {billingLoading ? (
          <div className="muted">Loading subscription...</div>
        ) : (
          <>
            <div className="grid-2">
              <div>
                <div className="muted">Status</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>{billingStatus?.status || "trialing"}</div>
              </div>
              <div>
                <div className="muted">Plan</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>
                  {billingStatus?.plan ? `${billingStatus.plan} · ${billingStatus?.billingCycle}` : "—"}
                </div>
              </div>
              <div>
                <div className="muted">Trial Ends</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>
                  {billingStatus?.trialEndsAt ? new Date(billingStatus.trialEndsAt).toLocaleDateString() : "—"}
                </div>
              </div>
              <div>
                <div className="muted">Current Period End</div>
                <div style={{ fontWeight: 700, marginTop: 4 }}>
                  {billingStatus?.currentPeriodEnd
                    ? new Date(billingStatus.currentPeriodEnd).toLocaleDateString()
                    : "—"}
                </div>
              </div>
            </div>

            <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
              <label className="field">
                Choose plan
                <select value={billingPlan} onChange={(e) => setBillingPlan(e.target.value)}>
                  <option value="pro_monthly">Pro · Monthly</option>
                  <option value="pro_yearly">Pro · Yearly</option>
                  <option value="businessplus_monthly">BusinessPlus · Monthly</option>
                  <option value="businessplus_yearly">BusinessPlus · Yearly</option>
                </select>
              </label>
              <div ref={paypalButtonRef} />
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <button className="button secondary" type="button" onClick={loadBillingStatus}>
                  Refresh status
                </button>
              </div>
              {paypalEmbedError ? <div className="muted">{paypalEmbedError}</div> : null}
              {billingError ? <div className="muted">{billingError}</div> : null}
            </div>
          </>
        )}
      </section>
    </>
  );
}
