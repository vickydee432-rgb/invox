"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

type SaleItem = {
  productId?: string;
  productSku?: string;
  productName?: string;
  phoneItemId?: string;
  phoneImei?: string;
  phoneSerial?: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount?: number;
};

type Branch = {
  _id: string;
  name: string;
  isDefault?: boolean;
};

type Product = {
  _id: string;
  name: string;
  sku?: string;
  salePrice?: number;
};

type User = { _id: string; name: string };

type Customer = { _id: string; name: string; phone?: string };

type TradeIn = {
  _id: string;
  tradeInNo: string;
  customerName?: string;
  creditAmount?: number;
  agreedAmount?: number;
  status: string;
};

type PhoneItem = {
  _id: string;
  brand: string;
  model: string;
  storage?: string;
  color?: string;
  condition?: string;
  imei?: string;
  serial?: string;
  salePrice?: number;
  status: string;
};

function NewSalePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tradeInParam = searchParams.get("tradeInId");
  const [users, setUsers] = useState<User[]>([]);
  const [salespersonId, setSalespersonId] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("Walk-in");
  const [customerPhone, setCustomerPhone] = useState("");
  const [status, setStatus] = useState("paid");
  const [amountPaid, setAmountPaid] = useState(0);
  const [issueDate, setIssueDate] = useState("");
  const [vatRate, setVatRate] = useState(0);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<SaleItem[]>([{ description: "", qty: 1, unitPrice: 0, discount: 0 }]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceConfig | null>(null);
  const [tradeIns, setTradeIns] = useState<TradeIn[]>([]);
  const [tradeInId, setTradeInId] = useState("");
  const [tradeInCredit, setTradeInCredit] = useState(0);
  const [phoneLookup, setPhoneLookup] = useState("");
  const [phoneLookupLoading, setPhoneLookupLoading] = useState(false);
  const [phoneLookupError, setPhoneLookupError] = useState("");
  const [reservePhoneOnAdd, setReservePhoneOnAdd] = useState(true);
  const [releaseBusy, setReleaseBusy] = useState(false);
  const [releaseError, setReleaseError] = useState("");
  const [releaseSuccess, setReleaseSuccess] = useState("");

  const itemsSubtotal = items.reduce(
    (sum, item) => sum + Math.max(0, item.qty * item.unitPrice - (item.discount || 0)),
    0
  );
  const vatAmount = (itemsSubtotal * (Number(vatRate) || 0)) / 100;
  const total = itemsSubtotal + vatAmount;

  useEffect(() => {
    if (!issueDate) setIssueDate(new Date().toISOString().slice(0, 10));
  }, [issueDate]);

  useEffect(() => {
    if (status === "paid") {
      setAmountPaid(Math.max(0, total - (Number(tradeInCredit) || 0)));
    }
  }, [status, total, tradeInCredit]);

  useEffect(() => {
    let mounted = true;
    apiFetch<{ company: any }>("/api/company/me")
      .then((data) => {
        if (!mounted) return;
        const config = buildWorkspace(data.company);
        setWorkspace(config);
        if (config.businessType === "retail") {
          setStatus("paid");
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    Promise.all([apiFetch<{ user: any }>("/api/auth/me"), apiFetch<{ users: User[] }>("/api/users")])
      .then(([me, data]) => {
        if (!mounted) return;
        setUsers(data.users || []);
        if (!salespersonId && me?.user?._id) setSalespersonId(me.user._id);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [salespersonId]);

  useEffect(() => {
    let mounted = true;
    if (!workspace?.enabledModules?.includes("customers")) {
      setCustomers([]);
      return () => {
        mounted = false;
      };
    }
    apiFetch<{ customers: Customer[] }>("/api/customers?limit=500")
      .then((data) => {
        if (!mounted) return;
        setCustomers(data.customers || []);
      })
      .catch(() => setCustomers([]));
    return () => {
      mounted = false;
    };
  }, [workspace]);

  useEffect(() => {
    let mounted = true;
    if (!tradeInParam) return () => {
      mounted = false;
    };
    if (tradeInId) return () => {
      mounted = false;
    };
    apiFetch<{ tradeIn: any }>(`/api/trade-ins/${encodeURIComponent(tradeInParam)}`)
      .then((data) => {
        if (!mounted) return;
        const ti = data.tradeIn;
        if (!ti?._id) return;
        setTradeInId(ti._id);
        const credit = Number(ti.creditAmount ?? ti.agreedAmount ?? 0);
        setTradeInCredit(Math.max(0, credit));
        if (ti.customerName && customerName === "Walk-in") setCustomerName(ti.customerName);
        if (ti.customerPhone && !customerPhone) setCustomerPhone(ti.customerPhone);
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [tradeInParam, tradeInId, customerName, customerPhone]);

  useEffect(() => {
    let mounted = true;
    if (!workspace?.enabledModules?.includes("tradeins")) {
      setTradeIns([]);
      return () => {
        mounted = false;
      };
    }
    apiFetch<{ tradeIns: TradeIn[] }>("/api/trade-ins?unapplied=true&limit=300")
      .then((data) => {
        if (!mounted) return;
        setTradeIns(data.tradeIns || []);
      })
      .catch(() => setTradeIns([]));
    return () => {
      mounted = false;
    };
  }, [workspace]);

  useEffect(() => {
    let mounted = true;
    if (workspace && !workspace.inventoryEnabled) {
      setBranches([]);
      setProducts([]);
      return () => {
        mounted = false;
      };
    }
    Promise.all([
      apiFetch<{ branches: Branch[] }>("/api/branches"),
      apiFetch<{ products: Product[] }>("/api/products")
    ])
      .then(([branchData, productData]) => {
        if (!mounted) return;
        setBranches(branchData.branches || []);
        setProducts(productData.products || []);
        const defaultBranch = (branchData.branches || []).find((branch) => branch.isDefault);
        if (defaultBranch && !branchId) {
          setBranchId(defaultBranch._id);
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, [branchId, workspace]);

  const updateItem = (index: number, next: Partial<SaleItem>) => {
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...next } : item)));
  };

  const addItem = () => {
    setItems((prev) => [...prev, { description: "", qty: 1, unitPrice: 0, discount: 0 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, idx) => idx !== index)));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await apiFetch("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          customerId: customerId || undefined,
          customerName: customerName || "Walk-in",
          customerPhone: customerPhone || undefined,
          salespersonId: salespersonId || undefined,
          tradeInId: tradeInId || undefined,
          status,
          amountPaid,
          issueDate,
          vatRate: workspace?.taxEnabled === false ? 0 : vatRate,
          branchId: branchId || undefined,
          items: items.map((item) => ({
            productId: item.productId || undefined,
            productSku: item.productSku || undefined,
            productName: item.productName || undefined,
            phoneItemId: item.phoneItemId || undefined,
            description: item.description,
            qty: item.qty,
            unitPrice: item.unitPrice,
            discount: item.discount || 0
          }))
        })
      });
      router.push("/sales");
    } catch (err: any) {
      setError(err.message || "Failed to create sale");
    } finally {
      setSaving(false);
    }
  };

  const addPhoneToItems = async () => {
    const value = phoneLookup.trim();
    if (!value) return;
    setPhoneLookupLoading(true);
    setPhoneLookupError("");
    try {
      const query = new URLSearchParams();
      query.set("imei", value);
      const data = await apiFetch<{ item: PhoneItem }>(`/api/phone-inventory/lookup?${query.toString()}`);
      const phone = data.item;
      if (!phone?._id) throw new Error("Phone not found");
      if (reservePhoneOnAdd && phone.status === "in_stock") {
        await apiFetch(`/api/phone-inventory/${phone._id}`, {
          method: "PATCH",
          body: JSON.stringify({ status: "reserved" })
        });
      }
      setItems((prev) => [
        ...prev,
        {
          phoneItemId: phone._id,
          phoneImei: phone.imei,
          phoneSerial: phone.serial,
          description: [phone.brand, phone.model, phone.storage, phone.color, phone.condition]
            .filter(Boolean)
            .join(" "),
          qty: 1,
          unitPrice: Number(phone.salePrice || 0),
          discount: 0
        }
      ]);
      setPhoneLookup("");
    } catch (err: any) {
      setPhoneLookupError(err.message || "Failed to lookup phone");
    } finally {
      setPhoneLookupLoading(false);
    }
  };

  const releasePhoneReservations = async () => {
    setReleaseBusy(true);
    setReleaseError("");
    setReleaseSuccess("");
    try {
      const phoneIds = items.map((i) => i.phoneItemId).filter(Boolean) as string[];
      if (phoneIds.length === 0) {
        setReleaseSuccess("No phone reservations to release.");
        return;
      }
      await Promise.all(
        phoneIds.map((id) =>
          apiFetch(`/api/phone-inventory/${id}`, { method: "PATCH", body: JSON.stringify({ status: "in_stock" }) })
        )
      );
      setItems((prev) => prev.filter((row) => !row.phoneItemId));
      setReleaseSuccess("Released phone reservation(s).");
    } catch (err: any) {
      setReleaseError(err.message || "Failed to release reservation(s)");
    } finally {
      setReleaseBusy(false);
    }
  };

  if (workspace && !workspace.enabledModules.includes("sales")) {
    return (
      <section className="panel">
        <div className="panel-title">{workspace.labels?.sales || "Sales"}</div>
        <div className="muted">Sales are disabled for this workspace.</div>
        <button className="button" type="button" onClick={() => router.push("/settings")}>
          Update workspace
        </button>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-title">Add Sale</div>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        <div className="grid-2">
          <label className="field">
            Salesperson
            <select value={salespersonId} onChange={(e) => setSalespersonId(e.target.value)}>
              <option value="">Unassigned</option>
              {users.map((u) => (
                <option key={u._id} value={u._id}>
                  {u.name}
                </option>
              ))}
            </select>
          </label>
          {workspace?.enabledModules?.includes("customers") ? (
            <label className="field">
              Customer (optional)
              <select
                value={customerId}
                onChange={(e) => {
                  const nextId = e.target.value;
                  setCustomerId(nextId);
                  const selected = customers.find((c) => c._id === nextId);
                  if (!selected) return;
                  setCustomerName(selected.name || "Walk-in");
                  setCustomerPhone(selected.phone || "");
                }}
              >
                <option value="">Manual / Walk-in</option>
                {customers.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <div />
          )}
        </div>
        {workspace?.enabledModules?.includes("tradeins") ? (
          <div className="grid-2">
            <label className="field">
              Trade-in (optional)
              <select
                value={tradeInId}
                onChange={(e) => {
                  const next = e.target.value;
                  setTradeInId(next);
                  const row = tradeIns.find((t) => t._id === next);
                  const credit = Number(row?.creditAmount ?? row?.agreedAmount ?? 0);
                  setTradeInCredit(Math.max(0, credit));
                }}
              >
                <option value="">No trade-in</option>
                {tradeIns.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.tradeInNo}
                    {t.customerName ? ` • ${t.customerName}` : ""}
                    {" • "}Credit {Number(t.creditAmount ?? t.agreedAmount ?? 0).toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
            <div className="field">
              Credit applied
              <div style={{ padding: "10px 12px", border: "1px solid var(--border)", borderRadius: 10 }}>
                {Number(tradeInCredit || 0).toFixed(2)}
              </div>
            </div>
          </div>
        ) : null}
        <div className="grid-2">
          <label className="field">
            Customer name
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </label>
          <label className="field">
            Customer phone
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </label>
          <label className="field">
            Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="paid">Paid</option>
              <option value="partial">Partial</option>
              <option value="unpaid">Unpaid</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>
          <label className="field">
            Cash paid
            <input
              value={amountPaid}
              onChange={(e) => setAmountPaid(Number(e.target.value))}
              type="number"
              min={0}
            />
          </label>
          <label className="field">
            Date
            <input value={issueDate} onChange={(e) => setIssueDate(e.target.value)} type="date" required />
          </label>
          {workspace?.taxEnabled !== false ? (
            <label className="field">
              VAT rate %
              <input value={vatRate} onChange={(e) => setVatRate(Number(e.target.value))} type="number" min={0} />
            </label>
          ) : null}
          {workspace?.inventoryEnabled ? (
            <label className="field">
              Branch
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Select branch</option>
                {branches.map((branch) => (
                  <option key={branch._id} value={branch._id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {workspace?.inventoryEnabled ? (
          <div className="grid-2">
            <label className="field">
              Add phone by IMEI
              <input
                value={phoneLookup}
                onChange={(e) => setPhoneLookup(e.target.value)}
                placeholder="Type IMEI and click Add"
              />
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
              <button
                className="button secondary"
                type="button"
                onClick={addPhoneToItems}
                disabled={phoneLookupLoading || !phoneLookup.trim()}
              >
                {phoneLookupLoading ? "Adding..." : "Add phone"}
              </button>
              <label className="field" style={{ flexDirection: "row", gap: 8, alignItems: "center", margin: 0 }}>
                <input
                  type="checkbox"
                  checked={reservePhoneOnAdd}
                  onChange={(e) => setReservePhoneOnAdd(e.target.checked)}
                />
                Reserve on add
              </label>
              {phoneLookupError ? <div className="muted">{phoneLookupError}</div> : null}
            </div>
          </div>
        ) : null}

        <div style={{ display: "grid", gap: 10 }}>
          {items.map((item, index) => (
            <div key={index} className="grid-2">
              <label className="field">
                Product
                <select
                  value={item.productId || ""}
                  disabled={Boolean(item.phoneItemId)}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    if (!nextId) {
                      updateItem(index, {
                        productId: undefined,
                        productSku: undefined,
                        productName: undefined,
                        phoneItemId: undefined,
                        phoneImei: undefined,
                        phoneSerial: undefined
                      });
                      return;
                    }
                    const product = products.find((p) => p._id === nextId);
                    updateItem(index, {
                      productId: nextId,
                      productSku: product?.sku,
                      productName: product?.name,
                      phoneItemId: undefined,
                      phoneImei: undefined,
                      phoneSerial: undefined,
                      description: product?.name || item.description,
                      unitPrice: Number(product?.salePrice || 0)
                    });
                  }}
                >
                  <option value="">Custom item</option>
                  {products.map((product) => (
                    <option key={product._id} value={product._id}>
                      {product.name}
                      {product.sku ? ` (${product.sku})` : ""}
                    </option>
                  ))}
                </select>
                {item.phoneItemId ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Phone item: {item.phoneImei || item.phoneSerial || item.phoneItemId}
                  </div>
                ) : null}
              </label>
              <label className="field">
                Description
                <input
                  value={item.description}
                  onChange={(e) => updateItem(index, { description: e.target.value })}
                  required
                />
              </label>
              <label className="field">
                Quantity
                <input
                  value={item.phoneItemId ? 1 : item.qty}
                  onChange={(e) => {
                    if (item.phoneItemId) return;
                    updateItem(index, { qty: Number(e.target.value) });
                  }}
                  type="number"
                  min={0}
                  required
                  disabled={Boolean(item.phoneItemId)}
                />
              </label>
              <label className="field">
                Unit price
                <input
                  value={item.unitPrice}
                  onChange={(e) => updateItem(index, { unitPrice: Number(e.target.value) })}
                  type="number"
                  min={0}
                  required
                />
              </label>
              <label className="field">
                Discount
                <input
                  value={item.discount || 0}
                  onChange={(e) => updateItem(index, { discount: Number(e.target.value) })}
                  type="number"
                  min={0}
                />
              </label>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button className="button secondary" type="button" onClick={() => removeItem(index)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button className="button secondary" type="button" onClick={addItem}>
            Add item
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div className="badge">Total {total.toFixed(2)}</div>
          <button className="button" type="submit" disabled={saving}>
            {saving ? "Saving..." : "Save sale"}
          </button>
          <button className="button secondary" type="button" onClick={releasePhoneReservations} disabled={releaseBusy || saving}>
            {releaseBusy ? "Releasing..." : "Release phone reservations"}
          </button>
          <button className="button secondary" type="button" onClick={() => router.push("/sales")}>
            Cancel
          </button>
          {error ? <div className="muted">{error}</div> : null}
          {releaseError ? <div className="muted">{releaseError}</div> : null}
          {releaseSuccess ? <div className="muted">{releaseSuccess}</div> : null}
        </div>
      </form>
    </section>
  );
}

export default function NewSalePage() {
  return (
    <Suspense
      fallback={
        <section className="panel">
          <div className="panel-title">Add Sale</div>
          <div className="muted">Loading...</div>
        </section>
      }
    >
      <NewSalePageContent />
    </Suspense>
  );
}
