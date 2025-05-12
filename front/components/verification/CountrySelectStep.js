'use client';
import { useVerification } from './verificationContext';
import VerificationStepCard from './VerificationStepCard';

export default function CountrySelectStep() {
    const { selectedCountry, setSelectedCountry, setStep } = useVerification();

    const handleSelect = (e) => {
        const value = e.target.value;
        setSelectedCountry(value);
        if (value) {
            setStep(2); // автоматично напред при избор
        }
    };

    return (
        <VerificationStepCard
            title="Choose your country"
        >
            <select
                className="form-select mb-3"
                value={selectedCountry}
                onChange={handleSelect}
            >
                <option value="">-- Choose --</option>
                <option value="Bulgaria">Bulgaria</option>
                <option value="Romania">Romania</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="Italy">Italy</option>
            </select>
        </VerificationStepCard>
    );
}
