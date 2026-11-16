import { readFileSync } from "node:fs";
const fixture = JSON.parse(
  readFileSync(
    new URL("./fixtures/story-example/story.json", import.meta.url),
    "utf8",
  ),
);
import { compileStory } from "../src/story-engine/compiler";
test.beforeEach(async ({ page }) => {
  await page.route("**/work.json", (route) =>
    route.fulfill({ json: compileStory(fixture).work }),
  );
});
import { test, expect, type Page } from "@playwright/test";

test.describe("mobile player", () => {
  test.use({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true });

  async function openTemplate(page: Page) {
    await page.unroute("**/work.json");
    await page.route("**/work.json", async (route) => {
      const response = await route.fetch();
      const story = await response.json();
      story.phone.passcode = "";
      await route.fulfill({ response, json: story });
    });
    await page.goto("/");
    await page.getByRole("button", { name: "轻触解锁" }).tap();
  }

  test("B612 uses the App Store icon on the home screen and Dock", async ({ page }) => {
    await openTemplate(page);
    const shortcuts = page.getByRole("button", { name: "打开B612咔叽", exact: true });
    await expect(shortcuts).toHaveCount(2);
    for (const shortcut of await shortcuts.all()) {
      const icon = shortcut.locator('[data-original-icon="b612"] img');
      await expect(icon).toHaveAttribute("src", /icon-assets\/b612\.jpg$/);
      await expect.poll(() => icon.evaluate((el) => (el as HTMLImageElement).naturalWidth)).toBe(512);
    }
    await page.locator(".dock").getByRole("button", { name: "打开B612咔叽", exact: true }).tap();
    await expect(page.locator(".skin-b612")).toBeVisible();
  });

  test("WeChat inserts the breakfast photo and starts a call from the composer", async ({ page }) => {
    await openTemplate(page);
    await page.getByRole("button", { name: "打开微信", exact: true }).tap();
    await page.locator(".wx-chat-row").filter({ hasText: "👶🌙" }).first().tap();
    const thread = page.locator(".wechat-ui");
    const photo = thread.getByRole("img", { name: /酒店桌上的早餐/ });
    await photo.scrollIntoViewIfNeeded();
    await expect(photo).toBeVisible();
    const imageBubble = photo.locator("..");
    await expect(imageBubble).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await expect(imageBubble).toHaveCSS("padding", "0px");
    expect(await imageBubble.evaluate((el) => getComputedStyle(el, "::before").content)).toBe("none");
    await expect.poll(() => photo.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    const messages = await thread.locator(".skin-messages > :is(.skin-date, .skin-message)").evaluateAll((nodes) =>
      nodes.map((node) => node.querySelector('img[alt*="酒店桌上的早餐"]')
        ? "早餐照"
        : (node.querySelector(".skin-bubble") ?? node).textContent?.trim()),
    );
    const breakfast = messages.indexOf("早餐照");
    expect(messages.slice(breakfast - 3, breakfast + 3)).toEqual([
      "08:30", "我起来了", "08:35", "早餐照", "08:45", "我都吃光光了😊",
    ]);
    const rain = thread.getByRole("img", { name: /小雨中的高架桥/ });
    await rain.scrollIntoViewIfNeeded();
    await expect.poll(() => rain.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
    await expect(rain.locator("xpath=ancestor::div[contains(@class, 'skin-message')][1]/following-sibling::div[contains(@class, 'skin-message')][1]"))
      .toContainText("知道啦 广州现在下小雨呢");

    await expect(thread.getByRole("button", { name: "语音通话", exact: true })).toHaveCount(0);
    await thread.getByRole("button", { name: "更多聊天功能" }).tap();
    const actions = thread.getByRole("region", { name: "聊天功能" });
    await expect(actions.getByRole("button")).toHaveText([
      "照片", "拍摄", "视频通话", "位置", "红包", "礼物", "转账", "问小微",
    ]);
    await actions.getByRole("button", { name: "照片", exact: true }).tap();
    const album = thread.getByRole("region", { name: "照片", exact: true });
    await expect(album.getByRole("img", { name: /酒店桌上的早餐/ })).toHaveCount(0);
    await album.getByRole("button", { name: "合照 01", exact: true }).tap();
    await expect(album.locator(":scope > img")).toHaveAttribute("alt", "合照 01");
    await album.getByRole("button", { name: "返回相册" }).tap();
    await album.getByRole("button", { name: "返回功能菜单" }).tap();
    await actions.getByRole("button", { name: "视频通话" }).tap();
    await thread.getByRole("button", { name: "语音通话", exact: true }).tap();
    const call = thread.getByRole("dialog", { name: "微信语音通话" });
    await expect(call).toBeVisible();
    await call.getByRole("button", { name: "挂断" }).tap();
    await expect(call).toHaveCount(0);
  });

  test("NetEase shows artist credits, whole-row selection and per-track comments", async ({ page }) => {
    await page.route("https://embed.music.apple.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>Apple Music</p>" }));
    await openTemplate(page);
    await page.getByRole("button", { name: "打开网易云音乐", exact: true }).tap();
    await expect(page.getByRole("button", { name: "首页", exact: true })).toBeVisible();

    const row = page.locator(".netease-track").filter({ hasText: "慢慢喜欢你" });
    await expect(row.getByText("莫文蔚", { exact: true })).toBeVisible();
    await row.getByRole("button", { name: /慢慢喜欢你.*莫文蔚/ }).tap();
    await expect(row).toHaveCSS("background-color", "rgb(232, 232, 234)");
    await expect(row.getByRole("button", { name: "慢慢喜欢你的评论" }))
      .toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

    await page.getByRole("button", { name: "正在播放 慢慢喜欢你" }).tap();
    const player = page.getByRole("region", { name: "正在播放" });
    await expect(player.getByRole("heading", { name: "慢慢喜欢你" })).toBeVisible();
    await expect(player.getByTitle("Apple Music 官方试听：慢慢喜欢你")).toHaveAttribute(
      "src", "https://embed.music.apple.com/cn/album/1869049124?i=1869049128",
    );
    const commentsLink = player.getByRole("button", { name: /打开评论/ });
    const count = (await commentsLink.getAttribute("aria-label"))!.match(/\d+/)![0];
    await commentsLink.tap();
    const comments = page.getByRole("region", { name: "歌曲评论" });
    await expect(comments.getByText(`评论 (${count})`, { exact: true })).toBeVisible();
    await comments.getByRole("button", { name: "最热" }).tap();
    await expect(comments.getByRole("button", { name: "最热" })).toHaveAttribute("aria-pressed", "true");
    await comments.getByRole("textbox", { name: "写评论" }).fill("这首值得单曲循环");
    await comments.getByRole("button", { name: "发送" }).tap();
    await expect(comments.getByText("这首值得单曲循环")).toBeVisible();
    await comments.getByRole("button", { name: "返回" }).tap();
    await expect(player).toBeVisible();
    await player.getByRole("button", { name: "下一首" }).tap();
    await expect(player.getByRole("heading", { name: "爱你", exact: true })).toBeVisible();
    await player.getByRole("button", { name: "上一首" }).tap();
    await player.getByRole("button", { name: /打开评论/ }).tap();
    await expect(comments.getByText("这首值得单曲循环")).toBeVisible();
  });

  test("NetEase preserves the linked recordings and stops the embed on close", async ({ page }) => {
    await page.route("https://embed.music.apple.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<p>Apple Music</p>" }));
    await openTemplate(page);
    await page.getByRole("button", { name: "打开网易云音乐", exact: true }).tap();
    await page.getByRole("button", { name: /那些花儿.*范玮琪/ }).tap();
    await page.getByRole("button", { name: "正在播放 那些花儿" }).tap();
    const player = page.getByRole("region", { name: "正在播放" });
    await expect(player.getByTitle("Apple Music 官方试听：那些花儿")).toHaveAttribute(
      "src", "https://embed.music.apple.com/cn/album/536098121?i=536098124",
    );
    await player.getByRole("button", { name: "下一首" }).tap();
    await player.getByRole("button", { name: "下一首" }).tap();
    await expect(player.getByRole("link", { name: "前往 Apple Music 播放" })).toHaveAttribute(
      "href", "https://music.apple.com/tw/album/1724720279?i=1724720282",
    );
    await expect(player.locator("iframe")).toHaveCount(0);
    await player.getByRole("button", { name: "播放列表" }).tap();
    await player.getByRole("button", { name: /淡季.*音乐合伙人/ }).tap();
    await expect(player.getByRole("link", { name: "前往 网易云音乐 播放" })).toHaveAttribute(
      "href", "https://music.163.com/song?id=3372978254",
    );
    await player.getByRole("button", { name: "下一首" }).tap();
    await expect(player.locator("iframe")).toHaveCount(1);
    await player.getByRole("button", { name: "收起播放页" }).tap();
    await expect(page.locator(".netease-playing iframe")).toHaveCount(0);
  });

  test("keeps fifth-row app names above the desktop controls", async ({ page }) => {
    await page.goto("/?preview=test");
    await page.getByRole("button", { name: "轻触解锁" }).tap();
    const grid = page.getByRole("group", { name: "桌面第1页" });
    for (const name of ["查找", "计算器", "设置", "QQ", "支付宝"]) {
      await expect(grid.getByText(name, { exact: true })).toBeInViewport({ ratio: 1 });
    }
  });

  test("fills the viewport and supports swiping up to unlock and return home", async ({ page }) => {
    await page.goto("/");
    const screen = page.locator(".phone-screen");
    await expect(screen).toBeVisible();
    expect(await screen.boundingBox()).toEqual({
      x: 0, y: 0, width: 375, height: 667,
    });

    const touch = await page.context().newCDPSession(page);
    const swipeUp = async () => {
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchStart", touchPoints: [{ x: 187, y: 650 }],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchMove", touchPoints: [{ x: 187, y: 550 }],
      });
      await touch.send("Input.dispatchTouchEvent", {
        type: "touchEnd", touchPoints: [],
      });
    };
    await swipeUp();
    await page.getByRole("button", { name: "打开设置", exact: true }).tap();
    await expect(page.locator(".app-screen:not([inert])")).toBeVisible();
    await swipeUp();
    await expect(page.getByRole("button", { name: "打开设置", exact: true })).toBeVisible();
  });
});

