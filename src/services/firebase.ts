import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, getDocs, collection, query, where, onSnapshot } from 'firebase/firestore';
import { UserProfile, MasteryProgress, QuizRecord, StudyChapter } from '../types';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

// Global service refs
let db: any = null;
let auth: any = null;
let isFirebaseEnabled = false;

// Safe wrapper to load file and initialize Firebase
async function initFirebase() {
  try {
    // Fetch the config via browser fetch so Rollup doesn't try to compile it statically
    const response = await fetch('/firebase-applet-config.json');
    if (!response.ok) throw new Error();
    const firebaseConfig = await response.json();

    if (firebaseConfig && firebaseConfig.apiKey) {
      const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
      db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);
      auth = getAuth(app);
      isFirebaseEnabled = true;

      // Validate connection to Firestore as requested by the skill instructions
      try {
        const { getDocFromServer } = await import('firebase/firestore');
        await getDocFromServer(doc(db, 'test', 'connection'));
        console.log("Firebase initialized and verified successfully.");
      } catch (connErr) {
        console.warn("Firestore validation ping offline:", connErr);
      }
    }
  } catch (err) {
    console.warn("Firebase config not found or uninitialized. Falling back to local responsive mock databases.");
  }
}

// Initialize immediately in browser background, fail gracefully
initFirebase();

export function isCloudEnabled(): boolean {
  return isFirebaseEnabled;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid || 'offline_user',
      email: auth?.currentUser?.email || null,
      emailVerified: auth?.currentUser?.emailVerified || false,
    },
    operationType,
    path
  };
  console.error('Firestore Hardened Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// LOCAL HARD DISK (LOCALSTORAGE) SYNC ENGINES
// These fallback structures replicate Firestore schema perfectly
const STORAGE_PREFIX = 'hear2learn_';

function getLocal<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const item = localStorage.getItem(STORAGE_PREFIX + key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    return defaultValue;
  }
}

function saveLocal(key: string, data: any) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch (e) {
    console.error("Local storage sync error", e);
  }
}

// CORE DB DATA ACCESSIBLE FUNCTIONS WITH DUAL MODE ROUTING

