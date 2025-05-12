// components/verification/verificationContext.js
'use client';
import { createContext, useContext, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export const VerificationContext = createContext(null);

export const VerificationProvider = ({ children }) => {
    const router = useRouter();
    const [step, setStep] = useState(1);

    const [docFrontFile, setDocFrontFile] = useState(null);
    const [docFrontPreview, setDocFrontPreview] = useState(null);
    const [docBackFile, setDocBackFile] = useState(null);
    const [docBackPreview, setDocBackPreview] = useState(null);
    const [selfieFile, setSelfieFile] = useState(null);
    const [selfiePreview, setSelfiePreview] = useState(null);

    const [videoFrontIdFile, setVideoFrontIdFile] = useState(null);
    const [videoBackIdFile, setVideoBackIdFile] = useState(null);
    const [videoSelfieFile, setVideoSelfieFile] = useState(null);

    const [currentUserId, setCurrentUserId] = useState(null);
    const [currentUserFirstName, setCurrentUserFirstName] = useState('');
    const [currentUserLastName, setCurrentUserLastName] = useState('');

    const [isLoading, setIsLoading] = useState(false);
    const [errorField, setErrorField] = useState(null);
    const [errorMessage, setErrorMessage] = useState('');
    const [selectedCountry, setSelectedCountry] = useState('');
    const [documentType, setDocumentType] = useState('ID Card');

    const updateImageForStep = useCallback((step, file, previewUrl) => {
        if (step === 3) {
            setDocFrontFile(file);
            setDocFrontPreview(previewUrl);
        } else if (step === 4) {
            setDocBackFile(file);
            setDocBackPreview(previewUrl);
        } else if (step === 5) {
            setSelfieFile(file);
            setSelfiePreview(previewUrl);
        }
    }, []);

    const updateVideoForStep = useCallback((videoBlob, videoIdentifierWithMode) => {
        if (!videoBlob || videoBlob.size === 0) {
            console.warn(`[VerificationContext] updateVideoForStep: Невалиден или празен blob за: ${videoIdentifierWithMode}`);
            return;
        }
        let fileExtension = 'webm';
        let cleanMimeType = 'video/webm';
        if (videoBlob.type) {
            const mimeTypeParts = videoBlob.type.split(';')[0].trim();
            if (mimeTypeParts.includes('/')) {
                const extensionCandidate = mimeTypeParts.split('/')[1];
                if (extensionCandidate) {
                    fileExtension = extensionCandidate.toLowerCase();
                    cleanMimeType = mimeTypeParts;
                }
            }
        }
        const baseIdentifier = videoIdentifierWithMode.split('_').slice(0, -1).join('_');
        let fileName = `${baseIdentifier}_${Date.now()}.${fileExtension}`;
        const videoFile = new File([videoBlob], fileName, { type: cleanMimeType });
        console.log(`[VerificationContext] Записано видео: ${fileName}, Тип: ${videoFile.type}, Размер: ${videoFile.size} bytes`);

        if (videoIdentifierWithMode && videoIdentifierWithMode.startsWith('front_id_video')) {
            setVideoFrontIdFile(videoFile);
        } else if (videoIdentifierWithMode && videoIdentifierWithMode.startsWith('back_id_video')) {
            setVideoBackIdFile(videoFile);
        } else if (videoIdentifierWithMode && videoIdentifierWithMode.startsWith('selfie_video')) {
            setVideoSelfieFile(videoFile);
        }
    }, []);

    const setUserForVerification = useCallback((userData) => {
        if (userData && userData.id) {
            console.log(`[VerificationContext] Задаване на потребителски данни: ID=${userData.id}, Име=${userData.firstName}, Фамилия=${userData.lastName}`);
            setCurrentUserId(userData.id);
            setCurrentUserFirstName(userData.firstName || '');
            setCurrentUserLastName(userData.lastName || '');
        } else {
            console.warn("[VerificationContext] setUserForVerification извикана с невалидни данни:", userData);
            setCurrentUserId(null);
            setCurrentUserFirstName('');
            setCurrentUserLastName('');
        }
    }, []);


    const handleVerificationSubmit = useCallback(async () => {
        if (!currentUserId) {
            console.error("[VerificationContext] currentUserId не е зададен. Верификацията не може да продължи.");
            setErrorMessage("Грешка: Потребителската сесия не е идентифицирана. Моля, влезте отново.");
            setErrorField('general');
            setIsLoading(false);
            return;
        }

        console.log(`[VerificationContext] handleVerificationSubmit извикана за потребител ID: ${currentUserId}, Име: ${currentUserFirstName} ${currentUserLastName}`);
        setIsLoading(true);
        setErrorField(null);
        setErrorMessage('');

        const formData = new FormData();
        formData.append('user_identifier', currentUserId.toString());
        // Добавяме имената към FormData, ако са налични
        if (currentUserFirstName) formData.append('firstName', currentUserFirstName);
        if (currentUserLastName) formData.append('lastName', currentUserLastName);

        if (docFrontFile) formData.append('idCardFront', docFrontFile, 'id_card_front.jpg');
        if (docBackFile) formData.append('idCardBack', docBackFile, 'id_card_back.jpg');
        if (selfieFile) formData.append('selfie', selfieFile, 'selfie.jpg');
        if (videoFrontIdFile) formData.append('video_front_id', videoFrontIdFile, videoFrontIdFile.name);
        if (videoBackIdFile) formData.append('video_back_id', videoBackIdFile, videoBackIdFile.name);
        if (videoSelfieFile) formData.append('video_selfie', videoSelfieFile, videoSelfieFile.name);

        console.log("[VerificationContext] Подготвени данни за изпращане (с имена):", Object.fromEntries(formData.entries()));

        const NEXTJS_PROXY_ENDPOINT = '/api/auth/internal-verify';
        console.log(`[VerificationContext] Изпращане на заявка към Next.js прокси: ${NEXTJS_PROXY_ENDPOINT}`);

        try {
            const response = await fetch(NEXTJS_PROXY_ENDPOINT, { method: 'POST', body: formData });
            setIsLoading(false);
            const responseData = await response.json().catch(() => null);

            if (response.ok && responseData && responseData.status === 'success' && responseData.verified === true) {
                console.log('[VerificationContext] Отговор от Next.js прокси (Успех от FastAPI):', responseData);
                setDocFrontFile(null); setDocFrontPreview(null);
                setDocBackFile(null); setDocBackPreview(null);
                setSelfieFile(null); setSelfiePreview(null);
                setVideoFrontIdFile(null); setVideoBackIdFile(null); setVideoSelfieFile(null);
                // Може да искате да изчистите и потребителските данни, ако е нужно
                // setCurrentUserId(null); 
                // setCurrentUserFirstName('');
                // setCurrentUserLastName('');
                setStep(1);
                router.push('/homePage');
            } else {
                let displayMessage = "Възникна грешка при обработка на вашата заявка. Моля, опитайте отново.";
                if (responseData && responseData.message) displayMessage = responseData.message;
                else if (response.status === 400) displayMessage = "Подадените данни са невалидни или непълни.";
                else if (response.status === 404) displayMessage = "Услугата за верификация не е достъпна.";
                else if (response.status >= 500) displayMessage = "Възникна вътрешна сървърна грешка.";
                console.error('[VerificationContext] Грешка от Next.js прокси (или FastAPI):', response.status, responseData || response.statusText);
                setErrorMessage(displayMessage);
                setErrorField(responseData?.field || 'general');
            }
        } catch (error) {
            setIsLoading(false);
            console.error('[VerificationContext] Грешка при изпращане на данните към Next.js прокси:', error);
            setErrorMessage('Възникна мрежова грешка. Моля, проверете вашата интернет връзка.');
            setErrorField('general');
        }
    }, [docFrontFile, docBackFile, selfieFile, videoFrontIdFile, videoBackIdFile, videoSelfieFile, router, setStep, setIsLoading, setErrorField, setErrorMessage, updateVideoForStep, currentUserId, currentUserFirstName, currentUserLastName, setUserForVerification]);

    const value = {
        step, setStep,
        docFrontFile, docFrontPreview, setDocFrontFile, setDocFrontPreview,
        docBackFile, docBackPreview, setDocBackFile, setDocBackPreview,
        selfieFile, selfiePreview, setSelfieFile, setSelfiePreview,
        videoFrontIdFile, videoBackIdFile, videoSelfieFile,
        setVideoFrontIdFile, setVideoBackIdFile, setVideoSelfieFile,
        isLoading, setIsLoading,
        errorField, errorMessage, setErrorField, setErrorMessage,
        updateImageForStep, updateVideoForStep,
        selectedCountry, setSelectedCountry,
        documentType, setDocumentType,
        handleVerificationSubmit,
        currentUserId,
        currentUserFirstName, // Добавено към value
        currentUserLastName,  // Добавено към value
        setUserForVerification,
    };

    return (
        <VerificationContext.Provider value={value}>
            {children}
        </VerificationContext.Provider>
    );
};

export const useVerification = () => {
    const ctx = useContext(VerificationContext);
    if (!ctx) throw new Error('useVerification must be used within VerificationProvider');
    return ctx;
};
