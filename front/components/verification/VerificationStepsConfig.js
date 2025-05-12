'use client';

import { useVerification } from './verificationContext';
import CountrySelectStep from './CountrySelectStep';
import DocumentTypeStep from './DocumentTypeStep';
import CameraCapture from '../camera/CameraCapture'; // Уверете се, че пътят е правилен
import VerificationStepCard from './VerificationStepCard';

export function getStepsConfig() {
    return [
        {
            step: 1,
            name: 'Country Selection', // Избор на държава
            component: CountrySelectStep,
        },
        {
            step: 2,
            name: 'Document Type', // Тип документ
            component: DocumentTypeStep,
        },
        {
            step: 3,
            name: 'Front of ID Card', // Предна страна на ЛК
            component: () => {
                const {
                    docFrontPreview,
                    errorField,
                    errorMessage,
                    updateImageForStep,
                    updateVideoForStep, // НОВО: Взимаме функцията за видео
                    setStep,
                } = useVerification();

                const handleCapture = (blob) => {
                    if (!blob) {
                        console.error("handleCapture получи невалиден blob за стъпка 3");
                        return;
                    }
                    const file = new File([blob], 'idCardFront.jpg', { type: 'image/jpeg' });
                    const url = URL.createObjectURL(file);
                    updateImageForStep(3, file, url);
                    setStep(4);
                };

                return (
                    <VerificationStepCard
                        title="Сканиране на предна страна"
                        preview={docFrontPreview}
                        error={errorField === 'idCardFront' ? errorMessage : ''}
                        onRetake={() => {
                            updateImageForStep(3, null, null);
                            // По желание: изчистваме и видеото, ако има такова
                            if (updateVideoForStep) updateVideoForStep(null, "front_id_video");
                        }}
                        onBack={() => setStep(2)}
                    >
                        {!docFrontPreview && (
                            <CameraCapture
                                facingMode="environment"
                                overlayShape="rectangle"
                                captureInstruction="Позиционирайте предната страна на картата в рамката. Уверете се, че всички 4 ъгъла са видими."
                                onCapture={handleCapture}
                                // НОВИ ПРОПОВЕ за видеозапис
                                onVideoRecord={updateVideoForStep}
                                stepIdentifier="front_id_video"
                            />
                        )}
                    </VerificationStepCard>
                );
            },
        },
        {
            step: 4,
            name: 'Back of ID Card', // Задна страна на ЛК
            component: () => {
                const {
                    docBackPreview,
                    errorField,
                    errorMessage,
                    updateImageForStep,
                    updateVideoForStep, // НОВО: Взимаме функцията за видео
                    setStep,
                } = useVerification();

                const handleCapture = (blob) => {
                    if (!blob) {
                        console.error("handleCapture получи невалиден blob за стъпка 4");
                        return;
                    }
                    const file = new File([blob], 'idCardBack.jpg', { type: 'image/jpeg' });
                    const url = URL.createObjectURL(file);
                    updateImageForStep(4, file, url);
                    setStep(5);
                };

                return (
                    <VerificationStepCard
                        title="Сканиране на задна страна"
                        preview={docBackPreview}
                        error={errorField === 'idCardBack' ? errorMessage : ''}
                        onRetake={() => {
                            updateImageForStep(4, null, null);
                            if (updateVideoForStep) updateVideoForStep(null, "back_id_video");
                        }}
                        onBack={() => setStep(3)}
                    >
                        {!docBackPreview && (
                            <CameraCapture
                                facingMode="environment"
                                overlayShape="rectangle"
                                captureInstruction="Позиционирайте задната страна на картата в рамката."
                                onCapture={handleCapture}
                                // НОВИ ПРОПОВЕ за видеозапис
                                onVideoRecord={updateVideoForStep}
                                stepIdentifier="back_id_video"
                            />
                        )}
                    </VerificationStepCard>
                );
            },
        },
        {
            step: 5,
            name: 'Selfie with ID/Passport', // Селфи
            component: () => {
                const {
                    selfiePreview,
                    errorField,
                    errorMessage,
                    updateImageForStep,
                    updateVideoForStep, // НОВО: Взимаме функцията за видео
                    handleVerificationSubmit,
                    setStep,
                    isLoading,
                } = useVerification();

                const handleSelfieCapture = (blob) => {
                    if (!blob) {
                        console.error("handleSelfieCapture получи невалиден blob за стъпка 5");
                        return;
                    }
                    const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
                    const url = URL.createObjectURL(file);
                    updateImageForStep(5, file, url);
                    // Не преминаваме автоматично към следваща стъпка тук
                };

                return (
                    <VerificationStepCard
                        title="Направете селфи"
                        preview={selfiePreview}
                        error={['selfie', 'general'].includes(errorField) ? errorMessage : ''}
                        onRetake={() => {
                            updateImageForStep(5, null, null);
                            if (updateVideoForStep) updateVideoForStep(null, "selfie_video");
                        }}
                        onBack={() => setStep(4)}
                        onNext={handleVerificationSubmit}
                        buttonLabel={isLoading ? "Изпращане..." : "Изпрати за верификация"}
                        disableNextButton={isLoading}
                    >
                        {!selfiePreview && (
                            <CameraCapture
                                facingMode="user"
                                overlayShape="oval"
                                captureInstruction="Позиционирайте лицето си в овалната рамка."
                                onCapture={handleSelfieCapture}
                                // НОВИ ПРОПОВЕ за видеозапис
                                onVideoRecord={updateVideoForStep}
                                stepIdentifier="selfie_video"
                            />
                        )}
                        {isLoading && (
                            <div className="text-center mt-3">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                                <p>Изпращане на данните...</p>
                            </div>
                        )}
                    </VerificationStepCard>
                );
            },
        },
        {
            step: 6,
            name: 'Verification Submitted', // Верификацията е изпратена
            component: () => {
                const { errorMessage, errorField, setStep } = useVerification();
                return (
                    <VerificationStepCard
                        title="Верификацията е изпратена"
                    >
                        {errorField === 'general' && errorMessage ? (
                            <div className="alert alert-danger">{errorMessage}</div>
                        ) : (
                            <p className="text-center">
                                Вашите документи бяха успешно изпратени за верификация.
                                Ще бъдете уведомени за резултата.
                            </p>
                        )}
                        <div className="text-center mt-3">
                            <button className="btn btn-secondary" onClick={() => setStep(1)}>Нова верификация</button>
                        </div>
                    </VerificationStepCard>
                );
            }
        }
    ];
}