// 1. User profile persistence
export async function saveUserProfile(profile: UserProfile): Promise<void> {
  if (isFirebaseEnabled && auth?.currentUser) {
    const path = `users/${profile.uid}`;
    try {
      await setDoc(doc(db, 'users', profile.uid), {
        ...profile,
        createdAt: new Date(profile.createdAt),
        updatedAt: new Date(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  } else {
    saveLocal('user_profile', profile);
  }
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  if (isFirebaseEnabled && auth?.currentUser) {
    const path = `users/${uid}`;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        const data = snap.data();
        return {
          uid: data.uid,
          totalStudyTime: data.totalStudyTime || 0,
          language: data.language || 'en-US',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
        };
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  }
  return getLocal<UserProfile | null>('user_profile', {
    uid: 'local_student',
    totalStudyTime: 12,
    language: 'en-US',
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

// 2. Study Materials (Chapters) persistence
export async function saveStudyChapter(chapter: StudyChapter): Promise<void> {
  const uid = auth?.currentUser?.uid || 'local_student';
  if (isFirebaseEnabled && auth?.currentUser) {
    const path = `users/${uid}/materials/${chapter.id}`;
    try {
      await setDoc(doc(db, 'users', uid, 'materials', chapter.id), {
        userId: uid,
        title: chapter.title,
        content: chapter.content,
        createdAt: new Date(chapter.createdAt),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  } else {
    const items = getLocal<StudyChapter[]>('study_materials', []);
    const updated = items.filter(ch => ch.id !== chapter.id);
    updated.push(chapter);
    saveLocal('study_materials', updated);
  }
}

export async function getStudyChapters(): Promise<StudyChapter[]> {
  const uid = auth?.currentUser?.uid || 'local_student';
  if (isFirebaseEnabled && auth?.currentUser) {
    const path = `users/${uid}/materials`;
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'materials'));
      const list: StudyChapter[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        list.push({
          id: doc.id,
          title: data.title || '',
          content: data.content || '',
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
        });
      });
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  }
  // Load standard pre-populated Biology notes for demo as requested by mock flow
  const photosynthesisDefault: StudyChapter = {
    id: 'biology_photosynthesis',
    title: 'Biology - Photosynthesis',
    content: `Photosynthesis is the essential biological process by which green plants, algae, and some bacteria capture light energy and convert it into chemical energy in the form of organic sugars like glucose. This critical reaction primarily takes place in the chloroplasts of plant cells, utilizing the green pigment chlorophyll to drive the transformation.
The biochemical process consists of two primary stages: the light-dependent reactions and the light-independent reactions (commonly known as the Calvin Cycle). The overall chemical equation is: carbon dioxide and water, in the presence of sunlight and chlorophyll, produce glucose and oxygen gas as a byproduct.
During the light-dependent stage, chlorophyll within the thylakoid membranes absorbs solar energy, splitting water molecules through photolysis to release oxygen and generate ATP and NADPH molecules. In the subsequent Calvin Cycle occurring in the stroma, these ATP and NADPH energy carriers are utilized to fix carbon dioxide molecules into glucose, fueling life on Earth.`,
    createdAt: new Date()
  };
  let list = getLocal<StudyChapter[]>('study_materials', []);
  // Clean up any old osmosis demo chapters and force photosynthesis update
  if (list.length === 0 || list.some(ch => ch.id === 'biology_osmosis') || !list.some(ch => ch.id === 'biology_photosynthesis')) {
    list = list.filter(ch => ch.id !== 'biology_osmosis' && ch.id !== 'biology_photosynthesis');
    list.push(photosynthesisDefault);
    saveLocal('study_materials', list);
  }
  return list;
}

// 3. Learning Progress persistence
export async function saveLearnerProgress(progress: MasteryProgress): Promise<void> {
  const uid = auth?.currentUser?.uid || 'local_student';
  if (isFirebaseEnabled && auth?.currentUser) {
    const path = `users/${uid}/progress/${progress.chapterId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'progress', progress.chapterId), {
        ...progress,
        updatedAt: new Date()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  } else {
    const list = getLocal<MasteryProgress[]>('learner_progress', []);
    const updated = list.filter(p => p.chapterId !== progress.chapterId);
    updated.push(progress);
    saveLocal('learner_progress', updated);
  }
}

export async function getLearnerProgress(): Promise<MasteryProgress[]> {
  const uid = auth?.currentUser?.uid || 'local_student';
  if (isFirebaseEnabled && auth?.currentUser) {
    const path = `users/${uid}/progress`;
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'progress'));
      const list: MasteryProgress[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        list.push({
          userId: data.userId || uid,
          chapterId: data.chapterId || doc.id,
          chapterTitle: data.chapterTitle || '',
          status: data.status || 'in-progress',
          masteredConcepts: data.masteredConcepts || [],
          weakTopics: data.weakTopics || [],
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt)
        });
      });
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  }
  let list = getLocal<MasteryProgress[]>('learner_progress', []);
  if (list.length === 0 || list.some(p => p.chapterId === 'biology_osmosis')) {
    list = list.filter(p => p.chapterId !== 'biology_osmosis');
    list.push({
      userId: 'local_student',
      chapterId: 'biology_photosynthesis',
      chapterTitle: 'Biology - Photosynthesis',
      status: 'in-progress',
      masteredConcepts: ['Light Energy Capture'],
      weakTopics: ['Calvin Cycle Stages'],
      updatedAt: new Date()
    });
    saveLocal('learner_progress', list);
  }
  return list;
}

// 4. Quiz History persistence
export async function saveQuizRecord(record: QuizRecord): Promise<void> {
  const uid = auth?.currentUser?.uid || 'local_student';
  if (isFirebaseEnabled && auth?.currentUser) {
    const randId = Math.random().toString(36).substring(7);
    const path = `users/${uid}/quizzes/${randId}`;
    try {
      await setDoc(doc(db, 'users', uid, 'quizzes', randId), {
        ...record,
        createdAt: new Date()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  } else {
    const list = getLocal<QuizRecord[]>('quiz_records', []);
    list.push({
      ...record,
      id: Math.random().toString(36).substring(7)
    });
    saveLocal('quiz_records', list);
  }
}

export async function getQuizRecords(): Promise<QuizRecord[]> {
  const uid = auth?.currentUser?.uid || 'local_student';
  if (isFirebaseEnabled && auth?.currentUser) {
    const path = `users/${uid}/quizzes`;
    try {
      const snap = await getDocs(collection(db, 'users', uid, 'quizzes'));
      const list: QuizRecord[] = [];
      snap.forEach(doc => {
        const data = doc.data();
        list.push({
          id: doc.id,
          userId: data.userId || uid,
          chapterTitle: data.chapterTitle || '',
          score: data.score || 0,
          totalQuestions: data.totalQuestions || 0,
          weakAreasDetected: data.weakAreasDetected || [],
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt)
        });
      });
      return list;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, path);
    }
  }
  return getLocal<QuizRecord[]>('quiz_records', [
    {
      id: 'demo_quiz_1',
      userId: 'local_student',
      chapterTitle: 'Biology - Photosynthesis',
      score: 1,
      totalQuestions: 2,
      weakAreasDetected: ['Calvin Cycle Stages'],
      createdAt: new Date(Date.now() - 3600000 * 24)
    }
  ]);
}
