import React, { useState, useEffect } from 'react';
import { removeBackground } from "@imgly/background-removal";
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './cropUtils';
// Import the new getter
import { generatePrintSheet, getPageSizes, getPhotoStandards } from './printUtils';

const BackgroundRemover = () => {
  // ... (States remain same) ...
  const [imageSrc, setImageSrc] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [printSheet, setPrintSheet] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  const [step, setStep] = useState(1); 
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [bgColor, setBgColor] = useState('#ffffff');
  
  // NEW: Standard Selection
  const [pageSize, setPageSize] = useState('4x6_L');
  const [photoStandard, setPhotoStandard] = useState('35x45'); // Default to Universal

  const PAGE_OPTIONS = getPageSizes();
  const STANDARD_OPTIONS = getPhotoStandards();

  // ... (Keep resizeImage, handleImageUpload, onCropComplete, flattenImage exactly as before) ...
  
  // 1. Resizer Helper
  const resizeImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 1000;
          const scale = maxWidth / img.width;
          if (scale < 1) {
             const canvas = document.createElement('canvas');
             canvas.width = maxWidth;
             canvas.height = img.height * scale;
             const ctx = canvas.getContext('2d');
             ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
             canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
          } else {
             resolve(file);
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // 2. Main Upload Handler
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const rawUrl = URL.createObjectURL(file);
    setImageSrc(rawUrl);
    setStep(1); 
    setProcessedImage(null); setPrintSheet(null);
    setRotation(0); setZoom(1); setBgColor('#ffffff');

    setIsLoading(true);
    setLoadingMsg("Processing...");

    try {
      const resizedBlob = await resizeImage(file);
      const blob = await removeBackground(resizedBlob, {
         progress: (push_step, total_step, total_progress) => {
            setLoadingMsg(`AI Processing... ${Math.round(total_progress * 100)}%`);
         }
      });
      const processedUrl = URL.createObjectURL(blob);
      setProcessedImage(processedUrl);
      setStep(2);
    } catch (e) {
      console.error(e);
      alert("Error processing image.");
    } finally {
      setIsLoading(false);
    }
  };

  const onCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const flattenImage = (imgUrl, color) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = imgUrl;
        img.crossOrigin = "anonymous";
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 1.0)); // 1.0 Quality
        };
    });
  };

  // 3. Generate Print Sheet
  const goToPrintPage = async () => {
    setIsLoading(true);
    setLoadingMsg("Generating Sheet...");
    try {
        const transparentCrop = await getCroppedImg(processedImage, croppedAreaPixels, rotation);
        const singlePhoto = await flattenImage(transparentCrop, bgColor);
        
        // Pass both Page Size AND Photo Standard
        const sheet = await generatePrintSheet(singlePhoto, pageSize, photoStandard);
        
        setPrintSheet(sheet);
        setStep(3);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  // 4. Watch for Dropdown Changes
  useEffect(() => {
    if (step === 3 && printSheet) { 
        // Auto-refresh when user changes options in the print screen
        goToPrintPage();
    }
  }, [pageSize, photoStandard]); // Triggers when either dropdown changes

  // --- RENDER ---
  return (
    <div style={styles.pageWrapper}>
      {/* ... Header and Styles ... */}
      <style>{`body { margin: 0; padding: 0; } * { box-sizing: border-box; }`}</style>

      <main style={styles.main}>
        <div style={styles.card}>
            {isLoading && (
              <div style={styles.loaderOverlay}>
                 <div style={styles.spinner}></div>
                 <p style={styles.loaderText}>{loadingMsg}</p>
              </div>
            )}

            {/* Steps 1 & 2 omitted for brevity (Keep them exactly as they were) */}
            {step === 1 && (
                <div style={styles.stepContainer}>
                    <h3>Upload Photo</h3>
                    <input type="file" onChange={handleImageUpload} />
                </div>
            )}

            {step === 2 && processedImage && (
                <div style={styles.editorContainer}>
                    <div style={{height: 400, position:'relative', width: '100%', background:'#333'}}>
                       <Cropper image={processedImage} crop={crop} zoom={zoom} rotation={rotation} aspect={3.5/4.5} onCropChange={setCrop} onCropComplete={onCropComplete} onZoomChange={setZoom} onRotationChange={setRotation} style={{containerStyle: {backgroundColor: bgColor}}}/>
                    </div>
                    {/* Controls here... */}
                    <div style={{marginTop: 20}}>
                        <div style={{display:'flex', gap: 10, marginBottom: 20}}>
                            <label>Background:</label>
                            <input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)} />
                        </div>
                        <button onClick={goToPrintPage} style={styles.btnPrimaryFull}>Next: Print &rarr;</button>
                    </div>
                </div>
            )}

            {/* STEP 3: PRINT SETTINGS */}
            {step === 3 && printSheet && (
               <div style={styles.printContainer}>
                  <h3 style={styles.panelTitle}>Print Settings</h3>
                  
                  <div style={styles.controlsRow}>
                      {/* Dropdown 1: Paper Size */}
                      <div style={styles.controlItem}>
                         <label style={styles.label}>Paper Size</label>
                         <select value={pageSize} onChange={e => setPageSize(e.target.value)} style={styles.select}>
                            {Object.keys(PAGE_OPTIONS).map(k => <option key={k} value={k}>{PAGE_OPTIONS[k].label}</option>)}
                         </select>
                      </div>

                      {/* Dropdown 2: Photo Standard */}
                      <div style={styles.controlItem}>
                         <label style={styles.label}>Photo Size</label>
                         <select value={photoStandard} onChange={e => setPhotoStandard(e.target.value)} style={styles.select}>
                            {Object.keys(STANDARD_OPTIONS).map(k => <option key={k} value={k}>{STANDARD_OPTIONS[k].label}</option>)}
                         </select>
                      </div>
                  </div>

                  <div style={styles.sheetPreview}>
                     <img src={printSheet} alt="Sheet" style={styles.sheetImg} />
                  </div>

                  <a href={printSheet} download={`passport-print-${pageSize}.jpg`}>
                      <button style={styles.btnPrimary}>Download High-Res Sheet</button>
                  </a>
                  
                  <button onClick={()=>setStep(2)} style={styles.linkButton}>Back to Edit</button>
               </div>
            )}
        </div>
      </main>
    </div>
  );
};

