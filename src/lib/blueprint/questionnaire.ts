/**
 * The discovery-call questionnaire.
 *
 * The audit can only see what is public - website, listing, social. Everything
 * that actually drives a build (do they carry stock, how do they bill, who
 * chases follow-ups) is invisible from outside and has to be asked. This is
 * what turns "we found no website" into a system the client recognises as
 * theirs.
 *
 * Two kinds of question:
 *
 *   Universal   - asked of every lead, and each answer can trigger or rule
 *                 out a component. These are what make a recommendation.
 *   Industry    - generated from the knowledge bank's researched pain points
 *                 for that industry and segment. These capture context and
 *                 make the call sound informed; they deliberately do NOT
 *                 trigger components, because a pain point is narrative and
 *                 mapping it to a price would be a guess.
 *
 * Kept short enough to work on a real phone call. An executive who has to
 * read thirty questions will stop using it by the third call.
 */
import { getIndustryProfile, getResolvedLabel, type SegmentHint } from "@/lib/prospecting/industry-knowledge";
import type { ScaleTier } from "@/lib/pricing/smb-catalog";

export type QuestionKind = "single" | "multi" | "text";

export interface QuestionOption {
  value: string;
  label: string;
  /** Component codes this answer argues for. */
  triggers?: string[];
  /** Component codes this answer rules out. */
  declines?: string[];
  /**
   * Why this answer justifies those components, in the client's own terms.
   * Printed on the system overview, so it has to read like something they
   * told us - "we write them in a notebook" - not like a sales line.
   */
  rationale?: string;
}

export interface Question {
  code: string;
  question: string;
  helpText?: string;
  kind: QuestionKind;
  options?: QuestionOption[];
  /** Context questions inform the narrative rather than the price. */
  isContext?: boolean;
}

export interface Answer {
  questionCode: string;
  /** Option values chosen, or free text for `text` questions. */
  values: string[];
  note?: string;
}

export const UNIVERSAL_QUESTIONS: Question[] = [
  {
    code: "TEAM_SIZE",
    question: "Roughly how many people work in the business?",
    helpText: "Sets which pricing tier applies. Ask casually - nobody minds this one.",
    kind: "single",
    options: [
      { value: "solo", label: "Just me, or 2-3 people" },
      { value: "small", label: "Under 20" },
      { value: "medium", label: "20 to 100" },
      { value: "large", label: "Over 100" },
    ],
  },
  {
    code: "ENQUIRY_CHANNELS",
    question: "How do enquiries reach you today?",
    helpText: "Pick everything they mention, not just the first one.",
    kind: "multi",
    options: [
      { value: "phone", label: "Phone calls", triggers: ["LEAD_MANAGEMENT"], rationale: "Enquiries arrive by phone, where a missed call leaves no record that anyone can follow up." },
      { value: "whatsapp", label: "WhatsApp", triggers: ["WHATSAPP_CRM"], rationale: "Enquiries come in on WhatsApp, currently on personal phones rather than an inbox the team shares." },
      { value: "walkin", label: "Walk-ins" },
      { value: "website", label: "Website form" },
      { value: "referral", label: "Referrals" },
      { value: "marketplace", label: "IndiaMART, JustDial or similar", triggers: ["LEAD_MANAGEMENT"], rationale: "Marketplace enquiries are shared with several suppliers at once, so response speed decides who wins them." },
    ],
  },
  {
    code: "ENQUIRY_TRACKING",
    question: "Once an enquiry comes in, where is it written down?",
    helpText: "The honest answer here is usually 'nowhere' - that is the opening.",
    kind: "single",
    options: [
      { value: "nowhere", label: "Nowhere - we remember it", triggers: ["LEAD_MANAGEMENT"], rationale: "Enquiries are not written down anywhere, so nothing records who was contacted or what was promised." },
      { value: "notebook", label: "A notebook or diary", triggers: ["LEAD_MANAGEMENT"], rationale: "Enquiries live in a notebook today, which only one person can see and nothing can remind them about." },
      { value: "spreadsheet", label: "A spreadsheet", triggers: ["LEAD_MANAGEMENT"], rationale: "Enquiries are kept in a spreadsheet, which nobody is prompted to open and which shows no follow-up history." },
      { value: "software", label: "Existing software", declines: ["LEAD_MANAGEMENT"] },
    ],
  },
  {
    code: "FOLLOWUP",
    question: "Who follows up if a customer does not reply, and when?",
    helpText: "If the answer is vague, follow-up is not happening.",
    kind: "single",
    options: [
      { value: "nobody", label: "Nobody consistently", triggers: ["AUTOMATION_FLOWS"], rationale: "Nobody consistently chases a customer who goes quiet, so warm enquiries are lost by default rather than by decision." },
      { value: "manual", label: "Someone remembers to", triggers: ["AUTOMATION_FLOWS"], rationale: "Follow-up depends on somebody remembering, so it happens when things are quiet and stops when they are busy." },
      { value: "systematic", label: "There is a set process", declines: ["AUTOMATION_FLOWS"] },
    ],
  },
  {
    code: "STOCK",
    question: "Do you hold stock that has to be tracked?",
    kind: "single",
    options: [
      { value: "yes_manual", label: "Yes, tracked manually", triggers: ["INVENTORY"], rationale: "Stock is tracked by hand, so what is actually available is only known by asking someone." },
      { value: "yes_software", label: "Yes, already in software", declines: ["INVENTORY"] },
      { value: "no", label: "No stock", declines: ["INVENTORY"] },
    ],
  },
  {
    code: "BILLING",
    question: "How are bills and invoices raised today?",
    kind: "single",
    options: [
      { value: "manual", label: "By hand or in Word/Excel", triggers: ["BILLING_GST"], rationale: "Invoices are produced by hand, which is slow and leaves outstanding payments hard to see." },
      { value: "tally", label: "Tally or similar accounting software" },
      { value: "software", label: "A billing system already", declines: ["BILLING_GST"] },
    ],
  },
  {
    code: "SELL_ONLINE",
    question: "Do you want customers to be able to buy or order online?",
    kind: "single",
    options: [
      { value: "yes", label: "Yes", triggers: ["ECOMMERCE"], rationale: "You want customers to be able to order online rather than only in person." },
      { value: "maybe", label: "Maybe later" },
      { value: "no", label: "No - we sell in person", declines: ["ECOMMERCE"] },
    ],
  },
  {
    code: "CUSTOMER_VISIBILITY",
    question: "Do your customers ask you for status updates on their orders or jobs?",
    helpText: "Frequent 'where is my order' calls are what a portal removes.",
    kind: "single",
    options: [
      { value: "often", label: "Constantly", triggers: ["CLIENT_PORTAL_SMB"], rationale: "Customers call constantly for status updates, which a portal answers without anyone picking up." },
      { value: "sometimes", label: "Sometimes" },
      { value: "rarely", label: "Rarely", declines: ["CLIENT_PORTAL_SMB"] },
    ],
  },
  {
    code: "MOBILE_NEED",
    question: "Does anyone need this on a phone while away from a desk?",
    helpText: "A field team or delivery staff is a real app case. 'It would be nice' is not.",
    kind: "single",
    options: [
      { value: "field_team", label: "Yes - field or delivery staff", triggers: ["MOBILE_APP"], rationale: "Field and delivery staff need this away from a desk, which a website alone does not serve well." },
      { value: "customers", label: "Yes - customers would use an app", triggers: ["MOBILE_APP"], rationale: "Your customers would use an app directly, which changes what needs building." },
      { value: "no", label: "No, a website is enough", declines: ["MOBILE_APP"] },
    ],
  },
  {
    code: "TIME_SINK",
    question: "Which repetitive job eats the most time each week?",
    helpText: "Free text. Their own words are the best line in the document.",
    kind: "text",
  },
  {
    code: "BUDGET_SIGNAL",
    question: "Have they given any indication of budget or urgency?",
    helpText: "Internal note - never printed on the client document.",
    kind: "text",
    isContext: true,
  },
];

