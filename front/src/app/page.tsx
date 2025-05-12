// src/app/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AuthForm from '../../components/authform';
// Променяме импорта, за да видим целия модул и да дебъгваме
import * as StepsConfigModule from '../../components/verification/VerificationStepsConfig';
import { VerificationProvider, useVerification } from '../../components/verification/verificationContext';

// Обвиваме LoginPage с VerificationProvider, за да може useVerification да се използва вътре
export default function LoginPageWrapper() {
  return (
    <VerificationProvider>
      <LoginPage />
    </VerificationProvider>
  );
}

function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Взимаме setUserForVerification от контекста
  const { setUserForVerification, step, setStep } = useVerification();

  const handleAuthSubmit = async (formData: any, isSignUp: boolean) => {
    try {
      setStep(1); // Нулираме стъпката при нов опит за автентикация
      setMessage(''); // Изчистваме стари съобщения

      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, isSignUp }),
      });

      const text = await res.text();
      if (res.ok) {
        const data = await JSON.parse(text);
        console.log('Auth success:', data);

        if (data.user && data.user.id) {
          setUserForVerification({
            id: data.user.id,
            firstName: data.user.firstName,
            lastName: data.user.lastName
          });
          setIsAuthenticated(true);
        } else if (isSignUp && data.message === 'Регистрацията е успешна!') {
          console.warn("User ID/names не са получени от /api/auth след регистрация. Използване на данни от формата.");
          setUserForVerification({
            id: null,
            firstName: formData.firstName,
            lastName: formData.lastName
          });
          setIsAuthenticated(true);
        } else {
          setMessage(data.message || 'Успешна автентикация, но липсват потребителски данни.');
          setIsAuthenticated(false);
        }
      } else {
        try {
          setMessage(JSON.parse(text).error || 'Грешка при изпълнение.');
        } catch {
          setMessage(text || 'Грешка при изпълнение на отговора.');
        }
        setIsAuthenticated(false);
      }
    } catch (err) {
      console.error('Auth request failed:', err);
      setMessage('Грешка при изпълнение на заявката.');
      setIsAuthenticated(false);
    }
  };

  return (
    <div className="bg-dark text-light min-vh-100 d-flex flex-column align-items-center justify-content-center p-4">
      <h1 className="text-center mt-4 mb-2">
        {message || (isAuthenticated ? 'Верификация на Документи' : 'Създаване на Акаунт / Вход')}
      </h1>
      {!isAuthenticated ? (
        <AuthForm
          onSubmit={handleAuthSubmit}
        />
      ) : (
        <StepRenderer />
      )}
    </div>
  );
}

function StepRenderer() {
  const { step } = useVerification();

  // --- ДЕБЪГВАНЕ НА ИМПОРТА ---
  console.log('[StepRenderer] Целият импортиран StepsConfigModule:', StepsConfigModule);
  // Опитваме да извлечем функцията; ако StepsConfigModule е undefined или няма getStepsConfig, това ще е undefined
  const getStepsConfig = StepsConfigModule?.getStepsConfig;
  console.log('[StepRenderer] Извлечена функция getStepsConfig:', getStepsConfig);
  // --- КРАЙ НА ДЕБЪГВАНЕТО ---

  if (typeof getStepsConfig !== 'function') {
    console.error('[StepRenderer] getStepsConfig не е функция! Проверете импорта и експорта на VerificationStepsConfig.');
    return <p className="text-center text-danger">Грешка при зареждане на конфигурацията на стъпките.</p>;
  }

  const stepsConfig = getStepsConfig();
  const CurrentStepComponent = stepsConfig.find(s => s.step === step)?.component || null;

  if (!CurrentStepComponent) {
    return <p className="text-center">Зареждане на стъпка {step} или невалидна стъпка...</p>;
  }

  // Изчисляваме общия брой стъпки за верификация (без финалната "Submitted" стъпка)
  const totalVerificationSteps = stepsConfig.filter(s => s.name !== 'Verification Submitted').length;

  return (
    <>
      <p className="text-center mb-4">Стъпка {step} от {totalVerificationSteps}
      </p>
      <CurrentStepComponent />
    </>
  );
}
