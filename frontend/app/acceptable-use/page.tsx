export default function AcceptableUsePage() {
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-title">Acceptable Use Policy</div>
      <div className="muted" style={{ marginTop: 10 }}>
        Effective date: March 27, 2026
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 14, lineHeight: 1.6 }}>
        <p>
          You agree not to use Invox to commit fraud, abuse the platform, or violate applicable
          laws. Violations may result in suspension or permanent account termination.
        </p>

        <div>
          <strong>Prohibited Uses</strong>
          <ul style={{ marginTop: 8, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>Commit fraud or financial manipulation</li>
            <li>Generate fake invoices or misleading financial records</li>
            <li>Launder money or facilitate illegal financial activity</li>
            <li>Violate tax laws</li>
            <li>Distribute malware or harmful code</li>
            <li>
              Attempt to gain unauthorized access, reverse engineer, exploit, or disrupt the
              system
            </li>
          </ul>
        </div>

        <div>
          <strong>Enforcement</strong>
          <p>
            We reserve the right to monitor and investigate suspicious activity, suspend accounts,
            and report illegal behavior to authorities where required or appropriate.
          </p>
        </div>

        <div>
          <strong>Contact</strong>
          <p>Questions about this policy? Contact: invox@gmail.com</p>
        </div>
      </div>
    </section>
  );
}

