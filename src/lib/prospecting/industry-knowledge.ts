// Industry knowledge bank - one entry per industry. Used to generate
// industry-specific pain-points text, revenue-leak bullets, a before/after
// business-flow diagram, and an outlook line for the report, instead of the
// single generic DEFAULT_PAIN_POINTS / AUTOMATION_FLOW in reportConfig.js.
//
// Add a new industry by following the same shape as any entry below.
// Discipline for any numeric or forward-looking claim: always attach a
// source, and hedge speculative claims explicitly (see generateParagraph.js
// for the same "use only the facts provided" discipline applied to the
// per-lead assessment paragraph).
//
// revenueLeaks are real, industry-standard risk categories (e.g. "stockouts
// of high-demand sizes") sourced from industry research, not fabricated
// numbers about a specific lead. Never turn these into a rupee-figure claim
// about a specific business without real data behind it.
//
// Matching is honest about what we actually measure: the Digital Presence
// Audit only checks website/social/SEO, not internal operations, so pain
// points are tagged against those same gap categories ("website", "social")
// rather than pretending to detect operational issues we have no signal
// for. Many B2B/industrial entries below have NO pain points tagged at all
// - that's not a bug, it's an honest reflection that a missing website
// isn't a business's real problem in, say, chemicals or metals. For those
// industries the pain-points/revenue-leaks section still works (it falls
// back to the first two pain points), but the "digital presence caused
// this" narrative is a weaker fit than for consumer-facing sectors like
// real estate, hospitality, or education. Worth keeping in mind when this
// data is used for report copy.
//
// financialMatrix is reference data, not yet rendered in reports - there's
// no signal today to know which scale tier a given lead actually falls
// into (would need real revenue/employee-count data).
//
// electronics_electricals is INCOMPLETE: the source document is genuinely
// truncated (confirmed by direct XML inspection - it ends mid-sentence).
// Only 4 of 5 pain points exist, the 4th has no revenue leaks, and there is
// no financialMatrix or outlook at all. Left empty/short rather than
// fabricated. Ask for a complete version of that doc before relying on it.
//
// SEGMENTS: an industry is not one business - a real lead is one player at
// one point in the value chain (raw material, manufacturer, wholesaler,
// retailer...), each with genuinely different pain points, flow, and
// margins. textile_apparel is the pilot for a `segments` shape: instead of
// one blended profile, the industry has multiple segment profiles plus a
// shared `outlook` (market-wide growth trend applies regardless of segment).
// Un-piloted industries stay flat (painPoints/currentFlowStages/
// financialMatrix directly on the industry object) - getIndustryProfile()
// below handles both shapes transparently. Add `segments` to another
// industry only once real segment-specific research exists for it - don't
// fabricate a split just to match the pattern.


export interface FinancialTier {
  scale: string;
  revenue: string;
  margin: string;
  profile: string;
}

export interface PainPoint {
  issue: string;
  /** Gap categories this pain point is tagged against - "website" / "social". */
  tags: string[];
  summary: string;
  revenueLeaks?: string[];
}

export interface Outlook {
  sentence: string;
  source: string;
}

export interface IndustrySegment {
  label: string;
  currentFlowStages?: string[];
  painPoints?: PainPoint[];
  financialMatrix?: FinancialTier[];
}

export interface Industry {
  label: string;
  defaultSegment?: string;
  segments?: Record<string, IndustrySegment>;
  currentFlowStages?: string[];
  painPoints?: PainPoint[];
  financialMatrix?: FinancialTier[];
  /** Explicitly null where the source research is incomplete - see the
   *  electronics_electricals note in the banner above. */
  outlook?: Outlook | null;
}

/** An industry resolved down to one flat profile, segment already applied. */
export interface IndustryProfile {
  label: string;
  currentFlowStages?: string[];
  painPoints?: PainPoint[];
  financialMatrix?: FinancialTier[];
}

/**
 * How to pick a segment for a lead: an explicit `segment` wins (manual
 * override), otherwise `text` (a business-category field, entity type, or
 * company name) is keyword-matched.
 */
export interface SegmentHint {
  segment?: string | null;
  text?: string | null;
}

