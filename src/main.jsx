import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { preload } from '@imgly/background-removal';

// 🚀 START DOWNLOADING IMMEDIATELY
// This runs while the user is looking at your logo/header
preload({
  publicPath: "https://static.img.ly/background-removal-data/1.0.6/",
  model: 'small', // Use the smaller, faster model
}).then(() => {
  console.log("AI Model Downloaded in Background!");
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
