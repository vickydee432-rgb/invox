"use client";

import { useEffect, useState } from "react";
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

  if (loading) {
    return (
      <section className="panel">
        <div className="panel-title">Company Settings</div>
        <div className="muted">Loading settings...</div>
      </section>
    );
  }

  return (
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
  );
}
