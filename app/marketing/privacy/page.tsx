import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Qntum Roofing",
  description: "How Qntum Roofing collects, uses, and protects your personal information.",
};

export default function PrivacyPage() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-400 mb-12">Last updated: May 2025</p>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">1. Information We Collect</h2>
        <p className="text-gray-600 leading-relaxed mb-3">
          When you request a roof inspection or submit your information through our website, we collect:
        </p>
        <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
          <li>Full name</li>
          <li>Phone number</li>
          <li>Email address</li>
          <li>Property address</li>
          <li>Roof and property information (age, material, damage description)</li>
        </ul>
        <p className="text-gray-600 leading-relaxed mt-3">
          We also collect standard web analytics data such as browser type, pages visited, and
          referring URLs. We do not sell this information to third parties.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">2. How We Use Your Information</h2>
        <p className="text-gray-600 leading-relaxed mb-3">
          We use the information we collect to:
        </p>
        <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
          <li>Schedule and confirm roof inspection appointments</li>
          <li>Send appointment reminders and follow-up communications via SMS and email</li>
          <li>Prepare inspection reports for your property</li>
          <li>Coordinate with your insurance company if applicable</li>
          <li>Improve our services and customer experience</li>
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">3. SMS Messaging Terms</h2>
        <p className="text-gray-600 leading-relaxed">
          When you provide your phone number on our website, you consent to receive text messages
          from Qntum Roofing. These messages may include appointment confirmations, inspection
          reminders, and follow-up communications. Message frequency varies. Message and data rates
          may apply. To opt out at any time, reply <strong>STOP</strong> to any message. For help,
          reply <strong>HELP</strong> or contact us at{" "}
          <a href="mailto:privacy@qntumroofing.com" className="underline text-gray-700">
            privacy@qntumroofing.com
          </a>
          .
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">4. Data Storage and Security</h2>
        <p className="text-gray-600 leading-relaxed mb-3">
          Your information is stored in a secured database hosted by Neon (PostgreSQL), a
          SOC-2-compliant cloud database provider. Access to your data is restricted to authorized
          Qntum Roofing personnel only.
        </p>
        <p className="text-gray-600 leading-relaxed">
          All data is transmitted over encrypted connections (HTTPS/TLS). Inspection photos and
          documents are stored in Cloudflare R2, a secure object storage service. We retain your
          information for as long as necessary to provide our services and comply with applicable
          legal obligations.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">5. Third-Party Services</h2>
        <p className="text-gray-600 leading-relaxed mb-3">
          We use the following third-party services to operate our business:
        </p>
        <ul className="list-disc list-inside text-gray-600 space-y-1 ml-2">
          <li>
            <strong>Resend</strong> — transactional email delivery
          </li>
          <li>
            <strong>GoHighLevel</strong> — CRM and SMS communication
          </li>
          <li>
            <strong>Cloudflare</strong> — infrastructure and media storage
          </li>
        </ul>
        <p className="text-gray-600 leading-relaxed mt-3">
          Each of these services operates under their own privacy policies. We do not authorize
          these providers to use your data for their own marketing purposes.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">6. Your Rights</h2>
        <p className="text-gray-600 leading-relaxed">
          You may request access to, correction of, or deletion of your personal information at any
          time. To make a request, contact us at{" "}
          <a href="mailto:privacy@qntumroofing.com" className="underline text-gray-700">
            privacy@qntumroofing.com
          </a>
          . We will respond within 30 days.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">7. Changes to This Policy</h2>
        <p className="text-gray-600 leading-relaxed">
          We may update this policy from time to time. If we make material changes, we will update
          the date at the top of this page. Continued use of our services after a policy update
          constitutes acceptance of the revised terms.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-3">8. Contact</h2>
        <p className="text-gray-600 leading-relaxed">
          For privacy-related questions or requests, contact Qntum Roofing at:
        </p>
        <address className="mt-3 text-gray-600 not-italic leading-relaxed">
          <strong>Qntum Roofing</strong>
          <br />
          Email:{" "}
          <a href="mailto:privacy@qntumroofing.com" className="underline text-gray-700">
            privacy@qntumroofing.com
          </a>
          <br />
          Website:{" "}
          <a href="https://scopereports.com" className="underline text-gray-700">
            scopereports.com
          </a>
        </address>
      </section>
    </div>
  );
}
