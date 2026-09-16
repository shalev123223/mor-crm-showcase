// Portfolio excerpt from MOR CRM (index.html — Vision Box page geometry and PDF manifest).
// Shown for reading only; not runnable on its own. Comments are in Hebrew, as in the original.


/* ── גאומטריית ה-PDF ──
   הגדרה אחת ויחידה. אותם מספרים מזינים גם את התצוגה המקדימה בדפדפן וגם את סקריפט
   ה-Python שמייצר את ה-PDF (הם נשלחים אליו ב-manifest), כדי שלא ייווצרו שתי מערכות
   פריסה שנפרדות זו מזו עם הזמן.
   כל המידות במילימטרים. השוליים הלבנים סביב כל תמונה הם שטח הגזירה. */
const VISION_PDF_PAGE = { w: 297, h: 210 };   // A4 לרוחב
const VISION_PDF_MARGIN = 10;                 // שוליי העמוד
const VISION_PDF_GUTTER = 8;                  // בין תא לתא
const VISION_PDF_CUT_MARGIN = 6;              // הלבן סביב כל תמונה = איפה שגוזרים
const VISION_DEFAULT_PER_PAGE = 4;

/* לכל מספר תמונות בעמוד, הרשת שנותנת את הפרופורציה הקרובה ביותר לתמונת סטוק
   טיפוסית (~3:2), עם קנס על תאים ריקים. חושב מראש כדי שהתוצאה תהיה קבועה וקריאה,
   ולא תלויה בהיוריסטיקה שרצה בזמן אמת. מספרים שאינם ריבוע מלא משאירים תאים ריקים
   בסוף העמוד — למשל 3 תמונות ברשת 2×2. */
const VISION_PAGE_GRIDS = {
  1:[1,1], 2:[2,1], 3:[2,2], 4:[2,2], 5:[3,2], 6:[3,2], 7:[3,3], 8:[3,3],
  9:[3,3], 10:[4,3], 11:[4,3], 12:[4,3], 13:[4,4], 14:[4,4], 15:[4,4], 16:[4,4]
};
const VISION_PER_PAGE_CHOICES = Object.keys(VISION_PAGE_GRIDS).map(Number);
const VISION_MAX_PER_PAGE = Math.max(...VISION_PER_PAGE_CHOICES);

/* מלבני התמונות של עמוד עם count תמונות, כשברים מנורמלים (0..1) של גודל העמוד. */
function visionPdfSlots(count){
  const n = Math.max(1, Math.min(VISION_MAX_PER_PAGE, count|0));
  const [cols, rows] = VISION_PAGE_GRIDS[n] || VISION_PAGE_GRIDS[VISION_DEFAULT_PER_PAGE];
  const P = VISION_PDF_PAGE;
  const cellW = (P.w - 2*VISION_PDF_MARGIN - (cols-1)*VISION_PDF_GUTTER) / cols;
  const cellH = (P.h - 2*VISION_PDF_MARGIN - (rows-1)*VISION_PDF_GUTTER) / rows;
  // בתאים קטנים שוליים קבועים של 6 מ"מ היו בולעים את התמונה, ולכן הם מוגבלים ל-12% מהתא
  const cut = Math.min(VISION_PDF_CUT_MARGIN, 0.12 * Math.min(cellW, cellH));
  const imgW = cellW - 2*cut, imgH = cellH - 2*cut;
  const slots = [];
  for(let r=0; r<rows; r++){
    for(let c=0; c<cols; c++){
      if(slots.length >= n) break;
      slots.push({
        x: (VISION_PDF_MARGIN + c*(cellW+VISION_PDF_GUTTER) + cut) / P.w,
        y: (VISION_PDF_MARGIN + r*(cellH+VISION_PDF_GUTTER) + cut) / P.h,
        w: imgW / P.w,
        h: imgH / P.h
      });
    }
  }
  return slots;
}

/* תוכנית העמודים: מערך של מספרי תמונות, אחד לכל עמוד.
   נגזר מ-vision_boxes.page_layout = { perPage, pages:{ "<index>": count } }.
   העמודים מתמלאים ברצף, ולכן שינוי בעמוד אחד מזיז את מה שאחריו -- וזה בסדר,
   כי הוחלט במפורש שסדר התמונות לא נושא משמעות.
   הפונקציות מקבלות את הפריסה כפרמטר כדי שגם רשימת הלקוחות תוכל לחשב מספר עמודים
   בלי "תיבה נוכחית". */
function visionLayoutOf(raw){
  raw = raw || {};
  return {
    perPage: VISION_PAGE_GRIDS[raw.perPage] ? raw.perPage : VISION_DEFAULT_PER_PAGE,
    pages: raw.pages && typeof raw.pages === 'object' ? raw.pages : {}
  };
}

function visionPagePlanFor(total, rawLayout){
  const { perPage, pages } = visionLayoutOf(rawLayout);
  const plan = [];
  let placed = 0;
  while(placed < total && plan.length < 400){
    const want = VISION_PAGE_GRIDS[pages[plan.length]] ? pages[plan.length] : perPage;
    const n = Math.min(want, total - placed);
    plan.push(n);
    placed += n;
  }
  return plan;
}

function visionPageLayout(){
  return visionLayoutOf(currentVisionBox && currentVisionBox.page_layout);
}

function visionPagePlan(){
  return visionPagePlanFor(visionSelectedCandidates().length, currentVisionBox && currentVisionBox.page_layout);
}

// … (layout state and preview rendering omitted)

/* בונה את המניפסט מאותה visionPdfSlots() שציירה את התצוגה המקדימה, ושולח אותו.
   זו הסיבה שה-PDF לא יכול לסטות ממה שמור אישרה: אין מימוש שני של חשבון הפריסה --
   הפייתון בצד השני רק מצייר את המלבנים שהוא מקבל. */
function buildVisionPdfManifest(){
  const picked = visionSelectedCandidates();
  const plan = visionPagePlan();
  const pages = [];
  let at = 0;
  plan.forEach(n => {
    const slots = visionPdfSlots(n);
    pages.push({
      slots: picked.slice(at, at+n).map((c, i) => ({
        candidate_id: c.id, x: slots[i].x, y: slots[i].y, w: slots[i].w, h: slots[i].h
      }))
    });
    at += n;
  });
  return { page: VISION_PDF_PAGE, pages };
}
