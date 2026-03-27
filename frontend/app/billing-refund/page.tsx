export default function BillingRefundPage() {
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-title">Billing &amp; Refund Policy</div>
      <div className="muted" style={{ marginTop: 10 }}>
        Effective date: March 27, 2026
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 14, lineHeight: 1.6 }}>
        <div>
          <strong>Billing</strong>
          <ul style={{ marginTop: 8, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>Subscriptions are billed monthly or annually</li>
            <li>Payments must be made in full and on time</li>
          </ul>
        </div>

        <div>
          <strong>Refunds</strong>
          <ul style={{ marginTop: 8, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>Payments are non-refundable</li>
            <li>Exceptions may be granted at our discretion</li>
          </ul>
        </div>

        <div>
          <strong>Cancellation</strong>
          <p>
            You may cancel anytime. Access continues until the end of the billing cycle.
          </p>
        </div>

        <div>
          <strong>Failed Payments</strong>
          <p>
            Accounts may be suspended after failed payments. Data may be restricted until payment
            is resolved.
          </p>
        </div>

        <div>
          <strong>Contact</strong>
          <p>Questions about billing? Contact: invox@gmail.com</p>
        </div>
      </div>
    </section>
  );
}

