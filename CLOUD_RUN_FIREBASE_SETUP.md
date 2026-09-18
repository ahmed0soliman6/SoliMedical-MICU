# ICU-Sync: Cloud Run وFirebase Admin SDK

هذا الملف يعالج فشل مزامنة `/patients` و`/beds` وفشل إدارة الحسابات. التطبيق يتطلب أن يملك حساب خدمة Cloud Run صلاحيات **Firebase Authentication Admin** و**Firestore**، وأن يكتب ملف `users/{uid}` قبل السماح للمستخدم بالوصول السريري.

## 1. حساب الخدمة

استخدم حساب خدمة مخصصًا للخدمة، مثل:

```bash
PROJECT_ID=solimedical-micu
REGION=us-central1
SERVICE=icu-sync
RUNTIME_SA=icu-sync-runtime@${PROJECT_ID}.iam.gserviceaccount.com

gcloud iam service-accounts create icu-sync-runtime \
  --project "$PROJECT_ID" \
  --display-name "ICU-Sync Cloud Run runtime"
```

امنحه أقل الصلاحيات المطلوبة:

```bash
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role roles/firebaseauth.admin

gcloud projects add-iam-policy-binding "$PROJECT_ID" \
  --member "serviceAccount:${RUNTIME_SA}" \
  --role roles/datastore.user
```

`roles/datastore.user` هو صلاحية Firestore للقراءة والكتابة. لا تضع ملف service-account JSON أو مفتاحًا خاصًا داخل المستودع؛ Cloud Run يستخدم Application Default Credentials تلقائيًا.

## 2. نشر Cloud Run

من جذر المستودع:

```bash
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --region "$REGION" \
  --source . \
  --service-account "$RUNTIME_SA" \
  --set-env-vars NODE_ENV=production,VITE_FIREBASE_PROJECT_ID="$PROJECT_ID" \
  --allow-unauthenticated
```

لا تجعل `FIREBASE_ADMIN_PRIVATE_KEY` أو أي مفتاح خدمة متغيرًا مطلوبًا؛ `src/server/adminOperations.ts` يستخدم `applicationDefault()` وهو النمط الصحيح على Cloud Run.

## 3. تحقق بعد النشر

```bash
SERVICE_URL=$(gcloud run services describe "$SERVICE" --project "$PROJECT_ID" --region "$REGION" --format='value(status.url)')
curl -fsS "$SERVICE_URL/api/health"
gcloud logging read \
  "resource.type=cloud_run_revision AND resource.labels.service_name=${SERVICE}" \
  --project "$PROJECT_ID" --limit 50
```

نفّذ بعد ذلك اختبارًا بحساب إداري تجريبي: أنشئ موظفًا، وتأكد من وجود **Auth user** و`users/{uid}`، ثم أنشئ مريضًا وسريرًا. يجب أن تكون كل عملية منفردة مؤكدة من Firestore؛ لا تعتمد على Dexie أو `localStorage` كدليل نجاح.

## 4. سلوك الفشل الآمن

- إذا فشل Admin SDK أو IAM، يعيد API `success: false` ولا ينشئ مستخدمًا محليًا وهميًا.
- إذا نجح إنشاء Auth وفشل إنشاء `users/{uid}`، يحاول الخادم حذف مستخدم Auth اليتيم ويعيد الخطأ.
- التحقق من المدير يرفض JWT غير القابل للتحقق، ويرفض الحساب الذي لا يملك ملفًا نشطًا في `users/{uid}`.
- قواعد Firestore تبقي `/patients` و`/beds` محمية خلف `isActiveUser()`؛ إصلاح IAM وإنشاء ملف المستخدم هما الشرط الصحيح، وليس فتح القواعد للعامة.
