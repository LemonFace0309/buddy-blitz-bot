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
const SCREENSHOT_INTERVAL = 3000;
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

async function moveAllDirections(page: Page, length: number) {
  // Randomly move forward or backwards
  const keys: KeyInput[] = ["w", "s"];
  const keyToPress = keys[Math.floor(Math.random() * keys.length)];
  await page.keyboard.up(keyToPress);
  await page.keyboard.down(keyToPress);

  // Maybe press 'Space' to jump
  if (Math.random() >= 0.5) {
    await page.keyboard.press("Space");
  }

  // Maybe randomly press 'a' or 'd' for left or right
  if (Math.random() >= 0.5) {
    const keys: KeyInput[] = ["a", "d"];
    const keyToPress = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.press(keyToPress, { delay: length });
  }
}

async function moveForwards(page: Page, length: number) {
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
    await page.keyboard.press(keyToPress, { delay: length });
  }
}

async function move(page: Page, length: number) {
  await moveForwards(page, length);
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
  await page.mouse.click(clickX, clickY, { delay: 500 });
  await page.mouse.click(clickX, clickY, { delay: 500 });

  await playAroundlInWaitroom(page);
}

async function takeScreenShot(page: Page, dir: string) {
  const timestamp = new Date().toISOString().replace(/[:\.]/g, "-");
  const screenshotPath = `${dir}/screenshot-${timestamp}.png`;
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot taken and saved as ${screenshotPath}`);
}

async function gameLoop(browser: Browser, page: Page) {
  // Create a folder for this instance
  const instance = new Date().toISOString().replace(/[:\.]/g, "-");
  const dir = `${IMAGE_FOLDER}/${instance}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Set an interval to move every ACTION_INTERVAL seconds
  const moveIntervatl = setInterval(async () => {
    await move(page, ACTION_INTERVAL);
  }, ACTION_INTERVAL);

  // Set an interval to take a screenshot every SCREENSHOT_INTERVAL seconds
  const screenshotInterval = setInterval(async () => {
    await takeScreenShot(page, dir);
  }, SCREENSHOT_INTERVAL);

  // Stop taking screenshots after a minute
  setTimeout(() => {
    clearInterval(moveIntervatl);
    clearInterval(screenshotInterval);
    browser.close();
    console.log("Stopped taking screenshots and closed the browser.");
  }, TOTAL_RUN_TIME);
}

async function start() {
  // Launch the browser
  console.log("Launching Browser");
  const browser = await puppeteer.launch({ headless: "new" });
  // const browser = await puppeteer.launch({
  //   headless: false,
  // });
  const page = await browser.newPage();

  // Go to the website
  console.log(`Going to ${BUDDY_BLITZ_URL}`);
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
