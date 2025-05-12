// components/authform.js (или .tsx)
'use client';

import { useState } from 'react';

// Компонентът AuthForm приема проп `onSubmit`, който се извиква при изпращане на формата
export default function AuthForm({ onSubmit }) {
  // Дефиниране на състояния за всяко поле от формата
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  // КОРЕКЦИЯ: isSignUp вече винаги е true и не се променя от потребителя
  const [isSignUp, setIsSignUp] = useState(true);
  const [birthDate, setBirthDate] = useState('');
  const [address, setAddress] = useState('');

  // Обработка на събмит на формата
  const handleSubmit = (e) => {
    e.preventDefault(); // предотвратява презареждането на страницата

    // Събиране на данните във обект
    const formData = { email, firstName, lastName, birthDate, address, password };

    // Проверка дали паролите съвпадат (само при регистрация, което е винаги)
    if (password !== confirmPassword) {
      alert('Passwords do not match'); // Паролите не съвпадат
      return;
    }

    // Извикване на подадения проп `onSubmit` с данните и isSignUp (което винаги ще е true)
    onSubmit(formData, isSignUp);
  };

  // Рендер на формата
  return (
    <div className="container d-flex justify-content-center mt-5">
      <div className="card shadow-sm p-4" style={{ width: '100%', maxWidth: '400px' }}>
        {/* КОРЕКЦИЯ: Заглавието вече е статично "Sign Up" */}
        <h2 className="text-center mb-4">Sign Up</h2>

        <form onSubmit={handleSubmit}>
          {/* Поле за имейл – винаги видимо */}
          <div className="mb-3">
            <label htmlFor="email" className="form-label">Email</label>
            <input
              type="email"
              id="email"
              className="form-control"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {/* Полетата за регистрация вече са винаги видими */}
          <>
            <div className="mb-3">
              <label htmlFor="firstName" className="form-label">First Name</label>
              <input
                type="text"
                id="firstName"
                className="form-control"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="lastName" className="form-label">Last Name</label>
              <input
                type="text"
                id="lastName"
                className="form-control"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="birthDate" className="form-label">Date of Birth</label>
              <input
                type="date"
                id="birthDate"
                className="form-control"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label htmlFor="address" className="form-label">Address</label>
              <input
                type="text"
                id="address"
                className="form-control"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </div>
          </>

          {/* Поле за парола – винаги видимо */}
          <div className="mb-3">
            <label htmlFor="password" className="form-label">Password</label>
            <input
              type="password"
              id="password"
              className="form-control"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Поле за потвърждение на паролата – винаги видимо */}
          <div className="mb-3">
            <label htmlFor="confirmPassword" className="form-label">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              className="form-control"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
          </div>

          {/* Бутон за регистрация */}
          <div className="d-grid gap-2">
            {/* КОРЕКЦИЯ: Текстът на бутона вече е статично "Sign Up" */}
            <button type="submit" className="btn btn-primary">
              Sign Up
            </button>
          </div>
        </form>

        {/* КОРЕКЦИЯ: Премахваме превключвателя между login/signup режимите */}
        {/* <div className="text-center mt-3">
          <button
            className="btn btn-link p-0"
            onClick={() => setIsSignUp((prev) => !prev)}
          >
            {isSignUp ? 'Already have an account? Log in here' : 'Don’t have an account? Sign up here'}
          </button>
        </div> 
        */}
      </div>
    </div>
  );
}
