"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type Account = {
  _id: string;
  code: string;
  name: string;
  type: string;
  subType?: string;
  isControl?: boolean;
};

type Period = {
  _id: string;
  name: string;
  startDate: string;
  endDate: string;
  isClosed?: boolean;
};

type Journal = {
  _id: string;
  date: string;
  memo?: string;
  refType?: string;
};

export default function AccountingPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState("Asset");
  const [accountSubType, setAccountSubType] = useState("");

  const [periodName, setPeriodName] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [accountsData, periodsData, journalsData] = await Promise.all([
        apiFetch<{ accounts: Account[] }>("/api/accounting/accounts"),
        apiFetch<{ periods: Period[] }>("/api/accounting/periods"),
        apiFetch<{ journals: Journal[] }>("/api/accounting/journals")
      ]);
      setAccounts(accountsData.accounts || []);
      setPeriods(periodsData.periods || []);
      setJournals(journalsData.journals || []);
    } catch (err: any) {
      setError(err.message || "Failed to load accounting data");
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
    loadData();
  }, []);

  const handleCreateAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/accounting/accounts", {
        method: "POST",
        body: JSON.stringify({
          code: accountCode,
          name: accountName,
          type: accountType,
          subType: accountSubType || undefined
        })
      });
      setAccountCode("");
      setAccountName("");
      setAccountSubType("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create account");
    }
  };

  const handleCreatePeriod = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/accounting/periods", {
        method: "POST",
        body: JSON.stringify({
          name: periodName,
          startDate: periodStart,
          endDate: periodEnd
        })
      });
      setPeriodName("");
      setPeriodStart("");
      setPeriodEnd("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to create period");
    }
  };

  const handleClosePeriod = async (periodId: string) => {
    const ok = window.confirm("Close this period? This will lock journal posting.");
    if (!ok) return;
    setError("");
    try {
      await apiFetch("/api/accounting/periods/close", {
        method: "POST",
        body: JSON.stringify({ periodId })
      });
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to close period");
    }
  };

  if (workspace && !workspace.enabledModules.includes("accounting")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.accounting || "Accounting"}</div>
        <div className="muted">Accounting is disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => (window.location.href = "/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">{workspace?.labels?.accounting || "Accounting"}</div>
        <div className="muted">Chart of accounts, periods, and journals.</div>
        {error ? <div className="muted">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-title">Chart of Accounts</div>
        <form onSubmit={handleCreateAccount} className="grid-2" style={{ marginBottom: 16 }}>
          <label className="field">
            Code
            <input value={accountCode} onChange={(e) => setAccountCode(e.target.value)} required />
          </label>
          <label className="field">
            Name
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
          </label>
          <label className="field">
            Type
            <select value={accountType} onChange={(e) => setAccountType(e.target.value)}>
              <option value="Asset">Asset</option>
              <option value="Liability">Liability</option>
              <option value="Equity">Equity</option>
              <option value="Income">Income</option>
              <option value="Expense">Expense</option>
            </select>
          </label>
          <label className="field">
            Subtype
            <input value={accountSubType} onChange={(e) => setAccountSubType(e.target.value)} />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="submit">
              Add account
            </button>
          </div>
        </form>
        {loading ? (
          <div className="muted">Loading accounts...</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Subtype</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account._id}>
                    <td>{account.code}</td>
                    <td>{account.name}</td>
                    <td>{account.type}</td>
                    <td>{account.subType || "-"}</td>
                  </tr>
                ))}
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No accounts yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Financial Periods</div>
        <form onSubmit={handleCreatePeriod} className="grid-2" style={{ marginBottom: 16 }}>
          <label className="field">
            Period name
            <input value={periodName} onChange={(e) => setPeriodName(e.target.value)} required />
          </label>
          <label className="field">
            Start date
            <input value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} type="date" required />
          </label>
          <label className="field">
            End date
            <input value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} type="date" required />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="submit">
              Add period
            </button>
          </div>
        </form>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {periods.map((period) => (
                <tr key={period._id}>
                  <td>{period.name}</td>
                  <td>{new Date(period.startDate).toLocaleDateString()}</td>
                  <td>{new Date(period.endDate).toLocaleDateString()}</td>
                  <td>{period.isClosed ? "Closed" : "Open"}</td>
                  <td>
                    {!period.isClosed ? (
                      <button className="button secondary" type="button" onClick={() => handleClosePeriod(period._id)}>
                        Close
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))}
              {periods.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted">
                    No periods configured.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Recent Journals</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Memo</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {journals.map((journal) => (
                <tr key={journal._id}>
                  <td>{new Date(journal.date).toLocaleDateString()}</td>
                  <td>{journal.memo || "-"}</td>
                  <td>{journal.refType || "manual"}</td>
                </tr>
              ))}
              {journals.length === 0 ? (
                <tr>
                  <td colSpan={3} className="muted">
                    No journals posted yet.
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
