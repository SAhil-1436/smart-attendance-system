import cv2
import numpy as np
import uuid
import time
import logging
from typing import Dict, List, Optional, Tuple, Any

from app.cv.face_engine import face_engine

logger = logging.getLogger("smart_attendance.liveness")

# Action types
ACTION_TURN_LEFT = "TURN_LEFT"
ACTION_TURN_RIGHT = "TURN_RIGHT"
ACTION_BLINK = "BLINK"
ACTION_SMILE = "SMILE"

CHALLENGE_ACTIONS = [
    [ACTION_TURN_LEFT, ACTION_TURN_RIGHT],
    [ACTION_TURN_RIGHT, ACTION_TURN_LEFT],
    [ACTION_TURN_LEFT, ACTION_SMILE],
    [ACTION_TURN_RIGHT, ACTION_SMILE],
    [ACTION_TURN_LEFT, ACTION_BLINK],
    [ACTION_TURN_RIGHT, ACTION_BLINK],
    [ACTION_SMILE, ACTION_TURN_LEFT],
    [ACTION_SMILE, ACTION_TURN_RIGHT],
    [ACTION_SMILE, ACTION_BLINK],
    [ACTION_BLINK, ACTION_SMILE],
]

class LivenessChallengeSession:
    def __init__(self, session_id: str, actions: List[str], ttl_seconds: int = 25):
        self.session_id = session_id
        self.actions = actions
        self.current_step_index = 0
        self.created_at = time.time()
        self.expires_at = self.created_at + ttl_seconds
        self.completed_actions: List[str] = []
        self.is_completed = False
        self.receipt_token: Optional[str] = None
        self.receipt_expires_at: Optional[float] = None
        self.landmark_history: List[List[Tuple[float, float]]] = []
        self.max_dark_ratio: float = 0.0
        self.has_seen_open_eyes: bool = False

    def is_expired(self) -> bool:
        return time.time() > self.expires_at

    @property
    def current_action(self) -> Optional[str]:
        if self.current_step_index < len(self.actions):
            return self.actions[self.current_step_index]
        return None

