/**
 * The catalogue of general documents a practice writes.
 *
 * PURE and client-safe: no Prisma, no I/O. It is data, and it is the whole
 * definition of each document — the fields the composer asks for, the body it
 * proposes, the signature blocks the sheet prints.
 *
 * TEMPLATES ARE A STARTING POINT, NOT LEGAL ADVICE. A power of attorney, an NDA
 * and a notice of termination have legal effect. The bodies here are the plain,
 * conventional wording a firm uses day to day; anything binding should be read
 * by the practice's own lawyer before it goes out, and the composer says so.
 * That is also why the body is EDITABLE and then STORED on the row: an issued
 * document must read the same next year, whatever this file says by then.
 *
 * TOKENS. One flat namespace, filled by lib/general-documents/render.ts:
 *   {{firmName}} {{clientName}} {{projectName}} {{projectAddress}}
 *   {{counterpartyName}} {{counterpartyAddress}} {{contactName}}
 *   {{issueDate}} {{effectiveDate}} {{expiryDate}} {{reference}} {{number}}
 * plus every field key of the entry itself. An unfilled token prints as a rule
 * (“____”) so a blank is obvious on paper rather than silently empty.
 */
import type { CatalogueEntry, DocumentCategory } from "./types";

/** The party a document is normally addressed to, when it is not the client. */
const AUTHORITY = "Authority / department";
const OTHER_PARTY = "Other party";
const SUPPLIER = "Supplier / contractor";

