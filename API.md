# REST API Specification & Reference

The Smart Attendance Management System exposes a RESTful API with JSON payloads, standard HTTP status codes, and Bearer JWT authentication.

- **Base URL**: `http://127.0.0.1:8000`
- **API Version Prefix**: `/api/v1`
- **Interactive OpenAPI Documentation**: `http://127.0.0.1:8000/api/v1/docs`
- **ReDoc Specification**: `http://127.0.0.1:8000/api/v1/redoc`

---

## Authentication & Headers

Protected endpoints require the standard `Authorization` header with a valid JSON Web Token:
```http
Authorization: Bearer <jwt_access_token>
```

### Standard Response Envelopes
#### Error Envelope
```json
{
  "detail": "Descriptive error message or validation breakdown"
}
```

---

## 1. Authentication & RBAC Endpoints

### `POST /api/v1/auth/login`
Authenticates user credentials using Argon2id password verification and returns an access token.
- **Access**: Public (Subject to sliding-window rate limit: 10 req / min)
- **Request Body**:
```json
{
  "username": "admin",
  "password": "Admin@123"
}
```
- **Response (200 OK)**:
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@college.edu",
    "full_name": "System Administrator",
    "role": "ADMIN",
    "is_active": true
  }
}
```

### `GET /api/v1/auth/me`
Retrieves the profile of the currently authenticated user.
- **Access**: Authenticated (ADMIN or FACULTY)

### `POST /api/v1/auth/logout`
Terminates the session and logs an audit trail event.
- **Access**: Authenticated

---

## 2. Student Directory & Biometrics

### `GET /api/v1/students`
Retrieves a paginated list of students with filtering options.
- **Access**: Authenticated (ADMIN or FACULTY)
- **Query Parameters**:
  - `page` (integer, default: 1)
  - `size` (integer, default: 15)
  - `search` (string): Filters across name, roll number, student ID, and email
  - `department_id` (integer)
  - `course_id` (integer)
  - `semester` (integer)
  - `section` (string)
  - `face_registered` (boolean): `true` for enrolled faces, `false` for pending

### `POST /api/v1/students`
Provisions a new student record.
- **Access**: ADMIN only
- **Request Body**:
```json
{
  "student_id": "CS2026-088",
  "name": "Jane Cooper",
  "email": "jane.cooper@college.edu",
  "phone": "+1-555-0199",
  "department_id": 1,
  "course_id": 1,
  "semester": 6,
  "section": "A"
}
```

### `POST /api/v1/students/{id}/enroll-faces`
Enrolls 3 webcam face captures for a student. Evaluates Laplacian sharpness, face landmarks, and inter-sample cosine consistency before persisting 128-d embeddings.
- **Access**: ADMIN only
- **Request Body**:
```json
{
  "image_frames": [
    "data:image/jpeg;base64,...(Sample 1)...",
    "data:image/jpeg;base64,...(Sample 2)...",
    "data:image/jpeg;base64,...(Sample 3)..."
  ]
}
```
- **Response (200 OK)**:
```json
{
  "student_id": 42,
  "samples_enrolled": 3,
  "face_registered": true,
  "message": "Biometric face samples enrolled successfully."
}
```

### `DELETE /api/v1/students/{id}/face-embeddings`
Deletes all biometric face embeddings for a student and clears the student from the SIMD in-memory cache.
- **Access**: ADMIN only

---

## 3. Liveness & Anti-Spoofing

### `POST /api/v1/attendance/liveness/challenge`
Generates a new randomized challenge sequence with a 25-second TTL.
- **Access**: Authenticated
- **Response (200 OK)**:
```json
{
  "challenge_id": "chal_9df8a21e4c7b",
  "steps": ["TURN_LEFT", "SMILE"],
  "total_steps": 2,
  "ttl_seconds": 25,
  "instructions": "Turn your head to the left"
}
```

### `POST /api/v1/attendance/liveness/verify-step`
Evaluates a live video frame against the current challenge action. Upon completing all steps, issues a single-use cryptographic receipt token.
- **Access**: Authenticated
- **Request Body**:
```json
{
  "challenge_id": "chal_9df8a21e4c7b",
  "image_data": "data:image/jpeg;base64,..."
}
```
- **Response (Step Passed - 200 OK)**:
```json
{
  "status": "STEP_PASSED",
  "step": 2,
  "message": "Head turn verified! Next: Smile naturally",
  "instructions": "Smile naturally"
}
```
- **Response (Challenge Completed - 200 OK)**:
```json
{
  "status": "CHALLENGE_COMPLETED",
  "receipt_token": "rcpt_7f8c12a4e9b01538d4f6",
  "message": "Liveness verified. You may now record attendance."
}
```

---

## 4. Attendance Sessions & Kiosk Marking

### `POST /api/v1/sessions`
Creates a new lecture attendance session in `ACTIVE` status.
- **Access**: Authenticated (ADMIN or FACULTY)
- **Request Body**:
```json
{
  "subject_id": 1,
  "course_id": 1,
  "semester": 6,
  "section": "A",
  "academic_year": "2025-2026",
  "remarks": "Morning lecture on Distributed Systems"
}
```

### `PATCH /api/v1/sessions/{id}/stop`
Closes an attendance session, preventing further live marks.
- **Access**: Authenticated (ADMIN or FACULTY)

### `POST /api/v1/attendance/mark`
Verifies face biometrics against the active session, validates and consumes the single-use liveness token, enforces duplicate prevention, and evaluates late arrival cutoff.
- **Access**: Authenticated
- **Request Body**:
```json
{
  "session_id": 12,
  "image_data": "data:image/jpeg;base64,...",
  "liveness_receipt_token": "rcpt_7f8c12a4e9b01538d4f6"
}
```
- **Response (Success - 200 OK)**:
```json
{
  "student_id": 42,
  "student_name": "Jane Cooper",
  "roll_number": "CS2026-088",
  "status": "PRESENT",
  "confidence_score": 0.884,
  "attendance_record_id": 195,
  "marked_at": "2026-09-11T10:04:12Z"
}
```
- **Response (Duplicate - 409 Conflict)**:
```json
{
  "detail": "Student Jane Cooper (CS2026-088) is already marked for this session."
}
```

### `POST /api/v1/attendance/manual-mark`
Allows a faculty member or administrator to record or update attendance with an audit remark.
- **Access**: Authenticated (ADMIN or FACULTY)
- **Request Body**:
```json
{
  "session_id": 12,
  "student_id": 42,
  "status": "PRESENT",
  "remarks": "Approved medical leave document presented"
}
```

---

## 5. Dashboard & Analytics

### `GET /api/v1/dashboard/summary`
Retrieves college-wide aggregated statistics, 7-day attendance trends, department breakdowns, and live activity feeds.
- **Access**: Authenticated (ADMIN or FACULTY)

### `GET /api/v1/dashboard/low-attendance`
Retrieves a list of students whose attendance rate is below the minimum threshold (default: 75.0%).
- **Access**: Authenticated (ADMIN or FACULTY)

---

## 6. Reports & Document Export

### `GET /api/v1/reports`
Queries attendance summaries and individual logs based on academic criteria.
- **Access**: Authenticated (ADMIN or FACULTY)
- **Query Parameters**:
  - `start_date` (ISO date: `YYYY-MM-DD`)
  - `end_date` (ISO date: `YYYY-MM-DD`)
  - `department_id`, `course_id`, `subject_id`, `semester`, `section`, `status`

### `GET /api/v1/reports/export/pdf`
Streams an institutional PDF report with college masthead, summary roster, and signature lines.
- **Content-Type**: `application/pdf`

### `GET /api/v1/reports/export/excel`
Streams a multi-sheet formatted Excel workbook (.xlsx).
- **Content-Type**: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### `GET /api/v1/reports/export/csv`
Streams an RFC 4180 CSV export formatted with UTF-8 BOM for spreadsheet software compatibility.
- **Content-Type**: `text/csv`

---

## 7. Audit Logs

### `GET /api/v1/audit-logs`
Retrieves system security and operational audit logs.
- **Access**: ADMIN only
- **Query Parameters**:
  - `page` (integer), `size` (integer)
  - `action` (string, e.g., `LOGIN_SUCCESS`, `ATTENDANCE_MANUAL_OVERRIDE`)
  - `user_id` (integer)