async function home(page: Page) {
  await page.getByRole("button", { name: "返回桌面", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "打开设置", exact: true }),
  ).toBeVisible();
}
async function open(page: Page, name: string) {
  await page.getByRole("button", { name: "打开" + name, exact: true }).click();
  await expect(page.locator(".app-screen:not([inert])")).toBeVisible();
  await expect(page.locator(".app-screen:not([inert])")).toHaveCSS(
    "transform",
    "none",
  );
}
test("direct player, settings stack and toggle, system screenshots", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.getByRole("button", { name: "轻触解锁" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建作品" })).toHaveCount(0);
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/v0.6/lock.png" });
  await page.getByRole("button", { name: "轻触解锁" }).click();
  await expect(
    page.getByRole("button", { name: "打开设置", exact: true }),
  ).toBeVisible();
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/v0.6/home.png" });
  await open(page, "设置");
  await expect(
    page.getByRole("switch", { name: "飞行模式" }),
  ).not.toBeChecked();
  await page.getByRole("switch", { name: "飞行模式" }).check();
  await expect(page.getByRole("switch", { name: "飞行模式" })).toBeChecked();
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/v0.6/settings.png" });
  await page.getByRole("button", { name: "通用", exact: true }).click();
  await page.getByRole("button", { name: "关于本机", exact: true }).click();
  await expect(page.getByText("iPhone 15 Pro", { exact: true })).toBeVisible();
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/v0.6/settings-about.png" });
  await page.getByRole("button", { name: "通用", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "关于本机", exact: true }),
  ).toBeVisible();
  await home(page);
  for (const app of [
    "信息",
    "相册",
    "电话",
    "备忘录",
    "通讯录",
    "日历",
    "时钟",
    "计算器",
    "文件",
    "浏览器",
    "相机",
  ]) {
    await open(page, app);
    await page
      .locator(".phone-screen")
      .screenshot({ path: "outputs/v0.6/app-" + app + ".png" });
    await home(page);
  }
  expect(errors).toEqual([]);
});
for (const [choice, ending] of [
  ["赴约", "赴约：你按时把手机交还了主人。"],
  ["留在失物招领", "等待：你留下联系方式，等主人取回手机。"],
])
  test(
    "example puzzle, call, ending and persisted save: " + choice,
    async ({ page }) => {
      await page.goto("/");
      await page.getByRole("button", { name: "轻触解锁" }).click();
      await open(page, "微信");
      await page
        .locator(".wx-chat-row")
        .filter({ hasText: "小林" })
        .first()
        .click();
      await page
        .getByRole("button", {
          name: "密码还是我们第一次开会的日期：1023。",
          exact: true,
        })
        .click();
      await home(page);
      await open(page, "相册");
      await expect(
        page.getByRole("button", { name: "查看藏起来的照片" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "查看藏起来的照片" }).click();
      await expect(page.locator(".native-detail-photos")).toBeVisible();
      await page
        .locator(".phone-screen")
        .screenshot({ path: "outputs/v0.6/photos-detail.png" });
      await home(page);
      await open(page, "备忘录");
      await page
        .locator(".notes-list button")
        .filter({ hasText: "明天的安排" })
        .click();
      await page.getByPlaceholder("内容密码").fill("bad");
      await page.getByRole("button", { name: "解锁内容", exact: true }).click();
      await expect(page.getByText("密码不正确")).toBeVisible();
      await page.getByPlaceholder("内容密码").fill("1023");
      await page.getByRole("button", { name: "解锁内容", exact: true }).click();
      await expect(page.locator(".native-note-paper")).toBeVisible();
      await page
        .locator(".native-note-paper")
        .screenshot({ path: "outputs/v0.6/notes-detail.png" });
      await page.getByRole("button", { name: "接听", exact: true }).click();
      await expect(
        page.getByRole("button", { name: "赴约", exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "挂断", exact: true }).click();
      await page.getByRole("button", { name: choice, exact: true }).click();
      await expect(page.getByText(ending, { exact: true })).toBeVisible();
      await page
        .locator(".phone-screen")
        .screenshot({ path: `outputs/v0.6/ending-${choice}.png` });
      await page.reload();
      await expect(page.locator(".lock-clock-block")).toContainText("10月24日");
      await page.getByRole("button", { name: "轻触解锁" }).click();
      await expect(page.getByText(ending, { exact: true })).toBeVisible();
    },
  );
test("mobile viewport, no overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "轻触解锁" }).click();
  await expect(
    page.getByRole("button", { name: "打开设置", exact: true }),
  ).toBeVisible();
  const rect = await page.locator(".phone-shell").boundingBox();
  expect(rect!.width).toBeLessThanOrEqual(390);
  expect(rect!.height).toBeLessThanOrEqual(844);
  await page.screenshot({ path: "outputs/v0.6/mobile.png" });
});
test("production PWA cached story works after offline reload", async ({
  browser,
}) => {
  const context = await browser.newContext({ serviceWorkers: "allow" });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await page.getByRole("button", { name: "轻触解锁" }).waitFor();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload();
    await page.getByRole("button", { name: "轻触解锁" }).click();
    await open(page, "设置");
    await expect(page.getByRole("switch", { name: "飞行模式" })).toBeVisible();
    await page
      .locator(".phone-screen")
      .screenshot({ path: "outputs/v0.6/offline-settings.png" });
  } finally {
    await context.close();
  }
});

