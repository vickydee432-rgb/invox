"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";
import LedgerPreview, { LedgerPreviewLine } from "@/components/LedgerPreview";

type Employee = {
  _id: string;
  firstName: string;
  lastName: string;
  department?: string;
  status?: string;
};

type SalaryStructure = {
  _id: string;
  employeeId: string;
  baseSalary: number;
};

type PayrunTotals = {
  gross: number;
  paye: number;
  napsa: number;
  nima: number;
  net: number;
};

export default function PayrollPage() {
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [structures, setStructures] = useState<SalaryStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [department, setDepartment] = useState("");

  const [salaryEmployeeId, setSalaryEmployeeId] = useState("");
  const [baseSalary, setBaseSalary] = useState(0);
  const [allowanceName, setAllowanceName] = useState("");
  const [allowanceAmount, setAllowanceAmount] = useState(0);
  const [deductionName, setDeductionName] = useState("");
  const [deductionAmount, setDeductionAmount] = useState(0);

  const [payrunPeriod, setPayrunPeriod] = useState("");
  const [payrunTotals, setPayrunTotals] = useState<PayrunTotals | null>(null);
  const [payrunCount, setPayrunCount] = useState(0);

  const loadData = async () => {
    setLoading(true);
    setError("");
    try {
      const [employeeData, structureData] = await Promise.all([
        apiFetch<{ employees: Employee[] }>("/api/payroll/employees"),
        apiFetch<{ structures: SalaryStructure[] }>("/api/payroll/salary-structures")
      ]);
      setEmployees(employeeData.employees || []);
      setStructures(structureData.structures || []);
      if (!salaryEmployeeId && employeeData.employees?.length) {
        setSalaryEmployeeId(employeeData.employees[0]._id);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load payroll data");
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
    if (!payrunPeriod) {
      const now = new Date();
      setPayrunPeriod(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
    }
  }, [payrunPeriod]);

  useEffect(() => {
    loadData();
  }, []);

  const ledgerLines = useMemo(() => {
    if (!payrunTotals) return [];
    const lines: LedgerPreviewLine[] = [
      { accountKey: "payrollExpense", label: "Payroll expense", debit: payrunTotals.gross },
      { accountKey: "payePayable", label: "PAYE payable", credit: payrunTotals.paye },
      { accountKey: "napsaPayable", label: "NAPSA payable", credit: payrunTotals.napsa },
      { accountKey: "nimaPayable", label: "NIMA payable", credit: payrunTotals.nima },
      { accountKey: "netSalaryPayable", label: "Net salary payable", credit: payrunTotals.net }
    ];
    return lines;
  }, [payrunTotals]);

  const handleAddEmployee = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await apiFetch("/api/payroll/employees", {
        method: "POST",
        body: JSON.stringify({
          firstName,
          lastName,
          department: department || undefined
        })
      });
      setFirstName("");
      setLastName("");
      setDepartment("");
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to add employee");
    }
  };

  const handleSaveStructure = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const allowances = allowanceName ? [{ name: allowanceName, amount: allowanceAmount }] : [];
      const deductions = deductionName ? [{ name: deductionName, amount: deductionAmount }] : [];
      await apiFetch("/api/payroll/salary-structures", {
        method: "POST",
        body: JSON.stringify({
          employeeId: salaryEmployeeId,
          baseSalary,
          allowances,
          deductions
        })
      });
      setAllowanceName("");
      setAllowanceAmount(0);
      setDeductionName("");
      setDeductionAmount(0);
      await loadData();
    } catch (err: any) {
      setError(err.message || "Failed to save salary structure");
    }
  };

  const handleGeneratePayrun = async () => {
    setError("");
    try {
      const result = await apiFetch<{ totals: PayrunTotals; count: number }>("/api/payroll/payruns/generate", {
        method: "POST",
        body: JSON.stringify({ period: payrunPeriod })
      });
      setPayrunTotals(result.totals);
      setPayrunCount(result.count || 0);
    } catch (err: any) {
      setError(err.message || "Failed to generate payrun");
    }
  };

  if (workspace && !workspace.enabledModules.includes("payroll")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.payroll || "Payroll"}</div>
        <div className="muted">Payroll is disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => (window.location.href = "/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <div className="panel-title">{workspace?.labels?.payroll || "Payroll"}</div>
        <div className="muted">Manage employees, salary structures, and payruns.</div>
        {error ? <div className="muted">{error}</div> : null}
      </section>

      <section className="panel">
        <div className="panel-title">Employees</div>
        <form onSubmit={handleAddEmployee} className="grid-2" style={{ marginBottom: 16 }}>
          <label className="field">
            First name
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </label>
          <label className="field">
            Last name
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </label>
          <label className="field">
            Department
            <input value={department} onChange={(e) => setDepartment(e.target.value)} />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="submit">
              Add employee
            </button>
          </div>
        </form>
        {loading ? (
          <div className="muted">Loading employees...</div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Department</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((employee) => (
                  <tr key={employee._id}>
                    <td>
                      {employee.firstName} {employee.lastName}
                    </td>
                    <td>{employee.department || "-"}</td>
                    <td>{employee.status || "active"}</td>
                  </tr>
                ))}
                {employees.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No employees yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Salary Structure</div>
        <form onSubmit={handleSaveStructure} className="grid-2">
          <label className="field">
            Employee
            <select value={salaryEmployeeId} onChange={(e) => setSalaryEmployeeId(e.target.value)}>
              <option value="">Select employee</option>
              {employees.map((employee) => (
                <option key={employee._id} value={employee._id}>
                  {employee.firstName} {employee.lastName}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Base salary
            <input value={baseSalary} onChange={(e) => setBaseSalary(Number(e.target.value))} type="number" min={0} />
          </label>
          <label className="field">
            Allowance name
            <input value={allowanceName} onChange={(e) => setAllowanceName(e.target.value)} />
          </label>
          <label className="field">
            Allowance amount
            <input
              value={allowanceAmount}
              onChange={(e) => setAllowanceAmount(Number(e.target.value))}
              type="number"
              min={0}
            />
          </label>
          <label className="field">
            Deduction name
            <input value={deductionName} onChange={(e) => setDeductionName(e.target.value)} />
          </label>
          <label className="field">
            Deduction amount
            <input
              value={deductionAmount}
              onChange={(e) => setDeductionAmount(Number(e.target.value))}
              type="number"
              min={0}
            />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="submit">
              Save structure
            </button>
          </div>
        </form>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Base salary</th>
              </tr>
            </thead>
            <tbody>
              {structures.map((structure) => {
                const employee = employees.find((emp) => emp._id === structure.employeeId);
                return (
                  <tr key={structure._id}>
                    <td>{employee ? `${employee.firstName} ${employee.lastName}` : structure.employeeId}</td>
                    <td>{Number(structure.baseSalary || 0).toFixed(2)}</td>
                  </tr>
                );
              })}
              {structures.length === 0 ? (
                <tr>
                  <td colSpan={2} className="muted">
                    No salary structures saved.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">Generate Payrun</div>
        <div className="grid-2">
          <label className="field">
            Period
            <input value={payrunPeriod} onChange={(e) => setPayrunPeriod(e.target.value)} placeholder="YYYY-MM" />
          </label>
          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <button className="button" type="button" onClick={handleGeneratePayrun}>
              Run payroll
            </button>
          </div>
        </div>
        {payrunTotals ? (
          <div style={{ marginTop: 16, display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div className="badge">Employees: {payrunCount}</div>
            <div className="badge">Gross: {payrunTotals.gross.toFixed(2)}</div>
            <div className="badge">Net: {payrunTotals.net.toFixed(2)}</div>
          </div>
        ) : null}
      </section>

      {workspace?.enabledModules?.includes("accounting") && payrunTotals ? (
        <LedgerPreview title="Ledger impact" lines={ledgerLines} />
      ) : null}
    </>
  );
}
