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
  updateDoc,
} from "firebase/firestore";
import { v4 as uuidv4 } from "uuid";
import type { Timestamp as TimestampType } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  databaseURL: process.env.DATABASE_URL,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSENGER_SENDER_ID,
  appId: process.env.APP_ID,
};

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

  return querySnapshot.docs[0]?.data() as UsagePlanRecord;
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

async function getSpaceUsage({ spaceId, pluginId }: BasicProps) {
  const querySnapshot = await getDocs(
    query(
      collection(db, "UsageSpaces"),
      where("spaceId", "==", spaceId),
      where("pluginId", "==", pluginId)
    )
  );

  if (
    Array.isArray(querySnapshot?.docs) &&
    typeof querySnapshot?.docs[0]?.data === "function"
  ) {
    return querySnapshot?.docs[0]?.data() as UsageSpaceRecord;
  }
}

export async function checkSpaceUsage({ spaceId, pluginId }: BasicProps) {
  const spaceUsage = await getSpaceUsage({ spaceId, pluginId });

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

export async function getSpaceSettings({ pluginId, spaceId }: BasicProps) {
  const querySnapshot = await getDocs(
    query(
      collection(db, "SpaceSettings"),
      where("spaceId", "==", spaceId),
      where("pluginId", "==", pluginId)
    )
  );

  let spaceSettings: SpaceSettings | null = null;

  if (
    Array.isArray(querySnapshot?.docs) &&
    typeof querySnapshot?.docs[0]?.data === "function"
  ) {
    spaceSettings = querySnapshot?.docs[0]?.data() as SpaceSettings;
  }

  if (spaceSettings) {
    // not empty
    return {
      ...spaceSettings,
      id: querySnapshot.docs[0].id,
    };
  }

  const spaceUsage = await getSpaceUsage({ pluginId, spaceId });

  const planDetails = await getUsagePlan({
    pluginId,
    planName: spaceUsage?.plan?.name || "free",
  });

  return {
    id: undefined,
    createdAt: Timestamp.fromDate(new Date(Date.now())),
    pluginId,
    spaceId,
    notTranslatableWords: {
      set: [],
      limit: planDetails.notTranslatableWordsLimit,
    },
  };
}

export async function saveSpaceSettings({
  pluginId,
  spaceId,
  notTranslatableWords,
}: SpaceSettingsProps) {
  const spaceSettings = await getSpaceSettings({ pluginId, spaceId });
  const modified = Timestamp.fromDate(new Date(Date.now()));

  if (Object.keys(spaceSettings).length && spaceSettings.id) {
    await updateDoc(doc(db, "SpaceSettings", spaceSettings.id), {
      modified,
      notTranslatableWords,
    });
  } else {
    await setDoc(doc(collection(db, "SpaceSettings"), uuidv4()), {
      pluginId,
      spaceId,
      createdAt: modified,
      notTranslatableWords,
    });
  }
}

type NotTranslatableWords = {
  set: string[];
  limit: number;
};

type SpaceSettings = {
  id?: string;
  createdAt: string;
  modified: string;
  pluginId: number;
  spaceId: number;
  notTranslatableWords?: NotTranslatableWords;
};

type SpaceSettingsProps = {
  pluginId: number;
  spaceId: number;
  notTranslatableWords?: NotTranslatableWords;
};

type UsagePlanRecord = {
  name: string;
  pluginId: number;
  limit?: number;
  periodInDays?: number;
  startDate?: TimestampType;
  notTranslatableWordsLimit: number;
};

type UsageSpaceRecord = {
  createdAt: string;
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
  spaceId?: number;
  pluginId: number;
}

interface PlanProps extends BasicProps {
  planName: string;
}
