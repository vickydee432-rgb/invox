"use client";

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
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [checkoutError, setCheckoutError] = useState("");
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
    let mounted = true;
    import("dodopayments-checkout")
      .then((mod: any) => {
        const DodoPayments = mod?.DodoPayments || mod?.default?.DodoPayments || mod?.default || mod;
        if (!DodoPayments || !mounted) return;
        DodoPayments.Initialize({ mode: dodoMode, displayType: "inline" });
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
    setSubscribingPlan(planKey);
    try {
      const data = await apiFetch<{ checkoutUrl?: string }>("/api/billing/checkout", {
        method: "POST",
        body: JSON.stringify({ planKey })
      });
      if (data.checkoutUrl && checkoutRef.current) {
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
            <div className="plan-subtitle">For small teams getting started</div>
            <div className="plan-price">
              {pricing.starter[billingCycle].price} <span>{pricing.starter[billingCycle].note}</span>
            </div>
            <button
              className="button"
              type="button"
              data-allow="true"
              disabled={subscribingPlan === `starter_${billingCycle}`}
              onClick={() => startCheckout(`starter_${billingCycle}`)}
            >
              {subscribingPlan === `starter_${billingCycle}` ? "Starting checkout..." : "Subscribe"}
            </button>
            <ul className="plan-features">
              <li>Invoices & quotes</li>
              <li>Basic expense tracking</li>
              <li>PDF exports</li>
              <li>Email support</li>
            </ul>
          </article>

          <article className="plan-card">
            <div className="plan-title">Pro</div>
            <div className="plan-subtitle">For fast-moving teams</div>
            <div className="plan-price">
              {pricing.pro[billingCycle].price} <span>{pricing.pro[billingCycle].note}</span>
            </div>
            <button
              className="button"
              type="button"
              data-allow="true"
              disabled={subscribingPlan === `pro_${billingCycle}`}
              onClick={() => startCheckout(`pro_${billingCycle}`)}
            >
              {subscribingPlan === `pro_${billingCycle}` ? "Starting checkout..." : "Subscribe"}
            </button>
            <ul className="plan-features">
              <li>Unlimited invoices & quotes</li>
              <li>Project tracking + exports</li>
              <li>PDF & Excel reporting</li>
              <li>Email support</li>
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
              disabled={subscribingPlan === `businessplus_${billingCycle}`}
              onClick={() => startCheckout(`businessplus_${billingCycle}`)}
            >
              {subscribingPlan === `businessplus_${billingCycle}` ? "Starting checkout..." : "Subscribe"}
            </button>
            <ul className="plan-features">
              <li>Everything in Pro</li>
              <li>ZRA Smart Invoice sync</li>
              <li>Advanced reports + trends</li>
              <li>Priority support</li>
            </ul>
          </article>
        </section>

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
                <button className="button secondary" type="button" onClick={loadBillingStatus} data-allow="true">
                  Refresh status
                </button>
              </div>
            </div>
          )}
          {checkoutError ? <div className="muted">{checkoutError}</div> : null}
          {billingError ? <div className="muted">{billingError}</div> : null}
        </section>

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
