import os
from pathlib import Path

# ----------------------   BASE   ----------------------
BASE_DIR = Path(__file__).resolve().parent.parent.parent
MEDIA_DIR = os.path.join(BASE_DIR, 'media')

# ----------------------   CORS   ----------------------
allow_origin_regex = r"https?://.*(localhost)+.*(:[0-9]+)?"
allow_credentials = True
allow_methods = ["*"]
allow_headers = ["*"]
