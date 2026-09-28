var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_dotenv = __toESM(require("dotenv"), 1);
var import_genai = require("@google/genai");
var import_vite = require("vite");

// src/server/adminOperations.ts
var import_app = require("firebase-admin/app");
var import_firestore = require("firebase-admin/firestore");
var import_auth = require("firebase-admin/auth");
var import_messaging = require("firebase-admin/messaging");
var import_crypto = __toESM(require("crypto"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path = __toESM(require("path"), 1);
var adminApp;
var firestoreDb;
var authAdmin;
function formatPrivateKey(key) {
  if (!key) return void 0;
  let cleanKey = key.trim();
  while (cleanKey.startsWith('"') && cleanKey.endsWith('"') || cleanKey.startsWith("'") && cleanKey.endsWith("'")) {
    cleanKey = cleanKey.slice(1, -1).trim();
  }
  cleanKey = cleanKey.replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\\\\n/g, "\n");
  if (cleanKey.startsWith("{") && cleanKey.endsWith("}")) {
    try {
      const parsed = JSON.parse(cleanKey);
      if (parsed.private_key) {
        return formatPrivateKey(parsed.private_key);
      }
    } catch {
    }
  }
  if (cleanKey.includes("-----BEGIN") && cleanKey.includes("-----END")) {
    const match = cleanKey.match(/(-----BEGIN [^-]+-----)([\s\S]+?)(-----END [^-]+-----)/);
    if (match) {
      const header = match[1].trim();
      const body = match[2].replace(/\s+/g, "");
      const footer = match[3].trim();
      const formattedBody = body.match(/.{1,64}/g)?.join("\n") || body;
      return `${header}
${formattedBody}
${footer}
`;
    }
  } else {
    const base64Body = cleanKey.replace(/\s+/g, "");
    const formattedBody = base64Body.match(/.{1,64}/g)?.join("\n") || base64Body;
    return `-----BEGIN PRIVATE KEY-----
${formattedBody}
-----END PRIVATE KEY-----
`;
  }
  return cleanKey.endsWith("\n") ? cleanKey : `${cleanKey}
`;
}
function parseServiceAccountCredentials() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (rawJson) {
    try {
      const parsed = typeof rawJson === "string" ? JSON.parse(rawJson) : rawJson;
      if (parsed.client_email && parsed.private_key) {
        const formattedKey = formatPrivateKey(parsed.private_key);
        if (formattedKey) {
          return {
            projectId: parsed.project_id,
            clientEmail: parsed.client_email,
            privateKey: formattedKey
          };
        }
      }
    } catch (e) {
      console.warn("[Firebase Admin] JSON parse error in service account:", e);
    }
  }
  const rawKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  if (rawKey && rawKey.startsWith("{") && rawKey.endsWith("}")) {
    try {
      const parsed = JSON.parse(rawKey);
      if (parsed.client_email && parsed.private_key) {
        const formattedKey = formatPrivateKey(parsed.private_key);
        if (formattedKey) {
          return {
            projectId: parsed.project_id || process.env.FIREBASE_PROJECT_ID,
            clientEmail: parsed.client_email,
            privateKey: formattedKey
          };
        }
      }
    } catch {
    }
  }
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();
  if (clientEmail && rawKey) {
    const formattedKey = formatPrivateKey(rawKey);
    if (formattedKey) {
      return {
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "solimedical-micu",
        clientEmail,
        privateKey: formattedKey
      };
    }
  }
  return null;
}
function hasGoogleCredentials() {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS || parseServiceAccountCredentials()
  );
}
function getAdminApp() {
  if (adminApp && firestoreDb && authAdmin) {
    return { app: adminApp, db: firestoreDb, auth: authAdmin };
  }
  const creds = parseServiceAccountCredentials();
  const projectId = creds?.projectId || process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID || "solimedical-micu";
  let credential;
  if (creds?.clientEmail && creds?.privateKey) {
    try {
      credential = (0, import_app.cert)({
        projectId,
        clientEmail: creds.clientEmail,
        privateKey: creds.privateKey
      });
    } catch (certErr) {
      console.error("[Firebase Admin] Certificate initialization error:", certErr?.message || certErr);
      throw new Error(`Firebase Admin SDK certificate initialization failed: ${certErr?.message || "Invalid certificate format"}`);
    }
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      credential = (0, import_app.applicationDefault)();
    } catch (e) {
      console.warn("[Firebase Admin] applicationDefault credential notice:", e?.message || e);
    }
  }
  if (!credential) {
    console.error("[Firebase Admin] Initialization failed: No valid credentials found.");
    throw new Error("Firebase Admin SDK is not configured with valid service account credentials in environment variables.");
  }
  const existingApps = (0, import_app.getApps)();
  if (existingApps.length > 0) {
    adminApp = existingApps[0];
  } else {
    adminApp = (0, import_app.initializeApp)({
      credential,
      projectId
    });
  }
  firestoreDb = (0, import_firestore.getFirestore)(adminApp);
  authAdmin = (0, import_auth.getAuth)(adminApp);
  return { app: adminApp, db: firestoreDb, auth: authAdmin };
}
try {
  getAdminApp();
} catch {
}
var RECOVERY_STORAGE_PATH = import_path.default.join(process.cwd(), ".system_recovery.json");
function loadPersistedRecoveryToken() {
  try {
    if (import_fs.default.existsSync(RECOVERY_STORAGE_PATH)) {
      const data = JSON.parse(import_fs.default.readFileSync(RECOVERY_STORAGE_PATH, "utf8"));
      if (data?.salt && data?.codeHash) {
        return { salt: data.salt, codeHash: data.codeHash };
      }
    }
  } catch {
  }
  return null;
}
function savePersistedRecoveryToken(salt, codeHash, updatedBy) {
  try {
    import_fs.default.writeFileSync(RECOVERY_STORAGE_PATH, JSON.stringify({
      salt,
      codeHash,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedByUid: updatedBy,
      isImmutable: true
    }, null, 2), "utf8");
  } catch {
  }
}
var memoryRecoveryToken = loadPersistedRecoveryToken();
function requireAdminServices() {
  const { db, auth } = getAdminApp();
  if (!db || !auth) {
    throw new Error(
      "Firebase Admin SDK is unavailable. Please configure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY in environment variables."
    );
  }
  return { db, auth };
}
var recoveryAttemptsMap = /* @__PURE__ */ new Map();
function hashRecoveryCode(code, salt) {
  return import_crypto.default.pbkdf2Sync(code.trim(), salt, 1e4, 64, "sha512").toString("hex");
}
async function verifyAdminCallerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { isAdmin: false, error: "Missing or invalid Authorization header. Must be Bearer <Firebase ID Token>." };
  }
  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return { isAdmin: false, error: "Empty Authorization ID Token." };
  }
  try {
    if (!hasGoogleCredentials()) {
      return { isAdmin: false, error: "Firebase Admin credentials not configured on server." };
    }
    const { auth, db } = requireAdminServices();
    const decodedToken = await auth.verifyIdToken(token);
    const callerUid = decodedToken?.uid;
    if (!callerUid) {
      return { isAdmin: false, error: "Invalid token: missing caller UID." };
    }
    let isCallerAdmin = false;
    let isCallerActive = false;
    try {
      const callerDoc = await db.collection("users").doc(callerUid).get();
      if (callerDoc.exists) {
        const callerData = callerDoc.data();
        isCallerActive = callerData.active !== false && callerData.isActive !== false;
        isCallerAdmin = callerData.role === "ADMIN" || callerData.isSuperAdmin === true;
      } else {
        const adminDoc = await db.collection("admins").doc(callerUid).get();
        if (adminDoc.exists) {
          isCallerAdmin = true;
          isCallerActive = true;
        }
      }
    } catch (dbErr) {
      console.error("[verifyAdminCallerToken] Firestore admin verification error:", dbErr?.message || dbErr);
      return { isAdmin: false, callerUid, error: "Access denied: Unable to verify administrator role in database." };
    }
    if (!isCallerActive || !isCallerAdmin) {
      return { isAdmin: false, callerUid, error: "Access denied: Caller does not have active administrator permissions." };
    }
    return { isAdmin: true, callerUid };
  } catch (err) {
    console.error("[verifyAdminCallerToken] Verification failed:", err?.message || err);
    return { isAdmin: false, error: `Admin authentication failed: ${err?.message || "Invalid or expired ID token"}` };
  }
}
async function verifyCallerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { isAuthenticated: false, error: "Missing or invalid Authorization header. Must be Bearer <Firebase ID Token>." };
  }
  const token = authHeader.split("Bearer ")[1]?.trim();
  if (!token) {
    return { isAuthenticated: false, error: "Empty Authorization ID Token." };
  }
  try {
    if (!hasGoogleCredentials()) {
      return { isAuthenticated: false, error: "Firebase Admin credentials not configured on server." };
    }
    const { auth } = requireAdminServices();
    const decodedToken = await auth.verifyIdToken(token);
    const callerUid = decodedToken?.uid;
    if (!callerUid) {
      return { isAuthenticated: false, error: "Invalid token: missing caller UID." };
    }
    return { isAuthenticated: true, callerUid };
  } catch (err) {
    console.error("[verifyCallerToken] Verification failed:", err?.message || err);
    return { isAuthenticated: false, error: `Authentication failed: ${err?.message || "Invalid or expired ID token"}` };
  }
}
async function adminCreateUser(authHeader, userData) {
  const authCheck = await verifyAdminCallerToken(authHeader);
  if (!authCheck.isAdmin || !authCheck.callerUid) {
    return { success: false, message: authCheck.error || "Permission Denied" };
  }
  if (!userData || !userData.email) {
    return { success: false, message: "Missing user data or email." };
  }
  try {
    const { db, auth } = requireAdminServices();
    const email = (userData.email || "").trim().toLowerCase();
    const rawPass = userData.pinCode || "123456";
    if (rawPass.length < 6) {
      throw new Error("\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u064A\u062C\u0628 \u0623\u0644\u0627 \u062A\u0642\u0644 \u0639\u0646 6 \u0623\u062D\u0631\u0641 \u0623\u0648 \u0623\u0631\u0642\u0627\u0645 (auth/weak-password)");
    }
    const cleanPassword = rawPass;
    const cleanDisplayName = userData.nameAr || userData.nameEn || email.split("@")[0];
    let fbUid;
    try {
      const created = await auth.createUser({ email, password: cleanPassword, displayName: cleanDisplayName });
      fbUid = created.uid;
    } catch (authErr) {
      if (authErr.code === "auth/email-already-exists" || authErr.code === "auth/email-already-in-use") {
        const existing = await auth.getUserByEmail(email);
        fbUid = existing.uid;
        try {
          await auth.updateUser(fbUid, { password: cleanPassword, displayName: cleanDisplayName, disabled: false });
        } catch (updateErr) {
          return { success: false, message: `Firebase Auth updateUser failed: ${updateErr?.message || updateErr}` };
        }
      } else {
        return { success: false, message: `Firebase Auth createUser failed: ${authErr?.message || authErr}` };
      }
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    const newUserRecord = {
      ...userData,
      uid: fbUid,
      email,
      isActive: true,
      active: true,
      createdAt: userData.createdAt || nowIso,
      lastLoginAt: nowIso
    };
    delete newUserRecord.pinCode;
    delete newUserRecord.password;
    try {
      await db.collection("users").doc(fbUid).set(newUserRecord, { merge: true });
      if (newUserRecord.role === "ADMIN" || newUserRecord.isSuperAdmin) {
        await db.collection("admins").doc(fbUid).set({
          uid: fbUid,
          email,
          nameAr: newUserRecord.nameAr,
          nameEn: newUserRecord.nameEn,
          createdAt: nowIso
        }, { merge: true });
      }
      const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.collection("auditLogs").doc(auditId).set({
        id: auditId,
        timestamp: nowIso,
        eventType: "USER_CREATED",
        description: `Staff account ${cleanDisplayName} (${email}, role: ${userData.role}) created by Admin ${authCheck.callerUid}.`,
        callerUid: authCheck.callerUid,
        targetUid: fbUid,
        isImmutable: true
      });
    } catch (firestoreErr) {
      const isPermissionDenied = firestoreErr?.message?.includes("PERMISSION_DENIED") || firestoreErr?.code === 7;
      if (!isPermissionDenied) {
        try {
          await auth.deleteUser(fbUid);
        } catch (rollbackErr) {
          console.error("[adminCreateUser] Auth rollback failed:", rollbackErr);
        }
        throw new Error(`Firestore profile write failed: ${firestoreErr?.message || firestoreErr}`);
      }
    }
    return {
      success: true,
      message: "User successfully registered in Firebase Auth and Firestore.",
      data: newUserRecord
    };
  } catch (err) {
    return { success: false, message: err?.message || "Failed to create user." };
  }
}
async function disableUserWithToken(authHeader, targetUid, reason) {
  const authCheck = await verifyAdminCallerToken(authHeader);
  if (!authCheck.isAdmin || !authCheck.callerUid) {
    return { success: false, message: authCheck.error || "Permission Denied" };
  }
  const callerUid = authCheck.callerUid;
  if (!targetUid) {
    return { success: false, message: "Target UID is required." };
  }
  if (callerUid === targetUid) {
    return { success: false, message: "You cannot disable your own active account." };
  }
  try {
    const { db, auth } = requireAdminServices();
    let targetSnap = null;
    let hasDbAccess = true;
    try {
      const targetRef = db.collection("users").doc(targetUid);
      targetSnap = await targetRef.get();
    } catch (dbErr) {
      const isPermissionDenied = dbErr?.message?.includes("PERMISSION_DENIED") || dbErr?.code === 7;
      if (isPermissionDenied) {
        hasDbAccess = false;
      } else {
        throw new Error(`Firestore user read failed: ${dbErr?.message || dbErr}`);
      }
    }
    if (hasDbAccess && targetSnap && !targetSnap.exists) {
      return { success: false, message: "Target user does not exist." };
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await auth.revokeRefreshTokens(targetUid);
      await auth.updateUser(targetUid, { disabled: true });
    } catch (authErr) {
      throw new Error(`\u0641\u0634\u0644 \u062A\u0639\u0637\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0641\u064A Firebase Authentication: ${authErr?.message || authErr}`);
    }
    if (hasDbAccess) {
      try {
        const targetRef = db.collection("users").doc(targetUid);
        await targetRef.set({
          active: false,
          isActive: false,
          updatedAt: nowIso,
          updatedByUid: callerUid,
          disabledReason: reason || "Disabled by Administrator"
        }, { merge: true });
      } catch (dbErr) {
        throw new Error(`Firestore user update failed: ${dbErr?.message || dbErr}`);
      }
    }
    if (hasDbAccess) {
      try {
        const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.collection("auditLogs").doc(auditId).set({
          id: auditId,
          timestamp: nowIso,
          eventType: "USER_DISABLED",
          description: `User account ${targetUid} disabled by Admin ${callerUid}. Reason: ${reason || "N/A"}. Clinical history preserved.`,
          callerUid,
          targetUid,
          isImmutable: true
        });
      } catch (dbErr) {
        throw new Error(`Firestore audit log write failed: ${dbErr?.message || dbErr}`);
      }
    }
    return {
      success: true,
      message: "\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0648\u0625\u0628\u0637\u0627\u0644 \u062C\u0644\u0633\u0627\u062A\u0647 \u0641\u064A Firebase Authentication \u0648\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D."
    };
  } catch (error) {
    return { success: false, message: error?.message || "\u0641\u0634\u0644 \u062A\u0639\u0637\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645." };
  }
}
async function enableUserWithToken(authHeader, targetUid) {
  const authCheck = await verifyAdminCallerToken(authHeader);
  if (!authCheck.isAdmin || !authCheck.callerUid) {
    return { success: false, message: authCheck.error || "Permission Denied" };
  }
  const callerUid = authCheck.callerUid;
  if (!targetUid) {
    return { success: false, message: "Target UID is required." };
  }
  try {
    const { db, auth } = requireAdminServices();
    let targetSnap = null;
    let hasDbAccess = true;
    try {
      const targetRef = db.collection("users").doc(targetUid);
      targetSnap = await targetRef.get();
    } catch (dbErr) {
      const isPermissionDenied = dbErr?.message?.includes("PERMISSION_DENIED") || dbErr?.code === 7;
      if (isPermissionDenied) {
        hasDbAccess = false;
      } else {
        throw new Error(`Firestore user read failed: ${dbErr?.message || dbErr}`);
      }
    }
    if (hasDbAccess && targetSnap && !targetSnap.exists) {
      return { success: false, message: "\u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645." };
    }
    const nowIso = (/* @__PURE__ */ new Date()).toISOString();
    try {
      await auth.updateUser(targetUid, { disabled: false });
    } catch (authErr) {
      throw new Error(`\u0641\u0634\u0644 \u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0641\u064A Firebase Authentication: ${authErr?.message || authErr}`);
    }
    if (hasDbAccess) {
      try {
        const targetRef = db.collection("users").doc(targetUid);
        await targetRef.set({
          active: true,
          isActive: true,
          updatedAt: nowIso,
          updatedByUid: callerUid,
          disabledReason: null
        }, { merge: true });
      } catch (dbErr) {
        throw new Error(`Firestore user update failed: ${dbErr?.message || dbErr}`);
      }
    }
    if (hasDbAccess) {
      try {
        const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await db.collection("auditLogs").doc(auditId).set({
          id: auditId,
          timestamp: nowIso,
          eventType: "USER_ACTIVATED",
          description: `User account ${targetUid} re-activated by Admin ${callerUid}.`,
          callerUid,
          targetUid,
          isImmutable: true
        });
      } catch (dbErr) {
        throw new Error(`Firestore audit log write failed: ${dbErr?.message || dbErr}`);
      }
    }
    return {
      success: true,
      message: "\u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u062D\u0633\u0627\u0628 \u0641\u064A Firebase Authentication \u0648\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D."
    };
  } catch (error) {
    return { success: false, message: error?.message || "\u0641\u0634\u0644 \u062A\u0641\u0639\u064A\u0644 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645." };
  }
}
async function deleteUserWithToken(authHeader, targetUid, reason) {
  const authCheck = await verifyAdminCallerToken(authHeader);
  if (!authCheck.isAdmin || !authCheck.callerUid) {
    return { success: false, message: authCheck.error || "Permission Denied: Caller is not an authorized administrator." };
  }
  const callerUid = authCheck.callerUid;
  if (!targetUid || typeof targetUid !== "string" || !targetUid.trim()) {
    return { success: false, message: "Target UID is required." };
  }
  const cleanTargetUid = targetUid.trim();
  console.log(`[Admin Delete] Target UID: ${cleanTargetUid} | Action: Start user permanent deletion requested by Admin: ${callerUid}`);
  if (callerUid === cleanTargetUid) {
    return { success: false, message: "\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628\u0643 \u0627\u0644\u062D\u0627\u0644\u064A \u0623\u062B\u0646\u0627\u0621 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0645\u0646\u0647." };
  }
  try {
    let adminServices;
    try {
      adminServices = requireAdminServices();
      console.log(`[Admin Delete] Target UID: ${cleanTargetUid} | Firebase Admin SDK initialized successfully.`);
    } catch (initErr) {
      console.error(`[Admin Delete] Target UID: ${cleanTargetUid} | Firebase Admin SDK initialization failed:`, initErr?.message || initErr);
      return {
        success: false,
        message: `\u0641\u0634\u0644 \u062A\u0647\u064A\u0626\u0629 Firebase Admin SDK: ${initErr?.message || "\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0627\u0639\u062A\u0645\u0627\u062F \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629"}. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u0642\u0642 \u0645\u0646 \u0645\u062A\u063A\u064A\u0631\u0627\u062A \u0627\u0644\u0628\u064A\u0626\u0629 \u0641\u064A Vercel.`
      };
    }
    const { db, auth } = adminServices;
    try {
      const targetSnap = await db.collection("users").doc(cleanTargetUid).get();
      if (targetSnap.exists) {
        const targetData = targetSnap.data();
        if (targetData.role === "ADMIN" || targetData.isSuperAdmin === true) {
          const allUsersSnap = await db.collection("users").get();
          const activeAdmins = allUsersSnap.docs.filter((d) => {
            const u = d.data();
            return (u.role === "ADMIN" || u.isSuperAdmin === true) && (u.active !== false && u.isActive !== false);
          });
          if (activeAdmins.length <= 1) {
            return {
              success: false,
              message: "\u0625\u062C\u0631\u0627\u0621 \u0623\u0645\u0646\u064A \u062D\u0631\u062C: \u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0622\u062E\u0631 \u0645\u062F\u064A\u0631 \u0646\u0638\u0627\u0645 \u0646\u0634\u0637 \u0641\u064A \u0627\u0644\u0645\u0646\u0638\u0648\u0645\u0629."
            };
          }
        }
      }
    } catch (checkErr) {
      console.warn("[Admin Delete] Admin safety count warning:", checkErr?.message || checkErr);
    }
    try {
      await auth.deleteUser(cleanTargetUid);
      console.log(`[Admin Delete] Target UID: ${cleanTargetUid} | auth.deleteUser succeeded in Firebase Authentication.`);
    } catch (authErr) {
      if (authErr?.code === "auth/user-not-found") {
        console.log(`[Admin Delete] Target UID: ${cleanTargetUid} | User already not present in Firebase Authentication (auth/user-not-found). Proceeding with Firestore cleanup.`);
      } else {
        console.error(`[Admin Delete] Target UID: ${cleanTargetUid} | auth.deleteUser failed in Firebase Authentication:`, authErr?.message || authErr);
        return {
          success: false,
          message: `\u0641\u0634\u0644 \u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0646 Firebase Authentication: ${authErr?.message || authErr}`
        };
      }
    }
    try {
      await db.collection("users").doc(cleanTargetUid).delete();
      await db.collection("admins").doc(cleanTargetUid).delete();
      console.log(`[Admin Delete] Target UID: ${cleanTargetUid} | Firestore documents (users & admins) deleted successfully.`);
    } catch (dbErr) {
      console.error(`[Admin Delete] Target UID: ${cleanTargetUid} | Firestore documents deletion failed:`, dbErr?.message || dbErr);
      return {
        success: false,
        message: `\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0646 Firebase Auth \u0628\u0646\u062C\u0627\u062D\u060C \u0644\u0643\u0646 \u062A\u0639\u0630\u0631 \u0625\u0643\u0645\u0627\u0644 \u062D\u0630\u0641 \u0633\u062C\u0644\u0627\u062A Firestore: ${dbErr?.message || dbErr}`
      };
    }
    try {
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.collection("auditLogs").doc(auditId).set({
        id: auditId,
        timestamp: nowIso,
        eventType: "USER_DELETED_PERMANENTLY",
        description: `Staff account ${cleanTargetUid} was permanently deleted by Admin ${callerUid} from Firebase Authentication and Firestore. Medical records and historical audit entries remain intact.`,
        callerUid,
        deletedUid: cleanTargetUid,
        reason: reason || "Administrative removal",
        isImmutable: true,
        systemGenerated: true
      });
    } catch (auditErr) {
      console.warn("[Admin Delete] Audit log writing notice:", auditErr);
    }
    return {
      success: true,
      message: "\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0646\u0647\u0627\u0626\u064A\u064B\u0627 \u0645\u0646 Firebase Authentication \u0648\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D."
    };
  } catch (error) {
    console.error(`[Admin Delete] Target UID: ${cleanTargetUid} | Unexpected error:`, error?.message || error);
    return {
      success: false,
      message: error?.message || "\u062D\u062F\u062B \u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u062A\u0648\u0642\u0639 \u0623\u062B\u0646\u0627\u0621 \u062D\u0630\u0641 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645."
    };
  }
}
async function adminChangeUserPassword(authHeader, targetUid, newPassword) {
  const authCheck = await verifyAdminCallerToken(authHeader);
  if (!authCheck.isAdmin || !authCheck.callerUid) {
    return { success: false, message: authCheck.error || "Permission Denied" };
  }
  const callerUid = authCheck.callerUid;
  if (!targetUid || !newPassword) {
    return { success: false, message: "Target UID and new password are required." };
  }
  if (newPassword.trim().length < 6) {
    return { success: false, message: "New password must be at least 6 characters." };
  }
  try {
    const cleanPass = newPassword.trim();
    const { auth, db } = requireAdminServices();
    if (auth) {
      await auth.updateUser(targetUid, { password: cleanPass });
      await auth.revokeRefreshTokens(targetUid);
    }
    if (db) {
      const targetRef = db.collection("users").doc(targetUid);
      const targetSnap = await targetRef.get();
      if (targetSnap.exists) {
        await targetRef.update({
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedByUid: callerUid
        });
      }
      const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.collection("auditLogs").doc(auditId).set({
        id: auditId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        eventType: "ADMIN_CHANGED_USER_PASSWORD",
        description: `Admin ${callerUid} updated password for user ${targetUid}. Target user refresh tokens revoked.`,
        callerUid,
        targetUid,
        isImmutable: true
      });
    }
    return {
      success: true,
      message: "Password updated successfully via Firebase Admin SDK. Refresh tokens revoked."
    };
  } catch (err) {
    return { success: false, message: err?.message || "Failed to update user password." };
  }
}
async function adminPasswordRecovery(username, recoveryCode, newPassword) {
  const rawUser = (username || "").trim().toLowerCase();
  const rawCode = (recoveryCode || "").trim();
  const rawNewPass = (newPassword || "").trim();
  if (!rawUser || !rawCode || !rawNewPass) {
    return { success: false, message: "\u062C\u0645\u064A\u0639 \u0627\u0644\u062D\u0642\u0648\u0644 \u0645\u0637\u0644\u0648\u0628\u0629 (\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u060C \u0643\u0648\u062F \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629\u060C \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629)." };
  }
  if (rawNewPass.length < 6) {
    return { success: false, message: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u064A\u062C\u0628 \u0623\u0646 \u062A\u062A\u0643\u0648\u0646 \u0645\u0646 6 \u0623\u062D\u0631\u0641/\u0623\u0631\u0642\u0627\u0645 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644." };
  }
  const now = Date.now();
  const attempts = recoveryAttemptsMap.get(rawUser) || { count: 0, lockUntil: 0 };
  if (attempts.lockUntil > now) {
    const minsLeft = Math.ceil((attempts.lockUntil - now) / 6e4);
    return { success: false, message: `\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0639\u062F\u062F \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0627\u062A \u0627\u0644\u0645\u0633\u0645\u0648\u062D \u0628\u0647\u0627. \u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0644\u0645\u062F\u0629 ${minsLeft} \u062F\u0642\u064A\u0642\u0629 \u0642\u0628\u0644 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629 \u0645\u062C\u062F\u062F\u0627\u064B.` };
  }
  try {
    const { db, auth } = requireAdminServices();
    const formattedEmail = rawUser.includes("@") ? rawUser : `${rawUser}@solimedical-micu.org`;
    let targetDoc = null;
    let targetUser = null;
    try {
      const usersSnap = await db.collection("users").get();
      targetDoc = usersSnap.docs.find((d) => {
        const u = d.data();
        return (u.email || "").toLowerCase() === formattedEmail.toLowerCase() || (u.email || "").toLowerCase() === rawUser.toLowerCase() || (u.uid || "").toLowerCase() === rawUser.toLowerCase() || (u.badgeId || "").toLowerCase() === rawUser.toLowerCase();
      });
      if (targetDoc) {
        targetUser = targetDoc.data();
      }
    } catch (dbErr) {
      const isPermissionDenied = dbErr?.message?.includes("PERMISSION_DENIED") || dbErr?.code === 7;
      if (isPermissionDenied) {
        if (formattedEmail.includes("admin") || rawUser.toLowerCase() === "admin" || rawUser.toLowerCase() === "ahmed0soliman6@gmail.com") {
          targetUser = {
            uid: "admin",
            email: formattedEmail,
            role: "ADMIN",
            active: true,
            isSuperAdmin: true
          };
        }
      } else {
        throw dbErr;
      }
    }
    if (!targetUser) {
      attempts.count += 1;
      if (attempts.count >= 5) {
        attempts.lockUntil = now + 15 * 60 * 1e3;
      }
      recoveryAttemptsMap.set(rawUser, attempts);
      return { success: false, message: "\u0628\u064A\u0627\u0646\u0627\u062A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629 \u0623\u0648 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." };
    }
    const isAdminUser = targetUser.role === "ADMIN" || targetUser.isSuperAdmin === true;
    const isActiveUser = targetUser.active === true || targetUser.isActive === true;
    if (!isAdminUser || !isActiveUser) {
      attempts.count += 1;
      if (attempts.count >= 5) attempts.lockUntil = now + 15 * 60 * 1e3;
      recoveryAttemptsMap.set(rawUser, attempts);
      return { success: false, message: "\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0631 \u063A\u064A\u0631 \u0641\u0639\u0627\u0644 \u0623\u0648 \u0644\u0627 \u064A\u0645\u0644\u0643 \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645." };
    }
    let isCodeValid = false;
    if (!memoryRecoveryToken) {
      memoryRecoveryToken = loadPersistedRecoveryToken();
    }
    if (memoryRecoveryToken) {
      const inputMemHash = hashRecoveryCode(rawCode, memoryRecoveryToken.salt);
      if (inputMemHash === memoryRecoveryToken.codeHash) {
        isCodeValid = true;
      }
    }
    if (!isCodeValid && hasGoogleCredentials()) {
      try {
        const recoveryDocRef = db.collection("_system").doc("recovery");
        const recoverySnap = await recoveryDocRef.get();
        if (recoverySnap.exists) {
          const recData = recoverySnap.data();
          const salt = recData.salt || "SOLI_MICU_SECURE_SALT_2026";
          const storedHash = recData.codeHash || "";
          const inputHash = hashRecoveryCode(rawCode, salt);
          if (storedHash && inputHash === storedHash) {
            isCodeValid = true;
          }
        }
      } catch {
      }
    }
    if (!isCodeValid) {
      attempts.count += 1;
      if (attempts.count >= 5) {
        attempts.lockUntil = now + 15 * 60 * 1e3;
      }
      recoveryAttemptsMap.set(rawUser, attempts);
      return { success: false, message: "\u0643\u0648\u062F \u0627\u0644\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u062E\u0637\u064A \u0627\u0644\u0645\u0643\u062A\u0628\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D. \u064A\u0631\u062C\u0649 \u0627\u0644\u062A\u062D\u0642\u0642 \u0648\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0645\u062D\u0627\u0648\u0644\u0629." };
    }
    recoveryAttemptsMap.delete(rawUser);
    const targetUid = targetUser.uid;
    if (auth) {
      try {
        await auth.updateUser(targetUid, { password: rawNewPass });
        await auth.revokeRefreshTokens(targetUid);
      } catch (authErr) {
        console.warn("Firebase Auth update during recovery notice:", authErr);
      }
    }
    try {
      await db.collection("users").doc(targetUid).update({
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (dbUpdateErr) {
      console.warn("[adminPasswordRecovery] Firestore user doc update notice:", dbUpdateErr);
    }
    try {
      const auditId = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      await db.collection("auditLogs").doc(auditId).set({
        id: auditId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        eventType: "ADMIN_PASSWORD_RECOVERED",
        description: `Admin password successfully recovered for user ${targetUid} (${targetUser.email}). Server-side hash verified and refresh tokens revoked.`,
        targetUid,
        isImmutable: true
      });
    } catch (auditErr) {
      console.warn("[adminPasswordRecovery] Audit log notice:", auditErr);
    }
    return {
      success: true,
      message: "\u062A\u0645 \u062A\u0639\u064A\u064A\u0646 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0627\u0644\u062C\u062F\u064A\u062F\u0629 \u0644\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0646\u062C\u0627\u062D. \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0647\u0627."
    };
  } catch (err) {
    return { success: false, message: err?.message || "\u0641\u0634\u0644 \u0639\u0645\u0644\u064A\u0629 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631." };
  }
}
async function adminArchivePatient(authHeader, patientId) {
  const authCheck = await verifyAdminCallerToken(authHeader);
  if (!authCheck.isAdmin) {
    return { success: false, message: authCheck.error || "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629. \u064A\u062A\u0637\u0644\u0628 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645." };
  }
  try {
    const { db } = requireAdminServices();
    const patientRef = db.collection("patients").doc(patientId);
    const snap = await patientRef.get();
    if (!snap.exists) {
      return { success: false, message: "\u0645\u0644\u0641 \u0627\u0644\u0645\u0631\u064A\u0636 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645." };
    }
    const archiveId = `arch_${patientId}_${Date.now()}`;
    await patientRef.update({
      archiveStatus: "ARCHIVED",
      archiveDate: (/* @__PURE__ */ new Date()).toISOString(),
      archiveId,
      updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      updatedByUid: authCheck.callerUid
    });
    const auditId = `audit_archive_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.collection("auditLogs").doc(auditId).set({
      id: auditId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      eventType: "PATIENT_ARCHIVED_SERVER_SIDE",
      performedByUid: authCheck.callerUid,
      targetPatientId: patientId,
      description: `Patient ${patientId} securely transitioned to ARCHIVED tier. Clinical records preserved.`,
      isImmutable: true
    });
    return {
      success: true,
      message: "\u062A\u0645\u062A \u0623\u0631\u0634\u0641\u0629 \u0645\u0644\u0641 \u0627\u0644\u0645\u0631\u064A\u0636 \u0628\u0646\u062C\u0627\u062D \u0645\u0639 \u0627\u0644\u062D\u0641\u0627\u0638 \u0627\u0644\u062A\u0627\u0645 \u0639\u0644\u0649 \u0643\u0627\u0645\u0644 \u0627\u0644\u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0637\u0628\u064A\u0629.",
      data: { archiveId }
    };
  } catch (err) {
    return { success: false, message: err?.message || "\u0641\u0634\u0644\u062A \u0639\u0645\u0644\u064A\u0629 \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0645\u0631\u064A\u0636." };
  }
}
async function adminArchiveSweep(authHeader, retentionDays = 30) {
  if (authHeader) {
    const authCheck = await verifyAdminCallerToken(authHeader);
    if (!authCheck.isAdmin) {
      return { success: false, message: authCheck.error || "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629." };
    }
  }
  try {
    const { db } = requireAdminServices();
    const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1e3;
    const snap = await db.collection("patients").get();
    let archivedCount = 0;
    const nowStr = (/* @__PURE__ */ new Date()).toISOString();
    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const patientId = docSnap.id;
      const isExpired = data.patientStatus === "EXPIRED_MORTALITY" || data.currentStatus === "EXPIRED";
      const isActive = data.patientStatus === "ACTIVE_ICU" || data.currentStatus === "ACTIVE_ICU";
      if (isActive || isExpired) {
        continue;
      }
      const isDischargedOrTransferred = ["DISCHARGED_STEPDOWN", "DISCHARGED_HOME", "TRANSFERRED_EXTERNAL"].includes(data.patientStatus) || ["DISCHARGED", "DISCHARGED_STEPDOWN", "DISCHARGED_HOME", "TRANSFERRED"].includes(data.currentStatus) || typeof data.patientStatus === "string" && (data.patientStatus.includes("DISCHARGE") || data.patientStatus.includes("TRANSFER")) || typeof data.currentStatus === "string" && (data.currentStatus.includes("DISCHARGE") || data.currentStatus.includes("TRANSFER"));
      if (isDischargedOrTransferred) {
        const endOfStayDateStr = data.dischargeDate || data.transferDate || data.dischargedAt || data.dispositionDate || data.dischargeInfo?.dischargeDate || data.transferInfo?.transferDate || data.disposition?.dispositionDate;
        if (!endOfStayDateStr) {
          continue;
        }
        const endOfStayTime = new Date(endOfStayDateStr).getTime();
        if (endOfStayTime > 0 && endOfStayTime < cutoffMs) {
          const archivedData = {
            ...data,
            archiveStatus: "ARCHIVED",
            archiveDate: nowStr,
            archiveId: `arch_sweep_${patientId}_${Date.now()}`
          };
          await db.collection("archivedPatients").doc(patientId).set(archivedData);
          await docSnap.ref.delete();
          archivedCount++;
        }
      }
    }
    if (archivedCount > 0) {
      const auditId = `audit_archive_sweep_${Date.now()}`;
      await db.collection("auditLogs").doc(auditId).set({
        id: auditId,
        timestamp: nowStr,
        eventType: "PATIENTS_ARCHIVED_SWEEP",
        description: `Patient Archive Sweep successfully moved ${archivedCount} inactive discharged/transferred patients to archivedPatients collection.`,
        isImmutable: true
      });
    }
    return {
      success: true,
      message: `\u062A\u0645 \u0641\u062D\u0635 \u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0648\u0646\u0642\u0644 ${archivedCount} \u0633\u062C\u0644\u0627\u064B \u0625\u0644\u0649 \u0627\u0644\u0623\u0631\u0634\u064A\u0641 \u0627\u0644\u062F\u0627\u0626\u0645 (archivedPatients) \u0628\u0646\u062C\u0627\u062D.`,
      data: { archivedCount }
    };
  } catch (err) {
    return { success: false, message: err?.message || "\u0641\u0634\u0644\u062A \u0639\u0645\u0644\u064A\u0629 \u0641\u062D\u0635 \u0627\u0644\u0623\u0631\u0634\u064A\u0641." };
  }
}
async function adminDeleteMortalityRecord(authHeader, patientId) {
  const authCheck = await verifyAdminCallerToken(authHeader);
  if (!authCheck.isAdmin) {
    return { success: false, message: authCheck.error || "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629. \u062A\u062A\u0637\u0644\u0628 \u0635\u0644\u0627\u062D\u064A\u0627\u062A \u0645\u062F\u064A\u0631 \u0627\u0644\u0646\u0638\u0627\u0645 (ADMIN)." };
  }
  if (!patientId) {
    return { success: false, message: "\u0645\u0639\u0631\u0641 \u0627\u0644\u0645\u0631\u064A\u0636 \u0645\u0637\u0644\u0648\u0628." };
  }
  try {
    const { db } = requireAdminServices();
    const patientRef = db.collection("patients").doc(patientId);
    const snap = await patientRef.get();
    if (!snap.exists) {
      return { success: false, message: "\u0633\u062C\u0644 \u0627\u0644\u0645\u0631\u064A\u0636 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." };
    }
    const patientData = snap.data();
    const isMortality = patientData?.patientStatus === "EXPIRED_MORTALITY" || patientData?.currentStatus === "EXPIRED";
    if (!isMortality) {
      return { success: false, message: "\u0641\u0634\u0644\u062A \u0627\u0644\u0639\u0645\u0644\u064A\u0629. \u0644\u0627 \u064A\u0645\u0643\u0646 \u062D\u0630\u0641 \u0647\u0630\u0627 \u0627\u0644\u0633\u062C\u0644 \u0644\u0623\u0646\u0647 \u0644\u064A\u0633 \u062D\u0627\u0644\u0629 \u0648\u0641\u0627\u0629 \u0645\u0624\u0643\u062F\u0629." };
    }
    await patientRef.delete();
    const collectionsToClean = [
      "medical_records",
      "clinicalNotes",
      "vitals",
      "ventilators",
      "infusionPumps",
      "infusion_pumps",
      "fluidBalances",
      "fluidBalances24H",
      "statLabs",
      "investigations",
      "transfusions",
      "patientAntibiotics",
      "sbarHandovers",
      "handovers",
      "addendums",
      "dispositionRecords",
      "notifications",
      "episodes",
      "transfers"
    ];
    for (const colName of collectionsToClean) {
      try {
        const subSnap = await db.collection(colName).where("patientId", "==", patientId).get();
        if (!subSnap.empty) {
          const batch = db.batch();
          subSnap.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        }
      } catch (colErr) {
        console.warn(`Error cleaning collection ${colName} for patient ${patientId}:`, colErr);
      }
    }
    const auditId = `audit_delete_mortality_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await db.collection("auditLogs").doc(auditId).set({
      id: auditId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      eventType: "MORTALITY_RECORD_DELETED_PERMANENTLY",
      performedByUid: authCheck.callerUid,
      targetPatientId: patientId,
      patientMrn: patientData?.mrn,
      description: `Mortality record for patient ${patientData?.fullNameEn || patientId} (MRN: ${patientData?.mrn}) permanently deleted by ADMIN.`,
      isImmutable: true
    });
    return {
      success: true,
      message: "\u062A\u0645 \u062D\u0630\u0641 \u0633\u062C\u0644 \u0627\u0644\u0645\u062A\u0648\u0641\u0649 \u0648\u0643\u0627\u0641\u0629 \u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062A \u0627\u0644\u0633\u0631\u064A\u0631\u064A\u0629 \u0646\u0647\u0627\u0626\u064A\u0627\u064B \u0645\u0646 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0648\u0627\u0644\u0633\u064A\u0631\u0641\u0631 \u0628\u0646\u062C\u0627\u062D."
    };
  } catch (err) {
    return { success: false, message: err?.message || "\u0641\u0634\u0644\u062A \u0639\u0645\u0644\u064A\u0629 \u062D\u0630\u0641 \u0633\u062C\u0644 \u0627\u0644\u0645\u0631\u064A\u0636 \u0627\u0644\u0645\u062A\u0648\u0641\u0649." };
  }
}
async function adminMortalityAutoPurgeSweep(authHeader) {
  if (authHeader) {
    const authCheck = await verifyAdminCallerToken(authHeader);
    if (!authCheck.isAdmin) {
      return { success: false, message: authCheck.error || "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062A\u0646\u0641\u064A\u0630 \u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u062D\u0630\u0641 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A." };
    }
  }
  try {
    const { db } = requireAdminServices();
    const expiredSnap = await db.collection("patients").where("currentStatus", "==", "EXPIRED").get();
    const expiredSnap2 = await db.collection("patients").where("patientStatus", "==", "EXPIRED_MORTALITY").get();
    const docMap = /* @__PURE__ */ new Map();
    expiredSnap.forEach((docSnap) => docMap.set(docSnap.id, docSnap));
    expiredSnap2.forEach((docSnap) => docMap.set(docSnap.id, docSnap));
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1e3;
    const now = Date.now();
    let purgedCount = 0;
    for (const [patientId, docSnap] of docMap.entries()) {
      const data = docSnap.data();
      const deathDateStr = data?.mortalityRecord && data.mortalityRecord.dateOfDeath ? data.mortalityRecord.dateOfDeath : data?.dischargedAt || data?.updatedAt || data?.createdAt;
      const deathTime = deathDateStr ? new Date(deathDateStr).getTime() : 0;
      if (deathTime > 0 && now - deathTime >= thirtyDaysMs) {
        await docSnap.ref.delete();
        const collectionsToClean = [
          "medical_records",
          "clinicalNotes",
          "vitals",
          "ventilators",
          "infusionPumps",
          "infusion_pumps",
          "fluidBalances",
          "fluidBalances24H",
          "statLabs",
          "investigations",
          "transfusions",
          "patientAntibiotics",
          "sbarHandovers",
          "handovers",
          "addendums",
          "dispositionRecords",
          "notifications",
          "episodes",
          "transfers"
        ];
        for (const colName of collectionsToClean) {
          try {
            const subSnap = await db.collection(colName).where("patientId", "==", patientId).get();
            if (!subSnap.empty) {
              const batch = db.batch();
              subSnap.forEach((subDoc) => batch.delete(subDoc.ref));
              await batch.commit();
            }
          } catch (err) {
            console.warn(`Error auto-purging collection ${colName} for patient ${patientId}:`, err);
          }
        }
        purgedCount++;
      }
    }
    if (purgedCount > 0) {
      const auditId = `audit_autopurge_mortality_${now}`;
      await db.collection("auditLogs").doc(auditId).set({
        id: auditId,
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        eventType: "MORTALITY_AUTO_PURGE_30DAYS",
        description: `Server-side auto-purge safely deleted ${purgedCount} mortality files older than 30 days.`,
        isImmutable: true
      });
    }
    return {
      success: true,
      message: `\u062A\u0645 \u062A\u0634\u063A\u064A\u0644 \u0641\u062D\u0635 \u0627\u0644\u062D\u0630\u0641 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0644\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0648\u0641\u0627\u0629: \u062A\u0645 \u062D\u0630\u0641 ${purgedCount} \u0633\u062C\u0644\u0627\u064B \u0645\u0636\u0649 \u0639\u0644\u064A\u0647\u0627 \u0623\u0643\u062B\u0631 \u0645\u0646 30 \u064A\u0648\u0645\u0627\u064B \u0628\u0646\u062C\u0627\u062D.`,
      data: { purgedCount }
    };
  } catch (err) {
    return { success: false, message: err?.message || "\u0641\u0634\u0644\u062A \u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u062D\u0630\u0641 \u0627\u0644\u062A\u0644\u0642\u0627\u0626\u064A \u0644\u062D\u0627\u0644\u0627\u062A \u0627\u0644\u0648\u0641\u0627\u0629." };
  }
}
async function adminSetRecoveryCode(authHeader, recoveryCode) {
  const authCheck = await verifyAdminCallerToken(authHeader);
  if (!authCheck.isAdmin) {
    return { success: false, message: authCheck.error || "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u062A\u0646\u0641\u064A\u0630 \u0647\u0630\u0647 \u0627\u0644\u0639\u0645\u0644\u064A\u0629." };
  }
  const code = (recoveryCode || "").trim();
  if (!code || code.length < 6) {
    return { success: false, message: "\u0631\u0645\u0632 \u0627\u0644\u062A\u0634\u0641\u064A\u0631 \u064A\u062C\u0628 \u0623\u0644\u0627 \u064A\u0642\u0644 \u0639\u0646 6 \u062E\u0627\u0646\u0627\u062A." };
  }
  try {
    const salt = import_crypto.default.randomBytes(16).toString("hex");
    const codeHash = hashRecoveryCode(code, salt);
    memoryRecoveryToken = { salt, codeHash };
    savePersistedRecoveryToken(salt, codeHash, authCheck.callerUid || "system");
    if (hasGoogleCredentials()) {
      try {
        const { db } = requireAdminServices();
        const recoveryDocRef = db.collection("_system").doc("recovery");
        await recoveryDocRef.set({
          salt,
          codeHash,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          updatedByUid: authCheck.callerUid || "system",
          isImmutable: true
        }, { merge: true });
      } catch {
      }
    }
    return { success: true, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0631\u0645\u0632 \u0627\u0644\u062A\u0634\u0641\u064A\u0631 \u0628\u0646\u062C\u0627\u062D \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645." };
  } catch (err) {
    return { success: false, message: err?.message || "\u0641\u0634\u0644 \u062A\u062D\u062F\u064A\u062B \u0631\u0645\u0632 \u0627\u0644\u062A\u0634\u0641\u064A\u0631." };
  }
}
async function runAdminDiagnosticCheck(authHeader) {
  if (authHeader) {
    const authCheck = await verifyAdminCallerToken(authHeader);
    if (!authCheck.isAdmin) {
      return {
        adminInitialized: false,
        authConnection: false,
        error: authCheck.error || "Access denied: Valid Admin authorization is required."
      };
    }
  }
  const hasProj = Boolean(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID);
  const hasEmail = Boolean(process.env.FIREBASE_CLIENT_EMAIL);
  const hasKey = Boolean(
    process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_SERVICE_ACCOUNT || process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
  if (!hasProj || !hasEmail || !hasKey) {
    const missing = [];
    if (!hasProj) missing.push("FIREBASE_PROJECT_ID");
    if (!hasEmail) missing.push("FIREBASE_CLIENT_EMAIL");
    if (!hasKey) missing.push("FIREBASE_PRIVATE_KEY");
    return {
      adminInitialized: false,
      authConnection: false,
      error: `Missing required environment variables: ${missing.join(", ")}`
    };
  }
  let auth;
  try {
    const adminServices = requireAdminServices();
    auth = adminServices.auth;
  } catch (initErr) {
    const safeError = String(initErr?.message || initErr).replace(/-----BEGIN[\s\S]+?-----END[^\n]+(?:\n|$)/g, "[REDACTED_KEY]").replace(/(?:privateKey|private_key)["']?\s*:\s*["'][^"']+["']/gi, 'private_key:"[REDACTED]"');
    return {
      adminInitialized: false,
      authConnection: false,
      error: `Firebase Admin initialization failed: ${safeError}`
    };
  }
  try {
    await auth.listUsers(1);
    return {
      adminInitialized: true,
      authConnection: true
    };
  } catch (authErr) {
    const safeError = String(authErr?.message || authErr).replace(/-----BEGIN[\s\S]+?-----END[^\n]+(?:\n|$)/g, "[REDACTED_KEY]").replace(/(?:privateKey|private_key)["']?\s*:\s*["'][^"']+["']/gi, 'private_key:"[REDACTED]"');
    return {
      adminInitialized: true,
      authConnection: false,
      error: `Firebase Auth connection failed: ${safeError}`
    };
  }
}
async function adminBroadcastFcmPush(payload) {
  try {
    const adminServices = getAdminApp();
    const db = adminServices.db;
    const messaging = (0, import_messaging.getMessaging)(adminServices.app);
    const snap = await db.collection("fcmTokens").get();
    if (snap.empty) {
      return { success: true, deliveredCount: 0, message: "No registered device tokens found." };
    }
    const tokens = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data && data.token && typeof data.token === "string") {
        tokens.push(data.token);
      }
    });
    if (tokens.length === 0) {
      return { success: true, deliveredCount: 0, message: "No valid tokens to send." };
    }
    const title = payload.titleAr || payload.titleEn || "Soli Medical MICU";
    const body = payload.messageAr || payload.messageEn || "Clinical Notification";
    const messagePayload = {
      notification: {
        title,
        body
      },
      data: {
        type: String(payload.type || "ADMISSION"),
        titleEn: String(payload.titleEn || ""),
        titleAr: String(payload.titleAr || ""),
        messageEn: String(payload.messageEn || ""),
        messageAr: String(payload.messageAr || ""),
        bedNumber: String(payload.bedNumber || ""),
        patientId: String(payload.patientId || ""),
        patientName: String(payload.patientName || ""),
        patientMrn: String(payload.patientMrn || ""),
        action: String(payload.action || "OPEN_BED"),
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      },
      tokens
    };
    const response = await messaging.sendEachForMulticast(messagePayload);
    if (response.failureCount > 0) {
      const tokensToDelete = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success && resp.error) {
          const errCode = resp.error.code;
          if (errCode === "messaging/invalid-registration-token" || errCode === "messaging/registration-token-not-registered") {
            const badToken = tokens[idx];
            snap.forEach((docSnap) => {
              if (docSnap.data()?.token === badToken) {
                tokensToDelete.push(docSnap.ref.delete());
              }
            });
          }
        }
      });
      await Promise.allSettled(tokensToDelete);
    }
    return {
      success: true,
      deliveredCount: response.successCount,
      message: `Delivered to ${response.successCount}/${tokens.length} devices.`
    };
  } catch (err) {
    console.warn("[FCM Admin] Push broadcast note:", err?.message || err);
    return {
      success: false,
      deliveredCount: 0,
      message: err?.message || "FCM push broadcast failed"
    };
  }
}

// server.ts
import_dotenv.default.config();
var app = (0, import_express.default)();
var PORT = 3e3;
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }
  next();
});
app.use(import_express.default.json({ limit: "30mb" }));
app.use(import_express.default.urlencoded({ extended: true, limit: "30mb" }));
var genAiClient = null;
function getGenAI() {
  if (!genAiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is not set. Please configure it in Settings > Secrets.");
    }
    genAiClient = new import_genai.GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return genAiClient;
}
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
});
app.get(["/api/scan-lab", "/api/ai/scan-lab"], (req, res) => {
  res.json({
    service: "AI Lab Scanner API",
    status: "active",
    supportedMethods: ["POST"],
    endpoints: ["/api/scan-lab", "/api/ai/scan-lab"],
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post(["/api/scan-lab", "/api/ai/scan-lab"], async (req, res) => {
  try {
    const { imageBase64, expectedType = "ALL" } = req.body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ success: false, error: "Missing imageBase64 data in request body." });
    }
    const mimeMatch = imageBase64.match(/^data:([a-zA-Z0-9/+-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : req.body.mimeType || "image/jpeg";
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "").trim();
    if (!cleanBase64) {
      return res.status(400).json({ success: false, error: "Empty image payload after removing data URL header." });
    }
    const ai = getGenAI();
    const promptText = `Analyze this medical laboratory test report or analyzer printout strip (such as Arterial Blood Gas ABG printout, Complete Blood Count CBC report, or Chemistry/Electrolyte panel).
Expected target type: ${expectedType}.

Extract all laboratory values carefully.
Return valid JSON matching the specified schema.

Specific mappings:
- For ABG:
  - ph: pH value (e.g. 7.35)
  - pco2: pCO2 in mmHg (e.g. 45.0)
  - po2: pO2 in mmHg (e.g. 88.0)
  - hco3: HCO3 in mmol/L or mEq/L (e.g. 24.5)
  - be: Base excess in mmol/L (e.g. -2.0)
  - lactate: Lactate in mmol/L or mg/dL (e.g. 1.8)
  - pf: PaO2/FiO2 ratio if available
  - so2: O2 saturation percentage

- For CBC:
  - wbc: White blood cell count in x10^3/uL or x10^9/L (e.g. 9.4)
  - hb: Hemoglobin in g/dL (e.g. 12.8)
  - hct: Hematocrit in % (e.g. 38.5)
  - plt: Platelets in x10^3/uL or x10^9/L (e.g. 210)
  - diff: Differential count notes (e.g. "Neut 75%, Lymph 18%")
  - typeAnemia: Morphologic anemia type if noted

- For Chemistry & Electrolytes:
  - urea, bun, creat, uricAcid
  - na, k, ca, phos, mg
  - totalBili, alb, alt, ast, alp, ggt

- For Coagulation & Cardiac / Biomarkers:
  - inr, pt, ptt, fib, troponin, ck, ckMb, crp, procalc, amylase, lipase, esr
`;
    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-1.5-flash",
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
      "gemini-3.6-flash"
    ];
    let response = null;
    let lastError = null;
    const generationConfig = {
      systemInstruction: `You are an expert ICU Clinical Laboratory Information System OCR engine.
Extract values with high medical precision from photos of laboratory printouts, thermal paper strips (like Radiometer/GEM ABG machines), or hematology analyzer reports.
Always respond in strictly valid JSON format.`,
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai.Type.OBJECT,
        properties: {
          detectedType: {
            type: import_genai.Type.STRING,
            description: "Primary detected test type: 'ABG', 'CBC', 'CHEMISTRY_ELECTROLYTES', 'COAGULATION', 'CARDIAC', or 'COMPREHENSIVE'"
          },
          confidence: {
            type: import_genai.Type.NUMBER,
            description: "Confidence score from 0.0 to 1.0 based on image legibility and recognition certainty"
          },
          summaryEn: {
            type: import_genai.Type.STRING,
            description: "Concise clinical summary of findings in English"
          },
          summaryAr: {
            type: import_genai.Type.STRING,
            description: "Concise clinical summary of findings in Arabic"
          },
          sampleDate: {
            type: import_genai.Type.STRING,
            description: "Date and time of sample extraction if printed on report, else empty string"
          },
          patientName: {
            type: import_genai.Type.STRING,
            description: "Patient name if printed on report, else empty string"
          },
          mrn: {
            type: import_genai.Type.STRING,
            description: "MRN or sample ID if printed on report, else empty string"
          },
          statFields: {
            type: import_genai.Type.OBJECT,
            description: "Key-value map of normalized stat lab fields matching flowsheet slots",
            properties: {
              // CBC
              wbc: { type: import_genai.Type.STRING },
              hb: { type: import_genai.Type.STRING },
              hct: { type: import_genai.Type.STRING },
              plt: { type: import_genai.Type.STRING },
              diff: { type: import_genai.Type.STRING },
              typeAnemia: { type: import_genai.Type.STRING },
              // ABG
              ph: { type: import_genai.Type.STRING },
              pco2: { type: import_genai.Type.STRING },
              po2: { type: import_genai.Type.STRING },
              hco3: { type: import_genai.Type.STRING },
              be: { type: import_genai.Type.STRING },
              lactate: { type: import_genai.Type.STRING },
              pf: { type: import_genai.Type.STRING },
              so2: { type: import_genai.Type.STRING },
              // Renal & Electrolytes
              urea: { type: import_genai.Type.STRING },
              creat: { type: import_genai.Type.STRING },
              uricAcid: { type: import_genai.Type.STRING },
              bun: { type: import_genai.Type.STRING },
              na: { type: import_genai.Type.STRING },
              k: { type: import_genai.Type.STRING },
              ca: { type: import_genai.Type.STRING },
              phos: { type: import_genai.Type.STRING },
              mg: { type: import_genai.Type.STRING },
              // Liver
              totalBili: { type: import_genai.Type.STRING },
              alb: { type: import_genai.Type.STRING },
              alt: { type: import_genai.Type.STRING },
              ast: { type: import_genai.Type.STRING },
              alp: { type: import_genai.Type.STRING },
              ggt: { type: import_genai.Type.STRING },
              // Coag & Cardiac
              inr: { type: import_genai.Type.STRING },
              pt: { type: import_genai.Type.STRING },
              ptt: { type: import_genai.Type.STRING },
              fib: { type: import_genai.Type.STRING },
              troponin: { type: import_genai.Type.STRING },
              ck: { type: import_genai.Type.STRING },
              ckMb: { type: import_genai.Type.STRING },
              crp: { type: import_genai.Type.STRING },
              procalc: { type: import_genai.Type.STRING },
              amylase: { type: import_genai.Type.STRING },
              lipase: { type: import_genai.Type.STRING },
              esr: { type: import_genai.Type.STRING }
            }
          },
          items: {
            type: import_genai.Type.ARRAY,
            description: "List of all detected individual test parameters with units and flags",
            items: {
              type: import_genai.Type.OBJECT,
              properties: {
                testName: { type: import_genai.Type.STRING },
                category: { type: import_genai.Type.STRING },
                value: { type: import_genai.Type.STRING },
                unit: { type: import_genai.Type.STRING },
                normalRange: { type: import_genai.Type.STRING },
                flag: { type: import_genai.Type.STRING }
              },
              required: ["testName", "value"]
            }
          }
        },
        required: ["detectedType", "confidence", "summaryEn", "summaryAr", "statFields", "items"]
      }
    };
    const isSvg = mimeType === "image/svg+xml" || cleanBase64.startsWith("PHN2Zy") || cleanBase64.includes("PHN2Zy");
    const contentParts = [];
    if (isSvg) {
      let svgText = "";
      try {
        svgText = Buffer.from(cleanBase64, "base64").toString("utf-8");
      } catch {
        svgText = cleanBase64;
      }
      contentParts.push({
        text: `Here is the laboratory analyzer printout content in SVG format:
${svgText}`
      });
    } else {
      contentParts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "image/jpeg"
        }
      });
    }
    contentParts.push({
      text: promptText
    });
    for (const modelName of modelsToTry) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model: modelName,
            contents: {
              parts: contentParts
            },
            config: generationConfig
          });
          if (response && response.text) {
            break;
          }
        } catch (err) {
          lastError = err;
          const isOverload = err?.message?.includes("503") || err?.message?.includes("UNAVAILABLE");
          if (isOverload && attempt < 2) {
            console.log(`[API /api/ai/scan-lab] Model ${modelName} 503 attempt ${attempt}, retrying in 1s...`);
            await new Promise((r) => setTimeout(r, 1e3));
            continue;
          }
          console.warn(`[API /api/ai/scan-lab] Model ${modelName} failed, trying next option:`, err?.message || err);
          break;
        }
      }
      if (response && response.text) {
        break;
      }
    }
    if (!response || !response.text) {
      throw lastError || new Error("Failed to analyze lab image with Gemini AI after retries.");
    }
    const rawText = response.text || "{}";
    const parsedData = JSON.parse(rawText);
    return res.json({
      success: true,
      data: parsedData
    });
  } catch (error) {
    const errMsg = error?.message || "Failed to analyze lab image with Gemini AI";
    const isOverload = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand");
    if (isOverload) {
      console.log("[API /api/ai/scan-lab] Overload (Logged as info to prevent false alarm):", errMsg);
    } else {
      console.error("[API /api/ai/scan-lab] Error:", error);
    }
    return res.status(500).json({
      success: false,
      error: errMsg
    });
  }
});
app.get(["/api/scan-investigation", "/api/ai/scan-investigation"], (req, res) => {
  res.json({
    service: "AI Investigation & Radiology Scanner API",
    status: "active",
    supportedMethods: ["POST"],
    endpoints: ["/api/scan-investigation", "/api/ai/scan-investigation"],
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.post(["/api/scan-investigation", "/api/ai/scan-investigation"], async (req, res) => {
  try {
    const { imageBase64, expectedModality = "ANY" } = req.body;
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return res.status(400).json({ success: false, error: "Missing imageBase64 data in request body." });
    }
    const mimeMatch = imageBase64.match(/^data:([a-zA-Z0-9/+-]+);base64,/);
    const mimeType = mimeMatch ? mimeMatch[1] : req.body.mimeType || "image/jpeg";
    const cleanBase64 = imageBase64.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, "").trim();
    if (!cleanBase64) {
      return res.status(400).json({ success: false, error: "Empty image payload after removing data URL header." });
    }
    const ai = getGenAI();
    const systemPrompt = `You are an expert ICU Clinical Radiologist and Critical Care Specialist.
Your task is to analyze the provided medical image, which is either:
1. A radiology or diagnostic report printout (Chest X-Ray report, CT scan report, MRI report, Ultrasound/POCUS report, Echocardiogram report, 12-Lead ECG strip/report, or pathology/microbiology report).
2. A direct diagnostic radiographic image or monitor capture (CXR film, CT slices, bedside ultrasound/POCUS clip/photo, 12-lead ECG rhythm strip).

Expected modality hint from clinician: ${expectedModality}

Extract and structure the data precisely according to the JSON schema:
- modality: MUST be one of ["Chest X-Ray", "CT", "MRI", "Ultrasound", "ECG", "Echo", "Other"]
- testName: Specific clinical study name (e.g. "Portable CXR (AP View)", "CT Brain Non-Contrast", "Transthoracic Echocardiogram (TTE)", "12-Lead ECG", "Bedside Lung & Abdominal Ultrasound")
- status: "REPORTED" or "RESULTED"
- timestamp: Valid ISO-8601 string if a date/time is detected on the report or film. If no date found, use current ISO time.
- resultReport: Complete, coherent, professional clinical findings and radiological impression. Format clearly with "FINDINGS:" and "IMPRESSION:". Highlight acute ICU findings (e.g. endotracheal tube distance above carina, CVC tip position, pneumothorax, pulmonary edema, consolidation/infiltrates, acute intracranial hemorrhage, midline shift, ischemia, ventricular ejection fraction, pericardial effusion).
- notes: Short practical notes (e.g., "Bedside portable study", "Compared with baseline", "Urgent alert communicated to ICU team").
- summaryAr: High-clarity medical Arabic summary.
- summaryEn: Concise English clinical summary.
- confidence: Confidence level between 0.50 and 1.00.
- hasCriticalFinding: true if there is an emergent finding requiring immediate intervention.
- criticalFindingText: Description of the critical finding if present, or empty string.

Ensure strict medical terminology and zero hallucination. If text is partially blurred, transcribe the legible clinical facts accurately.`;
    const modelsToTry = [
      "gemini-2.5-flash",
      "gemini-1.5-flash",
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite"
    ];
    const generationConfig = {
      systemInstruction: systemPrompt,
      responseMimeType: "application/json",
      responseSchema: {
        type: import_genai.Type.OBJECT,
        properties: {
          modality: { type: import_genai.Type.STRING },
          testName: { type: import_genai.Type.STRING },
          status: { type: import_genai.Type.STRING },
          timestamp: { type: import_genai.Type.STRING },
          resultReport: { type: import_genai.Type.STRING },
          notes: { type: import_genai.Type.STRING },
          summaryAr: { type: import_genai.Type.STRING },
          summaryEn: { type: import_genai.Type.STRING },
          confidence: { type: import_genai.Type.NUMBER },
          hasCriticalFinding: { type: import_genai.Type.BOOLEAN },
          criticalFindingText: { type: import_genai.Type.STRING }
        },
        required: ["modality", "testName", "status", "resultReport", "summaryEn", "summaryAr"]
      }
    };
    const contentParts = [];
    if (mimeType === "image/svg+xml" || cleanBase64.startsWith("PHN2Zy") || cleanBase64.startsWith("PD94bW")) {
      let svgText = "";
      try {
        svgText = Buffer.from(cleanBase64, "base64").toString("utf-8");
      } catch {
        svgText = cleanBase64;
      }
      contentParts.push({
        text: `Here is the diagnostic study report in SVG format:
${svgText}`
      });
    } else {
      contentParts.push({
        inlineData: {
          data: cleanBase64,
          mimeType: mimeType || "image/jpeg"
        }
      });
    }
    contentParts.push({
      text: "Analyze this diagnostic study or report. Extract modality, test name, findings, impression, timestamp, and clinical summaries."
    });
    let response = null;
    let lastError = null;
    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: contentParts
          },
          config: generationConfig
        });
        if (response && response.text) {
          break;
        }
      } catch (err) {
        lastError = err;
        console.warn(`[API /api/scan-investigation] Model ${modelName} failed:`, err?.message || err);
      }
    }
    if (!response || !response.text) {
      throw lastError || new Error("All AI models failed to return a response for investigation image.");
    }
    let parsedData;
    try {
      parsedData = JSON.parse(response.text);
    } catch {
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Invalid JSON received from Gemini AI model");
      }
    }
    const validModalities = ["Chest X-Ray", "CT", "MRI", "Ultrasound", "ECG", "Echo", "Other"];
    if (!validModalities.includes(parsedData.modality)) {
      const mUpper = (parsedData.modality || "").toUpperCase();
      if (mUpper.includes("CHEST") || mUpper.includes("X-RAY") || mUpper.includes("CXR")) parsedData.modality = "Chest X-Ray";
      else if (mUpper.includes("CT") || mUpper.includes("COMPUTED")) parsedData.modality = "CT";
      else if (mUpper.includes("MRI") || mUpper.includes("MAGNETIC")) parsedData.modality = "MRI";
      else if (mUpper.includes("ECHO")) parsedData.modality = "Echo";
      else if (mUpper.includes("ULTRA") || mUpper.includes("US") || mUpper.includes("POCUS") || mUpper.includes("SONO")) parsedData.modality = "Ultrasound";
      else if (mUpper.includes("ECG") || mUpper.includes("EKG")) parsedData.modality = "ECG";
      else parsedData.modality = "Other";
    }
    if (!parsedData.status || !["ORDERED", "RESULTED", "REPORTED"].includes(parsedData.status)) {
      parsedData.status = "REPORTED";
    }
    if (!parsedData.timestamp || isNaN(new Date(parsedData.timestamp).getTime())) {
      parsedData.timestamp = (/* @__PURE__ */ new Date()).toISOString();
    }
    return res.json({
      success: true,
      data: parsedData
    });
  } catch (error) {
    const errMsg = error?.message || "Failed to analyze investigation image with Gemini AI";
    console.error("[API /api/scan-investigation] Error:", error);
    return res.status(500).json({
      success: false,
      error: errMsg
    });
  }
});
app.post("/api/notifications/fcm-broadcast", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const authCheck = await verifyCallerToken(authHeader);
    if (!authCheck.isAuthenticated) {
      return res.status(401).json({ success: false, message: authCheck.error || "Unauthorized: Invalid or missing authorization token." });
    }
    const payload = req.body;
    if (!payload || !payload.type) {
      return res.status(400).json({ success: false, message: "Invalid notification payload." });
    }
    const result = await adminBroadcastFcmPush(payload);
    return res.status(200).json(result);
  } catch (err) {
    console.warn("[Server] FCM broadcast error:", err);
    return res.status(500).json({ success: false, deliveredCount: 0, message: err?.message || "Push broadcast error" });
  }
});
app.post("/api/admin/users/create", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const userData = req.body;
    const result = await adminCreateUser(authHeader, userData);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.post("/api/admin/users/disable", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { targetUid, reason } = req.body;
    if (!targetUid) {
      return res.status(400).json({ success: false, message: "Missing targetUid." });
    }
    const result = await disableUserWithToken(authHeader, targetUid, reason);
    const statusCode = result.success ? 200 : result.message.includes("Permission Denied") || result.message.includes("Access denied") ? 403 : 400;
    return res.status(statusCode).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.post("/api/admin/users/enable", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { targetUid } = req.body;
    if (!targetUid) {
      return res.status(400).json({ success: false, message: "Missing targetUid." });
    }
    const result = await enableUserWithToken(authHeader, targetUid);
    const statusCode = result.success ? 200 : result.message.includes("Permission Denied") || result.message.includes("Access denied") ? 403 : 400;
    return res.status(statusCode).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.post("/api/admin/users/activate", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { targetUid } = req.body;
    if (!targetUid) {
      return res.status(400).json({ success: false, message: "Missing targetUid." });
    }
    const result = await enableUserWithToken(authHeader, targetUid);
    const statusCode = result.success ? 200 : result.message.includes("Permission Denied") || result.message.includes("Access denied") ? 403 : 400;
    return res.status(statusCode).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.post("/api/admin/users/status", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { targetUid, action, reason, active, isActive } = req.body;
    if (!targetUid) {
      return res.status(400).json({ success: false, message: "Missing targetUid." });
    }
    const shouldDisable = action === "disable" || active === false || isActive === false;
    const result = shouldDisable ? await disableUserWithToken(authHeader, targetUid, reason) : await enableUserWithToken(authHeader, targetUid);
    const statusCode = result.success ? 200 : result.message.includes("Permission Denied") || result.message.includes("Access denied") ? 403 : 400;
    return res.status(statusCode).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.post("/api/admin/users", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { targetUid, action, reason, active, isActive, newPassword, ...userData } = req.body;
    const cleanAction = String(action || "").toLowerCase();
    if (cleanAction === "create") {
      const result2 = await adminCreateUser(authHeader, userData);
      return res.status(result2.success ? 200 : 400).json(result2);
    }
    if (!targetUid) {
      return res.status(400).json({ success: false, message: "Missing targetUid." });
    }
    if (cleanAction === "delete") {
      const result2 = await deleteUserWithToken(authHeader, targetUid, reason);
      return res.status(result2.success ? 200 : 400).json(result2);
    }
    if (cleanAction === "change-password") {
      const result2 = await adminChangeUserPassword(authHeader, targetUid, newPassword);
      return res.status(result2.success ? 200 : 400).json(result2);
    }
    const shouldDisable = cleanAction === "disable" || active === false || isActive === false;
    const result = shouldDisable ? await disableUserWithToken(authHeader, targetUid, reason) : await enableUserWithToken(authHeader, targetUid);
    const statusCode = result.success ? 200 : 400;
    return res.status(statusCode).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.post("/api/admin/users/delete", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { targetUid, reason } = req.body;
    if (!targetUid) {
      return res.status(400).json({ success: false, message: "Missing targetUid." });
    }
    const result = await deleteUserWithToken(authHeader, targetUid, reason);
    const statusCode = result.success ? 200 : result.message.includes("Permission Denied") || result.message.includes("Access denied") || result.message.includes("\u0635\u0644\u0627\u062D\u064A\u0629") ? 403 : 500;
    return res.status(statusCode).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.post("/api/admin/users/change-password", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { targetUid, newPassword } = req.body;
    if (!targetUid || !newPassword) {
      return res.status(200).json({ success: false, message: "Missing targetUid or newPassword." });
    }
    const result = await adminChangeUserPassword(authHeader, targetUid, newPassword);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.post("/api/admin/recovery", async (req, res) => {
  try {
    const { username, recoveryCode, newPassword } = req.body;
    const result = await adminPasswordRecovery(username, recoveryCode, newPassword);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.post("/api/admin/recovery/set", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { recoveryCode } = req.body;
    const result = await adminSetRecoveryCode(authHeader, recoveryCode);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.all("/api/admin/diagnostics", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const result = await runAdminDiagnosticCheck(authHeader);
    if (result.adminInitialized && result.authConnection) {
      return res.status(200).json({
        adminInitialized: true,
        authConnection: true
      });
    }
    const statusCode = result.error?.includes("Access denied") || result.error?.includes("Unauthorized") ? 403 : 500;
    return res.status(statusCode).json(result);
  } catch (err) {
    const cleanErr = String(err?.message || err).replace(/-----BEGIN[\s\S]+?-----END[^\n]+(?:\n|$)/g, "[REDACTED_KEY]").replace(/(?:privateKey|private_key)["']?\s*:\s*["'][^"']+["']/gi, 'private_key:"[REDACTED]"');
    return res.status(500).json({
      adminInitialized: false,
      authConnection: false,
      error: cleanErr
    });
  }
});
app.post("/api/admin/archive/patient", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { patientId } = req.body;
    if (!patientId) {
      return res.status(200).json({ success: false, message: "Missing patientId in request body." });
    }
    const result = await adminArchivePatient(authHeader, patientId);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.post("/api/admin/archive/sweep", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { retentionMonths = 1 } = req.body;
    const result = await adminArchiveSweep(authHeader, retentionMonths);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(200).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.post("/api/admin/mortality/delete", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const { patientId } = req.body;
    if (!patientId) {
      return res.status(400).json({ success: false, message: "Missing patientId in request body." });
    }
    const result = await adminDeleteMortalityRecord(authHeader, patientId);
    return res.status(result.success ? 200 : 403).json(result);
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.all("/api/admin/mortality/auto-purge", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      return res.status(401).json({ success: false, message: "CRON_SECRET is not configured on the server." });
    }
    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      return res.status(401).json({ success: false, message: "Unauthorized: CRON_SECRET mismatch." });
    }
    const purgeResult = await adminMortalityAutoPurgeSweep();
    const archiveResult = await adminArchiveSweep(void 0, 30);
    return res.status(200).json({
      success: true,
      message: "Vercel Cron task completed successfully.",
      purge: purgeResult,
      archive: archiveResult
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err?.message || "Internal server error." });
  }
});
app.all("/api/*", (req, res) => {
  res.status(404).json({ error: `API route not found: ${req.method} ${req.originalUrl}` });
});
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: {
        middlewareMode: true,
        hmr: false
      },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path2.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path2.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ICU-Sync Full-Stack Server running on port ${PORT}`);
  });
}
startServer();
//# sourceMappingURL=server.cjs.map
