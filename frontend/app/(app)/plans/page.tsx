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
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [paypalReady, setPaypalReady] = useState(false);
  const [paypalEmbedError, setPaypalEmbedError] = useState("");
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "";
  const paypalPlanIds = {
    starter_monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_STARTER_MONTHLY || "",
    starter_yearly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_STARTER_YEARLY || "",
    pro_monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO_MONTHLY || "",
    pro_yearly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_PRO_YEARLY || "",
    businessplus_monthly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_BUSINESSPLUS_MONTHLY || "",
    businessplus_yearly: process.env.NEXT_PUBLIC_PAYPAL_PLAN_BUSINESSPLUS_YEARLY || ""
  };
  const pricing = {
    starter: {
      monthly: { price: "K150", note: "/month" },
      yearly: { price: "K1500", note: "/year" }
    },
    pro: {
      monthly: { price: "K350", note: "/month" },
      yearly: { price: "K3500", note: "/year" }
    },
    businessplus: {
      monthly: { price: "K750", note: "/month" },
      yearly: { price: "K7500", note: "/year" }
    }
  };

  const starterButtonRef = useRef<HTMLDivElement | null>(null);
  const proButtonRef = useRef<HTMLDivElement | null>(null);
  const businessButtonRef = useRef<HTMLDivElement | null>(null);

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
    if (!paypalReady) return;
    const planIdStarter =
      billingCycle === "monthly" ? paypalPlanIds.starter_monthly : paypalPlanIds.starter_yearly;
    const planIdPro = billingCycle === "monthly" ? paypalPlanIds.pro_monthly : paypalPlanIds.pro_yearly;
    const planIdBusiness =
      billingCycle === "monthly" ? paypalPlanIds.businessplus_monthly : paypalPlanIds.businessplus_yearly;

    if (!planIdStarter || !planIdPro || !planIdBusiness) {
      setPaypalEmbedError("Missing PayPal plan ID for the selected plan.");
      return;
    }
    setPaypalEmbedError("");
    const paypal = (window as any).paypal;
    if (!paypal) {
      setPaypalEmbedError("PayPal SDK not ready.");
      return;
    }

    const renderButton = (ref: React.MutableRefObject<HTMLDivElement | null>, planId: string) => {
      if (!ref.current) return;
      ref.current.innerHTML = "";
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
        .render(ref.current);
    };

    renderButton(starterButtonRef, planIdStarter);
    renderButton(proButtonRef, planIdPro);
    renderButton(businessButtonRef, planIdBusiness);
  }, [paypalReady, billingCycle]);

  return (
    <>
      {paypalClientId ? (
        <Script
          src={`https://www.paypal.com/sdk/js?client-id=${paypalClientId}&vault=true&intent=subscription`}
          strategy="afterInteractive"
          onLoad={() => setPaypalReady(true)}
        />
      ) : null}

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
            <div ref={starterButtonRef} className="paypal-embed" />
            <div className="plan-helper">PayPal button will appear here.</div>
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
            <div ref={proButtonRef} className="paypal-embed" />
            <div className="plan-helper">PayPal button will appear here.</div>
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
            <div ref={businessButtonRef} className="paypal-embed" />
            <div className="plan-helper">PayPal button will appear here.</div>
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
          {paypalEmbedError ? <div className="muted">{paypalEmbedError}</div> : null}
          {billingError ? <div className="muted">{billingError}</div> : null}
        </section>
      </div>
    </>
  );
}
