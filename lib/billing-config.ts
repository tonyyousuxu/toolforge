/**
 * Billing constants — client-safe (no next/headers, no Stripe).
 * Import from here in client components (e.g. pricing page).
 */

export interface ProPlanFeature {
  key: string;
  label: string;
  free: string | boolean;
  pro: string | boolean;
  highlight?: boolean;
}

export const PRO_PRICE_MONTHLY_USD = 9;

export const PRO_FEATURE_MATRIX: ProPlanFeature[] = [
  { key: "ops", label: "Operations per day", free: "3", pro: "1,000", highlight: true },
  { key: "upload", label: "File upload size cap", free: "10 MB", pro: "50 MB", highlight: true },
  { key: "queue", label: "Processing priority", free: "Standard queue", pro: "Priority queue" },
  { key: "ads", label: "Advertising", free: true, pro: false },
  { key: "saved", label: "Saved results (within TTL)", free: "0", pro: "Unlimited" },
  { key: "batch", label: "Batch / multi-file tools", free: "First file only", pro: "Full batch" },
];
