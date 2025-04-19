import csv
import cv2
import numpy as np
from scipy.spatial import distance
import os
import time
from datetime import datetime
import mediapipe as mp

# Initialize MediaPipe Face Mesh
mp_face_mesh = mp.solutions.face_mesh
face_mesh = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=True,
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5)

# Constants
INITIAL_EAR_THRESHOLD = 0.25
FIXATION_THRESHOLD = 40
BLINK_CONSEC_FRAMES = 2
AOI_ZONES = {
    "Left": (0, 0, 213, 240),
    "Center": (214, 0, 426, 240),
    "Right": (427, 0, 640, 240)
}
CSV_FILENAME = "eye_tracking_data_media.csv"
FIELD_NAMES = [
    "timestamp", "gaze_x", "gaze_y", "blink_rate", 
    "pupil_dilation", "fixation_duration", "aoi", "ear_value"
]

# Landmark indices for MediaPipe Face Mesh
LEFT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
RIGHT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
LEFT_IRIS_CENTER = 468
RIGHT_IRIS_CENTER = 473
LEFT_IRIS_RADIUS_INDICES = [469, 470, 471, 472]
RIGHT_IRIS_RADIUS_INDICES = [474, 475, 476, 477]

# State variables
blink_counter = 0
frame_counter = 0
blink_frames = 0
last_gaze = (0, 0)
fixation_start = None
calibrated = False
dynamic_ear_threshold = INITIAL_EAR_THRESHOLD
ear_values = []
pupil_base_size = None

def init_csv():
    """Initialize CSV file with headers"""
    if not os.path.exists(CSV_FILENAME):
        with open(CSV_FILENAME, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=FIELD_NAMES)
            writer.writeheader()

def log_data(data):
    """Append data to CSV file"""
    with open(CSV_FILENAME, 'a', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=FIELD_NAMES)
        writer.writerow(data)

def calculate_ear(eye_points):
    """Calculate Eye Aspect Ratio from eye landmarks"""
    v1 = distance.euclidean(eye_points[1], eye_points[5])
    v2 = distance.euclidean(eye_points[2], eye_points[4])
    h = distance.euclidean(eye_points[0], eye_points[3])
    return (v1 + v2) / (2.0 * h)

def get_eye_ear(face_landmarks, eye_indices, frame_width, frame_height):
    """Extract eye landmarks and calculate EAR"""
    eye_points = []
    for index in eye_indices:
        landmark = face_landmarks.landmark[index]
        x = int(landmark.x * frame_width)
        y = int(landmark.y * frame_height)
        eye_points.append((x, y))
    return calculate_ear(eye_points)

def get_iris_center(face_landmarks, iris_index, frame_width, frame_height):
    """Get iris center coordinates"""
    landmark = face_landmarks.landmark[iris_index]
    return (int(landmark.x * frame_width), int(landmark.y * frame_height))

def get_iris_radius(face_landmarks, center, radius_indices, frame_width, frame_height):
    """Calculate average iris radius"""
    center_x, center_y = center
    total_dist = 0.0
    for index in radius_indices:
        landmark = face_landmarks.landmark[index]
        x = landmark.x * frame_width
        y = landmark.y * frame_height
        total_dist += distance.euclidean((x, y), (center_x, center_y))
    return total_dist / len(radius_indices)

# Initialize CSV and video capture
init_csv()
cap = cv2.VideoCapture(0)
cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)

# Calibration routine
print("Calibrating... (keep eyes open)")
calibration_frames = []
start_time = time.time()
while time.time() - start_time < 3:
    ret, frame = cap.read()
    if ret:
        frame = cv2.flip(frame, 1)
        results = face_mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        if results.multi_face_landmarks:
            face_landmarks = results.multi_face_landmarks[0]
            
            # Calculate EAR
            ear_left = get_eye_ear(face_landmarks, LEFT_EYE_INDICES, 640, 480)
            ear_right = get_eye_ear(face_landmarks, RIGHT_EYE_INDICES, 640, 480)
            avg_ear = (ear_left + ear_right) / 2.0
            ear_values.append(avg_ear)
            
            # Calculate pupil size
            left_iris = get_iris_center(face_landmarks, LEFT_IRIS_CENTER, 640, 480)
            right_iris = get_iris_center(face_landmarks, RIGHT_IRIS_CENTER, 640, 480)
            left_radius = get_iris_radius(face_landmarks, left_iris, LEFT_IRIS_RADIUS_INDICES, 640, 480)
            right_radius = get_iris_radius(face_landmarks, right_iris, RIGHT_IRIS_RADIUS_INDICES, 640, 480)
            calibration_frames.append((left_radius + right_radius) / 2.0)

