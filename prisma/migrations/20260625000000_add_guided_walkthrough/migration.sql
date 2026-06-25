-- Guided NEPQ diagnosis walkthrough (homeowner-facing) + captured own-words answers.
-- Both nullable JSON; the structured clinical field is unchanged.
ALTER TABLE "Inspection" ADD COLUMN "aiDiagnosisWalkthrough" JSONB;
ALTER TABLE "Inspection" ADD COLUMN "homeownerWalkthroughAnswers" JSONB;
