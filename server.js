const express = require('express');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const mysql = require('mysql2/promise');
const Stripe = require('stripe');
const jwt = require('jsonwebtoken');
const { PRODUCTS, publicProduct } = require('./products');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const pool = process.env.DATABASE_URL ? mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 5, waitForConnections: true }) : null;
let dbReady = false;


function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map(part => part.trim()).filter(Boolean).map(part => {
    const index = part.indexOf('=');
    return index < 0 ? [part, ''] : [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
  }));
}
function setSessionCookie(res, token, maxAge = 60 * 60 * 24 * 30) {
  res.setHeader('Set-Cookie', `webdev_app_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`);
}
function setStateCookie(res, nonce) {
  res.setHeader('Set-Cookie', `hb_oauth_state=${encodeURIComponent(nonce)}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=600`);
}
function clearStateCookie(res) {
  res.append('Set-Cookie', 'hb_oauth_state=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0');
}
function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'webdev_app_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0');
}
function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name, marketingConsent: Boolean(row.marketing_consent), createdAt: row.created_at };
}
async function upsertUser(identity) {
  if (!dbReady) await ensureDatabase();
  const openId = String(identity.openId || '').trim();
  const email = String(identity.email || '').trim();
  const name = String(identity.name || email.split('@')[0] || 'Client Hammey').trim();
  if (!openId || !email) throw new Error('Identité OAuth incomplète');
  await pool.query(`INSERT INTO hb_users(open_id,email,name) VALUES (?,?,?) ON DUPLICATE KEY UPDATE email=VALUES(email), name=VALUES(name)`, [openId, email, name]);
  const [rows] = await pool.query('SELECT * FROM hb_users WHERE open_id = ?', [openId]);
  return rows[0];
}
async function sessionUser(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const bearer = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const token = cookies.webdev_app_session || bearer;
  if (!token || !process.env.MANUS_JWT_SECRET || !process.env.MANUS_PROJECT_ID) return null;
  try {
    const payload = jwt.verify(token, process.env.MANUS_JWT_SECRET, { algorithms: ['HS256'] });
    if (payload.appId && payload.appId !== process.env.MANUS_PROJECT_ID) return null;
    const openId = payload.openId || payload.open_id || payload.sub;
    if (!openId || !pool) return null;
    if (!dbReady) await ensureDatabase();
    const [rows] = await pool.query('SELECT * FROM hb_users WHERE open_id = ?', [openId]);
    return rows[0] || null;
  } catch { return null; }
}
function oauthConfigReady() {
  return Boolean(process.env.MANUS_PROJECT_ID && process.env.MANUS_OAUTH_PORTAL_URL && process.env.MANUS_OAUTH_API_URL && process.env.MANUS_JWT_SECRET);
}

function money(cents) { return (cents / 100).toFixed(2); }
function orderNumber() { return `HB-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`; }
function json(value) { return JSON.stringify(value); }
function parseJson(value, fallback) { try { return typeof value === 'string' ? JSON.parse(value) : (value ?? fallback); } catch { return fallback; } }
function publicOrigin(req) {
  if (process.env.PUBLIC_ORIGIN) return process.env.PUBLIC_ORIGIN.replace(/\/$/, '');
  const proto = req.get('x-forwarded-proto') || 'https';
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}
function bad(res, message, status = 400) { return res.status(status).json({ error: message }); }

async function ensureDatabase() {
  if (!pool) throw new Error('DATABASE_URL manquante');
  const schema = fs.readFileSync(path.join(ROOT, 'schema.sql'), 'utf8');
  const statements = schema.split(';').map(s => s.trim()).filter(Boolean);
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const statement of statements) await conn.query(statement);
    for (const p of PRODUCTS) {
      await conn.query(
        `INSERT INTO hb_products (id,name,category,price_cents,description,option_label,options_json,stock_json,images_json)
         VALUES (?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE name=VALUES(name), category=VALUES(category), price_cents=VALUES(price_cents), description=VALUES(description), option_label=VALUES(option_label), options_json=VALUES(options_json), images_json=VALUES(images_json)`,
        [p.id, p.name, p.category, p.priceCents, p.description, p.optionLabel, json(p.options), json(p.stock), json(p.images)]
      );
    }
    await conn.commit();
    dbReady = true;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function productRows() {
  if (!dbReady) await ensureDatabase();
  const [rows] = await pool.query('SELECT * FROM hb_products WHERE active = TRUE ORDER BY id');
  return rows.map(row => ({ ...row, priceCents: row.price_cents, options: parseJson(row.options_json, []), stock: parseJson(row.stock_json, {}), images: parseJson(row.images_json, []) }));
}
async function getProduct(id) { return (await productRows()).find(p => p.id === Number(id)); }

