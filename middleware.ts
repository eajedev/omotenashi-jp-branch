import { NextRequest, NextResponse } from "next/server";

// The vendor's own live store — the Japan branch serves it verbatim,
// plus the entry notice and SEO corrections below.
const ORIGIN = "https://omotenashitcg.com";

// ── Branch admin config ──────────────────────────────────────────────
// Admin-managed data (product overrides, payment methods, settings) lives
// in Postgres and is served by /api/branch-config (Node.js runtime — the
// Edge middleware cannot import `pg` directly). Fetched once per request
// at most, cached 60s in memory. Fail-open: any error → defaults.
interface BranchConfig {
  overrides: Array<{ handle: string; title: string | null; price_cents: number | null; compare_price_cents: number | null; description: string | null; badge: string | null; hidden: boolean }>;
  branchProducts: Array<{ id: number; handle: string; title: string; price_cents: number; compare_price_cents: number | null; description: string | null; image_url: string | null; badge: string | null; active: boolean }>;
  payments: Array<{ key: string; name: string; enabled: boolean; details: string | null; sort_order: number }>;
  settings: Record<string, string>;
}
const DEFAULT_CONFIG: BranchConfig = { overrides: [], branchProducts: [], payments: [], settings: {} };
let cfgCache: { at: number; cfg: BranchConfig } | null = null;
async function getBranchConfig(req: NextRequest): Promise<BranchConfig> {
  if (cfgCache && Date.now() - cfgCache.at < 60000) return cfgCache.cfg;
  try {
    const proto = req.headers.get("x-forwarded-proto") || "https";
    const host = req.headers.get("host") || "omotenashitcgjapan.com";
    const r = await fetch(`${proto}://${host}/api/branch-config`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });
    if (r.ok) {
      const cfg = (await r.json()) as BranchConfig;
      cfgCache = { at: Date.now(), cfg };
      return cfg;
    }
  } catch { /* fail-open */ }
  return cfgCache?.cfg ?? DEFAULT_CONFIG;
}
// Enabled payment method display names, in admin sort order.
// Falls back to the built-in list when the DB has no methods configured.
function enabledMethods(cfg: BranchConfig): string[] {
  const names = cfg.payments.filter((p) => p.enabled).sort((a, b) => a.sort_order - b.sort_order).map((p) => p.name);
  return names.length ? names : ["Wise", "CashApp", "Credit Card", "Bank Transfer", "Chime", "PayPal"];
}
// WhatsApp number from settings (digits only). Falls back to the built-in number.
function waNumber(cfg: BranchConfig): string {
  const raw = cfg.settings.whatsapp_number || "";
  const digits = raw.replace(/\D/g, "");
  return digits || "18179694115";
}



// Hero slideshow "Order Now" buttons: every product slide gets an overlay
// button that adds the product to cart and jumps straight to the order page.
const SLIDE_ORDER = `<script>
(function(){
  var slides = document.querySelectorAll('a.slideshow__slide[href*="/products/"]');
  if (!slides.length) return;
  slides.forEach(function(slide){
    var m = slide.getAttribute('href').match(/\\/products\\/([a-z0-9\\-]+)/i);
    if (!m || slide.querySelector('.omjpn-slide-order')) return;
    var handle = m[1];
    fetch('/products/' + handle + '.js')
      .then(function(r){ return r.json(); })
      .then(function(p){
        if (!p.variants || !p.variants.length || slide.querySelector('.omjpn-slide-order')) return;
        var vid = p.variants[0].id;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'omjpn-slide-order';
        btn.textContent = 'Order Now';
        btn.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          window.location.href = '/cart/add?id=' + vid + '&quantity=1&return_to=' + encodeURIComponent('/checkout');
        });
        slide.style.position = 'relative';
        slide.appendChild(btn);
      })
      .catch(function(){});
  });
})();
</scr` + `ipt>
<style>
  .omjpn-slide-order{
    position:absolute; bottom:52px; left:50%; transform:translateX(-50%);
    background:#e63946; color:#fff; border:none; cursor:pointer;
    font-weight:800; font-size:15px; letter-spacing:.02em;
    padding:13px 36px; border-radius:999px;
    box-shadow:0 6px 20px rgba(0,0,0,.35); z-index:5;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
    white-space:nowrap;
  }
  .omjpn-slide-order:active{ transform:translateX(-50%) scale(.96); }
</style>`;

// Floating WhatsApp widget — attention-grabbing, links to the store's WhatsApp.
const WA_WIDGET = `<a id="omjpn-wa-widget" href="https://wa.me/18179694115?text=Hello%20Omotenashi%20TCG%20Japan%20Branch%21%20I%20have%20a%20question." target="_blank" rel="noopener" aria-label="Chat with us on WhatsApp">
  <span class="omjpn-wa-ring"></span>
  <span class="omjpn-wa-ring omjpn-wa-ring2"></span>
  <svg viewBox="0 0 24 24" width="30" height="30" fill="#ffffff" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
  <span class="omjpn-wa-label">Chat with us!</span>
</a>
<style>
  #omjpn-wa-widget{
    position:fixed; left:18px; bottom:24px; z-index:99990;
    width:60px; height:60px; border-radius:50%;
    background:#25D366; display:flex; align-items:center; justify-content:center;
    box-shadow:0 6px 20px rgba(37,211,102,.45);
    text-decoration:none;
  }
  #omjpn-wa-widget .omjpn-wa-ring{
    position:absolute; inset:0; border-radius:50%;
    border:3px solid #25D366; opacity:.7;
    animation:omjpn-wa-pulse 2s ease-out infinite;
    pointer-events:none;
  }
  #omjpn-wa-widget .omjpn-wa-ring2{ animation-delay:1s; }
  @keyframes omjpn-wa-pulse{
    0%{ transform:scale(1); opacity:.7; }
    100%{ transform:scale(1.6); opacity:0; }
  }
  #omjpn-wa-widget .omjpn-wa-label{
    position:absolute; left:70px; top:50%; transform:translateY(-50%);
    background:#141414; color:#fff; font-size:13px; font-weight:600;
    padding:8px 14px; border-radius:999px; white-space:nowrap;
    opacity:0; transition:opacity .3s; pointer-events:none;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  }
  #omjpn-wa-widget:hover .omjpn-wa-label{ opacity:1; }
  @media (prefers-reduced-motion:reduce){
    #omjpn-wa-widget .omjpn-wa-ring{ animation:none; }
  }
</style>`;

// Japan-branch entry notice, injected before </body> of every HTML page.
// Shown once per visit (sessionStorage), Japanese first / English second.
const NOTICE = `<div id="omjpn-overlay" hidden>
  <div id="omjpn-card" role="dialog" aria-modal="true" aria-labelledby="omjpn-title">
    <p id="omjpn-eyebrow">日本支店 &nbsp;·&nbsp; JAPAN BRANCH</p>
    <h2 id="omjpn-title">ようこそ</h2>
    <p id="omjpn-body-ja">こちらはミシガン州にある <strong>Omotenashi TCG</strong> の日本支店です。</p>
    <p id="omjpn-body-en">You are shopping at the <strong>Japanese branch</strong> of Omotenashi&nbsp;TCG here in Michigan, USA.</p>
    <button id="omjpn-close" type="button">閉じる &nbsp;·&nbsp; Close</button>
  </div>
</div>
<style>
  #omjpn-overlay{
    position:fixed; inset:0; z-index:99999;
    display:flex; align-items:center; justify-content:center;
    padding:20px; background:rgba(15,15,18,.55);
    -webkit-backdrop-filter:blur(2px); backdrop-filter:blur(2px);
    opacity:0; transition:opacity .25s ease;
  }
  #omjpn-overlay[hidden]{ display:none; }
  #omjpn-overlay.omjpn-show{ opacity:1; }
  #omjpn-card{
    max-width:420px; width:100%;
    background:#fff; color:#141414;
    border:1px solid #e2e2e2; border-radius:10px;
    padding:32px 28px 28px; text-align:center;
    box-shadow:0 24px 60px rgba(0,0,0,.25);
    transform:translateY(8px); transition:transform .25s ease;
    font-family:-apple-system,BlinkMacSystemFont,"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;
  }
  #omjpn-overlay.omjpn-show #omjpn-card{ transform:translateY(0); }
  #omjpn-eyebrow{
    margin:0 0 10px; font-size:11px; letter-spacing:.22em;
    color:#8a8a8a; font-weight:600;
  }
  #omjpn-title{ margin:0 0 12px; font-size:30px; font-weight:700; letter-spacing:.04em; }
  #omjpn-body-ja{ margin:0 0 6px; font-size:16px; line-height:1.7; }
  #omjpn-body-en{ margin:0 0 22px; font-size:13.5px; line-height:1.6; color:#555; }
  #omjpn-close{
    appearance:none; border:1px solid #141414; background:#141414; color:#fff;
    border-radius:999px; padding:12px 34px; font-size:14px; font-weight:600;
    cursor:pointer; letter-spacing:.04em;
  }
  #omjpn-close:hover{ background:#000; }
  #omjpn-close:focus-visible{ outline:2px solid #141414; outline-offset:3px; }
  @media (prefers-reduced-motion:reduce){
    #omjpn-overlay, #omjpn-card{ transition:none; }
  }
</style>
<script>
(function(){
  var KEY = 'omjpn-notice-seen';
  try { if (sessionStorage.getItem(KEY) === '1') return; } catch(e){}

  var overlay = document.getElementById('omjpn-overlay');
  var closeBtn = document.getElementById('omjpn-close');

  function close(){
    overlay.classList.remove('omjpn-show');
    try { sessionStorage.setItem(KEY, '1'); } catch(e){}
    setTimeout(function(){ overlay.hidden = true; }, 260);
  }

  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', function(e){ if (e.target === overlay) close(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });

  // Show shortly after the page starts rendering so it reads as a
  // welcome, not a block (no waiting on images — this runs at end of body)
  setTimeout(function(){
    overlay.hidden = false;
    requestAnimationFrame(function(){ overlay.classList.add('omjpn-show'); });
    closeBtn.focus({ preventScroll:true });
  }, 600);
})();
</script>`;

