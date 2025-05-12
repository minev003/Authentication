'use client';

import { useVerification } from './verificationContext';
import VerificationStepCard from './VerificationStepCard';

export default function DocumentTypeStep() {
    const {
        documentType,
        setDocumentType,
        setStep
    } = useVerification();

    const handleChange = (e) => {
        const value = e.target.value;
        setDocumentType(value);
        if (value) {
            setStep(3); // автоматичен преход
        }
    };

    return (
        <VerificationStepCard
            title="Select document type"
            onBack={() => setStep(1)} // 🔁 връщане към стъпка 1
        >
            <select
                className="form-select"
                value={documentType}
                onChange={handleChange}
            >
                <option value="">-- Select --</option>
                <option value="ID Card">ID Card</option>
                <option value="Passport">Passport</option>
                <option value="DriveLicense">Drive License</option>
            </select>
        </VerificationStepCard>
    );
}