function validateCustomer(body) {
  const customer = body.customer || {};
  const shipping = body.shipping || {};
  const email = String(customer.email || '').trim();
  const firstName = String(customer.firstName || '').trim();
  const lastName = String(customer.lastName || '').trim();
  const address = String(shipping.address || '').trim();
  const postalCode = String(shipping.postalCode || '').trim();
  const city = String(shipping.city || '').trim();
  const country = String(shipping.country || 'France').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Adresse e-mail invalide');
  if (!firstName || !lastName || !address || !city || !/^\d{5}$/.test(postalCode)) throw new Error('Adresse de livraison incomplète');
  return { email, firstName, lastName, address, postalCode, city, country };
}
async function priceCart(items, shippingMethod) {
  if (!Array.isArray(items) || !items.length || items.length > 50) throw new Error('Panier vide ou invalide');
  const products = await productRows();
  const lineItems = [];
  let subtotalCents = 0;
  for (const item of items) {
    const product = products.find(p => p.id === Number(item.productId ?? item.id));
    const option = String(item.option ?? item.s ?? '').trim();
    const quantity = Number(item.quantity ?? item.q);
    if (!product || !product.options.includes(option) || !Number.isInteger(quantity) || quantity < 1 || quantity > 20) throw new Error('Article ou variante invalide');
    const available = Number(product.stock[option] || 0);
    if (available < quantity) throw new Error(`Stock insuffisant pour ${product.name} — ${option}`);
    subtotalCents += product.priceCents * quantity;
    lineItems.push({ productId: product.id, productName: product.name, option, unitPriceCents: product.priceCents, quantity });
  }
  const shippingCents = shippingMethod === 'exp' ? 990 : (subtotalCents >= 8000 ? 0 : 490);
  return { lineItems, subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}

async function createOrder(body) {
  if (!dbReady) await ensureDatabase();
  const customer = validateCustomer(body);
  const shippingMethod = body.shippingMethod === 'exp' ? 'exp' : 'std';
  const paymentMethod = body.paymentMethod === 'paypal' ? 'paypal' : 'stripe';
  const priced = await priceCart(body.items, shippingMethod);
  const number = orderNumber();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO hb_orders (order_number,email,first_name,last_name,address,postal_code,city,country,shipping_method,shipping_cents,subtotal_cents,total_cents,payment_method)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [number, customer.email, customer.firstName, customer.lastName, customer.address, customer.postalCode, customer.city, customer.country, shippingMethod, priced.shippingCents, priced.subtotalCents, priced.totalCents, paymentMethod]
    );
    for (const line of priced.lineItems) {
      await conn.query('INSERT INTO hb_order_items (order_id,product_id,product_name,option_value,unit_price_cents,quantity) VALUES (?,?,?,?,?,?)', [result.insertId, line.productId, line.productName, line.option, line.unitPriceCents, line.quantity]);
    }
    await conn.commit();
    return { id: result.insertId, orderNumber: number, customer, shippingMethod, paymentMethod, ...priced };
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
}

