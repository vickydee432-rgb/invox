export default function TermsPage() {
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-title">Terms and Conditions</div>
      <div className="muted" style={{ marginTop: 10 }}>
        Effective date: February 21, 2026
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 14, lineHeight: 1.6 }}>
        <p>
          These Terms and Conditions govern your access to and use of Invox. By creating an
          account or using the service, you agree to these terms.
        </p>

        <div>
          <strong>1. Accounts and Access</strong>
          <p>
            You are responsible for maintaining the confidentiality of your login credentials and
            all activity under your account. You must provide accurate company and billing
            information.
          </p>
        </div>

        <div>
          <strong>2. Subscriptions and Billing</strong>
          <p>
            Invox is offered as a subscription service. Fees are billed per company based on the
            plan and billing cycle you select. If payment fails or a subscription expires, your
            account may be placed in read-only mode.
          </p>
        </div>

        <div>
          <strong>3. Use of the Service</strong>
          <p>
            You agree to use the service in compliance with applicable laws and not to misuse,
            interfere with, or attempt to gain unauthorized access to the platform.
          </p>
        </div>

        <div>
          <strong>4. Data and Content</strong>
          <p>
            You retain ownership of the data you upload. You grant us permission to process and
            store that data solely to provide the service. You are responsible for the accuracy of
            your records.
          </p>
        </div>

        <div>
          <strong>5. Integrations</strong>
          <p>
            If you enable third-party integrations (including tax or payment services), you are
            responsible for providing valid credentials and ensuring compliance with those
            providers’ terms.
          </p>
        </div>

        <div>
          <strong>6. Service Availability</strong>
          <p>
            We aim for high availability but do not guarantee uninterrupted access. Maintenance,
            updates, or third-party issues may result in temporary downtime.
          </p>
        </div>

        <div>
          <strong>7. Termination</strong>
          <p>
            You may cancel your subscription at any time. We may suspend or terminate accounts for
            violations of these terms or misuse of the service.
          </p>
        </div>

        <div>
          <strong>8. Limitation of Liability</strong>
          <p>
            The service is provided “as is.” To the extent permitted by law, Invox is not liable
            for indirect or consequential damages, data loss, or business interruption.
          </p>
        </div>

        <div>
          <strong>9. Changes</strong>
          <p>
            We may update these terms from time to time. Continued use of the service after changes
            means you accept the updated terms.
          </p>
        </div>

        <div>
          <strong>Contact</strong>
          <p>
            For questions, contact support via the email listed in your account settings.
          </p>
        </div>
      </div>
    </section>
  );
}
