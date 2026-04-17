import { Link } from "wouter";
import { Sparkles } from "lucide-react";

// ── Shared mini-navbar ──────────────────────────────────────────────────────
function Navbar() {
  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 50,
      background: "rgba(10,10,10,0.92)", backdropFilter: "blur(16px)",
      borderBottom: "1px solid #1a1a1a",
    }}>
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px", height: 60, display: "flex", alignItems: "center" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "#2563eb", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <span style={{ fontSize: 20, fontWeight: 700, color: "#ffffff", letterSpacing: "-0.02em" }}>
            Rez<span style={{ color: "#2563eb" }}>AI</span>
          </span>
        </Link>
      </div>
    </nav>
  );
}

// ── Section heading ─────────────────────────────────────────────────────────
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontSize: 18, fontWeight: 600, color: "#ffffff",
      marginTop: 40, marginBottom: 12,
      paddingBottom: 8, borderBottom: "1px solid #262626",
    }}>
      {children}
    </h2>
  );
}

// ── Body paragraph ──────────────────────────────────────────────────────────
function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 15, color: "#888888", lineHeight: 1.8, marginBottom: 16 }}>
      {children}
    </p>
  );
}

function Li({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ fontSize: 15, color: "#888888", lineHeight: 1.8, marginBottom: 6 }}>
      {children}
    </li>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function Privacy() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#ffffff" }}>
      <Navbar />

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "100px 24px 80px" }}>

        <h1 style={{ fontSize: 32, fontWeight: 700, color: "#ffffff", marginBottom: 8 }}>
          Privacy Policy
        </h1>
        <p style={{ fontSize: 13, color: "#555555", marginBottom: 40 }}>
          Last updated: April 2026
        </p>

        <P>
          RezAI ("we", "our", or "us") is committed to protecting your privacy. This Privacy
          Policy explains how we collect, use, and safeguard your information when you use
          rezai.in (the "Service").
        </P>

        {/* 1 */}
        <H2>1. Information We Collect</H2>
        <P>We collect the following types of information:</P>
        <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
          <Li>Resume content and files uploaded by you</Li>
          <Li>Job descriptions and target roles you enter</Li>
          <Li>Usage data including features used and session duration</Li>
          <Li>Email address and profile name when you sign in with Google</Li>
          <Li>Payment information processed securely by Razorpay (we never store card details)</Li>
        </ul>

        {/* 2 */}
        <H2>2. How We Use Your Information</H2>
        <P>Your information is used solely to provide and improve the RezAI service:</P>
        <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
          <Li>To generate AI-powered, ATS-optimised resumes tailored to your target roles</Li>
          <Li>To compute ATS scores and keyword gap analysis</Li>
          <Li>To generate cover letters, outreach emails, and LinkedIn summaries</Li>
          <Li>To save your resume history so you can access past versions</Li>
          <Li>To improve our AI models and service quality</Li>
        </ul>
        <P>
          <strong style={{ color: "#ffffff" }}>We do not sell, rent, or share your personal data with third parties for marketing purposes.</strong>
        </P>

        {/* 3 */}
        <H2>3. Data Storage and Security</H2>
        <P>
          Your resume data is stored securely using Supabase, a SOC 2 compliant cloud database
          provider. Data is encrypted at rest and in transit. We retain your data for as long as
          your account is active. You can delete your account and all associated data at any time
          from the app settings.
        </P>

        {/* 4 */}
        <H2>4. Third-Party Services</H2>
        <P>RezAI uses the following third-party services to deliver functionality:</P>
        <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
          <Li><strong style={{ color: "#cccccc" }}>Anthropic Claude API</strong> — powers AI resume generation, ATS analysis, and content writing</Li>
          <Li><strong style={{ color: "#cccccc" }}>Apify</strong> — used for LinkedIn profile data import when you provide your LinkedIn URL</Li>
          <Li><strong style={{ color: "#cccccc" }}>Google OAuth</strong> — used for account sign-in; we only access your email and name</Li>
          <Li><strong style={{ color: "#cccccc" }}>Razorpay</strong> — used for processing Pro plan payments; card data is handled entirely by Razorpay</Li>
        </ul>
        <P>
          Each third-party service has its own privacy policy. We encourage you to review them.
          Your resume content is sent to Anthropic's API for processing and is subject to
          Anthropic's data handling policies.
        </P>

        {/* 5 */}
        <H2>5. Cookies and Local Storage</H2>
        <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
          <Li>We use <strong style={{ color: "#cccccc" }}>localStorage</strong> to save your theme preference (light/dark mode)</Li>
          <Li>We use <strong style={{ color: "#cccccc" }}>session cookies</strong> for authentication to keep you signed in</Li>
          <Li>We do <strong style={{ color: "#cccccc" }}>not</strong> use advertising cookies or cross-site tracking</Li>
        </ul>

        {/* 6 */}
        <H2>6. Your Rights</H2>
        <P>You have the following rights regarding your data:</P>
        <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
          <Li>Access your resume history and personal data at any time from the app</Li>
          <Li>Delete your account and all associated data permanently</Li>
          <Li>Export your resume history at any time</Li>
          <Li>Opt out of non-essential communications</Li>
        </ul>

        {/* 7 */}
        <H2>7. Children's Privacy</H2>
        <P>
          RezAI is not intended for users under the age of 18. We do not knowingly collect
          personal information from minors. If you believe a minor has provided us with
          personal information, please contact us immediately.
        </P>

        {/* 8 */}
        <H2>8. Changes to This Policy</H2>
        <P>
          We may update this Privacy Policy periodically. When we do, we will update the
          "Last updated" date at the top of this page. Continued use of the service after
          changes constitutes acceptance of the updated policy.
        </P>

        {/* 9 */}
        <H2>9. Contact Us</H2>
        <P>
          If you have any questions about this Privacy Policy or how we handle your data,
          please contact us:
        </P>
        <ul style={{ paddingLeft: 20, marginBottom: 16 }}>
          <Li>Email: support@rezai.in</Li>
          <Li>Website: <a href="https://rezai.in" style={{ color: "#2563eb", textDecoration: "none" }}>rezai.in</a></Li>
        </ul>

        {/* Back link */}
        <div style={{ marginTop: 60, paddingTop: 24, borderTop: "1px solid #1a1a1a" }}>
          <Link href="/" style={{ color: "#2563eb", fontSize: 14, textDecoration: "none" }}>
            ← Back to RezAI
          </Link>
        </div>
      </div>
    </div>
  );
}
