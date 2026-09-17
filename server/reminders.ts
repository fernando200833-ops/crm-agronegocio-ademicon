import { Request, Response } from 'express';
import { sdk } from './_core/sdk';
import * as db from './db';
import { notifyOwner } from './_core/notification';

export async function handleScheduledReminders(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const result = await db.dispatchDueReminders();
    return res.json({ ok: true, ...result });
  } catch (error: any) {
    console.error("[Reminders Cron Error]:", error);
    return res.status(500).json({
      error: String(error?.message || error),
      stack: error?.stack,
      timestamp: new Date().toISOString(),
    });
  }
}
