// Файл: src/app/api/auth/route.ts (или .js)
import bcrypt from 'bcryptjs';
import prisma from '../../../../lib/prisma'; // Уверете се, че пътят до prisma е правилен

export async function POST(request: Request) {
  const body = await request.json();
  const { email, firstName, lastName, birthDate, address, password, isSignUp } = body;

  console.log('[API Auth] Received data for POST:', body);

  if (!email || !password) {
    console.log('[API Auth] Error: Email and password are required.');
    return new Response(JSON.stringify({ error: 'Имейл и парола са задължителни.' }), { status: 400 });
  }

  if (isSignUp) {
    console.log('[API Auth] Processing Sign Up.');
    const userExists = await prisma.user.findUnique({
      where: { email },
    });

    if (userExists) {
      console.log('[API Auth] Error: User already exists:', email);
      return new Response(JSON.stringify({ error: 'Потребителят вече съществува.' }), { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('[API Auth] Password hashed.');

    try {
      const user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          birthDate: birthDate ? new Date(birthDate) : null,
          address,
          password: hashedPassword,
          // updatedAt ще се управлява автоматично от Prisma (@updatedAt в схемата)
        },
      });

      console.log('[API Auth] New user created in DB:', { id: user.id, email: user.email });

      // Добавяне на верификация за новия потребител
      // Използваме новите имена на полетата от schema.prisma
      await prisma.verification.create({
        data: {
          userId: user.id,
          // Оставяме пътищата празни или null при създаване, ще се попълнят по-късно
          idCardFrontPath: null, // КОРЕКЦИЯ: Старото беше idCardPicture
          idCardBackPath: null,  // НОВО: Добавяме поле за задна страна
          selfiePath: null,      // КОРЕКЦИЯ: Старото беше selfiePicture
          // videoFrontIdPath, videoBackIdPath, videoSelfiePath също ще са null по подразбиране
          // isVerified е false по подразбиране
          // createdAt и updatedAt ще се управляват автоматично от Prisma
          // verificationDate ще е null по подразбиране
        },
      });
      console.log('[API Auth] Verification record created for user ID:', user.id);

      return new Response(JSON.stringify({
        message: 'Регистрацията е успешна!',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName
        }
      }), { status: 200 });

    } catch (error) {
      console.error('[API Auth] Error during sign up process:', error);
      if (error.code === 'P2002' && error.meta?.target?.includes('email')) {
        return new Response(JSON.stringify({ error: 'Потребител с този имейл вече съществува (P2002).' }), { status: 400 });
      }
      return new Response(JSON.stringify({ error: 'Грешка при създаване на потребител или верификация.' }), { status: 500 });
    }

  } else { // Ако е логин
    console.log('[API Auth] Processing Login for:', email);
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        verification: true,
      },
    });

    if (!user) {
      console.log('[API Auth] Error: User not found for login:', email);
      return new Response(JSON.stringify({ error: 'Невалиден имейл или парола.' }), { status: 400 });
    }

    console.log('[API Auth] User found for login:', { id: user.id, email: user.email });

    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      console.log('[API Auth] Error: Password mismatch for user:', email);
      return new Response(JSON.stringify({ error: 'Невалиден имейл или парола.' }), { status: 400 });
    }

    console.log('[API Auth] Password matched for user:', email);
    if (user.verification) {
      // Показваме новите имена на полетата, ако са налични
      console.log('[API Auth] User verification data (paths):', {
        front: user.verification.idCardFrontPath,
        back: user.verification.idCardBackPath,
        selfie: user.verification.selfiePath
      });
    } else {
      console.log('[API Auth] Потребителят няма верификация.');
    }

    return new Response(JSON.stringify({
      message: 'Входът е успешен!',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        birthDate: user.birthDate,
        address: user.address,
        verification: user.verification // Включваме цялата информация за верификацията
      }
    }), { status: 200 });
  }
}
