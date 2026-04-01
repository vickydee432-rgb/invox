"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

type BranchPerf = { branchId: string; branchName: string; totalRevenue: number; invoiceCount: number; growthRate: number | null };
type EmployeePerf = { name: string; totalSales: number; invoices: number; avgInvoiceValue: number };
type ProductInsight = { name: string; revenue: number; quantity: number };

type SuperAdminOverview = {
  overview: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    invoicesCount: number;
    activeBranchesCount: number;
    range: { from: string | null; to: string | null };
  };
  branchPerformance: BranchPerf[];
  employeePerformance: EmployeePerf[];
  productInsights: ProductInsight[];
  timeseries: { period: string; revenue: number; expenses: number; profit: number }[];
  alerts: any[];
};

const formatCurrency = (value = 0) => `ZMW ${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SuperAdminDashboard() {
  const [data, setData] = useState<SuperAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<"day" | "week" | "month" | "quarter">("month");
  const [range, setRange] = useState({ from: "", to: "" });

  const fetchDashboard = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("groupBy", period);
      if (range.from) params.set("from", range.from);
      if (range.to) params.set("to", range.to);
      const apiData = await apiFetch<SuperAdminOverview>(`/api/admin/overview?${params.toString()}`);
      setData(apiData);
    } catch (err: any) {
      setError(err?.message || "Failed to load super admin analytics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const now = new Date();
    const lastMonth = new Date();
    lastMonth.setMonth(now.getMonth() - 1);
    setRange({ from: lastMonth.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) });
  }, []);

  useEffect(() => {
    if (!range.from || !range.to) return;
    fetchDashboard();
  }, [period, range.from, range.to]);

  const alerts = useMemo(() => data?.alerts || [], [data]);

  if (loading) return <div className="p-6">Loading Super Admin dashboard...</div>;
  if (error) return <div className="p-6 text-red-500">Error: {error}</div>;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Super Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg bg-white shadow-sm">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-2xl font-semibold">{formatCurrency(data?.overview.totalRevenue)}</p>
        </div>
        <div className="p-4 border rounded-lg bg-white shadow-sm">
          <p className="text-sm text-gray-500">Total Expenses</p>
          <p className="text-2xl font-semibold">{formatCurrency(data?.overview.totalExpenses)}</p>
        </div>
        <div className="p-4 border rounded-lg bg-white shadow-sm">
          <p className="text-sm text-gray-500">Net Profit</p>
          <p className="text-2xl font-semibold">{formatCurrency(data?.overview.netProfit)}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-3 border rounded-lg">Total Invoices: {data?.overview.invoicesCount}</div>
        <div className="p-3 border rounded-lg">Active Branches: {data?.overview.activeBranchesCount}</div>
        <div className="p-3 border rounded-lg">Range: {data?.overview.range.from} to {data?.overview.range.to}</div>
        <div className="p-3 border rounded-lg">Group By: {period.toUpperCase()}</div>
      </div>

      <div className="flex gap-2 items-center">
        <button onClick={() => setPeriod("day")} className="px-2 py-1 border rounded">Day</button>
        <button onClick={() => setPeriod("week")} className="px-2 py-1 border rounded">Week</button>
        <button onClick={() => setPeriod("month")} className="px-2 py-1 border rounded">Month</button>
        <button onClick={() => setPeriod("quarter")} className="px-2 py-1 border rounded">Quarter</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 border rounded-lg bg-white">
          <h2 className="font-semibold mb-2">Revenue & Expenses Trend</h2>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <AreaChart data={data?.timeseries || []}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Area type="monotone" dataKey="revenue" stroke="#10B981" fillOpacity={1} fill="url(#colorRevenue)" />
                <Area type="monotone" dataKey="expenses" stroke="#EF4444" fillOpacity={0.2} fill="#FECACA" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-4 border rounded-lg bg-white">
          <h2 className="font-semibold mb-2">Profit Trend</h2>
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={data?.timeseries || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="profit" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg bg-white">
          <h2 className="font-semibold mb-3">Top Branches</h2>
          <ul className="space-y-1">
            {(data?.branchPerformance || []).slice(0, 8).map((branch) => (
              <li key={branch.branchId} className="flex justify-between">
                <span>{branch.branchName}</span>
                <span className="font-semibold">{formatCurrency(branch.totalRevenue)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 border rounded-lg bg-white">
          <h2 className="font-semibold mb-3">Top Employees</h2>
          <ul className="space-y-1">
            {(data?.employeePerformance || []).slice(0, 8).map((employee) => (
              <li key={employee.name} className="flex justify-between">
                <span>{employee.name}</span>
                <span className="font-semibold">{formatCurrency(employee.totalSales)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="p-4 border rounded-lg bg-white">
          <h2 className="font-semibold mb-3">Top Products</h2>
          <ul className="space-y-1">
            {(data?.productInsights || []).slice(0, 8).map((product) => (
              <li key={product.name} className="flex justify-between">
                <span>{product.name}</span>
                <span className="font-semibold">{formatCurrency(product.revenue)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="p-4 border rounded-lg bg-white">
        <h2 className="font-semibold mb-3">Alerts</h2>
        {alerts.length ? (
          <ul className="space-y-2">
            {alerts.map((alert, idx) => (
              <li key={idx} className="p-2 border rounded bg-red-50">
                <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(alert, null, 2)}</pre>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-sm text-gray-500">No alerts.</div>
        )}
      </div>
    </div>
  );
}
