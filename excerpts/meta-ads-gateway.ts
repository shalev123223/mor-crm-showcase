// Portfolio excerpt from MOR CRM (supabase/functions/meta-ads/index.ts — gateway header).
// Shown for reading only; not runnable on its own. Comments are in Hebrew, as in the original.

import { createClient } from 'jsr:@supabase/supabase-js@2';

// שער יחיד מול Marketing API של מטא.
// הטוקן חי בטבלת meta_integration ונקרא כאן בלבד (service role) -- הוא לעולם
// לא מגיע לדפדפן. כל יצירה נעשית במצב PAUSED: הפעלה בפועל היא פעולה נפרדת.
//
// אבטחה: אין להסתמך על verify_jwt לבדו. הוא מקבל כל JWT תקף של הפרויקט,
// כולל ה-publishable key שמשוגר לדפדפן וגלוי בקוד המקור של האתר — כלומר
// הוא אינו מבדיל בין משתמשת מחוברת לבין מי שפתח "הצג מקור". אומת בפועל:
// בקשה עם המפתח הפומבי בלבד קיבלה 200 והחזירה את פרטי חשבון המטא.
// כאן נבדקת הזהות במפורש מול auth.getUser, ואחריה פרופיל פעיל —
// אותו מודל הרשאות כמו is_active_user() ששאר המערכת נשענת עליו.

const GRAPH = 'https://graph.facebook.com/v21.0';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// רשימת היתר מפורשת ולא '*': הפונקציה רצה כ-service role ומוציאה כסף,
// ואין סיבה שדף זר יוכל לשלוח אליה בקשה מהדפדפן של מור.
// הראשון ברשימה הוא ברירת המחדל למקור לא מוכר, כלומר הדפדפן יחסום אותו.
const ALLOWED_ORIGINS = [
  'https://<crm-origin>',                     // האתר החי
  'https://<new-crm-origin>',                // אתר ה-VPS החדש
];

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0],
    // חייב לכלול את x-client-info ואת apikey: supabase-js שולח אותן בכל
    // functions.invoke, וה-preflight נכשל בלעדיהן — כלומר כל פעולת מטא
    // מהדפדפן נחסמה. vision-cache-image ו-send-campaign כבר מתירות את
    // ארבעתן; meta-ads הייתה היחידה שלא, ולכן זה נראה כמו "לא קורה כלום".
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// לקוח נפרד לאימות הזהות, מתוך זהירות: getUser מקבל טוקן של משתמשת,
// ואין סיבה שהוא יגע בלקוח שכל שאר השאילתות רצות דרכו כ-service role.
const authClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// פעולות שמשנות מצב חי במטא או מוציאות כסף. pause לא ברשימה בכוונה:
// הוא רק עוצר הוצאה, ואסור שתהיה סיבה למנוע אותו.
const SPENDING_ACTIONS = new Set([
// … (authentication, action routing and Graph API calls omitted)
