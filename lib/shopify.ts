// Shopify origin product catalog for the admin panel.
// Fetches products.json (paginated, 250/page) from the origin store,
// cached 5 min in memory. Used so the admin can SEE the store's products
// and pick one to override — not just type a handle blind.

export interface CatalogProduct {
  handle: string;
  title: string;
  price_cents: number | null;
  compare_price_cents: number | null;
  image_url: string | null;
  vendor: string | null;
}

const ORIGIN = "https://omotenashitcg.com";
let cache: { at: number; products: CatalogProduct[] } | null = null;

async function fetchPage(page: number): Promise<any[]> {
  const r = await fetch(`${ORIGIN}/products.json?limit=250&page=${page}`, {
    headers: { accept: "application/json", "user-agent": "OmotenashiAdmin/1.0" },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) return [];
  const data = await r.json().catch(() => null);
  return data?.products ?? [];
}

export async function getCatalog(): Promise<CatalogProduct[]> {
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.products;
  const products: CatalogProduct[] = [];
  // Cap at 40 pages (10,000 products) to bound fetch time.
  for (let page = 1; page <= 40; page++) {
    const batch = await fetchPage(page);
    if (!batch.length) break;
    for (const p of batch) {
      const v = p.variants?.[0];
      products.push({
        handle: p.handle ?? "",
        title: p.title ?? "",
        price_cents: v?.price != null ? Math.round(parseFloat(v.price) * 100) : null,
        compare_price_cents: v?.compare_at_price != null ? Math.round(parseFloat(v.compare_at_price) * 100) : null,
        image_url: p.images?.[0]?.src ?? null,
        vendor: p.vendor ?? null,
      });
    }
    if (batch.length < 250) break;
  }
  cache = { at: Date.now(), products };
  return products;
}
