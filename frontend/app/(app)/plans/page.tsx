"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

export default function PlansPage() {
  const [role, setRole] = useState<"owner" | "admin" | "member" | null>(null);
  const [billingStatus, setBillingStatus] = useState<{
    status: string;
    plan: string | null;
    billingCycle: string | null;
    dodoSubscriptionId?: string | null;
    cancelAtNextBillingDate?: boolean;
    isActive: boolean;
    isTrial: boolean;
    readOnly: boolean;
    trialEndsAt?: string;
    currentPeriodEnd?: string;
  } | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [subscribingPlan, setSubscribingPlan] = useState("");
  const [checkoutReady, setCheckoutReady] = useState(false);
  const checkoutRef = useRef<any>(null);
  const dodoMode = process.env.NEXT_PUBLIC_DODO_MODE === "test" ? "test" : "live";
  const pricing = {
    starter: {
      monthly: { price: "$10.99", note: "/month" },
      yearly: { price: "$119.99", note: "/year" }
    },
    pro: {
      monthly: { price: "$19.99", note: "/month" },
      yearly: { price: "$239.99", note: "/year" }
    },
    businessplus: {
      monthly: { price: "$39.99", note: "/month" },
      yearly: { price: "$479.99", note: "/year" }
    }
  };

  const loadBillingStatus = async () => {
    setBillingLoading(true);
    setBillingError("");
    try {
      const data = await apiFetch<{
        status: string;
        plan: string | null;
        billingCycle: string | null;
        dodoSubscriptionId?: string | null;
        cancelAtNextBillingDate?: boolean;
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
    let active = true;
    apiFetch<{ user: { role?: "owner" | "admin" | "member" } }>("/api/auth/me")
      .then((data) => {
        if (!active) return;
        const nextRole = data.user?.role || "member";
        setRole(nextRole);
        if (nextRole === "owner" || nextRole === "admin") {
          loadBillingStatus();
        }
      })
      .catch(() => {
        if (!active) return;
        setRole("member");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    import("dodopayments-checkout")
      .then((mod: any) => {
        const DodoPayments = mod?.DodoPayments || mod?.default?.DodoPayments || mod?.default || mod;
        if (!DodoPayments || !mounted) return;
        DodoPayments.Initialize({
          mode: dodoMode,
          displayType: "inline",
          iframeResizerOptions: { checkOrigin: false }
        });
        checkoutRef.current = DodoPayments;
        setCheckoutReady(true);
      })
      .catch(() => {
        setCheckoutReady(false);
      });
    return () => {
      mounted = false;
    };
  }, [dodoMode]);

  const startCheckout = async (planKey: string) => {
    setCheckoutError("");
    setCancelError("");
    setSubscribingPlan(planKey);
    try {
      if (role !== "owner" && role !== "admin") {
        setCheckoutError("Only admins can manage subscription changes.");
        return;
      }
      const data = await apiFetch<{ checkoutUrl?: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planKey })
      });
      if (data.checkoutUrl && checkoutRef.current) {
        const container = document.getElementById("dodo-inline-checkout");
        if (container) container.innerHTML = "";
        checkoutRef.current.Checkout.open({
          checkoutUrl: data.checkoutUrl,
          elementId: "dodo-inline-checkout",
          iframeResizerOptions: {
            checkOrigin: false
          }
        });
        const section = document.getElementById("checkout-section");
        if (section) section.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        setCheckoutError(checkoutRef.current ? "Missing checkout URL from Dodo." : "Checkout SDK not loaded.");
      }
    } catch (err: any) {
      setCheckoutError(err.message || "Failed to start checkout");
    } finally {
      setSubscribingPlan("");
    }
  };

  const cancelSubscription = async () => {
    setCancelError("");
    setCheckoutError("");
    if (role !== "owner" && role !== "admin") {
      setCancelError("Only admins can manage subscription changes.");
      return;
    }
    const ok = window.confirm("Cancel your subscription at the end of the current billing period?");
    if (!ok) return;
    setCancelling(true);
    try {
      const data = await apiFetch<any>("/api/billing/cancel", { method: "POST", body: JSON.stringify({}) });
      if (data) setBillingStatus(data);
      await loadBillingStatus();
    } catch (err: any) {
      setCancelError(err.message || "Failed to cancel subscription");
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = Boolean(
    billingStatus?.plan && billingStatus?.status !== "pending" && !billingStatus?.cancelAtNextBillingDate
  );

  if (role === null) {
    return (
      <section className="panel">
        <div className="panel-title">Plans</div>
        <div className="muted">Loading…</div>
      </section>
    );
  }

  if (role !== "owner" && role !== "admin") {
    return (
      <section className="panel">
        <div className="panel-title">Plans & Billing</div>
        <div className="muted">Only admins can view or change subscription settings.</div>
      </section>
    );
  }

  return (
    <>
      <div className="plans-page plans-allow">
        <section className="plans-hero">
          <div className="plans-kicker">Small investment</div>
          <h1>
            Huge productivity <span>boost</span>
          </h1>
          <p>
            Simple, secure billing for your team. Three flexible plans with monthly or yearly options.
          </p>
          <div className="plans-badges">
            <span>14-day free trial</span>
            <span>All core features included</span>
            <span>Cancel anytime</span>
          </div>
          <div className="plans-toggle">
            <button
              type="button"
              className={billingCycle === "monthly" ? "active" : ""}
              onClick={() => setBillingCycle("monthly")}
              data-allow="true"
            >
              Monthly
            </button>
            <button
              type="button"
              className={billingCycle === "yearly" ? "active" : ""}
              onClick={() => setBillingCycle("yearly")}
              data-allow="true"
            >
              Yearly
            </button>
          </div>
        </section>

        <section className="plans-cards">
          <article className="plan-card">
            <div className="plan-title">Starter</div>
            <div className="plan-subtitle">For solo founders getting started</div>
            <div className="plan-price">
              {pricing.starter[billingCycle].price} <span>{pricing.starter[billingCycle].note}</span>
            </div>
            <button
              className="button"
              type="button"
              data-allow="true"
              disabled={Boolean(subscribingPlan)}
              onClick={() => startCheckout(`starter_${billingCycle}`)}
            >
              {subscribingPlan === `starter_${billingCycle}` ? "Starting checkout..." : "Subscribe"}
            </button>
            <ul className="plan-features">
              <li>Invoices, quotes, sales & inventory</li>
              <li>Expenses & purchases</li>
              <li>Documents (receipts)</li>
              <li>PDF exports</li>
              <li>1 seat included</li>
            </ul>
          </article>

          <article className="plan-card">
            <div className="plan-title">Pro</div>
            <div className="plan-subtitle">For small teams needing reporting</div>
            <div className="plan-price">
              {pricing.pro[billingCycle].price} <span>{pricing.pro[billingCycle].note}</span>
            </div>
            <button
              className="button"
              type="button"
              data-allow="true"
              disabled={Boolean(subscribingPlan)}
              onClick={() => startCheckout(`pro_${billingCycle}`)}
            >
              {subscribingPlan === `pro_${billingCycle}` ? "Starting checkout..." : "Subscribe"}
            </button>
            <ul className="plan-features">
              <li>Everything in Starter</li>
              <li>Projects + reports</li>
              <li>Tax module (VAT / Turnover)</li>
              <li>PDF + Excel exports</li>
              <li>Up to 5 seats</li>
            </ul>
          </article>

          <article className="plan-card featured">
            <div className="plan-tag">Most popular</div>
            <div className="plan-title">BusinessPlus</div>
            <div className="plan-subtitle">For growing operations</div>
            <div className="plan-price">
              {pricing.businessplus[billingCycle].price} <span>{pricing.businessplus[billingCycle].note}</span>
            </div>
            <button
              className="button"
              type="button"
              data-allow="true"
              disabled={Boolean(subscribingPlan)}
              onClick={() => startCheckout(`businessplus_${billingCycle}`)}
            >
              {subscribingPlan === `businessplus_${billingCycle}` ? "Starting checkout..." : "Subscribe"}
            </button>
            <ul className="plan-features">
              <li>Everything in Pro</li>
              <li>ZRA Smart invoice sync (BusinessPlus only)</li>
              <li>Accounting, banking & payroll</li>
              <li>Audit logs</li>
              <li>Up to 15 seats</li>
            </ul>
          </article>
        </section>

        {billingStatus?.status !== "pending" ? (
          <section className="plans-status">
            {billingLoading ? (
              <div className="muted">Loading subscription...</div>
            ) : (
              <div className="plans-status-grid">
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
                <div>
                  <div className="plans-status-actions">
                    <button className="button secondary" type="button" onClick={loadBillingStatus} data-allow="true">
                      Refresh status
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={cancelSubscription}
                      disabled={!canCancel || cancelling}
                      data-allow="true"
                      title={!canCancel ? "No active subscription to cancel (or cancellation already scheduled)." : ""}
                    >
                      {billingStatus?.cancelAtNextBillingDate
                        ? "Cancellation scheduled"
                        : cancelling
                          ? "Cancelling..."
                          : "Cancel subscription"}
                    </button>
                  </div>
                </div>
                {billingStatus?.cancelAtNextBillingDate ? (
                  <div style={{ gridColumn: "1 / -1" }} className="muted">
                    Cancellation scheduled{billingStatus?.currentPeriodEnd
                      ? ` for ${new Date(billingStatus.currentPeriodEnd).toLocaleDateString()}`
                      : ""}.
                  </div>
                ) : null}
              </div>
            )}
            {checkoutError ? <div className="muted">{checkoutError}</div> : null}
            {cancelError ? <div className="muted">{cancelError}</div> : null}
            {billingError ? <div className="muted">{billingError}</div> : null}
          </section>
        ) : (
          <section className="plans-status">
            {checkoutError ? <div className="muted">{checkoutError}</div> : null}
            {cancelError ? <div className="muted">{cancelError}</div> : null}
            {billingError ? <div className="muted">{billingError}</div> : null}
          </section>
        )}

        <section className="panel" id="checkout-section">
          <div className="panel-title">Secure checkout</div>
          <div className="muted">
            {checkoutReady ? "Complete your subscription below." : "Loading checkout..."}
          </div>
          <div id="dodo-inline-checkout" style={{ marginTop: 16 }} />
        </section>
      </div>
    </>
  );
}
