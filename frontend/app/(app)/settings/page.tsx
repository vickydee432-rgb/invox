"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { buildWorkspace, WorkspaceConfig } from "@/lib/workspace";

const MODULE_OPTIONS = [
  { key: "quotes", label: "Quotes" },
  { key: "invoices", label: "Invoices" },
  { key: "expenses", label: "Expenses" },
  { key: "projects", label: "Projects" },
  { key: "inventory", label: "Inventory" },
  { key: "reports", label: "Reports" }
];

const BUSINESS_TYPES: { value: WorkspaceConfig["businessType"]; label: string; note: string }[] = [
  { value: "retail", label: "Retail", note: "Sales receipts, inventory, quick expenses." },
  { value: "construction", label: "Construction", note: "Quotes → invoices, projects, VAT/ZRA." },
  { value: "agency", label: "Agency", note: "Projects + client billing with quotes." },
  { value: "services", label: "Services", note: "Invoices + expenses, no projects." },
  { value: "freelance", label: "Freelance", note: "Simple invoicing and expenses." }
];

const LABEL_FIELDS: { key: string; label: string }[] = [
  { key: "dashboard", label: "Dashboard label" },
  { key: "quotes", label: "Quotes label" },
  { key: "invoices", label: "Invoices label" },
  { key: "invoiceSingular", label: "Invoice singular label" },
  { key: "expenses", label: "Expenses label" },
  { key: "projects", label: "Projects label" },
  { key: "inventory", label: "Inventory label" },
  { key: "reports", label: "Reports label" }
];

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

type TeamUser = {
  _id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member";
  createdAt?: string;
};