// WhatsApp ordering: replaces Shopify checkout on the branch.
// The vendor's WhatsApp number goes in WA_NUMBER below.
const WA_SCRIPT = `<script>(function(){
  var WA_NUMBER = "18179694115";
  var METHODS = ["Wise", "CashApp", "Credit Card", "Bank Transfer", "Chime", "PayPal"];
  var LOGOS = {
    "Wise": '<svg width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Wise"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><g transform="translate(5,8) scale(0.33)" fill="#9FE870"><path d="M6.488 7.469 0 15.05h11.585l1.301-3.576H7.922l3.033-3.507.01-.092L8.993 4.48h8.873l-6.878 18.925h4.706L24 .595H2.543l3.945 6.874Z"/></g><text x="15" y="16" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="800" fill="#163300">Wise</text></svg>',
    "CashApp": '<svg width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Cash App"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><g transform="translate(9,2) scale(0.8333)" fill="#00C244"><path d="M23.59 3.475a5.1 5.1 0 00-3.05-3.05c-1.31-.42-2.5-.42-4.92-.42H8.36c-2.4 0-3.61 0-4.9.4a5.1 5.1 0 00-3.05 3.06C0 4.765 0 5.965 0 8.365v7.27c0 2.41 0 3.6.4 4.9a5.1 5.1 0 003.05 3.05c1.3.41 2.5.41 4.9.41h7.28c2.41 0 3.61 0 4.9-.4a5.1 5.1 0 003.06-3.06c.41-1.3.41-2.5.41-4.9v-7.25c0-2.41 0-3.61-.41-4.91zm-6.17 4.63l-.93.93a.5.5 0 01-.67.01 5 5 0 00-3.22-1.18c-.97 0-1.94.32-1.94 1.21 0 .9 1.04 1.2 2.24 1.65 2.1.7 3.84 1.58 3.84 3.64 0 2.24-1.74 3.78-4.58 3.95l-.26 1.2a.49.49 0 01-.48.39H9.63l-.09-.01a.5.5 0 01-.38-.59l.28-1.27a6.54 6.54 0 01-2.88-1.57v-.01a.48.48 0 010-.68l1-.97a.49.49 0 01.67 0c.91.86 2.13 1.34 3.39 1.32 1.3 0 2.17-.55 2.17-1.42 0-.87-.88-1.1-2.54-1.72-1.76-.63-3.43-1.52-3.43-3.6 0-2.42 2.01-3.6 4.39-3.71l.25-1.23a.48.48 0 01.48-.38h1.78l.1.01c.26.06.43.31.37.57l-.27 1.37c.9.3 1.75.77 2.48 1.39l.02.02c.19.2.19.5 0 .68z"/></g></svg>',
    "Credit Card": '<svg width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Credit Card"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><rect x="8" y="7" width="22" height="10" rx="2" fill="#1a1f36"/><rect x="8" y="9.6" width="22" height="2.6" fill="#ffffff" opacity="0.9"/></svg>',
    "Bank Transfer": '<svg width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Bank Transfer"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><path d="M19 6 L28 12 H10 Z" fill="#2f6fed"/><rect x="12" y="13" width="2.5" height="5" fill="#2f6fed"/><rect x="17.75" y="13" width="2.5" height="5" fill="#2f6fed"/><rect x="23.5" y="13" width="2.5" height="5" fill="#2f6fed"/><rect x="10" y="18.6" width="18" height="1.8" fill="#2f6fed"/></svg>',
    "Chime": '<svg width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Chime"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><g transform="translate(4,7.75) scale(0.192)"><g transform="translate(123.89757,-60.126245)" fill="#1ec677"><path d="m 448.6,56.1001 c -11.8,0 -25.9,4.2 -39.4,18.8 -13.5,-14.6 -27.7,-18.8 -39.4,-18.8 0,0 -45.1,-3.4 -45.1,49.2999 v 85.3 h 32.7 v -80.5 c 0,-23.5999 15.8,-24.0999 18.9,-23.3999 0,0 5.7,0.3 10.9,5.7 0,0 -10.4,13.5999 -11.2,30.6999 0,0 -2.3,44.3 33.2,44.3 35.5,0 33.2,-44.3 33.2,-44.3 -0.8,-17.1 -11.2,-30.6999 -11.2,-30.6999 5.2,-5.4 10.9,-5.7 10.9,-5.7 3,-0.7 18.9,-0.2 18.9,23.3999 v 80.5 h 32.7 V 105.4 C 493.6,52.7001 448.6,56.1001 448.6,56.1001 Z M 409.1,143.5 c -7,0 -9.3,-8.8 -9.4,-17.2 -0.2,-14.6 9.3,-25.1 9.4,-25.3 0.2,0.2 9.6,10.7 9.4,25.3 0,8.4 -2.4,17.2 -9.4,17.2 z"/><path d="m 306.3,58.3 h -32.7 v 132.5 h 32.7 z"/><path d="m 290,0.899902 c -10.9,0 -19.9,8.799998 -19.9,19.599998 0,10.9 8.9,19.9 19.9,19.9 10.8,0 19.6,-8.9 19.6,-19.9 0,-10.6 -8.9,-19.599998 -19.6,-19.599998 z"/><path d="M 170.1,67.2 V 0 h -32.4 v 190.8 h 32.4 V 95.3 c 53.7,-26.1 51.7,15.2 51.7,15.2 v 80.3 h 32.5 v -80.3 c -0.1,-77.6 -67.9,-52 -84.2,-43.3 z"/><path d="m 538.6,131 c 17.4,6.1 39.5,5.6 39.5,5.6 52.4,-0.3 50.9,-38.4001 50.9,-38.4001 -1.3,-42.9 -51.7,-42.1 -51.7,-42.1 -41.7,0 -70.9,28.6 -70.9,69.5001 0,40.9 28.6,67.3 72.8,67.3 18.8,0 36.7,-5.2 49.2,-14.3 v -31.5 c -13.1,11.3 -28.8,17.3 -45.4,17.3 0.1,0 -45.3,2.3 -44.4,-33.4 z m 4,-27.9 c 5.5,-13.9001 16.9,-21.2001 33.1,-21.2001 13.3,0 21,5.6 21,14.5 C 596.7,108.9 582.6,110 569.4,110 c -13,0 -21,-1.4 -24.6,-2.3 l -3.5,-0.8 z"/><path d="m 70.6,192.9 c 23,0 39.3,-8.7 49,-16 V 145.2 C 105.3,156.5 88.5,163 73.6,163 49.8,163 33.1,146.6 33.1,123 33.1,100.6 48.3,85.0001 70,85.0001 c 7.1,0 13.2,1.8 19.7,3.6 6.7,1.9 13.7,4 22,4 2.6,0 5.2,-0.2 7.8,-0.6 v -30.2 c -2.2,0.2 -4.3,0.4 -6.5,0.4 -7.5,0 -14.3,-1.4 -21.4,-2.9 -7.5,-1.6 -15.2,-3.2 -24.3,-3.2 -18.1,0 -34.9,6.4 -47.2,18.2 C 7,86.8001 0,104.2 0,124.5 c 0,40.3 29,68.4 70.6,68.4 z"/><path d="m 667.512,72.3052 c 0,-1.9764 -0.319,-3.7929 -0.959,-5.4496 -0.639,-1.6567 -1.526,-3.0809 -2.659,-4.2725 -1.134,-1.1916 -2.456,-2.1072 -3.968,-2.7466 -1.511,-0.6685 -3.139,-1.0027 -4.882,-1.0027 -1.773,0 -3.43,0.3342 -4.97,1.0027 -1.512,0.6394 -2.834,1.555 -3.968,2.7466 -1.133,1.1916 -2.02,2.6158 -2.659,4.2725 -0.64,1.6567 -0.959,3.4732 -0.959,5.4496 0,1.8601 0.29,3.604 0.872,5.2316 0.581,1.6276 1.409,3.0518 2.485,4.2725 1.104,1.2207 2.427,2.1943 3.967,2.9209 1.54,0.6976 3.284,1.0464 5.232,1.0464 1.743,0 3.371,-0.3197 4.882,-0.9592 1.512,-0.6684 2.834,-1.5985 3.968,-2.7902 1.133,-1.1916 2.02,-2.6012 2.659,-4.2288 0.64,-1.6567 0.959,-3.4878 0.959,-5.4932 z m 3.488,0 c 0,2.4414 -0.436,4.6648 -1.308,6.6703 -0.843,2.0054 -2.005,3.7202 -3.488,5.1444 -1.453,1.4242 -3.153,2.5286 -5.1,3.3133 -1.919,0.7848 -3.939,1.1772 -6.06,1.1772 -2.355,0 -4.52,-0.4069 -6.496,-1.2208 -1.948,-0.8428 -3.633,-1.9909 -5.058,-3.4441 -1.395,-1.4532 -2.499,-3.168 -3.313,-5.1444 C 639.392,76.7956 639,74.6303 639,72.3052 c 0,-2.4414 0.421,-4.6649 1.264,-6.6703 0.872,-2.0055 2.035,-3.7203 3.488,-5.1444 1.482,-1.4242 3.197,-2.5286 5.144,-3.3134 1.948,-0.7847 3.997,-1.1771 6.148,-1.1771 2.121,0 4.141,0.3924 6.06,1.1771 1.947,0.7848 3.647,1.8892 5.1,3.3134 1.483,1.4241 2.645,3.1389 3.488,5.1444 0.872,2.0054 1.308,4.2289 1.308,6.6703 z m -15.869,-0.9156 c 0.552,0 1.075,-0.0145 1.569,-0.0436 0.523,-0.0581 0.974,-0.1889 1.352,-0.3923 0.378,-0.2035 0.683,-0.4796 0.915,-0.8284 0.233,-0.3778 0.349,-0.901 0.349,-1.5694 0,-0.5523 -0.131,-0.9882 -0.392,-1.3079 -0.233,-0.3198 -0.538,-0.5668 -0.916,-0.7412 -0.378,-0.1744 -0.799,-0.2761 -1.264,-0.3052 -0.465,-0.0581 -0.916,-0.0872 -1.352,-0.0872 h -3.575 v 5.2752 z m -3.314,10.2453 h -2.964 V 63.5858 h 6.845 c 2.179,0 3.822,0.4069 4.926,1.2207 1.104,0.8138 1.657,2.1363 1.657,3.9673 0,1.6277 -0.451,2.8193 -1.352,3.575 -0.901,0.7557 -2.02,1.2062 -3.357,1.3515 l 5.057,7.9346 h -3.357 l -4.664,-7.7166 h -2.791 z"/><path d="m 659.805,60.1108 c -1.471,-0.6506 -3.057,-0.9771 -4.761,-0.9771 -1.735,0 -3.35,0.3267 -4.851,0.978 l -0.003,0.0011 c -1.473,0.6233 -2.761,1.5151 -3.866,2.677 -1.105,1.161 -1.971,2.5508 -2.597,4.1738 -0.625,1.6185 -0.939,3.3979 -0.939,5.3415 0,1.8284 0.285,3.5379 0.854,5.1307 0.569,1.5934 1.378,2.9835 2.426,4.1736 1.077,1.1891 2.365,2.1385 3.87,2.8485 1.495,0.6768 3.195,1.0186 5.106,1.0186 1.705,0 3.292,-0.3123 4.763,-0.9345 1.475,-0.6525 2.764,-1.5593 3.869,-2.7216 1.105,-1.1616 1.971,-2.5375 2.598,-4.1311 0.624,-1.6178 0.938,-3.4113 0.938,-5.3842 0,-1.9436 -0.314,-3.723 -0.939,-5.3415 -0.626,-1.623 -1.492,-3.0128 -2.597,-4.1738 -1.105,-1.1619 -2.393,-2.0537 -3.867,-2.677 z m 0.121,24.7066 c -1.511,0.6395 -3.139,0.9592 -4.882,0.9592 -1.948,0 -3.692,-0.3488 -5.232,-1.0464 -1.54,-0.7266 -2.863,-1.7002 -3.967,-2.9209 -1.076,-1.2207 -1.904,-2.6449 -2.485,-4.2725 -0.582,-1.6276 -0.872,-3.3715 -0.872,-5.2316 0,-1.9764 0.319,-3.7929 0.959,-5.4496 0.639,-1.6567 1.526,-3.0809 2.659,-4.2725 1.134,-1.1916 2.456,-2.1072 3.968,-2.7466 1.54,-0.6685 3.197,-1.0027 4.97,-1.0027 1.743,0 3.371,0.3342 4.882,1.0027 1.512,0.6394 2.834,1.555 3.968,2.7466 1.133,1.1916 2.02,2.6158 2.659,4.2725 0.64,1.6567 0.959,3.4732 0.959,5.4496 0,2.0054 -0.319,3.8365 -0.959,5.4932 -0.639,1.6276 -1.526,3.0372 -2.659,4.2288 -1.134,1.1917 -2.456,2.1218 -3.968,2.7902 z m -11.498,2.8475 c -1.981,-0.8576 -3.699,-2.0273 -5.152,-3.5095 l -0.002,-0.0022 c -1.423,-1.4819 -2.547,-3.229 -3.374,-5.2379 l -0.002,-0.0049 c -0.8,-2.043 -1.198,-4.2457 -1.198,-6.6053 0,-2.4764 0.428,-4.74 1.288,-6.7865 l 10e-4,-0.0034 c 0.886,-2.0382 2.07,-3.7859 3.553,-5.239 l 0.002,-0.0021 c 1.511,-1.4513 3.258,-2.5765 5.24,-3.3753 1.984,-0.7995 4.071,-1.1988 6.26,-1.1988 2.159,0 4.217,0.3995 6.172,1.1991 1.982,0.7988 3.715,1.9241 5.197,3.376 1.513,1.4535 2.697,3.2021 3.555,5.2419 0.89,2.0469 1.332,4.3111 1.332,6.7881 0,2.4771 -0.442,4.7413 -1.332,6.7882 -0.858,2.0397 -2.042,3.7883 -3.555,5.2419 -1.482,1.4519 -3.215,2.5773 -5.197,3.3761 -1.955,0.7995 -4.013,1.199 -6.172,1.199 -2.39,0 -4.594,-0.4131 -6.611,-1.2433 z m 12.676,-0.2317 c 1.947,-0.7847 3.647,-1.8891 5.1,-3.3133 1.483,-1.4242 2.645,-3.139 3.488,-5.1444 0.872,-2.0055 1.308,-4.2289 1.308,-6.6703 0,-2.4414 -0.436,-4.6649 -1.308,-6.6703 -0.843,-2.0055 -2.005,-3.7203 -3.488,-5.1444 -1.453,-1.4242 -3.153,-2.5286 -5.1,-3.3134 C 659.185,56.3924 657.165,56 655.044,56 c -2.151,0 -4.2,0.3924 -6.148,1.1771 -1.947,0.7848 -3.662,1.8892 -5.144,3.3134 -1.453,1.4241 -2.616,3.1389 -3.488,5.1444 -0.843,2.0054 -1.264,4.2289 -1.264,6.6703 0,2.3251 0.392,4.4904 1.177,6.4959 0.814,1.9764 1.918,3.6912 3.313,5.1444 1.425,1.4532 3.11,2.6013 5.058,3.4441 1.976,0.8139 4.141,1.2208 6.496,1.2208 2.121,0 4.141,-0.3924 6.06,-1.1772 z m -2.418,-20.0019 -0.005,-0.0069 c -0.201,-0.2761 -0.465,-0.4912 -0.799,-0.6452 -0.34,-0.1571 -0.724,-0.2512 -1.157,-0.2782 l -0.009,-6e-4 -0.009,-0.0011 c -0.454,-0.0567 -0.892,-0.0849 -1.315,-0.0849 h -3.275 v 4.6752 h 3.014 c 0.544,0 1.058,-0.0142 1.544,-0.0426 0.49,-0.0552 0.899,-0.1768 1.234,-0.3575 0.334,-0.1798 0.601,-0.4213 0.806,-0.726 0.19,-0.3123 0.301,-0.7717 0.301,-1.4077 0,-0.5064 -0.12,-0.8675 -0.325,-1.1179 z m 0.281,2.694 c -0.232,0.3488 -0.537,0.6249 -0.915,0.8284 -0.378,0.2034 -0.829,0.3342 -1.352,0.3923 -0.494,0.0291 -1.017,0.0436 -1.569,0.0436 h -3.314 v -5.2752 h 3.575 c 0.436,0 0.887,0.0291 1.352,0.0872 0.465,0.0291 0.886,0.1308 1.264,0.3052 0.378,0.1744 0.683,0.4214 0.916,0.7412 0.261,0.3197 0.392,0.7556 0.392,1.3079 0,0.6684 -0.116,1.1916 -0.349,1.5694 z m -6.85,11.8095 h -3.564 v -18.649 h 7.144 c 2.209,0 3.926,0.4109 5.105,1.2792 1.205,0.8882 1.779,2.3171 1.779,4.2088 0,1.6806 -0.467,2.9726 -1.459,3.8048 -0.843,0.7069 -1.861,1.1562 -3.045,1.3549 l 5.099,8.0013 h -4.073 l -4.665,-7.7166 h -2.321 z m -0.3,-8.0165 h 2.791 l 4.664,7.7166 h 3.357 l -5.057,-7.9346 c 0.111,-0.0121 0.221,-0.0263 0.329,-0.0426 1.193,-0.1797 2.202,-0.616 3.028,-1.3089 0.901,-0.7557 1.352,-1.9473 1.352,-3.575 0,-1.831 -0.553,-3.1535 -1.657,-3.9673 -1.104,-0.8138 -2.747,-1.2207 -4.926,-1.2207 h -6.845 v 18.0491 h 2.964 z"/></g></g></svg>'
    "PayPal": '<svg width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="PayPal"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><g transform="translate(10,3) scale(0.75)" fill="#003087"><path d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z"/></g></svg>', 
  };
  function money(cents){ return "$" + (cents / 100).toFixed(2); }
  function toast(msg){
    var t = document.getElementById("omjpn-wa-toast");
    if (!t) {
      t = document.createElement("div");
      t.id = "omjpn-wa-toast";
      t.setAttribute("style", "position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#141414;color:#fff;padding:12px 22px;border-radius:999px;font-size:14px;font-weight:600;z-index:100002;opacity:0;transition:opacity .3s;pointer-events:none;max-width:90vw;text-align:center;");
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = "1";
    setTimeout(function(){ t.style.opacity = "0"; }, 2600);
  }
  function closePicker(){
    var ov = document.getElementById("omjpn-pay");
    if (!ov) return;
    ov.classList.remove("show");
    setTimeout(function(){ ov.hidden = true; }, 260);
  }
  function fieldVal(id){ var el = document.getElementById(id); return el ? el.value.trim() : ""; }
  function showStep(ov, n){
    var steps = ov.querySelectorAll(".omjpn-step");
    for (var i = 0; i < steps.length; i++) {
      steps[i].hidden = steps[i].getAttribute("data-step") !== String(n);
    }
  }
  function openPicker(){
    var ov = document.getElementById("omjpn-pay");
    if (ov) { showStep(ov, 1); ov.hidden = false; requestAnimationFrame(function(){ ov.classList.add("show"); }); return; }
    ov = document.createElement("div");
    ov.id = "omjpn-pay";
    var btns = "";
    for (var i = 0; i < METHODS.length; i++) {
      btns += '<button type="button" class="omjpn-pay-btn" data-m="' + METHODS[i] + '"><span class="omjpn-pay-logo">' + LOGOS[METHODS[i]] + "</span><span>" + METHODS[i] + "</span></button>";
    }
    ov.innerHTML =
      "<style>" +
      "#omjpn-pay{position:fixed;inset:0;z-index:100001;display:flex;align-items:flex-start;justify-content:center;padding:20px;background:rgba(15,15,18,.55);opacity:0;transition:opacity .25s;overflow-y:auto}" +
      "#omjpn-pay[hidden]{display:none}" +
      "#omjpn-pay.show{opacity:1}" +
      ".omjpn-pay-card{background:#fff;border-radius:12px;max-width:380px;width:100%;padding:28px 24px;font-family:Barlow,-apple-system,BlinkMacSystemFont,sans-serif;margin:auto}" +
      ".omjpn-pay-card h3{margin:0 0 6px;font-size:20px;font-weight:700;color:#141414;text-align:center}" +
      ".omjpn-pay-card p{margin:0 0 18px;font-size:13.5px;color:#555;line-height:1.5;text-align:center}" +
      ".omjpn-step[hidden]{display:none}" +
      ".omjpn-ff{display:block;margin:0 0 12px;font-size:13px;font-weight:600;color:#333;text-align:left}" +
      ".omjpn-ff input,.omjpn-ff textarea{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:11px 12px;border:1px solid #d9d9d9;border-radius:8px;font-size:14px;font-family:inherit}" +
      ".omjpn-pay-next{display:block;width:100%;margin:6px 0 10px;padding:14px;border:0;background:#f5222d;color:#fff;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer}" +
      ".omjpn-pay-btn{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;margin:0 0 10px;padding:10px 14px;border:1px solid #e1e3e4;background:#fff;border-radius:8px;font-size:15px;font-weight:600;cursor:pointer;color:#141414;text-align:left}" +
      ".omjpn-pay-btn:hover{border-color:#f5222d}" +
      ".omjpn-pay-logo svg{display:block}" +
      ".omjpn-pay-cancel{display:block;width:100%;margin-top:4px;background:none;border:0;color:#777;font-size:13px;cursor:pointer;text-decoration:underline}" +
      "</style>" +
      '<div class="omjpn-pay-card" role="dialog" aria-modal="true">' +
      '<div class="omjpn-step" data-step="1">' +
      "<h3>Your details</h3>" +
      "<p>Where should we deliver your order?</p>" +
      '<label class="omjpn-ff">Full name<input id="omjpn-f-name" autocomplete="name" placeholder="Your full name"></label>' +
      '<label class="omjpn-ff">Phone<input id="omjpn-f-phone" inputmode="tel" autocomplete="tel" placeholder="Phone / WhatsApp (optional)"></label>' +
      '<label class="omjpn-ff">Delivery address<textarea id="omjpn-f-addr" rows="3" placeholder="Street, city, postcode, country"></textarea></label>' +
      '<button type="button" class="omjpn-pay-next" id="omjpn-pay-next">Continue</button>' +
      '<button type="button" class="omjpn-pay-cancel" data-act="cancel">Cancel</button>' +
      "</div>" +
      '<div class="omjpn-step" data-step="2" hidden>' +
      "<h3>Choose payment method</h3>" +
      "<p>Your order will be sent to us on WhatsApp with this payment method.</p>" +
      btns +
      '<button type="button" class="omjpn-pay-cancel" data-act="back">Back</button>' +
      "</div>" +
      "</div>";
    document.body.appendChild(ov);
    requestAnimationFrame(function(){ ov.classList.add("show"); });
    ov.addEventListener("click", function(e){
      if (e.target === ov) { closePicker(); return; }
      var t = e.target && e.target.closest ? e.target.closest("button") : null;
      if (!t) return;
      var act = t.getAttribute("data-act");
      if (act === "cancel") { closePicker(); return; }
      if (act === "back") { showStep(ov, 1); return; }
      if (t.id === "omjpn-pay-next") {
        if (!fieldVal("omjpn-f-name") || !fieldVal("omjpn-f-addr")) { toast("Please enter your name and delivery address."); return; }
        showStep(ov, 2); return;
      }
      if (t.classList.contains("omjpn-pay-btn")) { checkoutWith(t.getAttribute("data-m")); }
    });
  }
  function checkoutWith(method){
    var dName = fieldVal("omjpn-f-name"), dPhone = fieldVal("omjpn-f-phone"), dAddr = fieldVal("omjpn-f-addr");
    closePicker();
    fetch("/cart.js", {headers: {"accept": "application/json"}})
      .then(function(r){ return r.json(); })
      .then(function(cart){
        if (!cart.items || !cart.items.length) { toast("Your cart is empty."); return; }
        var lines = [];
        for (var i = 0; i < cart.items.length; i++) {
          var it = cart.items[i];
          lines.push((i + 1) + ". " + it.title + " x " + it.quantity + " — " + money(it.final_line_price));
        }
        var msg =
          "*New Order — Omotenashi TCG Japan Branch*\n--------------------------\n" +
          lines.join("\n") +
          "\n--------------------------\n*Total: " + money(cart.total_price) + "*\n*Payment method: " + method + "*" +
          "\n\nName: " + dName + "\nPhone: " + (dPhone || "-") + "\nDelivery address: " + dAddr;
        window.location.href = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg);
      })
      .catch(function(){ toast("Could not read your cart. Please try again."); });
  }
  var SEL = 'a[href*="/checkout"], button[name="checkout"], input[name="checkout"], .shopify-payment-button button';
  document.addEventListener("click", function(e){
    var el = e.target && e.target.closest ? e.target.closest(SEL) : null;
    if (el) { e.preventDefault(); e.stopPropagation(); openPicker(); }
  }, true);
  document.addEventListener("submit", function(e){
    var f = e.target;
    if (f && f.getAttribute) {
      var a = f.getAttribute("action") || "";
      var sub = e.submitter;
      var subIsCheckout = !!(sub && sub.closest && sub.closest(SEL));
      if (a.indexOf("/checkout") !== -1 || subIsCheckout) { e.preventDefault(); e.stopPropagation(); openPicker(); }
    }
  }, true);
})();</scr` + `ipt>`;