export const CATALOGUE: CatalogueEntry[] = [
  // ── AUTHORISATIONS ───────────────────────────────────────────────────────
  {
    key: "poa",
    label: "Power of Attorney",
    abbreviation: "POA",
    category: "AUTHORISATION",
    summary: "The client authorises the practice to sign and file on their behalf.",
    titleTemplate: "Power of Attorney — {{clientName}}",
    practiceNote:
      "A power of attorney has legal effect and many authorities require it notarised. Have your lawyer approve the wording once, then reuse it.",
    fields: [
      { key: "principalName", label: "Principal (who is granting it)", type: "text", required: true, help: "The client, exactly as their identity document reads." },
      { key: "principalId", label: "Principal ID / passport / registry no.", type: "text" },
      { key: "attorneyName", label: "Attorney-in-fact (who may act)", type: "text", required: true, help: "Usually the practice, or a named director of it." },
      { key: "scope", label: "What the attorney may do", type: "textarea", required: true, placeholder: "Submit, sign for and collect the building permit application for the works described below, and represent the principal before the authority in connection with it." },
      { key: "limitations", label: "What it does NOT cover", type: "textarea", placeholder: "It does not extend to the sale, mortgage or transfer of the property, nor to any financial commitment beyond the application fees." },
      { key: "place", label: "Place of signing", type: "text", placeholder: "Oranjestad, Aruba" },
    ],
    body: [
      "The undersigned, {{principalName}} ({{principalId}}), hereinafter “the Principal”, hereby grants a power of attorney to {{attorneyName}}, hereinafter “the Attorney”, in connection with the property and works described as {{projectName}}, {{projectAddress}}.",
      "The Attorney is authorised, in the name of and on behalf of the Principal, to: {{scope}}",
      "This authority is limited as follows: {{limitations}}",
      "This power of attorney takes effect on {{effectiveDate}} and remains in force until {{expiryDate}}, unless revoked earlier in writing. Everything lawfully done by the Attorney within the authority granted above binds the Principal as if done by the Principal.",
      "Signed at {{place}} on {{issueDate}}.",
    ],
    signatures: [
      { role: "Principal", party: "client" },
      { role: "Attorney-in-fact", party: "firm" },
      { role: "Witness / Notary", witness: true },
    ],
  },
  {
    key: "authorisation_to_submit",
    label: "Authorisation to Submit",
    category: "AUTHORISATION",
    summary: "Short letter letting the practice file an application with an authority.",
    counterpartyLabel: AUTHORITY,
    titleTemplate: "Authorisation to submit — {{projectName}}",
    fields: [
      { key: "applicationType", label: "What is being submitted", type: "text", required: true, placeholder: "Building permit application" },
      { key: "parcelNumber", label: "Parcel / meetbrief number", type: "text" },
      { key: "representativeName", label: "Who may submit it", type: "text", required: true },
    ],
    body: [
      "To {{counterpartyName}},",
      "I, {{clientName}}, owner of the property registered as {{parcelNumber}} at {{projectAddress}}, authorise {{representativeName}} of {{firmName}} to lodge and pursue the {{applicationType}} for the works at {{projectName}} on my behalf.",
      "This includes signing the application forms, submitting and collecting drawings and documents, answering queries about the submission and receiving correspondence concerning it.",
      "This authorisation is valid from {{effectiveDate}} until the application is decided, unless I withdraw it in writing.",
    ],
    signatures: [
      { role: "Owner / Client", party: "client" },
      { role: "For the practice", party: "firm" },
    ],
  },
  {
    key: "agency_appointment",
    label: "Letter of Appointment as Agent",
    category: "AUTHORISATION",
    summary: "Appoints the practice as the client's agent for a defined scope.",
    titleTemplate: "Appointment as agent — {{projectName}}",
    fields: [
      { key: "agentScope", label: "Scope of the agency", type: "textarea", required: true, placeholder: "Acting as the client's representative in dealings with contractors, suppliers and the authority for the duration of the works." },
      { key: "authorityLimit", label: "Financial authority", type: "money", help: "The most the agent may commit without written instruction. Leave blank for none." },
    ],
    body: [
      "{{clientName}} appoints {{firmName}} as its agent in respect of {{projectName}}, {{projectAddress}}, with effect from {{effectiveDate}}.",
      "The agency covers: {{agentScope}}",
      "The agent may commit the client to expenditure up to {{authorityLimit}} without further written instruction. Anything beyond that requires the client's prior approval in writing.",
      "Either party may end this appointment by written notice. Work properly instructed before that notice remains payable.",
    ],
    signatures: [
      { role: "Client", party: "client" },
      { role: "Agent", party: "firm" },
    ],
  },
  {
    key: "site_access_authorisation",
    label: "Site Access Authorisation",
    category: "AUTHORISATION",
    summary: "Lets a named party onto the site, on stated conditions.",
    counterpartyLabel: OTHER_PARTY,
    titleTemplate: "Site access authorisation — {{projectName}}",
    fields: [
      { key: "visitorName", label: "Who is being admitted", type: "text", required: true },
      { key: "purpose", label: "Purpose of access", type: "textarea", required: true, placeholder: "Survey of existing conditions and photographic record." },
      { key: "accessPeriod", label: "When", type: "text", required: true, placeholder: "Weekdays 07:00–16:00, from 20 SEP to 30 SEP 2026" },
      { key: "conditions", label: "Conditions", type: "textarea", placeholder: "Hard hat, safety boots and a high-visibility vest at all times. Report to the site office on arrival. No work to be carried out without written instruction." },
    ],
    body: [
      "{{visitorName}} is authorised to enter the site at {{projectAddress}} ({{projectName}}) for the following purpose: {{purpose}}",
      "Access is granted for {{accessPeriod}}.",
      "Conditions of access: {{conditions}}",
      "This authorisation does not transfer control of the site and may be withdrawn at any time.",
    ],
    signatures: [{ role: "Issued by", party: "firm" }, { role: "Acknowledged by" }],
  },

  // ── AGREEMENTS & INTENT ──────────────────────────────────────────────────
  {
    key: "loi",
    label: "Letter of Intent",
    abbreviation: "LOI",
    category: "AGREEMENT",
    summary: "States what the parties intend before the contract is signed.",
    counterpartyLabel: OTHER_PARTY,
    titleTemplate: "Letter of Intent — {{projectName}}",
    practiceNote:
      "Say plainly whether it binds. An LOI that is silent on that is the one that ends up in a dispute.",
    fields: [
      { key: "intent", label: "What is intended", type: "textarea", required: true, placeholder: "To appoint the addressee as main contractor for the works at the price and programme set out in their tender of …" },
      { key: "value", label: "Indicative value", type: "money", help: "Leave blank if no figure is agreed yet." },
      { key: "conditions", label: "Conditions to be met first", type: "textarea", placeholder: "Agreement of the contract sum, evidence of insurance, and the client's board approval." },
      { key: "bindingText", label: "Binding or not", type: "select", required: true, options: ["Not binding — intent only", "Binding as to the works described", "Binding only as to costs already authorised"] },
      { key: "authorisedSpend", label: "Authorised spend in the meantime", type: "money", help: "What may be spent before the contract exists." },
    ],
    body: [
      "To {{counterpartyName}},",
      "This letter records the intention of {{clientName}} in respect of {{projectName}}, {{projectAddress}}: {{intent}}",
      "The indicative value of the works is {{value}}. This letter is {{bindingText}}.",
      "It is subject to the following being satisfied: {{conditions}}",
      "Pending the contract, you are authorised to incur costs up to {{authorisedSpend}}, which will be honoured whether or not the contract is concluded. Nothing beyond that figure is authorised.",
      "Please confirm your acceptance by returning a signed copy.",
    ],
    signatures: [
      { role: "For the client", party: "client" },
      { role: "Accepted by", party: "counterparty" },
    ],
  },
  {
    key: "nda_mutual",
    label: "Mutual Non-Disclosure Agreement",
    abbreviation: "NDA",
    category: "AGREEMENT",
    summary: "Both sides exchange confidential information and both are bound.",
    counterpartyLabel: OTHER_PARTY,
    titleTemplate: "Mutual Non-Disclosure Agreement — {{counterpartyName}}",
    practiceNote: "Have your lawyer approve this once; the term and the governing law are the two lines they will change.",
    fields: [
      { key: "purpose", label: "Why information is being exchanged", type: "textarea", required: true, placeholder: "Evaluating a possible collaboration on the design and delivery of the project described below." },
      { key: "termYears", label: "Term (years)", type: "number", required: true, placeholder: "3" },
      { key: "governingLaw", label: "Governing law", type: "text", required: true, placeholder: "the law of Aruba" },
    ],
    body: [
      "This agreement is made on {{issueDate}} between {{firmName}} and {{counterpartyName}} (“the parties”).",
      "The parties wish to exchange confidential information in connection with {{projectName}}, for the following purpose: {{purpose}}",
      "Each party will keep the other's confidential information confidential, use it only for that purpose, disclose it only to those of its people and advisers who need it for that purpose and who are bound by equivalent obligations, and protect it with at least the care it applies to its own confidential information.",
      "These obligations do not apply to information that is already public, that the receiving party already held without obligation, that it develops independently, or that it must disclose by law or by order of a court or authority — in which case it will tell the other party first, where it lawfully can.",
      "Nothing here transfers ownership, grants a licence, or obliges either party to proceed with any transaction. Drawings, models and calculations remain the property of the party that produced them.",
      "This agreement runs for {{termYears}} years from the date above and is governed by {{governingLaw}}.",
    ],
    signatures: [
      { role: "For {{firmName}}", party: "firm" },
      { role: "For {{counterpartyName}}", party: "counterparty" },
    ],
  },
  {
    key: "nda_oneway",
    label: "One-way Non-Disclosure Agreement",
    abbreviation: "NDA",
    category: "AGREEMENT",
    summary: "The practice discloses; the recipient is bound.",
    counterpartyLabel: "Recipient",
    titleTemplate: "Non-Disclosure Agreement — {{counterpartyName}}",
    fields: [
      { key: "purpose", label: "Why the recipient is being given the information", type: "textarea", required: true, placeholder: "Pricing the works described in the tender documents issued with this agreement." },
      { key: "termYears", label: "Term (years)", type: "number", required: true, placeholder: "3" },
      { key: "governingLaw", label: "Governing law", type: "text", required: true, placeholder: "the law of Aruba" },
      { key: "returnOnRequest", label: "On request, the recipient must", type: "select", options: ["Return all material", "Destroy all material and confirm in writing", "Either, at the discloser's option"] },
    ],
    body: [
      "This agreement is made on {{issueDate}} between {{firmName}} (“the Discloser”) and {{counterpartyName}} (“the Recipient”).",
      "The Discloser will provide confidential information relating to {{projectName}}, for this purpose only: {{purpose}}",
      "The Recipient will keep that information confidential, use it only for that purpose, and disclose it only to those of its people and advisers who need it for that purpose and who are bound by equivalent obligations.",
      "These obligations do not apply to information that is already public, that the Recipient already held without obligation, that it develops independently, or that it must disclose by law — in which case it will tell the Discloser first, where it lawfully can.",
      "On request the Recipient will {{returnOnRequest}}. Drawings, models and calculations remain the property of the Discloser, and no licence to use them for construction is granted by this agreement.",
      "This agreement runs for {{termYears}} years from the date above and is governed by {{governingLaw}}.",
    ],
    signatures: [
      { role: "For {{firmName}}", party: "firm" },
      { role: "For {{counterpartyName}}", party: "counterparty" },
    ],
  },
  {
    key: "mou",
    label: "Memorandum of Understanding",
    abbreviation: "MOU",
    category: "AGREEMENT",
    summary: "Who will do what, before anyone is contractually bound.",
    counterpartyLabel: OTHER_PARTY,
    titleTemplate: "Memorandum of Understanding — {{counterpartyName}}",
    fields: [
      { key: "background", label: "Background", type: "textarea", required: true },
      { key: "ourRole", label: "What we will do", type: "textarea", required: true },
      { key: "theirRole", label: "What the other party will do", type: "textarea", required: true },
      { key: "costs", label: "Who carries what cost", type: "textarea", placeholder: "Each party carries its own costs until a contract is signed." },
      { key: "reviewDate", label: "Review date", type: "date" },
    ],
    body: [
      "This memorandum records the understanding reached on {{issueDate}} between {{firmName}} and {{counterpartyName}} concerning {{projectName}}.",
      "Background: {{background}}",
      "{{firmName}} will: {{ourRole}}",
      "{{counterpartyName}} will: {{theirRole}}",
      "Costs: {{costs}}",
      "This memorandum is a statement of intent. It creates no legal obligation on either party and will be reviewed on {{reviewDate}}.",
    ],
    signatures: [
      { role: "For {{firmName}}", party: "firm" },
      { role: "For {{counterpartyName}}", party: "counterparty" },
    ],
  },
  {
    key: "engagement_letter",
    label: "Engagement Letter",
    category: "AGREEMENT",
    summary: "Confirms an appointment and points at the fee proposal it rests on.",
    titleTemplate: "Engagement — {{projectName}}",
    practiceNote:
      "For the fee schedule itself use a Service Proposal; this letter confirms the appointment and refers to it.",
    fields: [
      { key: "services", label: "Services", type: "textarea", required: true, placeholder: "Architectural design from concept through to permit, and construction administration during the works." },
      { key: "proposalReference", label: "Fee proposal reference", type: "text", help: "The service proposal number this appointment accepts." },
      { key: "feeSummary", label: "Fee, in one line", type: "text", placeholder: "As set out in the proposal above" },
      { key: "startDate", label: "Start", type: "date" },
      { key: "exclusions", label: "Not included", type: "textarea" },
    ],
    body: [
      "Dear {{contactName}},",
      "Thank you for appointing {{firmName}} on {{projectName}}, {{projectAddress}}. This letter confirms the basis of our engagement.",
      "Services: {{services}}",
      "Fee: {{feeSummary}}, as set out in our proposal {{proposalReference}}, which forms part of this engagement.",
      "The following are not included and will be quoted separately if you need them: {{exclusions}}",
      "We expect to start on {{startDate}}. Please return a signed copy of this letter to confirm.",
    ],
    signatures: [
      { role: "For {{firmName}}", party: "firm" },
      { role: "Accepted for {{clientName}}", party: "client" },
    ],
  },
  {
    key: "subconsultant_engagement",
    label: "Subconsultant Engagement Letter",
    category: "AGREEMENT",
    summary: "Appoints an engineer, surveyor or specialist under the practice.",
    counterpartyLabel: "Subconsultant",
    titleTemplate: "Subconsultant engagement — {{counterpartyName}}",
    fields: [
      { key: "discipline", label: "Discipline", type: "text", required: true, placeholder: "Structural engineering" },
      { key: "services", label: "Scope", type: "textarea", required: true },
      { key: "fee", label: "Fee", type: "money", required: true },
      { key: "deliverables", label: "Deliverables and dates", type: "textarea", required: true },
      { key: "insuranceRequired", label: "Insurance required", type: "text", placeholder: "Professional indemnity, minimum AWG 500,000" },
    ],
    body: [
      "Dear {{contactName}},",
      "{{firmName}} appoints {{counterpartyName}} to provide {{discipline}} services on {{projectName}}, {{projectAddress}}.",
      "Scope: {{services}}",
      "Deliverables: {{deliverables}}",
      "Fee: {{fee}}, invoiced against the deliverables above and payable within our own terms of payment from the client for the same stage.",
      "You are to hold {{insuranceRequired}} for the duration of the works and to provide evidence of it before starting. Your design remains your responsibility; ours remains ours.",
      "Please return a signed copy to confirm.",
    ],
    signatures: [
      { role: "For {{firmName}}", party: "firm" },
      { role: "For {{counterpartyName}}", party: "counterparty" },
    ],
  },

  // ── REQUESTS ─────────────────────────────────────────────────────────────
  {
    key: "rfi",
    label: "Request for Information",
    abbreviation: "RFI",
    category: "REQUEST",
    summary: "Asks a specific question and says when the answer is needed.",
    counterpartyLabel: OTHER_PARTY,
    titleTemplate: "RFI {{reference}} — {{projectName}}",
    practiceNote:
      "Construction-stage RFIs against a contract belong in Construction Administration; this is the general-purpose one.",
    fields: [
      { key: "question", label: "The question", type: "textarea", required: true },
      { key: "background", label: "Background / what prompted it", type: "textarea" },
      { key: "drawingRefs", label: "Drawings or documents referred to", type: "text" },
      { key: "answerBy", label: "Answer needed by", type: "date", required: true },
      { key: "impact", label: "What is held up meanwhile", type: "textarea", placeholder: "Fabrication of the roof steel cannot be released until this is answered." },
    ],
    body: [
      "To {{counterpartyName}},",
      "Request for information {{reference}} concerning {{projectName}}, {{projectAddress}}.",
      "Question: {{question}}",
      "Background: {{background}}",
      "Reference documents: {{drawingRefs}}",
      "We need your answer by {{answerBy}}. {{impact}}",
    ],
    signatures: [{ role: "Raised by", party: "firm" }, { role: "Answered by" }],
  },
  {
    key: "rfq",
    label: "Request for Quotation",
    abbreviation: "RFQ",
    category: "REQUEST",
    summary: "Asks a supplier or contractor to price a defined scope.",
    counterpartyLabel: SUPPLIER,
    titleTemplate: "RFQ {{reference}} — {{projectName}}",
    fields: [
      { key: "scope", label: "What is to be priced", type: "textarea", required: true },
      { key: "documents", label: "Documents issued with this request", type: "textarea", placeholder: "Drawings A-101 to A-110, finishes schedule rev. C, specification section 09." },
      { key: "quoteBy", label: "Quotations due", type: "date", required: true },
      { key: "validity", label: "Quotation to stay valid for", type: "text", placeholder: "60 days" },
      { key: "deliveryRequired", label: "Delivery / completion required", type: "text" },
      { key: "priceBasis", label: "Price basis", type: "select", options: ["Fixed lump sum", "Unit rates", "Rates and lump sum", "Cost plus fee"] },
      { key: "queriesTo", label: "Queries to", type: "text" },
    ],
    body: [
      "To {{counterpartyName}},",
      "{{firmName}}, on behalf of {{clientName}}, invites your quotation for the following on {{projectName}}, {{projectAddress}}: {{scope}}",
      "Issued with this request: {{documents}}",
      "Please price on a {{priceBasis}} basis and state separately any sum you have allowed for provisional or excluded items. Delivery or completion is required {{deliveryRequired}}.",
      "Quotations are due by {{quoteBy}} and are to remain valid for {{validity}}. Queries to {{queriesTo}}.",
      "This request is not an order and does not commit {{clientName}} to place one.",
    ],
    signatures: [{ role: "Issued by", party: "firm" }],
  },
  {
    key: "rfp",
    label: "Request for Proposal",
    abbreviation: "RFP",
    category: "REQUEST",
    summary: "Asks for a proposal on approach and price, not a bare price.",
    counterpartyLabel: OTHER_PARTY,
    titleTemplate: "RFP {{reference}} — {{projectName}}",
    fields: [
      { key: "brief", label: "The brief", type: "textarea", required: true },
      { key: "deliverables", label: "What the proposal must contain", type: "textarea", required: true, placeholder: "Approach, team and CVs, programme, fee breakdown by stage, two comparable projects." },
      { key: "criteria", label: "How proposals will be assessed", type: "textarea", placeholder: "Approach 40%, relevant experience 30%, programme 10%, fee 20%." },
      { key: "proposalBy", label: "Proposals due", type: "date", required: true },
      { key: "queriesBy", label: "Queries by", type: "date" },
    ],
    body: [
      "To {{counterpartyName}},",
      "{{firmName}} invites a proposal for {{projectName}}, {{projectAddress}}.",
      "Brief: {{brief}}",
      "Your proposal is to contain: {{deliverables}}",
      "Assessment: {{criteria}}",
      "Queries by {{queriesBy}}; proposals by {{proposalBy}}. We are not bound to accept the lowest fee or any proposal, and costs of proposing are yours.",
    ],
    signatures: [{ role: "Issued by", party: "firm" }],
  },
  {
    key: "prequalification_request",
    label: "Prequalification Request",
    category: "REQUEST",
    summary: "Asks a contractor or supplier to prove they can do the work.",
    counterpartyLabel: SUPPLIER,
    titleTemplate: "Prequalification — {{counterpartyName}}",
    fields: [
      { key: "workType", label: "Work being prequalified for", type: "text", required: true },
      { key: "requirements", label: "What to submit", type: "textarea", required: true, placeholder: "Company registration, tax compliance, insurance certificates, three comparable projects with references, key personnel, current workload." },
      { key: "returnBy", label: "Return by", type: "date", required: true },
    ],
    body: [
      "To {{counterpartyName}},",
      "{{firmName}} is assembling a list of firms to be invited to price {{workType}} on {{projectName}}.",
      "To be considered, please provide: {{requirements}}",
      "Please return these by {{returnBy}}. Inclusion on the list is not an invitation to tender and not a commitment to any award.",
    ],
    signatures: [{ role: "Issued by", party: "firm" }],
  },
  {
    key: "material_approval_request",
    label: "Material / Sample Approval Request",
    category: "REQUEST",
    summary: "Puts a product or sample in front of the client for a decision.",
    titleTemplate: "Material approval — {{projectName}}",
    fields: [
      { key: "item", label: "Item", type: "text", required: true, placeholder: "External wall tile, 600 × 600 porcelain" },
      { key: "proposed", label: "What is proposed", type: "textarea", required: true },
      { key: "specified", label: "What was specified", type: "textarea", help: "Fill this in when the proposal is a substitution." },
      { key: "costEffect", label: "Effect on cost", type: "text", placeholder: "No change / AWG 4,200 saving / AWG 1,800 addition" },
      { key: "programmeEffect", label: "Effect on programme", type: "text" },
      { key: "decisionBy", label: "Decision needed by", type: "date", required: true },
    ],
    body: [
      "Dear {{contactName}},",
      "We ask your approval of the following for {{projectName}}: {{item}}",
      "Proposed: {{proposed}}",
      "Specified: {{specified}}",
      "Effect on cost: {{costEffect}}. Effect on programme: {{programmeEffect}}.",
      "We need your decision by {{decisionBy}} to hold the programme. Approving this item accepts the cost and programme effects stated above.",
    ],
    signatures: [
      { role: "Submitted by", party: "firm" },
      { role: "Approved by", party: "client" },
    ],
  },
  {
    key: "design_approval_request",
    label: "Design Approval Request",
    category: "REQUEST",
    summary: "Closes out a design stage with the client's signature.",
    titleTemplate: "Design approval — {{projectName}}",
    fields: [
      { key: "stage", label: "Stage being approved", type: "text", required: true, placeholder: "Design development" },
      { key: "drawingList", label: "Drawings and documents submitted", type: "textarea", required: true },
      { key: "changesSince", label: "What changed since the last stage", type: "textarea" },
      { key: "decisionBy", label: "Approval needed by", type: "date", required: true },
      { key: "consequence", label: "What follows approval", type: "textarea", placeholder: "Preparation of the permit set and release of the structural design to the engineer." },
    ],
    body: [
      "Dear {{contactName}},",
      "The {{stage}} design for {{projectName}} is submitted for your approval.",
      "Submitted: {{drawingList}}",
      "Changes since the previous stage: {{changesSince}}",
      "On approval we will proceed to: {{consequence}}",
      "Please confirm by {{decisionBy}}. Changes requested after approval are treated as a variation.",
    ],
    signatures: [
      { role: "Submitted by", party: "firm" },
      { role: "Approved by", party: "client" },
    ],
  },
  {
    key: "eot_request",
    label: "Extension of Time Request",
    abbreviation: "EOT",
    category: "REQUEST",
    summary: "Asks for more time, with the cause and the evidence.",
    counterpartyLabel: OTHER_PARTY,
    titleTemplate: "Extension of time — {{projectName}}",
    fields: [
      { key: "currentCompletion", label: "Current completion date", type: "date", required: true },
      { key: "requestedCompletion", label: "Requested completion date", type: "date", required: true },
      { key: "daysRequested", label: "Days requested", type: "number", required: true },
      { key: "cause", label: "Cause", type: "textarea", required: true },
      { key: "evidence", label: "Evidence relied on", type: "textarea", placeholder: "Site records of 12–19 AUG, the authority's letter of 21 AUG and the revised programme rev. D." },
      { key: "mitigation", label: "What has been done to mitigate", type: "textarea" },
    ],
    body: [
      "To {{counterpartyName}},",
      "We request an extension of time on {{projectName}}, {{projectAddress}}.",
      "The completion date is currently {{currentCompletion}}. We request {{daysRequested}} days, moving completion to {{requestedCompletion}}.",
      "Cause: {{cause}}",
      "Evidence: {{evidence}}",
      "Mitigation: {{mitigation}}",
      "This request is made without prejudice to any entitlement to cost arising from the same cause.",
    ],
    signatures: [{ role: "Requested by", party: "firm" }, { role: "Determined by" }],
  },

  // ── NOTICES & CERTIFICATES ───────────────────────────────────────────────
  {
    key: "notice_to_proceed",
    label: "Notice to Proceed",
    category: "NOTICE",
    summary: "Tells a contractor to start, from a stated date.",
    counterpartyLabel: "Contractor",
    titleTemplate: "Notice to proceed — {{projectName}}",
    fields: [
      { key: "commencementDate", label: "Commencement date", type: "date", required: true },
      { key: "completionDate", label: "Completion date", type: "date", required: true },
      { key: "contractRef", label: "Contract reference", type: "text" },
      { key: "conditionsMet", label: "Conditions satisfied", type: "textarea", placeholder: "Insurances received, performance bond in place, permit issued." },
      { key: "beforeStart", label: "Required before starting on site", type: "textarea", placeholder: "Site setup plan, method statement for the excavation, names of the site supervisor and safety officer." },
    ],
    body: [
      "To {{counterpartyName}},",
      "Under contract {{contractRef}} for {{projectName}}, {{projectAddress}}, you are instructed to proceed with the works from {{commencementDate}}. Completion is required by {{completionDate}}.",
      "The conditions precedent have been satisfied: {{conditionsMet}}",
      "Before starting on site, provide: {{beforeStart}}",
      "The contract terms apply in full from the commencement date.",
    ],
    signatures: [
      { role: "For the client", party: "client" },
      { role: "Issued by", party: "firm" },
    ],
  },
  {
    key: "practical_completion_notice",
    label: "Notice of Practical Completion",
    category: "NOTICE",
    summary: "Records the date the works became usable, and what is outstanding.",
    counterpartyLabel: "Contractor",
    titleTemplate: "Practical completion — {{projectName}}",
    fields: [
      { key: "completionDate", label: "Date of practical completion", type: "date", required: true },
      { key: "inspectedOn", label: "Inspected on", type: "date" },
      { key: "outstandingWorks", label: "Outstanding works", type: "textarea", placeholder: "As listed in the snag list issued with this notice." },
      { key: "defectsPeriod", label: "Defects liability period", type: "text", placeholder: "12 months from the date of practical completion" },
      { key: "handoverItems", label: "To be handed over", type: "textarea", placeholder: "As-built drawings, warranties, operating manuals, keys and access cards." },
    ],
    body: [
      "To {{counterpartyName}},",
      "Following inspection on {{inspectedOn}}, practical completion of the works at {{projectName}}, {{projectAddress}} is certified as achieved on {{completionDate}}.",
      "The following remains outstanding and is to be completed without delay: {{outstandingWorks}}",
      "The defects liability period is {{defectsPeriod}}. During it you remain responsible for making good defects notified to you.",
      "Please hand over: {{handoverItems}}",
    ],
    signatures: [
      { role: "Certified by", party: "firm" },
      { role: "Received by", party: "counterparty" },
    ],
  },
  {
    key: "defects_notification",
    label: "Defects Notification",
    category: "NOTICE",
    summary: "Notifies defects within the liability period, with a date to fix them by.",
    counterpartyLabel: "Contractor",
    titleTemplate: "Defects notification — {{projectName}}",
    fields: [
      { key: "defects", label: "Defects", type: "textarea", required: true, placeholder: "One per line, with the location." },
      { key: "noticedOn", label: "Noticed on", type: "date" },
      { key: "rectifyBy", label: "To be made good by", type: "date", required: true },
      { key: "accessArrangements", label: "Access arrangements", type: "textarea" },
    ],
    body: [
      "To {{counterpartyName}},",
      "The following defects in the works at {{projectName}}, {{projectAddress}} were noticed on {{noticedOn}} and fall within the defects liability period: {{defects}}",
      "Please make these good by {{rectifyBy}}.",
      "Access: {{accessArrangements}}",
      "If they are not made good by that date the client reserves the right to have the work done by others and to recover the cost.",
    ],
    signatures: [{ role: "Issued by", party: "firm" }, { role: "Acknowledged by" }],
  },
  {
    key: "handover_letter",
    label: "Handover Letter",
    category: "NOTICE",
    summary: "Hands the finished works, and its paperwork, to the client.",
    titleTemplate: "Handover — {{projectName}}",
    fields: [
      { key: "handoverDate", label: "Handover date", type: "date", required: true },
      { key: "included", label: "Handed over", type: "textarea", required: true, placeholder: "Keys (3 sets), as-built drawings, warranties, operating manuals, the permit and the occupancy certificate." },
      { key: "outstanding", label: "Still outstanding", type: "textarea" },
      { key: "maintenanceNotes", label: "Maintenance the client should know about", type: "textarea" },
    ],
    body: [
      "Dear {{contactName}},",
      "The works at {{projectName}}, {{projectAddress}} are handed over to you on {{handoverDate}}.",
      "Handed over with this letter: {{included}}",
      "Outstanding items, which we continue to pursue: {{outstanding}}",
      "Maintenance worth noting: {{maintenanceNotes}}",
      "It has been a pleasure to work on this project. Please keep this letter with the project records.",
    ],
    signatures: [
      { role: "For {{firmName}}", party: "firm" },
      { role: "Received by", party: "client" },
    ],
  },
  {
    key: "suspension_notice",
    label: "Notice of Suspension",
    category: "NOTICE",
    summary: "Stops work, records why, and says what resuming depends on.",
    counterpartyLabel: OTHER_PARTY,
    titleTemplate: "Suspension of works — {{projectName}}",
    practiceNote: "Suspension has contractual consequences. Check the contract clause before issuing, and have your lawyer read it if money is in dispute.",
    fields: [
      { key: "suspensionDate", label: "Suspension takes effect", type: "date", required: true },
      { key: "reason", label: "Reason", type: "textarea", required: true },
      { key: "contractClause", label: "Contract clause relied on", type: "text" },
      { key: "resumeCondition", label: "What must happen to resume", type: "textarea", required: true },
      { key: "siteMeasures", label: "Measures while suspended", type: "textarea", placeholder: "Secure the site, protect completed work, maintain insurance." },
    ],
    body: [
      "To {{counterpartyName}},",
      "Works at {{projectName}}, {{projectAddress}} are suspended with effect from {{suspensionDate}} under {{contractClause}}.",
      "Reason: {{reason}}",
      "Work will resume when: {{resumeCondition}}",
      "While suspended: {{siteMeasures}}",
      "This notice is issued without prejudice to the parties' rights and remedies.",
    ],
    signatures: [
      { role: "For the client", party: "client" },
      { role: "Issued by", party: "firm" },
    ],
  },
  {
    key: "termination_notice",
    label: "Notice of Termination",
    category: "NOTICE",
    summary: "Ends an appointment or contract, on stated grounds.",
    counterpartyLabel: OTHER_PARTY,
    titleTemplate: "Termination — {{projectName}}",
    practiceNote:
      "Do not send this without your lawyer reading it. The grounds, the notice period and the clause have to be right or the termination itself becomes the dispute.",
    fields: [
      { key: "agreementRef", label: "Agreement being terminated", type: "text", required: true },
      { key: "grounds", label: "Grounds", type: "textarea", required: true },
      { key: "contractClause", label: "Clause relied on", type: "text" },
      { key: "terminationDate", label: "Termination takes effect", type: "date", required: true },
      { key: "obligations", label: "What each party must still do", type: "textarea", placeholder: "Hand over all drawings and records, demobilise the site, and submit a final account within 28 days." },
    ],
    body: [
      "To {{counterpartyName}},",
      "This is notice that {{agreementRef}} in respect of {{projectName}} is terminated with effect from {{terminationDate}}, under {{contractClause}}.",
      "Grounds: {{grounds}}",
      "Outstanding obligations: {{obligations}}",
      "Rights and remedies accrued before termination are reserved. Nothing in this notice is a waiver of any of them.",
    ],
    signatures: [
      { role: "For the client", party: "client" },
      { role: "Issued by", party: "firm" },
    ],
  },

  // ── LETTERS & TRANSMITTALS ───────────────────────────────────────────────
  {
    key: "transmittal_letter",
    label: "Letter of Transmittal",
    category: "CORRESPONDENCE",
    summary: "Says what is enclosed, why, and what the recipient should do with it.",
    counterpartyLabel: OTHER_PARTY,
    titleTemplate: "Transmittal {{reference}} — {{projectName}}",
    practiceNote: "For a drawing register use the Drawings transmittal; this is for mixed enclosures.",
    fields: [
      { key: "enclosures", label: "Enclosures", type: "textarea", required: true, placeholder: "One per line: description, revision, copies." },
      { key: "purpose", label: "Issued for", type: "select", required: true, options: ["Information", "Review and comment", "Approval", "Construction", "Tender", "Record", "Signature"] },
      { key: "actionRequired", label: "Action required", type: "textarea" },
      { key: "returnBy", label: "Return by", type: "date" },
      { key: "method", label: "Sent by", type: "select", options: ["By hand", "Email", "Courier", "Portal upload"] },
    ],
    body: [
      "To {{counterpartyName}},",
      "The following is issued to you for {{purpose}} in connection with {{projectName}}, {{projectAddress}}: {{enclosures}}",
      "Action required: {{actionRequired}}",
      "Please return your comments or the signed documents by {{returnBy}}. Sent {{method}}.",
      "Please acknowledge receipt.",
    ],
    signatures: [{ role: "Issued by", party: "firm" }, { role: "Received by" }],
  },
  {
    key: "cover_letter",
    label: "Cover Letter",
    category: "CORRESPONDENCE",
    summary: "A plain letter on the practice's letterhead, for anything else.",
    counterpartyLabel: OTHER_PARTY,
    titleTemplate: "{{subject}}",
    fields: [
      { key: "salutation", label: "Salutation", type: "text", placeholder: "Dear Mr Croes," },
      { key: "bodyText", label: "Letter", type: "textarea", required: true, help: "Write it as you would send it. One paragraph per line." },
      { key: "closing", label: "Closing", type: "text", placeholder: "Yours sincerely," },
    ],
    body: ["{{salutation}}", "{{bodyText}}", "{{closing}}"],
    signatures: [{ role: "For {{firmName}}", party: "firm" }],
  },
  {
    key: "permit_submission_letter",
    label: "Permit Submission Letter",
    category: "CORRESPONDENCE",
    summary: "The covering letter that goes in with a permit application.",
    counterpartyLabel: AUTHORITY,
    titleTemplate: "Permit submission — {{projectName}}",
    fields: [
      { key: "applicationType", label: "Application", type: "text", required: true, placeholder: "Building permit — new residence" },
      { key: "parcelNumber", label: "Parcel / meetbrief", type: "text" },
      { key: "documentsSubmitted", label: "Documents submitted", type: "textarea", required: true },
      { key: "feePaid", label: "Fee paid", type: "money" },
      { key: "contactForQueries", label: "Contact for queries", type: "text" },
    ],
    body: [
      "To {{counterpartyName}},",
      "On behalf of {{clientName}} we submit an application for {{applicationType}} in respect of the property at {{projectAddress}}, parcel {{parcelNumber}}.",
      "Submitted with this letter: {{documentsSubmitted}}",
      "The application fee of {{feePaid}} has been paid. Queries may be directed to {{contactForQueries}}.",
      "We would be grateful for confirmation of receipt and the request number allocated to the application.",
    ],
    signatures: [{ role: "For {{firmName}}", party: "firm" }],
  },
  {
    key: "progress_update_letter",
    label: "Client Progress Update",
    category: "CORRESPONDENCE",
    summary: "Where the project stands, what is next, what needs a decision.",
    titleTemplate: "Progress update — {{projectName}}",
    fields: [
      { key: "periodCovered", label: "Period covered", type: "text", required: true, placeholder: "1–15 SEP 2026" },
      { key: "completed", label: "Done in this period", type: "textarea", required: true },
      { key: "nextPeriod", label: "Next period", type: "textarea", required: true },
      { key: "decisionsNeeded", label: "Decisions needed from the client", type: "textarea" },
      { key: "risks", label: "Risks and issues", type: "textarea" },
      { key: "programmeStatus", label: "Programme", type: "text", placeholder: "On programme / 5 days behind, recovery planned" },
    ],
    body: [
      "Dear {{contactName}},",
      "Progress on {{projectName}} for {{periodCovered}}.",
      "Completed: {{completed}}",
      "Planned for the next period: {{nextPeriod}}",
      "Programme: {{programmeStatus}}",
      "Decisions we need from you: {{decisionsNeeded}}",
      "Risks and issues we are managing: {{risks}}",
    ],
    signatures: [{ role: "For {{firmName}}", party: "firm" }],
  },
  {
    key: "statement_of_account",
    label: "Statement of Account",
    category: "CORRESPONDENCE",
    summary: "What has been invoiced, what has been paid, what is outstanding.",
    titleTemplate: "Statement of account — {{clientName}}",
    practiceNote: "The figures are typed here; when the invoice register is live this letter can quote it.",
    fields: [
      { key: "asAt", label: "As at", type: "date", required: true },
      { key: "invoicesListed", label: "Invoices", type: "textarea", required: true, placeholder: "One per line: number, date, amount, paid, outstanding." },
      { key: "totalOutstanding", label: "Total outstanding", type: "money", required: true },
      { key: "oldestOverdue", label: "Oldest overdue item", type: "text" },
      { key: "paymentDetails", label: "Payment details", type: "textarea" },
    ],
    body: [
      "Dear {{contactName}},",
      "Statement of account for {{clientName}} as at {{asAt}}, in respect of {{projectName}}.",
      "{{invoicesListed}}",
      "Total outstanding: {{totalOutstanding}}. Oldest overdue item: {{oldestOverdue}}.",
      "Payment details: {{paymentDetails}}",
      "If any item is disputed, please tell us which and why, so the rest can be settled.",
    ],
    signatures: [{ role: "For {{firmName}}", party: "firm" }],
  },
  {
    key: "payment_reminder",
    label: "Payment Reminder",
    category: "CORRESPONDENCE",
    summary: "A firm, courteous reminder that an invoice is overdue.",
    titleTemplate: "Payment reminder — {{reference}}",
    fields: [
      { key: "invoiceNumber", label: "Invoice", type: "text", required: true },
      { key: "invoiceDate", label: "Invoice date", type: "date" },
      { key: "amountDue", label: "Amount due", type: "money", required: true },
      { key: "dueDate", label: "Was due", type: "date", required: true },
      { key: "daysOverdue", label: "Days overdue", type: "number" },
      { key: "paymentDetails", label: "Payment details", type: "textarea" },
    ],
    body: [
      "Dear {{contactName}},",
      "Our invoice {{invoiceNumber}} of {{invoiceDate}} for {{amountDue}} in respect of {{projectName}} was due on {{dueDate}} and is now {{daysOverdue}} days overdue.",
      "Payment details: {{paymentDetails}}",
      "If the invoice has been paid in the last few days, please accept our thanks and ignore this letter. If something about it is holding payment up, tell us what and we will deal with it.",
    ],
    signatures: [{ role: "For {{firmName}}", party: "firm" }],
  },
  {
    key: "lot_reservation_letter",
    label: "Lot Reservation Letter",
    category: "CORRESPONDENCE",
    summary: "Confirms a parcel is held for a buyer, on what terms and for how long.",
    counterpartyLabel: "Buyer",
    titleTemplate: "Reservation — {{reference}}",
    fields: [
      { key: "lotReference", label: "Lot / parcel", type: "text", required: true },
      { key: "development", label: "Development", type: "text", required: true },
      { key: "price", label: "Price", type: "money" },
      { key: "reservationFee", label: "Reservation fee", type: "money" },
      { key: "heldUntil", label: "Held until", type: "date", required: true },
      { key: "conditions", label: "Conditions", type: "textarea", placeholder: "The fee is credited against the purchase price, and is refundable only if the seller withdraws." },
      { key: "nextSteps", label: "Next steps", type: "textarea" },
    ],
    body: [
      "Dear {{counterpartyName}},",
      "This confirms that lot {{lotReference}} in {{development}} is reserved for you until {{heldUntil}}.",
      "Price: {{price}}. Reservation fee: {{reservationFee}}.",
      "Conditions: {{conditions}}",
      "Next steps: {{nextSteps}}",
      "The reservation lapses on the date above unless extended in writing.",
    ],
    signatures: [
      { role: "For {{firmName}}", party: "firm" },
      { role: "Accepted by", party: "counterparty" },
    ],
  },
  {
    key: "purchase_intent_letter",
    label: "Purchase Intent Letter",
    category: "CORRESPONDENCE",
    summary: "Tells a supplier an order is coming, so they can hold stock or capacity.",
    counterpartyLabel: SUPPLIER,
    titleTemplate: "Intent to purchase — {{counterpartyName}}",
    fields: [
      { key: "items", label: "Items", type: "textarea", required: true },
      { key: "quotationRef", label: "Your quotation", type: "text" },
      { key: "value", label: "Indicative value", type: "money" },
      { key: "orderExpected", label: "Order expected", type: "date" },
      { key: "deliveryRequired", label: "Delivery required", type: "text" },
    ],
    body: [
      "To {{counterpartyName}},",
      "Further to your quotation {{quotationRef}}, {{firmName}} intends to place an order for the following on {{projectName}}: {{items}}",
      "Indicative value {{value}}. We expect to issue the purchase order by {{orderExpected}}, with delivery required {{deliveryRequired}}.",
      "This letter is not an order and does not authorise you to manufacture, ship or incur cost. Please tell us now if holding stock or capacity carries a cost.",
    ],
    signatures: [{ role: "For {{firmName}}", party: "firm" }],
  },
];

/** Every entry, by key. */
export const CATALOGUE_BY_KEY: Record<string, CatalogueEntry> = Object.fromEntries(
  CATALOGUE.map((e) => [e.key, e]),
);

export function catalogueEntry(key: string): CatalogueEntry | null {
  return CATALOGUE_BY_KEY[key] ?? null;
}

/** The picker's grouping: category, in the catalogue's own order. */
export function catalogueByCategory(): { category: DocumentCategory; entries: CatalogueEntry[] }[] {
  const groups = new Map<DocumentCategory, CatalogueEntry[]>();
  for (const entry of CATALOGUE) {
    const list = groups.get(entry.category);
    if (list) list.push(entry);
    else groups.set(entry.category, [entry]);
  }
  return [...groups.entries()].map(([category, entries]) => ({ category, entries }));
}

/** The label a register shows for a stored key, even one no longer offered. */
export function docTypeLabel(key: string): string {
  return CATALOGUE_BY_KEY[key]?.label ?? key;
}
