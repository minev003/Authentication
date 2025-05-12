// cameraUtils.js
export function drawImageToCanvas(video, canvas, isMirror = false) {
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    if (isMirror) {
        ctx.translate(video.videoWidth, 0);
        ctx.scale(-1, 1);
    }

    ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);

    if (isMirror) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
    }
}

export function createImageBlobFromCanvas(canvas, shape, step) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Failed to create blob from canvas.'));
            const now = new Date();
            const fileName = `${shape}_${step}_${now.toISOString().replace(/[-:.]/g, '')}.jpg`;
            const file = new File([blob], fileName, { type: blob.type });
            const previewUrl = URL.createObjectURL(file);
            resolve({ file, previewUrl });
        }, 'image/jpeg', 0.92);
    });
}
