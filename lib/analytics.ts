type EventParameters = Record<string, unknown>;
type PurchaseParameters = { transactionId: string; value: number; currency?: string };
type SearchParameters = { searchTerm: string; resultsCount?: number };
type LeadParameters = { source: string; value?: number; currency?: string };
type AnalyticsIntegration = "data_layer" | "ga4" | "meta" | "gtm";
type MetaEventName = "PageView" | "ViewContent" | "InitiateCheckout" | "Purchase" | "Search" | "Lead";

const ATTRIBUTION_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "gclid", "fbclid"] as const;
const ATTRIBUTION_STORAGE_KEY = "escalahub:analytics:attribution:v1";
const PURCHASE_STORAGE_PREFIX = "escalahub:analytics:purchase:";
const MAX_ATTRIBUTION_VALUE_LENGTH = 256;

type AttributionKey = (typeof ATTRIBUTION_KEYS)[number];
export type AttributionParameters = Partial<Record<AttributionKey, string>>;

type StoredAttribution = {
  firstTouch: AttributionParameters;
  lastTouch: AttributionParameters;
  landingPage: string;
};

export type AnalyticsProduct = {
  slug: string;
  title: string;
  price: number;
  currency: string;
  category?: string;
};

type QueuedMetaEvent = {
  name: MetaEventName;
  parameters?: EventParameters;
  eventId: string;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

function validEnvironmentValue(value: string | undefined, pattern: RegExp): string | undefined {
  const normalized = value?.trim();
  return normalized && pattern.test(normalized) ? normalized : undefined;
}

export const analyticsConfig = {
  googleAnalyticsId: validEnvironmentValue(process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID, /^G-[A-Z0-9]+$/i),
  googleTagManagerId: validEnvironmentValue(process.env.NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID, /^GTM-[A-Z0-9]+$/i),
  metaPixelId: validEnvironmentValue(process.env.NEXT_PUBLIC_META_PIXEL_ID, /^\d{5,20}$/),
} as const;

const { googleAnalyticsId, metaPixelId } = analyticsConfig;
const trackedPurchases = new Set<string>();
const pendingMetaEvents: QueuedMetaEvent[] = [];

function getDataLayer(): unknown[] | null {
  if (typeof window === "undefined") return null;

  try {
    if (!Array.isArray(window.dataLayer)) window.dataLayer = [];
    return window.dataLayer;
  } catch {
    return null;
  }
}

export function recordAnalyticsError(integration: AnalyticsIntegration, eventName: string): void {
  const dataLayer = getDataLayer();
  if (!dataLayer) return;

  try {
    dataLayer.push({
      event: "analytics_error",
      analytics_event: eventName,
      analytics_integration: integration,
    });
  } catch {
    // Analytics nunca pode interromper a jornada de compra.
  }
}

function pushDataLayer(event: Record<string, unknown>): boolean {
  const dataLayer = getDataLayer();
  if (!dataLayer) return false;

  try {
    dataLayer.push(event);
    return true;
  } catch {
    recordAnalyticsError("data_layer", String(event.event ?? "unknown"));
    return false;
  }
}

function sanitizeAttributionValue(value: string | null): string | undefined {
  const normalized = value?.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, MAX_ATTRIBUTION_VALUE_LENGTH);
  return normalized || undefined;
}

function readCurrentAttribution(): AttributionParameters {
  if (typeof window === "undefined") return {};
  const searchParams = new URLSearchParams(window.location.search);

  return ATTRIBUTION_KEYS.reduce<AttributionParameters>((parameters, key) => {
    const value = sanitizeAttributionValue(searchParams.get(key));
    if (value) parameters[key] = value;
    return parameters;
  }, {});
}

function readStoredAttribution(): StoredAttribution | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = window.sessionStorage.getItem(ATTRIBUTION_STORAGE_KEY);
    if (!stored) return null;
    const parsed = JSON.parse(stored) as Partial<StoredAttribution>;
    if (!parsed.firstTouch || !parsed.lastTouch || typeof parsed.landingPage !== "string") return null;
    return {
      firstTouch: parsed.firstTouch,
      lastTouch: parsed.lastTouch,
      landingPage: parsed.landingPage,
    };
  } catch {
    return null;
  }
}

export function captureAttribution(): AttributionParameters {
  if (typeof window === "undefined") return {};

  const current = readCurrentAttribution();
  const stored = readStoredAttribution();
  const hasCurrentAttribution = Object.keys(current).length > 0;
  const firstTouch = stored?.firstTouch ?? current;
  const lastTouch = hasCurrentAttribution ? { ...(stored?.lastTouch ?? {}), ...current } : (stored?.lastTouch ?? current);
  const attribution: StoredAttribution = {
    firstTouch,
    lastTouch,
    landingPage: stored?.landingPage ?? window.location.pathname,
  };

  try {
    window.sessionStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(attribution));
  } catch {
    // Os eventos continuam com os parâmetros disponíveis na URL atual.
  }

  return lastTouch;
}

export function getAttributionParameters(): AttributionParameters {
  if (typeof window === "undefined") return {};
  return readStoredAttribution()?.lastTouch ?? readCurrentAttribution();
}

