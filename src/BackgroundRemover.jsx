import React, { useState, useEffect } from 'react';
import { removeBackground, preload } from "@imgly/background-removal";
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './cropUtils';
import { generatePrintSheet, getPageSizes } from './printUtils';

const BackgroundRemover = () => {
  // States
  const [imageSrc, setImageSrc] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [printSheet, setPrintSheet] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  
  // Workflow
  const [step, setStep] = useState(1); 
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [pageSize, setPageSize] = useState('4x6_L');
  
  const PAGE_OPTIONS = getPageSizes();

  // ⚡ SPEED HACK 1: Preload the "Small" Model immediately
  useEffect(() => {
    preload({
      publicPath: "https://static.img.ly/background-removal-data/1.0.6/",
      model: 'small' // Forces the lightweight model
    });
  }, []);

  // ⚡ SPEED HACK 2: The Resizer
  // Shrinks huge images to 1000px width max.
  // This makes the AI work 10x faster.
  const resizeImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Passport photos don't need 4K resolution. 1000px is plenty.
          const maxWidth = 1000;
          const scale = maxWidth / img.width;
          
          if (scale < 1) {
             const canvas = document.createElement('canvas');
             canvas.width = maxWidth;
             canvas.height = img.height * scale;
             
             const ctx = canvas.getContext('2d');
             ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
             
             // Convert to low-quality JPEG for speed (AI doesn't care about compression)
             canvas.toBlob((blob) => {
                resolve(blob); 
             }, 'image/jpeg', 0.8);
          } else {
             resolve(file); // Image is already small
          }
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // 1. Show raw image immediately so user sees something happening
      const rawUrl = URL.createObjectURL(file);
      setImageSrc(rawUrl);
      setStep(1); 
      setProcessedImage(null); setPrintSheet(null);
      setRotation(0); setZoom(1); setBgColor('#ffffff');

      // 2. Resize and Start AI in Background
      setIsLoading(true);
      setLoadingMsg("Optimizing & Removing Background...");

      // Resize first
      const resizedBlob = await resizeImage(file);
      const resizedUrl = URL.createObjectURL(resizedBlob);

      // 3. Run AI on the SMALL image
      try {
        const blob = await removeBackground(resizedUrl, {
            publicPath: "https://static.img.ly/background-removal-data/1.0.6/",
            model: 'small', // Use fast model
            device: 'gpu',  // Use GPU
            output: {
                format: 'image/png',
                quality: 0.8
            }
        });
        
        const processedUrl = URL.createObjectURL(blob);
        setProcessedImage(processedUrl);
        
        // Auto-advance to editor once done
        setStep(2);
      } catch (e) {
        console.error(e);
        alert("Error processing image");
      } finally {
        setIsLoading(false);
      }
    }
  };

  // --- Printing Logic (Same as before) ---
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
    } finally {
        setIsLoading(false);
    }
  };

  // Re-generate sheet when page size changes
  useEffect(() => {
    if (step === 3 && printSheet) { // only if we already generated once
        // We need the single photo again to regenerate. 
        // NOTE: In a real app, store 'singlePhoto' in state to avoid re-flattening.
        // For simplicity, we just keep current sheet or user clicks back.
    }
  }, [pageSize]);


  // --- Render (Simplified UI for Speed) ---
  return (
    <div style={styles.pageWrapper}>
      <header style={styles.header}>
        <div style={styles.container}>
          <h1 style={styles.logoText}>Passport<span style={{color:'#4facfe'}}>Pro</span> <span style={{fontSize:'12px', color:'#999'}}>Fast Mode</span></h1>
        </div>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
            
            {/* Loader */}
            {isLoading && (
              <div style={styles.loaderOverlay}>
                 <div style={styles.spinner}></div>
                 <p style={styles.loaderText}>{loadingMsg}</p>
              </div>
            )}

            {/* STEP 1: Upload */}
            {step === 1 && (
              <div style={styles.stepContainer}>
                 <h2 style={styles.heading}>Fast Passport Photo</h2>
                 <p style={styles.subHeading}>Processing optimized for speed.</p>
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
                  <a href={printSheet} download={`passport-${pageSize}.jpg`}><button style={styles.btnPrimary}>Download</button></a>
                  <button onClick={()=>setStep(2)} style={styles.linkButton}>&larr; Back</button>
               </div>
            )}
        </div>
      </main>
    </div>
  );
};

// --- Styles (Same as before) ---
const styles = {
  pageWrapper: { fontFamily: "sans-serif", backgroundColor: '#f4f7f6', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
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

const styleSheet = document.createElement("style");
styleSheet.innerText = `@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`;
document.head.appendChild(styleSheet);

export default BackgroundRemover;
