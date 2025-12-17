import React, { useState, useEffect } from 'react';
import { removeBackground } from "@imgly/background-removal";
import Cropper from 'react-easy-crop';
import { getCroppedImg } from './cropUtils';
import { generatePrintSheet, getPageSizes } from './printUtils';

const BackgroundRemover = () => {
  // --- States ---
  const [imageSrc, setImageSrc] = useState(null);
  const [processedImage, setProcessedImage] = useState(null);
  const [finalSingle, setFinalSingle] = useState(null);
  const [printSheet, setPrintSheet] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  // Editor States
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  
  // Steps: 1=Upload, 2=Editor, 3=Print
  const [step, setStep] = useState(1); 

  // Options
  const [bgColor, setBgColor] = useState('#ffffff');
  const [pageSize, setPageSize] = useState('4x6_L'); // Default to 8-up landscape
  const PAGE_OPTIONS = getPageSizes();

  // --- Handlers ---

  const handleImageUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
      setStep(1); 
      setProcessedImage(null); setFinalSingle(null); setPrintSheet(null);
      setRotation(0); setZoom(1); setBgColor('#ffffff');
    }
  };

  const handleRemoveBg = async () => {
    setIsLoading(true);
    setLoadingMsg("Removing Background... (AI Processing)");
    try {
const config = {
  publicPath: "https://static.img.ly/background-removal-data/1.0.0/", // Fetch models from fast CDN
  debug: true, // Lets you see download progress in console
  device: 'gpu', // Forces GPU usage if available
  proxyToWorker: true, // Offloads work to a web worker to stop UI freezing
};

const blob = await removeBackground(imageSrc, config);
      const url = URL.createObjectURL(blob);
      setProcessedImage(url);
      setStep(2);
    } catch (e) {
      alert("Could not remove background. Try a different photo.");
    } finally {
      setIsLoading(false);
    }
  };

  const onCropComplete = (croppedArea, croppedAreaPixels) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  // Generate Final Images
  const goToPrintPage = async () => {
    setIsLoading(true);
    setLoadingMsg("Preparing Print Layout...");
    try {
        const transparentCrop = await getCroppedImg(processedImage, croppedAreaPixels, rotation);
        const singlePhoto = await flattenImage(transparentCrop, bgColor);
        setFinalSingle(singlePhoto);
        
        const sheet = await generatePrintSheet(singlePhoto, pageSize);
        setPrintSheet(sheet);
        setStep(3);
    } catch (e) {
        console.error(e);
    } finally {
        setIsLoading(false);
    }
  };

  const flattenImage = (imgUrl, color) => {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = imgUrl;
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL('image/jpeg', 1.0));
        };
    });
  };

  useEffect(() => {
    if (step === 3 && finalSingle) {
        setIsLoading(true);
        generatePrintSheet(finalSingle, pageSize).then((sheet) => {
             setPrintSheet(sheet);
             setIsLoading(false);
        });
    }
  }, [pageSize, finalSingle, step]);

  // --- Render UI ---

  return (
    <div style={styles.pageWrapper}>
      
      {/* --- HEADER --- */}
      <header style={styles.header}>
        <div style={styles.container}>
          <div style={styles.logoContainer}>
            {/* Simple CSS Icon */}
            <div style={styles.logoIcon}>
               <div style={{width:'60%', height:'60%', background:'#fff', borderRadius:'50%'}}></div>
            </div>
            <h1 style={styles.logoText}>Passport<span style={{color:'#4facfe'}}>Pro</span></h1>
          </div>
          <nav style={styles.nav}>
             <a href="#" style={styles.navLink}>Home</a>
             <a href="#" style={styles.navLink}>Pricing</a>
             <a href="#" style={styles.navLink}>Contact</a>
          </nav>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main style={styles.main}>
        <div style={styles.card}>
            
            {/* Loading Overlay */}
            {isLoading && (
              <div style={styles.loaderOverlay}>
                 <div style={styles.spinner}></div>
                 <p style={styles.loaderText}>{loadingMsg}</p>
              </div>
            )}

            {/* Progress Bar */}
            <div style={styles.progressBar}>
               <div style={{...styles.progressStep, ...(step >= 1 ? styles.stepActive : {})}}>1. Upload</div>
               <div style={styles.progressLine}></div>
               <div style={{...styles.progressStep, ...(step >= 2 ? styles.stepActive : {})}}>2. Edit</div>
               <div style={styles.progressLine}></div>
               <div style={{...styles.progressStep, ...(step >= 3 ? styles.stepActive : {})}}>3. Print</div>
            </div>

            {/* STEP 1: UPLOAD */}
            {step === 1 && (
              <div style={styles.stepContainer}>
                 <h2 style={styles.heading}>Create Your Passport Photo</h2>
                 <p style={styles.subHeading}>Upload an image, remove the background automatically, and get a printable sheet in seconds.</p>
                 
                 {!imageSrc ? (
                   <div style={styles.uploadArea}>
                      <input type="file" id="fileInput" onChange={handleImageUpload} accept="image/*" style={{display:'none'}} />
                      <label htmlFor="fileInput" style={styles.uploadButton}>
                         Upload Image
                      </label>
                      <p style={{marginTop:'15px', color:'#999', fontSize:'13px'}}>Supports JPEG, PNG, HEIC</p>
                   </div>
                 ) : (
                   <div style={styles.previewArea}>
                      <img src={imageSrc} style={styles.rawImage} alt="Preview" />
                      <div style={styles.actionButtons}>
                        <button onClick={() => setImageSrc(null)} style={styles.btnSecondary}>Change Photo</button>
                        <button onClick={handleRemoveBg} style={styles.btnPrimary}>Remove Background &rarr;</button>
                      </div>
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
                           {['#ffffff', '#4a90e2', '#d0021b', '#8b572a', '#d3d3d3', '#f5a623'].map(c => (
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
                        <label style={styles.label}>Rotation</label>
                        <input type="range" min="-45" max="45" step="1" value={rotation} onChange={e=>setRotation(Number(e.target.value))} style={styles.slider} />
                     </div>

                     <button onClick={goToPrintPage} style={styles.btnPrimaryFull}>Next: Print Preview &rarr;</button>
                  </div>
              </div>
            )}

            {/* STEP 3: PRINT */}
            {step === 3 && printSheet && (
               <div style={styles.printContainer}>
                  <div style={styles.printHeader}>
                     <h3 style={styles.panelTitle}>Print Ready Sheet</h3>
                     <select value={pageSize} onChange={e=>setPageSize(e.target.value)} style={styles.select}>
                        {Object.keys(PAGE_OPTIONS).map(k => <option key={k} value={k}>{PAGE_OPTIONS[k].label}</option>)}
                     </select>
                  </div>

                  <div style={styles.sheetPreview}>
                     <img src={printSheet} alt="Sheet" style={styles.sheetImg} />
                  </div>

                  <div style={styles.downloadRow}>
                     <a href={printSheet} download={`passport-sheet-${pageSize}.jpg`} style={{textDecoration:'none'}}>
                        <button style={styles.btnPrimary}>Download Printable Sheet</button>
                     </a>
                     <a href={finalSingle} download="passport-photo.jpg" style={{textDecoration:'none'}}>
                        <button style={styles.btnSecondary}>Download Single Photo</button>
                     </a>
                  </div>
                  
                  <button onClick={()=>setStep(2)} style={styles.linkButton}>&larr; Back to Editor</button>
               </div>
            )}
        </div>
      </main>

      {/* --- FOOTER --- */}
      <footer style={styles.footer}>
        <div style={styles.footerContent}>
           <div style={styles.footerCol}>
              <h4 style={styles.footerBrand}>PassportPro</h4>
              <p style={styles.footerText}>AI-powered tool to create perfect passport photos from the comfort of your home.</p>
           </div>
           <div style={styles.footerCol}>
              <h5 style={styles.footerHead}>Product</h5>
              <a href="#" style={styles.footerLink}>Features</a>
              <a href="#" style={styles.footerLink}>Pricing</a>
           </div>
           <div style={styles.footerCol}>
              <h5 style={styles.footerHead}>Legal</h5>
              <a href="#" style={styles.footerLink}>Privacy Policy</a>
              <a href="#" style={styles.footerLink}>Terms of Service</a>
           </div>
        </div>
        <div style={styles.footerBottom}>
           &copy; {new Date().getFullYear()} PassportPro Inc. All rights reserved.
        </div>
      </footer>

    </div>
  );
};

// --- STYLES ---
const styles = {
  // Layout
  pageWrapper: { fontFamily: "'Inter', sans-serif", backgroundColor: '#f4f7f6', minHeight: '100vh', display: 'flex', flexDirection: 'column' },
  container: { maxWidth: '1200px', margin: '0 auto', width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 20px' },
  main: { flex: 1, display: 'flex', justifyContent: 'center', padding: '40px 20px' },
  
  // Header
  header: { backgroundColor: '#ffffff', height: '70px', display: 'flex', alignItems: 'center', borderBottom: '1px solid #eaeaea', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' },
  logoContainer: { display: 'flex', alignItems: 'center', gap: '10px' },
  logoIcon: { width: '32px', height: '32px', backgroundColor: '#4facfe', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  logoText: { fontSize: '20px', fontWeight: 'bold', color: '#333', margin: 0 },
  nav: { display: 'flex', gap: '20px' },
  navLink: { textDecoration: 'none', color: '#555', fontSize: '14px', fontWeight: '500' },

  // Card
  card: { backgroundColor: '#fff', width: '100%', maxWidth: '1000px', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', padding: '40px', position: 'relative', overflow: 'hidden' },

  // Progress Bar
  progressBar: { display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '40px' },
  progressStep: { fontSize: '14px', fontWeight: '600', color: '#ccc', backgroundColor: '#fff', zIndex: 2, padding: '0 10px' },
  stepActive: { color: '#4facfe' },
  progressLine: { width: '60px', height: '2px', backgroundColor: '#eee', margin: '0 5px' },

  // Step 1
  stepContainer: { textAlign: 'center', padding: '20px 0' },
  heading: { fontSize: '28px', color: '#333', marginBottom: '10px' },
  subHeading: { fontSize: '16px', color: '#666', marginBottom: '30px' },
  uploadArea: { border: '2px dashed #4facfe', borderRadius: '12px', padding: '60px', backgroundColor: '#f0f9ff', cursor: 'pointer', transition: '0.2s' },
  uploadButton: { backgroundColor: '#4facfe', color: '#fff', padding: '12px 30px', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: 'pointer', display: 'inline-block' },
  previewArea: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' },
  rawImage: { maxHeight: '300px', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  actionButtons: { display: 'flex', gap: '15px' },

  // Step 2 (Editor)
  editorContainer: { display: 'flex', flexWrap: 'wrap', gap: '40px' },
  editorLeft: { flex: 2, minWidth: '300px', height: '500px', position: 'relative', borderRadius: '12px', overflow: 'hidden', backgroundColor: '#eee', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.05)' },
  editorRight: { flex: 1, minWidth: '250px' },
  panelTitle: { fontSize: '18px', marginBottom: '20px', color: '#333' },
  controlGroup: { marginBottom: '25px' },
  label: { display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: '600', color: '#555' },
  slider: { width: '100%', cursor: 'pointer', accentColor: '#4facfe' },
  colorGrid: { display: 'flex', gap: '10px', flexWrap: 'wrap' },
  colorDot: { width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer' },
  colorInput: { width: '34px', height: '34px', border: '2px solid black', background: 'none', cursor: 'pointer' },

  // Step 3 (Print)
  printContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center' },
  printHeader: { display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '600px', alignItems: 'center', marginBottom: '20px' },
  select: { padding: '8px', borderRadius: '6px', borderColor: '#ddd' },
  sheetPreview: { backgroundColor: '#ddd', padding: '20px', borderRadius: '8px', marginBottom: '30px', overflow: 'auto', maxWidth: '100%' },
  sheetImg: { maxHeight: '400px', boxShadow: '0 5px 15px rgba(0,0,0,0.1)' },
  downloadRow: { display: 'flex', gap: '15px' },

  // Buttons
  btnPrimary: { backgroundColor: '#4facfe', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  btnPrimaryFull: { backgroundColor: '#4facfe', color: '#fff', border: 'none', padding: '12px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '16px', fontWeight: '600', width: '100%' },
  btnSecondary: { backgroundColor: '#eef2f5', color: '#555', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: '600' },
  linkButton: { background: 'none', border: 'none', color: '#888', textDecoration: 'underline', marginTop: '20px', cursor: 'pointer' },

  // Footer
  footer: { backgroundColor: '#1a1d21', color: '#fff', padding: '60px 0 20px' },
  footerContent: { maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', padding: '0 20px 40px', flexWrap: 'wrap', gap: '40px' },
  footerCol: { minWidth: '150px' },
  footerBrand: { fontSize: '20px', marginBottom: '15px', color: '#fff' },
  footerText: { color: '#889', fontSize: '14px', lineHeight: '1.6', maxWidth: '250px' },
  footerHead: { color: '#fff', marginBottom: '15px', fontSize: '14px', textTransform: 'uppercase', letterSpacing: '1px' },
  footerLink: { display: 'block', color: '#889', textDecoration: 'none', marginBottom: '10px', fontSize: '14px' },
  footerBottom: { borderTop: '1px solid #333', textAlign: 'center', paddingTop: '20px', color: '#555', fontSize: '13px' },

  // Loading
  loaderOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.9)', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #4facfe', borderRadius: '50%', animation: 'spin 1s linear infinite' },
  loaderText: { marginTop: '15px', fontWeight: '600', color: '#333' }
};

// Global Animations
const styleSheet = document.createElement("style");
styleSheet.innerText = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
`;
document.head.appendChild(styleSheet);

export default BackgroundRemover;
