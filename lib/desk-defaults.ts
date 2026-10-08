export const PIPELINE_KEYS = ["new", "contacted", "viewing", "offer", "closed", "needs_review"] as const;

export type PipelineKey = (typeof PIPELINE_KEYS)[number];

export type DeskSettings = {
  officeName: string;
  officePhone: string;
  logo: string;
  defaultCity: string;
  currency: string;
  timezone: string;
  brokers: string[];
  defaultBroker: string;
  historyDays: number;
  analyzeHours: number;
  mediaDays: number;
  sortingEnabled: boolean;
  reviewIfMissingPrice: boolean;
  reviewIfMissingLocation: boolean;
  reviewConfidence: number;
  budgetPercent: number;
  pipelineLabels: Record<PipelineKey, string>;
};

export const DEFAULT_SETTINGS: DeskSettings = {
  officeName: "Newton Property",
  officePhone: "",
  logo: "/newton-logo.png",
  defaultCity: "Dubai",
  currency: "AED",
  timezone: "Asia/Dubai",
  brokers: [],
  defaultBroker: "",
  historyDays: 180,
  analyzeHours: 24,
  mediaDays: 30,
  sortingEnabled: true,
  reviewIfMissingPrice: true,
  reviewIfMissingLocation: true,
  reviewConfidence: 0.55,
  budgetPercent: 15,
  pipelineLabels: {
    new: "New",
    contacted: "Contacted",
    viewing: "Viewing",
    offer: "Offer",
    closed: "Closed",
    needs_review: "Needs review",
  },
};

export const SETTINGS_EVENT = "desk-settings";
