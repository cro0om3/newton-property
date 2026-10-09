export type CardRow = {
  id: string;
  chat_jid: string;
  sender_name: string | null;
  sender_phone: string | null;
  kind: string;
  purpose: string | null;
  property_type: string | null;
  title: string | null;
  city: string | null;
  area: string | null;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  summary: string | null;
  extra: string | null;
  confidence: number | null;
  status: string;
  broker: string | null;
  supplier_id: string | null;
  next_follow_up: number | null;
  created_at: number;
  updated_at: number;
  cover: string | null;
};

export type FollowUp = {
  id: string;
  card_id: string;
  note: string;
  broker: string | null;
  created_at: number;
};

export type MessageRow = {
  id: string;
  chat_jid: string;
  sender_name: string | null;
  sender_phone: string | null;
  from_me: number;
  body: string | null;
  message_type: string;
  media_file: string | null;
  media_mime: string | null;
  latitude: number | null;
  longitude: number | null;
  timestamp: number;
  processed: number;
  created_at: number;
};

export type ChatRow = {
  jid: string;
  name: string | null;
  phone: string | null;
  is_group: number;
  last_message_at: number | null;
  last_preview: string | null;
  avatar?: string | null;
  company_name?: string | null;
  company_logo?: string | null;
  listings?: number;
};

export type ExtractedCard = {
  match_card_id: string | null;
  kind: "listing" | "inquiry";
  purpose: "sale" | "rent" | "buy" | "seek_rent";
  property_type:
    | "villa"
    | "apartment"
    | "land"
    | "office"
    | "warehouse"
    | "townhouse"
    | "building"
    | "other";
  title: string;
  city: string | null;
  area: string | null;
  price: number | null;
  currency: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  size_sqm: number | null;
  summary: string;
  confidence: number;
  needs_review: boolean;
  details: {
    unit: string | null;
    floor: string | null;
    parking: string | null;
    view: string | null;
    furnished: boolean | null;
    handover: string | null;
    plot: string | null;
    planLabel: string | null;
    maid: boolean | null;
    storeys: string | null;
    unitCount: string | null;
    plans: { name: string; price: number }[];
  };
};

export type PaymentRow = {
  label: string;
  percent: string | null;
  date: string | null;
  amount: number;
};

export type PaymentPlan = {
  name: string;
  price: number;
  discountedPrice?: number | null;
  dldFee?: number | null;
  adminFee?: number | null;
  rows: PaymentRow[];
};

export type CardExtra = {
  unit?: string | null;
  floor?: string | null;
  parking?: string | null;
  view?: string | null;
  furnished?: boolean | null;
  handover?: string | null;
  planLabel?: string | null;
  plot?: string | null;
  maid?: boolean | null;
  storeys?: string | null;
  unitCount?: string | null;
  priceLog?: { at: number; from: number; to: number }[];
  offSheet?: number | null;
  reference?: string | null;
  plans?: PaymentPlan[];
};

export type CardFilters = {
  kind?: string;
  propertyType?: string;
  purpose?: string;
  status?: string;
  q?: string;
  supplierId?: string;
  developerId?: string;
  broker?: string;
  limit?: number;
};

export type DeveloperRow = {
  id: string;
  name: string;
  logo: string | null;
  employees: number;
  listings: number;
};

export type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  company_id: string | null;
  company_name: string | null;
  company_logo?: string | null;
  chat_jid: string | null;
  listings: number;
};
