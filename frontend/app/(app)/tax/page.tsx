"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type TaxCode = {
  _id: string;
  name: string;
  rate: number;
  type: string;
};

type TaxReturn = {
  _id: string;
  period: string;
  type: string;
  status?: string;
  createdAt?: string;
};

export default function TaxPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [codes, setCodes] = useState<TaxCode[]>([]);
  const [returns, setReturns] = useState<TaxReturn[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [codeName, setCodeName] = useState("");
  const [codeRate, setCodeRate] = useState(0);
  const [codeType, setCodeType] = useState("VAT");

  const [returnPeriod, setReturnPeriod] = useState("");
  const [returnType, setReturnType] = useState("VAT");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [codeData, returnData] = await Promise.all([
        apiFetch<{ codes: TaxCode[] }>("/api/tax/tax-codes"),
        apiFetch<{ returns: TaxReturn[] }>("/api/tax/tax-returns")
      ]);
      setCodes(codeData.codes || []);
      setReturns(returnData.returns || []);
    } catch (err: any) {
      setError(err.message || "Failed to load tax data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    apiFetch<{ company: any }>("/api/company/me")
      .then((data) => {
        if (!active) return;
        setWorkspace(buildWorkspace(data.company));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!returnPeriod) {
      const now = new Date();
      setReturnPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    }
  }, [returnPeriod]);

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/tax/tax-codes", {
        method: "POST",
        body: JSON.stringify({ name: codeName, rate: codeRate, type: codeType })
      });
      setCodeName("");
      setCodeRate(0);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create tax code");
    }
  };

  const handleSubmitReturn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/tax/tax-returns/submit", {
        method: "POST",
        body: JSON.stringify({ period: returnPeriod, type: returnType })
      });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to submit tax return");
    }
  };

  if (workspace && !workspace.enabledModules.includes("tax")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.tax || "Tax"}</div>
        <div className="muted">Tax is disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => (window.location.href = "/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">{workspace?.labels?.tax || "Tax"}</div>
        <div className="muted">Manage VAT, turnover tax, and reminders.</div>
        {error ? <div className="muted">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-title">Tax Codes</div>
        <form onSubmit={handleCreateCode} className="grid-2" style={{ marginBottom: 16 }}>
          <label className="field">
            Name
            <input value={codeName} onChange={(e) => setCodeName(e.target.value)} required />
          </label>
          <label className="field">
            Rate %
            <input value={codeRate} onChange={(e) => setCodeRate(Number(e.target.value))} type="number" min={0} />
          </label>
          <label className="field">
            Type
            <select value={codeType} onChange={(e) => setCodeType(e.target.value)}>
              <option value="VAT">VAT</option>
              <option value="Turnover">Turnover</option>
              <option value="Withholding">Withholding</option>
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="submit">
              Add tax code
            </button>
          </div>
        </form>
        {loading ? (
          <div className="muted">Loading tax codes...</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code._id}>
                    <td>{code.name}</td>
                    <td>{code.type}</td>
                    <td>{Number(code.rate || 0).toFixed(2)}%</td>
                  </tr>
                ))}
                {codes.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No tax codes yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Submit Tax Return</div>
        <form onSubmit={handleSubmitReturn} className="grid-2">
          <label className="field">
            Period
            <input value={returnPeriod} onChange={(e) => setReturnPeriod(e.target.value)} placeholder="YYYY-MM" />
          </label>
          <label className="field">
            Type
            <select value={returnType} onChange={(e) => setReturnType(e.target.value)}>
              <option value="VAT">VAT</option>
              <option value="Turnover">Turnover</option>
              <option value="Withholding">Withholding</option>
            </select>
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="submit">
              Submit return
            </button>
          </div>
        </form>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Type</th>
                <th>Status</th>
                <th>Submitted</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((item) => (
                <tr key={item._id}>
                  <td>{item.period}</td>
                  <td>{item.type}</td>
                  <td>{item.status || "draft"}</td>
                  <td>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "-"}</td>
                </tr>
              ))}
              {returns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No tax returns yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
