// components/camera/CameraCapture.js
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import './cameraOverlay.css'; // Уверете се, че този CSS файл съществува и е импортиран

export default function CameraCapture({
    facingMode = 'environment',
    overlayShape = 'rectangle',
    captureInstruction = "Подравнете документа в рамката.",
    onCapture, // За заснемане на снимка
    onVideoRecord, // НОВ ПРОП: За записаното видео
    stepIdentifier = "current_step", // НОВ ПРОП: За идентифициране на видеото
}) {
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const mediaStreamRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const recordedChunksRef = useRef([]);

    const [isVideoPlaying, setIsVideoPlaying] = useState(false);
    const [cameraError, setCameraError] = useState('');
    const [currentFacingMode, setCurrentFacingMode] = useState(facingMode);
    const [overlayBorderColor, setOverlayBorderColor] = useState('white');
    const stabilityTimerRef = useRef(null);
    const [isRecording, setIsRecording] = useState(false);

    // --- Eruda Инициализация ---
    useEffect(() => {
        // console.log('[Eruda Effect] Изпълнява се useEffect за Eruda.');
        if (process.env.NODE_ENV === 'production') {
            // console.log('[Eruda Effect] Режим на продукция, Eruda няма да се зарежда.');
            return;
        }
        if (document.getElementById('eruda')) {
            // console.log('[Eruda Effect] Eruda UI елементът вече съществува.');
            const devToolsPanel = window.eruda && typeof window.eruda.get === 'function' ? window.eruda.get('dev-tools') : undefined;
            if (window.eruda && typeof window.eruda.show === 'function' && devToolsPanel && typeof devToolsPanel.active === 'boolean' && !devToolsPanel.active) {
                // console.log('[Eruda Effect] Eruda UI е наличен, но не е активен.');
            }
            return;
        }
        const erudaScriptId = 'eruda-script-tag';
        if (!document.getElementById(erudaScriptId)) {
            // console.log('[Eruda Effect] Опит за зареждане на Eruda скрипт...');
            const erudaScriptTag = document.createElement('script');
            erudaScriptTag.id = erudaScriptId;
            erudaScriptTag.src = "//cdn.jsdelivr.net/npm/eruda";
            erudaScriptTag.onload = () => {
                // console.log('[Eruda Script] Eruda скриптът е ЗАРЕДЕН (onload).');
                if (window.eruda && typeof window.eruda.init === 'function') {
                    try {
                        window.eruda.init();
                        console.log('[Eruda Script] Eruda.init() е ИЗВИКАН успешно.');
                        if (document.getElementById('eruda')) {
                            // console.log('[Eruda Script] Eruda UI елементът е намерен след init.');
                        } else {
                            // console.warn('[Eruda Script] Eruda UI елементът НЕ Е намерен след init.');
                        }
                    } catch (initError) {
                        console.error('[Eruda Script] Грешка при извикване на eruda.init():', initError);
                    }
                } else {
                    // console.error('[Eruda Script] Eruda обектът не е намерен или eruda.init не е функция СЛЕД зареждане на скрипта.');
                }
            };
            erudaScriptTag.onerror = (e) => { console.error('[Eruda Script] ГРЕШКА при зареждане на Eruda скрипт от CDN:', e); };
            document.body.appendChild(erudaScriptTag);
        } else {
            // console.log('[Eruda Effect] Eruda скрипт тагът вече съществува в DOM.');
        }
    }, []);


    const stopCurrentStreamAndRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
            console.log('Спиране на видеозаписа чрез stopCurrentStreamAndRecording...');
            mediaRecorderRef.current.stop();
        } else if (mediaRecorderRef.current && mediaRecorderRef.current.state === "inactive" && recordedChunksRef.current.length > 0) {
            console.log('Видеозаписът е бил неактивен, но има данни. Обработка...');
            const videoBlob = new Blob(recordedChunksRef.current, { type: mediaRecorderRef.current.mimeType || 'video/webm' });
            if (onVideoRecord) {
                onVideoRecord(videoBlob, `${stepIdentifier}_${currentFacingMode || 'camera'}`);
            }
            recordedChunksRef.current = [];
            setIsRecording(false);
        }

        if (mediaStreamRef.current) {
            console.log('Спиране на текущия медиен поток:', mediaStreamRef.current.id);
            mediaStreamRef.current.getTracks().forEach(track => track.stop());
            mediaStreamRef.current = null;
            if (videoRef.current) videoRef.current.srcObject = null;
        }
        setIsVideoPlaying(false);
    }, [onVideoRecord, stepIdentifier, currentFacingMode]);

    useEffect(() => {
        setCurrentFacingMode(facingMode);
    }, [facingMode]);

    useEffect(() => {
        let isMounted = true;
        let preferredDeviceId = null;

        async function startCameraAndRecording() {
            if (!isMounted) return;

            console.log(`[startCameraAndRecording] Начална стойност на preferredDeviceId: ${preferredDeviceId}`);
            console.log(`Опит за стартиране на камера и запис. facingMode: ${currentFacingMode}`);
            setIsVideoPlaying(false);
            setCameraError('');
            setOverlayBorderColor('white');
            if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);

            stopCurrentStreamAndRecording();
            await new Promise(resolve => setTimeout(resolve, 250));
            if (!isMounted) return;

            try {
                let stream;

                if (currentFacingMode === 'environment') {
                    console.log(`Изброяване на устройства за facingMode: ${currentFacingMode} за автоматичен избор.`);
                    try {
                        const tempStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: currentFacingMode } });
                        if (!isMounted) { tempStream.getTracks().forEach(t => t.stop()); return; }
                        const devices = await navigator.mediaDevices.enumerateDevices();
                        const videoDevices = devices.filter(device => device.kind === 'videoinput');
                        console.log('Налични видео устройства (за авто-избор):', JSON.stringify(videoDevices.map(d => ({ id: d.deviceId, label: d.label })), null, 2));

                        const potentialRearCameras = videoDevices.filter(device => !device.label.toLowerCase().includes('front') && !device.label.toLowerCase().includes('user'));
                        console.log('Потенциални задни камери (за авто-избор):', JSON.stringify(potentialRearCameras.map(d => ({ id: d.deviceId, label: d.label })), null, 2));

                        if (potentialRearCameras.length >= 2) {
                            preferredDeviceId = potentialRearCameras[1].deviceId;
                            console.log(`АВТОМАТИЧЕН ОПИТ: Избрана е ВТОРАТА задна камера: ID=${preferredDeviceId}, Етикет=${potentialRearCameras[1].label}.`);
                        } else if (potentialRearCameras.length === 1) {
                            preferredDeviceId = potentialRearCameras[0].deviceId;
                            console.log(`АВТОМАТИЧЕН ОПИТ: Избрана е ЕДИНСТВЕНАТА задна камера: ID=${preferredDeviceId}, Етикет=${potentialRearCameras[0].label}.`);
                        } else {
                            console.log('Не са намерени подходящи задни камери за автоматичен избор, preferredDeviceId остава null.');
                        }
                        tempStream.getTracks().forEach(t => t.stop());
                    } catch (enumError) {
                        console.warn("Грешка при изброяване на устройства за авто-избор:", enumError);
                    }
                }

                if (!isMounted) return;
                const constraints = {
                    video: {
                        facingMode: preferredDeviceId ? undefined : currentFacingMode,
                        deviceId: preferredDeviceId ? { exact: preferredDeviceId } : undefined,
                        width: { ideal: 1280 }, height: { ideal: 720 },
                    },
                    audio: false,
                };
                console.log('Искане на getUserMedia с финални изисквания:', JSON.stringify(constraints));
                stream = await navigator.mediaDevices.getUserMedia(constraints);

                if (!isMounted) { stream.getTracks().forEach(track => track.stop()); return; }

                const currentTrack = stream.getVideoTracks()[0];
                console.log('Успешно получен медиен поток:', stream.id, "Етикет:", currentTrack?.label);
                mediaStreamRef.current = stream;
                setCameraError('');

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        if (!isMounted) return;
                        videoRef.current?.play().then(() => {
                            if (!isMounted) return;
                            setIsVideoPlaying(true);
                            if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
                            stabilityTimerRef.current = setTimeout(() => {
                                if (isMounted && !cameraError && mediaStreamRef.current?.getVideoTracks()[0] && !mediaStreamRef.current.getVideoTracks()[0].muted) {
                                    setOverlayBorderColor('lime');
                                }
                            }, 2500);

                            if (mediaStreamRef.current && mediaStreamRef.current.active && typeof onVideoRecord === 'function') {
                                recordedChunksRef.current = [];
                                let options = { mimeType: 'video/webm; codecs=vp9' };
                                if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                                    options = { mimeType: 'video/webm' };
                                    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
                                        options = {};
                                    }
                                }
                                try {
                                    mediaRecorderRef.current = new MediaRecorder(mediaStreamRef.current, options);
                                    mediaRecorderRef.current.ondataavailable = (event) => {
                                        if (event.data.size > 0) recordedChunksRef.current.push(event.data);
                                    };
                                    mediaRecorderRef.current.onstop = () => {
                                        console.log('Видеозаписът е спрян (onstop). Обработка на данните...');
                                        const blobMimeType = mediaRecorderRef.current?.mimeType || options.mimeType || 'video/webm';
                                        const videoBlob = new Blob(recordedChunksRef.current, { type: blobMimeType });
                                        console.log('Създаден видео Blob:', videoBlob, 'Тип:', blobMimeType);
                                        if (videoBlob.size > 0) {
                                            onVideoRecord(videoBlob, `${stepIdentifier}_${currentFacingMode || 'camera'}`);
                                        } else {
                                            console.warn("Видео Blob е празен, няма да се извика onVideoRecord.");
                                        }
                                        recordedChunksRef.current = [];
                                        setIsRecording(false);
                                        mediaRecorderRef.current = null;
                                    };
                                    mediaRecorderRef.current.start();
                                    setIsRecording(true);
                                    console.log('Видеозаписът е стартиран.', mediaRecorderRef.current);
                                } catch (recorderError) {
                                    console.error("Грешка при инициализиране на MediaRecorder:", recorderError);
                                    setCameraError("Не може да се стартира видеозапис.");
                                }
                            } else if (!onVideoRecord) {
                                console.log("onVideoRecord не е подаден, видеозаписът няма да стартира.");
                            }
                        }).catch(playError => {
                            if (!isMounted) return;
                            console.error("Грешка при опит за пускане на видеото:", playError);
                            setCameraError('Проблем с пускането на видеото.');
                            setOverlayBorderColor('red');
                            stopCurrentStreamAndRecording();
                        });
                    };
                    videoRef.current.onerror = () => {
                        if (!isMounted) return;
                        console.error("Грешка във видео елемента");
                        setCameraError("Възникна грешка с видеото.");
                        setOverlayBorderColor('red');
                        stopCurrentStreamAndRecording();
                    };
                }
            } catch (err) {
                if (!isMounted) return;
                const deviceIdForLog = typeof preferredDeviceId !== 'undefined' ? preferredDeviceId : 'не е дефиниран (останал null)';
                console.error(`Грешка при стартиране на камерата (facingMode: ${currentFacingMode}, preferredDeviceId: ${deviceIdForLog}):`, err);
                setOverlayBorderColor('red');
                if (err instanceof Error) {
                    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                        setCameraError('Не може да се поиска разрешение за камера. Моля, затворете всички активни наслагвания/балончета от други приложения (като Messenger, филтри за екран и др.) и опитайте отново. Проверете и разрешенията за камерата в настройките на браузъра.');
                    } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                        setCameraError(`Не е намерена камера.`);
                    } else if (err.name === 'NotReadableError') {
                        setCameraError(`Камерата не може да бъде достъпена. Опитайте отново.`);
                    } else if (err.name === 'OverconstrainedError') {
                        setCameraError(`Изискванията към камерата не могат да бъдат изпълнени.`);
                        if (err.constraint) {
                            console.error('OverconstrainedError details (constraint):', err.constraint, 'Message:', err.message);
                        } else {
                            console.error('OverconstrainedError details (message):', err.message);
                        }
                    } else {
                        setCameraError(`Грешка с камерата: ${err.name}.`);
                    }
                } else {
                    setCameraError('Възникна неочаквана грешка с камерата.');
                }
            }
        }

        setCameraError('');
        startCameraAndRecording();

        return () => {
            isMounted = false;
            if (stabilityTimerRef.current) clearTimeout(stabilityTimerRef.current);
            console.log(`Компонентът CameraCapture (facingMode: ${currentFacingMode}) се демонтира. Спиране на камера и запис.`);
            stopCurrentStreamAndRecording();
        };
    }, [currentFacingMode, stopCurrentStreamAndRecording, onVideoRecord, stepIdentifier]);

    const takePhoto = () => {
        if (!videoRef.current || !canvasRef.current || !isVideoPlaying) {
            setCameraError("Камерата не е готова за снимане. Моля, изчакайте.");
            setOverlayBorderColor('red');
            return;
        }
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            setCameraError("Грешка при подготовка за снимане.");
            return;
        }
        const isMirrored = currentFacingMode === 'user';
        if (isMirrored) {
            ctx.translate(video.videoWidth, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        if (isMirrored) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        canvas.toBlob(blob => {
            if (blob && onCapture) {
                onCapture(blob);
            } else if (!blob) {
                setCameraError("Грешка при обработка на снимката.");
            }
        }, 'image/jpeg', 0.92);
    };

    return (
        <div className="camera-capture-container">
            {cameraError && (<div className="alert alert-danger text-center small p-2 mb-2" role="alert"> {cameraError} </div>)}
            {isRecording && (<div className="alert alert-info text-center small p-1 mb-2" role="alert" style={{ animation: 'blinker 1s linear infinite' }}> <span role="img" aria-label="Recording" style={{ color: 'red', fontSize: '1.2em' }}>●</span> Записва се... </div>)}
            <div className="camera-feed-wrapper mb-3">
                <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className={`camera-video ${currentFacingMode === 'user' ? 'mirrored' : ''}`}
                />
                <div className="camera-overlay">
                    <div
                        className={`overlay-shape ${overlayShape === 'oval' ? 'shape-oval' : 'shape-rectangle'}`}
                        style={{ borderColor: overlayBorderColor }}
                    >
                    </div>
                </div>
            </div>
            <p className="text-center text-muted small mb-3">
                {captureInstruction}
                {overlayBorderColor === 'red' && !cameraError && (<span style={{ color: 'red', display: 'block', marginTop: '5px' }}>Моля, опитайте да позиционирате по-добре или проверете осветлението.</span>)}
                {overlayBorderColor === 'lime' && !cameraError && (<span style={{ color: 'green', display: 'block', marginTop: '5px' }}>Изглежда добре! Готови за снимка.</span>)}
            </p>
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <div className="d-flex justify-content-center">
                <button
                    type="button"
                    className="btn btn-primary btn-lg capture-button"
                    onClick={takePhoto}
                    disabled={!isVideoPlaying || !!cameraError}
                >
                    Снимай
                </button>
            </div>
        </div>
    );
}
