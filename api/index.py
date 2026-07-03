import os
import sys

# Add the backend directory to python path so app imports resolve correctly
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
backend_dir = os.path.join(project_root, "backend")
sys.path.insert(0, backend_dir)

from app.main import app
