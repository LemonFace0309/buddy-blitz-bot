import puppeteer from "puppeteer";
import { Worker, isMainThread, parentPort } from "worker_threads";
import { Client } from "./client";
import { Player } from "./player";
import { sleep } from "./utils";

// General Configs
const BUDDY_BLITZ_URL =
  // "https://staging.spatial.io/s/Kev-Buddy-Blitz-6532d5285b44edc7d53655a8?share=7637321244027357516";
  "https://staging.spatial.io/s/Buddy-Blitz-64ca9918868d158db2396a48?share=2373298131708457040";
const IMAGE_FOLDER = "screenshots";

// Agent Controls
// const LOADING_GAME_DELAY = 50000;
const LOADING_GAME_DELAY = 25000;
const QUERY_GPT_INTERVAL = 2000;

// Console Log Events
const CONSOLE_PREFIX = "SpatialGame: ";
const CONSOLE_START_TUTORIAL = "SendMessage - StartTutorial";
const CONSOLE_RESULTS_SCREEN_WIN = "SendMessage - Rewards";
const CONSOLE_RESULTS_SCREEN_LOSE = "SendMessage - Eliminated";
const CONSOLE_LOADING_GAME = "ServerFSM: Enter Lobby TeleportingToGame";
const CONSOLE_IN_GAME = "GameplayState: ingame";

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

  // Initializating our client client
  const client = new Client(page);
  await client.init();

  // Initializing our player
  const player = new Player(page);

  // Start tutorial
  console.log("Starting Tutorial");
  player.race(1000);

  page.on("console", async (msg) => {
    // Rewards Screen
    if (
      msg.text().includes(CONSOLE_PREFIX + CONSOLE_RESULTS_SCREEN_WIN) ||
      msg.text().includes(CONSOLE_PREFIX + CONSOLE_RESULTS_SCREEN_LOSE)
    ) {
      await player.claimRewards();

      // No console message for entering waitroom yet, so just manually go there
      player.degen();
      await sleep(10000);
      await player.queueGame();
    }

    // Loading Screen
    if (msg.text().includes(CONSOLE_PREFIX + CONSOLE_LOADING_GAME)) {
      player.idle();
    }

    // In Game
    if (msg.text().includes(CONSOLE_PREFIX + CONSOLE_IN_GAME)) {
      player.raceWithGpt4(QUERY_GPT_INTERVAL);
    }
  });
}

start();

// function createWorker() {
//   return new Worker(__filename);
// }

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
