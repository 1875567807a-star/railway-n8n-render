import express from "express";
import { chromium } from "playwright";

const app = express();
const PORT = process.env.PORT || 3010;

/* =========================
   Middlewares
========================= */
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/health", (_, res) => res.json({ ok: true }));

/* =========================
   Theme map
========================= */
const THEME_TITLE_BY_ID = {
  pink: "Rose",
  blue: "Ocean",
  purple: "Royal",
  emerald: "Forest",
  orange: "Sunset",
  cyan: "Mint",
  slate: "Classic",
  lime: "Lime",
  fuchsia: "Fuchsia",
  amber: "Amber",
};

/* =========================
   Playwright browser
========================= */
let browser;
async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

/* =========================================================
   ✅ OLD ENDPOINT — Question Render（完全不动）
========================================================= */
app.post("/render", async (req, res) => {
  const themeId = req.body?.themeId || "blue";
  const questionBlock =
    req.body?.questionBlock ||
    req.body?.question ||
    req.body?.text ||
    "";

  if (!String(questionBlock).trim()) {
    return res.status(400).json({
      ok: false,
      error: "questionBlock is required",
    });
  }

  const themeTitle =
    THEME_TITLE_BY_ID[themeId] || THEME_TITLE_BY_ID.blue;

  let context;
  try {
    const b = await getBrowser();
    context = await b.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/template.html`, {
      waitUntil: "networkidle",
    });

    await page.waitForSelector("#pasteInput");

    await page
      .locator(`button[title="${themeTitle}"]`)
      .click()
      .catch(() => {});

    await page.fill("#pasteInput", questionBlock);
    await page
      .getByRole("button", { name: /Parse and Load Question/i })
      .click();

    const card = page
      .locator("div.relative.bg-white.overflow-hidden.shadow-2xl")
      .first();

    await card.waitFor();

    const png = await card.screenshot({ type: "png" });
    res.set("Content-Type", "image/png");
    res.send(png);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  } finally {
    if (context) await context.close().catch(() => {});
  }
});

/* =========================================================
   🆕 NEW ENDPOINT — Text Render（纯文本）
========================================================= */
app.post("/render-text", async (req, res) => {
  const themeId = req.body?.themeId || "blue";
  const text =
    req.body?.text ||
    req.body?.aiText ||
    "";

  if (!String(text).trim()) {
    return res.status(400).json({
      ok: false,
      error: "text is required",
    });
  }

  const themeTitle =
    THEME_TITLE_BY_ID[themeId] || THEME_TITLE_BY_ID.blue;

  let context;
  try {
    const b = await getBrowser();
    context = await b.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();
    await page.goto(
      `http://127.0.0.1:${PORT}/template.html?mode=text`,
      { waitUntil: "networkidle" }
    );

    await page.waitForSelector("#pasteInput");

    await page
      .locator(`button[title="${themeTitle}"]`)
      .click()
      .catch(() => {});

    // ✅ 关键：不用 fill（textarea 是隐藏的）
    await page.evaluate((value) => {
      const el = document.getElementById("pasteInput");
      if (el) el.value = value;
    }, text);

    const card = page
      .locator("div.relative.bg-white.overflow-hidden.shadow-2xl")
      .first();

    await card.waitFor();

    const png = await card.screenshot({ type: "png" });
    res.set("Content-Type", "image/png");
    res.send(png);
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  } finally {
    if (context) await context.close().catch(() => {});
  }
});

/* =========================
   Start server
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Renderer running on http://0.0.0.0:${PORT}`);
});