const SCALE_BY_TEAM_SIZE: Record<string, ScaleTier> = {
  solo: "smb",
  small: "smb",
  medium: "midmarket",
  large: "enterprise",
};

/**
 * Industry questions, generated from the knowledge bank rather than written
 * by hand for 20 industries. Each researched pain point becomes a question
 * an executive can ask, which is the difference between a generic script and
 * one that sounds like you know their trade.
 */
export function buildIndustryQuestions(
  industry?: string | null,
  hint?: SegmentHint | null,
): Question[] {
  const profile = getIndustryProfile(industry, hint);
  if (!profile?.painPoints?.length) return [];

  const label = getResolvedLabel(industry, hint);

  return profile.painPoints.slice(0, 3).map((pain, i) => ({
    code: `IND_${i + 1}`,
    question: `${pain.issue} - is that a problem here?`,
    helpText: label
      ? `Common in ${label}. ${pain.summary.slice(0, 150)}`
      : pain.summary.slice(0, 150),
    kind: "single" as const,
    isContext: true,
    options: [
      { value: "yes", label: "Yes, that's a real problem" },
      { value: "somewhat", label: "Somewhat" },
      { value: "no", label: "Not really" },
    ],
  }));
}

export function buildQuestionnaire(industry?: string | null, hint?: SegmentHint | null): Question[] {
  return [...UNIVERSAL_QUESTIONS, ...buildIndustryQuestions(industry, hint)];
}

export function scaleTierFromAnswers(answers: Answer[]): ScaleTier {
  const teamSize = answers.find((a) => a.questionCode === "TEAM_SIZE")?.values[0];
  return (teamSize && SCALE_BY_TEAM_SIZE[teamSize]) || "smb";
}

/**
 * Which components the answers argue for, and which they rule out.
 *
 * A decline beats a trigger: if they already run billing software, the fact
 * that they also take enquiries on WhatsApp is not a reason to sell them
 * billing anyway.
 */
export function componentsFromAnswers(answers: Answer[], questions: Question[]) {
  const triggered = new Set<string>();
  const declined = new Set<string>();
  /** code -> why, so the overview can say what they told us. */
  const rationales: Record<string, string> = {};

  const byCode = new Map(questions.map((q) => [q.code, q]));

  for (const answer of answers) {
    const question = byCode.get(answer.questionCode);
    if (!question?.options) continue;

    for (const value of answer.values) {
      const option = question.options.find((o) => o.value === value);
      if (!option) continue;
      for (const code of option.triggers ?? []) {
        triggered.add(code);
        // First answer to argue for a component wins; the questionnaire is
        // ordered so the earlier question is the more fundamental one.
        if (option.rationale && !rationales[code]) rationales[code] = option.rationale;
      }
      for (const code of option.declines ?? []) declined.add(code);
    }
  }

  for (const code of declined) {
    triggered.delete(code);
    delete rationales[code];
  }

  return { requestedCodes: [...triggered], declinedCodes: [...declined], rationales };
}