async function loadOrder(number) {
  const [orders] = await pool.query('SELECT * FROM hb_orders WHERE order_number = ?', [number]);
  if (!orders.length) return null;
  const [items] = await pool.query('SELECT product_id, product_name, option_value, unit_price_cents, quantity FROM hb_order_items WHERE order_id = ?', [orders[0].id]);
  return { ...orders[0], items };
}
async function safeOrder(number) {
  const order = await loadOrder(number);
  if (!order) return null;
  return { orderNumber: order.order_number, email: order.email, subtotalCents: order.subtotal_cents, shippingCents: order.shipping_cents, totalCents: order.total_cents, paymentMethod: order.payment_method, paymentStatus: order.payment_status, fulfillmentStatus: order.fulfillment_status, items: order.items.map(i => ({ name: i.product_name, option: i.option_value, quantity: i.quantity, unitPriceCents: i.unit_price_cents })) };
}
async function markPaid(number, providerId, eventId, provider, eventType) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    if (eventId) {
      const [seen] = await conn.query('SELECT event_id FROM hb_payment_events WHERE event_id = ?', [eventId]);
      if (seen.length) { await conn.commit(); return; }
      await conn.query('INSERT INTO hb_payment_events(event_id,provider,event_type) VALUES (?,?,?)', [eventId, provider, eventType]);
    }
    const [orders] = await conn.query('SELECT * FROM hb_orders WHERE order_number = ? FOR UPDATE', [number]);
    if (!orders.length) { await conn.commit(); return; }
    const order = orders[0];
    if (order.payment_status !== 'paid') {
      const [items] = await conn.query('SELECT * FROM hb_order_items WHERE order_id = ?', [order.id]);
      for (const item of items) {
        const [products] = await conn.query('SELECT stock_json FROM hb_products WHERE id = ? FOR UPDATE', [item.product_id]);
        if (!products.length) continue;
        const stock = parseJson(products[0].stock_json, {});
        stock[item.option_value] = Math.max(0, Number(stock[item.option_value] || 0) - item.quantity);
        await conn.query('UPDATE hb_products SET stock_json = ? WHERE id = ?', [json(stock), item.product_id]);
      }
    }
    const fields = provider === 'stripe' ? 'payment_status="paid", fulfillment_status="paid", stripe_payment_intent_id=?' : 'payment_status="paid", fulfillment_status="paid", paypal_order_id=?';
    await conn.query(`UPDATE hb_orders SET ${fields} WHERE id = ?`, [providerId || null, order.id]);
    await conn.commit();
  } catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
}

