import React from 'react';

export default function VerificationStepCard({
    title,
    preview,
    onStartCamera,
    onRetake,
    onNext,
    onBack,
    error,
    hasCamera,
    cameraError,
    buttonLabel,
    disableCameraBtn = false,
    children,
}) {
    return (
        <div
            className="card shadow-lg p-4 bg-opacity-90"
            style={{ maxWidth: 500, width: '100%', borderRadius: '15px' }}
        >
            <h5 className="mb-3 text-center">{title}</h5>

            {!preview ? (
                <>
                    {children}

                    {/* Камерни съобщения */}
                    {!hasCamera && cameraError && (
                        <div className="alert alert-warning text-center small mt-2 py-1">
                            {cameraError}
                        </div>
                    )}
                </>
            ) : (
                <div className="text-center">
                    <img
                        src={preview}
                        alt="Preview"
                        className="img-fluid rounded mb-2"
                        style={{ maxHeight: '250px' }}
                    />
                    <div className="d-flex justify-content-center gap-2">
                        <button
                            className="btn btn-sm btn-outline-warning"
                            onClick={onRetake}
                        >
                            New photo
                        </button>
                        {onNext && (
                            <button className="btn btn-primary btn-sm" onClick={onNext}>
                                Next
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ❗ Error */}
            {error && (
                <div className="alert alert-danger text-center small mt-3" role="alert">
                    {error}
                </div>
            )}
            <p></p>
            {/* 👇 Бутон Назад най-долу */}
            {onBack && (

                <button className="btn btn-primary" onClick={onBack}>
                    &larr; back step
                </button>
            )}
        </div>
    );
}
