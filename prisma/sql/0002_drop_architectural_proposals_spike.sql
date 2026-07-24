-- Drop the ArchitecturalProposal spike.
--
-- Context: a throwaway spike on 2026-07-24 created `architectural_proposals` (plus two
-- enums) and pushed them to the live database before the Service Proposal module was
-- specified. The spike is superseded by docs/proposal-module/05-DATA-MODEL.md §1A
-- (`ServiceProposal`). The table was never referenced by any deployed code and is empty.
--
-- Applied with a runtime guard that refuses to execute if the table contains any rows.
-- Deliberately surgical: `prisma db push --accept-data-loss` would drop anything else that
-- had drifted from the schema, which is the risk called out in 03-CRITICAL-REVIEW.md §A7.

DROP TABLE IF EXISTS public.architectural_proposals;
DROP TYPE IF EXISTS public."ArchProposalStatus";
DROP TYPE IF EXISTS public."ArchFeeBasis";
