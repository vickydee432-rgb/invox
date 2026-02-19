"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";

type Company = {
  name: string;
  legalName?: string;
  logoUrl?: string;
  email?: string;
  phone?: string;
  website?: string;
  taxId?: string;
  currency?: string;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
  payment?: {
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    routingNumber?: string;
    swift?: string;
    mobileMoney?: string;
    paymentInstructions?: string;
  };
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [name, setName] = useState("");
  const [legalName, setLegalName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [taxId, setTaxId] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [country, setCountry] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [routingNumber, setRoutingNumber] = useState("");
  const [swift, setSwift] = useState("");
  const [mobileMoney, setMobileMoney] = useState("");
  const [paymentInstructions, setPaymentInstructions] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
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
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [billingPlan, setBillingPlan] = useState("pro_monthly");
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
  const [zraConnections, setZraConnections] = useState<
    {
      id: string;
      tpin: string;
      branchId: string;
      branchName?: string;
      enabled: boolean;
      syncEnabled: boolean;
      syncIntervalMinutes: number;
      baseUrl?: string;
      lastSyncAt?: string;
      lastSyncStatus?: string;
      lastSyncError?: string;
    }[]
  >([]);
  const [zraLoading, setZraLoading] = useState(false);
  const [zraError, setZraError] = useState("");
  const [zraSuccess, setZraSuccess] = useState("");
  const [zraTpin, setZraTpin] = useState("");
  const [zraBranchId, setZraBranchId] = useState("");
  const [zraBranchName, setZraBranchName] = useState("");
  const [zraBaseUrl, setZraBaseUrl] = useState("");
  const [zraAuthType, setZraAuthType] = useState("bearer");
  const [zraUsername, setZraUsername] = useState("");
  const [zraPassword, setZraPassword] = useState("");
  const [zraAccessToken, setZraAccessToken] = useState("");
  const [zraApiKey, setZraApiKey] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<{ company: Company }>("/api/company/me")
      .then((data) => {
        if (!active) return;
        const company = data.company;
        setName(company.name || "");
        setLegalName(company.legalName || "");
        setLogoUrl(company.logoUrl || "");
        setCompanyEmail(company.email || "");
        setPhone(company.phone || "");
        setWebsite(company.website || "");
        setTaxId(company.taxId || "");
        setCurrency(company.currency || "USD");
        setAddressLine1(company.address?.line1 || "");
        setAddressLine2(company.address?.line2 || "");
        setCity(company.address?.city || "");
        setState(company.address?.state || "");
        setPostalCode(company.address?.postalCode || "");
        setCountry(company.address?.country || "");
        setBankName(company.payment?.bankName || "");
        setAccountName(company.payment?.accountName || "");
        setAccountNumber(company.payment?.accountNumber || "");
        setRoutingNumber(company.payment?.routingNumber || "");
        setSwift(company.payment?.swift || "");
        setMobileMoney(company.payment?.mobileMoney || "");
        setPaymentInstructions(company.payment?.paymentInstructions || "");
      })
      .catch((err: any) => {
        if (!active) return;
        setError(err.message || "Failed to load company settings");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const loadZraStatus = async () => {
    setZraLoading(true);
    setZraError("");
    try {
      const data = await apiFetch<{ connections: any[] }>("/api/integrations/zra/status");
      setZraConnections(data.connections || []);
    } catch (err: any) {
      setZraError(err.message || "Failed to load ZRA status");
    } finally {
      setZraLoading(false);
    }
  };

  useEffect(() => {
    loadZraStatus();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiFetch("/api/company/me", {
        method: "PUT",
        body: JSON.stringify({
          name,
          legalName: legalName || undefined,
          logoUrl: logoUrl || undefined,
          email: companyEmail || undefined,
          phone: phone || undefined,
          website: website || undefined,
          taxId: taxId || undefined,
          currency: currency || undefined,
          address: {
            line1: addressLine1 || undefined,
            line2: addressLine2 || undefined,
            city: city || undefined,
            state: state || undefined,
            postalCode: postalCode || undefined,
            country: country || undefined
          },
          payment: {
            bankName: bankName || undefined,
            accountName: accountName || undefined,
            accountNumber: accountNumber || undefined,
            routingNumber: routingNumber || undefined,
            swift: swift || undefined,
            mobileMoney: mobileMoney || undefined,
            paymentInstructions: paymentInstructions || undefined
          }
        })
      });
      setSuccess("Company settings updated.");
    } catch (err: any) {
      setError(err.message || "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    setPasswordSaving(true);
    try {
      await apiFetch("/api/auth/password", {
        method: "PUT",
        body: JSON.stringify({ currentPassword, newPassword })
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordSuccess("Password updated.");
    } catch (err: any) {
      setPasswordError(err.message || "Failed to update password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleZraConnect = async (event: React.FormEvent) => {
    event.preventDefault();
    setZraError("");
    setZraSuccess("");
    const credentials: Record<string, any> = { authType: zraAuthType };
    if (zraAuthType === "basic") {
      credentials.username = zraUsername;
      credentials.password = zraPassword;
    } else if (zraAuthType === "bearer") {
      credentials.accessToken = zraAccessToken;
    } else if (zraAuthType === "apikey") {
      credentials.apiKey = zraApiKey;
    }
    try {
      await apiFetch("/api/integrations/zra/connect", {
        method: "POST",
        body: JSON.stringify({
          tpin: zraTpin,
          branchId: zraBranchId,
          branchName: zraBranchName || undefined,
          baseUrl: zraBaseUrl || undefined,
          credentials
        })
      });
      setZraSuccess("ZRA connection saved.");
      await loadZraStatus();
    } catch (err: any) {
      setZraError(err.message || "Failed to connect ZRA");
    }
  };

  const handleZraDisconnect = async (branchId: string) => {
    setZraError("");
    setZraSuccess("");
    try {
      await apiFetch("/api/integrations/zra/disconnect", {
        method: "POST",
        body: JSON.stringify({ branchId })
      });
      setZraSuccess("ZRA sync disabled.");
      await loadZraStatus();
    } catch (err: any) {
      setZraError(err.message || "Failed to disconnect ZRA");
    }
  };

  const handleZraSync = async (branchId?: string) => {
    setZraError("");
    setZraSuccess("");
    try {
      await apiFetch("/api/integrations/zra/sync/manual", {
        method: "POST",
        body: JSON.stringify(branchId ? { branchId } : {})
      });
      setZraSuccess("ZRA sync started.");
      await loadZraStatus();
    } catch (err: any) {
      setZraError(err.message || "Failed to sync ZRA");
    }
  };

  const handleSubscribe = async () => {
    setBillingError("");
    try {
      const data = await apiFetch<{ approveUrl?: string }>("/api/billing/paypal/subscribe", {
        method: "POST",
        body: JSON.stringify({ planKey: billingPlan })
      });
      if (data.approveUrl) {
        window.location.href = data.approveUrl;
      }
    } catch (err: any) {
      setBillingError(err.message || "Failed to start subscription");
    }
  };

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

  if (loading) {
    return (
      <section className="panel">
        <div className="panel-title">Company Settings</div>
        <div className="muted">Loading settings...</div>
      </section>
    );
  }

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
        <div className="panel-title">Subscription</div>
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
              <div style={{ display: "grid", gap: 12 }}>
                <div ref={paypalButtonRef} />
                <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <button className="button secondary" type="button" onClick={loadBillingStatus}>
                    Refresh status
                  </button>
                </div>
                {paypalEmbedError ? <div className="muted">{paypalEmbedError}</div> : null}
                {billingError ? <div className="muted">{billingError}</div> : null}
              </div>
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Company Settings</div>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
          <div className="grid-2">
            <label className="field">
              Company name
              <input value={name} onChange={(e) => setName(e.target.value)} required />
            </label>
            <label className="field">
              Legal name
              <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
            </label>
            <label className="field">
              Logo URL
              <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} />
            </label>
            <label className="field">
              Company email
              <input value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} type="email" />
            </label>
            <label className="field">
              Phone
              <input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            <label className="field">
              Website
              <input value={website} onChange={(e) => setWebsite(e.target.value)} />
            </label>
            <label className="field">
              Tax ID
              <input value={taxId} onChange={(e) => setTaxId(e.target.value)} />
            </label>
            <label className="field">
              Currency
              <input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </label>
          </div>

          <div className="panel-title" style={{ fontSize: 16, marginTop: 6 }}>
            Address
          </div>
          <div className="grid-2">
            <label className="field">
              Address line 1
              <input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
            </label>
            <label className="field">
              Address line 2
              <input value={addressLine2} onChange={(e) => setAddressLine2(e.target.value)} />
            </label>
            <label className="field">
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} />
            </label>
            <label className="field">
              State / Region
              <input value={state} onChange={(e) => setState(e.target.value)} />
            </label>
            <label className="field">
              Postal code
              <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
            </label>
            <label className="field">
              Country
              <input value={country} onChange={(e) => setCountry(e.target.value)} />
            </label>
          </div>

          <div className="panel-title" style={{ fontSize: 16, marginTop: 6 }}>
            Payment Details
          </div>
          <div className="grid-2">
            <label className="field">
              Bank name
              <input value={bankName} onChange={(e) => setBankName(e.target.value)} />
            </label>
            <label className="field">
              Account name
              <input value={accountName} onChange={(e) => setAccountName(e.target.value)} />
            </label>
            <label className="field">
              Account number
              <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            </label>
            <label className="field">
              Routing number
              <input value={routingNumber} onChange={(e) => setRoutingNumber(e.target.value)} />
            </label>
            <label className="field">
              SWIFT code
              <input value={swift} onChange={(e) => setSwift(e.target.value)} />
            </label>
            <label className="field">
              Mobile money
              <input value={mobileMoney} onChange={(e) => setMobileMoney(e.target.value)} />
            </label>
            <label className="field" style={{ gridColumn: "1 / -1" }}>
              Payment instructions
              <textarea
                value={paymentInstructions}
                onChange={(e) => setPaymentInstructions(e.target.value)}
                rows={3}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="button" type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save settings"}
            </button>
            {success ? <div className="muted">{success}</div> : null}
            {error ? <div className="muted">{error}</div> : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">Change Password</div>
        <form onSubmit={handlePasswordChange} style={{ display: "grid", gap: 16 }}>
          <div className="grid-2">
            <label className="field">
              Current password
              <input
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                type="password"
                required
              />
            </label>
            <label className="field">
              New password
              <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" required />
            </label>
            <label className="field">
              Confirm new password
              <input
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                type="password"
                required
              />
            </label>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="button" type="submit" disabled={passwordSaving}>
              {passwordSaving ? "Updating..." : "Update password"}
            </button>
            {passwordSuccess ? <div className="muted">{passwordSuccess}</div> : null}
            {passwordError ? <div className="muted">{passwordError}</div> : null}
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">Integrations · ZRA Smart Invoice</div>
        <form onSubmit={handleZraConnect} style={{ display: "grid", gap: 16 }}>
          <div className="grid-2">
            <label className="field">
              TPIN
              <input value={zraTpin} onChange={(e) => setZraTpin(e.target.value)} required />
            </label>
            <label className="field">
              Branch ID
              <input value={zraBranchId} onChange={(e) => setZraBranchId(e.target.value)} required />
            </label>
            <label className="field">
              Branch Name
              <input value={zraBranchName} onChange={(e) => setZraBranchName(e.target.value)} />
            </label>
            <label className="field">
              ZRA Base URL
              <input value={zraBaseUrl} onChange={(e) => setZraBaseUrl(e.target.value)} />
            </label>
            <label className="field">
              Auth Type
              <select value={zraAuthType} onChange={(e) => setZraAuthType(e.target.value)}>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Username/Password</option>
                <option value="apikey">API Key</option>
              </select>
            </label>
            {zraAuthType === "basic" ? (
              <>
                <label className="field">
                  Username
                  <input value={zraUsername} onChange={(e) => setZraUsername(e.target.value)} />
                </label>
                <label className="field">
                  Password
                  <input value={zraPassword} onChange={(e) => setZraPassword(e.target.value)} type="password" />
                </label>
              </>
            ) : null}
            {zraAuthType === "bearer" ? (
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                Access Token
                <input value={zraAccessToken} onChange={(e) => setZraAccessToken(e.target.value)} />
              </label>
            ) : null}
            {zraAuthType === "apikey" ? (
              <label className="field" style={{ gridColumn: "1 / -1" }}>
                API Key
                <input value={zraApiKey} onChange={(e) => setZraApiKey(e.target.value)} />
              </label>
            ) : null}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button className="button" type="submit" disabled={zraLoading}>
              {zraLoading ? "Saving..." : "Save connection"}
            </button>
            <button className="button secondary" type="button" onClick={() => handleZraSync()}>
              Sync now
            </button>
            {zraSuccess ? <div className="muted">{zraSuccess}</div> : null}
            {zraError ? <div className="muted">{zraError}</div> : null}
          </div>
        </form>

        <div style={{ marginTop: 18 }}>
          <div className="panel-title" style={{ fontSize: 16 }}>
            Connections
          </div>
          {zraConnections.length === 0 ? (
            <div className="muted">No ZRA connections yet.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>TPIN</th>
                  <th>Branch</th>
                  <th>Enabled</th>
                  <th>Last Sync</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {zraConnections.map((conn) => (
                  <tr key={conn.id}>
                    <td>{conn.tpin}</td>
                    <td>{conn.branchName || conn.branchId}</td>
                    <td>{conn.enabled ? "Yes" : "No"}</td>
                    <td>{conn.lastSyncAt ? new Date(conn.lastSyncAt).toLocaleString() : "—"}</td>
                    <td>{conn.lastSyncStatus || "—"}</td>
                    <td style={{ display: "flex", gap: 8 }}>
                      <button className="button secondary" onClick={() => handleZraSync(conn.branchId)}>
                        Sync
                      </button>
                      {conn.enabled ? (
                        <button className="button secondary" onClick={() => handleZraDisconnect(conn.branchId)}>
                          Disable
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
