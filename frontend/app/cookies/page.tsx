export default function CookiesPage() {
  return (
    <section className="panel" style={{ marginTop: 24 }}>
      <div className="panel-title">Cookies Policy</div>
      <div className="muted" style={{ marginTop: 10 }}>
        Effective date: March 27, 2026
      </div>

      <div style={{ marginTop: 16, display: "grid", gap: 14, lineHeight: 1.6 }}>
        <p>
          This Cookies Policy explains how Invox uses cookies and similar technologies when you
          access or use our Service.
        </p>

        <div>
          <strong>1. What Are Cookies?</strong>
          <p>
            Cookies are small text files stored on your device. They help websites and apps
            remember information about your visit (for example, keeping you signed in or saving
            preferences).
          </p>
        </div>

        <div>
          <strong>2. How We Use Cookies</strong>
          <p>We may use cookies and similar technologies to:</p>
          <ul style={{ marginTop: 8, paddingLeft: 18, display: "grid", gap: 6 }}>
            <li>Enable core functionality and security</li>
            <li>Remember preferences and settings</li>
            <li>Understand usage and improve performance</li>
          </ul>
        </div>

        <div>
          <strong>3. Third-Party Cookies</strong>
          <p>
            Some cookies may be set by third-party providers we use for services like analytics,
            hosting, or payments. Those providers may process information according to their own
            policies.
          </p>
        </div>

        <div>
          <strong>4. Your Choices</strong>
          <p>
            You can control cookies through your browser settings (for example, blocking or
            deleting cookies). If you disable cookies, some features of the Service may not work
            properly.
          </p>
        </div>

        <div>
          <strong>5. Changes</strong>
          <p>We may update this Cookies Policy periodically.</p>
        </div>

        <div>
          <strong>Contact</strong>
          <p>Questions about cookies? Contact: invox@gmail.com</p>
        </div>
      </div>
    </section>
  );
}

