/**
 * Forms — reusable site/administration form templates (RFI, Site Instruction,
 * Inspection Request, Variation Order, etc.). Placeholder library; live version
 * stores firm-owned, versioned form templates that can be issued per project.
 */

export type FormCategory = "Site Administration" | "Quality" | "Commercial" | "Safety";
export type FormFileType = "PDF" | "DOCX" | "XLSX";

export type FormItem = {
  id: string;
  code: string;
  name: string;
  category: FormCategory;
  fileType: FormFileType;
  revision: string;
  fields: number;
  updatedAt: string;
  description: string;
};

export const FORM_CATEGORIES: FormCategory[] = ["Site Administration", "Quality", "Commercial", "Safety"];

export const FORMS: FormItem[] = [
  { id: "f-rfi", code: "RFI", name: "Request for Information", category: "Site Administration", fileType: "PDF", revision: "R3", fields: 12, updatedAt: "2026-05-18", description: "Query to the design team requiring clarification before proceeding." },
  { id: "f-si", code: "SI", name: "Site Instruction", category: "Site Administration", fileType: "PDF", revision: "R2", fields: 10, updatedAt: "2026-04-30", description: "Instruction issued to the contractor on site." },
  { id: "f-mom", code: "MOM", name: "Meeting Minutes", category: "Site Administration", fileType: "DOCX", revision: "R4", fields: 14, updatedAt: "2026-06-02", description: "Record of attendees, decisions and actions from a project meeting." },
  { id: "f-dsr", code: "DSR", name: "Daily Site Report", category: "Site Administration", fileType: "PDF", revision: "R5", fields: 18, updatedAt: "2026-06-10", description: "Daily log of labour, plant, weather and progress." },
  { id: "f-ir", code: "IR", name: "Inspection Request", category: "Quality", fileType: "PDF", revision: "R3", fields: 11, updatedAt: "2026-05-22", description: "Request for the consultant to inspect completed works." },
  { id: "f-ms", code: "MS", name: "Material Submittal", category: "Quality", fileType: "PDF", revision: "R2", fields: 13, updatedAt: "2026-04-12", description: "Submission of materials/products for approval before procurement." },
  { id: "f-snag", code: "SNAG", name: "Snag / Defect List", category: "Quality", fileType: "XLSX", revision: "R1", fields: 8, updatedAt: "2026-06-12", description: "Schedule of defects to be rectified before handover." },
  { id: "f-ncr", code: "NCR", name: "Non-Conformance Report", category: "Quality", fileType: "PDF", revision: "R2", fields: 12, updatedAt: "2026-03-28", description: "Record of work not conforming to specification and corrective action." },
  { id: "f-vo", code: "VO", name: "Variation Order", category: "Commercial", fileType: "PDF", revision: "R3", fields: 15, updatedAt: "2026-05-05", description: "Instruction varying the scope, with cost and time impact." },
  { id: "f-pa", code: "PA", name: "Payment Application", category: "Commercial", fileType: "XLSX", revision: "R4", fields: 20, updatedAt: "2026-06-08", description: "Interim/final application for payment against the contract sum." },
  { id: "f-ho", code: "HO", name: "Handover Certificate", category: "Commercial", fileType: "PDF", revision: "R1", fields: 9, updatedAt: "2026-02-20", description: "Certifies practical completion and handover to the client." },
  { id: "f-tbt", code: "TBT", name: "Toolbox Talk Record", category: "Safety", fileType: "PDF", revision: "R2", fields: 7, updatedAt: "2026-05-15", description: "Record of a short safety briefing and attendees." },
  { id: "f-ptw", code: "PTW", name: "Permit to Work", category: "Safety", fileType: "PDF", revision: "R3", fields: 16, updatedAt: "2026-06-01", description: "Authorisation for high-risk activities (hot work, confined space, etc.)." },
  { id: "f-inc", code: "INC", name: "Incident / Accident Report", category: "Safety", fileType: "DOCX", revision: "R2", fields: 17, updatedAt: "2026-04-19", description: "Record and investigation of a site incident or near-miss." },
];

export async function getForms(): Promise<FormItem[]> {
  return FORMS;
}