async function paypalToken() {
  const credentials = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const response = await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token', { method: 'POST', headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
  if (!response.ok) throw new Error(`PayPal token ${response.status}`);
  return (await response.json()).access_token;
}
async function paypalRequest(endpoint, options = {}) {
  const token = await paypalToken();
  const response = await fetch(`https://api-m.sandbox.paypal.com${endpoint}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`PayPal ${response.status}: ${body.name || 'request failed'}`);
  return body;
}

app.use(express.json({ limit: '64kb' }));


app.get('/api/auth/login', (req, res) => {
  if (!oauthConfigReady()) return res.status(503).send('Connexion indisponible');
  const nonce = crypto.randomBytes(24).toString('hex');
  const redirectUri = `${publicOrigin(req)}/api/auth/callback`;
  const state = Buffer.from(JSON.stringify({ redirectUri, nonce })).toString('base64url');
  setStateCookie(res, nonce);
  const url = new URL('/app-auth', process.env.MANUS_OAUTH_PORTAL_URL);
  url.searchParams.set('appId', process.env.MANUS_PROJECT_ID);
  url.searchParams.set('redirectUri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('responseType', 'code');
  res.redirect(url.toString());
});
app.get('/api/auth/callback', async (req, res) => {
  try {
    if (!oauthConfigReady()) return res.redirect('/?auth=error');
    const state = JSON.parse(Buffer.from(String(req.query.state || ''), 'base64url').toString('utf8'));
    const cookies = parseCookies(req.headers.cookie || '');
    if (!state.nonce || !cookies.hb_oauth_state || state.nonce !== cookies.hb_oauth_state || state.redirectUri !== `${publicOrigin(req)}/api/auth/callback`) return res.status(400).send('État OAuth invalide');
    const code = String(req.query.code || '');
    if (!code) return res.redirect('/?auth=error');
    const tokenResponse = await fetch(`${process.env.MANUS_OAUTH_API_URL}/webdev.v1.WebDevAuthPublicService/ExchangeToken`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: process.env.MANUS_PROJECT_ID, grantType: 'authorization_code', code, redirectUri: state.redirectUri }) });
    if (!tokenResponse.ok) throw new Error('Échange OAuth refusé');
    const tokenData = await tokenResponse.json();
    const userResponse = await fetch(`${process.env.MANUS_OAUTH_API_URL}/webdev.v1.WebDevAuthPublicService/GetUserInfo`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenData.accessToken}` }, body: JSON.stringify({ accessToken: tokenData.accessToken }) });
    if (!userResponse.ok) throw new Error('Identité OAuth indisponible');
    const identity = await userResponse.json();
    const user = await upsertUser(identity);
    const session = jwt.sign({ appId: process.env.MANUS_PROJECT_ID, openId: identity.openId, email: user.email, name: user.name }, process.env.MANUS_JWT_SECRET, { algorithm: 'HS256', expiresIn: '30d' });
    setSessionCookie(res, session);
    clearStateCookie(res);
    res.redirect('/?auth=success');
  } catch (error) { console.error('[oauth]', error.message); res.redirect('/?auth=error'); }
});
app.get('/api/auth/logout', (req, res) => { clearSessionCookie(res); res.redirect('/'); });
app.get('/api/auth/me', async (req, res) => { try { const user = await sessionUser(req); res.json(user ? { authenticated: true, user: publicUser(user) } : { authenticated: false }); } catch { res.json({ authenticated: false }); } });
app.post('/api/newsletter/subscribe', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const consent = req.body.consent === true;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return bad(res, 'Adresse e-mail invalide');
    if (!consent) return bad(res, 'Le consentement est nécessaire pour recevoir la newsletter');
    if (!dbReady) await ensureDatabase();
    const user = await sessionUser(req);
    await pool.query(`INSERT INTO hb_newsletter_subscribers(email,user_id,status,consent_at,source) VALUES (?,?, 'subscribed', CURRENT_TIMESTAMP, ?) ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), status='subscribed', consent_at=CURRENT_TIMESTAMP, source=VALUES(source)`, [email, user?.id || null, String(req.body.source || 'footer').slice(0, 80)]);
    if (user) await pool.query('UPDATE hb_users SET marketing_consent = TRUE, marketing_consent_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    res.status(201).json({ subscribed: true, message: 'Inscription confirmée. Vous recevrez nos nouveautés et nos offres.' });
  } catch (error) { res.status(503).json({ error: 'Inscription newsletter indisponible' }); }
});
app.post('/api/account/marketing-consent', async (req, res) => {
  try {
    const user = await sessionUser(req);
    if (!user) return bad(res, 'Connexion requise', 401);
    if (req.body.consent !== true) return bad(res, 'Le consentement est nécessaire');
    await pool.query('UPDATE hb_users SET marketing_consent = TRUE, marketing_consent_at = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
    await pool.query(`INSERT INTO hb_newsletter_subscribers(email,user_id,status,consent_at,source) VALUES (?,?, 'subscribed', CURRENT_TIMESTAMP, 'account') ON DUPLICATE KEY UPDATE user_id=VALUES(user_id), status='subscribed', consent_at=CURRENT_TIMESTAMP, source='account'`, [user.email, user.id]);
    res.json({ subscribed: true, message: 'Votre inscription est confirmée. Votre offre de bienvenue pourra vous être communiquée par e-mail.' });
  } catch { res.status(503).json({ error: 'Inscription indisponible' }); }
});

app.get('/api/health', async (req, res) => res.json({ ok: true, database: dbReady, stripe: Boolean(stripe), paypal: Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET), environment: 'test' }));
app.get('/api/produits', async (req, res) => { try { res.json((await productRows()).map(publicProduct)); } catch (e) { res.status(503).json({ error: 'Base de données indisponible' }); } });
app.get('/api/produits/:id', async (req, res) => { try { const p = await getProduct(req.params.id); if (!p) return bad(res, 'Produit introuvable', 404); res.json(publicProduct(p)); } catch { res.status(503).json({ error: 'Base de données indisponible' }); } });
app.get('/api/commandes/:number', async (req, res) => { try { const order = await safeOrder(req.params.number); if (!order) return bad(res, 'Commande introuvable', 404); res.json(order); } catch { res.status(503).json({ error: 'Base de données indisponible' }); } });

