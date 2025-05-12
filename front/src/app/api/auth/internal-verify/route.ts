// Файл: src/app/api/auth/internal-verify/route.ts (или .js)
import prisma from '../../../../../lib/prisma'; // Уверете се, че пътят до prisma клиента е правилен
import { NextResponse } from 'next/server'; // Използваме NextResponse за по-добри отговори

export async function POST(request: Request) {
    let userIdentifier: string | null = null; // За да го имаме достъпен и в catch блока
    try {
        const formData = await request.formData();

        userIdentifier = formData.get('user_identifier') as string | null;
        const firstName = formData.get('firstName') as string | null; // Не се използва директно тук, но се препраща
        const lastName = formData.get('lastName') as string | null;   // Не се използва директно тук, но се препраща

        if (!userIdentifier) {
            console.error('[Next.js API Proxy] Липсва user_identifier във FormData.');
            return NextResponse.json({ message: 'Липсва потребителски идентификатор.' }, { status: 400 });
        }

        console.log(`[Next.js API Proxy] Получени данни за препращане: user_identifier=${userIdentifier}, firstName=${firstName}, lastName=${lastName}`);
        // ... (логване на съдържанието на FormData, както беше) ...
        console.log(`[Next.js API Proxy] Съдържание на FormData за изпращане към FastAPI:`);
        for (const [key, value] of formData.entries()) {
            if (value instanceof File) {
                console.log(`  - ${key}: File (name: ${value.name}, size: ${value.size}, type: ${value.type})`);
            } else {
                console.log(`  - ${key}: ${value}`);
            }
        }


        const fastapiUrl = 'http://localhost:8000/verify';
        console.log(`[Next.js API Proxy] Препращане на заявка към: ${fastapiUrl}`);

        const responseFromFastAPI = await fetch(fastapiUrl, {
            method: 'POST',
            body: formData,
        });

        const responseDataFromFastAPI = await responseFromFastAPI.json().catch((e) => {
            logger.error(`[Next.js API Proxy] Не може да се парсне JSON от FastAPI отговора. Статус: ${responseFromFastAPI.status}`, e);
            return { status: "error", code: "PROXY_RESPONSE_PARSE_ERROR", message: "Грешка при обработка на отговора от сървъра за верификация.", details: responseFromFastAPI.statusText };
        });

        if (!responseFromFastAPI.ok) {
            console.error(`[Next.js API Proxy] Грешка от FastAPI: ${responseFromFastAPI.status}`, responseDataFromFastAPI);
            return NextResponse.json(responseDataFromFastAPI || { message: `Грешка от FastAPI: ${responseFromFastAPI.statusText}` }, { status: responseFromFastAPI.status });
        }

        console.log(`[Next.js API Proxy] Успешен отговор от FastAPI:`, responseDataFromFastAPI);

        // --- НОВО: Записване на пътищата в базата данни, ако верификацията е успешна ---
        if (responseDataFromFastAPI && responseDataFromFastAPI.status === 'success' && responseDataFromFastAPI.verified === true && responseDataFromFastAPI.saved_file_paths) {
            try {
                const userIdInt = parseInt(userIdentifier, 10);
                if (isNaN(userIdInt)) {
                    throw new Error("Невалиден user_identifier за преобразуване към число.");
                }

                const paths = responseDataFromFastAPI.saved_file_paths;
                const photoPaths = paths.photos || {};
                const videoPaths = paths.videos || {};

                // Подготвяме данните за Prisma
                const verificationDataToUpdate = {
                    idCardFrontPath: photoPaths.idCardFront,
                    idCardBackPath: photoPaths.idCardBack,
                    selfiePath: photoPaths.selfie,
                    videoFrontIdPath: videoPaths.video_front_id,
                    videoBackIdPath: videoPaths.video_back_id,
                    videoSelfiePath: videoPaths.video_selfie,
                    isVerified: true,
                    verificationDate: new Date(), // Задаваме текущата дата като дата на верификация
                    updatedAt: new Date(),
                };

                // Премахваме undefined полета, за да не ги записва Prisma като null, ако не са върнати
                Object.keys(verificationDataToUpdate).forEach(key => {
                    if (verificationDataToUpdate[key] === undefined) {
                        delete verificationDataToUpdate[key];
                    }
                });

                console.log(`[Next.js API Proxy] Актуализиране на Prisma за userId: ${userIdInt} с данни:`, verificationDataToUpdate);

                const updatedVerification = await prisma.verification.update({
                    where: { userId: userIdInt },
                    data: verificationDataToUpdate,
                });
                console.log('[Next.js API Proxy] Успешно актуализиран запис в Prisma Verification:', updatedVerification);

            } catch (prismaError) {
                console.error('[Next.js API Proxy] Грешка при запис в Prisma:', prismaError);
                // Връщаме успешния отговор от FastAPI, но с предупреждение за грешка при запис в БД
                // или може да решите да върнете 500 грешка към клиента, ако записът в БД е критичен.
                // Засега ще върнем отговора от FastAPI, но ще логнем грешката.
                // Може да добавите и специфично поле в responseDataFromFastAPI, за да индикирате този проблем.
                responseDataFromFastAPI.db_update_error = "Грешка при актуализиране на базата данни с пътищата до файловете.";
            }
        }
        // --- КРАЙ НА НОВАТА ЧАСТ ---

        return NextResponse.json(responseDataFromFastAPI, { status: 200 });

    } catch (error) {
        console.error('[Next.js API Proxy] Вътрешна грешка в проксито:', error);
        const errorMessage = error instanceof Error ? error.message : 'Неизвестна вътрешна грешка.';
        return NextResponse.json({
            message: 'Вътрешна грешка в прокси сървъра.',
            errorDetails: errorMessage
        }, { status: 500 });
    }
}

// Заместваме простия logger с console за този файл
const logger = {
    error: console.error,
    info: console.log,
    warn: console.warn,
    debug: console.debug,
};
