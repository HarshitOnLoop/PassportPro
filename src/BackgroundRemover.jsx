import React, { useState, useEffect } from 'react';
import { removeBackground } from "@imgly/background-removal";
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './cropUtils';
import { generatePrintSheet, getPageSizes } from './printUtils';

const BackgroundRemover = () => {
  // --- States ---
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
  const [pageSize, setPageSize] = useState('4x6_L');
  const PAGE_OPTIONS = getPageSizes();

  // --- 1. ROBUST RESIZER (Speed Hack) ---
  const resizeImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 1000; // 1000px is fast and high quality
          const scale = maxWidth / img.width;
          
          if (scale < 1) {
             const canvas = document.createElement('canvas');
             canvas.width = maxWidth;
             canvas.height = img.height * scale;
             const ctx = canvas.getContext('2d');
             ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
             
             canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.9);
          } else {
             resolve(file); // Already small enough
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  // --- 2. MAIN LOGIC ---
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Show Preview Immediately
    const rawUrl = URL.createObjectURL(file);
    setImageSrc(rawUrl);
    setStep(1); 
    setProcessedImage(null); 
    setPrintSheet(null);
    setRotation(0); setZoom(1); setBgColor('#ffffff');

    setIsLoading(true);
    setLoadingMsg("Optimizing & Removing Background...");

    try {
      // A. Resize first (Make it fast)
      const resizedBlob = await resizeImage(file);

      // B. Remove Background (STABLE CONFIG)
      // We removed the custom 'publicPath' so it uses the default stable CDN.
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
      alert("Error: Could not remove background. Please check internet connection.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- 3. PRINTING LOGIC ---
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
            resolve(canvas.toDataURL('image/jpeg', 0.95));
        };
    });
  };

  const goToPrintPage = async () => {
    setIsLoading(true);
    setLoadingMsg("Generating Print Sheet...");
    try {
        const transparentCrop = await getCroppedImg(processedImage, croppedAreaPixels, rotation);
        const singlePhoto = await flattenImage(transparentCrop, bgColor);
        const sheet = await generatePrintSheet(singlePhoto, pageSize);
        setPrintSheet(sheet);
        setStep(3);
    } catch (e) {
        console.error(e);
        alert("Error creating print layout");
    } finally {
        setIsLoading(false);
    }
  };

  // Re-generate sheet when page size changes
  useEffect(() => {
    if (step === 3 && printSheet) { 
        // Note: For simplicity, user must click 'Next' again to see changes if they go back
        // Or we could store 'finalSingle' in state to re-run this automatically.
    }
  }, [pageSize]);

  // --- 4. RENDER UI ---
  return (
    <div style={styles.pageWrapper}>
      <style>{`body { margin: 0; padding: 0; } * { box-sizing: border-box; } @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <header style={styles.header}>
        <div style={styles.container}>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
             <div style={{width:'32px', height:'32px', background:'#4facfe', borderRadius:'6px'}}></div>
             <h1 style={styles.logoText}>Passport<span style={{color:'#4facfe'}}>Pro</span></h1>
          </div>
        </div>
      </header>

      {/* Main */}
      <main style={styles.main}>
        <div style={styles.card}>
            
            {isLoading && (
              <div style={styles.loaderOverlay}>
                 <div style={styles.spinner}></div>
                 <p style={styles.loaderText}>{loadingMsg}</p>
              </div>
            )}

            {/* Step Indicators */}
            <div style={styles.progressBar}>
               <span style={{...styles.stepText, color: step >= 1 ? '#4facfe' : '#ccc'}}>1. Upload</span>
               <span style={{margin:'0 10px', color:'#eee'}}>&mdash;</span>
               <span style={{...styles.stepText, color: step >= 2 ? '#4facfe' : '#ccc'}}>2. Edit</span>
               <span style={{margin:'0 10px', color:'#eee'}}>&mdash;</span>
               <span style={{...styles.stepText, color: step >= 3 ? '#4facfe' : '#ccc'}}>3. Print</span>
            </div>

            {/* STEP 1: UPLOAD */}
            {step === 1 && (
              <div style={styles.stepContainer}>
                 <h2 style={styles.heading}>Passport Photo Maker</h2>
                 <p style={styles.subHeading}>Upload a photo to automatically remove background.</p>
                 
                 {!imageSrc ? (
                   <div style={styles.uploadArea}>
                      <input type="file" id="fileInput" onChange={handleImageUpload} accept="image/*" style={{display:'none'}} />
                      <label htmlFor="fileInput" style={styles.uploadButton}>
                         Select Photo
                      </label>
                   </div>
                 ) : (
                   <div style={styles.previewArea}>
                      <img src={imageSrc} style={styles.rawImage} alt="Preview" />
                      <button onClick={handleImageUpload} style={styles.btnSecondary}>Retry</button>
                   </div>
                 )}
              </div>
            )}

            {/* STEP 2: EDITOR */}
            {step === 2 && processedImage && (
              <div style={styles.editorContainer}>
                  <div style={styles.editorLeft}>
                     <div style={styles.cropWrapper}>
                        <Cropper 
                          image={processedImage} 
                          crop={crop} zoom={zoom} rotation={rotation} 
                          aspect={3.5/4.5} 
                          onCropChange={setCrop} onCropComplete={onCropComplete} 
                          onZoomChange={setZoom} onRotationChange={setRotation}
                          style={{ containerStyle: { backgroundColor: bgColor } }}
                        />
                     </div>
                  </div>
                  <div style={styles.editorRight}>
                     <h3 style={styles.panelTitle}>Adjust Photo</h3>
                     
                     <div style={styles.controlGroup}>
                        <label style={styles.label}>Background Color</label>
                        <div style={styles.colorGrid}>
                           {['#ffffff', '#4a90e2', '#d0021b', '#d3d3d3', '#8b572a'].map(c => (
                              <div key={c} onClick={()=>setBgColor(c)} style={{...styles.colorDot, background:c, border: bgColor===c?'2px solid #333':'1px solid #ddd'}}></div>
                           ))}
                           <input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)} style={styles.colorInput}/>
                        </div>
                     </div>

                     <div style={styles.controlGroup}>
                        <label style={styles.label}>Zoom</label>
                        <input type="range" min="1" max="3" step="0.1" value={zoom} onChange={e=>setZoom(Number(e.target.value))} style={styles.slider} />
                     </div>

                     <div style={styles.controlGroup}>
                        <label style={styles.label}>Rotate</label>
                        <input type="range" min="-10" max="10" step="1" value={rotation} onChange={e=>setRotation(Number(e.target.value))} style={styles.slider} />
                     </div>

                     <button onClick={goToPrintPage} style={styles.btnPrimaryFull}>Next: Print Layout &rarr;</button>
                  </div>
              </div>
            )}

            {/* STEP 3: PRINT */}
            {step === 3 && printSheet && (
               <div style={styles.printContainer}>
                  <h3 style={styles.panelTitle}>Print Ready Sheet</h3>
                  
                  <div style={{marginBottom:'20px'}}>
                     <label style={{marginRight:'10px', fontWeight:'600'}}>Paper Size:</label>
                     <select value={pageSize} onChange={e => { setPageSize(e.target.value); goToPrintPage(); }} style={styles.select}>
                        {Object.keys(PAGE_OPTIONS).map(k => <option key={k} value={k}>{PAGE_OPTIONS[k].label}</option>)}
                     </select>
                  </div>

                  <div style={styles.sheetPreview}>
                     <img src={printSheet} alt="Sheet" style={styles.sheetImg} />
                  </div>

                  <div style={styles.downloadRow}>
                     <a href={printSheet} download={`passport-sheet-${pageSize}.jpg`}><button style={styles.btnPrimary}>Download Printable Sheet</button></a>
                  </div>
                  
                  <button onClick={()=>setStep(2)} style={styles.linkButton}>&larr; Back to Editor</button>
               </div>
            )}
        </div>
      </main>

      {/* Footer */}
      <footer style={styles.footer}>
         <p>&copy; 2024 PassportPro. Privacy Friendly - Photos process locally.</p>
      </footer>
    </div>
  );
};

const styles = {
  pageWrapper: { fontFamily: "'Segoe UI', sans-serif", backgroundColor: '#f4f7f6', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: { backgroundColor: '#fff', height: '70px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee' },
  container: { maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '0 20px' },
  logoText: { fontSize: '20px', fontWeight: 'bold', color: '#333' },
  main: { flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 20px' },
  card: { backgroundColor: '#fff', width: '100%', maxWidth: '1000px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', padding: '40px', position: 'relative' },
  progressBar: { textAlign:'center', marginBottom:'30px' },
  stepText: { fontSize:'14px', fontWeight:'600' },
  
  stepContainer: { textAlign: 'center', padding: '40px 0' },
  heading: { fontSize: '28px', color: '#333', marginBottom: '10px' },
  subHeading: { fontSize: '16px', color: '#666', marginBottom: '30px' },
  uploadArea: { border: '2px dashed #4facfe', borderRadius: '12px', padding: '60px', backgroundColor: '#f0f9ff', cursor: 'pointer' },
  uploadButton: { backgroundColor: '#4facfe', color: '#fff', padding: '12px 30px', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' },
  previewArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
  rawImage: { maxHeight: '300px', borderRadius: '10px' },

  editorContainer: { display: 'flex', flexWrap: 'wrap', gap: '40px' },
  editorLeft: { flex: 2, minWidth: '300px', height: '500px', position: 'relative', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#eee' },
  editorRight: { flex: 1, minWidth: '250px' },
  panelTitle: { fontSize: '18px', marginBottom: '20px', color: '#333' },
  controlGroup: { marginBottom: '25px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#555' },
  slider: { width: '100%', cursor: 'pointer', accentColor: '#4facfe' },
  colorGrid: { display: 'flex', gap: '10px' },
  colorDot: { width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' },
  colorInput: { width: '30px', height: '30px', border: 'none', background: 'none' },

  printContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  sheetPreview: { backgroundColor: '#ddd', padding: '20px', borderRadius: '8px', marginBottom: '20px', overflow: 'auto', maxWidth: '100%' },
  sheetImg: { maxHeight: '400px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' },
  select: { padding: '8px', borderRadius: '6px', fontSize: '14px' },
  
  btnPrimary: { backgroundColor: '#4facfe', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  btnPrimaryFull: { backgroundColor: '#4facfe', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: 'bold', width: '100%' },
  btnSecondary: { backgroundColor: '#eef2f5', color: '#555', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' },
  linkButton: { background: 'none', border: 'none', color: '#888', textDecoration: 'underline', marginTop: '20px', cursor: 'pointer' },
  
  footer: { textAlign:'center', padding:'20px', color:'#999', fontSize:'13px' },
  
  loaderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #4facfe', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loaderText: { marginTop: '15px', fontWeight: '600', color: '#333' }
};

export default BackgroundRemover;
