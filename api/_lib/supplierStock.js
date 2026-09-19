const LOGIN_URL = "https://store.dreamlove.es/esacceso/";
const CATALOG_PAGE_URL = "https://store.dreamlove.es/mc-1-52/";
const CATALOG_ACTION_URL = "https://store.dreamlove.es/mis_catalogos_accion.php";
const HOME_URL = "https://store.dreamlove.es/";
const MOB_BRAND_ID = "1096";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

function mergeCookies(cookieMap, setCookieHeaders) {
  for (const c of setCookieHeaders.map((c) => c.split(";")[0]).filter(Boolean)) {
    const eq = c.indexOf("=");
    if (eq > 0) cookieMap[c.slice(0, eq)] = c.slice(eq + 1);
  }
}

function cookieStr(cookieMap) {
  return Object.entries(cookieMap).map(([k, v]) => `${k}=${v}`).join("; ");
}

// Authenticate to B2B and return session cookie string
async function authenticateB2B(login, password) {
  const cookieMap = {};

  // Step 1: GET login page to establish session
  const preRes = await fetch(LOGIN_URL, {
    method: "GET",
    redirect: "manual",
    headers: { "User-Agent": UA },
  });
  mergeCookies(cookieMap, preRes.headers.getSetCookie?.() || []);

  // Step 2: POST login
  const loginBody = new URLSearchParams();
  loginBody.set("acc", "login");
  loginBody.set("idsite", "1");
  loginBody.set("idioma", "50");
  loginBody.set("idplantilla", "5");
  loginBody.set("login", login);
  loginBody.set("password", password);
  loginBody.set("enviar", "entrar");

  const loginRes = await fetch(LOGIN_URL, {
    method: "POST",
    body: loginBody,
    redirect: "manual",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      "Referer": LOGIN_URL,
      "Cookie": cookieStr(cookieMap),
      "Origin": "https://store.dreamlove.es",
    },
  });
  mergeCookies(cookieMap, loginRes.headers.getSetCookie?.() || []);

  // Step 3: Follow redirect to homepage to complete auth
  const homeRes = await fetch(HOME_URL, {
    method: "GET",
    redirect: "manual",
    headers: {
      Cookie: cookieStr(cookieMap),
      "User-Agent": UA,
      "Referer": LOGIN_URL,
    },
  });
  mergeCookies(cookieMap, homeRes.headers.getSetCookie?.() || []);

  return cookieStr(cookieMap);
}

export async function checkDreamloveConnection() {
  const login = process.env.DREAMLOVE_B2B_LOGIN;
  const password = process.env.DREAMLOVE_B2B_PASSWORD;
  if (!login || !password) return { ok: false, status: 503 };
  const sessionCookie = await authenticateB2B(login, password);
  const pageRes = await fetch(CATALOG_PAGE_URL, {
    headers: { Cookie: sessionCookie, 'User-Agent': UA },
  });
  const pageBody = await pageRes.text();
  return {
    ok: pageRes.ok && /formulario_mis_catalogos_exportar/i.test(pageBody),
    status: pageRes.status,
  };
}

