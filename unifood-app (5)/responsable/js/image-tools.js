// Outils images : compression sur le téléphone AVANT l'envoi, pour ménager le stockage de la base.
(function () {
  async function loadBitmap(file) {
    if (window.createImageBitmap) {
      try {
        return await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch (e) {
        /* on retente avec <img> */
      }
    }
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Image illisible'));
      };
      img.src = url;
    });
  }

  function canvasToBlob(canvas, quality) {
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
  }

  // Niveaux de gris + contraste : le papier devient blanc, l'encre noire → JPEG beaucoup plus léger et plus lisible
  function documentFilter(ctx, w, h) {
    const img = ctx.getImageData(0, 0, w, h);
    const d = img.data;
    const low = 70;
    const high = 200;
    const k = 255 / (high - low);
    for (let i = 0; i < d.length; i += 4) {
      const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const v = Math.max(0, Math.min(255, (g - low) * k));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
  }

  // Compresse une image jusqu'à tenir sous maxBytes. Renvoie { blob, width, height }.
  async function compress(file, opts = {}) {
    const { maxDim = 1400, startQuality = 0.62, minQuality = 0.32, maxBytes = 130 * 1024, grayscale = false } = opts;
    const bmp = await loadBitmap(file);
    const w = bmp.width;
    const h = bmp.height;
    let scale = Math.min(1, maxDim / Math.max(w, h));
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: grayscale });
    let blob = null;
    for (let attempt = 0; attempt < 7; attempt++) {
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      if (grayscale) documentFilter(ctx, canvas.width, canvas.height);
      let q = startQuality;
      blob = await canvasToBlob(canvas, q);
      while (blob && blob.size > maxBytes && q > minQuality) {
        q = Math.max(minQuality, q - 0.07);
        blob = await canvasToBlob(canvas, q);
      }
      if (blob && blob.size <= maxBytes) break;
      scale *= 0.85;
    }
    if (bmp.close) bmp.close();
    return { blob, width: canvas.width, height: canvas.height };
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  window.ImageTools = { compress, blobToDataURL };
})();
