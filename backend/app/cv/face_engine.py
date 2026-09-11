import cv2
import numpy as np
import base64
import os
import logging
from typing import List, Dict, Any, Tuple, Optional
from app.core.config import settings

logger = logging.getLogger("smart_attendance.face_engine")

class FaceQualityResult:
    def __init__(self, is_valid: bool, quality_score: float, sharpness: float, brightness: float, reason: str = ""):
        self.is_valid = is_valid
        self.quality_score = quality_score
        self.sharpness = sharpness
        self.brightness = brightness
        self.reason = reason

    def to_dict(self):
        return {
            "is_valid": self.is_valid,
            "quality_score": round(self.quality_score, 2),
            "sharpness": round(self.sharpness, 2),
            "brightness": round(self.brightness, 2),
            "reason": self.reason
        }

class FaceEngine:
    _instance = None

    def __new__(cls, *args, **kwargs):
        if not cls._instance:
            cls._instance = super(FaceEngine, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        base_dir = os.path.dirname(__file__)
        self.yunet_model_path = os.path.join(base_dir, "models", "face_detection_yunet_2023mar.onnx")
        self.sface_model_path = os.path.join(base_dir, "models", "face_recognition_sface_2021dec.onnx")

        if not os.path.exists(self.yunet_model_path) or not os.path.exists(self.sface_model_path):
            logger.error("Face model weights not found at expected paths.")
            self.detector = None
            self.recognizer = None
            return

        # Initialize YuNet detector
        self.detector = cv2.FaceDetectorYN.create(
            self.yunet_model_path,
            "",
            (320, 320),
            score_threshold=0.6,
            nms_threshold=0.3,
            top_k=5000
        )
        # Initialize SFace recognizer
        self.recognizer = cv2.FaceRecognizerSF.create(self.sface_model_path, "")
        logger.info("FaceEngine initialized successfully with YuNet and SFace models.")

    @staticmethod
    def decode_image(image_input: str | bytes) -> np.ndarray:
        """Decodes base64 string or raw bytes into OpenCV BGR numpy array."""
        try:
            if isinstance(image_input, str):
                if "," in image_input:
                    # Strip data:image/...;base64, prefix
                    image_input = image_input.split(",", 1)[1]
                img_bytes = base64.b64decode(image_input)
            else:
                img_bytes = image_input

            nparr = np.frombuffer(img_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise ValueError("Failed to decode image buffer.")
            return img
        except Exception as e:
            raise ValueError(f"Image decode error: {str(e)}")

    def detect_faces(self, image: np.ndarray) -> List[Dict[str, Any]]:
        """Detects faces in frame and returns bounding boxes and landmarks."""
        if self.detector is None:
            raise RuntimeError("Face detector is not initialized.")

        h, w, _ = image.shape
        self.detector.setInputSize((w, h))
        _, faces = self.detector.detect(image)

        results = []
        if faces is not None:
            for face in faces:
                # YuNet format: [x, y, w, h, x_re, y_re, x_le, y_le, x_nt, y_nt, x_rcm, y_rcm, x_lcm, y_lcm, score]
                box = [int(face[0]), int(face[1]), int(face[2]), int(face[3])]
                score = float(face[-1])
                landmarks = [
                    (float(face[4]), float(face[5])),   # Right eye
                    (float(face[6]), float(face[7])),   # Left eye
                    (float(face[8]), float(face[9])),   # Nose tip
                    (float(face[10]), float(face[11])), # Right mouth corner
                    (float(face[12]), float(face[13]))  # Left mouth corner
                ]
                results.append({
                    "bbox": box,
                    "confidence": score,
                    "landmarks": landmarks,
                    "raw": face
                })
        return results

    def evaluate_face_quality(self, image: np.ndarray, bbox: List[int]) -> FaceQualityResult:
        """Evaluates face image quality based on size, sharpness (Laplacian), and lighting."""
        x, y, w, h = bbox
        img_h, img_w = image.shape[:2]

        # 1. Size check
        if w < settings.FACE_MIN_SIZE or h < settings.FACE_MIN_SIZE:
            return FaceQualityResult(
                is_valid=False,
                quality_score=0.0,
                sharpness=0.0,
                brightness=0.0,
                reason=f"Face is too small ({w}x{h}px). Minimum required is {settings.FACE_MIN_SIZE}x{settings.FACE_MIN_SIZE}px. Please move closer."
            )

        # Crop face safely within image boundaries
        x1, y1 = max(0, x), max(0, y)
        x2, y2 = min(img_w, x + w), min(img_h, y + h)
        face_crop = image[y1:y2, x1:x2]

        if face_crop.size == 0:
            return FaceQualityResult(False, 0.0, 0.0, 0.0, "Face region outside frame boundaries.")

        # 2. Sharpness / Blur check via Laplacian variance
        gray = cv2.cvtColor(face_crop, cv2.COLOR_BGR2GRAY)
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())

        if laplacian_var < settings.FACE_LAPLACIAN_VAR_THRESHOLD:
            return FaceQualityResult(
                is_valid=False,
                quality_score=min(100.0, laplacian_var),
                sharpness=laplacian_var,
                brightness=float(np.mean(gray)),
                reason=f"Face is too blurry (sharpness score: {laplacian_var:.1f}, required: {settings.FACE_LAPLACIAN_VAR_THRESHOLD:.1f}). Hold steady."
            )

        # 3. Lighting / Brightness check
        mean_brightness = float(np.mean(gray))
        if mean_brightness < 40.0:
            return FaceQualityResult(
                is_valid=False,
                quality_score=laplacian_var,
                sharpness=laplacian_var,
                brightness=mean_brightness,
                reason=f"Lighting is too dark (brightness: {mean_brightness:.1f}/255). Please move to a brighter environment."
            )
        if mean_brightness > 220.0:
            return FaceQualityResult(
                is_valid=False,
                quality_score=laplacian_var,
                sharpness=laplacian_var,
                brightness=mean_brightness,
                reason=f"Lighting is overexposed (brightness: {mean_brightness:.1f}/255). Avoid direct harsh glare."
            )

        # Normalized quality score combining sharpness and illumination balance
        quality_score = min(100.0, laplacian_var * 0.7 + (1.0 - abs(mean_brightness - 128.0) / 128.0) * 30.0)

        return FaceQualityResult(
            is_valid=True,
            quality_score=quality_score,
            sharpness=laplacian_var,
            brightness=mean_brightness,
            reason="Good face quality"
        )

    def extract_embedding(self, image: np.ndarray, face_raw: np.ndarray) -> np.ndarray:
        """Aligns face and extracts 128-d cosine-normalized embedding vector."""
        if self.recognizer is None:
            raise RuntimeError("Face recognizer is not initialized.")

        aligned_face = self.recognizer.alignCrop(image, face_raw)
        feature = self.recognizer.feature(aligned_face)
        # Normalize vector to unit length for fast cosine similarity
        norm = np.linalg.norm(feature)
        if norm > 1e-6:
            feature = feature / norm
        return feature.flatten().astype(np.float32)

    def compute_similarity(self, embedding_a: np.ndarray, embedding_b: np.ndarray) -> float:
        """Computes cosine similarity between two 128-d normalized embeddings (-1.0 to 1.0)."""
        dot_product = float(np.dot(embedding_a, embedding_b))
        return float(np.clip(dot_product, -1.0, 1.0))

face_engine = FaceEngine()