// Get MOB-filtered CSV URL by submitting the export form
async function getMobCsvUrl(cookieStr) {
  // GET catalog page
  const pageRes = await fetch(CATALOG_PAGE_URL, {
    method: "GET",
    redirect: "manual",
    headers: { Cookie: cookieStr, "User-Agent": UA },
  });
  const pageBody = await pageRes.text();

  // Extract the export form HTML
  const formMatch = pageBody.match(/<form[^>]*name=["']formulario_mis_catalogos_exportar["'][\s\S]*?<\/form>/i);
  if (!formMatch) {
    return { error: "Export form not found on catalog page" };
  }
  const formHtml = formMatch[0];

  // Parse all form fields dynamically
  const formFields = {};

  // Hidden inputs: <input type="hidden" name="X" value="Y">
  const hiddenRe = /<input[^>]*type=["']hidden["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi;
  let m;
  while ((m = hiddenRe.exec(formHtml)) !== null) {
    formFields[m[1]] = m[2];
  }
  // Also: <input ... value="Y" ... name="X" ... type="hidden">
  const hiddenRe2 = /<input[^>]*value=["']([^"']*)["'][^>]*name=["']([^"']+)["'][^>]*type=["']hidden["']/gi;
  while ((m = hiddenRe2.exec(formHtml)) !== null) {
    if (!formFields[m[2]]) formFields[m[2]] = m[1];
  }
  // Also: <input ... name="X" ... type="hidden" ... value="Y">
  const hiddenRe3 = /<input[^>]*name=["']([^"']+)["'][^>]*type=["']hidden["'][^>]*value=["']([^"']*)["']/gi;
  while ((m = hiddenRe3.exec(formHtml)) !== null) {
    if (!formFields[m[1]]) formFields[m[1]] = m[2];
  }

  // Checked checkboxes
  const checkedRe = /<input[^>]*type=["']checkbox["'][^>]*name=["']([^"']+)["'][^>]*checked=["']checked["'][^>]*value=["']([^"']*)["']/gi;
  while ((m = checkedRe.exec(formHtml)) !== null) {
    if (!formFields[m[1]]) formFields[m[1]] = m[2];
  }
  // Also: checked before name
  const checkedRe2 = /<input[^>]*checked=["']checked["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi;
  while ((m = checkedRe2.exec(formHtml)) !== null) {
    if (!formFields[m[1]]) formFields[m[1]] = m[2];
  }

  // Submit buttons (name/value)
  const submitRe = /<input[^>]*type=["']submit["'][^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["']/gi;
  while ((m = submitRe.exec(formHtml)) !== null) {
    if (!formFields[m[1]]) formFields[m[1]] = m[2];
  }

  // Select all fields checkbox
  formFields["campotodos"] = "1";

  // Add MOB brand filter
  formFields["mar_id[]"] = MOB_BRAND_ID;

  // Submit form
  const exportBody = new URLSearchParams();
  for (const [k, v] of Object.entries(formFields)) {
    exportBody.set(k, v);
  }

  const exportRes = await fetch(CATALOG_ACTION_URL, {
    method: "POST",
    body: exportBody,
    redirect: "manual",
    headers: {
      Cookie: cookieStr,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": UA,
      "Origin": "https://store.dreamlove.es",
      "Referer": CATALOG_PAGE_URL,
    },
  });

  // Check for redirect (302) to CSV
  const location = exportRes.headers.get("location");
  if (location) {
    const fullUrl = location.startsWith("http") ? location : `https://store.dreamlove.es${location}`;
    // Follow redirect
    const redirectRes = await fetch(fullUrl, {
      method: "GET",
      redirect: "manual",
      headers: { Cookie: cookieStr, "User-Agent": UA },
    });
    // If redirect IS the CSV
    if (redirectRes.headers.get("content-type")?.includes("csv") || fullUrl.includes(".csv")) {
      return { csvUrl: fullUrl };
    }
    // Extract CSV URL from redirect body
    const redirectBody = await redirectRes.text().catch(() => "");
    const csvMatch = redirectBody.match(/https?:\/\/[^\s"']*\.csv[^\s"']*/i);
    if (csvMatch) return { csvUrl: csvMatch[0] };
  }

  // Check if response IS the CSV
  if (exportRes.headers.get("content-type")?.includes("csv")) {
    return { csvUrl: exportRes.url };
  }

  // Check response body for CSV URL
  const exportBodyText = await exportRes.text().catch(() => "");
  const csvMatch = exportBodyText.match(/https?:\/\/[^\s"']*\.csv[^\s"']*/i);
  if (csvMatch) return { csvUrl: csvMatch[0] };

  // Look for dyndata/csvzip URLs
  const dyndataMatch = exportBodyText.match(/https?:\/\/[^\s"']*dyndata[^\s"']*/i);
  if (dyndataMatch) return { csvUrl: dyndataMatch[0] };

  return {
    error: "No CSV URL found after form submission",
    status: exportRes.status,
    formFields: Object.keys(formFields),
    snippet: exportBodyText.slice(0, 1000),
  };
}

async function supplierStockResponse() {
  try {
    const serviceKey = process.env.SUPABASE_SECRET_KEY;
    const baseUrl = `${process.env.SUPABASE_URL}/rest/v1`;
    const supaHeaders = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    // 0. Authenticate to B2B and get MOB-filtered CSV URL
    const login = process.env.DREAMLOVE_B2B_LOGIN;
    const password = process.env.DREAMLOVE_B2B_PASSWORD;
    if (!login || !password) {
      return Response.json({ error: "Missing B2B credentials" }, { status: 500 });
    }

    const b2bCookie = await authenticateB2B(login, password);
    const csvResult = await getMobCsvUrl(b2bCookie);

    if (csvResult.error) {
      return Response.json({ error: csvResult.error, details: csvResult }, { status: 500 });
    }

    const supplierCsvUrl = csvResult.csvUrl;

    // 1. Fetch all existing products with SKU and variant_skus
    const productsRes = await fetch(`${baseUrl}/products?select=id,name,sku,variant_skus,stock,product_options`, { headers: supaHeaders });
    const products = await productsRes.json();

    // Build a lookup: sku -> { product, variantKey }
    const skuLookup = {};
    (products || []).forEach((p) => {
      const hasVariantSkus = p.variant_skus && typeof p.variant_skus === 'object' && Object.keys(p.variant_skus).length > 0;
      const hasOptions = p.product_options && Array.isArray(p.product_options) && p.product_options.length > 0;

      if (hasVariantSkus) {
        for (const [key, sku] of Object.entries(p.variant_skus)) {
          if (sku) {
            skuLookup[String(sku).toLowerCase().trim()] = { product: p, variantKey: key };
          }
        }
      } else if (p.sku && !hasOptions) {
        skuLookup[p.sku.toLowerCase().trim()] = { product: p, variantKey: '_default' };
      }
    });

    // Cache for stock updates
    const stockCache = {};
    (products || []).forEach((p) => {
      stockCache[p.id] = p.stock || {};
    });

    // 2. Fetch and stream CSV
    const csvRes = await fetch(supplierCsvUrl, {
      headers: { Cookie: b2bCookie, "User-Agent": UA },
    });
    if (!csvRes.ok || !csvRes.body) {
      return Response.json({ error: `CSV fetch failed: ${csvRes.status}`, url: supplierCsvUrl }, { status: 500 });
    }

    // 3. Stream parse CSV — only extract sku, name, and stock columns
    const reader = csvRes.body.getReader();
    const decoder = new TextDecoder();

    let skuIdx = -1, nameIdx = -1, stockIdx = -1, thereIsStockIdx = -1;
    let headerParsed = false;
    let neededCols = null;
    let firstRow = true;

    const supplierData = {};
    let csvRowCount = 0;

    let buffer = "";
    let currentRow = [];
    let currentValue = "";
    let inQuotes = false;
    let currentCol = 0;

    function processRow(row) {
      if (firstRow) {
        skuIdx = row.indexOf("sku");
        nameIdx = row.indexOf("name");
        stockIdx = row.indexOf("available_stock");
        thereIsStockIdx = row.indexOf("there_is_stock");
        neededCols = new Set([skuIdx, nameIdx, stockIdx, thereIsStockIdx].filter((i) => i !== -1));
        firstRow = false;
        headerParsed = true;
        return;
      }
      csvRowCount++;
      const sku = (row[skuIdx] || "").trim();
      if (!sku) return;
      const name = (row[nameIdx] || "").trim();
      let stock = 0;
      if (thereIsStockIdx !== -1) {
        const hasStock = row[thereIsStockIdx] === "1" || (row[thereIsStockIdx] || "").toLowerCase() === "true";
        if (hasStock && stockIdx !== -1) {
          stock = Number(row[stockIdx]) || 0;
        }
      } else if (stockIdx !== -1) {
        stock = Number(row[stockIdx]) || 0;
      }
      supplierData[sku.toLowerCase().trim()] = { stock, name };
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let i = 0;
      while (i < buffer.length) {
        const char = buffer[i];
        const accumulate = !headerParsed || (neededCols && neededCols.has(currentCol));

        if (inQuotes && char === '"') {
          if (i + 1 < buffer.length) {
            if (buffer[i + 1] === '"') {
              if (accumulate) currentValue += '"';
              i += 2;
            } else {
              inQuotes = false;
              i++;
            }
          } else {
            break;
          }
        } else if (inQuotes) {
          if (accumulate) currentValue += char;
          i++;
        } else if (char === '"') {
          inQuotes = true;
          i++;
        } else if (char === ";") {
          currentRow.push(accumulate ? currentValue : "");
          currentValue = "";
          currentCol++;
          i++;
        } else if (char === "\n") {
          currentRow.push(accumulate ? currentValue : "");
          processRow(currentRow);
          currentRow = [];
          currentValue = "";
          currentCol = 0;
          i++;
        } else if (char === "\r") {
          i++;
        } else {
          if (accumulate) currentValue += char;
          i++;
        }
      }

      buffer = buffer.slice(i);
    }

    // Final row
    if (currentValue !== "" || currentRow.length > 0) {
      const accumulate = !headerParsed || (neededCols && neededCols.has(currentCol));
      currentRow.push(accumulate ? currentValue : "");
      processRow(currentRow);
    }

    if (skuIdx === -1) {
      return Response.json({ error: 'CSV "sku" column not found', csvUrl: supplierCsvUrl, csvRows: csvRowCount }, { status: 500 });
    }

    // 4. Match and update by SKU (single or per-variant)
    let matched = 0;
    let updated = 0;
    let skipped = 0;
    let notMatched = 0;
    const errors = [];
    const notMatchedSample = [];

    for (const [supplierSku, data] of Object.entries(supplierData)) {
      const match = skuLookup[supplierSku];
      if (!match) {
        notMatched++;
        if (notMatchedSample.length < 10) notMatchedSample.push({ sku: supplierSku, name: data.name });
        continue;
      }

      const { product, variantKey } = match;
      matched++;

      const currentStock = stockCache[product.id] || {};
      const currentVariantStock = currentStock[variantKey] || 0;
      if (currentVariantStock === data.stock) {
        skipped++;
        continue;
      }

      // Build the new stock object
      const newStock = { ...currentStock };
      if (data.stock === 0) {
        delete newStock[variantKey];
      } else {
        newStock[variantKey] = data.stock;
      }

      try {
        const updateRes = await fetch(`${baseUrl}/products?id=eq.${product.id}`, {
          method: "PATCH",
          headers: supaHeaders,
          body: JSON.stringify({ stock: newStock, updated_date: new Date().toISOString() }),
        });
        if (updateRes.ok) {
          updated++;
          stockCache[product.id] = newStock;
        } else {
          errors.push({ sku: supplierSku, error: `PATCH ${updateRes.status}` });
        }
      } catch (e) {
        errors.push({ sku: supplierSku, error: e.message });
      }
    }

    return Response.json({
      csvUrl: supplierCsvUrl,
      csvRows: csvRowCount,
      supplierProducts: Object.keys(supplierData).length,
      dbProductsWithSku: Object.keys(skuLookup).length,
      matched,
      updated,
      skipped,
      notMatched,
      notMatchedSample,
      errors: errors.slice(0, 20),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function syncSupplierStock() {
  const response = await supplierStockResponse();
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Échec de synchronisation Dreamlove');
    error.status = response.status;
    error.details = data.details;
    throw error;
  }
  return data;
}
