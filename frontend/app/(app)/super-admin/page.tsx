import Link from "next/link";

export default function SuperAdminDashboardMovedPage() {
  const defaultUrl = "https://airy-hope-production.up.railway.app";
  const rawUrl = process.env.NEXT_PUBLIC_SUPERADMIN_APP_URL || defaultUrl;
  const url = rawUrl && !rawUrl.startsWith("http://") && !rawUrl.startsWith("https://") ? `https://${rawUrl}` : rawUrl;
  return (
    <section className="panel">
      <div className="panel-title">Super Admin Dashboard</div>
      <div className="muted" style={{ marginTop: 8 }}>
        This dashboard is now a standalone web application (separate from the main platform) to keep it focused on
        cross-company analytics only.
      </div>
      <div className="muted" style={{ marginTop: 10 }}>
        {url ? (
          <>
            Open the Super Admin app:{" "}
            <Link href={url} target="_blank" rel="noreferrer">
              {rawUrl}
            </Link>
          </>
        ) : (
          <>
            Set <code>NEXT_PUBLIC_SUPERADMIN_APP_URL</code> to your deployed Super Admin app URL, then open it from here.
          </>
        )}
      </div>
    </section>
  );
}
