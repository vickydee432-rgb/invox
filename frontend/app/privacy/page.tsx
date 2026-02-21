export default function PrivacyPage() {
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-title">Privacy Policy</div>
      <div className="muted" style={{ marginTop: 10 }}>
        Effective date: February 21, 2026
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 14, lineHeight: 1.6 }}>
        <p>
          This Privacy Policy explains how Invox collects, uses, and protects your information
          when you use our service.
        </p>

        <div>
          <strong>1. Information We Collect</strong>
          <p>
            We collect account details (name, email), company information, billing data, and the
            records you create in the app (invoices, quotes, expenses, projects).
          </p>
        </div>

        <div>
          <strong>2. How We Use Information</strong>
          <p>
            We use your information to provide and improve the service, process subscriptions,
            enable integrations you request, and communicate important updates.
          </p>
        </div>

        <div>
          <strong>3. Data Sharing</strong>
          <p>
            We do not sell your data. We share information only with service providers required to
            operate the platform (hosting, payments, email) and only as needed.
          </p>
        </div>

        <div>
          <strong>4. Data Retention</strong>
          <p>
            We retain your data while your account is active. You may request deletion of your
            account and associated data, subject to legal requirements.
          </p>
        </div>

        <div>
          <strong>5. Security</strong>
          <p>
            We use technical and organizational measures to protect your data, including access
            controls, encryption in transit, and secure storage practices.
          </p>
        </div>

        <div>
          <strong>6. Your Choices</strong>
          <p>
            You may update your account details in settings. You can also control which
            integrations are enabled.
          </p>
        </div>

        <div>
          <strong>7. International Transfers</strong>
          <p>
            Your data may be processed in the regions where we or our providers operate. We apply
            appropriate safeguards to protect your information.
          </p>
        </div>

        <div>
          <strong>8. Changes</strong>
          <p>
            We may update this policy from time to time. Continued use of the service indicates
            acceptance of the updated policy.
          </p>
        </div>

        <div>
          <strong>Contact</strong>
          <p>
            For privacy questions, contact support via the email listed in your account settings.
          </p>
        </div>
      </div>
    </section>
  );
}
