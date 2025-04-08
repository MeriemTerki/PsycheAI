from ultralytics import YOLO
from PIL import Image
import cv2

model = YOLO("models/best_v2.pt")
results = model.predict(source="0", show=True)