// Tawk.to live chat widget (user-supplied embed, Oct 17 2026).
// Loads for human visitors only — bots get the static snapshot.
const TAWK_SCRIPT = `<script type="text/javascript">
var Tawk_API=Tawk_API||{}, Tawk_LoadStart=new Date();
(function(){
var s1=document.createElement("script"),s0=document.getElementsByTagName("script")[0];
s1.async=true;
s1.src='https://embed.tawk.to/6acbc308f5cc5c34c2fbb98f/default';
s1.charset='UTF-8';
s1.setAttribute('crossorigin','*');
s0.parentNode.insertBefore(s1,s0);
})();
</scr` + `ipt>`;

// user-directed removals: no "Buy with shop" button, no payment logos
const HIDE_CSS = `<style>
.shopify-payment-button,
[data-shopify="payment-button"],
.footer__follow-on-shop,.shopify-localization-form,.footer__localization-form{display:none!important}
</style>`;




// ---------- SEO fixes (applied to the mirrored branch) ----------
const SEO_H1_STYLE = `<style>.omjpn-seo-h1{position:absolute!important;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}</style>`;

function unescapeHtml(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function pageTitle(html: string): string {
  const m = html.match(/<title>([\s\S]*?)<\/title>/i);
  if (!m) return "";
  let t = unescapeHtml(m[1]).trim();
  t = t.split(" | ")[0].split(" – ")[0].trim();
  return t;
}

function seoFix(html: string, pathname: string): string {
  // 1. Brand typo: "Japanes" -> "Japanese" (titles, og tags, JSON-LD)
  html = html.split("Japanes Trading Card Game Store").join("Japanese Trading Card Game Store");

  // 2. Pages with no H1 (all collection pages, some info pages): inject a
  //    visually-hidden H1 derived from the page title. Invisible to visitors,
  //    visible to search engines and screen readers.
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count === 0) {
    const title = pageTitle(html);
    if (title && /<body[^>]*>/i.test(html)) {
      const h1 = SEO_H1_STYLE + `<h1 class="omjpn-seo-h1">${escapeHtml(title)}</h1>`;
      html = html.replace(/<body[^>]*>/i, (bm) => bm + h1);
    }
  }

  // 3+4. Meta descriptions: collapse duplicates to exactly one tag; replace
  //    boilerplate / overlong / empty / missing ones with a concise
  //    description built from real page data.
  const reAll = /<meta[^>]+name=["']description["'][^>]*>\s*/gi;
  const tags = html.match(reAll) || [];
  let current: string | null = null;
  for (const t of tags) {
    const cm = t.match(/content=["']([\s\S]*?)["']/i);
    const v = cm ? unescapeHtml(cm[1]).trim() : "";
    if (v) {
      current = v;
      break;
    }
  }
  const needsNew =
    current === null || /Condition Used/i.test(current) || current.length > 160;

  if (needsNew || tags.length > 1) {
    let desc = current || "";
    if (needsNew) {
      if (pathname.startsWith("/products/")) {
        const title = pageTitle(html);
        const pm = html.match(/"price"\s*:\s*"([\d.]+)"/);
        desc = title
          ? `${title} — available at Omotenashi TCG Japan Branch.`
          : "Available at Omotenashi TCG Japan Branch.";
        if (pm) desc += ` $${pm[1]}.`;
      } else {
        const known: Record<string, string> = {
          "/pages/pokemon":
            "Buy Japanese Pokémon cards at Omotenashi TCG Japan Branch — booster boxes, single cards and promos.",
          "/pages/avada-faqs":
            "Frequently asked questions about ordering Japanese TCG products from Omotenashi TCG Japan Branch.",
          "/collections/single":
            "Japanese single TCG cards and promos at Omotenashi TCG Japan Branch — Pokémon, One Piece and more.",
        };
        const title = pageTitle(html);
        desc = known[pathname] || (title ? `${title} — Omotenashi TCG Japan Branch.` : "");
      }
    }
    if (desc) {
      if (desc.length > 155) desc = desc.slice(0, 152) + "...";
      const tag = `<meta name="description" content="${escapeHtml(desc)}">`;
      if (/<\/head>/i.test(html)) {
        html = html.replace(reAll, "");
        html = html.replace(/<\/head>/i, () => tag + "\n</head>");
      } else {
        html = html.replace(/<meta[^>]+name=["']description["'][^>]*>/i, () => tag);
      }
    }
  }

  return html;
}
// ---------- end SEO fixes ----------





// Branch independence: this branch ranks on its own, and all of its
// links stay on the branch. Every origin URL — canonicals, og:url, hreflang,
// nav links, CDN assets, JSON-LD, embedded JSON, escaped JS strings — is
// rewritten to the branch host. The analytics "domain" key is intentionally
// left untouched (it identifies the shop to Shopify's analytics).
function rewriteBranchUrls(html: string, host: string): string {
  // Unescaped: https://, http://, protocol-relative //
  html = html.split("//omotenashitcg.com").join(`//${host}`);
  // Escaped inside JS strings: \/\/
  html = html.split("\\/\\/omotenashitcg.com").join(`\\/\\/${host}`);
  // Bare domain in JSON strings ("pageurl":"omotenashitcg.com/...",
  // Shopify.cdnHost = "omotenashitcg.com/cdn") — but not "domain":"..."
  html = html.replace(/"omotenashitcg\.com(?!")/g, `"${host}`);
  return html;
}





// Remove Shopify's analytics tracker (Trekkie/Monorail) entirely.
function removeAnalytics(html: string): string {
  return html.replace(
    /<script class="analytics">[\s\S]*?<\/script>/g,
    ""
  );
}

// Safety net: strip any meta-refresh redirecting to the origin store.
function stripMetaRefresh(html: string): string {
  return html.replace(
    /<meta[^>]*http-equiv="refresh"[^>]*omotenashitcg\.com[^>]*>/gi,
    ""
  );
}

// Remove Shopify Inbox chat app block.
function removeInboxChat(html: string): string {
  return html.replace(
    /<!-- BEGIN app block: shopify:\/\/apps\/inbox\/blocks\/chat[\s\S]*?<!-- END app block -->/g,
    ""
  );
}

// Remove Shopify's chat/assistant widget system entirely (we use Tawk.to).
// Strips: config JSON, page data, the <shopify-chat> element, its styles.
function removeShopifyChat(html: string): string {
  return html
    .replace(
      /<script id='shopify-chat-app-embed-data' type='application\/json'>[\s\S]*?<\/script>/g,
      ""
    )
    .replace(
      /<script id="shopify-chat-page-data" type="application\/json">[\s\S]*?<\/script>/g,
      ""
    )
    .replace(/<shopify-chat><\/shopify-chat>/g, "")
    .replace(/<style data-shopify>[\s\S]*?<\/style>/g, "");
}

// Lock prices to USD: remove Shopify Markets country/currency selector forms.
function removeCurrencySelector(html: string): string {
  return html
    .replace(
      /<form[^>]*class="shopify-localization-form"[^>]*>[\s\S]*?<\/form>/g,
      ""
    )
    .replace(
      /<form[^>]*class="footer__localization-form"[^>]*>[\s\S]*?<\/form>/g,
      ""
    );
}


// Remove all social handles: footer/mobile "Follow Us" social links
// and product-page share buttons.
function removeSocials(html: string): string {
  // Remove "Follow Us" heading + social list block
  html = html.replace(
    /<p[^>]*>Follow Us<\/p>\s*<ul class="social-media__item-list[\s\S]*?<\/ul>/gi,
    ""
  );
  // Remove any remaining social-media item lists
  html = html.replace(
    /<ul class="social-media__item-list[\s\S]*?<\/ul>/gi,
    ""
  );
  // Remove product share buttons
  html = html.replace(
    /<div[^>]*class="[^"]*product-meta__share-buttons[^"]*"[^>]*>[\s\S]*?<\/div>/gi,
    ""
  );
  // Safety net: strip any remaining social profile/share links
  html = html.replace(
    /<a[^>]*href="https?:\/\/(www\.)?(facebook|instagram|twitter|x\.com|youtube|tiktok|pinterest)\.com\/[^"]*"[^>]*>[\s\S]*?<\/a>/gi,
    ""
  );
  return html;
}

// Remove Klaviyo's onsite popup block entirely (user-directed Oct 13 2026:
// the "Get 5% OFF Coupon Code" popup must not appear on the Japan branch).
// Strips: the klaviyo.js onsite loader, its pre-load queue shim, and the
// reviews design-mode flag. Without the loader, no Klaviyo popup can render.
function removeKlaviyo(html: string): string {
  return html
    .replace(
      /<script[^>]*src=["'][^"']*static\.klaviyo\.com\/onsite\/js[^"']*["'][^>]*>\s*<\/script>/gi,
      ""
    )
    .replace(
      /<script>!function\(\)\{if\(!window\.klaviyo\)\{[\s\S]*?<\/script>/g,
      ""
    )
    .replace(
      /<script>\s*window\.klaviyoReviewsProductDesignMode\s*=\s*false\s*<\/script>/gi,
      ""
    );
}

// Remove the DDP/DDU customs-notice slide from the homepage slideshow.
function removeDdpBanner(html: string): string {
  return html.replace(
    /<a[^>]*href="\/pages\/tcgduty"[^>]*>(?:(?!<\/a>)[\s\S])*?<\/a>/g,
    ""
  );
}

// Mark pre-order products: if the product's own description says pre-order,
// inject a PRE-ORDER badge after the title and relabel the buy button.
function markPreorder(html: string, pathname: string): string {
  if (!pathname.startsWith("/products/")) return html;
  const ogDesc = html.match(/<meta property="og:description" content="([^"]*)"/);
  if (!ogDesc || !/pre[\s-]?order/i.test(ogDesc[1])) return html;
  const badge =
    `<div class="omjpn-preorder-badge">PRE-ORDER</div>` +
    `<style>.omjpn-preorder-badge{display:inline-block;background:#e8590c;color:#fff;` +
    `font-size:12px;font-weight:800;letter-spacing:.1em;padding:7px 16px;border-radius:5px;margin:10px 0 2px;` +
    `font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;}</style>`;
  html = html.replace(
    /(<h1 class="product-meta__title[^"]*">[\s\S]*?<\/h1>)/,
    `$1${badge}`
  );
  html = html.replace(
    /(<button[^>]*class="product-form__add-button[^"]*"[^>]*>)[\s\S]*?(<\/button>)/,
    `$1Pre-Order Now$2`
  );
  return html;
}

// Remove Shopify "Follow on Shop" footer block entirely.
function removeFollowOnShop(html: string): string {
  return html.replace(
    /<div class="footer__follow-on-shop">[\s\S]*?<\/shop-follow-button>\s*<\/div>/g,
    ""
  );
}

function replacePaymentLists(html: string, methods?: string[]): string {
  const badges = (methods ?? ["Wise", "CashApp", "Credit Card", "Bank Transfer", "Chime", "PayPal"])
    .map((m) => PAY_BADGE_MAP[m] || "").join("");
  return html.replace(
    /(<div[^>]*class="[^"]*payment-list[^"]*"[^>]*>)[\s\S]*?(<\/div>)/g,
    (_m, open, close) => open + badges + close
  );
}
// Branch payment badges: real brand artwork for Wise, Cash App and Chime;
// generic marks for Credit Card and Bank Transfer (no brands exist).
const PAY_BADGE_MAP: Record<string, string> = {
  "Wise": `<svg class="payment-list__item" width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Wise"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><g transform="translate(5,8) scale(0.33)" fill="#9FE870"><path d="M6.488 7.469 0 15.05h11.585l1.301-3.576H7.922l3.033-3.507.01-.092L8.993 4.48h8.873l-6.878 18.925h4.706L24 .595H2.543l3.945 6.874Z"/></g><text x="15" y="16" font-family="Arial,Helvetica,sans-serif" font-size="8" font-weight="800" fill="#163300">Wise</text></svg>`,
  "CashApp": `<svg class="payment-list__item" width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Cash App"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><g transform="translate(9,2) scale(0.8333)" fill="#00C244"><path d="M23.59 3.475a5.1 5.1 0 00-3.05-3.05c-1.31-.42-2.5-.42-4.92-.42H8.36c-2.4 0-3.61 0-4.9.4a5.1 5.1 0 00-3.05 3.06C0 4.765 0 5.965 0 8.365v7.27c0 2.41 0 3.6.4 4.9a5.1 5.1 0 003.05 3.05c1.3.41 2.5.41 4.9.41h7.28c2.41 0 3.61 0 4.9-.4a5.1 5.1 0 003.06-3.06c.41-1.3.41-2.5.41-4.9v-7.25c0-2.41 0-3.61-.41-4.91zm-6.17 4.63l-.93.93a.5.5 0 01-.67.01 5 5 0 00-3.22-1.18c-.97 0-1.94.32-1.94 1.21 0 .9 1.04 1.2 2.24 1.65 2.1.7 3.84 1.58 3.84 3.64 0 2.24-1.74 3.78-4.58 3.95l-.26 1.2a.49.49 0 01-.48.39H9.63l-.09-.01a.5.5 0 01-.38-.59l.28-1.27a6.54 6.54 0 01-2.88-1.57v-.01a.48.48 0 010-.68l1-.97a.49.49 0 01.67 0c.91.86 2.13 1.34 3.39 1.32 1.3 0 2.17-.55 2.17-1.42 0-.87-.88-1.1-2.54-1.72-1.76-.63-3.43-1.52-3.43-3.6 0-2.42 2.01-3.6 4.39-3.71l.25-1.23a.48.48 0 01.48-.38h1.78l.1.01c.26.06.43.31.37.57l-.27 1.37c.9.3 1.75.77 2.48 1.39l.02.02c.19.2.19.5 0 .68z"/></g></svg>`,
  "Credit Card": `<svg class="payment-list__item" width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Credit Card"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><rect x="8" y="7" width="22" height="10" rx="2" fill="#1a1f36"/><rect x="8" y="9.6" width="22" height="2.6" fill="#ffffff" opacity="0.9"/></svg>`,
  "Bank Transfer": `<svg class="payment-list__item" width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Bank Transfer"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><path d="M19 6 L28 12 H10 Z" fill="#2f6fed"/><rect x="12" y="13" width="2.5" height="5" fill="#2f6fed"/><rect x="17.75" y="13" width="2.5" height="5" fill="#2f6fed"/><rect x="23.5" y="13" width="2.5" height="5" fill="#2f6fed"/><rect x="10" y="18.6" width="18" height="1.8" fill="#2f6fed"/></svg>`,
  "Chime": `<svg class="payment-list__item" width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="Chime"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><g transform="translate(4,7.75) scale(0.192)"><g transform="translate(123.89757,-60.126245)" fill="#1ec677"><path d="m 448.6,56.1001 c -11.8,0 -25.9,4.2 -39.4,18.8 -13.5,-14.6 -27.7,-18.8 -39.4,-18.8 0,0 -45.1,-3.4 -45.1,49.2999 v 85.3 h 32.7 v -80.5 c 0,-23.5999 15.8,-24.0999 18.9,-23.3999 0,0 5.7,0.3 10.9,5.7 0,0 -10.4,13.5999 -11.2,30.6999 0,0 -2.3,44.3 33.2,44.3 35.5,0 33.2,-44.3 33.2,-44.3 -0.8,-17.1 -11.2,-30.6999 -11.2,-30.6999 5.2,-5.4 10.9,-5.7 10.9,-5.7 3,-0.7 18.9,-0.2 18.9,23.3999 v 80.5 h 32.7 V 105.4 C 493.6,52.7001 448.6,56.1001 448.6,56.1001 Z M 409.1,143.5 c -7,0 -9.3,-8.8 -9.4,-17.2 -0.2,-14.6 9.3,-25.1 9.4,-25.3 0.2,0.2 9.6,10.7 9.4,25.3 0,8.4 -2.4,17.2 -9.4,17.2 z"/><path d="m 306.3,58.3 h -32.7 v 132.5 h 32.7 z"/><path d="m 290,0.899902 c -10.9,0 -19.9,8.799998 -19.9,19.599998 0,10.9 8.9,19.9 19.9,19.9 10.8,0 19.6,-8.9 19.6,-19.9 0,-10.6 -8.9,-19.599998 -19.6,-19.599998 z"/><path d="M 170.1,67.2 V 0 h -32.4 v 190.8 h 32.4 V 95.3 c 53.7,-26.1 51.7,15.2 51.7,15.2 v 80.3 h 32.5 v -80.3 c -0.1,-77.6 -67.9,-52 -84.2,-43.3 z"/><path d="m 538.6,131 c 17.4,6.1 39.5,5.6 39.5,5.6 52.4,-0.3 50.9,-38.4001 50.9,-38.4001 -1.3,-42.9 -51.7,-42.1 -51.7,-42.1 -41.7,0 -70.9,28.6 -70.9,69.5001 0,40.9 28.6,67.3 72.8,67.3 18.8,0 36.7,-5.2 49.2,-14.3 v -31.5 c -13.1,11.3 -28.8,17.3 -45.4,17.3 0.1,0 -45.3,2.3 -44.4,-33.4 z m 4,-27.9 c 5.5,-13.9001 16.9,-21.2001 33.1,-21.2001 13.3,0 21,5.6 21,14.5 C 596.7,108.9 582.6,110 569.4,110 c -13,0 -21,-1.4 -24.6,-2.3 l -3.5,-0.8 z"/><path d="m 70.6,192.9 c 23,0 39.3,-8.7 49,-16 V 145.2 C 105.3,156.5 88.5,163 73.6,163 49.8,163 33.1,146.6 33.1,123 33.1,100.6 48.3,85.0001 70,85.0001 c 7.1,0 13.2,1.8 19.7,3.6 6.7,1.9 13.7,4 22,4 2.6,0 5.2,-0.2 7.8,-0.6 v -30.2 c -2.2,0.2 -4.3,0.4 -6.5,0.4 -7.5,0 -14.3,-1.4 -21.4,-2.9 -7.5,-1.6 -15.2,-3.2 -24.3,-3.2 -18.1,0 -34.9,6.4 -47.2,18.2 C 7,86.8001 0,104.2 0,124.5 c 0,40.3 29,68.4 70.6,68.4 z"/><path d="m 667.512,72.3052 c 0,-1.9764 -0.319,-3.7929 -0.959,-5.4496 -0.639,-1.6567 -1.526,-3.0809 -2.659,-4.2725 -1.134,-1.1916 -2.456,-2.1072 -3.968,-2.7466 -1.511,-0.6685 -3.139,-1.0027 -4.882,-1.0027 -1.773,0 -3.43,0.3342 -4.97,1.0027 -1.512,0.6394 -2.834,1.555 -3.968,2.7466 -1.133,1.1916 -2.02,2.6158 -2.659,4.2725 -0.64,1.6567 -0.959,3.4732 -0.959,5.4496 0,1.8601 0.29,3.604 0.872,5.2316 0.581,1.6276 1.409,3.0518 2.485,4.2725 1.104,1.2207 2.427,2.1943 3.967,2.9209 1.54,0.6976 3.284,1.0464 5.232,1.0464 1.743,0 3.371,-0.3197 4.882,-0.9592 1.512,-0.6684 2.834,-1.5985 3.968,-2.7902 1.133,-1.1916 2.02,-2.6012 2.659,-4.2288 0.64,-1.6567 0.959,-3.4878 0.959,-5.4932 z m 3.488,0 c 0,2.4414 -0.436,4.6648 -1.308,6.6703 -0.843,2.0054 -2.005,3.7202 -3.488,5.1444 -1.453,1.4242 -3.153,2.5286 -5.1,3.3133 -1.919,0.7848 -3.939,1.1772 -6.06,1.1772 -2.355,0 -4.52,-0.4069 -6.496,-1.2208 -1.948,-0.8428 -3.633,-1.9909 -5.058,-3.4441 -1.395,-1.4532 -2.499,-3.168 -3.313,-5.1444 C 639.392,76.7956 639,74.6303 639,72.3052 c 0,-2.4414 0.421,-4.6649 1.264,-6.6703 0.872,-2.0055 2.035,-3.7203 3.488,-5.1444 1.482,-1.4242 3.197,-2.5286 5.144,-3.3134 1.948,-0.7847 3.997,-1.1771 6.148,-1.1771 2.121,0 4.141,0.3924 6.06,1.1771 1.947,0.7848 3.647,1.8892 5.1,3.3134 1.483,1.4241 2.645,3.1389 3.488,5.1444 0.872,2.0054 1.308,4.2289 1.308,6.6703 z m -15.869,-0.9156 c 0.552,0 1.075,-0.0145 1.569,-0.0436 0.523,-0.0581 0.974,-0.1889 1.352,-0.3923 0.378,-0.2035 0.683,-0.4796 0.915,-0.8284 0.233,-0.3778 0.349,-0.901 0.349,-1.5694 0,-0.5523 -0.131,-0.9882 -0.392,-1.3079 -0.233,-0.3198 -0.538,-0.5668 -0.916,-0.7412 -0.378,-0.1744 -0.799,-0.2761 -1.264,-0.3052 -0.465,-0.0581 -0.916,-0.0872 -1.352,-0.0872 h -3.575 v 5.2752 z m -3.314,10.2453 h -2.964 V 63.5858 h 6.845 c 2.179,0 3.822,0.4069 4.926,1.2207 1.104,0.8138 1.657,2.1363 1.657,3.9673 0,1.6277 -0.451,2.8193 -1.352,3.575 -0.901,0.7557 -2.02,1.2062 -3.357,1.3515 l 5.057,7.9346 h -3.357 l -4.664,-7.7166 h -2.791 z"/><path d="m 659.805,60.1108 c -1.471,-0.6506 -3.057,-0.9771 -4.761,-0.9771 -1.735,0 -3.35,0.3267 -4.851,0.978 l -0.003,0.0011 c -1.473,0.6233 -2.761,1.5151 -3.866,2.677 -1.105,1.161 -1.971,2.5508 -2.597,4.1738 -0.625,1.6185 -0.939,3.3979 -0.939,5.3415 0,1.8284 0.285,3.5379 0.854,5.1307 0.569,1.5934 1.378,2.9835 2.426,4.1736 1.077,1.1891 2.365,2.1385 3.87,2.8485 1.495,0.6768 3.195,1.0186 5.106,1.0186 1.705,0 3.292,-0.3123 4.763,-0.9345 1.475,-0.6525 2.764,-1.5593 3.869,-2.7216 1.105,-1.1616 1.971,-2.5375 2.598,-4.1311 0.624,-1.6178 0.938,-3.4113 0.938,-5.3842 0,-1.9436 -0.314,-3.723 -0.939,-5.3415 -0.626,-1.623 -1.492,-3.0128 -2.597,-4.1738 -1.105,-1.1619 -2.393,-2.0537 -3.867,-2.677 z m 0.121,24.7066 c -1.511,0.6395 -3.139,0.9592 -4.882,0.9592 -1.948,0 -3.692,-0.3488 -5.232,-1.0464 -1.54,-0.7266 -2.863,-1.7002 -3.967,-2.9209 -1.076,-1.2207 -1.904,-2.6449 -2.485,-4.2725 -0.582,-1.6276 -0.872,-3.3715 -0.872,-5.2316 0,-1.9764 0.319,-3.7929 0.959,-5.4496 0.639,-1.6567 1.526,-3.0809 2.659,-4.2725 1.134,-1.1916 2.456,-2.1072 3.968,-2.7466 1.54,-0.6685 3.197,-1.0027 4.97,-1.0027 1.743,0 3.371,0.3342 4.882,1.0027 1.512,0.6394 2.834,1.555 3.968,2.7466 1.133,1.1916 2.02,2.6158 2.659,4.2725 0.64,1.6567 0.959,3.4732 0.959,5.4496 0,2.0054 -0.319,3.8365 -0.959,5.4932 -0.639,1.6276 -1.526,3.0372 -2.659,4.2288 -1.134,1.1917 -2.456,2.1218 -3.968,2.7902 z m -11.498,2.8475 c -1.981,-0.8576 -3.699,-2.0273 -5.152,-3.5095 l -0.002,-0.0022 c -1.423,-1.4819 -2.547,-3.229 -3.374,-5.2379 l -0.002,-0.0049 c -0.8,-2.043 -1.198,-4.2457 -1.198,-6.6053 0,-2.4764 0.428,-4.74 1.288,-6.7865 l 10e-4,-0.0034 c 0.886,-2.0382 2.07,-3.7859 3.553,-5.239 l 0.002,-0.0021 c 1.511,-1.4513 3.258,-2.5765 5.24,-3.3753 1.984,-0.7995 4.071,-1.1988 6.26,-1.1988 2.159,0 4.217,0.3995 6.172,1.1991 1.982,0.7988 3.715,1.9241 5.197,3.376 1.513,1.4535 2.697,3.2021 3.555,5.2419 0.89,2.0469 1.332,4.3111 1.332,6.7881 0,2.4771 -0.442,4.7413 -1.332,6.7882 -0.858,2.0397 -2.042,3.7883 -3.555,5.2419 -1.482,1.4519 -3.215,2.5773 -5.197,3.3761 -1.955,0.7995 -4.013,1.199 -6.172,1.199 -2.39,0 -4.594,-0.4131 -6.611,-1.2433 z m 12.676,-0.2317 c 1.947,-0.7847 3.647,-1.8891 5.1,-3.3133 1.483,-1.4242 2.645,-3.139 3.488,-5.1444 0.872,-2.0055 1.308,-4.2289 1.308,-6.6703 0,-2.4414 -0.436,-4.6649 -1.308,-6.6703 -0.843,-2.0055 -2.005,-3.7203 -3.488,-5.1444 -1.453,-1.4242 -3.153,-2.5286 -5.1,-3.3134 C 659.185,56.3924 657.165,56 655.044,56 c -2.151,0 -4.2,0.3924 -6.148,1.1771 -1.947,0.7848 -3.662,1.8892 -5.144,3.3134 -1.453,1.4241 -2.616,3.1389 -3.488,5.1444 -0.843,2.0054 -1.264,4.2289 -1.264,6.6703 0,2.3251 0.392,4.4904 1.177,6.4959 0.814,1.9764 1.918,3.6912 3.313,5.1444 1.425,1.4532 3.11,2.6013 5.058,3.4441 1.976,0.8139 4.141,1.2208 6.496,1.2208 2.121,0 4.141,-0.3924 6.06,-1.1772 z m -2.418,-20.0019 -0.005,-0.0069 c -0.201,-0.2761 -0.465,-0.4912 -0.799,-0.6452 -0.34,-0.1571 -0.724,-0.2512 -1.157,-0.2782 l -0.009,-6e-4 -0.009,-0.0011 c -0.454,-0.0567 -0.892,-0.0849 -1.315,-0.0849 h -3.275 v 4.6752 h 3.014 c 0.544,0 1.058,-0.0142 1.544,-0.0426 0.49,-0.0552 0.899,-0.1768 1.234,-0.3575 0.334,-0.1798 0.601,-0.4213 0.806,-0.726 0.19,-0.3123 0.301,-0.7717 0.301,-1.4077 0,-0.5064 -0.12,-0.8675 -0.325,-1.1179 z m 0.281,2.694 c -0.232,0.3488 -0.537,0.6249 -0.915,0.8284 -0.378,0.2034 -0.829,0.3342 -1.352,0.3923 -0.494,0.0291 -1.017,0.0436 -1.569,0.0436 h -3.314 v -5.2752 h 3.575 c 0.436,0 0.887,0.0291 1.352,0.0872 0.465,0.0291 0.886,0.1308 1.264,0.3052 0.378,0.1744 0.683,0.4214 0.916,0.7412 0.261,0.3197 0.392,0.7556 0.392,1.3079 0,0.6684 -0.116,1.1916 -0.349,1.5694 z m -6.85,11.8095 h -3.564 v -18.649 h 7.144 c 2.209,0 3.926,0.4109 5.105,1.2792 1.205,0.8882 1.779,2.3171 1.779,4.2088 0,1.6806 -0.467,2.9726 -1.459,3.8048 -0.843,0.7069 -1.861,1.1562 -3.045,1.3549 l 5.099,8.0013 h -4.073 l -4.665,-7.7166 h -2.321 z m -0.3,-8.0165 h 2.791 l 4.664,7.7166 h 3.357 l -5.057,-7.9346 c 0.111,-0.0121 0.221,-0.0263 0.329,-0.0426 1.193,-0.1797 2.202,-0.616 3.028,-1.3089 0.901,-0.7557 1.352,-1.9473 1.352,-3.575 0,-1.831 -0.553,-3.1535 -1.657,-3.9673 -1.104,-0.8138 -2.747,-1.2207 -4.926,-1.2207 h -6.845 v 18.0491 h 2.964 z"/></g></g></svg>`,

    "PayPal": `<svg class="payment-list__item" width="38" height="24" viewBox="0 0 38 24" role="img" aria-label="PayPal"><rect x="0.5" y="0.5" width="37" height="23" rx="4" fill="#ffffff" stroke="#d9d9d9"/><g transform="translate(10,3) scale(0.75)" fill="#003087"><path d="M15.607 4.653H8.941L6.645 19.251H1.82L4.862 0h7.995c3.754 0 6.375 2.294 6.473 5.513-.648-.478-2.105-.86-3.722-.86m6.57 5.546c0 3.41-3.01 6.853-6.958 6.853h-2.493L11.595 24H6.74l1.845-11.538h3.592c4.208 0 7.346-3.634 7.153-6.949a5.24 5.24 0 0 1 2.848 4.686M9.653 5.546h6.408c.907 0 1.942.222 2.363.541-.195 2.741-2.655 5.483-6.441 5.483H8.714Z"/></g></svg>`,
};
function waMoney(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function waEscapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Server-side safety net: ANY attempt to reach Shopify checkout on the branch
// (typed URL, missed button, express-checkout redirect, cached page) lands here
// instead — a payment-method picker that sends the order to WhatsApp.
async function checkoutPicker(req: NextRequest, cfg?: BranchConfig): Promise<NextResponse> {
  const config = cfg ?? (await getBranchConfig(req));
  const METHODS = enabledMethods(config);
  const NUMBER = waNumber(config);
  let cart: any = null;
  try {
    const r = await fetchWithTimeout(
      `${ORIGIN}/cart.js`,
      {
        headers: {
          cookie: req.headers.get("cookie") || "",
          accept: "application/json",
          "user-agent": req.headers.get("user-agent") || "Mozilla/5.0",
        },
      },
      8000
    );
    if (r.ok) cart = await r.json();
  } catch {
    cart = null;
  }
  const items = (cart && cart.items) || [];
  if (!items.length) {
    return NextResponse.redirect(new URL("/cart", req.url));
  }
  const lines = items.map(
    (it: any, i: number) => `${i + 1}. ${it.title} x ${it.quantity} — ${waMoney(it.final_line_price)}`
  );
  const base =
    `*New Order — Omotenashi TCG Japan Branch*\n--------------------------\n` +
    lines.join("\n") +
    `\n--------------------------\n*Total: ${waMoney(cart.total_price)}*`;
  const links: Record<string, string> = {};
  for (const m of METHODS) {
    const msg = base + `\n*Payment method: ${m}*\n\nName: __NAME__\nPhone: __PHONE__\nDelivery address: __ADDR__`;
    links[m] = `https://wa.me/${NUMBER}?text=${encodeURIComponent(msg)}`;
  }
  const buttons = METHODS.map(
    (m) => `<button type="button" class="omjpn-m" data-m="${m}"><span class="omjpn-m-logo">${PAY_BADGE_MAP[m] || ""}</span><span>${m}</span></button>`
  ).join("");
  const summary = items
    .map(
      (it: any) =>
        `<div class="omjpn-row"><span>${waEscapeHtml(it.title)} <em>x ${it.quantity}</em></span><span>${waMoney(it.final_line_price)}</span></div>`
    )
    .join("");
  const linksJson = JSON.stringify(links).replace(/</g, "\\u003c");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Checkout — Omotenashi TCG Japan Branch</title>
<style>
body{margin:0;background:#f6f6f6;font-family:Barlow,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#141414}
.omjpn-wrap{max-width:440px;margin:0 auto;padding:28px 20px 40px}
.omjpn-brand{text-align:center;margin-bottom:18px}
.omjpn-brand strong{display:block;font-size:17px}
.omjpn-brand span{font-size:12.5px;color:#666}
.omjpn-card{background:#fff;border-radius:12px;padding:22px 20px;margin-bottom:14px}
.omjpn-card h1{font-size:20px;margin:0 0 4px}
.omjpn-card p.sub{font-size:13.5px;color:#555;margin:0 0 14px;line-height:1.5}
.omjpn-row{display:flex;justify-content:space-between;gap:12px;font-size:13.5px;padding:7px 0;border-bottom:1px solid #f0f0f0}
.omjpn-row em{font-style:normal;color:#777}
.omjpn-total{display:flex;justify-content:space-between;font-weight:700;font-size:15px;padding-top:10px}
.omjpn-f{display:block;margin:0 0 12px;font-size:13px;font-weight:600;color:#333}
.omjpn-f input,.omjpn-f textarea{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:11px 12px;border:1px solid #d9d9d9;border-radius:8px;font-size:14px;font-family:inherit}
.omjpn-m{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;margin:0 0 10px;padding:10px 14px;border:1px solid #e1e3e4;background:#fff;border-radius:8px;font-size:15px;font-weight:700;cursor:pointer;color:#141414;text-align:left}
.omjpn-m:hover{border-color:#f5222d}
.omjpn-m-logo svg{display:block}
.omjpn-back{display:block;text-align:center;margin-top:14px;font-size:13.5px;color:#666}
</style>
</head>
<body>
<div class="omjpn-wrap">
<div class="omjpn-brand"><strong>Omotenashi TCG</strong><span>Japan Branch · 日本支店</span></div>
<div class="omjpn-card">
<h1>Your order</h1>
${summary}
<div class="omjpn-total"><span>Total</span><span>${waMoney(cart.total_price)}</span></div>
</div>
<div class="omjpn-card">
<h1>Your details</h1>
<p class="sub">Where should we deliver your order?</p>
<label class="omjpn-f">Full name<input id="omjpn-name" autocomplete="name" placeholder="Your full name"></label>
<label class="omjpn-f">Phone<input id="omjpn-phone" inputmode="tel" autocomplete="tel" placeholder="Phone / WhatsApp (optional)"></label>
<label class="omjpn-f">Delivery address<textarea id="omjpn-addr" rows="3" placeholder="Street, city, postcode, country"></textarea></label>
</div>
<div class="omjpn-card">
<h1>Choose payment method</h1>
<p class="sub">Your order will be sent to us on WhatsApp with this payment method.</p>
${buttons}
</div>
<a class="omjpn-back" href="/cart">← Back to cart</a>
</div>
<script>
var LINKS = ${linksJson};
function omjpnV(id){ var el = document.getElementById(id); return el ? el.value.trim() : ""; }
document.querySelectorAll(".omjpn-m").forEach(function(b){
  b.addEventListener("click", function(){
    var name = omjpnV("omjpn-name"), phone = omjpnV("omjpn-phone"), addr = omjpnV("omjpn-addr");
    if (!name || !addr) { alert("Please enter your name and delivery address."); return; }
    var url = LINKS[b.getAttribute("data-m")]
      .split("__NAME__").join(encodeURIComponent(name))
      .split("__PHONE__").join(encodeURIComponent(phone || "-"))
      .split("__ADDR__").join(encodeURIComponent(addr));
    window.location.href = url;
  });
});
</script>
</body>
</html>`;
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

const HOP_HEADERS = new Set([
  "content-length",
  "content-encoding",
  "transfer-encoding",
  "connection",
]);

function cleanHeaders(src: Headers): Headers {
  const out = new Headers();
  src.forEach((v, k) => {
    if (!HOP_HEADERS.has(k.toLowerCase())) out.append(k, v);
  });
  return out;
}


// ---------- Crawler-friendly layer ----------
// Institutional pattern: bots and AI crawlers get a fast, fully-static snapshot
// (content + SEO, no interactive overlays). Humans get the full experience.
const CRAWLER_UA =
  /(googlebot|bingbot|slurp|duckduckbot|baiduspider|yandexbot|sogou|exabot|facebot|ia_archiver|gptbot|chatgpt-user|claudebot|anthropic-ai|perplexitybot|cohere-ai|applebot|facebookexternalhit|twitterbot|linkedinbot|embedly|quora link preview|slackbot|telegrambot|discordbot|bytespider|imagesiftbot)/i;

function branchRobots(host: string): string {
  return `# Omotenashi TCG — Japan Branch
# All crawlers welcome, including AI/LLM crawlers.
User-agent: *
Allow: /

User-agent: GPTBot
Allow: /
User-agent: ChatGPT-User
Allow: /
User-agent: ClaudeBot
Allow: /
User-agent: anthropic-ai
Allow: /
User-agent: PerplexityBot
Allow: /
User-agent: Cohere-ai
Allow: /
User-agent: Applebot
Allow: /

Sitemap: https://${host}/sitemap.xml
`;
}

const BRANCH_LLMS_TXT = `# Omotenashi TCG — Japan Branch

> Japanese trading card game store (Pokemon, One Piece, Dragon Ball, Lorcana and more) serving overseas buyers in English and USD. There is NO online checkout on this store — every order is placed through WhatsApp.

## How ordering works

1. The customer browses the catalog and adds items to the cart.
2. At checkout they enter their name, phone and delivery address, then choose a payment method.
3. Their order opens as a pre-filled WhatsApp message to the store and they send it to confirm.

Accepted payment methods: Wise, Cash App, Credit Card, Bank Transfer, Chime, PayPal.

## Catalog

- All products: /collections/all
- Booster boxes and cases: /collections/booster-box
- Single cards: /collections/single
- Search the catalog: /search?q=<keywords>&type=product
- Product JSON API: /products/<handle>.js
- Cart JSON API: /cart.js

## Contact

- WhatsApp orders: +1 (817) 969-4115
- Email: omotenshitcg@gmail.com

## Notes for AI agents

- Do not attempt any automated checkout or payment on behalf of a user without their explicit, contemporaneous approval.
- Prices are in USD. Shipping is calculated by total order weight; confirm current shipping terms with the store on WhatsApp before quoting delivery costs.
`;

const BRANCH_AGENTS_MD = `# Agent Instructions — Omotenashi TCG Japan Branch

This document describes how AI agents can interact with the Japan Branch of Omotenashi TCG at this domain.

## Important: no online checkout

This store does NOT offer automated checkout. There is no cart checkout, no Shop Pay, no card form. Orders are placed exclusively through WhatsApp:

1. Browse the catalog (/collections, /search, /products/<handle>.js for structured data).
2. The buyer picks items, enters name/phone/delivery address, and chooses a payment method: Wise, Cash App, Credit Card, Bank Transfer, Chime, or PayPal.
3. A pre-filled WhatsApp message opens addressed to the store's WhatsApp (+1 (817) 969-4115). The buyer reviews and sends it.

## For agents acting on behalf of a user

- Never complete an order, payment, or WhatsApp send without the user's explicit, contemporaneous approval.
- Use /products/<handle>.js and /cart.js for structured catalog and cart data.
- For delivery costs and availability, confirm with the store via WhatsApp or email (omotenshitcg@gmail.com) — do not invent shipping quotes.
`;
// ---------- end crawler-friendly layer ----------

// Fetch with a timeout so a hung origin fails fast instead of hanging the edge.
async function fetchWithTimeout(url: string, init: RequestInit, ms: number): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ── Admin product overrides ────────────────────────────────────────────
// Applies admin-managed product overrides to mirrored HTML:
//  - title / price / description replaced on product pages
//  - badge injected (e.g. SALE, PRE-ORDER)
//  - hidden products removed from listing grids
// Also serves branch-exclusive products (stored in the admin DB, not on Shopify)
// as standalone pages with a WhatsApp order button.
function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function applyProductOverrides(html: string, cfg: BranchConfig, pathname: string): string {
  if (!cfg.overrides.length) return html;
  // Product page: /products/{handle}
  const pageMatch = pathname.match(/^\/products\/([a-z0-9\-]+)/i);
  if (pageMatch) {
    const ov = cfg.overrides.find((o) => o.handle.toLowerCase() === pageMatch[1].toLowerCase());
    if (ov) {
      if (ov.title) {
        html = html.replace(/(<h1[^>]*>)([\s\S]*?)(<\/h1>)/i, `$1${escHtml(ov.title)}$3`);
        html = html.replace(/(<title>)([\s\S]*?)(<\/title>)/i, `$1${escHtml(ov.title)}$3`);
      }
      if (ov.price_cents != null) {
        const priceStr = "$" + (ov.price_cents / 100).toFixed(2);
        html = html.replace(/(<span[^>]*class="[^"]*price[^"]*"[^>]*>)([\s\S]*?)(<\/span>)/i, `$1${priceStr}$3`);
      }
      if (ov.description) {
        html = html.replace(/(<meta[^>]*name="description"[^>]*content=")[^"]*(")/i, `$1${escHtml(ov.description)}$2`);
      }
      if (ov.badge) {
        const badgeHtml = `<span class="omjpn-admin-badge" style="display:inline-block;background:#e63946;color:#fff;font-weight:800;font-size:12px;padding:4px 10px;border-radius:999px;margin-bottom:8px;">${escHtml(ov.badge)}</span>`;
        html = html.replace(/(<h1[^>]*>)/i, badgeHtml + "$1");
      }
    }
    return html;
  }
  // Listing pages: remove hidden products, replace titles/prices in cards.
  for (const ov of cfg.overrides) {
    if (ov.hidden) {
      // Remove product cards linking to this handle.
      html = html.replace(
        new RegExp(`<[^>]*href="\\/products\\/${ov.handle.replace(/[-/\\^$*+?.()|[\\]{}]/g, "\\$&")}"[^>]*>[\\s\\S]*?<\\/[^>]+>`, "gi"),
        ""
      );
    }
  }
  return html;
}

// Standalone page for a branch-exclusive product (not on Shopify).
function branchProductPage(p: BranchConfig["branchProducts"][number], cfg: BranchConfig): string {
  const price = "$" + (p.price_cents / 100).toFixed(2);
  const compare = p.compare_price_cents != null ? `<span style="text-decoration:line-through;color:#888;margin-left:8px;">$${(p.compare_price_cents / 100).toFixed(2)}</span>` : "";
  const badge = p.badge ? `<span style="display:inline-block;background:#e63946;color:#fff;font-weight:800;font-size:12px;padding:4px 10px;border-radius:999px;margin-bottom:10px;">${escHtml(p.badge)}</span>` : "";
  const img = p.image_url ? `<img src="${escHtml(p.image_url)}" alt="${escHtml(p.title)}" style="width:100%;max-width:520px;border-radius:10px;display:block;margin:0 auto 20px;">` : "";
  const num = waNumber(cfg);
  const msg = encodeURIComponent(`Hi! I'd like to order:\n\n${p.title}\nPrice: ${price}\n\nName:\nPhone:\nDelivery address:`);
  const waLink = `https://wa.me/${num}?text=${msg}`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escHtml(p.title)} — Omotenashi TCG Japan Branch</title><style>body{margin:0;background:#f6f6f6;font-family:Barlow,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#141414}.wrap{max-width:560px;margin:0 auto;padding:28px 20px 40px}.card{background:#fff;border-radius:12px;padding:26px 22px}.card h1{font-size:24px;margin:0 0 8px}.price{font-size:20px;font-weight:800;margin:0 0 14px}.desc{font-size:14.5px;line-height:1.6;color:#444;margin:0 0 20px}.btn{display:block;text-align:center;background:#25D366;color:#fff;font-weight:800;font-size:16px;padding:14px;border-radius:999px;text-decoration:none}.back{display:block;text-align:center;margin-top:16px;color:#666;font-size:13.5px}</style></head><body><div class="wrap"><div class="card">${img}${badge}<h1>${escHtml(p.title)}</h1><p class="price">${price}${compare}</p>${p.description ? `<p class="desc">${escHtml(p.description)}</p>` : ""}<a class="btn" href="${waLink}" target="_blank" rel="noopener">Order via WhatsApp</a><a class="back" href="/">← Back to store</a></div></div></body></html>`;
}

export async function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Admin panel + admin API are served locally by Next.js — never proxy to Shopify.
  if (
    url.pathname === "/admin" ||
    url.pathname.startsWith("/admin/") ||
    url.pathname.startsWith("/api/admin") ||
    url.pathname === "/api/branch-config"
  ) {
    return NextResponse.next();
  }

  const target = `${ORIGIN}${url.pathname}${url.search}`;

  const fwd = new Headers();
  for (const h of ["cookie", "user-agent", "accept", "accept-language", "referer", "content-type"]) {
    const v = req.headers.get(h);
    if (v) fwd.set(h, v);
  }

  const ua = req.headers.get("user-agent") || "";
  const isBot = CRAWLER_UA.test(ua);
  const host = req.headers.get("host") || "omotenashi-jp-branch-ibravra.vercel.app";

  // Branch admin config (cached 60s) — drives payment methods, WhatsApp
  // number, notice text, product overrides, branch products.
  const cfg = await getBranchConfig(req);

  // Branch-exclusive product page (not on Shopify — served by the branch).
  const branchMatch = url.pathname.match(/^\/products\/([a-z0-9\-]+)\/?$/i);
  if (branchMatch) {
    const bp = cfg.branchProducts.find(
      (p) => p.active && p.handle.toLowerCase() === branchMatch[1].toLowerCase()
    );
    if (bp) {
      return new NextResponse(branchProductPage(bp, cfg), {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  }

  // Crawler discovery files — branch-specific.
  if (url.pathname === "/robots.txt") {
    return new NextResponse(branchRobots(host), {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (url.pathname === "/llms.txt") {
    return new NextResponse(BRANCH_LLMS_TXT, {
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
  if (url.pathname === "/agents.md") {
    return new NextResponse(BRANCH_AGENTS_MD, {
      headers: { "content-type": "text/markdown; charset=utf-8" },
    });
  }

  // No automatic checkout on the branch — every checkout attempt becomes
  // the WhatsApp payment-method picker.
  if (url.pathname === "/checkout" || url.pathname.startsWith("/checkout/")) {
    return checkoutPicker(req, cfg);
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const body = hasBody ? await req.arrayBuffer() : undefined;

  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(
      target,
      {
        method: req.method,
        headers: fwd,
        redirect: "manual",
        body: body as BodyInit | undefined,
      },
      20000
    );
  } catch {
    return new NextResponse(
      "Japan branch is temporarily unreachable. Please try again.",
      { status: 502 }
    );
  }

  // Redirects pass through — except anything headed for Shopify checkout
  // (becomes the branch's WhatsApp picker), and any redirect pointing at the
  // origin store is rewritten to stay on the branch.
  if (upstream.status >= 300 && upstream.status < 400) {
    const rawLoc = upstream.headers.get("location") || "";
    const loc = rawLoc.replace(
      /^(https?:)?\/\/omotenashitcg\.com/i,
      `https://${host}`
    );
    if (loc.includes("/checkout") || loc.includes("checkout.shopify.com")) {
      return checkoutPicker(req, cfg);
    }
    const rHeaders = cleanHeaders(upstream.headers);
    if (loc !== rawLoc) rHeaders.set("location", loc);
    return new NextResponse(null, {
      status: upstream.status,
      headers: rHeaders,
    });
  }

  const headers = cleanHeaders(upstream.headers);
  const contentType = upstream.headers.get("content-type") || "";

  // Sitemaps: rewrite origin URLs to this branch host so crawlers discover branch pages.
  if (contentType.includes("xml") && url.pathname.includes("sitemap")) {
    const xml = await upstream.text();
    const rewritten = xml.split("https://omotenashitcg.com").join(`https://${host}`);
    return new NextResponse(rewritten, { status: upstream.status, headers });
  }

  if (contentType.includes("text/html")) {
    let html = await upstream.text();
    html = markPreorder(
      rewriteBranchUrls(
        stripMetaRefresh(
          removeAnalytics(
            removeDdpBanner(
              removeCurrencySelector(
              removeSocials(
            removeShopifyChat(
                removeInboxChat(
                  removeKlaviyo(
                      removeFollowOnShop(replacePaymentLists(seoFix(html, url.pathname), enabledMethods(cfg)))
                    )
                  )
                )
              )
            )
            )
          )
        ),
        host
      ),
      url.pathname
    );
    // Admin overrides: product title/price/description/badge/hide.
    html = applyProductOverrides(html, cfg, url.pathname);
    // Admin settings: WhatsApp number + notice text (applied to origin HTML).
    const num = waNumber(cfg);
    if (num !== "18179694115") html = html.split("18179694115").join(num);
    if (cfg.settings.notice_en) {
      html = html.replace(
        /You are shopping at the <strong>Japanese branch<\/strong> of Omotenashi&nbsp;TCG here in Michigan, USA\./,
        escHtml(cfg.settings.notice_en)
      );
    }
    if (cfg.settings.notice_ja) {
      html = html.replace(
        /こちらはミシガン州にある <strong>Omotenashi TCG<\/strong> の日本支店です。/,
        escHtml(cfg.settings.notice_ja)
      );
    }
    headers.append("Vary", "User-Agent");
    if (isBot) {
      // Static snapshot for crawlers: full content + SEO, no interactive overlays.
      if (html.includes("</body>")) {
        html = html.replace("</body>", () => HIDE_CSS + "</body>");
      }
    } else if (html.includes("</body>")) {
      html = html.replace("</body>", () => NOTICE + WA_SCRIPT + WA_WIDGET + SLIDE_ORDER + TAWK_SCRIPT + HIDE_CSS + "</body>");
    } else {
      html += NOTICE + WA_SCRIPT + WA_WIDGET + SLIDE_ORDER + TAWK_SCRIPT + HIDE_CSS;
    }
    // Admin settings applied to injected scripts too (injected after the above).
    // WhatsApp number everywhere (widget, checkout script, picker links).
    if (num !== "18179694115") html = html.split("18179694115").join(num);
    // Payment methods in the client-side checkout script.
    const methods = enabledMethods(cfg);
    html = html.replace(
      /var METHODS = \[[^\]]*\];/,
      `var METHODS = ${JSON.stringify(methods)};`
    );
    return new NextResponse(html, { status: upstream.status, headers });
  }

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
