import { APP_NAME, LEGAL_ENTITY_NAME, SUPPORT_EMAIL } from "@/lib/constants";
import type { LegalSection } from "@/components/legal/legal-document";

export const TERMS_LAST_UPDATED = "June 15, 2026";

export const TERMS_INTRO = `These Terms of Service ("Terms") govern your use of ${APP_NAME}, operated by ${LEGAL_ENTITY_NAME}. By creating an account or using the service, you agree to these Terms and our Privacy Policy.`;

export const TERMS_SECTIONS: LegalSection[] = [
  {
    title: "1. Service description",
    paragraphs: [
      `${APP_NAME} is a cloud-based management system for auto care shops, including features for customers, vehicles, estimates, job orders, invoices, inventory, and reports depending on your subscription plan.`,
    ],
  },
  {
    title: "2. Account registration and approval",
    paragraphs: [
      "Shop registration requires accurate information and admin approval before full access is granted.",
      "You are responsible for maintaining the confidentiality of your login credentials and for all activity under your account.",
    ],
  },
  {
    title: "3. Shop responsibilities for customer data",
    paragraphs: [
      "As a shop using the platform, you are responsible for the personal information you collect from your customers and for complying with the Data Privacy Act when handling that data.",
      "You agree to collect only information needed for your services, inform customers as required, and respond to customer privacy requests about records you control.",
    ],
  },
  {
    title: "4. Acceptable use",
    paragraphs: ["You agree not to:"],
    bullets: [
      "Use the service for unlawful purposes or to store illegal content.",
      "Attempt to access another shop's data or bypass security controls.",
      "Reverse engineer, disrupt, or overload the platform.",
      "Share accounts in a way that violates role-based access rules.",
    ],
  },
  {
    title: "5. Subscription and billing",
    paragraphs: [
      `${APP_NAME} offers Basic and Pro plans with fees communicated on the registration and upgrade pages. Billing is handled offline through ${LEGAL_ENTITY_NAME} support unless online payment is later enabled.`,
      "We may suspend or deactivate accounts for non-payment after reasonable notice, at our discretion.",
    ],
  },
  {
    title: "6. Availability and support",
    paragraphs: [
      "We strive to keep the service available but do not guarantee uninterrupted access. Maintenance, updates, or factors outside our control may cause temporary downtime.",
      `Support requests may be sent to ${SUPPORT_EMAIL}.`,
    ],
  },
  {
    title: "7. Intellectual property",
    paragraphs: [
      `${APP_NAME}, its software, branding, and documentation remain the property of ${LEGAL_ENTITY_NAME}. You retain ownership of the business data you enter into the system.`,
    ],
  },
  {
    title: "8. Termination",
    paragraphs: [
      "You may stop using the service at any time. We may suspend or terminate accounts that violate these Terms, pose a security risk, or remain unpaid.",
      "Upon termination, access to the dashboard may be disabled. Data retention follows our Privacy Policy.",
    ],
  },
  {
    title: "9. Limitation of liability",
    paragraphs: [
      `To the fullest extent permitted by Philippine law, ${LEGAL_ENTITY_NAME} is not liable for indirect, incidental, or consequential damages arising from use of the service. Our total liability for any claim related to the service is limited to the fees you paid to us in the three (3) months before the claim.`,
      "The service is provided on an \"as is\" basis. You are responsible for verifying business records and backups important to your operations.",
    ],
  },
  {
    title: "10. Governing law",
    paragraphs: [
      "These Terms are governed by the laws of the Republic of the Philippines. Disputes shall be subject to the exclusive jurisdiction of the courts of the Philippines, unless otherwise required by mandatory law.",
    ],
  },
  {
    title: "11. Changes to these Terms",
    paragraphs: [
      "We may update these Terms from time to time. Updated Terms will be posted on this page. Continued use after changes constitutes acceptance.",
    ],
  },
  {
    title: "12. Contact",
    paragraphs: [
      `Questions about these Terms: ${SUPPORT_EMAIL}`,
    ],
  },
];
