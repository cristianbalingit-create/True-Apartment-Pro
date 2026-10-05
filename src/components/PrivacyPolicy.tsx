import React from "react";
import { ArrowLeft, CheckCircle2, ChevronRight, ExternalLink, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { Link } from "react-router-dom";

const Section = ({ number, title, children }: { number: string; title: string; children: React.ReactNode }) => (
  <section className="privacy-section" id={`section-${number}`}>
    <div className="privacy-section-number">{number}</div>
    <div className="privacy-section-body">
      <h2>{title}</h2>
      {children}
    </div>
  </section>
);

const BulletList = ({ items }: { items: string[] }) => (
  <ul className="privacy-list">
    {items.map((item) => <li key={item}><CheckCircle2 size={18} aria-hidden="true" /> <span>{item}</span></li>)}
  </ul>
);

export default function PrivacyPolicy() {
  return (
    <div className="privacy-page">
      <header className="privacy-header">
        <div className="privacy-header-inner">
          <Link to="/" className="privacy-brand" aria-label="RentFlow home">
            <div className="privacy-brand-mark">AP</div>
            <div>
              <strong>RentFlow</strong>
              <span>Privacy Center</span>
            </div>
          </Link>
          <Link to="/" className="privacy-back"><ArrowLeft size={18} /> Back to RentFlow</Link>
        </div>
      </header>

      <main className="privacy-main">
        <section className="privacy-hero">
          <div className="privacy-hero-icon"><ShieldCheck size={34} /></div>
          <div>
            <p className="privacy-eyebrow">APARTMENTPRO · DATA PRIVACY</p>
            <h1>Privacy Policy</h1>
            <p className="privacy-lead">RentFlow respects your privacy and explains below what information may be collected when you use the RentFlow website and Facebook Messenger services, how it is used, and how you can request access, correction, unlinking, or deletion.</p>
            <p className="privacy-updated"><strong>Last Updated:</strong> September 29, 2026</p>
          </div>
        </section>

        <div className="privacy-layout">
          <aside className="privacy-toc" aria-label="Privacy policy sections">
            <strong>On this page</strong>
            {["About this policy", "Information we collect", "How we use information", "Messenger information", "Tenant verification", "Storage and retention", "Sharing with third parties", "Security", "Your rights", "Data deletion", "Contact us"].map((label, i) => (
              <a href={`#section-${i + 1}`} key={label}><span>{i + 1}</span>{label}<ChevronRight size={14} /></a>
            ))}
          </aside>

          <article className="privacy-card">
            <Section number="1" title="About This Privacy Policy">
              <p>This Privacy Policy describes how RentFlow collects, uses, stores, protects, and handles information when users interact with the RentFlow website and Facebook Messenger chatbot.</p>
              <p>It is intended to give tenants and Messenger users clear information about the data needed to provide RentFlow services.</p>
            </Section>

            <Section number="2" title="Information We Collect">
              <h3>Account and tenant information</h3>
              <BulletList items={["Registered mobile phone number used for tenant verification", "Tenant name, tenant ID, room/unit and property information", "Messenger Page-Scoped User ID (PSID) used to identify a Messenger conversation after account linking"]} />
              <h3>Messenger communications</h3>
              <BulletList items={["Messages sent to the RentFlow Facebook Page", "Questions and service requests submitted through Messenger", "Information supplied during tenant account linking"]} />
              <h3>Maintenance reports</h3>
              <BulletList items={["When and where a problem occurred", "Problem description, category and priority/severity", "Photos voluntarily attached to a maintenance report", "Maintenance ticket ID, status and submission time"]} />
              <h3>Billing and account records</h3>
              <p>Depending on the RentFlow feature being used, the system may process rent, utility/billing, payment-related, deposit/advance balance, and transaction information associated with a tenant account.</p>
            </Section>

            <Section number="3" title="How We Use Information">
              <p>RentFlow may use information to:</p>
              <BulletList items={["Verify that a Messenger user is an RentFlow tenant", "Link a verified Messenger account to the appropriate tenant record", "Respond to tenant questions and requests", "Receive, organize and manage maintenance reports", "Send requested maintenance and billing notifications", "Display relevant tenant account information after authentication", "Maintain maintenance, billing and transaction records", "Prevent duplicate maintenance submissions and unauthorized account linking", "Operate, secure and troubleshoot the RentFlow service"]} />
              <p>RentFlow does not sell tenant personal information.</p>
            </Section>

            <Section number="4" title="Facebook Messenger Information">
              <p>RentFlow uses Facebook Messenger to provide tenant services. When you communicate with the RentFlow Facebook Page, Meta may provide information necessary for the Messenger interaction, including a Page-Scoped User ID (PSID) and messages or attachments that you send to the Page.</p>
              <p>After a user successfully verifies a registered tenant mobile number, RentFlow may associate the Messenger PSID with that tenant record so the bot can recognize the authenticated Messenger account and provide tenant-specific services.</p>
              <div className="privacy-callout"><strong>Important:</strong> Meta separately controls its own processing of information on Facebook and Messenger. RentFlow does not control Meta's privacy practices.</div>
              <a className="privacy-external" href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer">Read Meta's Privacy Policy <ExternalLink size={16} /></a>
            </Section>

            <Section number="5" title="Tenant Account Verification">
              <p>To protect tenant information, the Messenger bot does not provide private tenant features to an unauthenticated user. The verification flow is:</p>
              <ol className="privacy-steps">
                <li><b>Message RentFlow.</b> The user receives a welcome message.</li>
                <li><b>Enter the registered mobile number.</b> The number is normalized into a standard Philippine mobile format.</li>
                <li><b>Phone-number input limit:</b> up to 15 digits may be entered so longer international-format values are not prematurely truncated. Tenant authentication still accepts only the supported Philippine mobile format after normalization.</li>
                <li><b>Live tenant verification.</b> The number is checked against the active tenant records.</li>
                <li><b>Messenger linking.</b> After a successful match, the Messenger PSID can be linked to that tenant record.</li>
                <li><b>Tenant menu access.</b> Tenant-only Messenger features become available only after successful verification.</li>
              </ol>
            </Section>

            <Section number="6" title="How We Store and Retain Information">
              <p>RentFlow uses Google Firebase / Cloud Firestore as its application data storage infrastructure. Depending on the feature, stored records can include tenant records, Messenger linking information, maintenance tickets, and billing or transaction records.</p>
              <p>RentFlow retains information for as long as reasonably necessary to provide services, maintain operational and accounting records, protect system security, resolve disputes, and comply with applicable legal obligations.</p>
              <p>No fixed deletion period is promised by this policy because retention can depend on the type of record and applicable requirements.</p>
            </Section>

            <Section number="7" title="Information Sharing With Third Parties">
              <p>RentFlow does not sell tenant personal information. Information may be processed by service providers needed to operate the application:</p>
              <div className="privacy-table-wrap">
                <table><thead><tr><th>Service</th><th>Purpose</th></tr></thead><tbody>
                  <tr><td>Meta / Facebook Messenger</td><td>Messenger communication and delivery</td></tr>
                  <tr><td>Google Firebase / Firestore</td><td>Application data storage and processing</td></tr>
                  <tr><td>Vercel</td><td>Website and application hosting for the deployed web application</td></tr>
                </tbody></table>
              </div>
              <p>Information may also be disclosed when required by applicable law or when reasonably necessary to protect users, the service, or security.</p>
            </Section>

            <Section number="8" title="Photos and Maintenance Attachments">
              <p>If a tenant voluntarily attaches a photo to a maintenance report, RentFlow may process and store that photo as part of the maintenance ticket so administrators can understand and resolve the reported issue.</p>
              <p>Photos should be limited to information relevant to the maintenance issue. RentFlow does not ask tenants to submit passwords, access tokens, or other authentication credentials as part of a maintenance report.</p>
            </Section>

            <Section number="9" title="Security Measures">
              <p>RentFlow applies security controls appropriate to the implemented system, including:</p>
              <BulletList items={["Authentication before access to tenant-specific Messenger features", "Server-side validation and input sanitization", "Live database verification for tenant account linking", "Protection of application credentials and access tokens through server-side configuration", "Masking of sensitive phone numbers and Messenger identifiers in diagnostic logs", "Validation of uploaded or attached content", "Restricted administrative access", "Protections against unauthorized tenant information disclosure and duplicate account linking"]} />
              <p>RentFlow does not claim security certifications or controls that are not implemented and verified in the application.</p>
            </Section>

            <Section number="10" title="Your Privacy Rights">
              <p>Subject to applicable law and legitimate retention requirements, users may request:</p>
              <BulletList items={["Access to personal information held by RentFlow", "Correction of inaccurate information", "Deletion of personal information", "Unlinking of a Messenger account from an RentFlow tenant record"]} />
              <p>RentFlow may need to verify the identity or account ownership of the requester before processing a request.</p>
            </Section>

            <Section number="11" title="Request Data Deletion">
              <div className="privacy-deletion-box" id="deletion">
                <Trash2 size={28} />
                <div>
                  <h3>Request deletion or Messenger unlinking</h3>
                  <p>To request deletion of information associated with your RentFlow Messenger account, contact the RentFlow administrator through the official contact method provided by your property administrator.</p>
                  <p>Please include enough information for the administrator to identify the account, but <strong>do not send passwords, Facebook access tokens, Firebase credentials, or other authentication secrets.</strong></p>
                </div>
              </div>
              <p>Users may separately request that their Messenger account be unlinked from their tenant record. Unlinking Messenger does not necessarily delete the underlying tenant, accounting, or legally required records.</p>
              <p>Some information may need to be retained where required by law or reasonably necessary for legitimate administrative, security, accounting, or dispute-resolution purposes.</p>
            </Section>

            <Section number="12" title="Children's Privacy">
              <p>RentFlow is intended for tenants and property-management users and is not directed toward children. RentFlow does not knowingly request personal information from children for tenant authentication.</p>
              <p>If a parent or guardian believes information from a child has been submitted, they may contact the RentFlow administrator.</p>
            </Section>

            <Section number="13" title="Changes to This Privacy Policy">
              <p>RentFlow may update this Privacy Policy when the application's features, data practices, or applicable requirements change. The updated date shown at the top of this page will indicate when the policy was last revised.</p>
            </Section>

            <Section number="14" title="Contact Us">
              <div className="privacy-contact-box">
                <UserRound size={26} />
                <div>
                  <h3>RentFlow Administrator</h3>
                  <p>For privacy, access, correction, unlinking, or deletion requests, you may contact RentFlow using the official contact details below.</p>
                  <div className="privacy-contact-details">
                    <p><strong>Email:</strong> <a href="mailto:cristianbalingit19@gmail.com">cristianbalingit19@gmail.com</a></p>
                    <p><strong>Contact Number:</strong> <a href="tel:09076812943">09076812943</a></p>
                  </div>
                  <p className="privacy-note">For security, do not send passwords, access tokens, Firebase credentials, or other authentication secrets when making a privacy request.</p>
                </div>
              </div>
            </Section>

            <Section number="15" title="Third-Party Privacy Resources">
              <p>For information about how the services used by RentFlow handle data, review their official privacy resources:</p>
              <div className="privacy-links">
                <a className="privacy-external" href="https://www.facebook.com/privacy/policy/" target="_blank" rel="noreferrer">Meta Privacy Policy <ExternalLink size={16} /></a>
                <a className="privacy-external" href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy <ExternalLink size={16} /></a>
                <a className="privacy-external" href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">Vercel Privacy Policy <ExternalLink size={16} /></a>
              </div>
            </Section>

            <footer className="privacy-footer">
              <strong>RentFlow</strong>
              <span>Privacy Policy</span>
              <span>Last Updated: September 29, 2026</span>
              <Link to="/">Return to RentFlow <ArrowLeft size={15} /></Link>
            </footer>
          </article>
        </div>
      </main>
    </div>
  );
}
