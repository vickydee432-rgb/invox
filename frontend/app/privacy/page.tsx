export default function PrivacyPage() {
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-title">Privacy Policy</div>
      <div className="muted" style={{ marginTop: 10 }}>
        Effective date: March 27, 2026
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 14, lineHeight: 1.6 }}>
        <p>
          This Privacy Policy explains how Invox collects, uses, and protects your information
          when you use our Service.
        </p>

        <div>
          <strong>1. Information We Collect</strong>
          <p>
            We collect account details (name, email, business info), financial data (invoices,
            expenses, payments), and device and usage data.
          </p>
        </div>

        <div>
          <strong>2. How We Use Information</strong>
          <p>
            We use your data to provide services, generate reports, improve features, and
            communicate updates.
          </p>
        </div>

        <div>
          <strong>3. Data Sharing</strong>
          <p>
            We do not sell your data. We may share data with payment processors, cloud hosting
            providers, and legal authorities (if required).
          </p>
        </div>

        <div>
          <strong>4. Data Retention</strong>
          <p>
            Your data is stored securely on cloud infrastructure. We retain data as long as your
            account is active or as required by law.
          </p>
        </div>

        <div>
          <strong>5. Your Rights</strong>
          <p>
            You may access your data, request corrections, and request deletion (subject to legal
            obligations).
          </p>
        </div>

        <div>
          <strong>6. Security</strong>
          <p>
            We implement safeguards including encryption, access controls, and secure
            authentication.
          </p>
        </div>

        <div>
          <strong>7. Cookies &amp; Tracking</strong>
          <p>
            We may use cookies to improve performance and analyze usage.
          </p>
        </div>

        <div>
          <strong>8. International Data Transfers</strong>
          <p>
            Your data may be processed outside your country depending on infrastructure.
          </p>
        </div>

        <div>
          <strong>9. Changes</strong>
          <p>
            We may update this policy periodically.
          </p>
        </div>

        <div>
          <strong>Contact</strong>
          <p>
            For privacy questions, contact: invox@gmail.com
          </p>
        </div>
      </div>
    </section>
  );
}
