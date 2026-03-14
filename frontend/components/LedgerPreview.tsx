"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";

type Account = {
  _id: string;
  code?: string;
  name: string;
  type: string;
};

type Company = {
  accountingEnabled?: boolean;
  accountingDefaults?: Record<string, string>;
  currency?: string;
};

export type LedgerPreviewLine = {
  accountKey: string;
  label: string;
  debit?: number;
  credit?: number;
};

type LedgerPreviewProps = {
  title?: string;
  lines: LedgerPreviewLine[];
  hint?: string;
};

const formatMoney = (value: number) => value.toFixed(2);

export default function LedgerPreview({ title = "Ledger impact", lines, hint }: LedgerPreviewProps) {
  const [company, setCompany] = useState<Company | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError("");
    Promise.allSettled([apiFetch<{ company: Company }>("/api/company/me"), apiFetch<{ accounts: Account[] }>("/api/accounting/accounts")])
      .then(([companyResult, accountsResult]) => {
        if (!active) return;
        if (companyResult.status === "fulfilled") {
          setCompany(companyResult.value.company);
        }
        if (accountsResult.status === "fulfilled") {
          setAccounts(accountsResult.value.accounts || []);
        }
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(err.message || "Failed to load accounting settings");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const resolvedLines = useMemo(() => {
    const defaults = company?.accountingDefaults || {};
    return lines.map((line) => {
      const accountId = defaults[line.accountKey];
      const account = accounts.find((item) => String(item._id) === String(accountId));
      return {
        ...line,
        accountId,
        accountName: account?.name,
        accountCode: account?.code
      };
    });
  }, [lines, company, accounts]);

  const totals = resolvedLines.reduce(
    (acc, line) => {
      acc.debit += Number(line.debit || 0);
      acc.credit += Number(line.credit || 0);
      return acc;
    },
    { debit: 0, credit: 0 }
  );

  const missingDefaults = resolvedLines.filter((line) => !line.accountId);
  const accountingDisabled = company?.accountingEnabled === false;

  return (
    <section className="panel">
      <div className="panel-title">{title}</div>
      {loading ? <div className="muted">Loading accounting defaults…</div> : null}
      {!loading && loadError ? <div className="muted">{loadError}</div> : null}
      {!loading && accountingDisabled ? (
        <div className="muted">Accounting is disabled for this workspace. Enable it in Settings to post journals.</div>
      ) : null}
      {!loading && !accountingDisabled && missingDefaults.length > 0 ? (
        <div className="muted">
          Missing default accounts: {missingDefaults.map((line) => line.label).join(", ")}. Update defaults in the
          company profile to enable posting.
        </div>
      ) : null}

      <div className="table-wrap" style={{ marginTop: 12 }}>
        <table className="table">
          <thead>
            <tr>
              <th>Account</th>
              <th>Debit</th>
              <th>Credit</th>
            </tr>
          </thead>
          <tbody>
            {resolvedLines.map((line, index) => (
              <tr key={`${line.accountKey}-${index}`}>
                <td>
                  {line.accountName
                    ? `${line.accountName}${line.accountCode ? ` (${line.accountCode})` : ""}`
                    : `${line.label} (not linked)`}
                </td>
                <td>{formatMoney(Number(line.debit || 0))}</td>
                <td>{formatMoney(Number(line.credit || 0))}</td>
              </tr>
            ))}
            {resolvedLines.length === 0 ? (
              <tr>
                <td colSpan={3} className="muted">
                  No ledger impact yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 24, marginTop: 12, flexWrap: "wrap" }}>
        <div className="muted">Total debit: {formatMoney(totals.debit)}</div>
        <div className="muted">Total credit: {formatMoney(totals.credit)}</div>
      </div>
      {hint ? <div className="muted" style={{ marginTop: 8 }}>{hint}</div> : null}
    </section>
  );
}
