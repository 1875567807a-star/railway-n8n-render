import express from "express";
import fs from "fs";
import path from "path";
import { chromium } from "playwright";

const app = express();
const PORT = process.env.PORT || 3020;

const OUT_ROOT = process.env.OUT_ROOT || "/shared/out";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/$/, "");

fs.mkdirSync(OUT_ROOT, { recursive: true });

/* 允许大 markdown */
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use("/rendered", express.static(OUT_ROOT));

function buildPublicUrl(runId, fileName = "") {
  const parts = ["rendered", runId];
  if (fileName) parts.push(fileName);
  const relativePath = `/${parts.map(encodeURIComponent).join("/")}`;
  return PUBLIC_BASE_URL ? `${PUBLIC_BASE_URL}${relativePath}` : relativePath;
}

/* 健康检查 */
app.get("/health", (_, res) => {
  res.json({ ok: true });
});

/* 核心接口 */
app.post("/render_terms", async (req, res) => {
  // ⭐️ 关键：明确接收 color / design
  const { markdown, color, design } = req.body;

  console.log("RENDER REQUEST:", { color, design });

  if (!markdown) {
    return res.status(400).json({ error: "markdown is required" });
  }

  const runId = `run-${Date.now()}`;
  const runDir = path.join(OUT_ROOT, runId);
  fs.mkdirSync(runDir, { recursive: true });

  /* 保存原始 markdown（方便 debug） */
  fs.writeFileSync(path.join(runDir, "input.md"), markdown, "utf8");

  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox"],
    });

    const page = await browser.newPage({
      viewport: { width: 1080, height: 1350 },
    });

    /* 1️⃣ 打开 terms.html */
    const htmlPath = "file:///app/public/terms.html";
    await page.goto(htmlPath, { waitUntil: "networkidle" });

    /* 2️⃣ 等 textarea 就绪 */
    await page.waitForSelector("#markdownInput");

    /* 3️⃣ 注入主题 & 布局（必须在 processInput 前） */
    await page.evaluate(
      ({ color, design }) => {
        // 防止 window.onload 覆盖
        if (color && typeof setTheme === "function") {
          setTheme(color);
        }
        if (design && typeof setLayout === "function") {
          setLayout(design);
        }
      },
      { color, design }
    );

    /* 4️⃣ 注入 markdown */
    await page.evaluate((md) => {
      document.getElementById("markdownInput").value = md;
    }, markdown);

    /* 5️⃣ 生成卡片 */
    await page.evaluate(() => {
      if (typeof processInput !== "function") {
        throw new Error("processInput() not found on page");
      }
      processInput();
    });

    /* 6️⃣ 等卡片生成 */
    await page.waitForSelector("#card-cover, #card-p0", {
      timeout: 8000,
    });

    const files = [];

    /* 7️⃣ 截 Cover */
    const cover = await page.$("#card-cover");
    if (cover) {
      const coverPath = path.join(runDir, "cover.png");
      await cover.screenshot({ path: coverPath });
      files.push("cover.png");
    }

    /* 8️⃣ 截内容页 */
    for (let i = 0; i < 10; i++) {
      const card = await page.$(`#card-p${i}`);
      if (!card) break;

      const fileName = `page-${i + 1}.png`;
      const filePath = path.join(runDir, fileName);

      await card.screenshot({ path: filePath });
      files.push(fileName);
    }

    await browser.close();

    const previewFile = files.find((f) => f.startsWith("page-")) || null;

    return res.json({
      ok: true,
      runId,
      runDir,
      files,
      fileUrls: files.map((name) => ({
        name,
        url: buildPublicUrl(runId, name),
      })),
      downloadBaseUrl: buildPublicUrl(runId),
      used: {
        color: color || "default",
        design: design || "default",
      },
      previewImage: previewFile ? `${runDir}/${previewFile}` : null,
      previewImageUrl: previewFile ? buildPublicUrl(runId, previewFile) : null,
    });
  } catch (err) {
    if (browser) await browser.close();

    console.error("render_terms failed:", err);
    return res.status(500).json({
      error: err.message || "render failed",
    });
  }
});

/* 启动 */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Terms renderer listening on http://0.0.0.0:${PORT}`);
});
