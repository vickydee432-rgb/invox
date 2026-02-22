"use client";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-wrap">
      <section className="auth-hero">
        <div className="brand pulse">Invox</div>
        <div className="brand-tag">Studio Ledger</div>
        <h1>
          A crisp ledger for teams who want clarity on every quote and payment.
        </h1>
        <p className="muted">
          Keep your work in motion: issue quotes, send invoices, log expenses, and track profit
          without switching tools.
        </p>
        <div className="badge">Built for small teams and solo operators</div>
      </section>
      <section className="auth-card">{children}</section>
      <footer className="app-footer">
        <span className="muted">© {new Date().getFullYear()} Invox</span>
        <div className="footer-links">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
        </div>
      </footer>
    </div>
  );
}
