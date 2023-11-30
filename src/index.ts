import puppeteer from "puppeteer";
import { Worker, isMainThread, parentPort } from "worker_threads";
import { Client } from "./client";
import { Player } from "./player";
import { sleep } from "./utils";

// General Configs
const BUDDY_BLITZ_URL =
  // "https://staging.spatial.io/s/Buddy-Blitz-64ca9918868d158db2396a48?share=2373298131708457040";
  "https://www.spatial.io/s/Buddy-Blitz-654965ac75a12ef6a86cd763?share=7456046816804876294";
const IMAGE_FOLDER = "screenshots";

// Agent Controls
const QUERY_GPT_INTERVAL = 6000;

// Console Log Events
const CONSOLE_PREFIX = "SpatialGame: ";
const CONSOLE_START_TUTORIAL = "Client Tutorial";
const CONSOLE_RESULTS_SCREEN = "Client Show Results";
const CONSOLE_LOBBY = "Client: Enter Lobby";
const CONSOLE_LOADING_GAME = "Client: Selecting stage";
const CONSOLE_IN_GAME = "Client: Gameplay";

async function start() {
  try {
    // Launch the browser
    console.log("Launching Browser");
    // const browser = await puppeteer.launch({ headless: "new" });
    const browser = await puppeteer.launch({
      headless: false,
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 600 });

    // Go to the website and wait for everything to load
    console.log(`Going to ${BUDDY_BLITZ_URL}`);
    await page.goto(BUDDY_BLITZ_URL, { waitUntil: "networkidle2" });

    // Initializing our player
    const player = new Player(page);

    page.on("console", async (msg) => {
      // Tutorial
      if (msg.text().includes(CONSOLE_PREFIX + CONSOLE_START_TUTORIAL)) {
        await player.race(1200);
      }

      // Rewards Screen
      if (msg.text().includes(CONSOLE_PREFIX + CONSOLE_RESULTS_SCREEN)) {
        await player.claimRewards();
      }

      // Lobby
      if (msg.text().includes(CONSOLE_PREFIX + CONSOLE_LOBBY)) {
        player.degen();
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

    // Initializating our client
    const client = new Client(page);
    await client.init();
  } catch (err) {
    console.log("Error with Puppeteer instance:", err);
  }
}

async function main() {
  const browserInstances = Array.from({ length: 1 }).map(start);
  Promise.all(browserInstances);

  // Run an interval for 30 minutes at a time
  setInterval(async () => {
    const browserInstances = Array.from({ length: 3 }).map(start);
    Promise.all(browserInstances);
  }, 30 * 60 * 1000);
}

main().catch(console.error);

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
