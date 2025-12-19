import React, { useState, useEffect } from 'react';
import { removeBackground, preload } from "@imgly/background-removal";
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './cropUtils';
import { generatePrintSheet, getPageSizes } from './printUtils';

const BackgroundRemover = () => {
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

  // 1. PRELOAD (Safe Mode)
  // removed 'gpu' force to prevent crashes
  useEffect(() => {
    try {
      preload({
        publicPath: "https://static.img.ly/background-removal-data/latest/",
        model: 'small'
      });
      console.log("AI Models Preloaded");
    } catch (e) {
      console.warn("Preload warning:", e);
    }
  }, []);

  // 2. RESIZER (Robust)
  const resizeImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const maxWidth = 1000; // Optimal speed/quality balance
          const scale = maxWidth / img.width;
          
          if (scale < 1) {
             const canvas = document.createElement('canvas');
             canvas.width = maxWidth;
             canvas.height = img.height * scale;
             
             const ctx = canvas.getContext('2d');
             ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
             
             // Export as Blob
             canvas.toBlob((blob) => {
                if (blob) resolve(blob);
                else reject(new Error("Canvas to Blob failed"));
             }, 'image/jpeg', 0.9);
          } else {
             resolve(file); // Return original if small enough
          }
        };
        img.onerror = (e) => reject(new Error("Image load failed"));
        img.src = event.target.result;
      };
      reader.onerror = (e) => reject(new Error("File read failed"));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Show preview immediately
    const rawUrl = URL.createObjectURL(file);
    setImageSrc(rawUrl);
    setStep(1); 
    setProcessedImage(null); 
    setPrintSheet(null);
    setRotation(0); setZoom(1); setBgColor('#ffffff');

    setIsLoading(true);
    setLoadingMsg("Optimizing & Removing Background...");

    try {
      // A. Resize Image
      const resizedBlob = await resizeImage(file);

      // B. Config
      const config = {
        publicPath: "https://static.img.ly/background-removal-data/latest/", 
        model: 'small', // Fast model
        // Removed 'device: gpu' - Let the library auto-detect (Prevents crashes)
        output: {
            format: 'image/png',
            quality: 0.8
        }
      };

      // C. Remove Background (Pass BLOB directly, not URL)
      // Passing the Blob directly is much safer than a blob:URL
      const blob = await removeBackground(resizedBlob, config);
      
      const processedUrl = URL.createObjectURL(blob);
      setProcessedImage(processedUrl);
      
      setStep(2); // Auto-advance

    } catch (e) {
      console.error("FULL ERROR DETAILS:", e); // Check Console (F12) if this happens!
      alert(`Error: ${e.message || "Could not remove background"}`);
    } finally {
      setIsLoading(false);
    }
  };

  // --- Printing Utils (Standard) ---
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
    setLoadingMsg("Creating Print Sheet...");
    try {
        const transparentCrop = await getCroppedImg(processedImage, croppedAreaPixels, rotation);
        const singlePhoto = await flattenImage(transparentCrop, bgColor);
        const sheet = await generatePrintSheet(singlePhoto, pageSize);
        setPrintSheet(sheet);
        setStep(3);
    } catch (e) {
        console.error(e);
        alert("Error generating print sheet");
    } finally {
        setIsLoading(false);
    }
  };

  // --- Render ---
  return (
    <div style={styles.pageWrapper}>
      <header style={styles.header}>
        <div style={styles.container}>
          <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
             <div style={{width:'30px', height:'30px', background:'#4facfe', borderRadius:'6px'}}></div>
             <h1 style={styles.logoText}>Passport<span style={{color:'#4facfe'}}>Pro</span></h1>
          </div>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
            
            {isLoading && (
              <div style={styles.loaderOverlay}>
                 <div style={styles.spinner}></div>
                 <p style={styles.loaderText}>{loadingMsg}</p>
              </div>
            )}

            {/* STEP 1: Upload */}
            {step === 1 && (
              <div style={styles.stepContainer}>
                 <h2 style={styles.heading}>Passport Photo Maker</h2>
                 <p style={styles.subHeading}>Upload a photo to start.</p>
                 <div style={styles.uploadArea}>
                    <input type="file" id="fileInput" onChange={handleImageUpload} accept="image/*" style={{display:'none'}} />
                    <label htmlFor="fileInput" style={styles.uploadButton}>Select Photo</label>
                 </div>
              </div>
            )}

            {/* STEP 2: Editor */}
            {step === 2 && processedImage && (
              <div style={styles.editorContainer}>
                  <div style={styles.editorLeft}>
                     <div style={styles.cropWrapper}>
                        <Cropper 
                          image={processedImage} 
                          crop={crop} zoom={zoom} rotation={rotation} aspect={3.5/4.5} 
                          onCropChange={setCrop} onCropComplete={onCropComplete} 
                          onZoomChange={setZoom} onRotationChange={setRotation}
                          style={{ containerStyle: { backgroundColor: bgColor } }}
                        />
                     </div>
                  </div>
                  <div style={styles.editorRight}>
                     <h3 style={styles.panelTitle}>Customize</h3>
                     <div style={styles.controlGroup}>
                        <label style={styles.label}>Background</label>
                        <div style={styles.colorGrid}>
                           {['#ffffff', '#4a90e2', '#d0021b', '#d3d3d3'].map(c => (
                              <div key={c} onClick={()=>setBgColor(c)} style={{...styles.colorDot, background:c, border: bgColor===c?'2px solid #333':'1px solid #ddd'}}></div>
                           ))}
                           <input type="color" value={bgColor} onChange={e=>setBgColor(e.target.value)} style={styles.colorInput}/>
                        </div>
                     </div>
                     <button onClick={goToPrintPage} style={styles.btnPrimaryFull}>Next: Print &rarr;</button>
                  </div>
              </div>
            )}

            {/* STEP 3: Print */}
            {step === 3 && printSheet && (
               <div style={styles.printContainer}>
                  <h3 style={styles.panelTitle}>Print Sheet</h3>
                  <div style={{marginBottom:'15px'}}>
                     <select value={pageSize} onChange={e => { setPageSize(e.target.value); goToPrintPage(); }} style={styles.select}>
                        {Object.keys(PAGE_OPTIONS).map(k => <option key={k} value={k}>{PAGE_OPTIONS[k].label}</option>)}
                     </select>
                  </div>
                  <img src={printSheet} alt="Sheet" style={styles.sheetImg} />
                  <br/>
                  <div style={{display:'flex', gap:'10px', justifyContent:'center'}}>
                      <a href={printSheet} download={`passport-${pageSize}.jpg`}><button style={styles.btnPrimary}>Download</button></a>
                  </div>
                  <button onClick={()=>setStep(2)} style={styles.linkButton}>&larr; Back</button>
               </div>
            )}
        </div>
      </main>
    </div>
  );
};