if ear_values:
    dynamic_ear_threshold = np.mean(ear_values) * 0.7
    print(f"Adjusted EAR threshold: {dynamic_ear_threshold:.2f}")

if calibration_frames:
    pupil_base_size = np.median(calibration_frames)
    print(f"Base pupil size: {pupil_base_size:.2f}px")
    calibrated = True

# Main processing loop
while True:
    log_entry = {
        "timestamp": datetime.now().isoformat(),
        "gaze_x": None, "gaze_y": None,
        "blink_rate": 0.0, "pupil_dilation": None,
        "fixation_duration": 0.0, "aoi": "None",
        "ear_value": None
    }
    
    ret, frame = cap.read()
    if not ret:
        break

    frame = cv2.flip(frame, 1)
    results = face_mesh.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
    frame_height, frame_width = frame.shape[:2]

    if results.multi_face_landmarks:
        face_landmarks = results.multi_face_landmarks[0]
        
        # Blink detection
        ear_left = get_eye_ear(face_landmarks, LEFT_EYE_INDICES, frame_width, frame_height)
        ear_right = get_eye_ear(face_landmarks, RIGHT_EYE_INDICES, frame_width, frame_height)
        avg_ear = (ear_left + ear_right) / 2.0
        log_entry["ear_value"] = avg_ear

        if avg_ear < dynamic_ear_threshold:
            blink_frames += 1
        else:
            if blink_frames >= BLINK_CONSEC_FRAMES:
                blink_counter += 1
            blink_frames = 0

        # Gaze detection
        left_iris = get_iris_center(face_landmarks, LEFT_IRIS_CENTER, frame_width, frame_height)
        right_iris = get_iris_center(face_landmarks, RIGHT_IRIS_CENTER, frame_width, frame_height)
        gaze_x = (left_iris[0] + right_iris[0]) // 2
        gaze_y = (left_iris[1] + right_iris[1]) // 2
        log_entry["gaze_x"], log_entry["gaze_y"] = gaze_x, gaze_y

        # Fixation tracking
        movement = distance.euclidean((gaze_x, gaze_y), last_gaze)
        if movement < FIXATION_THRESHOLD:
            fixation_start = fixation_start or time.time()
            log_entry["fixation_duration"] = time.time() - fixation_start
        else:
            fixation_start = time.time()
        last_gaze = (gaze_x, gaze_y)

        # AOI detection
        current_aoi = []
        for zone, (x1, y1, x2, y2) in AOI_ZONES.items():
            if x1 <= gaze_x <= x2 and y1 <= gaze_y <= y2:
                current_aoi.append(zone)
        log_entry["aoi"] = ",".join(current_aoi) if current_aoi else "None"
        cv2.circle(frame, (gaze_x, gaze_y), 8, (0, 255, 0), -1)
        cv2.putText(frame, f"AOI: {log_entry['aoi']}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)

        # Pupil dilation
        if calibrated:
            left_radius = get_iris_radius(face_landmarks, left_iris, LEFT_IRIS_RADIUS_INDICES, frame_width, frame_height)
            right_radius = get_iris_radius(face_landmarks, right_iris, RIGHT_IRIS_RADIUS_INDICES, frame_width, frame_height)
            pupil_size = (left_radius + right_radius) / 2.0
            pupil_dilation = ((pupil_size - pupil_base_size) / pupil_base_size) * 100
            log_entry["pupil_dilation"] = pupil_dilation

    # Calculate blink rate
    fps = cap.get(cv2.CAP_PROP_FPS)
    log_entry["blink_rate"] = (blink_counter / (frame_counter / fps)) * 60 if frame_counter > 0 else 0

    # Display metrics
    y_offset = 60
    for metric, value in [
        ("Blink Rate", log_entry["blink_rate"]),
        ("Fixation", log_entry["fixation_duration"]),
        ("Pupil", log_entry["pupil_dilation"]),
        ("EAR", log_entry["ear_value"])
    ]:
        if value is not None:
            cv2.putText(frame, f"{metric}: {value:.1f}{'%' if metric == 'Pupil' else ''}", 
                       (10, y_offset), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            y_offset += 30

    # Log data and display
    log_data(log_entry)
    cv2.imshow('Eye Tracking', frame)
    frame_counter += 1

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
