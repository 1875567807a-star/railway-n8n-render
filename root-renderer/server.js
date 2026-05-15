import express from "express";
import { chromium } from "playwright";

const app = express();
const PORT = process.env.PORT || 3010;

app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

app.get("/health", (_, res) => res.json({ ok: true }));

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

let browser;
async function getBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browser;
}

async function hideTransientOverlays(page) {
  await page.evaluate(() => {
    for (const el of document.querySelectorAll(".fixed.top-4.right-4")) {
      el.style.display = "none";
      el.style.visibility = "hidden";
    }
  });
}

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

  const themeTitle = THEME_TITLE_BY_ID[themeId] || THEME_TITLE_BY_ID.blue;

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

    await hideTransientOverlays(page);

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

app.post("/render-text", async (req, res) => {
  const themeId = req.body?.themeId || "blue";
  const text = req.body?.text || req.body?.aiText || "";

  if (!String(text).trim()) {
    return res.status(400).json({
      ok: false,
      error: "text is required",
    });
  }

  const themeTitle = THEME_TITLE_BY_ID[themeId] || THEME_TITLE_BY_ID.blue;

  let context;
  try {
    const b = await getBrowser();
    context = await b.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 2,
    });

    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/template.html?mode=text`, {
      waitUntil: "networkidle",
    });

    await page.waitForSelector("#pasteInput");

    await page
      .locator(`button[title="${themeTitle}"]`)
      .click()
      .catch(() => {});

    await page.evaluate((value) => {
      const el = document.getElementById("pasteInput");
      if (el) el.value = value;
    }, text);

    await hideTransientOverlays(page);

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Renderer running on http://0.0.0.0:${PORT}`);
});