export const INDUSTRY_KNOWLEDGE: Record<string, Industry> = {
  textile_apparel: {
    label: "Textile & Apparel",
    // Wholesale/retail leads are expected to be the more common, more
    // accessible target given the bottom-up (small-to-big) go-to-market
    // strategy, so that's the fallback when segment can't be determined.
    defaultSegment: "wholesale_retail",
    segments: {
      manufacturer: {
        label: "Manufacturer / Producer",
        currentFlowStages: [
          "Market research & buyer acquisition",
          "Design, sampling & quotation",
          "Material planning & sourcing",
          "Spinning, weaving & dyeing",
          "Cutting, sewing & finishing",
          "Quality checks & packing",
          "Dispatch, billing & retention",
        ],
        painPoints: [
          {
            issue: "Fragmented production and order visibility",
            tags: ["website", "social"],
            summary:
              "Many businesses in this space still run on spreadsheets, paper job cards, and WhatsApp messages, so management often only learns about a delay or a missed order once it's already at risk.",
            revenueLeaks: [
              "Excess work-in-progress and idle machine or operator time",
              "Unbalanced production lines and hidden rework",
              "Missed buyer delivery windows and unplanned overtime",
            ],
          },
          {
            issue: "Forecasting errors and inventory imbalance",
            tags: ["website"],
            summary:
              "Demand is seasonal and trend-sensitive, and without a system tracking real enquiry and order data, it's easy to over-produce the wrong styles while running short on what's actually selling.",
            revenueLeaks: [
              "Unsold finished goods requiring markdowns",
              "Stockouts of high-demand sizes or styles",
              "Working capital trapped in slow-moving inventory",
            ],
          },
          {
            issue: "Slow collections and buyer concentration",
            tags: ["social"],
            summary:
              "Long buyer credit terms combined with no automated follow-up on receivables creates a cash-flow gap that's easy to lose track of without a dedicated system.",
            revenueLeaks: [
              "Delayed receivables and higher working-capital expense",
              "Unapproved deductions and debit notes going unchallenged",
              "Cash-flow disruption when a major buyer's order slips",
            ],
          },
          {
            issue: "Raw-material price and quality volatility",
            tags: [],
            summary:
              "Input costs can move significantly between quoting and purchasing, which erodes margin unless pricing includes a live-cost mechanism.",
            revenueLeaks: [
              "Orders quoted using outdated material prices",
              "Emergency procurement at premium prices",
              "Production stoppage caused by late supplier delivery",
            ],
          },
          {
            issue: "Shade, measurement and quality inconsistency",
            tags: [],
            summary:
              "Orders can be rejected over shade variation, shrinkage, or measurement defects, which is costly without inline inspection and batch traceability.",
            revenueLeaks: [
              "Re-dyeing, reprocessing, and buyer debit notes",
              "Product returns and marketplace penalties",
              "Entire batches downgraded to lower-value markets",
            ],
          },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 25 lakh - Rs. 5 crore", margin: "-5% to 8%", profile: "Small apparel label, job-work unit, boutique manufacturer, or early D2C brand" },
          { scale: "Small Scale", revenue: "Rs. 5 crore - Rs. 50 crore", margin: "3% to 10%", profile: "Local garment manufacturer, fabric processor, small exporter, or contract manufacturer" },
          { scale: "Medium Scale", revenue: "Rs. 50 crore - Rs. 500 crore", margin: "5% to 12%", profile: "Integrated manufacturer, established exporter, or specialised technical-textile company" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 500 crore", margin: "4% to 14%", profile: "Vertically integrated textile group, major exporter, or technical-textile enterprise" },
        ],
      },
      wholesale_retail: {
        label: "Wholesale / Retail / Trade-Facing",
        currentFlowStages: [
          "Sourcing from manufacturers/wholesalers",
          "Inventory & stock receipt",
          "Merchandising, display & catalog",
          "Customer footfall / order intake",
          "Sales, billing & invoicing",
          "Credit sales & collections",
          "Repeat business & restocking",
        ],
        painPoints: [
          {
            issue: "Inventory imbalance across size, color & style",
            tags: ["website"],
            summary:
              "Fashion has a short shelf life, and most small and mid-sized traders plan stock on instinct or last year's sales rather than real demand data, so a style trending one season can be dead stock the next.",
            revenueLeaks: [
              "Markdowns and clearance sales that erode peak-season margin",
              "Stockouts of fast-moving sizes alongside overstock of slow movers",
              "Working capital tied up in unsold seasonal inventory",
            ],
          },
          {
            issue: "Credit sales and collections risk",
            tags: ["social"],
            summary:
              "Wholesale-to-retail and B2B trade in this segment runs heavily on credit terms extended to downstream retailers and customers, often with no systematic follow-up on receivables.",
            revenueLeaks: [
              "Delayed payments straining working capital",
              "Bad debts from over-extended credit to weak counterparties",
              "Unapproved deductions and returns going unchallenged",
            ],
          },
          {
            issue: "Footfall-to-conversion pressure from e-commerce",
            tags: ["website", "social"],
            summary:
              "Physical wholesale and retail outlets compete against fast-growing online fashion channels and organised retail for the same customer, and many independent traders have no online presence to defend against this.",
            revenueLeaks: [
              "Declining walk-in footfall and browsing-only visits",
              "Lost sales to price comparison via mobile or online",
              "Customer migration to organised, multi-brand outlets",
            ],
          },
          {
            issue: "GST/billing compliance and informal trade practices",
            tags: [],
            summary:
              "Textile trade has historically relied on informal billing, and GST rate mismatches between inputs and finished goods add compliance friction, especially for smaller dealers.",
            revenueLeaks: [
              "Penalties and interest from unregistered or under-invoiced sales",
              "Input tax credit lost due to non-compliant supplier invoices",
              "Cash-flow strain from GST paid on inputs at higher rates than realised on sales",
            ],
          },
          {
            issue: "Shrinkage, pilferage and counterfeit/grey-market goods",
            tags: [],
            summary:
              "Physical stock handling across multiple counters or godowns creates exposure to theft, billing fraud, and counterfeit or grey-market goods entering the supply chain.",
            revenueLeaks: [
              "Inventory shrinkage from theft or billing errors",
              "Margin erosion from counterfeit goods undercutting genuine stock",
              "Cash leakage through unrecorded or under-billed transactions",
            ],
          },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 20 lakh - Rs. 3 crore", margin: "3% to 15% (directional estimate)", profile: "Single retail showroom, small fabric or garment counter, or early-stage trading firm" },
          { scale: "Small Scale", revenue: "Rs. 3 crore - Rs. 25 crore", margin: "3% to 12% (directional estimate)", profile: "Multi-counter retail store, local wholesale dealer, or regional trading firm" },
          { scale: "Medium Scale", revenue: "Rs. 25 crore - Rs. 200 crore", margin: "3% to 10% (directional estimate)", profile: "Wholesale distributor with a dealer/retailer network, or multi-store regional retail chain" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 200 crore", margin: "2% to 9% (directional estimate)", profile: "Multi-city retail chain, large regional trading house, or organised wholesale distribution business" },
        ],
      },
    },
    outlook: {
      sentence: "India's textile and apparel sector is targeting roughly US$350 billion in industry size by 2030, up from an estimated US$190 billion in FY2025-26 - an industry ambition, not a guaranteed forecast.",
      source: "IBEF",
    },
  },

  pharmaceuticals_healthcare: {
    label: "Pharmaceuticals & Healthcare Manufacturing",
    defaultSegment: "distributor_pharmacy",
    segments: {
      manufacturer: {
        label: "Manufacturer",
        currentFlowStages: ["Market & portfolio analysis", "R&D & regulatory approval", "Supplier qualification & procurement", "Production planning & manufacturing", "Quality control & batch release", "Warehousing & distribution", "Post-market vigilance & retention"],
        painPoints: [
          { issue: "Regulatory non-compliance and data-integrity failures", tags: [], summary: "Pharmaceutical and medical-device manufacturers operate under strict quality and documentation requirements, and a missing record, uncontrolled change or unreliable laboratory result can affect product release and market access.", revenueLeaks: ["Batch rejection", "Production shutdown", "Product-registration delay", "Product recall"] },
          { issue: "Batch failures, contamination and laboratory deviations", tags: [], summary: "Small process or environmental variations can make an entire pharmaceutical batch unusable.", revenueLeaks: ["Destruction or reprocessing", "Lost API and material value", "Delayed customer supply", "Complaint and recall exposure"] },
          { issue: "Long development and approval cycles", tags: [], summary: "Developing medicines, vaccines and medical devices can require extensive testing, documentation and regulatory review before revenue begins.", revenueLeaks: ["R&D spending on products that never launch", "Patent-window erosion", "Underutilised manufacturing capacity", "Missed market entry"] },
          { issue: "Supply-chain dependence and critical-material shortages", tags: [], summary: "The sector may rely on imported APIs, key starting materials, specialised excipients, electronic parts and sterile packaging, creating exposure to shortages and disruption.", revenueLeaks: ["Production stoppages", "Premium emergency procurement", "Missed institutional orders", "Exchange-rate losses"] },
          { issue: "Expiry, returns and distribution-control failures", tags: [], summary: "Medicines and vaccines have fixed shelf lives and may require controlled temperature throughout distribution, creating risk of loss if this is not tightly managed.", revenueLeaks: ["Expired distributor inventory", "Cold-chain damage", "Stockouts of critical products", "Counterfeit or diverted products"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 50 lakh - Rs. 10 crore", margin: "-20% to 10%", profile: "Research startup, early medical-device company, small formulation unit, diagnostic-device developer or contract laboratory" },
          { scale: "Small Scale", revenue: "Rs. 10 crore - Rs. 100 crore", margin: "3% to 12%", profile: "Regional medicine manufacturer, API unit, device assembler, nutraceutical manufacturer or contract packer" },
          { scale: "Medium Scale", revenue: "Rs. 100 crore - Rs. 1,000 crore", margin: "6% to 18%", profile: "Established formulation exporter, API manufacturer, vaccine supplier, device company or contract manufacturer" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 1,000 crore, often Rs. 10,000 crore+", margin: "8% to 25%", profile: "Diversified pharmaceutical group, major generics company, vaccine manufacturer, biologics company or multinational device business" },
        ],
      },
      distributor_pharmacy: {
        label: "Distributor / Wholesaler / Pharmacy Retail",
        currentFlowStages: ["Sourcing from manufacturers/C&F agents", "Stock receipt & quality check", "Storage & cold-chain management", "Order booking & billing", "Dispatch & last-mile delivery", "Credit & collections", "Returns & reorder cycle"],
        painPoints: [
          { issue: "Expiry and near-date stock losses", tags: [], summary: "Distributors and pharmacies hold thousands of SKUs with fixed shelf lives, and stock that isn't rotated or sold before expiry becomes a write-off, made worse because many manufacturers only accept partial or no expiry returns.", revenueLeaks: ["Expired/unsellable inventory write-offs", "Working capital locked in slow-moving SKUs", "Partial or no expiry returns accepted by manufacturers", "Emergency discounting to clear near-date stock"] },
          { issue: "Cold-chain and storage compliance failures", tags: [], summary: "Vaccines, insulin, biologics and many injectables need continuous temperature-controlled storage and transport, and a single break during warehousing or last-mile delivery can silently reduce potency even when the product looks unaffected.", revenueLeaks: ["Spoiled temperature-sensitive stock", "Regulatory/license risk from compromised batches", "Disputes with manufacturers over storage responsibility", "Lost hospital/clinic accounts for temperature-sensitive lines"] },
          { issue: "Counterfeit and spurious drug risk", tags: [], summary: "India's fragmented, multi-tier distribution network makes it possible for spurious or diverted stock to enter at the wholesale or retail level, exposing distributors and pharmacies to regulatory action even when they did not knowingly source it.", revenueLeaks: ["Seizure or destruction of suspect stock", "License suspension during investigation", "Reputational damage with prescribing doctors/hospitals", "Cost of authentication and batch-verification checks"] },
          { issue: "Licensing and regulatory compliance burden", tags: [], summary: "Wholesale (Form 20B/21B) and retail (Form 20/21) drug licenses require an on-site registered pharmacist and strict Schedule H/H1/X dispensing and record-keeping, and lapses can trigger show-cause notices, license suspension, or prosecution under the Drugs and Cosmetics Act.", revenueLeaks: ["Business shutdown during license suspension", "Legal and penalty costs for dispensing violations", "Pharmacist staffing cost to maintain compliance", "Lost sales during compliance-driven closures"] },
          { issue: "Institutional credit and delayed collections", tags: [], summary: "Hospitals, nursing homes and government/institutional buyers commonly pay on 60-120 day cycles, while distributors must pay manufacturers on much shorter terms, straining working capital and limiting the ability to restock.", revenueLeaks: ["Working capital locked in institutional receivables", "Interest cost on borrowing to bridge the payment gap", "Bad debt from defaulted or disputed hospital accounts", "Reduced stock rotation from cash lock-up"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 10 lakh - Rs. 1 crore", margin: "2% to 8% (net; directional estimate)", profile: "Single retail pharmacy or small sub-stockist serving a local area" },
          { scale: "Small Scale", revenue: "Rs. 1 crore - Rs. 10 crore", margin: "3% to 9% (net; directional estimate)", profile: "Multi-store pharmacy chain (2-10 outlets) or district-level wholesale distributor/stockist" },
          { scale: "Medium Scale", revenue: "Rs. 10 crore - Rs. 75 crore", margin: "3% to 8% (net; directional estimate)", profile: "Regional super-stockist/wholesale distributor covering multiple districts, or a city-wide pharmacy chain (10-50 stores)" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 75 crore, often Rs. 250 crore+", margin: "2% to 6% (net; directional estimate)", profile: "State/multi-state distribution house or C&F agent for major pharma companies, or an organised pharmacy retail chain (50+ stores)" },
        ],
      },
    },
    outlook: { sentence: "The industry was valued at around US$60 billion in 2026, with public and industry projections indicating potential growth to approximately US$130 billion by 2030 - though this should be treated as a strategic projection rather than a guaranteed outcome.", source: "Press Information Bureau" },
  },


  professional_services: {
    label: "Professional Services",
    defaultSegment: "solo_small_practice",
    segments: {
      established_firm: {
        label: "Established / Multi-Partner Firm",
        currentFlowStages: ["Market and service positioning", "Lead generation and qualification", "Scoping and engagement proposal", "Client onboarding and planning", "Service execution and delivery", "Filing, billing and collections", "Renewal and relationship management"],
        painPoints: [
          { issue: "Scope creep and unbilled advisory work", tags: [], summary: "Professional staff often answer extra questions, attend additional meetings, or prepare supplementary documents without changing the fee, quietly eroding engagement margins.", revenueLeaks: ["Unpaid professional hours", "Repeated revisions", "Excessive partner involvement", "Poor engagement margins"] },
          { issue: "Poor utilisation and inappropriate staff mix", tags: [], summary: "Professional-service profitability depends on assigning the right work to the right level of employee; when partners do junior tasks or staff wait idle for client documents, profitability and morale suffer.", revenueLeaks: ["Partners completing junior tasks", "Employees waiting for client documents", "Excessive overtime", "High burnout and attrition"] },
          { issue: "Missed deadlines and compliance failures", tags: [], summary: "CA, legal, payroll and compliance assignments involve strict statutory and contractual deadlines, and missing them can trigger penalties, negligence claims, and lost retainers.", revenueLeaks: ["Penalties and interest", "Professional negligence claims", "Reputational damage", "Loss of retainer"] },
          { issue: "Slow client documentation and approval", tags: [], summary: "Professional firms often cannot complete work because clients provide incomplete or late information, leaving staff idle and compressing delivery schedules.", revenueLeaks: ["Idle staff", "Delayed billing", "Missed filing dates", "Disputed responsibility"] },
          { issue: "Slow billing, collections and weak profitability visibility", tags: [], summary: "A firm may complete substantial work without raising invoices promptly or understanding whether the client is actually profitable, leaving cash tied up and margins unclear.", revenueLeaks: ["Unbilled work in progress", "Overdue receivables", "Fee write-offs", "Continued work for non-paying clients"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 10 lakh - Rs. 2 crore", margin: "-10% to 25%", profile: "Solo CA, lawyer, recruiter, HR consultant, bookkeeping practice or boutique advisory startup" },
          { scale: "Small Scale", revenue: "Rs. 2 crore - Rs. 25 crore", margin: "10% to 30%", profile: "Local CA firm, legal practice, recruitment agency, payroll bureau or specialist consulting firm" },
          { scale: "Medium Scale", revenue: "Rs. 25 crore - Rs. 250 crore", margin: "12% to 32%", profile: "Multi-city professional firm, executive-search company, staffing business, consulting practice or specialist law firm" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 250 crore, frequently Rs. 1,000 crore+", margin: "15% to 35%", profile: "Large accounting network, national law firm, global consultancy, major staffing group or business-services provider" },
        ],
      },
      solo_small_practice: {
        label: "Solo / Small Independent Practice",
        currentFlowStages: ["Referral/lead intake", "Initial phone/WhatsApp consultation", "Engagement scoping", "Service delivery", "Billing & invoicing", "Follow-up & retention"],
        painPoints: [
          { issue: "Referral-only client acquisition", tags: ["website"], summary: "Most solo CAs, lawyers, and consultants in India rely almost entirely on word-of-mouth and referrals because ICAI (Clause 6, First Schedule, CA Act 1949) and Bar Council Rule 36 restrict direct solicitation and advertising, leaving little incentive to build a discoverable online presence.", revenueLeaks: ["No inbound channel when referrals slow down (feast-or-famine pipeline)", "Invisible to prospects who research online before asking for a referral", "No compliant 'pull' presence (informational website/listing) to capture organic search intent", "Growth ceiling tied to the size of one person's personal network"] },
          { issue: "No coverage for client enquiries during billable work", tags: [], summary: "With no receptionist or support staff, calls and messages from prospective clients go unanswered while the practitioner is in meetings, court, audits, or on-site work.", revenueLeaks: ["Prospects move to the next name on the list within hours", "Missed calls during peak filing/audit/hearing seasons", "No after-hours or lunch-hour intake for urgent queries"] },
          { issue: "Unbilled informal advice over phone/WhatsApp", tags: [], summary: "Existing and prospective clients routinely get free guidance over calls and WhatsApp because there is no formal intake or engagement-letter process to convert quick questions into billable scope.", revenueLeaks: ["Hours of advisory time given away before any engagement is signed", "No paper trail to convert informal advice into a paid mandate", "Scope creep on existing retainers via ad-hoc WhatsApp requests"] },
          { issue: "Growth capped by the owner's personal bandwidth", tags: [], summary: "Revenue is directly tied to the practitioner's own billable hours since delegation is minimal (1-5 staff, often articled clerks/paralegals rather than fee-earners), making the practice difficult to scale without the owner working more hours.", revenueLeaks: ["Practice revenue plateaus once the owner's calendar is full", "Owner cannot take on larger mandates without turning away existing clients", "No systemized way to hand off routine work to junior staff"] },
          { issue: "Missed follow-ups and irregular billing cycles", tags: [], summary: "Without a CRM or billing system, prospective-client follow-ups fall through the cracks and invoicing happens sporadically (often only when the practitioner remembers or has downtime), creating cash flow gaps between engagements.", revenueLeaks: ["Warm leads go cold from lack of a follow-up cadence", "Delayed invoicing pushes out payment cycles and strains monthly cash flow", "No visibility into which clients/engagements are overdue for renewal or re-billing"] },
        ],
        financialMatrix: [
          { scale: "Startup/Early Stage", revenue: "Rs. 3 lakh - Rs. 10 lakh / year", margin: "15% to 30%", profile: "0-2 years in independent practice, single practitioner, building a client base mainly through personal network; most income reinvested in setting up office/compliance infrastructure rather than take-home profit (directionally estimated)." },
          { scale: "Small Scale", revenue: "Rs. 10 lakh - Rs. 25 lakh / year", margin: "30% to 45%", profile: "Established solo practitioner with a steady referral base and 1-2 support staff; mix of monthly retainers (e.g. Rs. 3,500-8,000/month compliance retainers for small-business clients) and one-off engagements." },
          { scale: "Medium Scale", revenue: "Rs. 25 lakh - Rs. 60 lakh / year", margin: "40% to 55%", profile: "Recognised local/niche reputation, 3-5 staff (junior associates/articled clerks/paralegals), recurring retainer clients plus higher-value advisory or litigation/audit mandates (directionally estimated based on typical small-practice cost structures)." },
          { scale: "Large Scale/Enterprise (top of segment)", revenue: "Rs. 60 lakh - Rs. 1.5 crore / year", margin: "45% to 60%", profile: "Boutique practice at the upper edge of 'small independent' before it typically converts into a multi-partner firm; corporate/institutional retainer clients, some big-client work reported up to ~Rs. 50 lakh/year for well-networked solo CAs (directionally estimated, upper bound reflects reported outlier earnings)." },
        ],
      },
    },
    outlook: { sentence: "India's wider services sector remains the primary driver of economic growth, having contributed around 55% of gross value added and attracted an average of approximately 80.2% of India's FDI inflows during FY2023-FY2025.", source: "India Brand Equity Foundation" },
  },


  real_estate: {
    label: "Real Estate",
    defaultSegment: "broker_agent",
    segments: {
      developer: {
        label: "Developer / Builder",
        currentFlowStages: ["Land Acquisition & Feasibility", "Design, Approvals & Financing", "Procurement & Construction", "Marketing & Lead Generation", "Sales, Booking & Collections", "Registration & Handover", "Facility Management & Referral"],
        painPoints: [
          { issue: "Lead Leakage and Weak Sales Follow-Up", tags: ["website", "social"], summary: "Developers spend heavily on portals, Google Ads and Meta Ads, but leads pass through disconnected systems (portal to Excel to salesperson to personal WhatsApp) with no follow-up record, so a meaningful share of paid leads never convert.", revenueLeaks: ["Rs. 1 crore/month marketing spend on 10,000 leads at Rs. 1,000 acquisition cost", "10% lead loss from poor allocation or follow-up", "~Rs. 10 lakh/month of lead-gen spend rendered ineffective before the sales process starts"] },
          { issue: "Construction Cost Overruns", tags: [], summary: "Hundreds of contractors, subcontractors, purchase orders and change requests create small discrepancies that accumulate quickly across a project's budget.", revenueLeaks: ["5% cost overrun on a Rs. 500 crore budget = Rs. 25 crore additional cost", "Material wastage and duplicate procurement", "Late procurement and contractor delays", "Poor inventory visibility and price variation"] },
          { issue: "Project Delays", tags: [], summary: "Real estate profitability is highly sensitive to time, and a six-month delay compounds costs across financing, labour, equipment and marketing while also creating compliance and reputational exposure.", revenueLeaks: ["Additional financing costs and labour overhead", "Equipment and marketing costs from extended timelines", "Customer compensation and RERA exposure", "Slower collections and reputational damage"] },
          { issue: "Slow Customer Collections", tags: [], summary: "A developer can record large booked sales values without receiving the cash promptly, and weak collection tracking increases working-capital requirements.", revenueLeaks: ["Rs. 700 crore booked sales vs Rs. 500 crore actually collected (example)", "Rs. 200 crore remaining receivable", "Weak collection tracking increases working-capital requirements"] },
          { issue: "Departmental Data Silos", tags: [], summary: "Sales, Finance, Construction, Procurement, Marketing and Customer Service each run on separate systems (CRM, ERP, Excel, email, WhatsApp), so there is no single source of truth and the same unit can show different statuses in different systems.", revenueLeaks: ["No single source of truth across CRM, ERP, Finance and Construction", "Same unit shows conflicting status (sold/pending/reserved/available) across systems", "Creates operational and customer risk"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 5-50 Cr", margin: "3-10%", profile: "1-2 small projects" },
          { scale: "Small Scale", revenue: "Rs. 50-250 Cr", margin: "5-12%", profile: "Local developer with 2-5 active projects" },
          { scale: "Medium Scale", revenue: "Rs. 250-1,500 Cr", margin: "8-18%", profile: "Multiple projects / cities" },
          { scale: "Large Scale / Enterprise", revenue: "Rs. 1,500 Cr-Rs. 10,000+ Cr", margin: "10-25%+", profile: "Large branded developer / diversified portfolio" },
        ],
      },
      broker_agent: {
        label: "Broker / Channel Partner / Individual Agent",
        currentFlowStages: ["Lead/enquiry generation", "Property/inventory matching", "Site visit coordination", "Negotiation & documentation", "Deal closing/registration", "Commission collection", "Referral & repeat business"],
        painPoints: [
          { issue: "Leads Go Cold with No Follow-Up System", tags: [], summary: "Enquiries from portals, WhatsApp, and referrals land in scattered inboxes and personal chats, and without a structured follow-up cadence agents lose the first-mover advantage that decides whether a site visit happens.", revenueLeaks: ["Buyer goes to whichever agent calls back first", "No reminders to re-engage warm but undecided leads", "Follow-up history lost when it lives only in personal WhatsApp", "Site-visit conversion drops as enquiries go stale"] },
          { issue: "No System to Track Which Leads or Listings Are Active", tags: [], summary: "Agents juggle owner listings, developer inventory, and buyer requirements across notebooks, Excel sheets, and memory, so stale listings keep getting shown and live demand goes unmatched.", revenueLeaks: ["Time wasted showing units that are already sold or unavailable", "Missed matches between fresh inventory and waiting buyers", "No visibility into which deals are near closing vs. stalled", "Repeated re-verification of availability with developers/owners"] },
          { issue: "Commission Disputes & Delayed Payouts from Developers", tags: [], summary: "Channel-partner commissions from developers are commonly delayed 60-90+ days or disputed/split among multiple intermediaries, straining agent cash flow even after a deal has closed.", revenueLeaks: ["Cash-flow gap between deal closure and commission receipt", "Commission-split disputes with co-brokers or telecallers", "Good projects quietly deprioritized over poor payout history", "No formal agreement locking in payout timelines"] },
          { issue: "No Digital Presence, So Buyers Can't Find or Verify Them", tags: ["website"], summary: "Most independent brokers operate without a website, listings page, or visible RERA registration, so buyers researching online can neither discover them nor confirm they are legitimate.", revenueLeaks: ["Buyers default to portal-listed or visibly RERA-registered agents", "No searchable footprint to capture direct/organic enquiries", "Referrals can't easily verify credentials before engaging", "Lost trust versus agents who show reviews/testimonials online"] },
          { issue: "Competing with Portals and Other Agents for the Same Lead", tags: ["website", "social"], summary: "The same enquiry from 99acres, MagicBricks, or Housing.com is often shared with multiple brokers at once, while zero-brokerage models like NoBroker add price and speed pressure on independent agents.", revenueLeaks: ["Multiple agents chase the same shared lead, diluting close rate", "Portal lead cost keeps rising while conversion stays flat", "Zero-commission platforms undercut fee-based agents on price", "No differentiated online presence to win the deal before rivals"] },
        ],
        financialMatrix: [
          { scale: "Startup/Early Stage - Individual/Solo Agent", revenue: "Rs. 3 lakh - Rs. 8 lakh per year (gross commission income)", margin: "60% to 75%", profile: "Solo, often unorganized-sector agent in first 1-2 years, no office, working 1-2% resale commission or one month's rent on leasing deals off referrals and portal leads; income inconsistent until network builds (estimate, directionally reasonable)" },
          { scale: "Small Scale - Small Brokerage (2-10 agents)", revenue: "Rs. 15 lakh - Rs. 60 lakh per year (firm-level gross commission)", margin: "20% to 35%", profile: "Small branded office employing 2-10 agents; firm keeps a 14-34% cut of each agent's commission plus desk fees of roughly Rs. 3,000-6,000/agent/month, mixing resale with 1-2 developer channel-partner tie-ups (estimate based on brokerage revenue-share norms)" },
          { scale: "Medium Scale - Established Multi-City Brokerage", revenue: "Rs. 1 crore - Rs. 5 crore per year", margin: "15% to 25%", profile: "10-50+ agents across multiple branches, RERA-registered as a firm, empanelled as a preferred channel partner with several developers, handling resale, primary sales, and leasing (estimate)" },
          { scale: "Large Scale/Enterprise - Large Channel-Partner Network/Franchise", revenue: "Rs. 10 crore+ per year", margin: "10% to 20%", profile: "Regional or national channel-partner network/franchise model with hundreds of agents or franchisees, a technology/CRM platform, and formal SLAs with developers for bulk inventory tie-ups and volume incentives (estimate)" },
        ],
      },
    },
    outlook: { sentence: "India's real estate fundamentals remain strong, with more than US$14 billion of real-estate equity inflows in 2025 (an all-time high) and investment momentum expected to remain strong during 2026; however, CBRE expects unit sales to stay relatively range-bound in 2026 even as sales values remain elevated, as premium and high-end housing continue gaining market share.", source: "CBRE India" },
  },


  trade_services: {
    label: "Trade & Commerce",
    currentFlowStages: ["Sourcing & supplier onboarding", "Assortment & inventory planning", "Order capture & fulfilment", "Payment & settlement", "Delivery & last-mile", "Returns & after-sales support", "Customer retention & loyalty"],
    painPoints: [
      { issue: "Excess inventory, stockouts and poor forecasting", tags: [], summary: "Trade businesses must buy stock before knowing final customer demand, so forecasting errors leave one product or location oversupplied while another goes unavailable.", revenueLeaks: ["Lost sales due to stockouts", "Capital tied up in inventory", "Markdowns", "Expired or obsolete products"] },
      { issue: "Margin leakage through discounts, commissions and hidden channel costs", tags: [], summary: "A product can look profitable on selling price minus purchase price alone, but true margin is often much lower once discounts, marketplace commission, delivery, payment fees, returns and marketing are counted.", revenueLeaks: ["Unapproved discounts", "Marketplace deductions", "Payment-gateway fees", "Price mismatch across channels"] },
      { issue: "Shrinkage, theft, counterfeit returns and inventory mismatch", tags: [], summary: "Large volumes of products moving through suppliers, warehouses, stores, delivery partners and customers create both physical and system losses wherever controls are weak.", revenueLeaks: ["Employee or customer theft", "Warehouse misplacement", "Counterfeit item returned against a genuine order", "Lost parcels"] },
      { issue: "High returns, failed deliveries and reverse-logistics cost", tags: [], summary: "Returns are particularly damaging in e-commerce because the business may pay for outbound delivery, return pickup, inspection, repacking and refund without ever retaining the sale.", revenueLeaks: ["Two-way freight", "Refund processing", "Marketplace penalties", "Unsaleable opened product"] },
      { issue: "Wholesale credit losses and slow payment collection", tags: [], summary: "Wholesalers and distributors often extend credit to retailers to increase market coverage, which exposes them to overdue receivables and bad debts.", revenueLeaks: ["Overdue receivables", "Bad debts", "Field-collection expense", "Continued sales beyond credit limit"] },
    ],
    financialMatrix: [
      { scale: "Startup / Early Stage", revenue: "Rs. 25 lakh-Rs. 5 crore", margin: "-20% to 8%", profile: "Small online seller, D2C brand, neighbourhood retailer, specialist wholesaler or early marketplace business" },
      { scale: "Small Scale", revenue: "Rs. 5 crore-Rs. 50 crore", margin: "2% to 10%", profile: "Regional retailer, distributor, multi-store operator, category wholesaler, franchisee or established e-commerce seller" },
      { scale: "Medium Scale", revenue: "Rs. 50 crore-Rs. 500 crore", margin: "3% to 12%", profile: "Multi-city retail chain, large distributor, B2B marketplace, omnichannel brand or institutional supplier" },
      { scale: "Large Scale / Enterprise", revenue: "Above Rs. 500 crore, often Rs. 5,000 crore+", margin: "3% to 15%", profile: "National retailer, large marketplace, wholesale network, consumer-commerce platform or diversified trade group" },
    ],
    outlook: { sentence: "India's retail sector could grow from approximately US$1.09 trillion in 2025 to more than US$2.36 trillion by 2030, with organised retail expected to capture more than 35% of the market - though forecasts vary materially between research organisations because they use different definitions of retail and e-commerce, so these figures should be treated as directional scenarios rather than guaranteed outcomes.", source: "India Brand Equity Foundation (IBEF)" },
  },

  chemicals: {
    label: "Chemicals & Petrochemicals",
    defaultSegment: "distributor_trading",
    segments: {
      manufacturer: {
        label: "Manufacturer",
        currentFlowStages: ["Market and demand analysis", "Customer acquisition and technical assessment", "Product development and formulation", "Regulatory and safety approval", "Production and procurement planning", "Manufacturing, reaction and quality control", "Packaging, storage and dispatch", "Billing, service and retention"],
        painPoints: [
          { issue: "Feedstock and energy-price volatility", tags: [], summary: "Petrochemical and chemical manufacturers are highly exposed to crude oil, natural gas, naphtha, electricity and freight price swings, which can erode margins on fixed-price contracts.", revenueLeaks: ["Orders priced using outdated feedstock costs", "Margin erosion during fixed-price contracts", "High inventory purchased before a price decline", "Foreign-exchange losses"] },
          { issue: "Yield loss, off-specification production and reprocessing", tags: [], summary: "Chemical manufacturing depends on tightly controlled reactions, and small deviations can cause an entire batch to fail purity, colour, viscosity or performance requirements.", revenueLeaks: ["Lower reaction conversion", "Excess solvent and catalyst use", "Reprocessing expense and batch destruction", "Customer rejection"] },
          { issue: "Unplanned shutdowns and asset-integrity failures", tags: [], summary: "Reactors, compressors, distillation columns, heat exchangers and pipelines operate under demanding conditions, and failures halt production and threaten deliveries.", revenueLeaks: ["Lost production", "Emergency maintenance", "Missed customer delivery", "Environmental incident or major safety exposure"] },
          { issue: "Safety, environmental and compliance failures", tags: [], summary: "The industry handles flammable, toxic, corrosive and reactive materials, and weak controls can lead to injury, fire, explosion, leaks or regulatory action.", revenueLeaks: ["Plant closure", "Fines and remediation", "Customer disqualification", "Reputation damage"] },
          { issue: "Customer concentration and long product-approval cycles", tags: [], summary: "Specialty-chemical suppliers may spend months developing and validating a product before receiving regular commercial orders, creating exposure to unrecovered costs and single-customer dependence.", revenueLeaks: ["Unrecovered development cost", "Samples supplied without conversion", "Dependence on one major customer", "Sudden loss of approved-vendor status"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 50 lakh - Rs. 10 crore", margin: "-15% to 10%", profile: "Formulation startup, laboratory chemical supplier, small coatings company, recycling unit or specialty-chemical developer" },
          { scale: "Small Scale", revenue: "Rs. 10 crore - Rs. 100 crore", margin: "3% to 12%", profile: "Regional chemical manufacturer, paint producer, polymer compounder, solvent blender or fertilizer blender" },
          { scale: "Medium Scale", revenue: "Rs. 100 crore - Rs. 1,000 crore", margin: "5% to 16%", profile: "Established specialty-chemical company, resin manufacturer, agrochemical producer, plastics processor or industrial-chemical exporter" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 1,000 crore, often Rs. 10,000 crore+", margin: "4% to 18%", profile: "Integrated petrochemical company, fertilizer producer, diversified chemical group or multinational specialty manufacturer" },
        ],
      },
      distributor_trading: {
        label: "Distributor / Trading",
        currentFlowStages: ["sourcing from manufacturers", "storage & handling", "customer enquiry", "quotation & negotiation", "order fulfillment & dispatch", "billing & collections", "repeat business & retention"],
        painPoints: [
          { issue: "Price volatility between purchase and sale", tags: [], summary: "Distributors buy chemicals in bulk and hold inventory before resale, so a market price fall or manufacturer price hike between purchase and sale can erode or wipe out already-thin trading margins.", revenueLeaks: ["Inventory devaluation when market prices fall", "Margin erosion on fixed-price customer contracts signed before a cost increase", "Forced distress-selling of aging stock to free up cash", "Cost of hedging or holding buffer stock against price swings"] },
          { issue: "Hazardous storage, handling and compliance costs", tags: [], summary: "Storing and repacking chemicals (especially hazardous or petroleum-linked products) requires PESO/explosives licensing, fire-safety NOCs and pollution-control approvals, and delays or lapses can halt dispatch entirely.", revenueLeaks: ["Lost sales days from license renewal delays or inspection holds", "Fines and penalties for non-compliant storage or repacking", "Rising insurance premiums on hazardous-goods godowns", "Capex on tanks, drums and repacking infrastructure sitting idle between cycles"] },
          { issue: "Customer credit risk and extended payment terms", tags: [], summary: "Smaller industrial buyers routinely expect 30-90 day credit, and distributors absorb the working-capital cost and default risk while often paying manufacturers faster or in advance.", revenueLeaks: ["Bad debts from defaulting or slow-paying buyers", "Working capital tied up funding buyer credit cycles", "Interest cost on borrowed working capital to bridge the gap", "Lost orders from tightening credit terms to protect cash flow"] },
          { issue: "Inventory complexity across many small-volume SKUs", tags: [], summary: "Distributors carry dozens to hundreds of chemical grades and pack sizes for diverse industrial customers, making it hard to track fast- versus slow-moving stock and avoid both stockouts and dead inventory.", revenueLeaks: ["Capital locked in slow-moving or obsolete SKUs", "Stockouts on fast-moving lines causing loss of repeat orders", "Dispatch errors from manual stock tracking across many grades", "Warehouse space and handling costs spread thin across too many SKUs"] },
          { issue: "Competition from direct manufacturer sales and MNC consolidation", tags: [], summary: "Large manufacturers increasingly sell directly to bigger buyers, while global distribution groups (Brenntag, IMCD, DKSH) acquire or out-compete independent Indian distributors, squeezing smaller trading firms from both ends.", revenueLeaks: ["Loss of large accounts to direct manufacturer-buyer deals", "Price undercutting by larger, consolidated distributors", "Reduced negotiating leverage and margin support from manufacturers", "Customer attrition to competitors with a wider product range or better terms"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 20 lakh - Rs. 2 crore", margin: "5% to 15% (directional estimate)", profile: "Solo proprietor or small trading firm reselling a narrow chemical range from a single godown, often on cash-and-carry terms" },
          { scale: "Small Scale", revenue: "Rs. 2 crore - Rs. 15 crore", margin: "4% to 12% (directional estimate)", profile: "Registered partnership/dealer distributing for 1-2 manufacturers in a regional market, with basic drum/tank storage" },
          { scale: "Medium Scale", revenue: "Rs. 15 crore - Rs. 75 crore", margin: "4% to 10% (directional estimate)", profile: "Multi-warehouse distributor with PESO-licensed hazardous storage, serving industrial clusters across a state or region with a dedicated sales/technical team" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 75 crore, often Rs. 200 crore+", margin: "3% to 9% (directional estimate)", profile: "Pan-India or multi-state distribution network with authorised/exclusive agreements with large manufacturers, bulk tank-farm storage, competing with global players like Brenntag, IMCD and DKSH" },
        ],
      },
    },
    outlook: { sentence: "Government and industry estimates place India's chemicals and petrochemicals sector at approximately US$220 billion in 2026, with an aspiration to reach around US$300 billion by 2030, US$1 trillion by 2040 and US$2 trillion by 2047 - figures the source document itself frames as strategic growth ambitions rather than guaranteed forecasts.", source: "Government and industry estimates" },
  },


  metals_heavy_industry: {
    label: "Metals & Heavy Industry",
    defaultSegment: "trader_distributor",
    segments: {
      producer: {
        label: "Producer / Mill",
        currentFlowStages: ["Market analysis & demand forecasting", "Customer acquisition & tendering", "Technical assessment & engineering design", "Cost estimation & order confirmation", "Procurement & raw-material planning", "Production, machining & finishing", "Quality inspection, dispatch & after-sales service"],
        painPoints: [
          { issue: "Raw-material and commodity-price volatility", tags: [], summary: "Steel scrap, iron ore, coal, ferroalloys, aluminium, copper, nickel and energy prices can change significantly between quotation and production, eroding margins on orders priced earlier.", revenueLeaks: ["Orders accepted at outdated raw-material rates", "Margin erosion during long delivery cycles", "Excess inventory purchased at market peaks", "Emergency procurement at premium prices"] },
          { issue: "Low yield, scrap and rework", tags: [], summary: "Metal processing naturally involves yield loss, and poor process control can significantly increase melting loss, scale loss, trimming, machining allowance and rejected production.", revenueLeaks: ["Excess raw-material consumption", "Higher energy use per accepted tonne", "Recasting and reprocessing", "Excess machining time"] },
          { issue: "Equipment breakdown and bottleneck downtime", tags: [], summary: "Blast furnaces, electric furnaces, rolling mills, presses, CNC machines and cranes are expensive, production-critical assets, and their breakdowns or bottlenecks disrupt the whole operation.", revenueLeaks: ["Lost production capacity", "Idle labour", "Missed customer deadlines", "Emergency repair costs"] },
          { issue: "Quality failures and weak traceability", tags: [], summary: "Customers may reject products due to incorrect chemistry, dimensions, mechanical properties, weld quality, internal defects or incomplete documentation.", revenueLeaks: ["Entire heat or batch rejection", "Rework and remelting", "Liquidated damages", "Warranty claims"] },
          { issue: "High energy and environmental-compliance cost", tags: [], summary: "Metal production is highly energy-intensive, and furnaces, rolling mills, heat-treatment systems, compressors and pollution-control equipment materially affect profitability.", revenueLeaks: ["Excess electricity, coal, gas or electrode consumption", "Furnace heat loss", "Peak-demand penalties", "Environmental penalties"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 50 lakh-Rs. 10 crore", margin: "-10% to 8%", profile: "Small fabrication workshop, machining startup, niche casting unit or industrial-equipment startup" },
          { scale: "Small Scale", revenue: "Rs. 10 crore-Rs. 100 crore", margin: "2% to 9%", profile: "Foundry, forging unit, steel service centre, fabricator or component manufacturer" },
          { scale: "Medium Scale", revenue: "Rs. 100 crore-Rs. 1,000 crore", margin: "4% to 12%", profile: "Integrated foundry and machining business, rolling mill, large fabricator or heavy-equipment manufacturer" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 1,000 crore, often Rs. 10,000 crore+", margin: "3% to 15%", profile: "Integrated steel or aluminium producer, large engineering group or multinational heavy-equipment company" },
        ],
      },
      trader_distributor: {
        label: "Trader / Stockist / Distributor",
        currentFlowStages: ["sourcing from mills/producers", "stockyard inventory holding", "customer enquiry & quotation", "cutting/processing to size", "sales & dispatch", "billing & collections", "repeat business & relationship mgmt"],
        painPoints: [
          { issue: "Steel price volatility erodes held-inventory margin", tags: [], summary: "Because stockists buy on immediate payment and hold physical inventory for weeks or months, a fall in mill prices between purchase and sale can wipe out the thin trading margin on that stock, while a rise creates a false sense of profit that reverses on the next restock.", revenueLeaks: ["Inventory revalued down before sale clears", "Forced discounting to move stock before further price drops", "Hedging/futures tools rarely used by small stockists", "Interest cost on financed stock during price dips"] },
          { issue: "Weight, size and quality disputes with buyers", tags: [], summary: "Disputes over short weight, cutting tolerance, rust/corrosion, or grade mismatch lead to rejected material, delayed payment, or price renegotiation after delivery, and traders often absorb the cost because informal billing leaves little documentation to enforce claims.", revenueLeaks: ["Free replacement or price cuts to resolve disputes", "Payment held back pending resolution", "Shortage claims from uncalibrated weighbridge readings", "No time-stamped inspection record to contest claims"] },
          { issue: "Credit sales to contractors/fabricators strain cash flow", tags: [], summary: "Traders typically pay mills upfront or on short terms but extend 30-90 day credit to fabricators and contractors to win business, so working capital gets locked in receivables while suppliers demand immediate payment.", revenueLeaks: ["Cash tied up in 60-90 day customer credit", "Bad debt from contractor payment defaults", "Borrowing costs to bridge the pay-now/collect-later gap", "No early-payment discount structure to speed collections"] },
          { issue: "Storage, yard space and handling costs squeeze thin margins", tags: [], summary: "Stocking bulky, heavy material requires yard space, cranes/forklifts, and protection from weather and theft, and these fixed costs must be recovered from margins that are already only a few percentage points wide.", revenueLeaks: ["Rent/maintenance on yard space regardless of turnover", "Material damage or rust from open storage", "Manual handling inefficiency raising per-tonne cost", "Capital locked in slow-moving/dead stock"] },
          { issue: "Mills selling direct bypass traditional stockists", tags: ["website"], summary: "Producers increasingly sell directly to large buyers through franchise retail formats and B2B marketplaces, cutting traders out of the higher-volume, higher-margin deals and leaving them to compete mainly for smaller, less predictable orders.", revenueLeaks: ["Large accounts diverted to mill direct-sales/franchise channels", "Loss of exclusive-dealer pricing advantage", "Price transparency from online marketplaces compresses margin", "No differentiated online presence to defend smaller accounts"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 50 lakh - Rs. 5 crore", margin: "3% to 5%", profile: "Single-location small stockist/retailer reselling to local fabricators and contractors, limited yard space, mostly cash transactions with some informal credit." },
          { scale: "Small Scale", revenue: "Rs. 5 crore - Rs. 25 crore", margin: "3% to 4%", profile: "Registered stockist with a dedicated yard, buying directly from mills/authorized channel, extending 30-60 day credit to regular contractor and fabricator clients (in line with ICRA-reported 3-4% operating margins for steel traders)." },
          { scale: "Medium Scale", revenue: "Rs. 25 crore - Rs. 100 crore", margin: "2% to 3.5%", profile: "Multi-product stockist/distributor with in-house cutting/processing capability, often an authorized dealer for a major mill brand, working capital intensive with 60-90 day customer credit terms and high reliance on borrowed funds (estimate, directionally consistent with ICRA sector commentary)." },
          { scale: "Large Scale / Enterprise", revenue: "Rs. 100 crore+", margin: "1.5% to 3%", profile: "Multi-location distributor or steel service center network, high-volume authorized dealer with value-added processing, highly leveraged capital structure (gearing often 5x+) offset by steady accrual-based operations (estimate, based on ICRA rating commentary on large steel traders)." },
        ],
      },
    },
    outlook: { sentence: "India produced approximately 168.4 million tonnes of crude steel in FY2025-26, representing growth of more than 10.7% year on year, with finished-steel consumption reaching approximately 164 million tonnes, supported by infrastructure, construction, railways and manufacturing demand.", source: "Press Information Bureau" },
  },


  automobile_auto_components: {
    label: "Automobile & Auto Components",
    defaultSegment: "dealer_distributor",
    segments: {
      manufacturer: {
        label: "Manufacturer / OEM Supplier",
        currentFlowStages: ["Demand forecasting & product strategy", "Vehicle & component design", "Supplier sourcing & component development", "Procurement & inbound logistics", "Manufacturing & assembly", "Dealer sales & delivery", "After-sales service & retention"],
        painPoints: [
          { issue: "Supply-chain disruption and component shortages", tags: [], summary: "Automobile production depends on thousands of interdependent components, so a missing semiconductor, sensor, wiring harness, casting or battery component can stop an entire assembly line.", revenueLeaks: ["Production-line stoppages", "Idle labour and machinery", "Emergency freight", "Missed delivery commitments"] },
          { issue: "Quality failures, warranty claims and recalls", tags: [], summary: "A small component defect can affect thousands of vehicles and create significant warranty, recall and reputational costs.", revenueLeaks: ["Rework and scrap", "Warranty claims", "Recall logistics", "Lost brand confidence"] },
          { issue: "Production downtime and low equipment utilisation", tags: [], summary: "Presses, robots, CNC machines, paint lines and assembly equipment are capital-intensive, so unplanned downtime directly reduces output and increases per-unit cost.", revenueLeaks: ["Missed production targets", "Overtime and weekend recovery shifts", "Tooling failure", "Lower return on plant investment"] },
          { issue: "Forecast error and dealer inventory imbalance", tags: [], summary: "Incorrect demand forecasts by model, fuel type, variant, colour and geography create ageing inventory in one market while dealers in another face shortages.", revenueLeaks: ["Dealer discounting", "High inventory-financing cost", "Model-year depreciation", "Lost sales from unavailable variants"] },
          { issue: "EV transition and technology-obsolescence risk", tags: [], summary: "EVs require new competencies in batteries, power electronics, motors, software, charging and thermal management, and traditional engine and transmission suppliers may lose demand if they fail to diversify.", revenueLeaks: ["Underutilised legacy machinery", "High research and development expense", "Battery warranty exposure", "Incorrect investment timing"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 50 lakh-Rs. 10 crore", margin: "-15% to 8%", profile: "EV-component startup, small fabrication unit, automotive software company, accessory maker or workshop network" },
          { scale: "Small Scale", revenue: "Rs. 10 crore-Rs. 100 crore", margin: "3% to 10%", profile: "Tier 3 supplier, machining unit, plastic or rubber component maker, regional parts distributor or dealership group" },
          { scale: "Medium Scale", revenue: "Rs. 100 crore-Rs. 1,000 crore", margin: "5% to 12%", profile: "Established Tier 1 or Tier 2 supplier, specialist EV supplier, large dealership group or aftermarket brand" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 1,000 crore, often Rs. 10,000 crore+", margin: "4% to 15%", profile: "Vehicle OEM, vertically integrated group, global component supplier or major parts manufacturer" },
        ],
      },
      dealer_distributor: {
        label: "Dealer / Distributor / Aftermarket Retail",
        currentFlowStages: ["Sourcing from OEM/manufacturer", "Inventory & stock management", "Customer enquiry & test drive", "Sales & financing", "Delivery, billing & registration", "Service & aftersales", "Repeat & referral business"],
        painPoints: [
          { issue: "Vehicle variant & parts SKU complexity", tags: [], summary: "Dealers must stock the right mix of models, trims, colours and fuel types while parts distributors carry thousands of SKUs across makes, models and years, and getting the mix wrong ties up capital in inventory that isn't moving.", revenueLeaks: ["Ageing/unsold-variant stock forced into heavy discounting", "High floor-plan/inventory-financing cost on slow-moving units", "Stockouts of fast-moving parts or colours losing walk-in sales", "Working capital trapped in the wrong inventory mix"] },
          { issue: "Financing & loan processing delays", tags: [], summary: "Most vehicle purchases in India are financed, and delays in loan approval, paperwork or bank tie-ups push hesitant buyers to a faster competitor or cause the deal to fall through entirely.", revenueLeaks: ["Deals lost to competitors with faster financing turnaround", "Missed F&I (finance & insurance) commission income", "Extra staff hours spent chasing loan paperwork", "Delivery delays that hurt satisfaction and referrals"] },
          { issue: "Counterfeit & non-genuine parts undercutting margin", tags: [], summary: "Spurious and counterfeit parts are estimated by industry bodies to make up roughly a quarter to a third of India's aftermarket parts trade, undercutting genuine-parts retailers on price and eroding both trust and margin.", revenueLeaks: ["Price undercutting by grey-market and counterfeit sellers", "Warranty comebacks and rework from failed spurious parts", "Lost repeat business once a customer is burned once", "Margin compression on otherwise fast-moving genuine parts"] },
          { issue: "Service-bay utilisation & technician productivity", tags: [], summary: "Industry data shows Indian dealers earn roughly 4-5% margin on vehicle sales versus 15-20% margin on spare parts/service, so an empty service bay or idle technician is lost high-margin revenue that vehicle sales alone can't replace.", revenueLeaks: ["Idle service bays and unbilled technician hours", "Under-booked service slots on weekdays", "Missed upsell on parts/accessories during service visits", "Lower absorption of fixed workshop overheads"] },
          { issue: "Weak follow-up systems & online marketplace competition", tags: ["website", "social"], summary: "Without automated service and renewal reminders, dealers and retailers lose repeat business to whichever channel reaches the customer first - increasingly fast-growing online parts marketplaces (Amazon, Flipkart, Boodmo and similar) rather than the original seller.", revenueLeaks: ["Lapsed customers not brought back for repeat service/parts", "Customers defecting to online marketplaces for parts purchases", "Referral revenue lost from poor post-sale engagement", "Customer data sitting unused instead of driving renewal outreach"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 25 lakh - Rs. 5 crore", margin: "1% to 6%", profile: "Single-outlet 2-wheeler/EV dealership, small independent parts/accessories shop, or new service-only garage (margin band is a directional estimate; vehicle-sale margins alone run 4-5% industry-wide)" },
          { scale: "Small Scale", revenue: "Rs. 5 crore - Rs. 50 crore", margin: "3% to 8%", profile: "Single-showroom passenger-vehicle or commercial-vehicle dealer, regional parts wholesaler/distributor, or multi-bay independent service centre" },
          { scale: "Medium Scale", revenue: "Rs. 50 crore - Rs. 300 crore", margin: "3% to 9%", profile: "Multi-outlet dealership spanning 2-3 towns, authorised multi-brand service network, or established regional aftermarket parts distributor" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 300 crore, large listed dealer groups often Rs. 1,000 crore+", margin: "3% to 10%", profile: "Large multi-brand dealer group (e.g. publicly listed dealership chains) or pan-India aftermarket/parts distribution network" },
        ],
      },
    },
    outlook: { sentence: "ACMA reports the auto-component segment reached approximately US$80.2 billion in FY2024-25, up 9.6% year-on-year, but growth will not be uniform across every segment - internal-combustion component suppliers, particularly those concentrated in engine and transmission parts, may face slower long-term demand unless they diversify into EV, electronics, lightweighting or aftermarket products.", source: "ACMA" },
  },


  food_processing: {
    label: "Food Processing (Packaged Foods, Dairy, Beverages, Meat/Seafood, Fruit & Vegetable, Bakery, RTE & Grain Milling)",
    defaultSegment: "distributor_retailer",
    segments: {
      manufacturer: {
        label: "Manufacturer / Processor",
        currentFlowStages: ["Market Analysis & Product Development", "Regulatory Feasibility & Trial Production", "Sourcing & Raw-Material Procurement", "Processing & Batch Production", "Quality Control & Packaging", "Distribution & Order Fulfillment", "Billing, Returns & Recall Management"],
        painPoints: [
          { issue: "Raw-material perishability and inconsistent quality", tags: [], summary: "Agricultural inputs vary by season, supplier, moisture, maturity, fat content, size and contamination level, which disrupts processing consistency and yield.", revenueLeaks: ["Spoilage before production", "Low processing yield", "Rejected supplier batches", "Higher sorting and rework costs"] },
          { issue: "Expiry, spoilage and forecasting errors", tags: [], summary: "Food businesses must balance product availability against limited shelf life; excess production creates write-offs while underproduction causes stockouts and lost retailer space.", revenueLeaks: ["Expired stock at warehouses and distributors", "Retailer returns", "Heavy discounting near expiry", "Lost sales caused by stockouts"] },
          { issue: "Quality failures, contamination and recalls", tags: [], summary: "A single contamination incident can affect a large number of units and damage the brand, so compliance needs to be built into the operating system rather than managed only through periodic inspections.", revenueLeaks: ["Batch rejection", "Reprocessing or destruction", "Customer compensation", "Product recall and transportation expense"] },
          { issue: "Distributor opacity and trade-promotion leakage", tags: [], summary: "Manufacturers frequently know what they sold to distributors but lack visibility into what distributors sold to retailers, creating blind spots in stock movement and promotion spend.", revenueLeaks: ["Excess stock in the wrong territory", "False promotional claims", "Distributor stock nearing expiry", "Duplicate or unauthorised discounts"] },
          { issue: "High energy, cold-chain and equipment costs", tags: [], summary: "Refrigeration, boilers, ovens, dryers, compressors and freezing systems consume substantial energy, and a cold-chain failure can make an entire shipment unusable.", revenueLeaks: ["Excess electricity, steam and water consumption", "Refrigerant leakage", "Equipment breakdown", "Production downtime"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 25 lakh-Rs. 5 crore", margin: "-8% to 8%", profile: "Home-grown packaged food brand, cloud production unit, small bakery, spice processor or D2C food startup" },
          { scale: "Small Scale", revenue: "Rs. 5 crore-Rs. 50 crore", margin: "3% to 10%", profile: "Regional manufacturer, dairy unit, grain mill, snack producer, bakery or institutional supplier" },
          { scale: "Medium Scale", revenue: "Rs. 50 crore-Rs. 500 crore", margin: "5% to 12%", profile: "Multi-state brand, contract manufacturer, established processor or exporter" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 500 crore, often Rs. 1,000 crore+", margin: "6% to 16%", profile: "National FMCG food company, integrated dairy, beverage company, large exporter or diversified food group" },
        ],
      },
      distributor_retailer: {
        label: "Distributor / Wholesaler / Retailer",
        currentFlowStages: ["sourcing from manufacturers", "inventory & shelf-life management", "order intake (phone/WhatsApp/rep)", "billing & invoicing", "credit sales & collections", "last-mile delivery", "repeat order cycle"],
        painPoints: [
          { issue: "Expiry & spoilage of perishable stock", tags: [], summary: "Packaged food, dairy, bakery and fresh-adjacent items get written off or heavily discounted when they near expiry because there's no systematic FEFO (first-expiry-first-out) tracking or demand forecasting at order time.", revenueLeaks: ["Stock write-offs on expired inventory", "Forced clearance sales at deep discounts", "Over-ordering of slow-moving SKUs", "No expiry-date tracking system"] },
          { issue: "Thin margins on high-volume staples", tags: [], summary: "Commodity and staple categories (atta, rice, oil, sugar) carry wafer-thin trade margins, and local price wars with nearby wholesalers erode profitability even as sales volumes stay high.", revenueLeaks: ["Price wars eroding per-unit margin", "Over-reliance on manufacturer scheme income", "High volume without proportional profit", "No upsell to higher-margin categories"] },
          { issue: "Credit sales to smaller retailers", tags: [], summary: "Distributors and wholesalers routinely extend informal credit to downstream kirana stores to keep volume moving, which locks up working capital and creates exposure to delayed payments or bad debt.", revenueLeaks: ["Cash tied up in outstanding receivables", "Bad debt write-offs from defaulting retailers", "Delayed collections limiting next reorder", "Credit tracked on paper/registers, not systems"] },
          { issue: "Cold-chain & storage overheads", tags: [], summary: "Maintaining refrigerated storage and transport for dairy, frozen and chilled food categories adds a fixed cost burden, and any power outage or logistics gap causes direct spoilage losses.", revenueLeaks: ["High cold-storage energy & maintenance costs", "Spoilage during power outages/transit delays", "Cost of reefer vehicles for last-mile", "Wastage from inconsistent temperature control"] },
          { issue: "Competition from quick-commerce & large retail chains", tags: ["website", "social"], summary: "Blinkit/Zepto-style quick-commerce and organized retail chains are pulling volume away from traditional wholesale/kirana channels by offering faster delivery and better discovery, while most small distributors and retailers have no online presence or customer engagement channel to defend against it.", revenueLeaks: ["Walk-in footfall shifting to quick-commerce apps", "No online/WhatsApp ordering option for customers", "Loss of repeat customers to organized retail", "No loyalty or engagement program to retain buyers"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 15 lakh - Rs. 40 lakh (annual)", margin: "8% to 15%", profile: "Single kirana outlet or new sub-distributor covering a small territory, manual bookkeeping, limited cash reserves (estimate, directionally reasonable)." },
          { scale: "Small Scale", revenue: "Rs. 40 lakh - Rs. 2 crore (annual)", margin: "6% to 12%", profile: "Established retail store or area-level FMCG/food distributor with 1-2 delivery vehicles and informal credit tracking with retailers." },
          { scale: "Medium Scale", revenue: "Rs. 2 crore - Rs. 15 crore (annual)", margin: "4% to 8%", profile: "Super stockist or multi-outlet wholesaler with a 1,000-3,000 sq ft warehouse, dedicated sales team, servicing 100+ retail outlets; typical monthly billing around Rs. 1 crore at ~5-6% margin per industry sourcing." },
          { scale: "Large Scale / Enterprise", revenue: "Rs. 15 crore - Rs. 100+ crore (annual)", margin: "3% to 6%", profile: "Regional distribution house or large wholesale/retail chain covering multi-category, multi-brand distribution across a state/region with cold-chain infrastructure and ERP-driven operations (estimate; India's overall FMCG distribution market is sourced at ~Rs. 22 lakh crore)." },
        ],
      },
    },
    outlook: { sentence: "India's food-processing sector has demonstrated sustained expansion, with average annual growth reported at 6.55% over the preceding nine years (slightly above overall manufacturing growth), though the source document cautions that exports are not uniformly rising across every category and sector growth should not be assumed to automatically guarantee export growth in every product category.", source: "Press Information Bureau" },
  },


  construction: {
    label: "Construction",
    defaultSegment: "specialty_contractor",
    segments: {
      general_contractor: {
        label: "General Contractor / EPC",
        currentFlowStages: ["Market & opportunity analysis", "Land acquisition / tender bidding", "Design, engineering & approvals", "Financing & project mobilisation", "Procurement & construction execution", "Testing & commissioning", "Handover & facility management"],
        painPoints: [
          { issue: "Poor estimation and underpriced contracts", tags: [], summary: "Construction contracts are often awarded using incomplete drawings, optimistic productivity assumptions or outdated supplier prices, so a project can generate substantial revenue while still making a loss because the original estimate did not reflect actual execution conditions.", revenueLeaks: ["Underestimated quantities", "Unrealistic labour productivity", "Material-price escalation", "Excessive tender discounts"] },
          { issue: "Delays caused by design, approvals and coordination", tags: [], summary: "Construction depends on timely drawings, decisions, approvals and access, and one delayed design package can affect multiple downstream trades.", revenueLeaks: ["Idle labour", "Equipment standby", "Liquidated damages", "Delayed billing"] },
          { issue: "Material waste, theft and uncontrolled consumption", tags: [], summary: "Construction sites handle large quantities of steel, cement, concrete, cables, fixtures and finishing materials, creating exposure to waste, theft and uncontrolled consumption.", revenueLeaks: ["Steel cutting waste", "Excess concrete", "Theft", "Duplicate purchase"] },
          { issue: "Low labour and equipment productivity", tags: [], summary: "Manual reporting often records attendance but not productive output, and equipment may remain on site even when underused.", revenueLeaks: ["Excess labour cost", "Low daily output", "Idle cranes and machinery", "Repeated mobilisation"] },
          { issue: "Billing delays, disputed variations and weak cash flow", tags: [], summary: "Construction companies commonly pay workers, subcontractors and suppliers before receiving certified client payments, and unbilled work, rejected invoices and long-held retention weaken project cash flow.", revenueLeaks: ["Unbilled completed work", "Retention held for years", "Rejected invoices", "Negative project cash flow"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 50 lakh-Rs. 10 crore", margin: "-10% to 8%", profile: "Small civil contractor, renovation company, fit-out business, specialist trade contractor or construction-technology startup" },
          { scale: "Small Scale", revenue: "Rs. 10 crore-Rs. 100 crore", margin: "2% to 8%", profile: "Local builder, subcontractor, residential contractor, MEP contractor or regional infrastructure contractor" },
          { scale: "Medium Scale", revenue: "Rs. 100 crore-Rs. 1,000 crore", margin: "3% to 10%", profile: "Regional EPC company, commercial contractor, industrial builder, developer or specialist engineering company" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 1,000 crore, often Rs. 10,000 crore+", margin: "3% to 15%", profile: "National EPC contractor, infrastructure developer, listed real-estate company or diversified construction group" },
        ],
      },
      specialty_contractor: {
        label: "Specialty / Trade Subcontractor",
        currentFlowStages: ["Lead / tender enquiry", "Site assessment & quotation", "Material procurement", "Work execution", "Quality handover", "Billing & collections", "Repeat / referral business"],
        painPoints: [
          { issue: "Payment delays from the main contractor or client", tags: [], summary: "Specialty subcontractors are usually paid only after the general contractor or client releases payment, and 'pay-when-paid' clauses, retention money and disputed variations leave a subcontractor's own cash flow squeezed for months even though labour and materials were already paid for upfront.", revenueLeaks: ["Cash tied up in retention for months or years", "Labour and material paid out before certified payment is received", "Forced borrowing at high interest to bridge the gap", "Underbilling to preserve the relationship with the GC"] },
          { issue: "Underpricing quotes due to no formal costing", tags: [], summary: "Quotes are often set using a rough per-point or per-square-foot rate carried over from the last job rather than an itemised bill of quantities, so labour, wastage and site-specific difficulty get missed, and by the time the true cost is known the price is already locked in with the client.", revenueLeaks: ["Jobs quoted below actual cost", "No margin buffer for site-specific difficulty", "Free rework absorbed to protect the relationship", "Repeat clients anchoring on the old low rate"] },
          { issue: "Material wastage and untracked consumption on small jobs", tags: [], summary: "Cement, wiring, pipes, tiles and fittings are bought in small, frequent batches for each site with little formal reconciliation, so cutting waste, over-ordering and shrinkage go untracked and are absorbed as an invisible cost rather than billed or controlled.", revenueLeaks: ["Excess cutting and offcut waste on wiring, piping and tiles", "Small-quantity purchases at higher unit prices", "Unreconciled material shrinkage or pilferage on site", "Leftover stock that cannot be used on the next job"] },
          { issue: "No system to track multiple sites and crew scheduling", tags: [], summary: "A small subcontractor typically runs several jobs at once with the same limited pool of skilled labour, and without a shared schedule or site log, crews get double-booked or left idle on one site while another site stalls waiting for the same electrician, plumber or mason.", revenueLeaks: ["Double-booked or idle skilled crews", "Site delays waiting on labour tied up elsewhere", "Missed daily progress creating billing disputes", "Premium day-rate hiring to cover last-minute gaps"] },
          { issue: "Dependence on word-of-mouth with no lead-generation system", tags: ["website"], summary: "Most specialty subcontractors win their next job only when a past client, contractor or supplier happens to recommend them, with no website or digital presence for builders and homeowners searching for their trade, so idle gaps between jobs are common even when the work itself is good.", revenueLeaks: ["Idle crews between referral-driven jobs", "Missed enquiries from builders and clients searching online", "Underpricing out of desperation to win the next job", "No database or follow-up system for past clients"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 5 lakh - Rs. 50 lakh", margin: "-10% to 8%", profile: "One-person or small-crew operator (electrician, plumber, or finishing contractor) taking small residential/commercial jobs through informal referrals, often without GST registration or written contracts (estimate, directionally reasonable - no single published India source for this micro-segment)" },
          { scale: "Small Scale", revenue: "Rs. 50 lakh - Rs. 5 crore", margin: "3% to 10%", profile: "GST-registered trade contractor with 2-4 field crews working as a subcontractor to multiple builders/GCs at once, still using manual site records and verbal or WhatsApp-based quotes (estimate, directionally reasonable)" },
          { scale: "Medium Scale", revenue: "Rs. 5 crore - Rs. 25 crore", margin: "4% to 10%", profile: "Established specialty subcontractor (MEP, flooring, or civil-finishing) with dedicated site supervisors, a formal quotation/BOQ process, and standing relationships with 5-10 general contractors or developers (estimate, directionally reasonable)" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 25 crore, often Rs. 50-100 crore+", margin: "4% to 12%", profile: "Large trade-contracting firm running parallel crews across many concurrent sites for major builders/EPC companies, with in-house estimation staff and formal procurement systems, though still a subcontractor rather than a lead EPC (estimate, directionally reasonable)" },
        ],
      },
    },
    outlook: { sentence: "India's construction outlook remains favourable, supported by housing, urban development, manufacturing investment and public infrastructure; official FY2025-26 estimates placed combined manufacturing and construction growth at 7% in real terms, while gross fixed capital formation was estimated to rise by 7.8%.", source: "Press Information Bureau" },
  },


  leather_footwear: {
    label: "Leather & Footwear",
    defaultSegment: "wholesale_retail",
    segments: {
      manufacturer: {
        label: "Manufacturer",
        currentFlowStages: ["Hide sourcing & tanning", "Design & pattern development", "Material sourcing & cutting", "Stitching & lasting", "Sole attachment & finishing", "Quality inspection & compliance", "Distribution, export & retail"],
        painPoints: [
          { issue: "Leather quality variability and low cutting yield", tags: [], summary: "Every hide is different - natural scars, holes, brands, thickness variation and shade differences reduce the usable area, driving waste and inconsistent costing.", revenueLeaks: ["Excess leather consumption", "High cutting waste", "Material shortages after production starts", "Lower-grade product realisation"] },
          { issue: "Fit, size and product-consistency failures", tags: [], summary: "Footwear returns often result from inconsistent fit, incorrect grading, last variation or poor size communication.", revenueLeaks: ["High e-commerce return rates", "Replacement and reverse-logistics costs", "Markdown of returned products", "Lost repeat business"] },
          { issue: "Sole bonding, stitching and material-performance defects", tags: [], summary: "Failures such as sole separation, cracked material, broken stitching, colour transfer or hardware damage can lead to buyer rejection and warranty claims.", revenueLeaks: ["Rework and customer returns", "Batch rejection", "Cancelled orders", "Loss of approved-supplier status"] },
          { issue: "Seasonal inventory and fashion obsolescence", tags: [], summary: "Footwear and accessories are style-, colour- and season-sensitive, so unsold inventory quickly loses value.", revenueLeaks: ["End-of-season markdowns", "Dead stock and unpopular size accumulation", "Working capital trapped in inventory", "Retailer returns"] },
          { issue: "Environmental, social and chemical-compliance risk", tags: [], summary: "Tanning uses water and chemicals, and global buyers increasingly audit environmental controls, worker conditions and restricted substances.", revenueLeaks: ["Buyer rejection", "Plant suspension", "Loss of export contracts", "Expensive remediation"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 25 lakh-Rs. 5 crore", margin: "-10% to 8%", profile: "Boutique footwear label, small accessories maker, contract stitching unit, D2C brand or design startup" },
          { scale: "Small Scale", revenue: "Rs. 5 crore-Rs. 50 crore", margin: "3% to 10%", profile: "Regional footwear manufacturer, tannery, component unit, leather-goods exporter or contract manufacturer" },
          { scale: "Medium Scale", revenue: "Rs. 50 crore-Rs. 500 crore", margin: "5% to 14%", profile: "Established exporter, multi-state brand, integrated footwear factory or large tannery" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 500 crore, often Rs. 1,000 crore+", margin: "6% to 18%", profile: "National footwear brand, major export manufacturer, vertically integrated leather group or global contract producer" },
        ],
      },
      wholesale_retail: {
        label: "Wholesale / Retail",
        currentFlowStages: ["sourcing from manufacturers", "inventory by style/size", "display & merchandising", "footfall & customer trial", "sales & billing", "dealer credit & collections", "repeat business & loyalty"],
        painPoints: [
          { issue: "Size/style inventory imbalance & seasonal obsolescence", tags: [], summary: "Footwear demand is fragmented across sizes, styles, and seasons, so stores routinely run out of fast-moving sizes while sitting on unsold ones; healthy inventory turnover for footwear retail is only about 2.5-4x a year, meaning stock sits for 3-5 months before it sells through.", revenueLeaks: ["Markdowns on unsold sizes/styles at season-end", "Capital locked up in slow-moving SKUs for months", "Stockouts on popular sizes lose walk-in sales", "Fashion-season misses become dead stock"] },
          { issue: "Competition from e-commerce and organized retail chains", tags: ["website"], summary: "Large branded chains (Bata, Metro Brands, Liberty) and e-commerce marketplaces are growing faster than independent wholesalers/retailers, pulling footfall and price-sensitive buyers online even though offline still holds roughly 80% of footwear revenue as of 2024.", revenueLeaks: ["Showrooming - customers browse in-store, buy cheaper online", "No online storefront to capture marketplace-driven demand", "Discount wars with organized chains and online sellers", "Loss of younger, digital-first customers to omnichannel brands"] },
          { issue: "Counterfeit and duplicate goods in the market", tags: [], summary: "India's counterfeit trade is estimated at roughly 25-30% of goods sold (about Rs 1.5 lakh crore/$20B annually), with footwear and leather goods among the most-copied categories, growing 10-15% a year and undercutting genuine dealers on price.", revenueLeaks: ["Genuine retailers undercut by cheap duplicate lookalikes", "Brand trust erosion hurting premium/branded sales", "Customer disputes/returns from mistaken counterfeit purchases", "Price pressure forcing margin-eroding discounts to compete"] },
          { issue: "Thin margins from discount-driven, credit-heavy sales", tags: [], summary: "Retail footwear margins typically run 20-35% (wholesale distribution slightly better at ~30-35% given lower overheads), but heavy end-of-season discounting and dealer credit cycles routinely eat into that margin and delay cash realization.", revenueLeaks: ["Deep EOSS/festive discounting compresses realized margin", "Extended dealer/retailer credit delays cash flow", "GST/MRP re-tagging costs on rate changes and unsold stock", "Compensation cess and ITC losses on unsold inventory"] },
          { issue: "Footfall dependency on physical location", tags: ["website", "social"], summary: "Independent wholesalers and retail showrooms rely almost entirely on local foot traffic and rented high-street/market locations, with no digital channel to smooth out seasonal or locational footfall swings.", revenueLeaks: ["High rent in footfall-heavy locations eats into margin", "Revenue swings sharply with local footfall and season", "No digital presence to supplement slow in-store days", "Limited reach beyond the immediate catchment area"] },
        ],
        financialMatrix: [
          { scale: "Startup/Early Stage", revenue: "Rs. 15 lakh - Rs. 50 lakh", margin: "15% to 20%", profile: "Single small-format shop or unbranded local wholesale trader; inventory alone (typically 60-70% of initial investment) ties up most working capital; heavy dependence on local footfall and informal dealer credit (estimated tier, directional)." },
          { scale: "Small Scale", revenue: "Rs. 50 lakh - Rs. 2 crore", margin: "20% to 25%", profile: "GST-registered multi-brand footwear/leather-goods store or district-level wholesale distributor with a modest dealer network; limited digital presence; still exposed to seasonal dead stock and discounting (estimated tier, directional)." },
          { scale: "Medium Scale", revenue: "Rs. 2 crore - Rs. 10 crore", margin: "25% to 30%", profile: "Regional chain of 3-10 stores or a state-level wholesale distributor supplying multiple sub-dealers; some omnichannel/marketplace listing; better negotiating power with manufacturers on stock and credit terms (estimated tier, directional)." },
          { scale: "Large Scale/Enterprise", revenue: "Rs. 10 crore+", margin: "30% to 35%", profile: "Organized retail chain or national-level wholesale distributor with branded manufacturer tie-ups, omnichannel sales, and structured inventory/credit systems (margin range consistent with reported footwear retail/wholesale margins of 20-35%; revenue tier is a directional estimate)." },
        ],
      },
    },
    outlook: { sentence: "Industry projections cited by the government suggest the leather and footwear sector could reach approximately US$50 billion in production by 2030 (US$36 billion in domestic consumption plus US$14 billion in exports), though these figures should be interpreted as an industry growth scenario rather than a certainty.", source: "Press Information Bureau" },
  },


  education_services: {
    label: "Education Services",
    defaultSegment: "small_coaching_tutoring",
    segments: {
      established_institution: {
        label: "Established Institution",
        currentFlowStages: ["Market and learner-demand analysis", "Programme design and regulatory approval", "Lead generation and admissions", "Enrolment and fee collection", "Learning delivery and assessment", "Student support and retention", "Placement and alumni engagement"],
        painPoints: [
          { issue: "Low student conversion and expensive acquisition", tags: ["website"], summary: "Education providers often generate thousands of enquiries but convert only a small portion into paying, enrolled students.", revenueLeaks: ["High advertising spend", "Duplicate leads", "Delayed counselling and poor follow-up", "Seat vacancies"] },
          { issue: "Student dropout, disengagement and fee loss", tags: [], summary: "A learner who leaves early creates lost tuition, weak outcomes and reputational risk for the institution.", revenueLeaks: ["Uncollected future fees", "Empty seats", "Higher acquisition cost per graduate", "Refund expense"] },
          { issue: "Faculty underutilisation and inconsistent teaching quality", tags: [], summary: "Faculty are a major cost and the most important driver of learning quality, so underused or inconsistent teaching directly erodes margins and outcomes.", revenueLeaks: ["Small or poorly planned classes", "Excess part-time faculty cost", "Timetable gaps", "High faculty turnover"] },
          { issue: "Weak learning outcomes and poor employability", tags: [], summary: "High enrolment does not create value when learners fail to develop the required knowledge or workplace capability.", revenueLeaks: ["Weak placement outcomes", "Low employer trust", "Poor re-enrolment", "Declining admissions"] },
          { issue: "Fee leakage, manual administration and compliance failures", tags: [], summary: "Disconnected spreadsheets and manual processes create errors across admissions, attendance, results and finance.", revenueLeaks: ["Missed instalments", "Unauthorised discounts", "Duplicate student records", "Compliance penalties"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 10 lakh - Rs. 5 crore", margin: "-30% to 12%", profile: "Small coaching centre, tutoring business, preschool, edtech startup, vocational centre or online instructor platform" },
          { scale: "Small Scale", revenue: "Rs. 5 crore - Rs. 50 crore", margin: "5% to 20%", profile: "Regional school, coaching chain, skill institute, small college, corporate-training company or established online academy" },
          { scale: "Medium Scale", revenue: "Rs. 50 crore - Rs. 500 crore", margin: "8% to 25%", profile: "Multi-campus institution, university group, national coaching company, edtech platform or vocational network" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 500 crore, often Rs. 2,000 crore+", margin: "10% to 30%", profile: "Large university network, national school chain, major edtech company, examination business or diversified education group" },
        ],
      },
      small_coaching_tutoring: {
        label: "Small / Independent Coaching or Tutoring Center",
        currentFlowStages: ["enquiry via word-of-mouth", "trial class / counselling", "admission & fee collection", "batch/class delivery", "doubt-clearing & assessment", "parent communication", "retention / re-enrollment"],
        painPoints: [
          { issue: "Over-reliance on word-of-mouth with no marketing system", tags: ["website"], summary: "Enrollment depends almost entirely on parent referrals and neighbourhood reputation, with no website, Google presence, or ad spend to generate fresh enquiries when referrals slow down.", revenueLeaks: ["Empty seats during off-season months (post-exam lull) with no funnel to fill them", "Invisible to parents searching \"coaching near me\" or comparing options online", "New branch/subject launches struggle because there's no reusable enquiry channel", "Growth capped by the owner's personal network rather than market demand"] },
          { issue: "Missed follow-up on trial-class enquiries", tags: ["website"], summary: "Walk-in and phone enquiries for trial classes are logged on paper or WhatsApp and often go cold because there's no system to follow up before the parent enrolls elsewhere.", revenueLeaks: ["Trial attendees who don't enroll on the spot are simply forgotten", "No reminder before trial class date leads to no-shows", "Competing centre closes the enquiry first due to faster follow-up", "No tracking of enquiry-to-admission conversion rate to fix the leak"] },
          { issue: "Informal fee collection with no tracking", tags: [], summary: "Fees are collected in cash or ad hoc UPI transfers noted in a register or notebook, so partial payments, due installments, and defaulters are hard to track consistently.", revenueLeaks: ["Missed monthly installments go unnoticed until months later", "No automated due-date reminders, so collection depends on remembering to ask", "Students continue attending classes despite unpaid dues", "Manual reconciliation eats owner's time and still leaves gaps"] },
          { issue: "Student dropout with no early-warning system", tags: [], summary: "Attendance and performance dips that signal a student is about to quit go unnoticed until the parent informs the center they're stopping, by which point re-enrollment is unlikely.", revenueLeaks: ["Lost recurring monthly fee per dropped student with no win-back attempt", "No attendance/performance tracking to flag at-risk students early", "Negative word-of-mouth from an unresolved complaint that could have been caught earlier", "Batch sizes shrink silently, reducing per-batch profitability"] },
          { issue: "Owner/teacher doing everything, no time for growth", tags: [], summary: "The founder is simultaneously the main teacher, admissions counsellor, fee collector, and admin, leaving no bandwidth to plan marketing, add batches, or improve the business.", revenueLeaks: ["Enquiries and follow-ups delayed because the owner is mid-class", "No time to plan seasonal enrollment pushes (new academic year, board exam season)", "Expansion ideas (new subject, new batch, second location) stay unexplored", "Burnout risk that puts the entire business's continuity at risk"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 1.5 lakh - Rs. 8 lakh / year", margin: "20% to 35%", profile: "Home-based or single-room setup, one owner-teacher, 1-2 subjects, under 30 students at Rs. 500-2,500/month per student; minimal rent/overhead keeps margins survivable despite low fees." },
          { scale: "Small Scale", revenue: "Rs. 8 lakh - Rs. 25 lakh / year", margin: "25% to 40%", profile: "Rented premises with 1-2 batches running in parallel, 50-150 students, fees Rs. 1,500-6,000/month; break-even typically needs ~20-25 paying students per batch to cover rent and staff." },
          { scale: "Medium Scale", revenue: "Rs. 25 lakh - Rs. 75 lakh / year", margin: "20% to 35%", profile: "Multiple batches/subjects, 3-5 teaching staff, 150-400 students; crosses the ~Rs. 9 lakh profit threshold that triggers formal tax registration, adding compliance overhead." },
          { scale: "Large Scale / Enterprise (top end of independent)", revenue: "Rs. 75 lakh - Rs. 2 crore / year", margin: "15% to 30%", profile: "Well-known local single-brand institute, 5-15 staff, 400-1,000+ students, possibly one satellite branch; margins compress from higher marketing/staff costs even as it approaches the scale of becoming a small chain (directional estimate, not independently sourced)." },
        ],
      },
    },
    outlook: { sentence: "The three-to-five-year outlook for India's education-services sector is positive, technology-enabled and increasingly focused on learning outcomes, employability and lifelong education, though the source document cautions that enrolment growth alone will not create a sustainable education business without credible curriculum, measurable learning and ethical admissions.", source: "Press Information Bureau" },
  },


  healthcare_services: {
    label: "Healthcare Services",
    defaultSegment: "small_clinic_practice",
    segments: {
      hospital_facility: {
        label: "Hospital / Larger Facility",
        currentFlowStages: ["Patient Acquisition & Referral", "Registration & Appointment Booking", "Consultation & Diagnosis", "Admission, Treatment & Care Delivery", "Billing & Insurance Claims", "Discharge & Follow-up"],
        painPoints: [
          { issue: "Poor patient flow and low capacity utilisation", tags: [], summary: "Beds, consultation rooms, operating theatres and diagnostic equipment are expensive assets, but poor scheduling leaves patients waiting while facilities sit underused at other times.", revenueLeaks: ["Empty beds", "Cancelled surgery", "Unused imaging capacity", "Delayed discharge"] },
          { issue: "Insurance denials and incomplete revenue capture", tags: [], summary: "Hospitals may provide treatment but receive reduced or delayed payment because of documentation, coding, authorisation or package errors.", revenueLeaks: ["Unbilled procedures", "Denied claims", "Delayed settlement", "Bad debt"] },
          { issue: "Medicine, consumable and implant leakage", tags: [], summary: "Healthcare facilities hold high-value, regulated and expiring inventory that is exposed to loss through expiry, theft, diversion and implant mismatches.", revenueLeaks: ["Expired medicines", "Implant mismatch", "Stock theft", "Cold-chain loss"] },
          { issue: "Clinical-quality failures and avoidable adverse events", tags: [], summary: "Medication errors, infections, delayed diagnosis, falls and procedural complications cause both patient harm and financial loss.", revenueLeaks: ["Extended length of stay", "Legal claims and patient compensation", "Regulatory action", "Loss of insurer or corporate contracts"] },
          { issue: "Workforce shortages, burnout and inefficient scheduling", tags: [], summary: "Doctors, nurses and technicians are the core operating capacity of healthcare services, so shortages and poor rostering directly limit what can be delivered.", revenueLeaks: ["Overtime and agency staffing", "Closed beds", "Cancelled procedures", "Employee turnover"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 25 lakh-Rs. 5 crore", margin: "-20% to 10%", profile: "Small clinic, telehealth startup, home-care provider, therapy centre, diagnostic collection centre or healthcare-software service" },
          { scale: "Small Scale", revenue: "Rs. 5 crore-Rs. 50 crore", margin: "3% to 12%", profile: "Nursing home, specialist clinic, local laboratory, imaging centre, pharmacy network or small day-care facility" },
          { scale: "Medium Scale", revenue: "Rs. 50 crore-Rs. 500 crore", margin: "5% to 16%", profile: "Regional hospital, diagnostic chain, multi-city clinic network, home-healthcare company or specialty-care group" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 500 crore, often Rs. 5,000 crore+", margin: "7% to 20%", profile: "National hospital chain, diagnostic network, pharmacy and digital-health group or integrated healthcare provider" },
        ],
      },
      small_clinic_practice: {
        label: "Small Clinic / Independent Practice",
        currentFlowStages: ["patient enquiry/referral", "appointment booking", "consultation", "treatment/prescription", "billing & payment", "follow-up & recall"],
        painPoints: [
          { issue: "Missed appointment reminders and no-shows", tags: [], summary: "Patients forget or deprioritise appointments when there is no automated reminder system, leaving consultation slots empty with little notice.", revenueLeaks: ["Empty consultation/chair slots", "Lost same-day revenue with no time to rebook", "Staff time spent manually chasing patients by phone", "Underutilised doctor and equipment time"] },
          { issue: "No systematic follow-up or recall", tags: [], summary: "Once a visit ends, most small clinics have no structured way to bring patients back for check-ups, reviews, or the remaining sessions of a treatment course, so many patients simply never return.", revenueLeaks: ["Incomplete treatment courses left unbilled", "Lapsed patients who quietly switch to another clinic", "Missed recurring revenue from routine check-ups/cleanings", "No reactivation outreach to a dormant patient base"] },
          { issue: "Phone-only booking and missed calls", tags: [], summary: "With reception staff busy attending to in-clinic patients, incoming calls from prospective patients often go unanswered, and most callers do not try a second time.", revenueLeaks: ["New-patient enquiries lost to unanswered calls", "Booking limited to the clinic's open hours", "No after-hours or weekend booking capture", "Front-desk overload during peak walk-in times"] },
          { issue: "Little to no online presence", tags: ["website"], summary: "Many small clinics rely solely on walk-ins and word-of-mouth, so patients searching online for a nearby doctor cannot find, verify, or compare the practice before choosing where to go.", revenueLeaks: ["Invisible in 'doctor/clinic near me' searches", "No Google Business profile or reviews to build trust", "New patients default to competitors with a visible listing", "No channel to showcase services, doctor credentials or timings"] },
          { issue: "Manual billing and record-keeping errors", tags: [], summary: "Paper registers and handwritten bills are prone to missed charges, calculation mistakes and lost records, especially for insurance or TPA reimbursements.", revenueLeaks: ["Services rendered but never billed", "Insurance/TPA claim errors and delays", "Staff time lost reconciling paper registers", "Disputes from missing or illegible records"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 8 lakh - Rs. 40 lakh", margin: "15% to 30% (directional estimate)", profile: "New solo-practitioner clinic, first-year dental/physio setup, or single-room diagnostic collection centre still building its patient base" },
          { scale: "Small Scale", revenue: "Rs. 40 lakh - Rs. 2 crore", margin: "15% to 35% (directional estimate)", profile: "Established solo or 2-3 doctor clinic, full-service dental/physio practice, or standalone diagnostic collection centre with steady local patient flow" },
          { scale: "Medium Scale", revenue: "Rs. 2 crore - Rs. 8 crore", margin: "12% to 25% (directional estimate)", profile: "Multi-doctor polyclinic, small nursing home with a few in-patient beds, or a diagnostic centre with in-house imaging/lab equipment" },
          { scale: "Large Scale / Enterprise", revenue: "Rs. 8 crore - Rs. 20 crore", margin: "10% to 20% (directional estimate)", profile: "Larger independent nursing home (20-30 beds), multi-specialty independent practice, or a small diagnostic-centre group under single ownership - the upper edge before becoming a branded hospital or chain" },
        ],
      },
    },
    outlook: { sentence: "Major private hospital networks continue investing in capacity - in February 2026, Apollo Hospitals projected mid-to-high-teens revenue growth and planned to expand from roughly 10,000 to 13,000 beds by FY2029-30, with much of the additional capacity focused on complex specialty care.", source: "Reuters" },
  },


  logistics_transportation: {
    label: "Logistics and Transportation",
    defaultSegment: "local_transporter_broker",
    segments: {
      fleet_3pl: {
        label: "Large Fleet / 3PL",
        currentFlowStages: ["Market & Model Selection", "Customer Acquisition & Onboarding", "Booking & Carrier Allocation", "Transport & Hub Operations", "Warehousing & Fulfilment", "Last-Mile Delivery & POD", "Billing & Collections"],
        painPoints: [
          { issue: "Empty running and poor vehicle utilisation", tags: [], summary: "Vehicles frequently return without cargo or operate below their weight and volume capacity, burning fuel and cost without generating revenue.", revenueLeaks: ["Fuel consumed without revenue", "Low revenue per kilometre", "Excess vehicle requirement", "Reduced lane profitability"] },
          { issue: "Fuel leakage, maintenance and breakdown costs", tags: [], summary: "Fuel, tyres and maintenance are major operating costs for fleet owners, with theft, unauthorised refuelling and poor driving behaviour eroding margins.", revenueLeaks: ["Fuel theft and unauthorised refuelling", "Idling and low mileage", "Tyre damage and emergency repair", "Vehicle downtime and substitute vehicle cost"] },
          { issue: "Detention, waiting and delivery delays", tags: [], summary: "Vehicles may wait for hours at plants, warehouses, ports and customer sites, causing lost trips, overtime and working-capital delay.", revenueLeaks: ["Lost trips and driver overtime", "Customer penalties", "Missed connecting movement", "Working-capital delay"] },
          { issue: "Damage, theft and weak shipment traceability", tags: [], summary: "Cargo can be damaged or lost during loading, hub handling, transit, storage or delivery, driving up claims and insurance costs.", revenueLeaks: ["Customer claims and insurance deductibles", "Replacement transport and product write-off", "Investigation cost", "Higher insurance premium"] },
          { issue: "Billing leakage and slow collections", tags: [], summary: "Transport businesses often depend on manual proof of delivery and rate calculations before invoicing, leaving shipments unbilled and payments delayed.", revenueLeaks: ["Unbilled shipments and missing proof of delivery", "Incorrect rate or uncharged detention/toll", "Duplicate carrier payment", "Delayed customer payment / weak cash flow"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 25 lakh-Rs. 5 crore", margin: "-15% to 8%", profile: "Local transporter, delivery startup, freight broker, small warehouse, courier franchise or logistics-tech company" },
          { scale: "Small Scale", revenue: "Rs. 5 crore-Rs. 50 crore", margin: "2% to 8%", profile: "Regional fleet operator, freight forwarder, warehouse operator, courier network or last-mile provider" },
          { scale: "Medium Scale", revenue: "Rs. 50 crore-Rs. 500 crore", margin: "3% to 12%", profile: "Multi-state transporter, 3PL provider, cold-chain operator, contract warehouse network or express-logistics company" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 500 crore, often Rs. 5,000 crore+", margin: "4% to 15%", profile: "National logistics provider, port or terminal operator, major courier company, shipping business, rail-logistics company or integrated 3PL" },
        ],
      },
      local_transporter_broker: {
        label: "Small Local Transporter / Freight Broker",
        currentFlowStages: ["Load/booking enquiry", "Vehicle allocation", "Transport & delivery", "Proof of delivery", "Billing & collections", "Repeat business"],
        painPoints: [
          { issue: "Empty return trips (no backhaul)", tags: [], summary: "Small operators often can only find a load in one direction, so the truck runs back empty, but diesel, driver wages and tolls are still paid on the return leg.", revenueLeaks: ["Diesel and driver cost paid on an unpaid return leg", "Trip priced to cover only the one-way haul", "Truck sits idle for days waiting for a reload", "Return-leg loads accepted at a loss just to avoid running empty"] },
          { issue: "Delayed payment collection from clients", tags: [], summary: "Freight bills from shippers and consignees are commonly settled 60-90 days after delivery, and small operators lack the leverage to enforce faster payment terms.", revenueLeaks: ["Working capital locked up in unpaid freight bills for 60-90 days", "15-20% of earnings lost to booking agents/intermediaries before final payment", "High-interest borrowing to cover fuel and driver wages while waiting to be paid", "Discounts conceded just to speed up collection"] },
          { issue: "Informal phone/WhatsApp booking with no paper trail", tags: [], summary: "Most loads are still booked verbally over a phone call or WhatsApp message, with the rate agreed by voice and no written confirmation, invoice, or booking record kept.", revenueLeaks: ["Disputed freight rates with nothing in writing to fall back on", "Missed or double-booked loads", "No record to reconcile against GST/e-way bill filings", "Unable to prove detention or POD delays to claim extra charges"] },
          { issue: "Vehicle breakdowns and untracked fuel/maintenance costs", tags: [], summary: "A single breakdown can take a truck off the road for one to three days, and without a maintenance routine, small owners pay far more for reactive repairs than they would have for preventive service, while fuel spend usually is not tracked per trip.", revenueLeaks: ["1-3 lost operating days per breakdown incident", "Reactive repair bills that run well above the cost of skipped preventive maintenance", "Untracked fuel pilferage or over-consumption", "Penalty or detention charges from missed delivery windows"] },
          { issue: "Dependency on a handful of regular clients", tags: ["website"], summary: "Without any online presence or way for new shippers to discover them, most small transporters and brokers depend on 2-3 repeat clients or word-of-mouth referrals for nearly all their business.", revenueLeaks: ["Revenue concentrated in 2-3 clients who dictate rates", "No inbound channel for direct shippers to find and book them", "Entire income at risk if one regular client switches transporter", "Growth capped by referral-only client acquisition"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 10 lakh - Rs. 40 lakh", margin: "-5% to 8% (directional estimate)", profile: "Solo truck owner-driver (1 truck) or a phone/WhatsApp-based booking agent with no owned fleet" },
          { scale: "Small Scale", revenue: "Rs. 40 lakh - Rs. 2.5 crore", margin: "5% to 12%", profile: "Small fleet owner with 2-10 trucks, or an established local freight broker aggregating loads for multiple owner-drivers" },
          { scale: "Medium Scale", revenue: "Rs. 2.5 crore - Rs. 8 crore", margin: "6% to 15% (directional estimate)", profile: "Growing fleet of 10-25 trucks or a multi-route booking agency starting to formalise billing and GST/e-way bill compliance" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 8 crore, often Rs. 20 crore+", margin: "8% to 18% (directional estimate)", profile: "Regional transport company with 25+ trucks or branch offices, approaching organised-sector logistics operations (beyond the small local transporter segment)" },
        ],
      },
    },
    outlook: { sentence: "India's logistics outlook remains positive, supported by manufacturing investment, e-commerce, infrastructure, exports, organised retail and multimodal freight development. By July 2026, 142 Gati Shakti Cargo Terminals were operational (with 310 more locations holding in-principle approval), representing approximately 224 million tonnes per annum of freight-handling capacity.", source: "Press Information Bureau" },
  },


  media_communication: {
    label: "Media & Communication",
    defaultSegment: "freelancer_boutique",
    segments: {
      established_agency: {
        label: "Established Agency / Studio",
        currentFlowStages: ["Audience & market research", "Strategy, brief & proposal", "Content development & production", "Editorial & legal review", "Post-production & localisation", "Distribution & monetisation", "Measurement & retention"],
        painPoints: [
          { issue: "Uncontrolled production cost and repeated revisions", tags: [], summary: "Creative work is iterative, and unclear approvals can cause endless changes that drive up production cost.", revenueLeaks: ["Additional shooting and repeated editing", "Overtime and talent-extension fees", "Late-delivery penalties", "Missed release windows"] },
          { issue: "Platform dependence and weak audience ownership", tags: ["website", "social"], summary: "Publishers, creators and entertainment companies may depend heavily on social networks, OTT platforms, marketplaces or search engines, leaving them exposed when those platforms change.", revenueLeaks: ["Algorithm changes and reduced organic reach", "High platform commission", "Loss of customer data", "Sudden account restriction"] },
          { issue: "Advertising and media-buying leakage", tags: ["social"], summary: "Advertising campaigns involve agencies, publishers, platforms, creators, production houses and technology vendors, creating multiple points where value can leak.", revenueLeaks: ["Invalid traffic and unviewable impressions", "Duplicate invoices and undeclared commission", "Media underdelivery", "Weak attribution"] },
          { issue: "Copyright infringement and piracy", tags: [], summary: "Media companies invest in content that can be copied and distributed at very low cost, exposing revenue to piracy and unauthorised use.", revenueLeaks: ["Lost subscriptions", "Reduced box-office revenue", "Unauthorised streaming and music misuse", "Stolen creator content"] },
          { issue: "Weak content monetisation and unclear profitability", tags: [], summary: "High reach does not always produce revenue - a content asset may appear successful while remaining commercially unviable.", revenueLeaks: ["Expensive content with low completion", "Low advertising yield", "Weak subscription conversion", "Underpriced licensing"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 10 lakh-Rs. 5 crore", margin: "-40% to 12%", profile: "Creator studio, podcast, small digital publisher, boutique agency, production startup, event company or gaming studio" },
          { scale: "Small Scale", revenue: "Rs. 5 crore-Rs. 50 crore", margin: "3% to 18%", profile: "Regional publisher, advertising agency, production house, PR firm, influencer agency, local broadcaster or animation studio" },
          { scale: "Medium Scale", revenue: "Rs. 50 crore-Rs. 500 crore", margin: "5% to 22%", profile: "Multi-city agency, digital network, regional broadcaster, studio, OTT service, event company or VFX business" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 500 crore, often Rs. 5,000 crore+", margin: "7% to 30%", profile: "National broadcaster, major platform, film studio, advertising network, music company, gaming platform or diversified media group" },
        ],
      },
      freelancer_boutique: {
        label: "Freelancer / Boutique Studio",
        currentFlowStages: ["client enquiry/referral", "brief & informal quote", "production/content creation", "revisions & approval", "delivery & handoff", "invoicing & collections", "repeat/referral business"],
        painPoints: [
          { issue: "Scope creep and unpaid revisions", tags: [], summary: "Without a written scope-of-work or capped revision count, clients keep requesting changes beyond the original brief and the creator absorbs the extra hours for free.", revenueLeaks: ["Unbilled hours on 'just one more round' revisions", "No revision cap in quotes/contracts", "Effective hourly rate quietly drops project to project", "Scope creep normalized as 'part of the service'"] },
          { issue: "Feast-or-famine project pipeline", tags: ["website"], summary: "Work comes in bursts through word-of-mouth with no ongoing lead-generation system, so slow months mean zero new client conversations and income gaps.", revenueLeaks: ["No pipeline visibility - can't predict next month's income", "Idle production capacity during slow stretches", "No portfolio site/CRM capturing inbound interest for later follow-up", "Rushed underpriced work taken just to fill gaps"] },
          { issue: "Over-reliance on one or two discovery channels", tags: ["social", "website"], summary: "New business depends almost entirely on Instagram DMs or referrals from past clients, with no owned website, SEO presence, or diversified discovery channel to fall back on.", revenueLeaks: ["Algorithm changes or account issues can cut off lead flow overnight", "No searchable portfolio/website for prospects researching before contact", "Missed inbound leads from Google/local search", "Zero leads captured when referral sources go quiet"] },
          { issue: "Informal quoting and underpricing", tags: [], summary: "Rates are set ad hoc per client conversation instead of a standard rate card, leading to inconsistent, often below-market pricing and difficulty justifying increases.", revenueLeaks: ["Undercharging vs. market day/project rates", "No standard rate card - pricing negotiated down each time", "Retainer/package pricing left on the table vs. one-off billing", "Hard to raise prices with existing clients once anchored low"] },
          { issue: "Late payments with no collections process", tags: [], summary: "Invoices go out informally with no follow-up cadence or partial-advance policy, so payments routinely slip and chasing small dues eats into billable time.", revenueLeaks: ["Cash flow gaps from delayed/partial payments", "Time spent chasing dues instead of billable work", "No advance/deposit policy to protect against non-payment", "Small unpaid invoices written off as not worth pursuing"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 1.5 lakh - Rs. 6 lakh per year", margin: "40% to 60%", profile: "Solo freelancer/creator building a portfolio, mostly part-time or side-gig, pricing below market to win first clients (directional estimate)" },
          { scale: "Small Scale", revenue: "Rs. 6 lakh - Rs. 25 lakh per year", margin: "35% to 50%", profile: "Established solo freelancer or 2-person duo with a steady referral base, still under the Rs. 20 lakh GST services threshold in most states (directional estimate)" },
          { scale: "Medium Scale", revenue: "Rs. 25 lakh - Rs. 75 lakh per year", margin: "25% to 40%", profile: "3-5 person boutique studio/small production house, GST-registered, mix of retainers and project work, may use GST composition scheme (directional estimate)" },
          { scale: "Large Scale / Enterprise", revenue: "Rs. 75 lakh - Rs. 2 crore per year", margin: "20% to 35%", profile: "Top-end boutique studio with a small core team plus freelance bench, multiple concurrent retainers, approaching the point of needing to formalize as a full agency (directional estimate)" },
        ],
      },
    },
    outlook: { sentence: "India's media and entertainment sector is projected to expand from approximately Rs. 2.78 trillion in 2025 to around Rs. 3.3 trillion by 2028, implying roughly 7% annual growth, with digital media, advertising, live entertainment, film and animation/VFX expected to provide much of that growth.", source: "India Brand Equity Foundation" },
  },


  paper_packaging: {
    label: "Paper & Packaging",
    defaultSegment: "distributor_converter",
    segments: {
      manufacturer: {
        label: "Manufacturer",
        currentFlowStages: ["Demand Analysis & Customer Acquisition", "Packaging Design & Artwork Approval", "Sample Testing & Quotation", "Raw Material Procurement & Planning", "Paper Manufacturing & Converting", "Quality Control & Final Inspection", "Dispatch, Billing & Account Retention"],
        painPoints: [
          { issue: "Raw-material price volatility and fibre shortages", tags: [], summary: "Paper, recovered fibre, imported pulp, starch, chemicals and energy represent a large proportion of production cost, so price volatility and fibre shortages can quickly erode margins, especially on fixed-price orders.", revenueLeaks: ["Fixed-price orders accepted before paper-price increases", "Emergency purchasing", "High-cost imported pulp", "Excess safety stock"] },
          { issue: "Excess trim, setup waste and poor material yield", tags: [], summary: "Paper and board are frequently lost during slitting, cutting, printing setup, colour adjustment and die cutting, reducing material yield.", revenueLeaks: ["Excess paper consumption", "Unusable offcuts", "Printing setup loss", "Scrap sold below original material cost"] },
          { issue: "Printing, colour and artwork errors", tags: [], summary: "A structurally correct carton may still be rejected because of incorrect artwork, colour, barcode, legal text or print registration.", revenueLeaks: ["Complete batch rejection", "Reprinting", "Airfreight or emergency delivery", "Brand damage"] },
          { issue: "Demand volatility and finished-goods inventory", tags: [], summary: "Many customers request packaging based on forecasts, but actual consumption can change quickly, leaving suppliers holding customer-specific dead stock with cash tied up in finished packaging.", revenueLeaks: ["Customer-specific dead stock", "Obsolete cartons after product redesign", "Unrecovered customer-held inventory", "Cash tied up in finished packaging"] },
          { issue: "High energy, water and maintenance costs", tags: [], summary: "Paper mills are energy- and water-intensive, while corrugators, dryers, boilers, compressors and printing presses require reliable operation, making downtime and inefficiency costly.", revenueLeaks: ["Excess steam and fuel use", "Unplanned machine breakdown", "Boiler inefficiency", "Emergency maintenance"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 25 lakh-Rs. 5 crore", margin: "-8% to 8%", profile: "Packaging-design studio, paper-bag business, small box converter, label printer or molded-fibre startup" },
          { scale: "Small Scale", revenue: "Rs. 5 crore-Rs. 50 crore", margin: "2% to 9%", profile: "Corrugated-box unit, carton printer, paper distributor, tissue converter or regional packaging manufacturer" },
          { scale: "Medium Scale", revenue: "Rs. 50 crore-Rs. 500 crore", margin: "4% to 12%", profile: "Integrated corrugated company, folding-carton manufacturer, recycled-paper mill or specialty packager" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 500 crore, frequently Rs. 1,000 crore+", margin: "4% to 15%", profile: "Integrated pulp and paper group, national packaging company or large paperboard manufacturer" },
        ],
      },
      distributor_converter: {
        label: "Distributor / Small Converter-Trader",
        currentFlowStages: ["Sourcing from mills/agents", "Godown inventory storage", "Customer enquiry & order", "Light conversion or resale", "Billing & dispatch", "Credit collections", "Repeat order retention"],
        painPoints: [
          { issue: "Paper-price volatility eroding stock margins", tags: [], summary: "Distributors buy paper/board in bulk ahead of demand, so when mill list prices fall or a competitor undercuts before that inventory is sold, the built-in margin can be wiped out or turned negative on stock still sitting in the godown.", revenueLeaks: ["Inventory bought high, sold at a lower prevailing price", "Margin erased on committed but undelivered orders", "Forced distress sales to release cash before further price drops", "Interest cost on funds locked in price-sensitive stock"] },
          { issue: "Credit sales and slow collections from small customers", tags: [], summary: "Local printers, box-makers and shopkeepers typically buy on 15-90 day credit, and with limited formal credit checks, delayed payments or defaults from small, often unregistered customers tie up the distributor's working capital.", revenueLeaks: ["Cash locked in outstanding receivables", "Bad debts written off from small/unregistered buyers", "Interest cost on borrowed working capital to cover the gap", "Owner time spent chasing payments instead of selling"] },
          { issue: "Storage space constraints and humidity/pest damage", tags: [], summary: "Paper reels, reams and board are highly sensitive to moisture, humidity and pests, and cramped or poorly ventilated godowns lead to spoiled, discoloured or downgraded stock that must be sold at a loss or written off.", revenueLeaks: ["Moisture-damaged reels/reams written off or scrapped", "Downgraded stock sold below original purchase cost", "Warehouse rent paid on slow-moving or dead stock", "Repackaging and handling cost for damaged material"] },
          { issue: "Thin, commoditised margins on standard paper grades", tags: [], summary: "Kraft, writing-printing and other standard-grade paper is largely undifferentiated, so customers shop purely on price across multiple dealers, keeping trading margins in the low single digits and vulnerable to any cost increase.", revenueLeaks: ["Price undercutting by rival local traders", "Customers switching suppliers for marginal price differences", "Little room to pass on freight/handling cost increases", "Volume discounts compressing already-thin margins"] },
          { issue: "Competition from direct mill sales, with weak visibility to win new customers", tags: ["website"], summary: "As converters and printers grow, mills increasingly sell to them directly and bypass the distributor, while smaller distributors have little to no online presence (no website, no Google/IndiaMART listing) to attract new customers and offset that lost volume.", revenueLeaks: ["Established customers migrating to direct mill supply once they scale", "Lost volume as mills open regional depots/dealer networks", "New enquiries going to competitors visible on Google/IndiaMART", "Reliance on word-of-mouth capping customer-acquisition growth"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 15 lakh - Rs. 2 crore", margin: "1% to 6% (directional estimate)", profile: "Single proprietor or small firm trading paper/board out of one godown, serving local printers and small converters, mostly cash-and-carry" },
          { scale: "Small Scale", revenue: "Rs. 2 crore - Rs. 15 crore", margin: "2% to 7% (directional estimate)", profile: "Established local distributor with mill/agency tie-ups, own godown, and a base of repeat converter/trader customers on 30-60 day credit" },
          { scale: "Medium Scale", revenue: "Rs. 15 crore - Rs. 75 crore", margin: "3% to 8% (directional estimate)", profile: "Multi-grade stockist with regional reach, multiple godowns, light conversion (slitting/rewinding) capability, and formal credit lines with mills" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 75 crore", margin: "3% to 9% (directional estimate)", profile: "Large regional/multi-state paper stockist-distributor, often an authorised dealer for major mills, with bulk import trading and a wide converter/retailer network" },
        ],
      },
    },
    outlook: { sentence: "India's total packaging industry was worth approximately US$84 billion in 2024 and is projected to reach around US$143 billion by 2029, though a separate 2026 estimate cited by IBEF projects the broader packaging industry at approximately US$92 billion by FY2030 growing at around 9% annually - different market studies use different definitions and therefore produce different forecasts.", source: "IBEF" },
  },


  // Source document is genuinely truncated - confirmed by direct XML inspection, it ends
  // mid-sentence with no Financial Matrix or Outlook section, and only 4 of 5 pain points
  // (the 4th has no revenue leaks). Left short rather than fabricated - ask for a complete
  // version of this doc before treating this entry as report-ready.
  electronics_electricals: {
    label: "Electronics & Electricals Manufacturing (India)",
    currentFlowStages: ["Market Research & Product Design", "Prototype, Compliance & Cost Engineering", "Supplier Sourcing & Procurement", "PCB Manufacturing & SMT/Box-Build Assembly", "Functional Testing, Burn-In & Quality Inspection", "Packaging, Warehousing & Distribution", "Installation, Warranty, Support & Retention"],
    painPoints: [
      { issue: "Semiconductor & Electronic Component Supply Chain Disruptions", tags: [], summary: "Electronics manufacturing depends on thousands of individual components sourced globally, and a single missing semiconductor can stop production of an entire product line; pandemics, geopolitical conflicts and logistics disruptions have shown how fragile these supply chains are.", revenueLeaks: ["Production line stoppages", "Emergency component purchases", "Air freight premiums", "Missed customer delivery dates"] },
      { issue: "High Warranty Claims & Product Failures", tags: [], summary: "Electronics products run continuously in varying environmental conditions, and failures from poor solder joints, PCB defects, component failures, software bugs, battery degradation and other causes make warranty expense one of the largest hidden costs.", revenueLeaks: ["Product replacement", "Service engineer visits", "Spare parts consumption", "Negative online reviews"] },
      { issue: "Inventory Obsolescence", tags: [], summary: "Electronics has one of the shortest product life cycles of any manufacturing industry, so components become obsolete quickly, leaving manufacturers with excess and dead stock; large companies may lose millions to inventory write-offs.", revenueLeaks: ["Inventory write-offs", "Capital blocked in warehouse", "Overstocking", "Lost cash flow"] },
      { issue: "Low Manufacturing Visibility", tags: [], summary: "Without real-time production monitoring, manufacturers struggle to answer which SMT line is underperforming, why production stopped, where defects are increasing, which machine needs maintenance, and what today's OEE is.", revenueLeaks: [] },
    ],
    financialMatrix: [],
    outlook: null,
  },

  financial_services: {
    label: "Financial Services",
    defaultSegment: "small_broker_agent",
    segments: {
      institution: {
        label: "Bank / NBFC / Institution",
        currentFlowStages: ["Market & Customer-Segment Analysis", "Product Design & Approval", "Customer Acquisition & Lead Generation", "KYC, AML & Credit Underwriting", "Approval, Disbursement & Policy Issuance", "Transaction Processing & Servicing", "Collections, Claims & Retention"],
        painPoints: [
          { issue: "Credit losses and weak underwriting", tags: [], summary: "Rapid lending growth can create future losses when customer capacity, cash flow, or fraud risk is not assessed correctly.", revenueLeaks: ["Loan defaults", "Provisioning and recovery expense", "Collateral-value shortfall", "Reduced lending capacity"] },
          { issue: "Fraud, cybercrime and account takeover", tags: [], summary: "Financial institutions are frequent targets of fraud and cybercrime because they hold money, identity records and transaction access.", revenueLeaks: ["Unauthorised transactions and compensation", "Investigation expense and operational disruption", "Customer churn", "Reputational damage"] },
          { issue: "Compliance cost and regulatory failure", tags: [], summary: "The industry must maintain KYC, AML, capital, solvency, conduct, privacy, reporting and cybersecurity controls, and failing to do so creates costly consequences.", revenueLeaks: ["Penalties and business restrictions", "Remediation programmes", "Manual review cost", "Delayed product launches"] },
          { issue: "High customer-acquisition cost and low retention", tags: ["website"], summary: "Financial products are easy to compare, which leads customers to switch lenders, insurers, brokers or apps, driving low activation and lapses after onboarding.", revenueLeaks: ["Advertising and agent cost", "Dormant accounts and policy lapses", "Repeated discounting", "High churn and low cross-sell"] },
          { issue: "Manual operations, reconciliation and service delays", tags: [], summary: "Legacy systems and disconnected teams create duplicate entry, slow approvals, failed transactions and poor customer service.", revenueLeaks: ["High operations headcount", "Delayed loan disbursement, slow claim settlement", "Unreconciled transactions", "Interest and fee errors"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 50 lakh-Rs. 10 crore", margin: "-40% to 10%", profile: "Fintech startup, lending platform, advisory firm, insurance-tech company, small broker or payment startup" },
          { scale: "Small Scale", revenue: "Rs. 10 crore-Rs. 100 crore", margin: "5% to 20%", profile: "Regional NBFC, insurance intermediary, wealth adviser, payment processor, micro-lender or brokerage" },
          { scale: "Medium Scale", revenue: "Rs. 100 crore-Rs. 1,000 crore", margin: "8% to 25%", profile: "Established NBFC, fintech lender, regional financial institution, asset manager, broker or insurer" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 1,000 crore, often Rs. 10,000 crore+", margin: "10% to 30%", profile: "Large bank, national insurer, major NBFC, mutual fund, exchange-linked firm or diversified financial group" },
        ],
      },
      small_broker_agent: {
        label: "Small Broker / Independent Agent",
        currentFlowStages: ["Referral & network lead generation", "Client needs consultation", "Product comparison & recommendation", "Application & documentation support", "Underwriting/approval follow-up", "Policy/loan issuance", "Servicing & renewal follow-up"],
        painPoints: [
          { issue: "Renewal & lapse tracking failures", tags: [], summary: "Agents juggle renewal dates across multiple insurers/lenders/AMCs manually, so policies and loans quietly lapse before anyone follows up.", revenueLeaks: ["Lost renewal commission when policies lapse unnoticed (13th-month persistency for private insurers runs ~65-70%, i.e. 30-35% of new policies lapse within a year)", "Clients defect to agents who send timely renewal reminders", "Reinstatement paperwork eats billable prospecting time", "No single view of 13th/25th/61st-month persistency across carriers"] },
          { issue: "Over-reliance on personal network for leads", tags: ["website", "social"], summary: "Most small agents source clients almost entirely through word-of-mouth and personal referrals, with no systematic or digital lead-generation channel.", revenueLeaks: ["Income plateaus once the immediate personal/family network is exhausted", "No inbound pipeline during slow referral months", "Missed cross-sell/upsell reach into existing clients' own networks", "Loses share to competitors running visible digital marketing"] },
          { issue: "Commission delays & payout disputes", tags: [], summary: "Payouts from insurers, banks/NBFCs and AMCs are often opaque and slow, creating cash-flow strain and unresolved discrepancies for the agent.", revenueLeaks: ["Cash-flow gaps from payout cycles commonly stretching 30-90 days", "Clawbacks on cancelled or early-foreclosed policies/loans", "Time lost reconciling payouts across multiple principals with no unified tracking", "Underpayments/errors go undetected without a reconciliation system"] },
          { issue: "No professional online presence or credibility signal", tags: ["website", "social"], summary: "Without a website, listings, or active social presence, prospects can't verify the agent before committing, especially for larger-ticket products.", revenueLeaks: ["Prospects who search online before buying find nothing and go elsewhere", "Price-sensitive clients bypass the agent for bank/direct-online channels", "Referred leads hesitate without visible credentials, reviews or license proof", "Loses deals to competing agents/POSPs with active social proof"] },
          { issue: "Manual, error-prone documentation & compliance tracking", tags: [], summary: "KYC, proposal forms, and regulatory renewal deadlines (license/CPD) are tracked on paper or spreadsheets across many clients and products, inviting costly mistakes.", revenueLeaks: ["KYC/proposal errors cause application delays or outright rejection", "Missed license renewal or continuing-education deadlines risk deregistration", "Spreadsheet-based multi-client, multi-product tracking causes missed touchpoints", "Time spent redoing paperwork instead of prospecting for new business"] },
        ],
        financialMatrix: [
          { scale: "Startup/Early Stage", revenue: "Rs. 1.5 lakh - Rs. 4 lakh/year", margin: "75% to 90%", profile: "Solo agent/DSA in first 1-3 years, works from home on personal network, single product line (e.g. one insurer or bank tie-up), minimal overhead beyond phone and travel." },
          { scale: "Small Scale", revenue: "Rs. 6 lakh - Rs. 12 lakh/year", margin: "65% to 80%", profile: "Established solo practitioner with 3-6 years' experience, multiple insurer/lender/AMC empanelments, growing renewal book, occasional part-time helper for paperwork." },
          { scale: "Medium Scale", revenue: "Rs. 15 lakh - Rs. 35 lakh/year", margin: "55% to 70%", profile: "Small office setup with 1-3 sub-agents/telecallers, multi-product POSP/DSA/MFD licensing, sizeable trail/renewal book, modest local marketing spend." },
          { scale: "Large Scale/Enterprise", revenue: "Rs. 50 lakh - Rs. 1.5 crore+/year", margin: "45% to 60%", profile: "Full-time top-performer or small agency (MDRT-level insurance agent or high-volume DSA/MFD) with a team of sub-agents, dedicated office, compliance support, and diversified product mix; margin compresses from staff, office and marketing overhead." },
        ],
      },
    },
    outlook: { sentence: "Public-sector banks reported combined net profit of approximately Rs. 1.98 lakh crore in FY2025-26, with gross NPA ratio declining to 1.93% and net NPA ratio to 0.39% as of March 31, 2026, indicating stronger balance sheets - although individual banks and loan segments can still carry materially different risks.", source: "Press Information Bureau" },
  },


  hospitality_tourism: {
    label: "Hospitality & Tourism",
    defaultSegment: "small_travel_agency",
    segments: {
      hotel_property: {
        label: "Hotel / Larger Property",
        currentFlowStages: ["Market & destination analysis", "Business model selection", "Property setup & licensing", "Booking & distribution", "Guest stay & service delivery", "Billing & reconciliation", "Reputation & repeat booking"],
        painPoints: [
          { issue: "Seasonality and low asset utilisation", tags: [], summary: "Hotels, resorts, restaurants, vehicles and event spaces carry high fixed costs that continue even when customer demand falls in the off-season, straining cash flow and debt service.", revenueLeaks: ["Empty rooms and unused banquet halls", "Idle vehicles and low table occupancy", "Fixed payroll and high utilities", "Excessive discounting and weak off-season cash flow"] },
          { issue: "Online travel commissions and weak direct booking", tags: ["website"], summary: "Online travel platforms generate demand but charge substantial commissions and retain much of the customer relationship, limiting growth of lower-cost direct bookings.", revenueLeaks: ["High commission and promotion participation costs", "Payment deductions and rate parity pressure", "Limited customer data ownership", "Repeat customers rebooking through paid channels"] },
          { issue: "Food waste, portion inconsistency and inventory leakage", tags: [], summary: "Restaurants and hotels manage perishable inventory against variable demand, creating multiple points of unrecorded food and stock loss.", revenueLeaks: ["Spoilage and overproduction", "Oversized portions and unrecorded wastage", "Employee consumption and pilferage", "Poor recipe compliance and incorrect purchasing"] },
          { issue: "Inconsistent service and workforce turnover", tags: [], summary: "Guest experience depends heavily on employee behaviour and response speed, and high staff turnover drives repeated training costs and service failures.", revenueLeaks: ["Negative reviews and complimentary recovery costs", "Refunds plus repeat training and recruitment cost", "Lost loyalty and group account loss", "Lower room rates from operational errors"] },
          { issue: "Revenue leakage from pricing, billing and supplier reconciliation", tags: [], summary: "Hospitality transactions span rooms, meals, deposits, commissions, event changes and travel suppliers, creating numerous points where charges go unposted or uncollected.", revenueLeaks: ["Unposted room charges and unauthorised discounts", "Unbilled event items and incorrect room rates", "Duplicate supplier invoices and missed cancellation fees", "Uncollected deposits and lost corporate receivables"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 20 lakh-Rs. 5 crore", margin: "-20% to 10%", profile: "Small cafe, homestay, travel agency, hostel, cloud kitchen, guide business or tour startup" },
          { scale: "Small Scale", revenue: "Rs. 5 crore-Rs. 50 crore", margin: "3% to 12%", profile: "Boutique hotel, regional tour operator, restaurant group, small resort, event company or destination-management firm" },
          { scale: "Medium Scale", revenue: "Rs. 50 crore-Rs. 500 crore", margin: "5% to 18%", profile: "Multi-property hotel company, restaurant chain, national travel agency, MICE operator or online travel business" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 500 crore, often Rs. 5,000 crore+", margin: "7% to 22%", profile: "National hotel chain, major online travel platform, integrated tourism group, airport hospitality company or large food-service operator" },
        ],
      },
      small_travel_agency: {
        label: "Small Travel Agency / Tour Operator",
        currentFlowStages: ["Enquiry via referral or WhatsApp", "Itinerary planning & quotation", "Booking & advance payment", "Vendor & supplier coordination", "Trip execution & on-trip support", "Final billing & settlement", "Repeat & referral business"],
        painPoints: [
          { issue: "OTA platform dependency and commission/price erosion", tags: ["website"], summary: "Most bookings arrive through or get compared against large online travel platforms that charge steep commissions and often undercut on price, leaving small agencies fighting for margin on demand they don't own.", revenueLeaks: ["10-25% of hotel booking value and 5-8% of flight value lost to OTA commissions when acting as a reseller/affiliate", "Customers price-comparing and defecting to aggregator discounts after using the agency for research", "No ownership of the customer relationship or repeat-booking data", "Rate-parity pressure limiting the agency's own direct-booking discounts"] },
          { issue: "Seasonal demand swings and idle off-season capacity", tags: [], summary: "Demand is highly seasonal, but staff, vehicles, guides and often a physical office keep drawing fixed costs even in the off-season, straining cash flow between peak periods.", revenueLeaks: ["Idle vehicles, guides and booked-out vendor slots going unused off-season", "Fixed rent, salaries and utilities continuing regardless of bookings", "Deep off-season discounting that erodes annual average margin", "Cash-flow gaps between seasons with no off-season revenue stream"] },
          { issue: "No systematic follow-up, so repeat and referral business is lost", tags: ["social"], summary: "Past travellers are a small agency's cheapest source of new business, but without any structured post-trip contact or CRM, most agencies simply move on to the next enquiry and let that relationship go cold.", revenueLeaks: ["Past customers rebooking their next trip through an OTA instead of the original agent", "No re-engagement around anniversaries, festivals or renewed travel intent", "Word-of-mouth referrals not captured or incentivised", "Full customer history and preferences lost when a staff member leaves"] },
          { issue: "Untracked WhatsApp and phone enquiries", tags: ["social"], summary: "Enquiries mostly arrive as WhatsApp messages and phone calls handled ad hoc by whoever is free, with no shared log, so quotes go unsent and messages get missed during busy periods or after hours.", revenueLeaks: ["Enquiries left unanswered or answered too late to convert", "No record of who followed up, so leads fall through the cracks between staff", "Quotes sent once and never followed up, losing undecided buyers", "No visibility into which enquiry sources actually convert"] },
          { issue: "Vendor and supplier payment/coordination gaps", tags: [], summary: "A trip depends on a chain of third-party hotels, drivers, guides and local operators booked informally, often on credit or advance payment, and a breakdown anywhere in that chain becomes the agency's problem and cost to absorb.", revenueLeaks: ["Double bookings or vendor no-shows requiring costly last-minute fixes", "Advance payments to unreliable vendors with no formal recovery process", "Manual reconciliation errors leading to overpayment or disputed vendor bills", "Guest refunds and reputation cost when a vendor fails to deliver"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 5 lakh - Rs. 40 lakh", margin: "-10% to 10%", profile: "Solo travel consultant, part-time agent, or single homestay/guesthouse owner booking mainly via WhatsApp and personal referrals; many such operators break even or run at a loss in the first year or two" },
          { scale: "Small Scale", revenue: "Rs. 40 lakh - Rs. 3 crore", margin: "5% to 15%", profile: "Registered local travel agency or tour operator with 2-8 staff and a small office, GST-registered (mandatory once turnover crosses Rs. 20 lakh), selling domestic packages, ticketing and local tours" },
          { scale: "Medium Scale", revenue: "Rs. 3 crore - Rs. 15 crore", margin: "8% to 18% (directional estimate)", profile: "Established regional tour operator or destination-management company with a dedicated sales team, some corporate/MICE accounts and a formal vendor network across multiple destinations" },
          { scale: "Large Scale / Enterprise", revenue: "Rs. 15 crore - Rs. 50 crore+", margin: "10% to 20% (directional estimate)", profile: "Multi-branch regional agency or tour-operator group with owned transport/property assets, approaching the scale of a franchise or national brand while still independently run" },
        ],
      },
    },
    outlook: { sentence: "Industry estimates project Indian hotel-sector revenue growth of approximately 9-12% in FY2025-26, with premium hotel demand expected to grow faster than room supply supporting pricing and occupancy, although actual outcomes vary by city and property.", source: "India Brand Equity Foundation (IBEF)" },
  },


  it_technology_services: {
    label: "IT & Technology Services",
    defaultSegment: "freelancer_small_agency",
    segments: {
      established_company: {
        label: "Established Company",
        currentFlowStages: ["Market & ICP definition", "Lead generation & qualification", "Discovery & solution design", "Proposal, contracting & onboarding", "Development, testing & deployment", "Support & service operations", "Renewal & account growth"],
        painPoints: [
          { issue: "Scope creep and unbilled work", tags: [], summary: "Customers frequently request changes after a project begins, and delivery teams may complete extra work without formal approval to protect the relationship, eroding margins.", revenueLeaks: ["Additional development without payment", "Repeated design revisions", "Project margin erosion", "Disputed invoices"] },
          { issue: "Low employee utilisation and poor resource planning", tags: [], summary: "People are the largest cost in most technology-service businesses, and revenue declines quickly when skilled employees remain unassigned or are allocated inefficiently.", revenueLeaks: ["Excess bench cost", "Senior employees performing junior work", "Contractor expense despite available employees", "Missed project opportunities"] },
          { issue: "Underpriced projects and inaccurate estimation", tags: [], summary: "Software projects contain uncertainty, and companies may quote aggressively to win work but fail to account for integration, testing, data quality or technical complexity.", revenueLeaks: ["Loss-making fixed-price projects", "Excessive delivery effort", "Unpaid rework", "Delayed billing"] },
          { issue: "Customer churn and low SaaS adoption", tags: [], summary: "SaaS companies may successfully sell subscriptions but fail to create sustained usage, leading to cancellations and poor lifetime value.", revenueLeaks: ["Subscription cancellation", "Low licence expansion", "High customer acquisition cost", "Poor lifetime value"] },
          { issue: "Cybersecurity, privacy and service-availability failures", tags: [], summary: "Technology companies manage customer systems, source code, credentials and sensitive data, so a single security incident can affect several customers simultaneously.", revenueLeaks: ["Service downtime", "Customer compensation", "Forensic and recovery cost", "Lost contracts"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 25 lakh-Rs. 5 crore", margin: "-30% to 12%", profile: "SaaS startup, small software agency, AI consultancy, cybersecurity boutique or early managed-service provider" },
          { scale: "Small Scale", revenue: "Rs. 5 crore-Rs. 50 crore", margin: "5% to 18%", profile: "Custom-development company, regional IT provider, niche SaaS business, cloud partner or staffing firm" },
          { scale: "Medium Scale", revenue: "Rs. 50 crore-Rs. 500 crore", margin: "8% to 22%", profile: "Established SaaS company, export services firm, managed-service provider, cybersecurity business or data consultancy" },
          { scale: "Large Scale / Enterprise", revenue: "Above Rs. 500 crore, often Rs. 5,000 crore+", margin: "10% to 28%", profile: "Large IT services company, global SaaS platform, cloud integrator, product company or diversified technology group" },
        ],
      },
      freelancer_small_agency: {
        label: "Freelancer / Small Agency",
        currentFlowStages: ["Referral / lead generation", "Discovery call & scoping", "Proposal & quote sent", "Development & delivery", "Client review & revisions", "Invoice & payment follow-up", "Repeat & referral business"],
        painPoints: [
          { issue: "Feast-or-famine pipeline reliant on referrals", tags: ["website"], summary: "Most solo developers and small dev shops have no structured lead-generation system - work comes almost entirely from referrals and word-of-mouth, so income swings between fully booked and no leads at all. Because delivery work eats all available hours, there's rarely time left to build a pipeline for what comes next.", revenueLeaks: ["Idle, unbilled weeks between projects", "No visible pipeline for the next 1-2 months of work", "Underpricing just to fill a slow patch", "No time carved out for marketing or outreach"] },
          { issue: "Scope creep and unpaid extra work on fixed-price projects", tags: [], summary: "Fixed-price quotes rarely account for mid-project change requests, and without a formal change-order process, extra revisions and features get delivered for free to keep the client happy. Software and IT projects are among the most exposed to this - industry research finds the majority of projects see some scope creep, with average overruns eating a meaningful share of the original estimate.", revenueLeaks: ["Unpaid feature additions and revisions", "Effective hourly rate falls well below the quoted rate", "Project timelines slip, delaying the next client's start", "Disputes over what was 'included' in scope"] },
          { issue: "Over-reliance on freelance marketplaces", tags: ["website"], summary: "Without an independent website or portfolio generating direct enquiries, many freelancers and small shops depend on platforms like Upwork and Fiverr for most of their work - paying built-in commissions (roughly 10% on Upwork, a flat 20% on Fiverr) and competing on price against a large global pool of bidders.", revenueLeaks: ["10-20% platform commission on every project", "Race-to-the-bottom bidding against global freelancers", "No ownership of the client relationship or repeat-business channel", "Platform account issues or suspension can end income overnight"] },
          { issue: "Late payments with no collections process", tags: [], summary: "Small IT service providers frequently invoice without a formal follow-up or escalation process, so overdue payments simply linger. Delayed payments owed to India's micro and small enterprises run into the lakh-crore range nationally, and while the MSMED Act requires settlement within 45 days, most solo operators lack the leverage or process to enforce it.", revenueLeaks: ["Cash tied up in unpaid invoices for months", "No interest or penalty charged on overdue amounts", "Working-capital gaps delay taking on new projects", "Time spent chasing payment instead of billable work"] },
          { issue: "Underpricing from no formal costing process", tags: [], summary: "Quotes are often set by gut feel or by undercutting competitors rather than by calculating actual time, overhead and risk, so jobs get priced below what they cost to deliver once revisions and admin time are factored in. Indian freelance developer hourly rates commonly cluster around $15-$40, often well below what a comparable role would cost an employer once benefits and overhead are included.", revenueLeaks: ["Hourly rate that doesn't cover non-billable admin time", "No buffer built in for revisions or delays", "Chronic underpricing relative to skill and experience level", "No profit margin left to reinvest in tools or marketing"] },
        ],
        financialMatrix: [
          { scale: "Startup / Early Stage", revenue: "Rs. 3 lakh - Rs. 15 lakh", margin: "10% to 35% (highly volatile - no fixed payroll, but frequent income gaps between projects; directional estimate)", profile: "Solo freelancer or informal 2-3 person team, mostly marketplace- or referral-sourced project work, often no registered business structure" },
          { scale: "Small Scale", revenue: "Rs. 15 lakh - Rs. 75 lakh", margin: "15% to 35% (directional estimate)", profile: "Registered freelancer or small 2-5 person dev/IT-support shop with a mix of referral and repeat clients, occasional retainer or AMC contracts" },
          { scale: "Medium Scale", revenue: "Rs. 75 lakh - Rs. 3 crore", margin: "12% to 25% (directional estimate)", profile: "5-10 person boutique agency or managed IT-support provider running multiple ongoing retainer/AMC contracts (typical small-business AMC pricing runs Rs. 8,000-Rs. 25,000/year per client) with light fixed overhead" },
          { scale: "Large Scale / Enterprise", revenue: "Rs. 3 crore - Rs. 8 crore", margin: "10% to 20% (directional estimate)", profile: "Upper edge of the 'small agency' bracket - beyond this scale the business typically formalises into a registered IT services company with dedicated sales, HR and delivery-management functions" },
        ],
      },
    },
    outlook: { sentence: "MeitY states that the IT-BPM industry, excluding e-commerce, is expected to reach approximately US$315 billion in FY2025-26, including exports of about US$246 billion, with employment estimated at roughly six million professionals and about 135,000 jobs added over the previous year.", source: "MeitY" },
  },

};

// Fallback revenue-leak bullets for leads whose industry isn't in the
// knowledge bank yet. These are general, structural consequences of having
// no digital presence/CRM - true regardless of sector, not a claim about
// this specific business's numbers.
export const GENERIC_REVENUE_LEAKS: string[] = [
  "Enquiries that never get logged or followed up simply disappear, with no record anyone lost them",
  "A customer who can't find you online finds a competitor who does show up",
  "No way to tell which leads are worth chasing, so time gets spent on the wrong ones",
];

// Generic before/after flow used when an industry has no knowledge-bank
// entry (or, as with electronics_electricals, an incomplete one).
export const GENERIC_FLOW_STAGES: string[] = ["Enquiry comes in", "Manual quoting or discussion", "Work delivered", "Informal follow-up", "Repeat business, if remembered"];

export function getIndustryKnowledge(industryKey?: string | null): Industry | null {
  if (!industryKey) return null;
  return INDUSTRY_KNOWLEDGE[industryKey] || null;
}

// Keyword hints for inferring which segment a lead belongs to, from free
// text like a business-category field, agent_type, or company name. Only
// industries with a `segments` shape need an entry here.
export const SEGMENT_KEYWORDS: Record<string, Record<string, string[]>> = {
  textile_apparel: {
    manufacturer: ["manufactur", "production", "mill", "spinning", "weaving", "dyeing", "processing unit", "garment factory", "factory", "fabric processor", "integrated textile"],
    wholesale_retail: ["wholesale", "trading", "distributor", "dealer", "trader", "retail", "showroom", "store", "boutique", "outlet", "supplier"],
  },
  pharmaceuticals_healthcare: {
    manufacturer: ["manufactur", "production", "formulation", "api ", "plant", "factory"],
    distributor_pharmacy: ["distributor", "wholesale", "stockist", "pharmacy", "chemist", "c&f", "retail"],
  },
  professional_services: {
    established_firm: ["firm", "associates", "& co", "llp", "multi-partner", "network"],
    solo_small_practice: ["solo", "independent", "freelance", "individual practice", "proprietor"],
  },
  real_estate: {
    developer: ["developer", "builder", "construction", "infra", "colonizer", "promoter"],
    broker_agent: ["broker", "agent", "channel partner", "realty", "consultant", "property dealer", "estate agent"],
  },
  chemicals: {
    manufacturer: ["manufactur", "production", "plant", "formulation", "petrochemical"],
    distributor_trading: ["distributor", "trading", "trader", "dealer", "stockist", "supplier"],
  },
  metals_heavy_industry: {
    producer: ["producer", "mill", "foundry", "manufactur", "forging", "casting"],
    trader_distributor: ["trader", "stockist", "distributor", "dealer", "supplier"],
  },
  automobile_auto_components: {
    manufacturer: ["manufactur", "oem", "component maker", "production", "auto parts manufactur"],
    dealer_distributor: ["dealer", "distributor", "showroom", "aftermarket", "retail", "workshop", "garage"],
  },
  food_processing: {
    manufacturer: ["manufactur", "processing", "processor", "production", "dairy plant"],
    distributor_retailer: ["distributor", "wholesale", "retailer", "trader", "kirana", "super stockist"],
  },
  construction: {
    general_contractor: ["epc", "general contractor", "developer", "civil contractor", "infrastructure"],
    specialty_contractor: ["subcontractor", "sub-contractor", "electrical contractor", "plumbing", "mep", "flooring", "specialty"],
  },
  leather_footwear: {
    manufacturer: ["manufactur", "tannery", "production", "factory"],
    wholesale_retail: ["wholesale", "retail", "showroom", "dealer", "trader", "store"],
  },
  education_services: {
    established_institution: ["institution", "university", "college", "school chain", "campus"],
    small_coaching_tutoring: ["coaching", "tuition", "tutoring", "academy", "classes", "institute"],
  },
  healthcare_services: {
    hospital_facility: ["hospital", "multi-specialty", "nursing home chain", "medical center"],
    small_clinic_practice: ["clinic", "practice", "dental", "physio", "diagnostic centre", "doctor"],
  },
  logistics_transportation: {
    fleet_3pl: ["3pl", "logistics company", "fleet operator", "warehouse", "supply chain"],
    local_transporter_broker: ["transporter", "transport", "freight broker", "courier", "fleet owner", "trucking"],
  },
  media_communication: {
    established_agency: ["agency", "studio network", "broadcaster", "production house"],
    freelancer_boutique: ["freelance", "boutique", "creator", "independent", "solo"],
  },
  paper_packaging: {
    manufacturer: ["manufactur", "mill", "production", "converting plant"],
    distributor_converter: ["distributor", "trader", "converter", "dealer", "wholesale"],
  },
  financial_services: {
    institution: ["bank", "nbfc", "financial institution", "insurer", "asset management"],
    small_broker_agent: ["agent", "broker", "dsa", "advisor", "independent", "insurance agent"],
  },
  hospitality_tourism: {
    hotel_property: ["hotel", "resort", "property chain", "hospitality group"],
    small_travel_agency: ["travel agency", "tour operator", "travel agent", "homestay", "guesthouse"],
  },
  it_technology_services: {
    established_company: ["software company", "it services", "saas", "technology company"],
    freelancer_small_agency: ["freelance", "freelancer", "small agency", "independent developer", "boutique"],
  },
};

export function inferSegmentFromText(industryKey?: string | null, text?: string | null): string | null {
  const keywordMap = industryKey ? SEGMENT_KEYWORDS[industryKey] : null;
  if (!keywordMap || !text) return null;
  const lower = String(text).toLowerCase();
  for (const [segmentKey, keywords] of Object.entries(keywordMap)) {
    if (keywords.some((kw) => lower.includes(kw))) return segmentKey;
  }
  return null;
}

// Resolves which segment applies to a lead: an explicit hint.segment wins
// (manual override), then inference from hint.text, then the industry's
// own defaultSegment. Returns null for flat (unsegmented) industries -
// there's nothing to resolve.
export function resolveSegment(industryKey?: string | null, hint?: SegmentHint | null): string | null {
  const industry = getIndustryKnowledge(industryKey);
  if (!industry || !industry.segments) return null;

  const segments = industry.segments;
  if (hint && hint.segment && segments[hint.segment]) return hint.segment;
  if (hint && hint.text) {
    const inferred = inferSegmentFromText(industryKey, hint.text);
    if (inferred && segments[inferred]) return inferred;
  }
  return industry.defaultSegment || Object.keys(segments)[0] || null;
}

// Resolves an industry down to a single flat profile
// (painPoints/currentFlowStages/financialMatrix/label), transparently
// handling both segmented and flat industries. `hint` is only meaningful
// for segmented industries: { segment?: explicit key, text?: free text to
// infer from (e.g. a business-category field) }.
export function getIndustryProfile(industryKey?: string | null, hint?: SegmentHint | null): IndustryProfile | null {
  const industry = getIndustryKnowledge(industryKey);
  if (!industry) return null;

  if (industry.segments) {
    const segmentKey = resolveSegment(industryKey, hint);
    const segment = segmentKey ? industry.segments[segmentKey] : undefined;
    if (!segment) return null;
    return {
      label: `${industry.label} - ${segment.label}`,
      currentFlowStages: segment.currentFlowStages,
      painPoints: segment.painPoints,
      financialMatrix: segment.financialMatrix,
    };
  }

  // Flat (unsegmented) industry - used as-is, unchanged from before segments existed.
  return {
    label: industry.label,
    currentFlowStages: industry.currentFlowStages,
    painPoints: industry.painPoints,
    financialMatrix: industry.financialMatrix,
  };
}

// Picks the 1-2 pain points most relevant to what this lead is actually
// missing (matched against the same gap categories used in the Digital
// Presence Audit), and returns a short paragraph - not the full
// knowledge-bank entry. Falls back to the first two pain points if nothing
// tagged matches, so the section is never empty for a known industry.
function getMatchedPainPoints(industryKey?: string | null, missingTags?: string[] | null, hint?: SegmentHint | null): PainPoint[] {
  const profile = getIndustryProfile(industryKey, hint);
  if (!profile || !profile.painPoints) return [];

  const tagSet = new Set(missingTags || []);
  const matched = profile.painPoints.filter((p) => p.tags.some((t) => tagSet.has(t)));
  return (matched.length > 0 ? matched : profile.painPoints).slice(0, 2);
}

export function getIndustryPainPointsText(industryKey?: string | null, missingTags?: string[] | null, hint?: SegmentHint | null): string | null {
  const chosen = getMatchedPainPoints(industryKey, missingTags, hint);
  if (chosen.length === 0) return null;
  return chosen.map((p) => p.summary).join(" ");
}

// Returns up to 4 revenue-leak bullets: from the matched industry pain
// points if the industry is known, otherwise the generic fallback list.
// Always real, sourced-in-kind risk categories - never a fabricated number.
export function getRevenueLeaks(industryKey?: string | null, missingTags?: string[] | null, hint?: SegmentHint | null): string[] {
  const chosen = getMatchedPainPoints(industryKey, missingTags, hint);
  if (chosen.length === 0) return GENERIC_REVENUE_LEAKS;

  const leaks = chosen.flatMap((p) => p.revenueLeaks || []);
  return leaks.length > 0 ? leaks.slice(0, 4) : GENERIC_REVENUE_LEAKS;
}

// Industry label with any trailing parenthetical qualifier stripped, so it
// can be dropped straight into prose. Two entries carry one - "Food
// Processing (Packaged Foods, Dairy, ...)" and "Electronics & Electricals
// Manufacturing (India)" - which read badly in a sentence.
//
// Deliberately NOT lowercased: "IT & Technology Services" becomes the
// pronoun "it" if you do, and several labels are proper nouns.
export function getIndustryLabel(industryKey?: string | null): string | null {
  const industry = getIndustryKnowledge(industryKey);
  if (!industry?.label) return null;
  const trimmed = industry.label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return trimmed || null;
}

/**
 * The segment an industry falls back to when a lead's own text doesn't
 * determine one, given a source-level bias.
 *
 * `defaultSegment` encodes the bottom-up go-to-market bias - wholesaler,
 * solo practitioner, small clinic - because that's the more accessible
 * target. That's right for a scraped list of small businesses and wrong for
 * a curated database of established firms, where it labels radio
 * broadcasters "Freelancer / Boutique Studio".
 *
 * Every segmented industry has exactly two segments, so "established" means
 * the one that isn't the default. Only consulted when the per-lead text is
 * inconclusive - a lead that says "wholesale trading" stays wholesale
 * whatever the source claims.
 */
export function getBiasedDefaultSegment(
  industryKey?: string | null,
  bias?: "established" | "small" | null,
): string | null {
  const industry = getIndustryKnowledge(industryKey);
  if (!industry?.segments) return null;

  const keys = Object.keys(industry.segments);
  const fallback = industry.defaultSegment || keys[0] || null;
  if (bias !== "established") return fallback;

  const alternative = keys.find((k) => k !== fallback);
  return alternative ?? fallback;
}

// Label of the segment this lead resolves to, or null for flat industries.
export function getSegmentLabel(
  industryKey?: string | null,
  hint?: SegmentHint | null,
): string | null {
  const industry = getIndustryKnowledge(industryKey);
  if (!industry?.segments) return null;
  const segmentKey = resolveSegment(industryKey, hint);
  if (!segmentKey) return null;
  return industry.segments[segmentKey]?.label ?? null;
}

// Outlook stays industry-wide (market growth trend applies regardless of
// segment), so this doesn't take a segment hint.
export function getIndustryOutlookLine(industryKey?: string | null): string | null {
  const industry = getIndustryKnowledge(industryKey);
  if (!industry || !industry.outlook) return null;
  return `${industry.outlook.sentence} (Source: ${industry.outlook.source})`;
}

// Real, industry-specific "today" flow for the before/after diagram. Falls
// back to a generic small-business flow when the industry is unknown or
// (as with electronics_electricals) the source doc didn't have this data.
export function getCurrentFlowStages(industryKey?: string | null, hint?: SegmentHint | null): string[] {
  const profile = getIndustryProfile(industryKey, hint);
  if (profile && profile.currentFlowStages && profile.currentFlowStages.length > 0) {
    return profile.currentFlowStages;
  }
  return GENERIC_FLOW_STAGES;
}

// Human-readable label including the resolved segment (e.g. "Textile &
// Apparel - Wholesale / Retail / Trade-Facing") for segmented industries,
// or just the industry label for flat ones. Used in the report's "Today"
// intro line so it reads as specific, not generic.
export function getResolvedLabel(industryKey?: string | null, hint?: SegmentHint | null): string | null {
  const profile = getIndustryProfile(industryKey, hint);
  return profile ? profile.label : null;
}
