"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { setToken } from "@/lib/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [legalName, setLegalName] = useState("");
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    if (!businessType) {
      setError("Select a business type.");
      setLoading(false);
      return;
    }
    try {
      const data = await apiFetch<{ token: string }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password,
          company: {
            name: companyName,
            businessType,
            legalName: legalName || undefined,
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
          }
        })
      });
      setToken(data.token);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="panel-title">Create your account</h2>
      <p className="muted">Add your user and company details to get started.</p>
      <form onSubmit={handleSubmit} style={{ marginTop: 20, display: "grid", gap: 14 }}>
        <label className="field">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label className="field">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
        </label>
        <label className="field">
          Password
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            required
          />
        </label>
        <div className="panel-title" style={{ fontSize: 16, marginTop: 10 }}>
          Company Details
        </div>
        <label className="field">
          Business type
          <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} required>
            <option value="">Select a business type</option>
            <option value="retail">Retail</option>
            <option value="construction">Construction</option>
            <option value="agency">Agency</option>
            <option value="services">Services</option>
            <option value="freelance">Freelance</option>
          </select>
        </label>
        <label className="field">
          Company name
          <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
        </label>
        <label className="field">
          Legal name (optional)
          <input value={legalName} onChange={(e) => setLegalName(e.target.value)} />
        </label>
        <label className="field">
          Company email
          <input
            value={companyEmail}
            onChange={(e) => setCompanyEmail(e.target.value)}
            type="email"
          />
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
        <div className="panel-title" style={{ fontSize: 16, marginTop: 10 }}>
          Address
        </div>
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
        <div className="panel-title" style={{ fontSize: 16, marginTop: 10 }}>
          Payment Details
        </div>
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
        <label className="field">
          Payment instructions
          <textarea
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            rows={3}
          />
        </label>
        {error ? <div className="muted">{error}</div> : null}
        <button className="button" type="submit" disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>
      </form>
      <p className="muted" style={{ marginTop: 16 }}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </div>
  );
}
