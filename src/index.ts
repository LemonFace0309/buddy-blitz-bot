import puppeteer, { Browser, KeyInput, Page } from "puppeteer";
import fs from "fs";

const BUDDY_BLITZ_URL =
  "https://staging.spatial.io/s/Kev-Buddy-Blitz-6532d5285b44edc7d53655a8?share=7637321244027357516";
const IMAGE_FOLDER = "screenshots";
const DELAY = 10000;
const INTERVAL = 2000;

async function closeSpam(page: Page) {
  // Get rid of the character selection screen
  console.log("removing character selection screen");
  await page
    .locator("button")
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

async function joinGameAndStall(page: Page) {
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

  await new Promise((r) => setTimeout(r, 30000));
}

async function captureAndInteract(page: Page, dir: string) {
  const timestamp = new Date().toISOString().replace(/[:\.]/g, "-");
  const screenshotPath = `${dir}/screenshot-${timestamp}.png`;
  await page.screenshot({ path: screenshotPath });
  console.log(`Screenshot taken and saved as ${screenshotPath}`);

  // Press and hold 'w' to move forward
  await page.keyboard.down("w");

  // Pres and hold 'Space' to jump
  await page.keyboard.press("Space");

  // Randomly press 'a' or 'd' for left or right
  const keys: KeyInput[] = ["a", "d"];
  const keyToPress = keys[Math.floor(Math.random() * keys.length)];
  await page.keyboard.press(keyToPress, { delay: 1900 }); // press for 1900ms
  await page.keyboard.up("w"); // Release 'w' after pressing the other key
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
    await captureAndInteract(page, dir);
  }, INTERVAL);

  // Stop taking screenshots after a minute
  setTimeout(() => {
    clearInterval(screenshotInterval);
    browser.close();
    console.log("Stopped taking screenshots and closed the browser.");
  }, INTERVAL + DELAY);
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

  // Wait for DELAY seconds before interacting with the page
  await new Promise((r) => setTimeout(r, DELAY));

  // Close modals/popups/etc that we don't care about
  await closeSpam(page);

  // Join the game and wait 30 seconds for the join queue to finish
  await joinGameAndStall(page);

  // Start playing game
  await gameLoop(browser, page);
}

start();
