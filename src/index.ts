import puppeteer from "puppeteer";
import { Worker, isMainThread, parentPort } from "worker_threads";
import { Client } from "./client";
import { Player } from "./player";

// General Configs
const BUDDY_BLITZ_URL =
  // "https://staging.spatial.io/s/Kev-Buddy-Blitz-6532d5285b44edc7d53655a8?share=7637321244027357516";
  "https://staging.spatial.io/s/Buddy-Blitz-64ca9918868d158db2396a48?share=2373298131708457040";
const IMAGE_FOLDER = "screenshots";

// Agent Controls
// const LOADING_GAME_DELAY = 50000;
const LOADING_GAME_DELAY = 30000;
const ACTION_INTERVAL = 2000;
const SCREENSHOT_INTERVAL = 2000;
const PLAYER_LIFE_SPAN = 150000;
const WAIT_ROOM_TIME = 11000;
const CUT_SCENE_TIME = 12000;

async function start() {
  // Launch the browser
  console.log("Launching Browser");
  // const browser = await puppeteer.launch({ headless: "new" });
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();

  // Go to the website and wait for everything to load
  console.log(`Going to ${BUDDY_BLITZ_URL}`);
  await page.goto(BUDDY_BLITZ_URL, { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, LOADING_GAME_DELAY));

  // Initializating our client client
  const client = new Client(page);
  await client.init();

  // Start taking screenshots
  // client.startCapture(IMAGE_FOLDER, SCREENSHOT_INTERVAL);

  // Initializing our player
  const player = new Player(page);

  // Join a game
  await player.queueGame();

  // Let the bot wait in waitroom
  await player.waitroom(WAIT_ROOM_TIME, CUT_SCENE_TIME);

  // Let the bot run for its lifespan
  // await player.race(ACTION_INTERVAL, PLAYER_LIFE_SPAN);
  await player.initNaeNae(ACTION_INTERVAL);

  // Stop taking screenshots
  // client.endCapture();

  // Close the browser
  // browser.close();
}

function createWorker() {
  return new Worker(__filename);
}

// if (isMainThread) {
//   console.log('Starting the main thread');
//   // Creating 3 worker threads
//   for (let i = 0; i < 3; i++) {
//     createWorker().on('message', (msg) => {
//       try {
//         start()
//       } catch (err) {
//         console.log(`Worker ${i} failed with error: ${err}`);
//       }
//     });
//   }
// } else {
//   // Worker thread logic
//   parentPort?.postMessage('Worker thread is running console.log');
// }

start();
