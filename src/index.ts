import puppeteer from "puppeteer";
import { Browser, KeyInput, Page } from "puppeteer";
import fs from "fs";

// General Configs
const BUDDY_BLITZ_URL =
  "https://staging.spatial.io/s/Kev-Buddy-Blitz-6532d5285b44edc7d53655a8?share=7637321244027357516";
const IMAGE_FOLDER = "screenshots";

// Agent Controls
const LOADING_GAME_DELAY = 10000;
const ACTION_INTERVAL = 750;
const SCREENSHOT_INTERVAL = 3000;
const WAIT_ROOM_TIME = 30000;
const CUT_SCENE_TIME = 10000;
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

async function takeScreenShot(page: Page, dir: string) {
  const timestamp = new Date().toISOString().replace(/[:\.]/g, "-");
  const screenshotPath = `${dir}/screenshot-${timestamp}.png`;
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot taken and saved as ${screenshotPath}`);
}

function initScreenShots(page: Page) {
  // Create a folder for this instance
  const instance = new Date().toISOString().replace(/[:\.]/g, "-");
  const dir = `${IMAGE_FOLDER}/${instance}`;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Set an interval to take a screenshot every SCREENSHOT_INTERVAL ms
  const screenshotInterval = setInterval(async () => {
    await takeScreenShot(page, dir);
  }, SCREENSHOT_INTERVAL);

  return screenshotInterval;
}

async function moveAllDirections(page: Page, length: number) {
  // Randomly move forward or backwards
  const keys: KeyInput[] = ["w", "s"];
  const keyToPress = keys[Math.floor(Math.random() * keys.length)];
  await page.keyboard.down(keyToPress);

  // Maybe press 'Space' to jump
  if (Math.random() >= 0.75) {
    await page.keyboard.press("Space");
  }

  // Maybe randomly press 'a' or 'd' for left or right
  if (Math.random() >= 0.5) {
    const keys: KeyInput[] = ["a", "d"];
    const keyToPress = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.press(keyToPress, { delay: length - 100 });
  }

  await page.keyboard.up(keyToPress);
}

async function moveForwards(page: Page, length: number) {
  // always move forward
  await page.keyboard.down("w");

  // Maybe press 'Space' to jump
  if (Math.random() >= 0.5) {
    await page.keyboard.press("Space");
  }

  // Maybe randomly press 'a' or 'd' for left or right
  if (Math.random() >= 0.5) {
    const keys: KeyInput[] = ["a", "d"];
    const keyToPress = keys[Math.floor(Math.random() * keys.length)];
    await page.keyboard.press(keyToPress, { delay: length - 100 });
  }

  await page.keyboard.up("w");
}

async function move(page: Page, length: number) {
  await moveForwards(page, length);
}

async function playAroundlInWaitroom(page: Page) {
  console.log("Playing around in waitroom");

  // Set an interval to take a move every ACTION_INTERVAL ms
  const moveInterval = setInterval(
    async () => await moveAllDirections(page, ACTION_INTERVAL),
    ACTION_INTERVAL
  );

  // Wait for waitroom to finish
  console.log("Waiting for waitroom to finish");
  await new Promise((r) =>
    setTimeout(() => {
      clearInterval(moveInterval);
      console.log("Done waiting in waitroom");
      r(true);
    }, WAIT_ROOM_TIME)
  );

  // Do nothing while cutscene is playing
  console.log("Waiting for cutscene to finish");
  await new Promise((r) => setTimeout(r, CUT_SCENE_TIME));
  console.log("Done waiting for cutscene to finish");
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
  await page.mouse.click(clickX, clickY, { delay: 600 });
  await page.mouse.click(clickX, clickY, { delay: 600 });

  await playAroundlInWaitroom(page);
}

async function gameLoop(browser: Browser, page: Page) {
  console.log("Starting game loop");

  // Set an interval to move every ACTION_INTERVAL ms
  const moveInterval = setInterval(async () => {
    await move(page, ACTION_INTERVAL);
  }, ACTION_INTERVAL);

  // Stop taking screenshots after a minute
  await new Promise((resolve) =>
    setTimeout(() => {
      clearInterval(moveInterval);
      browser.close();
      console.log("Stopped bot and closed the browser.");
      resolve(true);
    }, TOTAL_RUN_TIME)
  );
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

  // Wait for LOADING_GAME_DELAY ms before interacting with the page
  await new Promise((r) => setTimeout(r, LOADING_GAME_DELAY));

  // Close modals/popups/etc that we don't care about
  await closeSpam(page);

  // Start taking screenshots every SCREENSHOT_INTERVAL ms
  const screenshotInterval = initScreenShots(page);

  // Join the game and wait WAIT_ROOM_TIME + CUT_SCENE_TIME ms for the join queue and cutscene to finish
  await queueGameAndPlayAround(page);

  // Start playing game
  await gameLoop(browser, page);

  // Stop taking screenshots
  clearInterval(screenshotInterval);
}

start();