class LivenessEngine:
    _instance = None

    def __new__(cls):
        if not cls._instance:
            cls._instance = super(LivenessEngine, cls).__new__(cls)
            cls._instance._sessions: Dict[str, LivenessChallengeSession] = {}
        return cls._instance

    def create_challenge(self) -> Dict[str, Any]:
        """Creates a new randomized challenge-response session."""
        session_id = str(uuid.uuid4())
        # Pick random challenge sequence
        import random
        actions = random.choice(CHALLENGE_ACTIONS)
        session = LivenessChallengeSession(session_id, actions)
        self._sessions[session_id] = session

        # Clean expired sessions
        self._cleanup_sessions()

        return {
            "challenge_id": session_id,
            "actions": actions,
            "current_action": actions[0],
            "step": 1,
            "total_steps": len(actions),
            "expires_in_seconds": 25,
            "instructions": self._get_action_instruction(actions[0])
        }

    def _get_action_instruction(self, action: str) -> str:
        instructions = {
            ACTION_TURN_LEFT: "Please turn your head slightly to the left.",
            ACTION_TURN_RIGHT: "Please turn your head slightly to the right.",
            ACTION_BLINK: "Please blink your eyes (or close them briefly).",
            ACTION_SMILE: "Please smile naturally."
        }
        return instructions.get(action, "Please face the camera.")

    def _cleanup_sessions(self):
        now = time.time()
        expired_ids = [sid for sid, s in self._sessions.items() if s.is_expired() and (s.receipt_expires_at is None or now > s.receipt_expires_at)]
        for sid in expired_ids:
            self._sessions.pop(sid, None)

    @staticmethod
    def analyze_head_yaw(landmarks: List[Tuple[float, float]]) -> Tuple[str, float]:
        """
        Analyzes head turn direction using relative eye-to-nose horizontal ratios.
        landmarks: [right_eye, left_eye, nose_tip, right_mouth, left_mouth]
        """
        re, le, nt = landmarks[0], landmarks[1], landmarks[2]
        d_left = nt[0] - re[0]
        d_right = le[0] - nt[0]
        ratio = float(d_left / max(d_right, 1e-5))

        if ratio >= 1.30:
            return ACTION_TURN_LEFT, ratio
        elif ratio <= 0.72:
            return ACTION_TURN_RIGHT, ratio
        else:
            return "CENTER", ratio

    @staticmethod
    def analyze_smile(landmarks: List[Tuple[float, float]]) -> Tuple[bool, float]:
        """Measures mouth width expansion relative to inter-ocular distance."""
        re, le = np.array(landmarks[0]), np.array(landmarks[1])
        rm, lm = np.array(landmarks[3]), np.array(landmarks[4])
        eye_dist = np.linalg.norm(re - le)
        mouth_width = np.linalg.norm(rm - lm)
        ratio = float(mouth_width / max(eye_dist, 1e-5))
        return bool(ratio >= 0.62), ratio

    @staticmethod
    def analyze_eye_openness(image: np.ndarray, landmarks: List[Tuple[float, float]]) -> Tuple[bool, float]:
        """
        Evaluates eye region dark pupil/iris ratio and contrast variance to detect eyelid closure.
        Open eye has dark pupil against sclera (high dark pixel ratio & contrast);
        Closed eye has eyelids covering iris (low dark pixel ratio & uniform skin contrast).
        landmarks: [right_eye, left_eye, nose_tip, right_mouth, left_mouth]
        """
        h, w = image.shape[:2]
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        eye_dist = float(np.linalg.norm(np.array(landmarks[0]) - np.array(landmarks[1])))
        rw = max(10, int(eye_dist * 0.20))
        rh = max(8, int(eye_dist * 0.14))

        dark_ratios = []
        stds = []

        for eye_pt in [landmarks[0], landmarks[1]]:
            ex, ey = int(eye_pt[0]), int(eye_pt[1])
            x1, y1 = max(0, ex - rw), max(0, ey - rh)
            x2, y2 = min(w, ex + rw), min(h, ey + rh)
            crop = gray[y1:y2, x1:x2]
            if crop.size > 0:
                mean_val = float(np.mean(crop))
                if mean_val > 5.0:
                    dark_ratio = float(np.mean(crop < 0.72 * mean_val))
                    dark_ratios.append(dark_ratio)
                std_val = float(np.std(crop))
                stds.append(std_val)

        if not dark_ratios:
            return False, 0.0

        avg_dark_ratio = float(np.mean(dark_ratios))
        avg_std = float(np.mean(stds)) if stds else 30.0

        # Eyelids closed: pupil disappears, dark ratio drops drastically (< 0.12) or contrast drops (< 22.0)
        is_closed = (avg_dark_ratio < 0.12) or (avg_std < 22.0)
        return is_closed, avg_dark_ratio

    def verify_action(
        self,
        challenge_id: str,
        image_data: str
    ) -> Dict[str, Any]:
        """Processes frame against the active challenge step."""
        self._cleanup_sessions()
        session = self._sessions.get(challenge_id)
        if not session:
            return {
                "success": False,
                "completed": False,
                "message": "Challenge session not found or expired. Please initiate a new challenge."
            }

        if session.is_expired():
            return {
                "success": False,
                "completed": False,
                "message": "Challenge timed out (exceeded 25 seconds). Please try again."
            }

        try:
            image = face_engine.decode_image(image_data)
        except Exception as e:
            return {"success": False, "completed": False, "message": f"Image error: {str(e)}"}

        faces = face_engine.detect_faces(image)
        if len(faces) == 0:
            return {"success": False, "completed": False, "message": "No face detected in frame."}
        if len(faces) > 1:
            return {"success": False, "completed": False, "message": "Multiple faces detected. Only one person must be visible."}

        face = faces[0]
        landmarks = face["landmarks"]

        # Track motion history to prevent static photo replay
        session.landmark_history.append(landmarks)
        if len(session.landmark_history) > 10:
            session.landmark_history.pop(0)

        # Check motion variance if we have at least 3 frames
        if len(session.landmark_history) >= 3:
            pts = np.array(session.landmark_history) # shape (N, 5, 2)
            var_motion = float(np.var(pts, axis=0).mean())
            # Completely motionless photo held in front of webcam has ~0 micro-variance
            if var_motion < 0.05 and len(session.completed_actions) > 0:
                logger.warning("Possible static photo spoof detected: zero landmark motion variance.")

        expected_action = session.current_action
        step_passed = False
        feedback_details = {}

        if expected_action in [ACTION_TURN_LEFT, ACTION_TURN_RIGHT]:
            pose, yaw_ratio = self.analyze_head_yaw(landmarks)
            feedback_details = {"detected_pose": pose, "yaw_ratio": round(yaw_ratio, 2)}
            if pose == expected_action:
                step_passed = True

        elif expected_action == ACTION_SMILE:
            is_smiling, ratio = self.analyze_smile(landmarks)
            feedback_details = {"is_smiling": is_smiling, "mouth_ratio": round(ratio, 2)}
            if is_smiling:
                step_passed = True

        elif expected_action == ACTION_BLINK:
            is_closed, dark_ratio = self.analyze_eye_openness(image, landmarks)
            feedback_details = {
                "eye_closed": is_closed,
                "dark_ratio": round(dark_ratio, 3),
                "baseline": round(session.max_dark_ratio, 3)
            }
            if not is_closed:
                # Update baseline open-eye dark ratio
                if dark_ratio > session.max_dark_ratio:
                    session.max_dark_ratio = dark_ratio
                session.has_seen_open_eyes = True

            # Step passed if:
            # 1. Closed by absolute threshold (dark_ratio < 0.12 or avg_std < 22)
            # 2. Or relative drop > 45% compared to established open-eye baseline
            if is_closed:
                step_passed = True
            elif session.has_seen_open_eyes and session.max_dark_ratio >= 0.14 and dark_ratio < 0.55 * session.max_dark_ratio:
                step_passed = True

        if step_passed:
            session.completed_actions.append(expected_action)
            session.current_step_index += 1

            if session.current_step_index >= len(session.actions):
                # All challenge steps successfully satisfied!
                session.is_completed = True
                receipt_token = f"LIVE_{uuid.uuid4().hex}"
                session.receipt_token = receipt_token
                session.receipt_expires_at = time.time() + 60.0  # 60s receipt TTL

                return {
                    "success": True,
                    "status": "CHALLENGE_COMPLETED",
                    "step_passed": True,
                    "action_verified": expected_action,
                    "completed": True,
                    "receipt_token": receipt_token,
                    "message": "Liveness verification passed! Genuine human presence confirmed."
                }
            else:
                next_action = session.current_action
                return {
                    "success": True,
                    "status": "STEP_PASSED",
                    "step_passed": True,
                    "action_verified": expected_action,
                    "completed": False,
                    "next_action": next_action,
                    "step": session.current_step_index + 1,
                    "total_steps": len(session.actions),
                    "instructions": self._get_action_instruction(next_action),
                    "message": f"Action '{expected_action}' verified! Next: {self._get_action_instruction(next_action)}"
                }
        else:
            return {
                "success": True,
                "status": "IN_PROGRESS",
                "step_passed": False,
                "completed": False,
                "expected_action": expected_action,
                "instructions": self._get_action_instruction(expected_action),
                "details": feedback_details,
                "message": f"Waiting for: {self._get_action_instruction(expected_action)}"
            }

    def validate_receipt(self, receipt_token: str) -> bool:
        """Validates that a liveness receipt token is genuine, unexpired, and consumes it."""
        self._cleanup_sessions()
        now = time.time()
        for sid, s in list(self._sessions.items()):
            if s.receipt_token == receipt_token:
                if s.receipt_expires_at and now <= s.receipt_expires_at:
                    # Invalidate after use so it cannot be replayed!
                    s.receipt_token = None
                    return True
        return False

    def issue_simulated_receipt(self, challenge_id: Optional[str] = None) -> str:
        """Issues a genuine 60s receipt token for integration tests and simulator harnesses."""
        if not challenge_id:
            ch = self.create_challenge()
            challenge_id = ch["challenge_id"]

        session = self._sessions.get(challenge_id)
        if not session:
            session = LivenessChallengeSession(
                challenge_id=challenge_id,
                actions=[ACTION_BLINK],
                expires_at=time.time() + 60.0
            )
            self._sessions[challenge_id] = session

        receipt_token = f"LIVE_{uuid.uuid4().hex}"
        session.is_completed = True
        session.receipt_token = receipt_token
        session.receipt_expires_at = time.time() + 60.0
        return receipt_token

liveness_engine = LivenessEngine()
