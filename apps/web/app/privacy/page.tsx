import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy — sousChef",
  description: "How sousChef collects, uses, and protects your personal data.",
};

const LAST_UPDATED = "August 2026";
const CONTACT_EMAIL = "privacy@souschef.app";

export default function PrivacyPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Link href="/" className="text-sm text-orange-500 hover:underline">
        ← Back to sousChef
      </Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-400">Last updated: {LAST_UPDATED}</p>

      <div className="mt-10 space-y-8 text-sm text-gray-700 leading-relaxed">

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">1. Who we are</h2>
          <p>
            sousChef is a recipe management and cooking companion application. References to
            "we", "us", or "our" in this policy refer to the operator of sousChef. If you
            have any questions about this policy, please contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-orange-500 hover:underline">
              {CONTACT_EMAIL}
            </a>.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">2. What data we collect</h2>
          <p>We collect the following personal data when you use sousChef:</p>
          <ul className="mt-2 list-disc list-inside space-y-1 text-gray-600">
            <li>
              <strong>Account information</strong> — your email address and display name,
              provided when you sign up.
            </li>
            <li>
              <strong>Profile information</strong> — your avatar, bio, and dietary preferences,
              if you choose to provide them.
            </li>
            <li>
              <strong>Content you create</strong> — recipes, pantry items, shopping lists,
              fermentation batches, and meal plans you add to the app.
            </li>
            <li>
              <strong>Usage data</strong> — cook history and interactions with community
              features (likes, follows, forks).
            </li>
          </ul>
          <p className="mt-2">
            We do not collect location data, payment card details, or any data not directly
            necessary for the features described above.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">3. How we use your data</h2>
          <p>We use your data solely to:</p>
          <ul className="mt-2 list-disc list-inside space-y-1 text-gray-600">
            <li>Provide and operate the sousChef service</li>
            <li>Authenticate your account securely</li>
            <li>Enable community features you choose to participate in</li>
            <li>Send notifications you have opted into within the app</li>
          </ul>
          <p className="mt-2">
            We do not sell your personal data to third parties. We do not use your data for
            advertising or profiling purposes.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">4. Legal basis for processing</h2>
          <p>
            We process your personal data on the basis of contract — processing is necessary
            to provide the service you have signed up for. Where you have provided optional
            profile information (bio, dietary preferences, avatar), we rely on your consent,
            which you can withdraw at any time by removing that information from your profile.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">5. Data storage and security</h2>
          <p>
            Your data is stored in a managed PostgreSQL database hosted within the European
            region on Amazon Web Services. Authentication is handled via Amazon Cognito. Recipe
            images are stored in Amazon S3 and served via Amazon CloudFront. We use
            industry-standard encryption in transit (TLS) and at rest.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">6. Data retention</h2>
          <p>
            We retain your data for as long as your account is active. If you delete your
            account, all your personal data — including recipes, pantry data, and profile
            information — is permanently deleted within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">7. Your rights</h2>
          <p>Under UK GDPR, you have the right to:</p>
          <ul className="mt-2 list-disc list-inside space-y-1 text-gray-600">
            <li>Access the personal data we hold about you</li>
            <li>Correct inaccurate data</li>
            <li>Request deletion of your data (right to erasure)</li>
            <li>Object to processing or request restriction</li>
            <li>Data portability</li>
          </ul>
          <p className="mt-2">
            You can exercise your right to erasure directly by deleting your account in{" "}
            <strong>Settings → Danger zone</strong>. For all other requests, contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-orange-500 hover:underline">
              {CONTACT_EMAIL}
            </a>
            . We will respond within 30 days.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">8. Cookies</h2>
          <p>
            sousChef uses only strictly necessary first-party cookies to maintain your
            authenticated session. We do not use third-party analytics cookies or advertising
            cookies. No cookie consent banner is required for strictly necessary cookies under
            UK PECR.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">9. Third-party services</h2>
          <p>We use the following third-party services to operate sousChef:</p>
          <ul className="mt-2 list-disc list-inside space-y-1 text-gray-600">
            <li>
              <strong>Amazon Web Services</strong> — database, authentication, file storage,
              and API infrastructure
            </li>
            <li>
              <strong>Vercel</strong> — web application hosting
            </li>
            <li>
              <strong>Anthropic</strong> — AI-powered recipe import features (recipe text is
              sent to Anthropic's API; no personal data beyond the recipe content is
              transmitted)
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">10. Changes to this policy</h2>
          <p>
            We may update this policy from time to time. When we do, we will update the date
            at the top of this page. Continued use of sousChef after a policy update
            constitutes acceptance of the revised terms.
          </p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-gray-900 mb-2">11. Contact and complaints</h2>
          <p>
            For privacy-related questions, contact us at{" "}
            <a href={`mailto:${CONTACT_EMAIL}`} className="text-orange-500 hover:underline">
              {CONTACT_EMAIL}
            </a>
            . If you are unhappy with how we handle your data, you have the right to lodge a
            complaint with the Information Commissioner's Office (ICO) at{" "}
            <a
              href="https://ico.org.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="text-orange-500 hover:underline"
            >
              ico.org.uk
            </a>
            .
          </p>
        </section>

      </div>
    </div>
  );
}
