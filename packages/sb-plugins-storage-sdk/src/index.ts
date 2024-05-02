import { config as dotEnvConfig } from "dotenv";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  where,
  query,
  getDocs,
  setDoc,
  doc,
  Timestamp,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import type { Timestamp as TimestampType } from "firebase/firestore";

dotEnvConfig();

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  databaseURL: process.env.DATABASE_URL,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSENGER_SENDER_ID,
  appId: process.env.APP_ID,
};

type UsagePlanRecord = {
  name: string;
  pluginId: number;
  limit?: number;
  periodInDays?: number;
  startDate?: TimestampType;
};

type UsageSpaceRecord = {
  plan: UsagePlanRecord;
  pluginId: number;
  spaceId: number;
};

type Event = "fieldLevelTranslation" | "folderLevelTranslation";

export type UsageEventRecord = {
  date: TimestampType;
  pluginId: number;
  spaceId: number;
  userId: number;
  errorMessage?: string;
  eventName: Event;
};

interface BasicProps {
  spaceId: number;
  pluginId: number;
}

interface PlanProps extends BasicProps {
  planName: string;
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function isUseAllowed(spaceUsage: UsageSpaceRecord) {
  const limit = spaceUsage.plan.limit;
  const period = spaceUsage.plan.periodInDays;

  if (!limit) {
    return true;
  }

  if (limit && period) {
    const currentTimestamp = Date.now();
    const currentDate = Timestamp.fromDate(new Date(currentTimestamp));
    const periodStartDate = Timestamp.fromDate(
      new Date(currentTimestamp - period * 24 * 60 * 60 * 1000)
    );

    const querySnapshot = await getDocs(
      query(
        collection(db, "UsageEvents"),
        where("date", ">", periodStartDate),
        where("date", "<", currentDate)
      )
    );

    const count = querySnapshot.docs.length;

    if (limit < count) {
      return false;
    }
  }

  return true;
}

async function getUsagePlan({ pluginId, planName }: PlanProps) {
  const querySnapshot = await getDocs(
    query(
      collection(db, "UsagePlans"),
      where("name", "==", planName),
      where("pluginId", "==", pluginId)
    )
  );

  return querySnapshot.docs[0]?.data();
}

async function initSpaceUsage({ spaceId, pluginId, planName }: PlanProps) {
  const usagePlan = await getUsagePlan({ spaceId, pluginId, planName });

  if (usagePlan) {
    const usageEventsRef = collection(db, "UsageSpaces");

    await setDoc(doc(usageEventsRef, uuidv4()), {
      createdAt: Timestamp.fromDate(new Date(Date.now())),
      spaceId,
      pluginId,
      plan: usagePlan,
    });

    return true;
  }

  return false;
}

export async function checkSpaceUsage({ spaceId, pluginId }: BasicProps) {
  const querySnapshot = await getDocs(
    query(
      collection(db, "UsageSpaces"),
      where("spaceId", "==", spaceId),
      where("pluginId", "==", pluginId)
    )
  );

  const spaceUsage = querySnapshot.docs[0]?.data() as UsageSpaceRecord;

  if (!spaceUsage) {
    const planName = "free";

    return await initSpaceUsage({ spaceId, pluginId, planName });
  } else {
    const canProceed = await isUseAllowed(spaceUsage);

    if (canProceed) {
      return true;
    }
  }

  return false;
}

export async function saveUsage({
  eventName,
  pluginId,
  spaceId,
  userId,
  errorMessage,
}: UsageEventRecord) {
  const usageEventsRef = collection(db, "UsageEvents");

  const document: UsageEventRecord = {
    date: Timestamp.fromDate(new Date(Date.now())),
    eventName,
    pluginId,
    spaceId,
    userId,
  };

  if (errorMessage) {
    document.errorMessage = errorMessage;
  }

  await setDoc(doc(usageEventsRef, uuidv4()), { ...document });
}
