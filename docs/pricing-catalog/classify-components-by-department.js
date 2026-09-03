const data = require("D:/Vega-main/src/lib/seed/pricing-catalog-seed-data.json");

// Explicit per-code overrides, decided by reading each of the 158 real titles.
// Logic: SALES = capturing/qualifying/converting a specific lead into a deal
// (CRM types, lead assignment/generation-to-pipeline, quotations, proposals,
// site visits, field/channel sales tracking). MARKETING = reaching/attracting
// prospects before they're a lead (website, SEO, ads, campaigns, retention/
// loyalty re-engagement). OPERATIONS = the actual fulfillment/service work
// once someone is a customer (production, inventory, dispatch, projects,
// documents, all customer support/service, scheduling). BILLING = invoicing,
// payments, credit, collections, fees, renewals-as-billing-event.
const overrides = {
  // marketing_sales pillar
  CRM_LEAD_MANAGEMENT_40000_8000: "sales",
  WHATSAPP_BUSINESS_API_20000_5000: "marketing",
  BUYER_CRM_40000_8000: "sales",
  DEALER_PARTNER_CRM_40000_8000: "sales",
  DEALER_LEAD_GENERATION_40000_8000: "marketing",
  FIELD_SALES_CRM_40000_8000: "sales",
  CUSTOMER_CRM_40000_8000: "sales",

  // documentation_admin pillar
  QUOTATION_MANAGEMENT_35000_6000: "sales",
  INVOICE_PAYMENT_RECORDS_35000_6000: "billing",
  INVOICE_MANAGEMENT_35000_6000: "billing",
  CREDIT_RECORDS_35000_6000: "billing",
  RECEIVABLE_RECORDS_35000_6000: "billing",
  ORDER_INVOICE_RECORDS_35000_6000: "billing",
  CREDIT_LIMIT_RECORDS_35000_6000: "billing",
  COLLECTION_RECORDS_35000_6000: "billing",
  DIGITAL_INVOICE_MANAGEMENT_35000_6000: "billing",
  PURCHASE_INVOICE_MANAGEMENT_35000_6000: "billing",
  EXPENSE_RECORDS_35000_7000: "billing",

  // service_support pillar -> operations, except retention (marketing)
  RETENTION_AUTOMATION_30000_6000: "marketing",

  // operations pillar - the real sales/billing/marketing items hiding in the
  // catch-all default bucket
  UDHARI_COLLECTIONS_35000_6000: "billing",
  SECONDARY_CHANNEL_SALES_TRACKING_55000_10000: "sales",
  FIELD_SALES_MANAGEMENT_55000_10000: "sales",
  TERRITORY_ROUTE_MANAGEMENT_55000_10000: "sales",
  COLLECTIONS_35000_6000: "billing",
  "POS_BILLING_OR_CUSTOMER_ORDER_MANAGEMENT_35000_6000": "billing",
  CUSTOMER_CRM_RETENTION_40000_8000: "sales",
  SECONDARY_SALES_55000_10000: "sales",
  CRM_SALES_PIPELINE_40000_8000: "sales",
  BILLING_RENEWALS_35000_6000: "billing",
  LEAD_CRM_40000_8000: "sales",
  RENEWAL_MANAGEMENT_35000_7000: "billing",
  CLIENT_CRM_40000_8000: "sales",
  PROPOSAL_MANAGEMENT_35000_6000: "sales",
  BILLING_TIMESHEETS_35000_6000: "billing",
  BILLING_COLLECTIONS_35000_6000: "billing",
  PATIENT_ENQUIRY_CRM_40000_8000: "sales",
  BILLING_35000_6000: "billing",
  ADMISSION_CRM_40000_8000: "sales",
  FEE_MANAGEMENT_35000_7000: "billing",
  ENQUIRY_CRM_40000_8000: "sales",
  GUEST_TRAVELLER_CRM_40000_8000: "sales",
  PAYMENTS_35000_6000: "billing",
  CAMPAIGN_PROJECT_MANAGEMENT_70000_12000: "marketing",
  PAYMENT_TRACKING_35000_6000: "billing",
  REAL_ESTATE_CRM_40000_8000: "sales",
  LEAD_ASSIGNMENT_40000_8000: "sales",
  SITE_VISIT_MANAGEMENT_40000_7000: "sales",
};

function classify(component) {
  if (overrides[component.code]) return overrides[component.code];
  if (component.pillar === "marketing_sales") return "marketing"; // default for the rest of this pillar
  if (component.pillar === "service_support") return "operations";
  if (component.pillar === "documentation_admin") return "operations";
  return "operations"; // pillar === "operations" default
}

const rows = data.components.map((c) => ({
  code: c.code,
  title: c.title,
  pillar: c.pillar,
  department: classify(c),
}));

const counts = {};
rows.forEach((r) => (counts[r.department] = (counts[r.department] || 0) + 1));
console.log("DEPARTMENT COUNTS:", JSON.stringify(counts, null, 1));

const fs = require("fs");
const csvLines = [
  "code,title,pillar,department",
  ...rows.map((r) => `"${r.code}","${r.title}","${r.pillar}","${r.department}"`),
];
fs.writeFileSync(
  "C:/Users/HP/AppData/Local/Temp/claude/D--Samvid-Lead-engine/022a808a-c1d3-4a5f-98f7-35da8ea643ae/scratchpad/component-department-classification.csv",
  csvLines.join("\n")
);
fs.writeFileSync(
  "C:/Users/HP/AppData/Local/Temp/claude/D--Samvid-Lead-engine/022a808a-c1d3-4a5f-98f7-35da8ea643ae/scratchpad/component-department-classification.json",
  JSON.stringify(rows, null, 1)
);
console.log("wrote", rows.length, "rows to CSV + JSON");