type TeamInvite = {
  _id: string;
  email: string;
  role: "owner" | "admin" | "member";
  createdAt?: string;
  expiresAt?: string;
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
    seatLimit?: number | null;
    seatsUsed?: number;
  } | null>(null);
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState("");
  const [teamUsers, setTeamUsers] = useState<TeamUser[]>([]);
  const [teamInvites, setTeamInvites] = useState<TeamInvite[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [teamError, setTeamError] = useState("");
  const [teamSuccess, setTeamSuccess] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "member">("member");
  const [inviteLink, setInviteLink] = useState("");
  const [currentUserRole, setCurrentUserRole] = useState<"owner" | "admin" | "member">("member");
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
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceSaving, setWorkspaceSaving] = useState(false);
  const [workspaceError, setWorkspaceError] = useState("");
  const [workspaceSuccess, setWorkspaceSuccess] = useState("");
  const [businessType, setBusinessType] = useState<WorkspaceConfig["businessType"]>("construction");
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [projectTrackingEnabled, setProjectTrackingEnabled] = useState(true);
  const [labels, setLabels] = useState<WorkspaceConfig["labels"]>({});

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

  const loadWorkspace = async () => {
    setWorkspaceLoading(true);
    setWorkspaceError("");
    try {
      const data = await apiFetch<{
        businessType: WorkspaceConfig["businessType"];
        enabledModules: string[];
        labels: Record<string, string>;
        taxEnabled: boolean;
        inventoryEnabled: boolean;
        projectTrackingEnabled: boolean;
      }>("/api/company/workspace");
      const config = buildWorkspace({
        businessType: data.businessType,
        enabledModules: data.enabledModules,
        labels: data.labels,
        taxEnabled: data.taxEnabled,
        inventoryEnabled: data.inventoryEnabled,
        projectTrackingEnabled: data.projectTrackingEnabled
      });
      setBusinessType(config.businessType);
      setEnabledModules(config.enabledModules);
      setTaxEnabled(config.taxEnabled);
      setInventoryEnabled(config.inventoryEnabled);
      setProjectTrackingEnabled(config.projectTrackingEnabled);
      setLabels(config.labels);
    } catch (err: any) {
      setWorkspaceError(err.message || "Failed to load workspace");
    } finally {
      setWorkspaceLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<{ user: { role?: "owner" | "admin" | "member" } }>("/api/auth/me")
      .then((data) => {
        if (!active) return;
        if (data.user?.role) setCurrentUserRole(data.user.role);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const loadTeam = async () => {
    setTeamLoading(true);
    setTeamError("");
    try {
      const data = await apiFetch<{
        users: TeamUser[];
        invites: TeamInvite[];
        seatLimit?: number | null;
        seatsUsed?: number;
      }>("/api/users");
      setTeamUsers(data.users || []);
      setTeamInvites(data.invites || []);
      setBillingStatus((prev) =>
        prev
          ? { ...prev, seatLimit: data.seatLimit ?? prev.seatLimit, seatsUsed: data.seatsUsed ?? prev.seatsUsed }
          : prev
      );
    } catch (err: any) {
      setTeamError(err.message || "Failed to load team");
    } finally {
      setTeamLoading(false);
    }
  };

  useEffect(() => {
    loadTeam();
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
        seatLimit?: number | null;
        seatsUsed?: number;
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
    if (taxEnabled) {
      loadZraStatus();
    } else {
      setZraConnections([]);
    }
  }, [taxEnabled]);

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

  const handleBusinessTypeChange = (nextType: WorkspaceConfig["businessType"]) => {
    const config = buildWorkspace({ businessType: nextType });
    setBusinessType(config.businessType);
    setEnabledModules(config.enabledModules);
    setTaxEnabled(config.taxEnabled);
    setInventoryEnabled(config.inventoryEnabled);
    setProjectTrackingEnabled(config.projectTrackingEnabled);
    setLabels(config.labels);
  };

  const toggleModule = (moduleKey: string) => {
    setEnabledModules((prev) => {
      const hasModule = prev.includes(moduleKey);
      const next = hasModule ? prev.filter((key) => key !== moduleKey) : [...prev, moduleKey];
      if (moduleKey === "inventory") setInventoryEnabled(!hasModule);
      if (moduleKey === "projects") setProjectTrackingEnabled(!hasModule);
      return next;
    });
  };

  const handleInventoryToggle = (checked: boolean) => {
    setInventoryEnabled(checked);
    setEnabledModules((prev) => {
      const hasModule = prev.includes("inventory");
      if (checked && !hasModule) return [...prev, "inventory"];
      if (!checked && hasModule) return prev.filter((key) => key !== "inventory");
      return prev;
    });
  };

  const handleProjectToggle = (checked: boolean) => {
    setProjectTrackingEnabled(checked);
    setEnabledModules((prev) => {
      const hasModule = prev.includes("projects");
      if (checked && !hasModule) return [...prev, "projects"];
      if (!checked && hasModule) return prev.filter((key) => key !== "projects");
      return prev;
    });
  };

  const handleLabelChange = (key: string, value: string) => {
    setLabels((prev) => ({ ...prev, [key]: value }));
  };

  const resetLabels = () => {
    const defaults = buildWorkspace({ businessType }).labels;
    setLabels(defaults);
  };

  const handleWorkspaceSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorkspaceSaving(true);
    setWorkspaceError("");
    setWorkspaceSuccess("");
    try {
      await apiFetch("/api/company/workspace", {
        method: "PUT",
        body: JSON.stringify({
          businessType,
          enabledModules,
          labels,
          taxEnabled,
          inventoryEnabled,
          projectTrackingEnabled
        })
      });
      setWorkspaceSuccess("Workspace updated.");
      window.dispatchEvent(new Event("workspace:updated"));
    } catch (err: any) {
      setWorkspaceError(err.message || "Failed to update workspace");
    } finally {
      setWorkspaceSaving(false);
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

  const canManageTeam = currentUserRole === "owner" || currentUserRole === "admin";
  const canChangeRoles = currentUserRole === "owner";

  const handleInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    setTeamError("");
    setTeamSuccess("");
    setInviteLink("");
    try {
      const data = await apiFetch<{ inviteUrl: string; emailSent: boolean }>("/api/users/invite", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole })
      });
      setInviteEmail("");
      setInviteLink(data.inviteUrl);
      setTeamSuccess(data.emailSent ? "Invite sent." : "Invite created. Copy the link below.");
      await loadTeam();
    } catch (err: any) {
      setTeamError(err.message || "Failed to send invite");
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    setTeamError("");
    setTeamSuccess("");
    try {
      await apiFetch("/api/users/invite/revoke", {
        method: "POST",
        body: JSON.stringify({ inviteId })
      });
      setTeamSuccess("Invite revoked.");
      await loadTeam();
    } catch (err: any) {
      setTeamError(err.message || "Failed to revoke invite");
    }
  };

  const handleRoleUpdate = async (userId: string, role: "owner" | "admin" | "member") => {
    setTeamError("");
    setTeamSuccess("");
    try {
      await apiFetch("/api/users/role", {
        method: "PUT",
        body: JSON.stringify({ userId, role })
      });
      setTeamSuccess("Role updated.");
      await loadTeam();
    } catch (err: any) {
      setTeamError(err.message || "Failed to update role");
    }
  };

  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setTeamSuccess("Invite link copied.");
    } catch {
      setTeamSuccess("Copy failed. Select and copy the link manually.");
    }
  };

  const businessNote = BUSINESS_TYPES.find((item) => item.value === businessType)?.note;

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
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Link className="button" href="/plans" data-allow="true">
                  View plans
                </Link>
                <button className="button secondary" type="button" onClick={loadBillingStatus} data-allow="true">
                  Refresh status
                </button>
              </div>
              <div className="muted">
                Seats used: {billingStatus?.seatsUsed ?? "—"} /{" "}
                {billingStatus?.seatLimit === null ? "Unlimited" : billingStatus?.seatLimit ?? "—"}
              </div>
              {billingError ? <div className="muted">{billingError}</div> : null}
            </div>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Team</div>
        <div className="muted">
          Seats used: {billingStatus?.seatsUsed ?? "—"} /{" "}
          {billingStatus?.seatLimit === null ? "Unlimited" : billingStatus?.seatLimit ?? "—"}
        </div>
        {teamLoading ? (
          <div className="muted" style={{ marginTop: 12 }}>
            Loading team...
          </div>
        ) : (
          <>
            {canManageTeam ? (
              <form onSubmit={handleInvite} style={{ display: "grid", gap: 12, marginTop: 12 }}>
                <div className="grid-2">
                  <label className="field">
                    Invite email
                    <input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      type="email"
                      required
                    />
                  </label>
                  <label className="field">
                    Role
                    <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value as "admin" | "member")}>
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                  </label>
                </div>
                <button className="button" type="submit">
                  Send invite
                </button>
                {inviteLink ? (
                  <div className="field">
                    Invite link
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <input value={inviteLink} readOnly />
                      <button className="button secondary" type="button" onClick={copyInvite}>
                        Copy link
                      </button>
                    </div>
                  </div>
                ) : null}
              </form>
            ) : (
              <div className="muted" style={{ marginTop: 12 }}>
                Only admins can invite teammates.
              </div>
            )}

            {teamError ? <div className="muted" style={{ marginTop: 10 }}>{teamError}</div> : null}
            {teamSuccess ? <div className="muted" style={{ marginTop: 10 }}>{teamSuccess}</div> : null}

            <div className="panel-title" style={{ fontSize: 16, marginTop: 18 }}>
              Active users
            </div>
            <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  {teamUsers.map((user) => (
                    <tr key={user._id}>
                      <td>{user.name}</td>
                      <td>{user.email}</td>
                      <td>
                        {canChangeRoles && user.role !== "owner" ? (
                          <select
                            value={user.role}
                            onChange={(e) => handleRoleUpdate(user._id, e.target.value as "admin" | "member")}
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        ) : (
                          user.role
                        )}
                      </td>
                    </tr>
                  ))}
                  {teamUsers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="muted">
                        No users found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

            <div className="panel-title" style={{ fontSize: 16, marginTop: 18 }}>
              Pending invites
            </div>
            <table className="table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Expires</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {teamInvites.map((invite) => (
                    <tr key={invite._id}>
                      <td>{invite.email}</td>
                      <td>{invite.role}</td>
                      <td>{invite.expiresAt ? new Date(invite.expiresAt).toLocaleDateString() : "—"}</td>
                      <td>
                        {canManageTeam ? (
                          <button className="button secondary" type="button" onClick={() => handleRevokeInvite(invite._id)}>
                            Revoke
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                  {teamInvites.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">
                        No pending invites.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
          </>
        )}
      </section>

      <section className="panel">
        <div className="panel-title">Workspace Mode</div>
        {workspaceLoading ? (
          <div className="muted">Loading workspace...</div>
        ) : (
          <form onSubmit={handleWorkspaceSave} style={{ display: "grid", gap: 16 }}>
            <label className="field">
              Business type
              <select
                value={businessType}
                onChange={(e) => handleBusinessTypeChange(e.target.value as WorkspaceConfig["businessType"])}
              >
                {BUSINESS_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            {businessNote ? <div className="muted">{businessNote}</div> : null}

            <div className="panel-title" style={{ fontSize: 16, marginTop: 6 }}>
              Feature Flags
            </div>
            <div className="grid-2">
              <label className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input type="checkbox" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
                Tax / VAT enabled
              </label>
              <label className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={inventoryEnabled}
                  onChange={(e) => handleInventoryToggle(e.target.checked)}
                />
                Inventory enabled
              </label>
              <label className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <input
                  type="checkbox"
                  checked={projectTrackingEnabled}
                  onChange={(e) => handleProjectToggle(e.target.checked)}
                />
                Project tracking enabled
              </label>
            </div>

            <div className="panel-title" style={{ fontSize: 16, marginTop: 6 }}>
              Enabled Modules
            </div>
            <div className="grid-2">
              {MODULE_OPTIONS.map((module) => (
                <label key={module.key} className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input
                    type="checkbox"
                    checked={enabledModules.includes(module.key)}
                    onChange={() => toggleModule(module.key)}
                  />
                  {module.label}
                </label>
              ))}
            </div>

            <div className="panel-title" style={{ fontSize: 16, marginTop: 6 }}>
              Navigation Labels
            </div>
            <div className="grid-2">
              {LABEL_FIELDS.map((field) => (
                <label key={field.key} className="field">
                  {field.label}
                  <input
                    value={labels[field.key] || ""}
                    onChange={(e) => handleLabelChange(field.key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button className="button secondary" type="button" onClick={resetLabels}>
                Reset labels to defaults
              </button>
            </div>

            <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <button className="button" type="submit" disabled={workspaceSaving}>
                {workspaceSaving ? "Saving..." : "Save workspace"}
              </button>
              <button className="button secondary" type="button" onClick={loadWorkspace}>
                Reset to saved
              </button>
              {workspaceSuccess ? <div className="muted">{workspaceSuccess}</div> : null}
              {workspaceError ? <div className="muted">{workspaceError}</div> : null}
            </div>
          </form>
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

      {taxEnabled ? (
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
      ) : null}
    </>
  );
}
