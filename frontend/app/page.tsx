import Link from "next/link";

export default function HomePage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div>
          <div className="brand">Invox</div>
          <span className="brand-tag">Studio Ledger</span>
        </div>
        <nav className="landing-links">
          <a href="#features">Features</a>
          <a href="#preview">Preview</a>
          <a href="#pricing">Pricing</a>
        </nav>
        <div className="landing-actions">
          <Link className="button ghost" href="/login">
            Log in
          </Link>
          <Link className="button" href="/register">
            Start free
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div>
          <div className="landing-kicker">For modern teams who want clarity</div>
          <h1>
            The ledger that keeps quotes, invoices, expenses, inventory, and projects in sync.
          </h1>
          <p>
            Invox gives you a clean studio for billing, tracking, and reporting. No clutter, no
            spreadsheets, just a clear path from quote to payment.
          </p>
          <div className="landing-cta">
            <Link className="button" href="/register">
              Create free account
            </Link>
            <Link className="button secondary" href="#preview">
              View demo
            </Link>
          </div>
          <div className="landing-badges">
            <span>Quick setup</span>
            <span>Read-only until payment</span>
            <span>Multi-branch ready</span>
          </div>
        </div>
        <div className="landing-hero-card">
          <div className="landing-hero-pill">Live cashflow</div>
          <div className="landing-balance">ZMW 254,920.40</div>
          <div className="landing-sub">Paid this month</div>
          <div className="landing-mini-grid">
            <div>
              <span className="muted">Quotes</span>
              <strong>18</strong>
            </div>
            <div>
              <span className="muted">Invoices</span>
              <strong>42</strong>
            </div>
            <div>
              <span className="muted">Expenses</span>
              <strong>76</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-features" id="features">
        <div className="panel-title">Everything in one flow</div>
        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-title">Quotes → Invoices</div>
            <p>Move a quote into an invoice with items, VAT, and discounts already applied.</p>
          </div>
          <div className="feature-card">
            <div className="feature-title">Expenses & Projects</div>
            <p>Track expenses by project, assign budgets, and see profit in real time.</p>
          </div>
          <div className="feature-card">
            <div className="feature-title">Retail mode</div>
            <p>Quick sales, inventory updates, low-stock alerts, and printable receipts.</p>
          </div>
          <div className="feature-card">
            <div className="feature-title">ZRA smart invoice</div>
            <p>Submit directly to ZRA and sync approved invoices back into your ledger.</p>
          </div>
        </div>
      </section>

      <section className="landing-preview" id="preview">
        <div>
          <div className="panel-title">Live preview</div>
          <p className="muted">
            See how invoices, expenses, and inventory look on desktop and mobile. Clean layouts,
            fast actions, and instant reports.
          </p>
        </div>
        <div className="preview-grid">
          <div className="preview-card">
            <div className="preview-tag">Invoices</div>
            <div className="preview-mock">
              <div className="preview-row">
                <span>MACMAR</span>
                <strong>ZMW 12,450</strong>
              </div>
              <div className="preview-row muted">Sent · Due in 7 days</div>
              <button className="button secondary" type="button">
                View invoice
              </button>
            </div>
          </div>
          <div className="preview-card">
            <div className="preview-tag">Expenses</div>
            <div className="preview-mock">
              <div className="preview-row">
                <span>Fuel · Transport</span>
                <strong>ZMW 1,200</strong>
              </div>
              <div className="preview-row muted">Added today</div>
              <button className="button secondary" type="button">
                Add expense
              </button>
            </div>
          </div>
          <div className="preview-card">
            <div className="preview-tag">Inventory</div>
            <div className="preview-mock">
              <div className="preview-row">
                <span>Cement 50kg</span>
                <strong>24 left</strong>
              </div>
              <div className="preview-row muted">Low stock warning</div>
              <button className="button secondary" type="button">
                Restock
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-pricing" id="pricing">
        <div className="panel-title">Pricing</div>
        <p className="muted">Choose a plan and scale when you need it. Monthly or yearly billing.</p>
        <div className="plans-cards">
          <article className="plan-card">
            <div className="plan-title">Starter</div>
            <div className="plan-subtitle">Solo founders & small shops</div>
            <div className="plan-price">
              $10.99 <span>/month</span>
            </div>
            <Link className="button" href="/register">
              Start free
            </Link>
            <ul className="plan-features">
              <li>Invoices & quotes</li>
              <li>Basic expense tracking</li>
              <li>PDF exports</li>
            </ul>
          </article>
          <article className="plan-card">
            <div className="plan-title">Pro</div>
            <div className="plan-subtitle">Teams that need reporting</div>
            <div className="plan-price">
              $19.99 <span>/month</span>
            </div>
            <Link className="button" href="/register">
              Start free
            </Link>
            <ul className="plan-features">
              <li>Projects & exports</li>
              <li>PDF & Excel reporting</li>
              <li>Email support</li>
            </ul>
          </article>
          <article className="plan-card featured">
            <div className="plan-tag">Most popular</div>
            <div className="plan-title">BusinessPlus</div>
            <div className="plan-subtitle">Advanced ops & ZRA sync</div>
            <div className="plan-price">
              $39.99 <span>/month</span>
            </div>
            <Link className="button" href="/register">
              Start free
            </Link>
            <ul className="plan-features">
              <li>ZRA smart invoice sync</li>
              <li>Advanced reports + trends</li>
              <li>Priority support</li>
            </ul>
          </article>
        </div>
      </section>

      <section className="landing-signup">
        <div>
          <div className="panel-title">Ready to get started?</div>
          <p className="muted">
            Create your workspace in minutes. You can explore in read-only mode until you choose a
            plan.
          </p>
        </div>
        <div className="landing-cta">
          <Link className="button" href="/register">
            Quick signup
          </Link>
          <Link className="button secondary" href="/login">
            I already have an account
          </Link>
        </div>
      </section>

      <footer className="landing-footer">
        <span className="muted">© {new Date().getFullYear()} Invox</span>
        <div className="footer-links">
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login">Login</Link>
        </div>
      </footer>
    </div>
  );
}
