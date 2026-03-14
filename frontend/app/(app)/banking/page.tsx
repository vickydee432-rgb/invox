"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type BankAccount = {
  _id: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  currency?: string;
};

type CashbookEntry = {
  _id: string;
  date: string;
  amount: number;
  description?: string;
  reference?: string;
};

export default function BankingPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [cashbook, setCashbook] = useState<CashbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [accountName, setAccountName] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [currency, setCurrency] = useState("ZMW");

  const [transactionAccountId, setTransactionAccountId] = useState("");
  const [transactionDate, setTransactionDate] = useState("");
  const [transactionAmount, setTransactionAmount] = useState(0);
  const [transactionDescription, setTransactionDescription] = useState("");

  useEffect(() => {
    if (!transactionDate) setTransactionDate(new Date().toISOString().slice(0, 10));
  }, [transactionDate]);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [accountData, cashbookData] = await Promise.all([
        apiFetch<{ accounts: BankAccount[] }>("/api/banking/bank-accounts"),
        apiFetch<{ entries: CashbookEntry[] }>("/api/banking/cashbook")
      ]);
      setAccounts(accountData.accounts || []);
      setCashbook(cashbookData.entries || []);
      if (!transactionAccountId && accountData.accounts?.length) {
        setTransactionAccountId(accountData.accounts[0]._id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load banking data");
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

  const handleAddAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/banking/bank-accounts", {
        method: "POST",
        body: JSON.stringify({
          name: accountName,
          bankName: bankName || undefined,
          accountNumber: accountNumber || undefined,
          currency
        })
      });
      setAccountName("");
      setBankName("");
      setAccountNumber("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add bank account");
    }
  };

  const handleImportTransaction = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/banking/bank-transactions/import", {
        method: "POST",
        body: JSON.stringify({
          transactions: [
            {
              bankAccountId: transactionAccountId,
              date: transactionDate,
              amount: transactionAmount,
              description: transactionDescription
            }
          ]
        })
      });
      setTransactionAmount(0);
      setTransactionDescription("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to import transaction");
    }
  };

  if (workspace && !workspace.enabledModules.includes("banking")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.banking || "Banking"}</div>
        <div className="muted">Banking is disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => (window.location.href = "/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">{workspace?.labels?.banking || "Banking"}</div>
        <div className="muted">Track bank accounts, transactions, and reconciliation.</div>
        {error ? <div className="muted">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-title">Bank Accounts</div>
        <form onSubmit={handleAddAccount} className="grid-2" style={{ marginBottom: 16 }}>
          <label className="field">
            Account name
            <input value={accountName} onChange={(e) => setAccountName(e.target.value)} required />
          </label>
          <label className="field">
            Bank name
            <input value={bankName} onChange={(e) => setBankName(e.target.value)} />
          </label>
          <label className="field">
            Account number
            <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
          </label>
          <label className="field">
            Currency
            <input value={currency} onChange={(e) => setCurrency(e.target.value)} />
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
                  <th>Name</th>
                  <th>Bank</th>
                  <th>Number</th>
                  <th>Currency</th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((account) => (
                  <tr key={account._id}>
                    <td>{account.name}</td>
                    <td>{account.bankName || "-"}</td>
                    <td>{account.accountNumber || "-"}</td>
                    <td>{account.currency || "-"}</td>
                  </tr>
                ))}
                {accounts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No bank accounts yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Quick Transaction Import</div>
        <form onSubmit={handleImportTransaction} className="grid-2">
          <label className="field">
            Bank account
            <select value={transactionAccountId} onChange={(e) => setTransactionAccountId(e.target.value)}>
              <option value="">Select account</option>
              {accounts.map((account) => (
                <option key={account._id} value={account._id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Date
            <input value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} type="date" />
          </label>
          <label className="field">
            Amount
            <input
              value={transactionAmount}
              onChange={(e) => setTransactionAmount(Number(e.target.value))}
              type="number"
            />
          </label>
          <label className="field">
            Description
            <input value={transactionDescription} onChange={(e) => setTransactionDescription(e.target.value)} />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="submit">
              Import transaction
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <div className="panel-title">Cashbook</div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Reference</th>
              </tr>
            </thead>
            <tbody>
              {cashbook.map((entry) => (
                <tr key={entry._id}>
                  <td>{new Date(entry.date).toLocaleDateString()}</td>
                  <td>{entry.description || "-"}</td>
                  <td>{Number(entry.amount || 0).toFixed(2)}</td>
                  <td>{entry.reference || "-"}</td>
                </tr>
              ))}
              {cashbook.length === 0 ? (
                <tr>
                  <td colSpan={4} className="muted">
                    No cashbook entries yet.
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