const styles = {
  pageWrapper: { fontFamily: "'Inter', sans-serif", backgroundColor: '#f4f7f6', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  header: { backgroundColor: '#fff', height: '60px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee' },
  container: { maxWidth: '1000px', margin: '0 auto', width: '100%', padding: '0 20px' },
  logoText: { fontSize: '20px', fontWeight: 'bold', color: '#333' },
  main: { flex: 1, display: 'flex', justifyContent: 'center', padding: '20px' },
  card: { backgroundColor: '#fff', width: '100%', maxWidth: '900px', borderRadius: '12px', boxShadow: '0 5px 20px rgba(0,0,0,0.05)', padding: '30px', position: 'relative' },
  stepContainer: { textAlign: 'center', padding: '40px 0' },
  heading: { fontSize: '24px', marginBottom: '10px' },
  subHeading: { color: '#666', marginBottom: '30px' },
  uploadArea: { border: '2px dashed #4facfe', borderRadius: '12px', padding: '40px', background: '#f0f9ff' },
  uploadButton: { background: '#4facfe', color: '#fff', padding: '12px 30px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' },
  editorContainer: { display: 'flex', flexWrap: 'wrap', gap: '30px' },
  editorLeft: { flex: 2, minWidth: '300px', height: '450px', position: 'relative', borderRadius: '8px', overflow: 'hidden', background: '#eee' },
  editorRight: { flex: 1, minWidth: '200px' },
  controlGroup: { marginBottom: '20px' },
  label: { display: 'block', marginBottom: '5px', fontWeight: '600', fontSize: '14px' },
  colorGrid: { display: 'flex', gap: '10px' },
  colorDot: { width: '30px', height: '30px', borderRadius: '50%', cursor: 'pointer' },
  colorInput: { width: '30px', height: '30px', border: 'none', background: 'none' },
  btnPrimaryFull: { background: '#4facfe', color: '#fff', border: 'none', padding: '12px', borderRadius: '6px', width: '100%', fontWeight: 'bold', cursor: 'pointer' },
  printContainer: { textAlign: 'center' },
  sheetImg: { maxHeight: '350px', boxShadow: '0 4px 10px rgba(0,0,0,0.1)', marginBottom: '20px' },
  btnPrimary: { background: '#4facfe', color: '#fff', border: 'none', padding: '10px 25px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px' },
  linkButton: { background: 'none', border: 'none', color: '#666', textDecoration: 'underline', marginLeft: '15px', cursor: 'pointer' },
  select: { padding: '8px', borderRadius: '4px', fontSize: '14px' },
  loaderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(255,255,255,0.9)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #4facfe', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loaderText: { marginTop: '10px', fontWeight: '600' }
};

// Global Animation
const styleSheet = document.createElement("style");
styleSheet.innerText = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
document.head.appendChild(styleSheet);

export default BackgroundRemover;
