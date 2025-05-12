'use client';

import React from 'react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
    const router = useRouter();

    const handleProfileClick = () => {
        router.push('/profile');
    };

    return (
        <div className="bg-light text-dark min-vh-100 d-flex flex-column align-items-center justify-content-center p-4">
            <div className="card shadow-lg p-4 bg-white" style={{ maxWidth: 500, width: '100%', borderRadius: '15px' }}>
                <div className="text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="currentColor" className="bi bi-check-circle-fill text-success mb-3" viewBox="0 0 16 16">
                        <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM12.03 4.97a.75.75 0 0 0-1.08.02L7 10.06l-1.72-1.72a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0l4.5-4.5a.75.75 0 0 0 .02-1.06z" />
                    </svg>
                    <h1 className="mb-3">Successful verification!</h1>
                    <p className="mb-4">Your account has been successfully verified.</p>
                    {/* <button onClick={handleProfileClick} className="btn btn-primary btn-lg">
                        Към моя профил
                    </button> */}
                </div>
            </div>
        </div>
    );
}