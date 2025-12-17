// src/printUtils.js

const PAGE_SIZES = {
  // Landscape Options (Wide)
  "4x6_L": { width: 1800, height: 1200, label: "4x6 Inch (Landscape) - Fits 8" },
  "5x7_L": { width: 2100, height: 1500, label: "5x7 Inch (Landscape)" },
  "A4_L":  { width: 3508, height: 2480, label: "A4 (Landscape)" },
  "Letter_L": { width: 3300, height: 2550, label: "US Letter (Landscape)" },

  // Portrait Options (Tall)
  "4x6_P": { width: 1200, height: 1800, label: "4x6 Inch (Portrait)" },
  "5x7_P": { width: 1500, height: 2100, label: "5x7 Inch (Portrait)" },
  "A4_P":  { width: 2480, height: 3508, label: "A4 (Portrait)" },
  "Letter_P": { width: 2550, height: 3300, label: "US Letter (Portrait)" }
};

// Standard Passport Photo Size (35mm x 45mm @ 300 DPI)
const PHOTO_WIDTH = 413; 
const PHOTO_HEIGHT = 531;

// --- TUNED FOR 8 PHOTOS ---
// To fit 4 photos across (4 * 413 = 1652px) on an 1800px page,
// we only have ~148px left for margins and gaps.
const GAP = 20;     // Tight gap (approx 2mm)
const MARGIN = 25;  // Tight margin (approx 2-3mm)

export const getPageSizes = () => PAGE_SIZES;

/**
 * Calculates max grid columns and rows
 */
function calculateGrid(containerW, containerH, itemW, itemH) {
  const usableW = containerW - (MARGIN * 2);
  const usableH = containerH - (MARGIN * 2);
  
  const cols = Math.floor((usableW + GAP) / (itemW + GAP));
  const rows = Math.floor((usableH + GAP) / (itemH + GAP));
  
  return { cols, rows, count: cols * rows };
}

export const generatePrintSheet = async (singlePhotoUrl, sizeKey = "4x6_L") => {
  const page = PAGE_SIZES[sizeKey] || PAGE_SIZES["4x6_L"];
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = page.width;
  canvas.height = page.height;

  // 1. Fill White Background
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = await createImage(singlePhotoUrl);

  // 2. Determine Best Orientation
  const gridA = calculateGrid(page.width, page.height, PHOTO_WIDTH, PHOTO_HEIGHT); // Upright
  const gridB = calculateGrid(page.width, page.height, PHOTO_HEIGHT, PHOTO_WIDTH); // Rotated

  let bestGrid, itemW, itemH, rotatePhoto;

  // For 4x6 Landscape:
  // Grid A (Upright) fits 4 cols x 2 rows = 8 photos (Perfect)
  // Grid B (Rotated) fits 3 cols x 3 rows = 9 photos (Technically fits more but photos are smaller/tight)
  // We prefer Upright (Grid A) if it gives at least 8, as it is the standard layout.

  if (gridB.count > gridA.count && gridA.count < 8) {
    bestGrid = gridB;
    itemW = PHOTO_HEIGHT; 
    itemH = PHOTO_WIDTH;
    rotatePhoto = true;
  } else {
    bestGrid = gridA;
    itemW = PHOTO_WIDTH;
    itemH = PHOTO_HEIGHT;
    rotatePhoto = false;
  }

  // 3. Center the Grid
  const totalGridW = (bestGrid.cols * itemW) + ((bestGrid.cols - 1) * GAP);
  const totalGridH = (bestGrid.rows * itemH) + ((bestGrid.rows - 1) * GAP);
  
  const startX = (page.width - totalGridW) / 2;
  const startY = (page.height - totalGridH) / 2;

  // 4. Draw
  for (let r = 0; r < bestGrid.rows; r++) {
    for (let c = 0; c < bestGrid.cols; c++) {
        const x = startX + c * (itemW + GAP);
        const y = startY + r * (itemH + GAP);

        ctx.save();
        ctx.translate(x + itemW / 2, y + itemH / 2);

        if (rotatePhoto) ctx.rotate(Math.PI / 2);

        // Draw Image
        ctx.drawImage(img, -PHOTO_WIDTH / 2, -PHOTO_HEIGHT / 2, PHOTO_WIDTH, PHOTO_HEIGHT);

        // Draw Dashed Cut Lines
        ctx.strokeStyle = "#ccc"; 
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 8]); // Finer dash for tighter layout
        ctx.strokeRect(-PHOTO_WIDTH / 2, -PHOTO_HEIGHT / 2, PHOTO_WIDTH, PHOTO_HEIGHT);

        ctx.restore();
    }
  }

  return canvas.toDataURL('image/jpeg', 1.0);
};

const createImage = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.src = url;
  });