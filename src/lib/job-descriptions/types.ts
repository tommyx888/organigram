export type JobDescriptionStatus = "draft" | "review" | "approved" | "effective";

export type JobDescriptionRecord = {
  id: string;
  positionCode: string;
  positionTitle: string;
  responsibilities: string;
  requirements: string;
  kpi: string;
  version: number;
  status: JobDescriptionStatus;
  updatedAt: string;
};
