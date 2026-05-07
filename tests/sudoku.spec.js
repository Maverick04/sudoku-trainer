const { test, expect } = require("@playwright/test");

async function openGame(page) {
  await page.addInitScript(() => localStorage.clear());
  await page.goto("/?test=1");
  await expect(page.getByRole("heading", { name: "进阶数独" })).toBeVisible();
}

async function clickPad(page, value) {
  await page.locator("#numberPad button").filter({ has: page.locator("span", { hasText: String(value) }) }).first().click();
}

test.describe("Sudoku trainer UI", () => {
  test("loads the default puzzle and switches size and difficulty", async ({ page }) => {
    await openGame(page);

    await expect(page.locator(".sudoku-cell")).toHaveCount(25);
    await expect(page.getByText("5x5 简单")).toBeVisible();

    await page.getByRole("button", { name: "9x9" }).click();
    await expect(page.locator(".sudoku-cell")).toHaveCount(81);
    await expect(page.getByText("9x9 简单")).toBeVisible();

    await page.getByRole("button", { name: "困难" }).click();
    await expect(page.getByText("9x9 困难")).toBeVisible();
  });

  test("shows instant wrong feedback and supports erase and undo", async ({ page }) => {
    await openGame(page);
    const editable = await page.evaluate(() => window.__sudokuTest.pickEditable());
    const cell = page.locator(`.sudoku-cell[data-index="${editable.index}"]`);

    await cell.click();
    await clickPad(page, editable.wrong);
    await expect(cell).toHaveClass(/wrong/);
    await expect(page.getByText("这个数字和当前题目不匹配")).toBeVisible();

    await page.getByRole("button", { name: "擦除" }).click();
    await expect(cell).not.toHaveText(String(editable.wrong));
    await expect(page.getByText("已擦除当前格")).toBeVisible();

    await clickPad(page, editable.correct);
    await expect(cell).toHaveText(String(editable.correct));
    await page.getByRole("button", { name: "撤销" }).click();
    await expect(cell).not.toHaveText(String(editable.correct));
  });

  test("supports note mode without filling the answer", async ({ page }) => {
    await openGame(page);
    const editable = await page.evaluate(() => window.__sudokuTest.pickEditable());
    const cell = page.locator(`.sudoku-cell[data-index="${editable.index}"]`);

    await page.getByLabel("笔记模式").check();
    await cell.click();
    await clickPad(page, 1);
    await clickPad(page, 2);

    await expect(cell.locator(".notes")).toContainText("1");
    await expect(cell.locator(".notes")).toContainText("2");
    await expect(cell).not.toHaveClass(/user-filled/);
  });

  test("auto-completes the puzzle and records the result", async ({ page }) => {
    await openGame(page);
    const last = await page.evaluate(() => window.__sudokuTest.prepareOneMissing());
    const cell = page.locator(`.sudoku-cell[data-index="${last.index}"]`);

    await cell.click();
    await clickPad(page, last.correct);

    await expect(page.getByRole("dialog", { name: "完成了" })).toBeVisible();
    await expect(page.locator("#starCount")).toHaveText("1");
    await page.getByRole("button", { name: "继续" }).click();
    await expect(page.locator("#bestRecord")).toContainText("最佳");
  });

  test("mobile layout has no horizontal overflow", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-only layout assertion");
    await openGame(page);
    await page.getByRole("button", { name: "9x9" }).click();

    const metrics = await page.evaluate(() => ({
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      boardRight: document.querySelector("#board").getBoundingClientRect().right,
    }));

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 2);
    expect(metrics.boardRight).toBeLessThanOrEqual(metrics.clientWidth + 2);
  });
});
