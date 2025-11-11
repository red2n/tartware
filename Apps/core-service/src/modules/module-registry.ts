import { z } from "zod";

export const MODULE_IDS = [
  "core",
  "finance-automation",
  "tenant-owner-portal",
  "facility-maintenance",
  "analytics-bi",
  "marketing-channel",
  "enterprise-api",
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export interface ModuleDefinition {
  id: ModuleId;
  name: string;
  description: string;
  tier: "base" | "add-on" | "enterprise";
  features: string[];
  category: string;
}

export const MODULE_DEFINITIONS: Record<ModuleId, ModuleDefinition> = {
  core: {
    id: "core",
    name: "Core / Base",
    tier: "base",
    category: "Operations",
    description:
      "Essential property management tooling: inventory, tenants, leasing, billing basics, and dashboards.",
    features: [
      "Property & unit management",
      "Tenant management",
      "Manual rent collection",
      "Basic accounting (invoices, receipts)",
      "Core reports (occupancy, rent due)",
      "User & role management",
      "Operational dashboards",
    ],
  },
  "finance-automation": {
    id: "finance-automation",
    name: "Finance & Automation",
    tier: "add-on",
    category: "Financials",
    description:
      "Automates billing workflows with gateways, reminders, expenses, and reconciliation.",
    features: [
      "Automated invoicing & reminders",
      "Payment gateway integrations",
      "Expense tracking",
      "Tax/GST reporting",
      "Bank feed reconciliation",
      "Advanced exports & scheduled reports",
    ],
  },
  "tenant-owner-portal": {
    id: "tenant-owner-portal",
    name: "Tenant & Owner Portal",
    tier: "add-on",
    category: "Experience",
    description:
      "Self-service portals for tenants and owners to manage payments, documents, and communications.",
    features: [
      "Tenant payment & request portal",
      "Owner income & expense statements",
      "Maintenance request tracking",
      "Document management & e-sign",
      "Omni-channel notifications",
    ],
  },
  "facility-maintenance": {
    id: "facility-maintenance",
    name: "Facility & Maintenance",
    tier: "add-on",
    category: "Operations",
    description:
      "Advanced maintenance management with vendor coordination, work orders, and preventive schedules.",
    features: [
      "Maintenance scheduling & assignments",
      "Vendor & contractor management",
      "Work orders with cost tracking",
      "Inventory & asset tracking",
      "Preventive maintenance alerts",
    ],
  },
  "analytics-bi": {
    id: "analytics-bi",
    name: "Analytics & BI",
    tier: "add-on",
    category: "Intelligence",
    description:
      "Actionable insights across occupancy, revenue, expenses, and predictive maintenance.",
    features: [
      "Occupancy & rent trend analysis",
      "Expense insights & anomaly detection",
      "Predictive maintenance signals",
      "Custom dashboards & widgets",
      "Revenue forecasting & budgeting",
    ],
  },
  "marketing-channel": {
    id: "marketing-channel",
    name: "Marketing & Channel Management",
    tier: "add-on",
    category: "Growth",
    description:
      "Distribution tooling for vacation rentals and hospitality portfolios, including CRM and campaigns.",
    features: [
      "Website & landing page builder",
      "Channel integrations (OTA sync)",
      "Lead management & CRM",
      "Campaign builder & automation",
      "Email/SMS marketing tools",
    ],
  },
  "enterprise-api": {
    id: "enterprise-api",
    name: "Enterprise & API",
    tier: "enterprise",
    category: "Enterprise",
    description:
      "Enterprise-grade integrations, security, and scaling options with dedicated support.",
    features: [
      "Full API access",
      "SSO / SAML authentication",
      "Advanced access controls & audit logs",
      "White-label branding",
      "Dedicated hosting & SLA",
    ],
  },
};

export const DEFAULT_ENABLED_MODULES: ModuleId[] = ["core"];

const ModuleIdSchema = z.enum(MODULE_IDS);

export const normalizeModuleList = (value: unknown): ModuleId[] => {
  if (!Array.isArray(value)) {
    return DEFAULT_ENABLED_MODULES;
  }

  const modules = new Set<ModuleId>();
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim().toLowerCase();
    const parsed = ModuleIdSchema.safeParse(normalized);
    if (parsed.success) {
      modules.add(parsed.data);
    }
  }

  return modules.size > 0 ? Array.from(modules) : DEFAULT_ENABLED_MODULES;
};