function createEventId(eventName: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${eventName}-${crypto.randomUUID()}`;
  }
  return `${eventName}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getProductParameters(product: AnalyticsProduct) {
  return {
    content_category: product.category,
    content_ids: [product.slug],
    content_name: product.title,
    content_type: "product",
    currency: product.currency,
    value: product.price,
  };
}

function getGoogleItem(product: AnalyticsProduct, price = product.price) {
  return {
    item_category: product.category,
    item_id: product.slug,
    item_name: product.title,
    price,
    quantity: 1,
  };
}

function sendGoogleEvent(name: string, parameters: EventParameters): void {
  if (!googleAnalyticsId || typeof window === "undefined") return;

  try {
    const dataLayer = getDataLayer();
    if (!dataLayer) throw new Error("Data Layer indisponível");
    window.gtag = window.gtag || ((...args: unknown[]) => dataLayer.push(args));
    window.gtag("event", name, parameters);
  } catch {
    recordAnalyticsError("ga4", name);
  }
}

function queueMetaEvent(event: QueuedMetaEvent): void {
  const duplicate = pendingMetaEvents.some(({ eventId }) => eventId === event.eventId);
  if (!duplicate) pendingMetaEvents.push(event);
}

function sendMetaEvent(name: MetaEventName, parameters: EventParameters | undefined, eventId: string): void {
  if (!metaPixelId || typeof window === "undefined") return;

  if (!window.fbq) {
    queueMetaEvent({ name, parameters, eventId });
    return;
  }

  try {
    window.fbq("track", name, parameters, { eventID: eventId });
  } catch {
    queueMetaEvent({ name, parameters, eventId });
    recordAnalyticsError("meta", name);
  }
}

export function flushPendingMetaEvents(): void {
  if (typeof window === "undefined" || !window.fbq) return;

  while (pendingMetaEvents.length > 0) {
    const event = pendingMetaEvents.shift();
    if (!event) return;
    try {
      window.fbq("track", event.name, event.parameters, { eventID: event.eventId });
    } catch {
      pendingMetaEvents.unshift(event);
      recordAnalyticsError("meta", event.name);
      return;
    }
  }
}

function dispatchCommerceEvent(
  ga4EventName: "view_item" | "begin_checkout" | "purchase",
  metaEventName: "ViewContent" | "InitiateCheckout" | "Purchase",
  product: AnalyticsProduct,
  options: { eventId: string; transactionId?: string; value?: number },
): boolean {
  const attribution = getAttributionParameters();
  const value = options.value ?? product.price;
  const item = getGoogleItem(product, value);
  const ecommerce = {
    currency: product.currency,
    items: [item],
    value,
    ...(options.transactionId ? { transaction_id: options.transactionId } : {}),
  };
  const metaParameters = { ...getProductParameters(product), ...attribution, value };
  const dataLayerDispatched = pushDataLayer({
    event: ga4EventName,
    event_id: options.eventId,
    ...attribution,
    ecommerce,
  });

  sendGoogleEvent(ga4EventName, { ...ecommerce, ...attribution });
  sendMetaEvent(metaEventName, metaParameters, options.eventId);
  return dataLayerDispatched;
}

export function trackPageView(pathname: string): void {
  if (typeof window === "undefined") return;
  const attribution = captureAttribution();
  const eventId = createEventId("page_view");
  const pageParameters = {
    ...attribution,
    page_location: `${window.location.origin}${pathname}`,
    page_path: pathname,
    page_title: document.title,
  };

  pushDataLayer({ event: "page_view", event_id: eventId, ...pageParameters });
  sendGoogleEvent("page_view", pageParameters);
  sendMetaEvent("PageView", attribution, eventId);
}

export function trackViewContent(product: AnalyticsProduct): void {
  dispatchCommerceEvent("view_item", "ViewContent", product, { eventId: createEventId("view_item") });
}

export function trackInitiateCheckout(product: AnalyticsProduct): void {
  dispatchCommerceEvent("begin_checkout", "InitiateCheckout", product, { eventId: createEventId("begin_checkout") });
}

export function trackPurchase(product: AnalyticsProduct, { transactionId, value, currency = product.currency }: PurchaseParameters): void {
  if (typeof window === "undefined" || !transactionId || value <= 0) return;
  if (trackedPurchases.has(transactionId)) return;

  const storageKey = `${PURCHASE_STORAGE_PREFIX}${transactionId}`;
  try {
    if (window.localStorage.getItem(storageKey)) return;
  } catch {
    // O Set em memória ainda evita duplicidade durante a sessão atual.
  }

  const dispatched = dispatchCommerceEvent(
    "purchase",
    "Purchase",
    { ...product, currency },
    { eventId: transactionId, transactionId, value },
  );
  if (!dispatched) return;

  trackedPurchases.add(transactionId);
  try {
    window.localStorage.setItem(storageKey, "1");
  } catch {
    // O evento já foi enviado e permanece deduplicado durante a sessão atual.
  }
}

export function trackSearch({ searchTerm, resultsCount }: SearchParameters): void {
  const normalizedSearchTerm = searchTerm.trim().slice(0, 100);
  if (!normalizedSearchTerm) return;
  const attribution = getAttributionParameters();
  const eventId = createEventId("search");
  const parameters = {
    ...attribution,
    search_term: normalizedSearchTerm,
    ...(typeof resultsCount === "number" ? { results_count: resultsCount } : {}),
  };

  pushDataLayer({ event: "search", event_id: eventId, ...parameters });
  sendGoogleEvent("search", parameters);
  sendMetaEvent("Search", { ...attribution, search_string: normalizedSearchTerm }, eventId);
}

export function trackLead({ source, value, currency = "BRL" }: LeadParameters): void {
  const normalizedSource = source.trim().slice(0, 100);
  if (!normalizedSource) return;
  const attribution = getAttributionParameters();
  const eventId = createEventId("generate_lead");
  const parameters = {
    ...attribution,
    currency,
    lead_source: normalizedSource,
    ...(typeof value === "number" ? { value } : {}),
  };

  pushDataLayer({ event: "generate_lead", event_id: eventId, ...parameters });
  sendGoogleEvent("generate_lead", parameters);
  sendMetaEvent("Lead", parameters, eventId);
}

export function trackRouteChange(pathname: string): void {
  trackPageView(pathname);
}
