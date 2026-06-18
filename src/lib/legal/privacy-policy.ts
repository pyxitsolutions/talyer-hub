import {
  APP_NAME,
  DATA_RETENTION_YEARS,
  LEGAL_ENTITY_NAME,
  SUPPORT_EMAIL,
} from "@/lib/constants";
import type { LegalSection } from "@/components/legal/legal-document";

export const PRIVACY_POLICY_LAST_UPDATED = "June 15, 2026";

export const PRIVACY_POLICY_INTRO = `${LEGAL_ENTITY_NAME} ("we", "us") operates ${APP_NAME}, a shop management platform for auto care businesses in the Philippines. This Privacy Policy explains how we collect, use, store, and protect personal information in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173) and its implementing rules.`;

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    title: "1. Roles under the Data Privacy Act",
    paragraphs: [
      `${LEGAL_ENTITY_NAME} is the Personal Information Controller (PIC) for shop owner and staff account data processed through ${APP_NAME}.`,
      `Each registered shop is the PIC for personal information about its customers, vehicles, and service records that the shop enters into the system. ${APP_NAME} acts as a Personal Information Processor (PIP) when storing and processing that shop data on the shop's behalf.`,
    ],
  },
  {
    title: "2. Personal information we collect",
    paragraphs: ["We may collect the following categories of information:"],
    bullets: [
      "Shop account data: owner name, email, phone, shop name, address, login credentials, and subscription plan.",
      "Staff account data: name, email, role, and activity within the shop.",
      "Customer records entered by shops: customer name or nickname, contact number, email, address, vehicle details, service history, estimates, job orders, invoices, and payments.",
      "Technical data: IP address, browser type, device information, and usage logs needed for security and troubleshooting.",
    ],
  },
  {
    title: "3. Purpose of processing",
    paragraphs: ["We process personal information only for legitimate purposes, including:"],
    bullets: [
      "Creating and managing shop and user accounts.",
      "Providing repair shop workflow features (customers, vehicles, job orders, billing, reports).",
      "Shop registration review, billing support, and customer service.",
      "Securing the platform, preventing fraud, and maintaining system integrity.",
      "Complying with applicable laws and lawful requests from authorities.",
    ],
  },
  {
    title: "4. Legal basis",
    paragraphs: [
      "Processing is based on consent (when you register and agree to this policy), contractual necessity (to provide the service you signed up for), and legitimate interests (security, fraud prevention, and service improvement), consistent with the principles of the Data Privacy Act.",
    ],
  },
  {
    title: "5. Who can access the data",
    paragraphs: ["Access to personal information is limited:"],
    bullets: [
      "Shop staff can access data belonging to their shop, according to their assigned role.",
      "Platform administrators can access shop account data for approval, support, billing, and security purposes only.",
      "We do not sell personal information to third parties.",
      "Infrastructure providers (such as hosting and database services) may process data strictly to operate the platform, under appropriate safeguards.",
    ],
  },
  {
    title: "6. Data retention",
    paragraphs: [
      `Active shop data is retained while your subscription or account remains active. After account deactivation, we may retain records for up to ${DATA_RETENTION_YEARS} years for billing, dispute resolution, and legal compliance, unless a shorter period is required by law or you request earlier deletion where applicable.`,
      "Shops are responsible for retaining only the customer data they need for their business and for honoring customer requests about shop-held records.",
    ],
  },
  {
    title: "7. Security measures",
    paragraphs: [
      "We implement reasonable organizational, physical, and technical safeguards, including authenticated access, role-based permissions, encrypted connections, and tenant isolation so each shop can access only its own records.",
    ],
  },
  {
    title: "8. Your rights as a data subject",
    paragraphs: [
      "Under the Data Privacy Act, you have the right to be informed, to access, to object, to erasure or blocking, to damages, to file a complaint with the National Privacy Commission (NPC), and to data portability where applicable.",
      `To exercise your rights regarding ${APP_NAME} platform data, contact us using the details below. For customer records held by a shop, contact the shop directly; the shop, as PIC, is primarily responsible for those requests.`,
    ],
  },
  {
    title: "9. Cookies and session data",
    paragraphs: [
      `${APP_NAME} uses essential cookies and session storage to keep you signed in and to protect your account. We do not use third-party advertising cookies.`,
    ],
  },
  {
    title: "10. Updates to this policy",
    paragraphs: [
      "We may update this Privacy Policy from time to time. Material changes will be reflected on this page with an updated date. Continued use of the service after changes constitutes acceptance of the updated policy.",
    ],
  },
  {
    title: "11. Contact us",
    paragraphs: [
      `For privacy inquiries, data subject requests, or concerns about how ${APP_NAME} handles personal information, contact:`,
      `${LEGAL_ENTITY_NAME} — Privacy / Data Protection`,
      `Email: ${SUPPORT_EMAIL}`,
      "Subject line: Data Privacy Request — TalyerHub",
    ],
  },
];
