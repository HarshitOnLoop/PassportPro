const PAGE_SIZES = {
  // Landscape (Wide)
  "4x6_L": { width: 1800, height: 1200, label: "4x6 Inch (Landscape) - Fits 8" },
  "5x7_L": { width: 2100, height: 1500, label: "5x7 Inch (Landscape)" },
  "A4_L":  { width: 3508, height: 2480, label: "A4 (Landscape)" },
  
  // Portrait (Tall)
  "4x6_P": { width: 1200, height: 1800, label: "4x6 Inch (Portrait)" },
  "A4_P":  { width: 2480, height: 3508, label: "A4 (Portrait)" },
};

const PHOTO_WIDTH = 413; // 35mm @ 300dpi
const PHOTO_HEIGHT = 531; // 45mm @ 300dpi

// Tuned for maximum fit (8 photos on 4x6)
const GAP = 20;     
const MARGIN = 25;  

export const getPageSizes = () => PAGE_SIZES;

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

  // Fill White Background
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Load Image
  const img = await new Promise((resolve) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.src = singlePhotoUrl;
  });

  // Determine Orientation
  const gridA = calculateGrid(page.width, page.height, PHOTO_WIDTH, PHOTO_HEIGHT);
  const gridB = calculateGrid(page.width, page.height, PHOTO_HEIGHT, PHOTO_WIDTH);

  let bestGrid, itemW, itemH, rotatePhoto;

  if (gridB.count > gridA.count && gridA.count < 8) {
    bestGrid = gridB;
    itemW = PHOTO_HEIGHT; itemH = PHOTO_WIDTH; rotatePhoto = true;
  } else {
    bestGrid = gridA;
    itemW = PHOTO_WIDTH; itemH = PHOTO_HEIGHT; rotatePhoto = false;
  }

  // Center Grid
  const totalGridW = (bestGrid.cols * itemW) + ((bestGrid.cols - 1) * GAP);
  const totalGridH = (bestGrid.rows * itemH) + ((bestGrid.rows - 1) * GAP);
  const startX = (page.width - totalGridW) / 2;
  const startY = (page.height - totalGridH) / 2;

  // Draw Photos
  for (let r = 0; r < bestGrid.rows; r++) {
    for (let c = 0; c < bestGrid.cols; c++) {
        const x = startX + c * (itemW + GAP);
        const y = startY + r * (itemH + GAP);

        ctx.save();
        ctx.translate(x + itemW / 2, y + itemH / 2);
        if (rotatePhoto) ctx.rotate(Math.PI / 2);
        
        ctx.drawImage(img, -PHOTO_WIDTH / 2, -PHOTO_HEIGHT / 2, PHOTO_WIDTH, PHOTO_HEIGHT);
        
        // Dashed Cut Lines
        ctx.strokeStyle = "#bbb"; 
        ctx.lineWidth = 1;
        ctx.setLineDash([8, 8]); 
        ctx.strokeRect(-PHOTO_WIDTH / 2, -PHOTO_HEIGHT / 2, PHOTO_WIDTH, PHOTO_HEIGHT);
        
        ctx.restore();
    }
  }

  return canvas.toDataURL('image/jpeg', 1.0);
};