test("blank phone contains no story or author content", async ({
  page,
  request,
}) => {
  await page.unroute("**/work.json");
  const w = await request.get("/blank-work.json").then((r) => r.json());
  expect(w.id).toBe("blank-phone");
  expect(w.nodes).toEqual([]);
  expect(Object.values(w.data).flat()).toEqual([]);
  expect(w.description).toBe("");
  expect(w.mode).toBe("explore");
  await page.goto("/?template=blank");
  await page.getByRole("button", { name: "轻触解锁" }).click();
  await expect(page.getByText("林知夏", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "打开设置", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".lock-screen")).toHaveCount(0);
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/v0.7/blank-home.png" });
  await open(page, "设置");
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/v0.7/settings-blank.png" });
});
test("reference-calibrated settings, WeChat pages and control center", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "轻触解锁" }).click();
  await open(page, "设置");
  const screen = await page.locator(".phone-screen").boundingBox();
  const search = await page.locator(".settings-search").boundingBox();
  expect(search!.y).toBeGreaterThan(screen!.y + screen!.height * 0.75);
  await expect(page.locator(".settings-group").first()).toHaveCSS(
    "border-radius",
    "26px",
  );
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/v0.7/settings.png" });
  await home(page);
  await page.getByRole("button", { name: "控制中心", exact: true }).click();
  await expect(page.locator(".device-control")).toHaveCSS("opacity", "1");
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/v0.7/control-center.png" });
  await page.getByRole("button", { name: "关闭控制中心" }).click();
  await expect(page.locator(".device-control")).toHaveCount(0);
  await open(page, "微信");
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/v0.7/wechat-list-fixture.png" });
  await page.locator(".wx-bottom button").filter({ hasText: "发现" }).click();
  await expect(
    page.getByRole("button", { name: "视频号", exact: false }),
  ).toBeVisible();
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/v0.7/wechat-discover.png" });
  await page.locator(".wx-bottom button").filter({ hasText: "我" }).click();
  await expect(
    page.getByRole("button", { name: "小店与卡包", exact: false }),
  ).toBeVisible();
  await page
    .locator(".phone-screen")
    .screenshot({ path: "outputs/v0.7/wechat-me-fixture.png" });
});