// ... (Use same styles as previous answer) ...
const styles = {
    pageWrapper: { fontFamily: "sans-serif", background: '#f4f7f6', minHeight: '100vh', padding: 20 },
    card: { background: '#fff', maxWidth: 900, margin: '0 auto', padding: 30, borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' },
    printContainer: { textAlign: 'center' },
    controlsRow: { display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 20 },
    controlItem: { textAlign: 'left' },
    label: { display: 'block', fontSize: 13, fontWeight: 'bold', marginBottom: 5 },
    select: { padding: 10, fontSize: 14, borderRadius: 6, border: '1px solid #ccc' },
    sheetPreview: { background: '#ddd', padding: 20, borderRadius: 8, marginBottom: 20, overflow: 'auto' },
    sheetImg: { maxHeight: 400, boxShadow: '0 4px 10px rgba(0,0,0,0.1)' },
    btnPrimary: { background: '#4facfe', color: '#fff', border: 'none', padding: '12px 25px', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' },
    btnPrimaryFull: { background: '#4facfe', color: '#fff', border: 'none', padding: '12px', width:'100%', borderRadius: 6, cursor: 'pointer', fontWeight: 'bold' },
    linkButton: { background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer', display: 'block', margin: '20px auto' },
    // ... add stepContainer, editorContainer, etc from previous answer
    loaderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.9)', zIndex: 99, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
    spinner: { width: 40, height: 40, border: '4px solid #eee', borderTop: '4px solid #4facfe', borderRadius: '50%', animation: 'spin 1s linear infinite' }
};

export default BackgroundRemover;
