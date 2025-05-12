import os
import shutil
import logging
import time
import traceback 
from tempfile import TemporaryDirectory
from typing import Optional 

import cv2 
from deepface import DeepFace 
from fastapi import FastAPI, File, UploadFile, HTTPException, status, Request, Form 
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn 

try:
    import mediapipe as mp
    from moviepy.editor import VideoFileClip 
    import numpy as np 
    from scipy.spatial import distance as dist 
    MEDIAPIPE_AVAILABLE = True
    MOVIEPY_AVAILABLE = True 
except ImportError as e_import:
    MEDIAPIPE_AVAILABLE = False
    MOVIEPY_AVAILABLE = False 
    logging.warning(f"Една или повече библиотеки за Liveness (MediaPipe, MoviePy, SciPy, NumPy) не са намерени ({e_import}). Liveness детекцията ще бъде ограничена или деактивирана.")

logging.basicConfig(
    level=logging.DEBUG, 
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Identity Verification API (Conditional User File Storage)",
    description="API for verifying identity. Files are saved in user-specific named folders only upon full verification success.",
    version="1.4.9" # Актуализирана версия
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    logger.info(f"Request {request.method} {request.url.path} processed in {process_time:.4f} seconds")
    return response

MODEL_NAME = "SFace"
DETECTOR_BACKEND = "mtcnn"
DISTANCE_METRIC = "cosine"

PERMANENT_BASE_USER_FILES_DIR = "user_verification_data_verified" 
PHOTO_SUBDIR_NAME = "photos" 
VIDEO_SUBDIR_NAME = "videos" 
os.makedirs(PERMANENT_BASE_USER_FILES_DIR, exist_ok=True)

DUMMY_IMAGE_PATH = "dummy.jpg" 

LIVENESS_EAR_THRESHOLD = 0.20 
LIVENESS_EAR_CONSEC_FRAMES_MIN = 2 
LIVENESS_EAR_CONSEC_FRAMES_MAX = 5 
LIVENESS_MIN_BLINKS_REQUIRED = 1   
LIVENESS_MOVEMENT_RANGE_THRESHOLD = 5.0 
LIVENESS_AUDIO_RMS_THRESHOLD = 0.005 
LIVENESS_MAX_FRAMES_TO_ANALYZE = 75 
REQUIRE_AUDIO_FOR_LIVENESS = False 

mp_face_mesh_solution = None
face_mesh_detector = None
if MEDIAPIPE_AVAILABLE:
    # ... (кодът за зареждане на MediaPipe остава същият) ...
    model_file_to_check = os.path.join(os.path.dirname(mp.__file__), 'modules', 'face_landmark', 'face_landmark_front_cpu.binarypb')
    if os.path.exists(model_file_to_check):
        try:
            with open(model_file_to_check, 'rb') as f_model_check: f_model_check.read(16)
            mp_face_mesh_solution = mp.solutions.face_mesh
            face_mesh_detector = mp_face_mesh_solution.FaceMesh(
                static_image_mode=False, max_num_faces=1,
                min_detection_confidence=0.5, min_tracking_confidence=0.5)
            logger.info("MediaPipe Face Mesh detector loaded successfully.")
        except Exception as e_mp_init:
            logger.error(f"Грешка при инициализация на MediaPipe FaceMesh: {e_mp_init}", exc_info=True)
            face_mesh_detector = None 
    else:
        logger.error(f"MediaPipe модел файл НЕ Е НАМЕРЕН: {model_file_to_check}")
        face_mesh_detector = None 
else:
    logger.warning("MediaPipe не е налична. Liveness detection features will be disabled.")

try:
    if os.path.exists(DUMMY_IMAGE_PATH): DeepFace.extract_faces(DUMMY_IMAGE_PATH, detector_backend=DETECTOR_BACKEND, enforce_detection=False)
    logger.info(f"DeepFace model '{MODEL_NAME}' and detector '{DETECTOR_BACKEND}' pre-loaded/checked.")
except Exception as e: logger.error(f"Error pre-loading DeepFace: {e}", exc_info=True)


def calculate_ear(eye_landmarks_pixels):
    # ... (кодът остава същият) ...
    try:
        A = dist.euclidean(eye_landmarks_pixels[1], eye_landmarks_pixels[5])
        B = dist.euclidean(eye_landmarks_pixels[2], eye_landmarks_pixels[4])
        C = dist.euclidean(eye_landmarks_pixels[0], eye_landmarks_pixels[3])
        if C < 1e-7: return 0.35 
        ear = (A + B) / (2.0 * C)
        return ear
    except Exception as e_ear_calc: 
        logger.debug(f"Грешка при изчисляване на EAR: {e_ear_calc}")
        return 0.35 

LEFT_EYE_INDICES_FOR_EAR = [33, 160, 158, 133, 153, 144] 
RIGHT_EYE_INDICES_FOR_EAR = [263, 387, 385, 362, 380, 373] 

def check_audio_presence(video_path, threshold=LIVENESS_AUDIO_RMS_THRESHOLD, duration_sec=3):
    # ... (кодът остава същият, с корекцията за ffmpeg_params) ...
    if not MOVIEPY_AVAILABLE:
        logger.warning("MoviePy не е налична, аудио проверката се пропуска.")
        return False 
    try:
        logger.info(f"Анализ на аудио от: {video_path}")
        with VideoFileClip(video_path, audio=True, verbose=False) as clip: 
            if clip.audio is None: logger.warning(f"Не е намерено аудио в клипа: {video_path}"); return False
            actual_duration = clip.duration
            target_fps = clip.audio.fps if clip.audio.fps else 44100
            if actual_duration is None or actual_duration == 0:
                audio_data = clip.audio.to_soundarray(fps=target_fps, nbytes=2, buffersize=2000)
            else:
                audio_segment = clip.audio.subclip(0, min(duration_sec, actual_duration))
                if audio_segment is None or audio_segment.fps is None: logger.warning(f"Невалиден аудио сегмент: {video_path}"); return False
                audio_data = audio_segment.to_soundarray(fps=target_fps, nbytes=2, buffersize=2000) 
            if audio_data.ndim > 1: audio_data = audio_data.mean(axis=1)
            if audio_data.size == 0: logger.warning(f"Аудио данните са празни: {video_path}"); return False
            rms = np.sqrt(np.mean(np.square(audio_data))) 
            logger.info(f"Аудио RMS: {rms:.4f} (Праг: {threshold})")
            return rms > threshold
    except Exception as e_audio:
        logger.error(f"Грешка при аудио анализ за {video_path} (MoviePy/ffmpeg): {e_audio}", exc_info=False)
        logger.warning("Аудио проверката се провали. За целите на liveness, това ще се счита за липса на аудио (връща False).")
        return False

def resize_image(image_path: str, max_dim: int = 640, quality: int = 85) -> bool:
    # ... (кодът остава същият) ...
    try:
        img = cv2.imread(image_path)
        if img is None: return False
        h, w = img.shape[:2]
        if max(h, w) <= max_dim: resized_img = img
        else:
            scale = max_dim / max(h, w)
            new_w, new_h = int(w * scale), int(h * scale)
            try: resized_img = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_AREA)
            except Exception: return False
        if not cv2.imwrite(image_path, resized_img, [int(cv2.IMWRITE_JPEG_QUALITY), quality]): return False
        return True
    except Exception: return False

