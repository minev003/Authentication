import { useRef, useState, useEffect } from 'react';

export function useCamera(step, updateImageForStep) {
    const [mediaStream, setMediaStream] = useState(null);
    const [isCameraOpen, setIsCameraOpen] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [currentOverlayShape, setCurrentOverlayShape] = useState('');
    const [cameraFacingMode, setCameraFacingMode] = useState('environment');
    const [isVideoReady, setIsVideoReady] = useState(false);

    const videoRef = useRef(null);
    const canvasRef = useRef(null);

    useEffect(() => {
        return () => {
            if (mediaStream) {
                mediaStream.getTracks().forEach(track => track.stop());
                console.log('Camera stream stopped on unmount');
            }
        };
    }, [mediaStream]);

    const startCamera = async (facingMode, overlayShape) => {
        stopCamera();
        setIsVideoReady(false);
        setCameraError('');
        setCurrentOverlayShape(overlayShape);
        setCameraFacingMode(facingMode);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode,
                    width: { ideal: 1280, max: 1920 },
                    height: { ideal: 720, max: 1080 },
                    frameRate: { ideal: 24, max: 30 },
                }
            });
            setMediaStream(stream);
            setIsCameraOpen(true);
        } catch (err) {
            setCameraError(`Camera error: ${err.name} - ${err.message}`);
            setIsCameraOpen(false);
        }
    };

    const stopCamera = () => {
        if (mediaStream) {
            mediaStream.getTracks().forEach(track => track.stop());
            console.log('Camera stream stopped manually');
        }
        setMediaStream(null);
        setIsCameraOpen(false);
        setCurrentOverlayShape('');
        setIsVideoReady(false);
    };

    const takePhoto = () => {
        const video = videoRef.current;
        if (!video || !isVideoReady || !mediaStream) {
            setCameraError('Camera not ready');
            return;
        }

        const canvas = canvasRef.current || document.createElement('canvas');
        if (!canvasRef.current) canvasRef.current = canvas;

        const width = video.videoWidth;
        const height = video.videoHeight;
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext('2d');
        if (cameraFacingMode === 'user') {
            context.translate(width, 0);
            context.scale(-1, 1);
        }
        context.drawImage(video, 0, 0, width, height);
        if (cameraFacingMode === 'user') {
            context.setTransform(1, 0, 0, 1, 0, 0);
        }

        canvas.toBlob(blob => {
            if (!blob) return;
            const file = new File([blob], `${currentOverlayShape}_${Date.now()}.jpg`, { type: 'image/jpeg' });
            const url = URL.createObjectURL(file);
            updateImageForStep(step, file, url);
            stopCamera();
        }, 'image/jpeg', 0.92);
    };

    return {
        videoRef,
        canvasRef,
        mediaStream,
        isCameraOpen,
        cameraError,
        currentOverlayShape,
        cameraFacingMode,
        isVideoReady,
        startCamera,
        stopCamera,
        takePhoto,
        setIsVideoReady,
        setCameraError
    };
}
