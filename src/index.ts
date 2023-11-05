import puppeteer from "puppeteer";
import { Browser, KeyInput, Page } from "puppeteer";
import fs from "fs";

// General Configs
const BUDDY_BLITZ_URL =
  "https://staging.spatial.io/s/Kev-Buddy-Blitz-6532d5285b44edc7d53655a8?share=7637321244027357516";
const IMAGE_FOLDER = "screenshots";

// Agent Controls
const LOADING_GAME_DELAY = 10000;
const ACTION_INTERVAL = 250;
const WAIT_ROOM_TIME = 30000;
const CUT_SCENE_TIME = 12000;
const TOTAL_RUN_TIME = 150000;

async function closeSpam(page: Page) {
  // Get rid of the character selection screen
  console.log("removing character selection screen");
  // await page.mouse.click(100, 100)
  await page
    .locator("button[type=submit]")
    .filter((button) => button.textContent == "Continue")
    .click();
  await new Promise((r) => setTimeout(r, 500));

  // Get rid of the tutorial screen
  console.log("removing tutorial screen");
  await page
    .locator("button")
    .filter((button) => button.textContent == "Skip")
    .click();
  await new Promise((r) => setTimeout(r, 500));

  // Get rid of the login prompt
  // console.log("removing login prompt")
  // await page.locator(".absolute.-right-3.-top-3").click();
  // await new Promise((r) => setTimeout(r, 500));
}

async function moveAllDirections(page: Page, interval: number) {
  // Randomly move forward or backwards
  const keys: KeyInput[] = ["w", "s"];
  const keyToPress = keys[Math.floor(Math.random() * keys.length)];
  await page.keyboard.down(keyToPress);

  // Maybe press 'Space' to jump
  if (Math.random() >= 0.5) {
    await page.keyboard.press("Space");
  }

  // Maybe randomly press 'a' or 'd' for left or right
  if (Math.random() >= 0.5) {
    const keys: KeyInput[] = ["a", "d"];
    const keyToPress = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.press(keyToPress, { delay: interval - 50 });
  } else {
    await new Promise((r) => setTimeout(r, interval - 50));
  }

  await page.keyboard.up(keyToPress);
}

async function moveForwards(page: Page, interval: number) {
  // always move forward
  await page.keyboard.up("w");
  await page.keyboard.down("w");

  // Maybe press 'Space' to jump
  if (Math.random() >= 0.5) {
    await page.keyboard.press("Space");
  }

  // Maybe Randomly press 'a' or 'd' for left or right
  if (Math.random() >= 0.5) {
    const keys: KeyInput[] = ["a", "d"];
    const keyToPress = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.press(keyToPress, { delay: interval - 50 });
  } else {
    await new Promise((r) => setTimeout(r, interval, -50));
  }
}

async function playAroundlInWaitroom(page: Page) {
  const screenshotInterval = setInterval(
    async () => await moveAllDirections(page, ACTION_INTERVAL),
    ACTION_INTERVAL
  );

  setTimeout(() => {
    clearInterval(screenshotInterval);
  }, WAIT_ROOM_TIME);

  await new Promise((r) => setTimeout(r, CUT_SCENE_TIME));
}

async function queueGameAndPlayAround(page: Page) {
  // Get the viewport size
  const viewport = page.viewport();
  if (!viewport) {
    throw new Error("Viewport is null");
  }

  // Calculate the click position
  const clickX = viewport.width * 0.58;
  const clickY = viewport.height * 0.89;

  // Join a game queue
  console.log("JOINING GAME");
  await page.mouse.click(clickX, clickY, { delay: 500 });
  await page.mouse.click(clickX, clickY, { delay: 500 });
  await page.mouse.click(clickX, clickY, { delay: 500 });

  await playAroundlInWaitroom(page);
}

async function move(page: Page, dir: string, interval: number) {
  // const timestamp = new Date().toISOString().replace(/[:\.]/g, "-");
  // const screenshotPath = `${dir}/screenshot-${timestamp}.png`;
  // await page.screenshot({ path: screenshotPath });
  // console.log(`Screenshot taken and saved as ${screenshotPath}`);

  await moveForwards(page, interval);
}

async function gameLoop(browser: Browser, page: Page) {
  // Create a folder for this instance
  const instance = new Date().toISOString().replace(/[:\.]/g, "-");
  const dir = `${IMAGE_FOLDER}/${instance}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Set an interval to interact and take a screenshot every 2 seconds
  const screenshotInterval = setInterval(async () => {
    await move(page, dir, ACTION_INTERVAL);
  }, ACTION_INTERVAL);

  // Stop taking screenshots after a minute
  setTimeout(() => {
    clearInterval(screenshotInterval);
    browser.close();
    console.log("Stopped taking screenshots and closed the browser.");
  }, TOTAL_RUN_TIME);
}

async function start() {
  // Launch the browser
  // const browser = await puppeteer.launch({
  //   headless: "new",
  //   args: [
  //     "--use-gl=angle",
  //     "--use-angle=gl",
  //     "--disable-web-security",
  //     "--enable-unsafe-webgpu",
  //   ],
  // });
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();

  // Go to the website
  await page.goto(BUDDY_BLITZ_URL, { waitUntil: "networkidle2" });

  // Wait for LOADING_GAME_DELAY seconds before interacting with the page
  await new Promise((r) => setTimeout(r, LOADING_GAME_DELAY));

  // Close modals/popups/etc that we don't care about
  await closeSpam(page);

  // Join the game and wait 30 seconds for the join queue to finish
  await queueGameAndPlayAround(page);

  // Start playing game
  await gameLoop(browser, page);
}

start();
