// src/printUtils.js

// 1. PAPER SIZES (300 DPI)
const PAGE_SIZES = {
  "4x6_L": { width: 1800, height: 1200, label: "4x6 Inch (Landscape)" },
  "4x6_P": { width: 1200, height: 1800, label: "4x6 Inch (Portrait)" },
  
  "A4_P":  { width: 2480, height: 3508, label: "A4 (Portrait)" },
  "Letter_P": { width: 2550, height: 3300, label: "US Letter (Portrait)" }
};

// 2. PHOTO STANDARDS (300 DPI)
const PHOTO_STANDARDS = {
  "35x45": { width: 413, height: 531, label: "35x45mm (Universal)" }, // ~1.38 x 1.77 inch
  "2x2":   { width: 600, height: 600, label: "2x2 inch (US/India)" }
};

// 3. LAYOUT SETTINGS (Tuned for maximum fit)
// 20px margin = 1.7mm (Very small safety edge)
// 15px gap = 1.2mm (Just enough for a scissor cut)
const GAP = 15;
const MARGIN = 20;

export const getPageSizes = () => PAGE_SIZES;
export const getPhotoStandards = () => PHOTO_STANDARDS;

function calculateGrid(containerW, containerH, itemW, itemH) {
  // Available space for photos
  const usableW = containerW - (MARGIN * 2);
  const usableH = containerH - (MARGIN * 2);
  
  // Math: (Width + Gap) / (Item + Gap)
  const cols = Math.floor((usableW + GAP) / (itemW + GAP));
  const rows = Math.floor((usableH + GAP) / (itemH + GAP));
  
  return { cols, rows, count: cols * rows };
}

export const generatePrintSheet = async (singlePhotoUrl, pageSizeKey = "4x6_L", photoStandardKey = "35x45") => {
  const page = PAGE_SIZES[pageSizeKey];
  const standard = PHOTO_STANDARDS[photoStandardKey];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  canvas.width = page.width;
  canvas.height = page.height;

  // Fill White
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const img = await new Promise((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.src = singlePhotoUrl;
  });

  // --- AUTO-ORIENTATION LOGIC ---
  // We test fitting the photo upright vs rotated 90 degrees.
  
  // Case A: Photo Upright
  const gridA = calculateGrid(page.width, page.height, standard.width, standard.height);
  
  // Case B: Photo Rotated
  const gridB = calculateGrid(page.width, page.height, standard.height, standard.width);

  let bestGrid, itemW, itemH, rotatePhoto;

  // Logic: Pick the one that fits MORE photos. 
  // If equal, prefer Upright (A).
  if (gridB.count > gridA.count) {
    bestGrid = gridB;
    itemW = standard.height; 
    itemH = standard.width; 
    rotatePhoto = true;
  } else {
    bestGrid = gridA;
    itemW = standard.width; 
    itemH = standard.height; 
    rotatePhoto = false;
  }

  // Center the grid on the page
  const totalGridW = (bestGrid.cols * itemW) + ((bestGrid.cols - 1) * GAP);
  const totalGridH = (bestGrid.rows * itemH) + ((bestGrid.rows - 1) * GAP);
  
  const startX = (page.width - totalGridW) / 2;
  const startY = (page.height - totalGridH) / 2;

  // Draw Grid
  for (let r = 0; r < bestGrid.rows; r++) {
    for (let c = 0; c < bestGrid.cols; c++) {
        const x = startX + c * (itemW + GAP);
        const y = startY + r * (itemH + GAP);

        ctx.save();
        ctx.translate(x + itemW / 2, y + itemH / 2);

        if (rotatePhoto) ctx.rotate(Math.PI / 2);

        // Draw Image
        // Use original standard dimensions here because context is rotated if needed
        ctx.drawImage(img, -standard.width / 2, -standard.height / 2, standard.width, standard.height);

        // Cut Lines (Light Grey Dashed)
        ctx.strokeStyle = "#ccc"; 
        ctx.lineWidth = 1;
        ctx.setLineDash([10, 10]); 
        ctx.strokeRect(-standard.width / 2, -standard.height / 2, standard.width, standard.height);

        ctx.restore();
    }
  }

  return canvas.toDataURL('image/jpeg', 1.0);
};
