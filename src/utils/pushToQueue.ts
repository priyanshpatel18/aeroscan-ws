import { redis } from "../db/redis";
import { Queue } from "bullmq";

const REDIS_QUEUE_NAME = process.env.WAITING_QUEUE_TEST || "waiting-queue";

export const waitingQueue = new Queue(REDIS_QUEUE_NAME, {
  connection: redis
});

export async function pushToQueue(data: any) {
  await waitingQueue.add("game-worker-job", data);
}