def sanitize_foldername(name_part: Optional[str]) -> str:
    if name_part is None: return "" 
    processed_name = str(name_part).replace(" ", "_").strip()
    return "".join(c for c in processed_name if c.isalnum() or c in ['_', '-'])

@app.get("/")
def read_root(): return {"message": "Verification server running"}

@app.post("/verify")
async def verify_identity(
    user_identifier: str = Form(...), 
    firstName: Optional[str] = Form(None), 
    lastName: Optional[str] = Form(None),  
    idCardFront: UploadFile = File(...), 
    idCardBack: UploadFile = File(...), 
    selfie: UploadFile = File(...),
    video_front_id: Optional[UploadFile] = File(None), 
    video_back_id: Optional[UploadFile] = File(None), 
    video_selfie: Optional[UploadFile] = File(None)
):
    logger.info(f"Получена заявка за верификация. user_identifier: '{user_identifier}', firstName: '{firstName}', lastName: '{lastName}'")
    
    if not all([idCardFront, idCardFront.filename, idCardBack, idCardBack.filename, selfie, selfie.filename]):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"status": "error", "code": "MISSING_IMAGE_FILES", "message": "Липсват една или повече от необходимите СНИМКИ или имената на файловете им."})

    timestamp = int(time.time())
    
    with TemporaryDirectory(prefix="verification_temp_") as tmp_dir:
        logger.info(f"Временна директория за всички файлове: {tmp_dir}")
        
        temp_image_paths = {}
        temp_video_paths = {}

        # --- ЗАПИС НА СНИМКИ И ВИДЕА ВЪВ ВРЕМЕННА ДИРЕКТОРИЯ ---
        all_files_to_process = {
            "idCardFront": idCardFront, "idCardBack": idCardBack, "selfie": selfie,
            "video_front_id": video_front_id, "video_back_id": video_back_id, "video_selfie": video_selfie
        }
        allowed_image_extensions = {".jpg", ".jpeg", ".png"}
        # Можете да добавите и проверка за видео разширения, ако е нужно

        for key, uploaded_file in all_files_to_process.items():
            if uploaded_file and uploaded_file.filename:
                file_ext = os.path.splitext(uploaded_file.filename)[1].lower()
                is_image = key.startswith("idCard") or key == "selfie"
                
                if is_image and file_ext not in allowed_image_extensions:
                    return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"status": "error", "code": "INVALID_IMAGE_FILE_TYPE", "field": key, "message": f"Невалиден тип файл за снимка {key}."})
                
                safe_filename = f"{key}_{timestamp}{file_ext}"
                temp_file_path = os.path.join(tmp_dir, safe_filename)
                
                if is_image:
                    temp_image_paths[key] = temp_file_path
                else: # е видео
                    temp_video_paths[key] = temp_file_path
                
                try:
                    with open(temp_file_path, "wb") as f_out: shutil.copyfileobj(uploaded_file.file, f_out)
                    logger.info(f"Файл '{key}' запазен временно в: {temp_file_path}")
                except Exception as e_save:
                    raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"status": "error", "code": "FILE_SAVE_ERROR", "message": f"Грешка при запис на файл {key}."})
                finally:
                    if hasattr(uploaded_file, 'close') and callable(uploaded_file.close): await uploaded_file.close()
            elif uploaded_file:
                 logger.warning(f"Файлът за '{key}' няма име и ще бъде пропуснат.")
                 if hasattr(uploaded_file, 'close') and callable(uploaded_file.close): await uploaded_file.close()

        # Преоразмеряване на снимките
        if temp_image_paths.get("idCardFront") and not resize_image(temp_image_paths["idCardFront"]):
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"status": "error", "code": "IMAGE_PROCESSING_ERROR", "field": "idCardFront", "message": "Грешка при обработка на снимката на ЛК (предна)." })
        if temp_image_paths.get("selfie") and not resize_image(temp_image_paths["selfie"]):
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"status": "error", "code": "IMAGE_PROCESSING_ERROR", "field": "selfie", "message": "Грешка при обработка на селфи снимката."})
        
        # --- LIVENESS ДЕТЕКЦИЯ ---
        liveness_check_passed = False 
        # ... (останалата част от liveness логиката, както беше) ...
        blinks_counted = 0; head_moved_significantly = False; audio_present_in_selfie_video = False
        if temp_video_paths.get("video_selfie") and face_mesh_detector: 
            video_path_selfie_for_liveness = temp_video_paths['video_selfie']
            # ... (пълната liveness логика от предишната версия) ...
            logger.info(f"Извършване на Liveness детекция върху: {video_path_selfie_for_liveness}")
            cap = cv2.VideoCapture(video_path_selfie_for_liveness)
            if not cap.isOpened(): logger.error(f"Не може да се отвори видео файл за liveness: {video_path_selfie_for_liveness}")
            else:
                blink_on_consecutive_frames = 0; nose_positions = []; frame_idx = 0
                while cap.isOpened() and frame_idx < LIVENESS_MAX_FRAMES_TO_ANALYZE:
                    ret, frame = cap.read();
                    if not ret: break
                    frame_for_mp = frame; rgb_frame = cv2.cvtColor(frame_for_mp, cv2.COLOR_BGR2RGB)
                    rgb_frame.flags.writeable = False; results = face_mesh_detector.process(rgb_frame); rgb_frame.flags.writeable = True
                    if results.multi_face_landmarks:
                        for face_landmarks in results.multi_face_landmarks: 
                            try:
                                frame_h, frame_w = frame_for_mp.shape[:2]
                                left_eye_lm_pixels = np.array([(face_landmarks.landmark[i].x * frame_w, face_landmarks.landmark[i].y * frame_h) for i in LEFT_EYE_INDICES_FOR_EAR], dtype=np.float32)
                                right_eye_lm_pixels = np.array([(face_landmarks.landmark[i].x * frame_w, face_landmarks.landmark[i].y * frame_h) for i in RIGHT_EYE_INDICES_FOR_EAR], dtype=np.float32)
                                left_ear = calculate_ear(left_eye_lm_pixels); right_ear = calculate_ear(right_eye_lm_pixels)
                                avg_ear = (left_ear + right_ear) / 2.0
                                logger.debug(f"Кадър {frame_idx}: Ляво EAR={left_ear:.3f}, Дясно EAR={right_ear:.3f}, Средно EAR={avg_ear:.3f} (Праг: {LIVENESS_EAR_THRESHOLD})")
                                if avg_ear < LIVENESS_EAR_THRESHOLD: blink_on_consecutive_frames += 1
                                else:
                                    if LIVENESS_EAR_CONSEC_FRAMES_MIN <= blink_on_consecutive_frames <= LIVENESS_EAR_CONSEC_FRAMES_MAX:
                                        blinks_counted += 1; logger.info(f"Засечено мигане! (Кадър: {frame_idx}, Общо: {blinks_counted})")
                                    blink_on_consecutive_frames = 0 
                            except IndexError: logger.warning(f"IndexError за EAR на кадър {frame_idx}.")
                            except Exception as e_blink: logger.warning(f"Грешка при EAR на кадър {frame_idx}: {e_blink}")
                            nose_tip = (face_landmarks.landmark[1].x * frame_w, face_landmarks.landmark[1].y * frame_h)
                            nose_positions.append(nose_tip); break 
                    frame_idx += 1
                cap.release()
                if LIVENESS_EAR_CONSEC_FRAMES_MIN <= blink_on_consecutive_frames <= LIVENESS_EAR_CONSEC_FRAMES_MAX:
                    blinks_counted += 1; logger.info(f"Засечено мигане (край на цикъла)! (Общо: {blinks_counted})")
                if len(nose_positions) > 10: 
                    nose_x_coords = np.array([p[0] for p in nose_positions]); nose_y_coords = np.array([p[1] for p in nose_positions])
                    x_range = np.ptp(nose_x_coords) if nose_x_coords.size > 0 else 0
                    y_range = np.ptp(nose_y_coords) if nose_y_coords.size > 0 else 0
                    logger.debug(f"Движение на носа: X обхват={x_range:.2f}, Y обхват={y_range:.2f}")
                    if x_range > LIVENESS_MOVEMENT_RANGE_THRESHOLD or y_range > LIVENESS_MOVEMENT_RANGE_THRESHOLD: head_moved_significantly = True
                audio_present_in_selfie_video = check_audio_presence(video_path_selfie_for_liveness)
            if blinks_counted >= LIVENESS_MIN_BLINKS_REQUIRED and head_moved_significantly and (audio_present_in_selfie_video or not REQUIRE_AUDIO_FOR_LIVENESS):
                liveness_check_passed = True
            logger.info(f"Liveness Резултати: Мигания={blinks_counted}, Движение на главата={head_moved_significantly}, Аудио засечено={audio_present_in_selfie_video} => Liveness Преминал={liveness_check_passed}")
        
        elif not face_mesh_detector and MEDIAPIPE_AVAILABLE: liveness_check_passed = True; logger.warning("MediaPipe не е зареден. Liveness пропуснат (симулиран успех).")
        elif not MEDIAPIPE_AVAILABLE: liveness_check_passed = True; logger.warning("MediaPipe не е налична. Liveness пропуснат (симулиран успех).")
        else: liveness_check_passed = True; logger.warning("Селфи видео не е предоставено. Liveness пропуснат (симулиран успех).")

        if not liveness_check_passed:
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"status": "error", "code": "LIVENESS_FAILED", "message": "Проверката за реално присъствие е неуспешна."})
        
        logger.info("Liveness проверката е успешна. Продължаване с DeepFace.")
        
        if not temp_image_paths.get("idCardFront") or not temp_image_paths.get("selfie"):
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"status": "error", "code": "INTERNAL_ERROR_MISSING_IMAGE_PATHS", "message": "Вътрешна грешка: липсват пътища до временни снимки."})

        try:
            result = DeepFace.verify(
                img1_path=temp_image_paths["idCardFront"], 
                img2_path=temp_image_paths["selfie"],      
                model_name=MODEL_NAME, detector_backend=DETECTOR_BACKEND,
                distance_metric=DISTANCE_METRIC, enforce_detection=True, align=True
            )
            model_threshold = DeepFace.verification.find_threshold(MODEL_NAME, DISTANCE_METRIC)
            calculated_distance = result.get("distance", 999); is_verified = result.get("verified", False) 
            logger.info(f"DeepFace Детайли: Разстояние={calculated_distance:.4f}, Праг={model_threshold:.4f}, Резултат={is_verified}")

            if is_verified: 
                logger.info("Верификацията е успешна. Копиране на файловете на постоянно място...")
                
                # Генериране на име на папка, базирано на имената и ID-то
                folder_name_parts = []
                if firstName: folder_name_parts.append(sanitize_foldername(firstName))
                if lastName: folder_name_parts.append(sanitize_foldername(lastName))
                folder_name_parts.append(str(user_identifier)) 
                
                user_specific_folder_name = "_".join(filter(None, folder_name_parts))
                if not user_specific_folder_name: 
                    user_specific_folder_name = f"user_{user_identifier}" # Fallback

                permanent_user_photo_dir = os.path.join(PERMANENT_BASE_USER_FILES_DIR, user_specific_folder_name, PHOTO_SUBDIR_NAME)
                permanent_user_video_dir = os.path.join(PERMANENT_BASE_USER_FILES_DIR, user_specific_folder_name, VIDEO_SUBDIR_NAME)
                os.makedirs(permanent_user_photo_dir, exist_ok=True)
                os.makedirs(permanent_user_video_dir, exist_ok=True)

                final_saved_paths_for_db = {"photos": {}, "videos": {}}

                for key, temp_path in temp_image_paths.items():
                    if os.path.exists(temp_path):
                        permanent_filename = os.path.basename(temp_path) 
                        permanent_path = os.path.join(permanent_user_photo_dir, permanent_filename)
                        shutil.copy2(temp_path, permanent_path)
                        # Запазваме ОТНОСИТЕЛНИЯ път за базата данни, спрямо PERMANENT_BASE_USER_FILES_DIR
                        final_saved_paths_for_db["photos"][key] = os.path.join(user_specific_folder_name, PHOTO_SUBDIR_NAME, permanent_filename).replace("\\", "/")
                        logger.info(f"Снимка '{key}' копирана в: {permanent_path}")
                
                for key, temp_path in temp_video_paths.items():
                     if os.path.exists(temp_path):
                        permanent_filename = os.path.basename(temp_path)
                        permanent_path = os.path.join(permanent_user_video_dir, permanent_filename)
                        shutil.copy2(temp_path, permanent_path)
                        final_saved_paths_for_db["videos"][key] = os.path.join(user_specific_folder_name, VIDEO_SUBDIR_NAME, permanent_filename).replace("\\", "/")
                        logger.info(f"Видео '{key}' копирано в: {permanent_path}")
                
                logger.info(f"Пътищата до файловете за user '{user_specific_folder_name}' (за БД): {final_saved_paths_for_db}")
                
                # Връщаме пътищата към Next.js проксито, за да може то да ги запише в Prisma
                return JSONResponse(
                    status_code=status.HTTP_200_OK, 
                    content={
                        "status": "success", 
                        "verified": True, 
                        "distance": round(calculated_distance, 4),
                        "threshold": round(model_threshold, 4), 
                        "model": MODEL_NAME, 
                        "detector": DETECTOR_BACKEND,
                        "saved_file_paths": final_saved_paths_for_db # НОВО: Връщаме пътищата
                    }
                )
            else: 
                # Ако DeepFace верификацията е неуспешна, файловете НЕ се копират на постоянно място
                logger.warning("DeepFace верификацията е неуспешна. Файловете няма да бъдат запазени постоянно.")
                return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"status": "error", "code": "VERIFICATION_FAILED", "message": "Лицата не съвпадат или не са открити."})
        
        except ValueError as ve: 
            logger.warning(f"Грешка при детекция (DeepFace): {str(ve)}")
            return JSONResponse(status_code=status.HTTP_400_BAD_REQUEST, content={"status": "error", "code": "VERIFICATION_FAILED", "message": "Не е открито лице на някоя от снимките или лицата не съвпадат."})
        except Exception as e_deepface: 
            logger.error(f"Неочаквана грешка (DeepFace): {e_deepface}", exc_info=True)
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail={"status": "error", "code": "VERIFICATION_ERROR", "message": "Сървърна грешка при сравняване на лица."})
    
if __name__ == "__main__":
    logger.info("Starting Uvicorn server for local development...")
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