app.post('/api/commandes', async (req, res) => { try { const order = await createOrder(req.body); res.status(201).json({ orderNumber: order.orderNumber, totalCents: order.totalCents, paymentMethod: order.paymentMethod, paymentStatus: 'pending' }); } catch (e) { res.status(400).json({ error: e.message || 'Commande invalide' }); } });
app.post('/api/paiement', async (req, res) => {
  try {
    const number = String(req.body.orderNumber || '').trim();
    const order = await loadOrder(number);
    if (!order) return bad(res, 'Commande introuvable', 404);
    const origin = publicOrigin(req);
    if (order.payment_method === 'stripe') {
      if (!stripe) return bad(res, 'Stripe test n’est pas configuré', 503);
      const items = await pool.query('SELECT * FROM hb_order_items WHERE order_id = ?', [order.id]);
      const lineItems = items[0].map(item => ({ price_data: { currency: 'eur', product_data: { name: `${item.product_name} — ${item.option_value}` }, unit_amount: item.unit_price_cents }, quantity: item.quantity }));
      if (order.shipping_cents) lineItems.push({ price_data: { currency: 'eur', product_data: { name: order.shipping_method === 'exp' ? 'Livraison express' : 'Livraison standard' }, unit_amount: order.shipping_cents }, quantity: 1 });
      const session = await stripe.checkout.sessions.create({ mode: 'payment', customer_email: order.email, client_reference_id: order.order_number, allow_promotion_codes: true, line_items: lineItems, metadata: { order_number: order.order_number, customer_email: order.email }, success_url: `${origin}/?payment=success&order=${encodeURIComponent(order.order_number)}&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/?payment=cancelled&order=${encodeURIComponent(order.order_number)}` });
      await pool.query('UPDATE hb_orders SET stripe_session_id = ? WHERE id = ?', [session.id, order.id]);
      return res.json({ checkoutUrl: session.url });
    }
    if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) return bad(res, 'PayPal Sandbox n’est pas configuré', 503);
    const created = await paypalRequest('/v2/checkout/orders', { method: 'POST', body: JSON.stringify({ intent: 'CAPTURE', purchase_units: [{ reference_id: order.order_number, custom_id: order.order_number, amount: { currency_code: 'EUR', value: money(order.total_cents) }, description: `Commande ${order.order_number}` }], application_context: { brand_name: 'Hammey Bijoux', user_action: 'PAY_NOW', return_url: `${origin}/?paypal=success&order=${encodeURIComponent(order.order_number)}`, cancel_url: `${origin}/?paypal=cancelled&order=${encodeURIComponent(order.order_number)}` } }) });
    await pool.query('UPDATE hb_orders SET paypal_order_id = ? WHERE id = ?', [created.id, order.id]);
    const approve = (created.links || []).find(link => link.rel === 'approve');
    if (!approve) throw new Error('Lien PayPal manquant');
    res.json({ checkoutUrl: approve.href });
  } catch (e) { res.status(400).json({ error: e.message || 'Paiement indisponible' }); }
});
app.post('/api/paypal/capture', async (req, res) => { try { const number = String(req.body.orderNumber || '').trim(); const order = await loadOrder(number); if (!order || !order.paypal_order_id) return bad(res, 'Commande PayPal introuvable', 404); const capture = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(order.paypal_order_id)}/capture`, { method: 'POST', body: '{}' }); const status = capture.status; if (status === 'COMPLETED') await markPaid(number, capture.id || order.paypal_order_id, `paypal:${capture.id || order.paypal_order_id}`, 'paypal', 'checkout.order.captured'); res.json(await safeOrder(number)); } catch (e) { res.status(400).json({ error: e.message || 'Capture PayPal impossible' }); } });

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) return res.status(503).send('Stripe webhook non configuré');
  let event; try { event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET); } catch (e) { return res.status(400).send(`Webhook Error: ${e.message}`); }
  try { if (event.type === 'checkout.session.completed') { const session = event.data.object; await markPaid(session.metadata?.order_number || session.client_reference_id, session.payment_intent, event.id, 'stripe', event.type); } else if (event.type === 'payment_intent.succeeded') { const intent = event.data.object; if (intent.metadata?.order_number) await markPaid(intent.metadata.order_number, intent.id, event.id, 'stripe', event.type); } res.json({ received: true }); } catch (e) { res.status(500).json({ error: 'Webhook non traité' }); }
});

app.post('/api/contact', (req, res) => { const { email, message } = req.body || {}; if (!email || !message) return bad(res, 'E-mail et message obligatoires'); res.status(202).json({ accepted: true, message: 'Message reçu. La messagerie sera reliée à l’e-mail professionnel lors de la prochaine étape.' }); });
app.use(express.static(ROOT, { index: 'index.html' }));
app.use((req, res) => res.sendFile(path.join(ROOT, 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  ensureDatabase().catch(error => console.error('[database]', error.message));
  console.log(`Hammey Bijoux listening on ${PORT}`);
});
