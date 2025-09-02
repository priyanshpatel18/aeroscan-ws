import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { db } from "../db";
const bs58 = require("bs58").default;

const PROGRAM_ID = new PublicKey("D5r3dMspUTkZiHDF3ZUQvD4dmATd1gjXHbzBdTtn7yU5");

const RPC_URL = process.env.HELIUS_RPC_URL ?? "https://api.devnet.solana.com";

// Two separate connections
// 1) Standard Solana RPC (for IDL + account fetching)
const solanaConnection = new Connection(RPC_URL, "confirmed");

// 2) Magicblock RPC (for sending txs)
const magicblockConnection = new Connection("https://devnet.magicblock.app/", {
  wsEndpoint: "wss://devnet.magicblock.app/",
});

// Service wallet
const secretKey = bs58.decode(process.env.PRIVATE_KEY || "");
const serviceKeypair = Keypair.fromSecretKey(secretKey);

// Providers
const solanaProvider = new anchor.AnchorProvider(
  solanaConnection,
  new anchor.Wallet(serviceKeypair),
  { preflightCommitment: "processed" }
);

const magicblockProvider = new anchor.AnchorProvider(
  magicblockConnection,
  new anchor.Wallet(serviceKeypair),
  { preflightCommitment: "processed" }
);

// Cached Program client
let program: anchor.Program | null = null;

const [SENSOR_READING_PDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("sensor_reading"), solanaProvider.wallet.publicKey.toBuffer()],
  PROGRAM_ID
);

async function getProgramClient(): Promise<anchor.Program> {
  if (!program) {
    const idl = await anchor.Program.fetchIdl(PROGRAM_ID, solanaProvider);
    if (!idl) throw new Error("IDL not found for program");

    program = new anchor.Program(idl, solanaProvider);
    console.log("aeroscan client initialized!!");
  }
  return program;
}

export async function updateReading(
  pm25: number,
  pm10: number,
  temperature: number,
  humidity: number
): Promise<string> {
  const program = await getProgramClient();

  const tx = await program.methods
    .updateReading(solanaProvider.wallet.publicKey, pm25, pm10, temperature, humidity)
    .accounts({
      sensorReading: SENSOR_READING_PDA,
    })
    .transaction();

  const {
    value: { blockhash, lastValidBlockHeight },
  } = await solanaConnection.getLatestBlockhashAndContext();

  tx.recentBlockhash = blockhash;
  tx.feePayer = solanaProvider.wallet.publicKey;

  tx.sign((solanaProvider.wallet as anchor.Wallet).payer);

  const signature = await solanaConnection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
  });

  await solanaConnection.confirmTransaction(
    { blockhash, lastValidBlockHeight, signature },
    "processed"
  );
  return signature;
}

export async function subscribeToEvents(onEvent?: (event: any) => void) {
  const program = await getProgramClient();
  const eventParser = new anchor.EventParser(PROGRAM_ID, program.coder);

  solanaConnection.onLogs(
    PROGRAM_ID,
    async (log) => {
      try {
        const events = eventParser.parseLogs(log.logs);

        for (const event of events) {
          if (event.name !== "sensorReadingEvent") continue;

          // Convert BN to number
          const parsedData: Record<string, any> = {};
          for (const [key, value] of Object.entries(event.data)) {
            if (key === "timestamp") {
              parsedData[key] = new Date((value as any).toNumber() * 1000).toISOString();
            } else {
              parsedData[key] = (value as any)?.toNumber?.() ?? value;
            }
          }

          await db.sensorReading.create({
            data: {
              temperature: parsedData.temperature,
              humidity: parsedData.humidity,
              // TODO: add pm25 and pm10
              // pm25,
              // pm10,
              // aqi
            }
          });
          if (onEvent) {
            onEvent({ name: event.name, data: parsedData });
          }
        }
      } catch (err) {
        console.error("Error parsing logs:", err);
      }
    },
    "confirmed"
  );

}
